import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Linking , Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { safeBack } from '../../../../src/utils/navigation';
import { database } from '../../../../src/database';
import Borrower from '../../../../src/database/models/Borrower';
import Loan from '../../../../src/database/models/Loan';
import Payment from '../../../../src/database/models/Payment';
import PaymentSchedule from '../../../../src/database/models/PaymentSchedule';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPHP } from '../../../../src/utils/currency';
import { formatDate } from '../../../../src/utils/dates';
import { PdfGenerator } from '../../../../src/services/PdfGenerator';
import { LoanCalculatorService } from '../../../../src/services/LoanCalculatorService';
import ConfirmDialog from '../../../../src/components/ConfirmDialog';

import { BorrowerSearchBar } from '../../../../src/components/BorrowerSearchBar';
import { CalculationBasisCard } from '../../../../src/components/CalculationBasisCard';
import { sortLoansChronologically } from '../../../../src/utils/loanOrdering';
import { PaymentService } from '../../../../src/services/PaymentService';
import { computeSchedulePenalties } from '../../../../src/utils/penalty';
import { loanProductLabel } from '../../../../src/utils/loanProducts';

function SpecItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
    return (
        <View className="w-1/2 mb-4 pr-2">
            <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest mb-0.5">{label}</Text>
            <Text className={`text-sm font-black ${highlight ? 'text-red-700' : 'text-gray-900'}`}>{value}</Text>
        </View>
    );
}

