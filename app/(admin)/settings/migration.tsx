import React, { useState } from 'react';
import { View, Text, Alert, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { database } from '../../../src/database';
import Loan from '../../../src/database/models/Loan';
import Borrower from '../../../src/database/models/Borrower';
import Collector from '../../../src/database/models/Collector';
import PaymentSchedule from '../../../src/database/models/PaymentSchedule';
import Payment from '../../../src/database/models/Payment';
import { LoanCalculatorService } from '../../../src/services/LoanCalculatorService';
import uuid from 'react-native-uuid';
import { Q } from '@nozbe/watermelondb';

// We require the extracted JSON data
const migrationData = require('../../../src/assets/migration_data.json');

export default function MigrationScreen() {
    const [isMigrating, setIsMigrating] = useState(false);
    const [progress, setProgress] = useState('');
    const [auditLogs, setAuditLogs] = useState<string[]>([]);

    const runMigration = async () => {
        setIsMigrating(true);
        setAuditLogs([]);
        setProgress('Starting migration...');
        
        try {
            const { collectors, borrowers } = migrationData;

            setProgress(`Upserting ${collectors.length} unique collectors...`);
            const collectorIdMap: Record<string, string> = {}; // Name to ID
            
            await database.write(async () => {
                for (const cName of collectors) {
                    let col = await database.collections.get<Collector>('collectors').query(Q.where('full_name', cName)).fetch();
                    if (col.length > 0) {
                        collectorIdMap[cName] = col[0].id;
                    } else {
                        const newCol = await database.collections.get<Collector>('collectors').create(c => {
                            c._raw.id = uuid.v4().toString();
                            c.fullName = cName;
                            c.isActive = true;
                        });
                        collectorIdMap[cName] = newCol.id;
                    }
                }
            });

            setProgress(`Upserting ${borrowers.length} borrowers and their loans...`);
            
            const logs: string[] = [];
            
            // Loop sequentially through borrowers to not lock the UI entirely
            for (let i = 0; i < borrowers.length; i++) {
                const bData = borrowers[i];
                if (i % 10 === 0) setProgress(`Processing borrower ${i + 1} of ${borrowers.length}...`);

                await database.write(async () => {
                    // Upsert Borrower
                    let borrower = await database.collections.get<Borrower>('borrowers').query(Q.where('full_name', bData.name)).fetch();
                    let borrowerId = '';
                    if (borrower.length > 0) {
                        borrowerId = borrower[0].id;
                    } else {
                        const newB = await database.collections.get<Borrower>('borrowers').create(b => {
                            b._raw.id = uuid.v4().toString();
                            b.fullName = bData.name;
                            b.address = bData.address;
                            b.phone = bData.phone;
                            b.business = bData.business;
                            b.collectorId = collectorIdMap[bData.collector] || null;
                        });
                        borrowerId = newB.id;
                    }

                    // Sort chronological to build reloan graph
                    const sortedLoans = bData.loans.sort((a: any, b: any) => {
                        return (a.releaseDate || 0) - (b.releaseDate || 0);
                    });

                    let previousLoanId: string | null = null;
                    const allCreates = [];

                    for (const loanData of sortedLoans) {
                        const currentLoanId = uuid.v4().toString();

                        let interestRate = 0;
                        if (loanData.principal > 0) {
                            interestRate = (loanData.totalInterest / loanData.principal) * 100;
                        }

                        const isReloanFlag = previousLoanId !== null;

                        allCreates.push(database.collections.get<Loan>('loans').prepareCreate(loan => {
                            loan._raw.id = currentLoanId;
                            loan.borrowerId = borrowerId;
                            loan.loanNumber = LoanCalculatorService.generateLoanNumber();
                            loan.principalAmount = loanData.principal;
                            loan.interestRate = interestRate;
                            loan.interestType = 'flat';
                            loan.term = loanData.days > 0 ? loanData.days : 40;
                            loan.termUnit = loanData.frequency === 'weekly' ? 'months' : 'days';
                            loan.frequency = loanData.frequency;
                            loan.installmentAmount = loanData.installmentAmt;
                            loan.totalAmount = loanData.totalLoan;
                            loan.insuranceAmount = loanData.insurance;
                            loan.depositAmount = 0; 
                            loan.status = loanData.isPaid ? 'paid' : 'active';
                            loan.encodedBy = 'migration';
                            loan.collectorId = collectorIdMap[bData.collector] || null;
                            
                            loan.isReloan = isReloanFlag;
                            if (isReloanFlag) {
                                loan.previousLoanId = previousLoanId;
                            }

                            if (loanData.releaseDate) loan.releaseDate = loanData.releaseDate;
                            if (loanData.maturityDate) loan.maturityDate = loanData.maturityDate;
                        }));

                        previousLoanId = currentLoanId;

                        // Re-calculate math schedule to map payments accurately 
                        let totalDynamicPaid = 0;
                        const calcRes = LoanCalculatorService.calculate(
                            loanData.principal,
                            interestRate,
                            loanData.days > 0 ? loanData.days : 40,
                            loanData.frequency === 'weekly' ? 'months' : 'days',
                            'flat',
                            loanData.frequency,
                            loanData.releaseDate ? new Date(loanData.releaseDate) : new Date(),
                            0, /* interestOnlyPeriod */
                            loanData.insurance
                        );

                        // Map actual payments
                        for (let idx = 0; idx < calcRes.schedule.length; idx++) {
                            const row = calcRes.schedule[idx];
                            const pMatch = loanData.payments.shift(); // take chronological payment
                            
                            let pStatus = 'pending';
                            if (pMatch) {
                               pStatus = 'paid';
                               totalDynamicPaid += pMatch.amount;
                               allCreates.push(database.collections.get<Payment>('payments').prepareCreate(p => {
                                   p._raw.id = uuid.v4().toString();
                                   p.loanId = currentLoanId;
                                   p.amount = pMatch.amount;
                                   p.paymentDate = pMatch.date;
                                   p.collectorId = collectorIdMap[bData.collector] || null;
                               }));
                            }

                            allCreates.push(database.collections.get<PaymentSchedule>('payment_schedules').prepareCreate(sched => {
                                sched._raw.id = uuid.v4().toString();
                                sched.loanId = currentLoanId;
                                sched.dueDate = row.dueDate.getTime();
                                sched.scheduledAmount = row.scheduledAmount;
                                sched.principalAmount = row.principal;
                                sched.interestAmount = row.interest;
                                sched.feesAmount = row.fees || 0; // Use fees as insurance
                                sched.status = pStatus;
                            }));
                        }

                        // If any dangling payments, dump them as extra payments
                        for (const extraP of loanData.payments) {
                            totalDynamicPaid += extraP.amount;
                            allCreates.push(database.collections.get<Payment>('payments').prepareCreate(p => {
                                   p._raw.id = uuid.v4().toString();
                                   p.loanId = currentLoanId;
                                   p.amount = extraP.amount;
                                   p.paymentDate = extraP.date;
                                   p.collectorId = collectorIdMap[bData.collector] || null;
                            }));
                        }
                        
                        // Audit Balance
                        const dynamicBalance = loanData.totalLoan - totalDynamicPaid;
                        const excelBalance = loanData.excelBalance;
                        
                        if (Math.abs(dynamicBalance - excelBalance) > 1.0) {
                            logs.push(`Row ${loanData.rowOrigin} [${bData.name}]: App Bal (${dynamicBalance.toFixed(2)}) != Excel (${excelBalance.toFixed(2)})`);
                        }
                    }

                    // Execute batch for this borrower
                    if (allCreates.length > 0) {
                        await database.batch(...allCreates);
                    }
                });
            }

            setProgress('Migration completed successfully!');
            setAuditLogs(logs);
            Alert.alert('Done', 'Excel data migrated to WatermelonDB.');
        } catch (e: any) {
            Alert.alert('Error', e.message);
            setProgress('Migration failed.');
        } finally {
            setIsMigrating(false);
        }
    };

    const repairCollectors = async () => {
        setIsMigrating(true);
        setProgress('Repairing collector status...');
        try {
            await database.write(async () => {
                const collectors = await database.collections.get<Collector>('collectors').query().fetch();
                const toUpdate = collectors.filter(c => !c.isActive).map(c => 
                    c.prepareUpdate(col => {
                        col.isActive = true;
                    })
                );
                if (toUpdate.length > 0) {
                    await database.batch(...toUpdate);
                    Alert.alert('Success', `Updated ${toUpdate.length} collectors to active status.`);
                } else {
                    Alert.alert('Info', 'All collectors are already active.');
                }
            });
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setIsMigrating(false);
            setProgress('');
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.header}>Excel Data Migration</Text>
            <Text style={styles.desc}>
                This tool will import the pre-extracted `migration_data.json` payload into the local WatermelonDB database.
                It will chronologically link reloans and re-compute dynamic payment schedules to resolve the balance.
            </Text>

            <TouchableOpacity 
                style={[styles.button, isMigrating && styles.buttonDisabled]} 
                onPress={runMigration} 
                disabled={isMigrating}
            >
                <Text style={styles.buttonText}>{isMigrating ? 'Migrating...' : 'Run JSON Import'}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
                style={[styles.button, { marginTop: 10, backgroundColor: '#4CAF50' }, isMigrating && styles.buttonDisabled]} 
                onPress={repairCollectors} 
                disabled={isMigrating}
            >
                <Text style={styles.buttonText}>Repair Collector Status</Text>
            </TouchableOpacity>


            <Text style={styles.progress}>{progress}</Text>

            {auditLogs.length > 0 && (
                <View style={styles.auditBox}>
                    <Text style={styles.auditHeader}>Audit Log Discrepancies ({auditLogs.length})</Text>
                    {auditLogs.map((l, i) => (
                        <Text key={i} style={styles.auditText}>{l}</Text>
                    ))}
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { padding: 20 },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
    desc: { fontSize: 14, color: '#666', marginBottom: 20 },
    button: { backgroundColor: '#FF8C00', padding: 15, borderRadius: 8, alignItems: 'center' },
    buttonDisabled: { backgroundColor: '#ccc' },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    progress: { marginTop: 20, fontSize: 16, fontStyle: 'italic' },
    auditBox: { marginTop: 20, backgroundColor: '#f9f9f9', padding: 15, borderRadius: 8, borderColor: '#eee', borderWidth: 1 },
    auditHeader: { fontWeight: 'bold', fontSize: 16, marginBottom: 10, color: '#d32f2f' },
    auditText: { fontSize: 12, marginBottom: 4 }
});
