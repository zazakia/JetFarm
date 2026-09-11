import { database } from '../database';
import Loan from '../database/models/Loan';
import Payment from '../database/models/Payment';
import PaymentSchedule from '../database/models/PaymentSchedule';
import Borrower from '../database/models/Borrower';
import { LoanCalcResult } from './LoanCalculatorService';
import uuid from 'react-native-uuid';
import { Database, Q } from '@nozbe/watermelondb';
import ActionLogService from './ActionLogService';
import { AutoPostingService } from './AutoPostingService';


export class LoanService {
    /**
     * Standardized method to disburse a loan.
     * Handles creation/update of loans, generation of schedules,
     * and automatic closure of previous loans if it's a renewal.
     */
    static async saveLoan(params: {
        loanId: string;
        loanNumber: string;
        loanType?: string;
        borrowerId: string;
        principalAmount: number;
        interestRate: number;
        interestType: any;
        term: number;
        termUnit: any;
        frequency: any;
        calcResult: LoanCalcResult;
        depositAmount?: number;
        insuranceAmount?: number;
        processingFee?: number;
        collectionFee?: number;
        notarialFee?: number;
        rodFee?: number;
        ltoFee?: number;
        udiRebatableFee?: number;
        vatOnInterest?: number;
        vatOnCharges?: number;
        dstFee?: number;
        rebateAmount?: number;
        savingsPerPayment?: number;
        collectorId: string;
        encodedBy: string;
        releaseDate: Date | number;
        status: 'pending' | 'active';
        isReloan: boolean;
        previousLoanId?: string;
        deductedAmount?: number;
        loanBatch?: number | null;
        loanCycle?: number | null;
        interestAmount: number;
        isEditing?: boolean;
        existingLoan?: Loan | null;
        database?: any;
    }) {
        const {
            loanId, loanNumber, borrowerId, principalAmount, interestRate,
            interestType, term, termUnit, frequency, calcResult,
            depositAmount, insuranceAmount, collectorId, encodedBy,
            releaseDate, status, isReloan, previousLoanId, deductedAmount,
            loanBatch, loanCycle, interestAmount, isEditing, existingLoan,
            database: customDb
        } = params;

        const db: Database = customDb || database;
        const parsedReleaseDate = typeof releaseDate === 'number' ? new Date(releaseDate) : releaseDate;
        const releaseTimestamp = (parsedReleaseDate || new Date()).getTime();

        await db.write(async () => {
            const ops: any[] = [];
            const logParams: any[] = [];

            // Enforce "1 Loan = 1 Member" constraint (Issue #2)
            if (status === 'active' && !isEditing) {
                const activeLoans = await db.get<Loan>('loans').query(
                    Q.where('borrower_id', borrowerId),
                    Q.where('status', Q.oneOf(['active', 'defaulted'])),
                    Q.where('deleted_at', Q.eq(null))
                ).fetch();

                const nonRenewedActiveLoans = activeLoans.filter(l => !isReloan || l.id !== previousLoanId);
                if (nonRenewedActiveLoans.length > 0) {
                    throw new Error('Member already has an active loan. Enforcing 1 active loan per member rule.');
                }
            }

            if (isEditing && existingLoan?.status === 'active') {
                const existingPayments = await db.get<Payment>('payments').query(
                    Q.where('loan_id', existingLoan.id),
                    Q.where('deleted_at', Q.eq(null))
                ).fetch();

                if (existingPayments.length > 0) {
                    throw new Error('Cannot edit an active loan after payments have been recorded. Use a dedicated adjustment or reversal workflow instead.');
                }
            }

            // 1. Create or Update the Loan
            const updateFields = (loan: Loan) => {
                if (!isEditing) {
                    loan._raw.id = loanId;
                    loan.loanNumber = loanNumber;
                    loan.status = status;
                    loan.encodedBy = encodedBy;
                    loan.collectorId = collectorId;
                } else {
                    // Refresh status if it was pending and we are now activating it
                    if (existingLoan?.status === 'pending' && status === 'active') {
                        loan.status = 'active';
                    }
                }
                
                loan.borrowerId = borrowerId;
                loan.loanType = params.loanType || 'standard';
                loan.principalAmount = principalAmount;
                loan.interestRate = interestRate;
                loan.interestType = interestType;
                loan.term = term;
                loan.termUnit = termUnit;
                loan.frequency = frequency;
                loan.installmentAmount = calcResult.installmentAmount;
                loan.totalAmount = calcResult.totalAmount;
                loan.depositAmount = depositAmount || 0;
                loan.insuranceAmount = insuranceAmount || 0;
                loan.processingFee = params.processingFee || 0;
                loan.collectionFee = params.collectionFee || 0;
                loan.notarialFee = params.notarialFee || 0;
                loan.rodFee = params.rodFee || 0;
                loan.ltoFee = params.ltoFee || 0;
                loan.udiRebatableFee = params.udiRebatableFee || 0;
                loan.vatOnInterest = params.vatOnInterest || calcResult.institutionalBreakdown?.vatOnInterest || 0;
                loan.vatOnCharges = params.vatOnCharges || calcResult.institutionalBreakdown?.vatOnOtherCharges || 0;
                loan.dstFee = params.dstFee || calcResult.institutionalBreakdown?.dstFee || 0;
                loan.rebateAmount = params.rebateAmount || 0;
                loan.savingsPerPayment = params.savingsPerPayment || 0;
                
                if (status === 'active' || (isEditing && existingLoan?.status === 'active')) {
                    loan.releaseDate = releaseTimestamp;
                    loan.maturityDate = calcResult.maturityDate.getTime();
                    loan.firstPaymentDate = calcResult.firstPaymentDate.getTime();
                }
                
                loan.isReloan = isReloan;
                loan.previousLoanId = isReloan ? (previousLoanId || '') : '';
                loan.deductedAmount = isReloan ? (deductedAmount || 0) : 0;
                loan.loanBatch = loanBatch || null;
                loan.loanCycle = loanCycle || null;
                loan.interestAmount = interestAmount;
            };

            if (isEditing && existingLoan) {
                logParams.push({
                    entityType: 'loans',
                    entityId: loanId,
                    action: 'UPDATE',
                    oldData: { ...existingLoan._raw },
                    newData: { status, principalAmount, totalAmount: calcResult.totalAmount }
                });
                ops.push(existingLoan.prepareUpdate(updateFields));
                
                // If editing and moving to active, clear old schedules if they exist
                if (status === 'active' || existingLoan.status === 'active') {
                    const oldSchedules = await db.get<PaymentSchedule>('payment_schedules')
                        .query(Q.where('loan_id', loanId)).fetch();
                    ops.push(...oldSchedules.map(s => s.prepareDestroyPermanently()));
                }
            } else {
                logParams.push({
                    entityType: 'loans',
                    entityId: loanId,
                    action: 'CREATE',
                    newData: { loanNumber, borrowerId, principalAmount, totalAmount: calcResult.totalAmount }
                });
                ops.push(db.get<Loan>('loans').prepareCreate(updateFields));
            }

            // 2. Create Payment Schedules if status is active
            if (status === 'active' || (isEditing && existingLoan?.status === 'active')) {
                const schedulesToCreate = calcResult.schedule.map(row => {
                    return db.get<PaymentSchedule>('payment_schedules').prepareCreate(sched => {
                        sched._raw.id = uuid.v4().toString();
                        sched.loanId = loanId;
                        sched.dueDate = row.dueDate.getTime();
                        sched.scheduledAmount = row.scheduledAmount;
                        sched.principalAmount = row.principal;
                        sched.interestAmount = row.interest;
                        sched.feesAmount = row.fees || 0;
                        sched.status = 'pending';
                    });
                });
                ops.push(...schedulesToCreate);
            }

            // 3. Handle Old Loan Closure if renewal AND status is active.
            // A renewal should close the referenced previous loan even when the
            // previous balance is already zero; otherwise borrowers can retain
            // parallel active loans after a renewal.
            if (status === 'active' && isReloan && previousLoanId) {
                const oldLoan = await db.get<Loan>('loans').find(previousLoanId);

                logParams.push({
                    entityType: 'loans',
                    entityId: oldLoan.id,
                    action: 'UPDATE',
                    oldData: { status: oldLoan.status },
                    newData: { status: 'paid' }
                });
                ops.push(oldLoan.prepareUpdate(l => {
                    l.status = 'paid';
                }));

                if ((deductedAmount || 0) > 0) {
                    const paymentId = uuid.v4().toString();
                    logParams.push({
                        entityType: 'payments',
                        entityId: paymentId,
                        action: 'CREATE',
                        newData: { loanId: oldLoan.id, amount: deductedAmount, notes: `Closed via Renewal to ${loanNumber}` }
                    });
                    ops.push(db.get<Payment>('payments').prepareCreate(p => {
                        p._raw.id = paymentId;
                        p.loanId = oldLoan.id;
                        p.borrowerId = oldLoan.borrowerId;
                        p.scheduleId = '';
                        p.amount = deductedAmount || 0;
                        p.paymentDate = releaseTimestamp;
                        p.notes = `Closed via Renewal to ${loanNumber}`;
                        p.collectorId = oldLoan.collectorId || encodedBy;
                        p.encodedAt = Date.now();
                    }));
                }

                const oldSchedules = await db.get<PaymentSchedule>('payment_schedules')
                    .query(Q.where('loan_id', oldLoan.id), Q.where('status', Q.notEq('paid')))
                    .fetch();
                ops.push(...oldSchedules.map(s => s.prepareUpdate(ds => { ds.status = 'paid'; })));
            }

            // 4. Audit Trail
            if (logParams.length > 0) {
                const auditOps = await ActionLogService.prepareLogActions(logParams);
                ops.push(...auditOps);
            }

            await db.batch(...ops);
        });

        if (status === 'active' && (!isEditing || existingLoan?.status !== 'active')) {
            try {
                const borrower = await db.get<Borrower>('borrowers').find(borrowerId).catch(() => null);
                await AutoPostingService.postLoanDisbursement({
                    loanId,
                    amount: principalAmount,
                    entryDate: parsedReleaseDate || new Date(),
                    borrowerName: borrower?.fullName,
                    postedBy: encodedBy || undefined,
                }).catch(e => console.warn('[LoanService] Auto-posting journal entry failed:', e));
            } catch (e) {
                console.warn('[LoanService] Auto-posting calculation failed:', e);
            }
        }
    }
}
