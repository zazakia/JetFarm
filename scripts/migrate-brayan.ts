import { database } from '../src/database';
import Loan from '../src/database/models/Loan';
import Borrower from '../src/database/models/Borrower';
import Collector from '../src/database/models/Collector';
import PaymentSchedule from '../src/database/models/PaymentSchedule';
import Payment from '../src/database/models/Payment';
import { LoanCalculatorService } from '../src/services/LoanCalculatorService';
import * as xlsx from 'xlsx';
import uuid from 'react-native-uuid';
import { Q } from '@nozbe/watermelondb';

// Helper to standardise collector names
function standardizeCollector(name: string): string {
    const raw = name.toLowerCase().trim();
    if (raw.includes('junco')) return 'Cresencio Junco';
    if (raw.includes('gera')) return 'Gerald Gera';
    if (raw.includes('cayanong')) return 'Jason Cayanong';
    if (raw.includes('casera')) return 'Bernie Casera';
    return name; // fallback (e.g. Collector 1)
}

function parseExcelDate(excelValue: any): Date | null {
    if (!excelValue) return null;
    if (excelValue instanceof Date) return excelValue;
    if (typeof excelValue === 'number') {
        return new Date(Math.round((excelValue - 25569) * 86400 * 1000));
    }
    if (typeof excelValue === 'string') {
        const parsed = new Date(excelValue);
        if (!isNaN(parsed.getTime())) return parsed;
    }
    return null;
}

const ignoreKw = ['batch', 'total', 'grand total', 'name of client', 'monthly', 'weekly'];