export default function ClientPassbookScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const [borrower, setBorrower] = useState<Borrower | null>(null);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>([]);
    const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isConfirmDeletePaymentVisible, setIsConfirmDeletePaymentVisible] = useState(false);
    const [selectedPaymentToDelete, setSelectedPaymentToDelete] = useState<Payment | null>(null);
    const [saving, setSaving] = useState(false);
    const [printing, setPrinting] = useState(false);

    const loadData = async () => {
        try {
            const b = await database.collections.get<Borrower>('borrowers').find(id);
            const l = await database.collections.get<Loan>('loans').query(
                Q.where('borrower_id', id),
                Q.where('deleted_at', Q.eq(null)),
                Q.sortBy('created_at', Q.desc)
            ).fetch();
            const loanIds = l.map(loan => loan.id);
            const [p, schedules] = loanIds.length > 0
                ? await Promise.all([
                    database.collections.get<Payment>('payments').query(
                        Q.where('loan_id', Q.oneOf(loanIds)),
                        Q.where('deleted_at', Q.eq(null)),
                        Q.sortBy('payment_date', Q.asc)
                    ).fetch(),
                    database.collections.get<PaymentSchedule>('payment_schedules').query(
                        Q.where('loan_id', Q.oneOf(loanIds)),
                        Q.where('deleted_at', Q.eq(null))
                    ).fetch(),
                ])
                : [[], []];

            const orderedLoans = sortLoansChronologically(l);

            setBorrower(b);
            setLoans(orderedLoans);
            setPayments(p);
            setPaymentSchedules(schedules);

            if (orderedLoans.length > 0 && !selectedLoanId) {
                const activeLoan = orderedLoans.find(loan => loan.status === 'active') || orderedLoans[0];
                setSelectedLoanId(activeLoan.id);
            }
        } catch (error) {
            console.error('Passbook load error:', error);
            safeBack(router, '/(admin)');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            loadData();
        }, [id])
    );

    const confirmDeletePayment = async () => {
        if (!selectedPaymentToDelete) return;
        setSaving(true);
        setIsConfirmDeletePaymentVisible(false);
        try {
            await PaymentService.softDeletePayment(selectedPaymentToDelete.id);
            await loadData();
            if (Platform.OS === 'web') {
                window.alert("Payment record moved to trash.");
            }
        } catch (e: any) {
            console.error('Failed to delete payment', e);
            Alert.alert("Error", "Could not delete payment.");
        } finally {
            setSaving(false);
            setSelectedPaymentToDelete(null);
        }
    };

    if (loading || !borrower) {
        return <ActivityIndicator size="large" color="#D32F2F" className="flex-1 bg-gray-50" style={{ paddingTop: 100 }} />;
    }

    const selectedLoan = loans.find(l => l.id === selectedLoanId);
    const loanPayments = selectedLoan ? payments.filter(p => p.loanId === selectedLoan.id) : [];

    const totalPaid = loanPayments.reduce((s, p) => s + p.amount, 0);
    const selectedPenalties = selectedLoan
        ? computeSchedulePenalties(paymentSchedules.filter(schedule => schedule.loanId === selectedLoan.id))
        : [];
    const selectedPenaltyTotal = selectedPenalties.reduce((sum, penalty) => sum + penalty.penaltyAmount, 0);

    // GROSS METHOD: Everything is grouped together. Total Balance is simply Total Loan - Total Paid.
    const depositAmount = selectedLoan?.depositAmount || 0;
    const insuranceAmount = selectedLoan?.insuranceAmount || 0;
    const grossTotalLoan = selectedLoan?.totalAmount || 1;
    
    // Fraction of each payment that goes to Savings and Insurance (for informational tracking)
    const savingsRatio = depositAmount / grossTotalLoan;
    const insuranceRatio = insuranceAmount / grossTotalLoan;

    // Totals for the summary cards
    const accumulatedSavings = totalPaid * savingsRatio;
    const grossBalance = Math.max(0, grossTotalLoan + selectedPenaltyTotal - totalPaid);

    // New calculations for Loan Specifications
    const netLoanReleased = selectedLoan ? selectedLoan.principalAmount - (selectedLoan.deductedAmount || 0) : 0;
    const numTerms = selectedLoan ? LoanCalculatorService.paymentsForFrequency(selectedLoan.term, selectedLoan.termUnit, selectedLoan.frequency) : 1;
    const dailySavings = selectedLoan ? (selectedLoan.depositAmount || 0) / numTerms : 0;
    const dailyInsurance = selectedLoan ? (selectedLoan.insuranceAmount || 0) / numTerms : 0;

    // Process Ledger with Gross Method
    let currentBalance = grossTotalLoan + selectedPenaltyTotal;
    const ledgerRows = [...loanPayments]
        .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime())
        .map(p => {
            const pSavings = p.amount * savingsRatio;
            currentBalance -= p.amount;
            return {
                id: p.id,
                paymentDate: p.paymentDate,
                amount: p.amount,
                pLoan: p.amount, // Whole amount contributes to balance reduction
                pSavings,
                runningBalance: Math.max(0, currentBalance)
            };
        })
        .reverse();

    const handlePrint = async () => {
        if (!borrower || loans.length === 0 || printing) return;

        setPrinting(true);
        try {
            await PdfGenerator.generateBorrowerStatementOfAccount(
                {
                    fullName: borrower.fullName,
                    address: borrower.decryptedAddress || undefined,
                    phone: borrower.decryptedPhone || undefined, 
                    dateOfBirth: borrower.dateOfBirth,
                    gender: borrower.gender || undefined,
                },
                loans.map(loan => {
                    const loanPaymentRows = payments
                        .filter(payment => payment.loanId === loan.id)
                        .sort((a, b) => a.paymentDate - b.paymentDate);
                    const penalties = computeSchedulePenalties(
                        paymentSchedules.filter(schedule => schedule.loanId === loan.id)
                    );
                    const totalPenalty = penalties.reduce((sum, penalty) => sum + penalty.penaltyAmount, 0);
                    let runningBalance = loan.totalAmount + totalPenalty;
                    const loanSavingsRatio = loan.totalAmount > 0
                        ? (loan.depositAmount || 0) / loan.totalAmount
                        : 0;

                    return {
                        loan: {
                            loanNumber: loan.loanNumber,
                            loanType: loan.loanType,
                            principalAmount: loan.principalAmount,
                            interestRate: loan.interestRate,
                            interestType: loan.interestType,
                            term: loan.term,
                            termUnit: loan.termUnit,
                            frequency: loan.frequency,
                            installmentAmount: loan.installmentAmount,
                            depositAmount: loan.depositAmount,
                            insuranceAmount: loan.insuranceAmount,
                            totalAmount: loan.totalAmount,
                            status: loan.status,
                            releaseDate: loan.releaseDate as number,
                            maturityDate: loan.maturityDate as number,
                            deductedAmount: loan.deductedAmount,
                            processingFee: loan.processingFee,
                            collectionFee: loan.collectionFee,
                            notarialFee: loan.notarialFee,
                            rodFee: loan.rodFee,
                            ltoFee: loan.ltoFee,
                            udiRebatableFee: loan.udiRebatableFee,
                            vatOnInterest: loan.vatOnInterest,
                            vatOnCharges: loan.vatOnCharges,
                            dstFee: loan.dstFee,
                            rebateAmount: loan.rebateAmount,
                            savingsPerPayment: loan.savingsPerPayment,
                        },
                        payments: loanPaymentRows.map(payment => {
                            runningBalance = Math.max(0, runningBalance - payment.amount);
                            return {
                                paymentDate: payment.paymentDate,
                                amount: payment.amount,
                                pSavings: payment.amount * loanSavingsRatio,
                                receiptNumber: payment.receiptNumber || undefined,
                                notes: payment.notes || undefined,
                                runningBalance,
                            };
                        }),
                        penalties: penalties.map(penalty => ({
                            dueDate: penalty.dueDate,
                            amountDue: penalty.amountDue,
                            daysDelayed: penalty.daysDelayed,
                            penaltyAmount: penalty.penaltyAmount,
                            reason: penalty.reason,
                        })),
                    }
                })
            );
        } catch (e) {
            console.error('Generate PDF failed:', e);
            alert('Failed to generate PDF.');
        } finally {
            setPrinting(false);
        }
    };

    return (
        <View className="flex-1 bg-gray-50">
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <BorrowerSearchBar currentBorrowerId={id} placeholder="Jump to another borrower..." />
                {/* Header Info Card */}
                <View className="bg-blue-900 p-6 rounded-3xl shadow-md mb-6 relative overflow-hidden">
                    <View className="absolute -right-10 -top-10 bg-white/10 w-40 h-40 rounded-full" />
                    <View className="absolute -left-10 -bottom-10 bg-white/5 w-32 h-32 rounded-full" />

                    <View className="flex-row items-center mb-4">
                        <View className="w-14 h-14 bg-white/20 rounded-full items-center justify-center mr-4 border border-white/30">
                            <Text className="text-white font-black text-2xl">{borrower.fullName.charAt(0)}</Text>
                        </View>
                        <View className="flex-1">
                            <Text className="text-2xl font-extrabold text-white mb-1" numberOfLines={1}>{borrower.fullName}</Text>
                            {borrower.phone && (
                                <Pressable className="flex-row items-center bg-white/10 px-3 py-1.5 rounded-full self-start" onPress={() => Linking.openURL(`tel:${borrower.phone}`)}>
                                    <MaterialIcons name="phone" size={14} color="#FFF" className="mr-1.5" />
                                    <Text className="text-white font-bold text-xs tracking-wider">{borrower.decryptedPhone}</Text>
                                </Pressable>
                            )}
                        </View>
                    </View>

                    {borrower.address && (
                        <View className="flex-row items-start mt-2 bg-white/10 p-3 rounded-xl">
                            <MaterialIcons name="location-on" size={16} color="#FFF" className="mr-2 mt-0.5" />
                            <Text className="text-white/90 text-sm flex-1">{borrower.decryptedAddress}</Text>
                        </View>
                    )}
                </View>

                {/* Loan Selector (if multiple) */}
                {loans.length > 1 && (
                    <View className="mb-6">
                        <Text className="text-xs font-bold text-gray-700 uppercase tracking-widest mb-3">Select Loan Timeline</Text>
                        <ScrollView  horizontal showsHorizontalScrollIndicator={false} >
                            {loans.map(loan => (
                                <Pressable
                                    key={loan.id}
                                    onPress={() => setSelectedLoanId(loan.id)}
                                    className={`px-5 py-3 rounded-2xl border mr-3 flex-row items-center ${selectedLoanId === loan.id ? 'bg-red-700 border-red-700' : 'bg-white border-gray-200'}`}
                                >
                                    <MaterialIcons name={loan.status === 'active' ? 'play-circle-outline' : 'check-circle'} size={18} color={selectedLoanId === loan.id ? '#FFF' : '#6B7280'} className="mr-2" />
                                    <View>
                                        <View className="flex-row items-center">
                                            <Text className={`font-extrabold ${selectedLoanId === loan.id ? 'text-white' : 'text-gray-900'}`}>{loan.loanNumber}</Text>
                                            {loan.isReloan && (
                                                <View className={`ml-2 px-1.5 py-0.5 rounded-md ${selectedLoanId === loan.id ? 'bg-white/20' : 'bg-blue-100'}`}>
                                                    <Text className={`text-[8px] font-black uppercase ${selectedLoanId === loan.id ? 'text-white' : 'text-blue-700'}`}>Renewal</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text className={`text-[10px] font-bold uppercase ${selectedLoanId === loan.id ? 'text-white/80' : 'text-gray-700'}`}>
                                            {loanProductLabel(loan.loanType)} • {loan.status}
                                        </Text>
                                    </View>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Loan Summary */}
                {selectedLoan ? (
                    <View>
                        <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6 relative overflow-hidden">
                            <View className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-xl ${selectedLoan.status === 'active' ? 'bg-blue-100' :
                                selectedLoan.status === 'paid' ? 'bg-green-100' :
                                    selectedLoan.status === 'defaulted' ? 'bg-red-100' : 'bg-gray-100'
                                }`}>
                                <Text className={`text-xs font-black uppercase tracking-wider ${selectedLoan.status === 'active' ? 'text-blue-800' :
                                    selectedLoan.status === 'paid' ? 'text-green-800' :
                                        selectedLoan.status === 'defaulted' ? 'text-red-800' : 'text-gray-800'
                                    }`}>{selectedLoan.status}</Text>
                            </View>

                            <Text className="text-xs font-bold text-gray-700 uppercase tracking-widest mb-1 mt-2">Loan Balance</Text>
                            <Text className="text-4xl font-black text-gray-900 mb-2 tracking-tighter">{formatPHP(grossBalance)}</Text>

                            {selectedLoan.isReloan && (
                                <View className="flex-row items-center bg-blue-50 self-start px-2 py-1 rounded-lg mb-4">
                                    <MaterialIcons name="loop" size={14} color="#1D4ED8" className="mr-1.5" />
                                    <Text className="text-[10px] font-bold text-blue-700 uppercase">
                                        Renewal of {loans.find(l => l.id === selectedLoan.previousLoanId)?.loanNumber || 'Previous Loan'}
                                    </Text>
                                </View>
                            )}

                            <View className="flex-row border-t border-gray-100 pt-5">
                                <View className="flex-1 items-center border-r border-gray-100">
                                    <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest mb-1">Loan Amount (Principal)</Text>
                                    <Text className="text-base font-extrabold text-blue-900">{formatPHP(selectedLoan.principalAmount)}</Text>
                                </View>
                                <View className="flex-1 items-center border-r border-gray-100">
                                    <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest mb-1">Total Loan (P+I)</Text>
                                    <Text className="text-base font-extrabold text-blue-600">{formatPHP(grossTotalLoan)}</Text>
                                </View>
                                <View className="flex-1 items-center border-r border-gray-100">
                                    <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest mb-1">Total Paid</Text>
                                    <Text className="text-base font-extrabold text-yellow-500">{formatPHP(totalPaid)}</Text>
                                </View>
                                <View className="flex-1 items-center">
                                    <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest mb-1">Total Savings</Text>
                                    <Text className="text-base font-extrabold text-orange-600">{formatPHP(accumulatedSavings)}</Text>
                                </View>
                            </View>

                            <View className="mt-4 p-3 bg-orange-50 rounded-xl border border-orange-100 flex-row justify-between items-center">
                                <View className="flex-1 pr-3">
                                    <Text className="text-[10px] font-bold text-orange-700 uppercase tracking-widest">Computed Penalty</Text>
                                    <Text className="text-[10px] text-orange-600 mt-1">
                                        Amount due × 5% ÷ 30 × days delayed
                                    </Text>
                                </View>
                                <Text className="text-base font-black text-orange-700">{formatPHP(selectedPenaltyTotal)}</Text>
                            </View>

                            <Pressable
                                testID="passbook-print-statement"
                                disabled={printing}
                                className={`mt-6 flex-row items-center justify-center p-3 rounded-xl ${printing ? 'bg-gray-200' : 'bg-red-50 active:bg-red-100'}`}
                                onPress={handlePrint}
                            >
                                {printing ? (
                                    <ActivityIndicator size="small" color="#D32F2F" />
                                ) : (
                                    <MaterialIcons name="print" size={20} color="#D32F2F" className="mr-2" />
                                )}
                                <Text className="text-red-700 font-bold uppercase tracking-wider text-xs ml-2">
                                    {printing ? 'Preparing Statement...' : 'Print Statement of Account'}
                                </Text>
                            </Pressable>
                        </View>

                        {/* Loan Specifications Section */}
                        <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6">
                            <Text className="text-xs font-bold text-gray-700 uppercase tracking-widest mb-4">Loan Specifications</Text>
                            
                            <View className="flex-row flex-wrap">
                                <SpecItem label="Batch" value={selectedLoan.loanBatch?.toString() || '—'} />
                                <SpecItem label="Cycle" value={selectedLoan.loanCycle?.toString() || '—'} />
                                <SpecItem label="Date Released" value={selectedLoan.releaseDate ? formatDate(new Date(selectedLoan.releaseDate)) : '—'} />
                                <SpecItem label="Maturity Date" value={selectedLoan.maturityDate ? formatDate(new Date(selectedLoan.maturityDate)) : '—'} />
                                <SpecItem label="Loan Amount (Principal)" value={formatPHP(selectedLoan.principalAmount)} />
                                <SpecItem label="Daily/Weekly Collection" value={formatPHP(selectedLoan.installmentAmount)} />
                                <SpecItem label="Interest Rate" value={`${selectedLoan.interestRate}%`} />
                                <SpecItem label="Interest Amount" value={formatPHP(selectedLoan.interestAmount || 0)} />
                                <SpecItem label="Insurance Portion" value={`${formatPHP(dailyInsurance)} / terms`} />
                                <SpecItem label="Savings Portion" value={`${formatPHP(dailySavings)} / terms`} />
                                <SpecItem label="Net Loan Released" value={formatPHP(netLoanReleased)} highlight />
                                <SpecItem label="Insurance Total" value={formatPHP(selectedLoan.insuranceAmount || 0)} />
                            </View>

                            {selectedLoan.deductedAmount > 0 && (
                                <View className="mt-4 p-3 bg-red-50 rounded-xl border border-red-100 flex-row justify-between items-center">
                                    <View className="flex-row items-center">
                                        <MaterialIcons name="history" size={16} color="#D32F2F" className="mr-2" />
                                        <Text className="text-[10px] font-bold text-red-700 uppercase">Upfront Deductions</Text>
                                    </View>
                                    <Text className="text-sm font-black text-red-700">{formatPHP(selectedLoan.deductedAmount)}</Text>
                                </View>
                            )}
                        </View>

                        <CalculationBasisCard interestType={selectedLoan.interestType} title="Payment Distribution Logic" />
                    </View>
                ) : (
                    <View className="bg-white rounded-2xl p-8 mb-6 border border-gray-100 items-center justify-center">
                        <MaterialIcons name="money-off" size={48} color="#D1D5DB" />
                        <Text className="text-gray-700 font-bold mt-4">No loans found for this borrower.</Text>
                    </View>
                )}

                {/* Ledger */}
                {selectedLoan && (
                    <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-20">
                        <Text className="text-lg font-extrabold text-gray-900 mb-6">Payment Ledger</Text>

                        <View className="flex-row border-b-2 border-gray-100 pb-3 mb-2">
                            <Text className="flex-1 text-xs font-bold text-gray-700 uppercase tracking-widest">Date</Text>
                            <Text className="flex-1 text-xs font-bold text-gray-700 uppercase tracking-widest text-right">Amount</Text>
                            <Text className="flex-[0.8] text-xs font-bold text-gray-700 uppercase tracking-widest text-right">Savings</Text>
                            <Text className="flex-1 text-xs font-bold text-gray-700 uppercase tracking-widest text-right">Balance</Text>
                            <View className="w-8 ml-2"></View>
                        </View>

                        {ledgerRows.length === 0 ? (
                            <Text className="text-center text-gray-700 py-8 font-medium">No payments recorded</Text>
                        ) : (
                            ledgerRows.map((row, idx) => (
                                <View key={row.id} className={`flex-row items-center py-4 ${idx < ledgerRows.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                    <View className="flex-1 flex-row items-center">
                                        <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                                        <Text className="text-sm font-bold text-gray-900">{formatDate(new Date(row.paymentDate))}</Text>
                                    </View>
                                    <Text className="flex-1 text-sm font-extrabold text-yellow-500 text-right">+{formatPHP(row.amount)}</Text>
                                    <Text className="flex-[0.8] text-sm font-bold text-orange-600 text-right">{formatPHP(row.pSavings)}</Text>
                                    <View className="flex-1 items-end justify-center">
                                        <Text className="text-sm font-bold text-gray-900">{formatPHP(row.runningBalance)}</Text>
                                    </View>
                                    <Pressable 
                                        onPress={() => {
                                            const p = loanPayments.find(lp => lp.id === row.id);
                                            if (p) {
                                                setSelectedPaymentToDelete(p);
                                                setIsConfirmDeletePaymentVisible(true);
                                            }
                                        }}
                                        className="w-8 ml-2 p-1 bg-red-50 rounded-lg active:bg-red-100 items-center justify-center"
                                    >
                                        <MaterialIcons name="delete-outline" size={16} color="#DC2626" />
                                    </Pressable>
                                </View>
                            ))
                        )}

                        {/* Initial Loan Disbursement Row */}
                        <View className="flex-row items-center py-4 border-t-2 border-dashed border-gray-100 mt-2 bg-gray-50 -mx-6 px-6">
                            <View className="flex-1 flex-row items-center">
                                <View className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                                <Text className="text-sm font-bold text-gray-900">
                                    {selectedLoan.releaseDate ? formatDate(new Date(selectedLoan.releaseDate)) : 'Disbursement'}
                                </Text>
                            </View>
                            <Text className="flex-1 text-sm font-extrabold text-blue-900 text-right">Loan Issued</Text>
                            <Text className="flex-[0.8] text-sm font-bold text-gray-700 text-right">—</Text>
                            <View className="flex-1 items-end justify-center">
                                <Text className="text-sm font-extrabold text-gray-900">{formatPHP(grossTotalLoan)}</Text>
                            </View>
                            <View className="w-8 ml-2"></View>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* FAB to Add Payment */}
            {selectedLoan && selectedLoan.status !== 'paid' && (
                <Pressable
                    className="absolute bottom-6 right-6 flex-row items-center bg-red-700 px-6 py-4 rounded-full shadow-xl active:bg-red-800"
                    onPress={() => router.push(`/(admin)/payments/new?loanId=${selectedLoan.id}`)}
                >
                    <MaterialIcons name="add" size={24} color="#FFFFFF" className="mr-2" />
                    <Text className="text-white font-black uppercase tracking-wider">Record Payment</Text>
                </Pressable>
            )}

            <ConfirmDialog
                visible={isConfirmDeletePaymentVisible}
                title="Delete Payment Record?"
                message={`Are you sure you want to delete this payment of ${selectedPaymentToDelete ? formatPHP(selectedPaymentToDelete.amount) : ''}? This will update the loan balance and can be restored from Trash.`}
                confirmLabel="Delete"
                onConfirm={confirmDeletePayment}
                onCancel={() => {
                    setIsConfirmDeletePaymentVisible(false);
                    setSelectedPaymentToDelete(null);
                }}
                isDestructive
            />
        </View>
    );
}