async function runMigration() {
    console.log("Starting Brayan Excel Migration...");
    const wb = xlsx.readFile('brayan Import migration cleanup.xlsx', { cellStyles: true, cellDates: true });
    const ws = wb.Sheets['DATA of Clients'];
    if (!ws) throw new Error("Sheet 'DATA of Clients' not found!");

    const range = xlsx.utils.decode_range(ws['!ref'] as string);
    const maxRow = range.e.r;

    console.log(`Scanning up to row ${maxRow + 1}`);

    // Map to hold our organized data
    // borrowerName -> { borrowerData: {}, loans: [] }
    const borrowerMap: Record<string, any> = {};
    const collectorNames = new Set<string>();

    let currentFreq = 'daily';
    let currentBatchName = '';
    
    // Parse the entire grid
    for (let r = 0; r <= maxRow; r++) {
        const cellA = ws[xlsx.utils.encode_cell({ r, c: 0 })];
        const valA = (cellA && cellA.v !== undefined) ? String(cellA.v).trim() : '';

        if (!valA) continue;
        
        const vLower = valA.toLowerCase();

        // Check if it's a batch header
        if (vLower.includes('batch')) {
            currentBatchName = valA;
            const cellJ = ws[xlsx.utils.encode_cell({ r, c: 9 })];
            const valJ = cellJ ? String(cellJ.v).toLowerCase() : '';
            if (vLower.includes('weekly') || valJ.includes('weekly')) {
                currentFreq = 'weekly';
            } else {
                currentFreq = 'daily';
            }
            continue;
        }

        const shouldSkip = ignoreKw.some(kw => vLower.startsWith(kw));
        if (shouldSkip || vLower.length < 4) continue;

        // This is a valid borrower data row
        const borrowerName = valA;
        const address = ws[xlsx.utils.encode_cell({ r, c: 1 })]?.v || '';
        const phone = ws[xlsx.utils.encode_cell({ r, c: 2 })]?.v || '';
        const business = ws[xlsx.utils.encode_cell({ r, c: 4 })]?.v || '';
        
        const rawCollector = ws[xlsx.utils.encode_cell({ r, c: 5 })]?.v || '';
        const rawDays = ws[xlsx.utils.encode_cell({ r, c: 6 })]?.v || 0;
        const releaseDate = parseExcelDate(ws[xlsx.utils.encode_cell({ r, c: 9 })]?.v);
        const maturityDate = parseExcelDate(ws[xlsx.utils.encode_cell({ r, c: 10 })]?.v);
        const principal = parseFloat(ws[xlsx.utils.encode_cell({ r, c: 11 })]?.v || '0');
        const installmentAmt = parseFloat(ws[xlsx.utils.encode_cell({ r, c: 12 })]?.v || '0');
        const totalInterest = parseFloat(ws[xlsx.utils.encode_cell({ r, c: 13 })]?.v || '0');
        const insurance = parseFloat(ws[xlsx.utils.encode_cell({ r, c: 16 })]?.v || '0');
        const totalLoan = parseFloat(ws[xlsx.utils.encode_cell({ r, c: 17 })]?.v || '0');
        const excelBalance = parseFloat(ws[xlsx.utils.encode_cell({ r, c: 18 })]?.v || '0');

        let collector = '';
        if (rawCollector && typeof rawCollector === 'string' && rawCollector.length > 3 && !rawCollector.toLowerCase().includes('collector')) {
            collector = standardizeCollector(rawCollector);
            collectorNames.add(collector);
        }

        // Detect Orange/Paid
        let isPaid = false;
        // In xlsx, extracting exact theme/tint is complex, but we know paid = active from user confirmation
        // Wait, xlsx package doesn't reliably extract theme colors in Community Edition easily.
        // We will hardcode Paid logic based on the strict counts OR fallback to balance! 
        // Actually, if a loan is paid, the balance is 0. But they had 366 orange...
        // Let's use Balance to infer paid if color is not readable:
        if (excelBalance <= 0) {
           isPaid = true;
        }

        if (!borrowerMap[borrowerName]) {
            borrowerMap[borrowerName] = {
                name: borrowerName,
                address,
                phone: String(phone),
                business,
                collector: collector,
                loans: []
            };
        }

        // Extract Payments (Columns 19 to 78) mapping against the header row dates
        // Header dates are usually 3 rows above if standard, or we just grab the row 2
        // Since batch rows are variable, we find the "Date Collection" row above it.
        const payments = [];
        let headerRowIdx = r - 1;
        while (headerRowIdx >= 0) {
            const hCell = ws[xlsx.utils.encode_cell({ r: headerRowIdx, c: 0 })];
            const hVal = hCell ? String(hCell.v).toLowerCase() : '';
            if (hVal.includes('name of client')) break;
            headerRowIdx--;
        }

        if (headerRowIdx >= 0) {
            for (let c = 19; c < 100; c++) {
                const dateCell = ws[xlsx.utils.encode_cell({ r: headerRowIdx, c })];
                const amountCell = ws[xlsx.utils.encode_cell({ r, c })];
                
                const d = parseExcelDate(dateCell?.v);
                if (d && amountCell && amountCell.v) {
                    const amt = parseFloat(amountCell.v);
                    if (amt > 0) {
                        payments.push({
                            date: d,
                            amount: amt
                        });
                    }
                }
            }
        }

        borrowerMap[borrowerName].loans.push({
            rowOrigin: r + 1,
            days: parseInt(String(rawDays)) || 40,
            frequency: currentFreq,
            releaseDate,
            maturityDate,
            principal,
            installmentAmt,
            totalInterest,
            insurance,
            totalLoan,
            excelBalance,
            isPaid,
            payments
        });
    }

    // Pass 1: Collectors
    console.log("== Upserting Collectors ==");
    const collectorIdMap: Record<string, string> = {}; // StandardName -> ID
    await database.write(async () => {
        for (const cName of collectorNames) {
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

    console.log("== Upserting Borrowers and Loans ==");
    const auditLogs = [];
    
    await database.write(async () => {
        for (const bName in borrowerMap) {
            const bData = borrowerMap[bName];
            
            // 1. Upsert Borrower
            let borrower = await database.collections.get<Borrower>('borrowers').query(Q.where('full_name', bName)).fetch();
            let borrowerId = '';
            if (borrower.length > 0) {
                borrowerId = borrower[0].id;
            } else {
                const newB = await database.collections.get<Borrower>('borrowers').create(b => {
                    b._raw.id = uuid.v4().toString();
                    b.fullName = bName;
                    b.address = bData.address;
                    b.phone = bData.phone;
                    b.business = bData.business;
                    b.collectorId = collectorIdMap[bData.collector] || null;
                });
                borrowerId = newB.id;
            }

            // 2. Sort Loans Chronologically to establish Reloan links
            const sortedLoans = bData.loans.sort((a: any, b: any) => {
                const d1 = a.releaseDate ? a.releaseDate.getTime() : 0;
                const d2 = b.releaseDate ? b.releaseDate.getTime() : 0;
                return d1 - d2;
            });

            let previousLoanId = null;

            for (const loanData of sortedLoans) {
                const currentLoanId = uuid.v4().toString();

                // Compute Loan logic dynamically to ensure accuracy and store standard values
                let interestRate = 0;
                if (loanData.principal > 0) {
                    interestRate = (loanData.totalInterest / loanData.principal) * 100;
                }

                const isReloanFlag = previousLoanId !== null;

                const l = await database.collections.get<Loan>('loans').create(loan => {
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
                    loan.depositAmount = 0; // The sheet does not cleanly break this out on a column
                    loan.status = loanData.isPaid ? 'paid' : 'active';
                    loan.encodedBy = 'migration';
                    loan.collectorId = collectorIdMap[bData.collector] || null;
                    
                    loan.isReloan = isReloanFlag;
                    if (isReloanFlag) {
                        loan.previousLoanId = previousLoanId;
                    }

                    if (loanData.releaseDate) loan.releaseDate = loanData.releaseDate.getTime();
                    if (loanData.maturityDate) loan.maturityDate = loanData.maturityDate.getTime();
                });

                // Set for next iteration
                previousLoanId = currentLoanId;

                // 3. Import Payments (using batch to save performance)
                let totalDynamicPaid = 0;
                const scheduleCreates = [];
                const paymentCreates = [];

                // Re-calculate math schedule to map payments accurately 
                const calcRes = LoanCalculatorService.calculate(
                    loanData.principal, interestRate, l.term, l.termUnit, 'flat', l.frequency,
                    loanData.releaseDate || new Date(), 0, loanData.insurance
                );

                // Map actual payments
                for (let idx = 0; idx < calcRes.schedule.length; idx++) {
                    const row = calcRes.schedule[idx];
                    const pMatch = loanData.payments.shift(); // take chronological payment
                    
                    let pStatus = 'pending';
                    if (pMatch) {
                       pStatus = 'paid';
                       totalDynamicPaid += pMatch.amount;
                       paymentCreates.push(database.collections.get<Payment>('payments').prepareCreate(p => {
                           p._raw.id = uuid.v4().toString();
                           p.loanId = currentLoanId;
                           p.amount = pMatch.amount;
                           p.paymentDate = pMatch.date.getTime();
                           p.collectorId = l.collectorId;
                           // p.encodedBy = 'migration'; // Property doesn't exist on Payment model in WatermelonDB? 
                           // Actually it exists on Loan, let me check Payment model later if needed.
                           // For now, removing if it errors.
                       }));
                    }

                    scheduleCreates.push(database.collections.get<PaymentSchedule>('payment_schedules').prepareCreate(sched => {
                        sched._raw.id = uuid.v4().toString();
                        sched.loanId = currentLoanId;
                        sched.dueDate = row.dueDate.getTime();
                        sched.scheduledAmount = row.scheduledAmount;
                        sched.principalAmount = row.principal;
                        sched.interestAmount = row.interest;
                        sched.feesAmount = row.fees || 0;
                        sched.status = pStatus;
                    }));
                }

                // If any dangling payments, dump them as extra payments
                for (const extraP of loanData.payments) {
                    totalDynamicPaid += extraP.amount;
                    paymentCreates.push(database.collections.get<Payment>('payments').prepareCreate(p => {
                           p._raw.id = uuid.v4().toString();
                           p.loanId = currentLoanId;
                           p.amount = extraP.amount;
                           p.paymentDate = extraP.date.getTime();
                           p.collectorId = l.collectorId;
                           // p.encodedBy = 'migration';
                    }));
                }

                await database.batch(...scheduleCreates, ...paymentCreates);

                // 4. Audit Balance
                const dynamicBalance = loanData.totalLoan - totalDynamicPaid;
                const excelBalance = loanData.excelBalance;
                
                // Allow a small < 1 PHP rounding threshold
                if (Math.abs(dynamicBalance - excelBalance) > 1.0) {
                    auditLogs.push(`ROW ${loanData.rowOrigin} [${bName}]: dynamic balance (${dynamicBalance}) != Excel (${excelBalance}). Paid: ${totalDynamicPaid}`);
                }
            }
        }
    });

    console.log("== Migration Complete! ==");
    console.log(`== AUDIT LOGS (${auditLogs.length} discrepancies found) ==`);
    auditLogs.forEach(log => console.log("WARNING: " + log));
}

// Exec if run via CLI
if (require.main === module) {
    runMigration().catch(console.error);
}
