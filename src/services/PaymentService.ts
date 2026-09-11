import { Database, Q } from '@nozbe/watermelondb';
import uuid from 'react-native-uuid';
import { database as defaultDatabase } from '../database';
import Loan from '../database/models/Loan';
import Payment from '../database/models/Payment';
import PaymentSchedule from '../database/models/PaymentSchedule';
import LoanPenalty from '../database/models/LoanPenalty';
import SavingsTransaction from '../database/models/SavingsTransaction';
import Borrower from '../database/models/Borrower';
import { ActionLogService, LogParams } from './ActionLogService';
import { AuthService } from './AuthService';
import { ExcessCashReceiptService } from './ExcessCashReceiptService';
import { AutoPostingService } from './AutoPostingService';

const NOT_DELETED = Q.where('deleted_at', null);
const PESO_TOLERANCE = 1;
const AUTO_DEPOSIT_NOTE_PREFIX = 'Auto-deposit from payment for schedule';

export interface PostPaymentParams {
    loanId: string;
    amount: number;
    paymentDate: Date | number;
    paymentType?: string;
    receiptNumber?: string | null;
    notes?: string | null;
    currentSalary?: number | null;
    encodedBy?: string | null;
    collectorId?: string | null;
    database?: Database;
}

export interface UpdatePaymentParams {
    amount: number;
    paymentDate: Date | number;
    paymentType?: string;
    receiptNumber?: string | null;
    notes?: string | null;
    currentSalary?: number | null;
    database?: Database;
    performedBy?: string | null;
}

export interface SoftDeletePaymentParams {
    database?: Database;
    performedBy?: string | null;
}

export interface ApplySavingsToLoanParams extends PostPaymentParams {
    borrowerId: string;
}

export interface LoanBalanceSummary {
    loan: Loan;
    totalPaid: number;
    penaltyTotal: number;
    totalExpected: number;
    balance: number;
}

export class PaymentService {
    static async getLoanBalance(loanId: string, db: Database = defaultDatabase): Promise<LoanBalanceSummary> {
        const loan = await db.get<Loan>('loans').find(loanId);
        const payments = await db.get<Payment>('payments').query(
            NOT_DELETED,
            Q.where('loan_id', loanId)
        ).fetch();
        const penalties = await db.get<LoanPenalty>('loan_penalties').query(
            NOT_DELETED,
            Q.where('loan_id', loanId)
        ).fetch();

        const totalPaid = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
        const penaltyTotal = penalties.reduce((sum, penalty) => sum + (penalty.amount || 0), 0);
        const totalExpected = (loan.totalAmount || 0) + penaltyTotal;

        return {
            loan,
            totalPaid,
            penaltyTotal,
            totalExpected,
            balance: Math.max(0, totalExpected - totalPaid),
        };
    }

    static async postPayment(params: PostPaymentParams): Promise<Payment> {
        const db = params.database || defaultDatabase;

        const payment = await db.write(async () => {
            console.time('[PaymentService] postPayment');
            const auditUser = params.encodedBy || await AuthService.getCurrentUserId() || 'system';
            const logParams: LogParams[] = [];
            const payment = await (this as any).createPaymentWithinTransaction(db, params, logParams);

            const auditOps = new ActionLogService(db).prepareLogActionsSync(logParams, auditUser);
            if (auditOps.length > 0) {
                console.log(`[PaymentService] Batching ${auditOps.length} audit operations for new payment...`);
                await db.batch(...auditOps);
            }

            console.timeEnd('[PaymentService] postPayment');
            return payment;
        });

        // Auto-post to double-entry accounting ledger (DR Cash on Hand / CR Loans Receivable & Interest Income)
        try {
            const loan = await db.get<Loan>('loans').find(params.loanId);
            const borrower = loan?.borrowerId ? await db.get<Borrower>('borrowers').find(loan.borrowerId).catch(() => null) : null;
            const ratio = (loan?.totalAmount && loan.totalAmount > 0) ? (loan.principalAmount / loan.totalAmount) : 1;
            const principal = Math.round(params.amount * ratio * 100) / 100;
            const interest = Math.max(0, Math.round((params.amount - principal) * 100) / 100);

            await AutoPostingService.postPayment({
                paymentId: payment.id,
                principal,
                interest,
                entryDate: typeof params.paymentDate === 'number' ? new Date(params.paymentDate) : params.paymentDate,
                borrowerName: borrower?.fullName,
                postedBy: params.encodedBy || undefined,
            });
        } catch (e) {
            console.warn('[PaymentService] Auto-posting calculation failed:', e);
        }

        return payment;
    }

    static async applySavingsToLoan(params: ApplySavingsToLoanParams): Promise<Payment> {
        const db = params.database || defaultDatabase;

        let withdrawal: SavingsTransaction | undefined;
        const payment = await db.write(async () => {
            console.time('[PaymentService] applySavingsToLoan');
            const auditUser = params.encodedBy || await AuthService.getCurrentUserId() || 'system';
            const logParams: LogParams[] = [];
            const payment = await (this as any).createPaymentWithinTransaction(db, params, logParams);

            withdrawal = await db.get<SavingsTransaction>('savings_transactions').create(record => {
                record._raw.id = uuid.v4().toString();
                record.borrowerId = params.borrowerId;
                record.type = 'withdraw_loan';
                record.amount = params.amount;
                record.referenceId = payment.id;
                record.date = typeof params.paymentDate === 'number' ? params.paymentDate : params.paymentDate.getTime();
                record.notes = `Payment to loan via savings. ${params.notes?.trim() || ''}`.trim();
            });

            logParams.push({
                entityType: 'savings_transactions',
                entityId: withdrawal.id,
                action: 'CREATE',
                performedBy: params.encodedBy || undefined,
                newData: {
                    borrowerId: params.borrowerId,
                    type: 'withdraw_loan',
                    amount: params.amount,
                    referenceId: payment.id,
                },
            });

            const auditOps = new ActionLogService(db).prepareLogActionsSync(logParams, auditUser);
            if (auditOps.length > 0) {
                await db.batch(...auditOps);
            }

            console.timeEnd('[PaymentService] applySavingsToLoan');
            return payment;
        });

        // Auto-post to double-entry accounting ledger
        try {
            const loan = await db.get<Loan>('loans').find(params.loanId);
            const borrower = loan?.borrowerId ? await db.get<Borrower>('borrowers').find(loan.borrowerId).catch(() => null) : null;
            const ratio = (loan?.totalAmount && loan.totalAmount > 0) ? (loan.principalAmount / loan.totalAmount) : 1;
            const principal = Math.round(params.amount * ratio * 100) / 100;
            const interest = Math.max(0, Math.round((params.amount - principal) * 100) / 100);

            await AutoPostingService.postPayment({
                paymentId: payment.id,
                principal,
                interest,
                entryDate: typeof params.paymentDate === 'number' ? new Date(params.paymentDate) : params.paymentDate,
                borrowerName: borrower?.fullName,
                postedBy: params.encodedBy || undefined,
            });

            if (withdrawal) {
                await AutoPostingService.postSavingsTransaction({
                    transactionId: withdrawal.id,
                    type: 'withdrawal',
                    amount: params.amount,
                    entryDate: typeof params.paymentDate === 'number' ? new Date(params.paymentDate) : params.paymentDate,
                    borrowerName: borrower?.fullName,
                    postedBy: params.encodedBy || undefined,
                });
            }
        } catch (e) {
            console.warn('[PaymentService] Auto-posting applySavingsToLoan failed:', e);
        }

        return payment;
    }

    static async updatePayment(paymentId: string, params: UpdatePaymentParams): Promise<Payment> {
        const db = params.database || defaultDatabase;
        const nextPaymentDate = typeof params.paymentDate === 'number'
            ? params.paymentDate
            : params.paymentDate.getTime();

        return await db.write(async () => {
            console.time(`[PaymentService] updatePayment:${paymentId}`);
            const auditUser = params.performedBy || await AuthService.getCurrentUserId() || 'system';
            const logParams: LogParams[] = [];
            const payment = await db.get<Payment>('payments').find(paymentId);
            const loan = await db.get<Loan>('loans').find(payment.loanId);
            const oldPaymentData: any = { ...payment._raw };

            const linkedSavings = await db.get<SavingsTransaction>('savings_transactions').query(
                NOT_DELETED,
                Q.where('reference_id', payment.id)
            ).fetch();

            await payment.update(record => {
                record.amount = params.amount;
                record.currentSalary = Number.isFinite(params.currentSalary as number) ? params.currentSalary as number : 0;
                record.excessCash = ExcessCashReceiptService.calculateExcessCash(record.currentSalary || 0, params.amount);
                record.paymentDate = nextPaymentDate;
                record.paymentType = params.paymentType || 'cash';
                record.receiptNumber = params.receiptNumber ? String(params.receiptNumber).trim() : null;
                record.notes = params.notes ? String(params.notes).trim() : null;
                record.updatedAt = Date.now();
            });

            logParams.push({
                entityType: 'payments',
                entityId: payment.id,
                action: 'UPDATE',
                performedBy: params.performedBy || undefined,
                oldData: {
                    amount: oldPaymentData.amount,
                    paymentDate: oldPaymentData.payment_date,
                    paymentType: oldPaymentData.payment_type,
                    receiptNumber: oldPaymentData.receipt_number,
                    notes: oldPaymentData.notes,
                    currentSalary: oldPaymentData.current_salary,
                    excessCash: oldPaymentData.excess_cash,
                },
                newData: {
                    amount: params.amount,
                    paymentDate: nextPaymentDate,
                    paymentType: params.paymentType || 'cash',
                    receiptNumber: params.receiptNumber ? String(params.receiptNumber).trim() : null,
                    notes: params.notes ? String(params.notes).trim() : null,
                    currentSalary: payment.currentSalary,
                    excessCash: payment.excessCash,
                },
            });

            for (const savings of linkedSavings) {
                if (savings.type === 'withdraw_loan') {
                    const oldSavingsData: any = { ...savings._raw };
                    await savings.update(record => {
                        record.amount = params.amount;
                        record.date = nextPaymentDate;
                        record.notes = `Payment to loan via savings. ${params.notes ? String(params.notes).trim() : ''}`.trim();
                    });
                    logParams.push({
                        entityType: 'savings_transactions',
                        entityId: savings.id,
                        action: 'UPDATE',
                        performedBy: params.performedBy || undefined,
                        oldData: {
                            amount: oldSavingsData.amount,
                            date: oldSavingsData.date,
                            notes: oldSavingsData.notes,
                        },
                        newData: {
                            amount: params.amount,
                            date: nextPaymentDate,
                            notes: savings.notes,
                        },
                    });
                }
            }

            await this.recomputeLoanAfterPayment(db, loan, {
                paymentId: payment.id,
                paymentDate: nextPaymentDate,
                performedBy: params.performedBy || undefined,
                logParams,
            });

            const auditOps = new ActionLogService(db).prepareLogActionsSync(logParams, auditUser);
            if (auditOps.length > 0) {
                console.log(`[PaymentService] Batching ${auditOps.length} audit operations...`);
                await db.batch(...auditOps);
            }

            console.timeEnd(`[PaymentService] updatePayment:${paymentId}`);
            return payment;
        });
    }

    static async softDeletePayment(paymentId: string, params: SoftDeletePaymentParams = {}): Promise<void> {
        const db = params.database || defaultDatabase;
        const deletedAt = Date.now();

        await db.write(async () => {
            console.time(`[PaymentService] softDeletePayment:${paymentId}`);
            const auditUser = params.performedBy || await AuthService.getCurrentUserId() || 'system';
            const logParams: LogParams[] = [];
            const payment = await db.get<Payment>('payments').find(paymentId);
            const loan = await db.get<Loan>('loans').find(payment.loanId);

            const oldPaymentData = { ...payment._raw };
            
            // We update the payment immediately so that recomputeLoanAfterPayment's query sees the deletion
            await payment.update(record => {
                record.deletedAt = deletedAt;
            });

            logParams.push({
                entityType: 'payments',
                entityId: payment.id,
                action: 'DELETE',
                performedBy: params.performedBy || undefined,
                oldData: oldPaymentData,
            });

            const linkedSavings = await db.get<SavingsTransaction>('savings_transactions').query(
                NOT_DELETED,
                Q.where('reference_id', payment.id)
            ).fetch();

            for (const savings of linkedSavings) {
                const oldSavingsData = { ...savings._raw };
                await savings.update(record => {
                    record.deletedAt = deletedAt;
                });
                logParams.push({
                    entityType: 'savings_transactions',
                    entityId: savings.id,
                    action: 'DELETE',
                    performedBy: params.performedBy || undefined,
                    oldData: oldSavingsData,
                });
            }

            await this.recomputeLoanAfterPayment(db, loan, {
                paymentId: payment.id,
                performedBy: params.performedBy || undefined,
                logParams,
            });

            const auditOps = new ActionLogService(db).prepareLogActionsSync(logParams, auditUser);
            if (auditOps.length > 0) {
                console.log(`[PaymentService] Batching ${auditOps.length} audit operations for deletion...`);
                await db.batch(...auditOps);
            }
            console.timeEnd(`[PaymentService] softDeletePayment:${paymentId}`);
        });
    }

    static async recomputeLoanAfterPayment(
        db: Database,
        loan: Loan,
        options: { paymentId?: string; paymentDate?: number; performedBy?: string; logParams?: LogParams[] } = {}
    ): Promise<void> {
        console.time(`[PaymentService] recomputeLoanAfterPayment:${loan.id}`);
        const schedules = await this.fetchSchedules(db, loan.id);
        const payments = await db.get<Payment>('payments').query(
            NOT_DELETED,
            Q.where('loan_id', loan.id)
        ).fetch();
        const penalties = await db.get<LoanPenalty>('loan_penalties').query(
            NOT_DELETED,
            Q.where('loan_id', loan.id)
        ).fetch();

        const totalPaid = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
        const penaltyTotal = penalties.reduce((sum, penalty) => sum + (penalty.amount || 0), 0);
        const totalExpected = (loan.totalAmount || 0) + penaltyTotal;

        const childRenewals = await db.get<Loan>('loans').query(
            NOT_DELETED,
            Q.where('previous_loan_id', loan.id),
            Q.where('is_reloan', true)
        ).fetch();
        const wasRenewed = childRenewals.length > 0;

        await this.recomputeScheduleStatuses(db, loan, schedules, totalPaid, options);

        if (totalPaid >= totalExpected - PESO_TOLERANCE && loan.status !== 'paid') {
            const oldStatus = loan.status;
            await loan.update(record => {
                record.status = 'paid';
            });
            options.logParams?.push({
                entityType: 'loans',
                entityId: loan.id,
                action: 'UPDATE',
                performedBy: options.performedBy,
                oldData: { status: oldStatus },
                newData: { status: 'paid' },
            });
        } else if (totalPaid < totalExpected - PESO_TOLERANCE && loan.status === 'paid' && !wasRenewed) {
            const oldStatus = loan.status;
            await loan.update(record => {
                record.status = 'active';
            });
            options.logParams?.push({
                entityType: 'loans',
                entityId: loan.id,
                action: 'UPDATE',
                performedBy: options.performedBy,
                oldData: { status: oldStatus },
                newData: { status: 'active' },
            });
        }

        console.timeEnd(`[PaymentService] recomputeLoanAfterPayment:${loan.id}`);
    }

    private static async recomputeScheduleStatuses(
        db: Database,
        loan: Loan,
        schedules: PaymentSchedule[],
        totalPaid: number,
        options: { paymentId?: string; paymentDate?: number; performedBy?: string; logParams?: LogParams[] }
    ): Promise<void> {
        if (schedules.length === 0) return;

        let remainingPaid = totalPaid;
        const now = Date.now();

        for (const schedule of schedules) {
            const scheduledAmount = schedule.scheduledAmount || 0;
            const previousStatus = schedule.status;
            let nextStatus = 'pending';

            if (remainingPaid >= scheduledAmount - PESO_TOLERANCE) {
                remainingPaid = Math.max(0, remainingPaid - scheduledAmount);
                nextStatus = 'paid';
            } else if (remainingPaid > PESO_TOLERANCE) {
                remainingPaid = 0;
                nextStatus = 'partial';
            } else {
                nextStatus = (schedule.dueDate as number) < now ? 'late' : 'pending';
            }

            if (previousStatus !== nextStatus) {
                await schedule.update(record => {
                    record.status = nextStatus;
                });

                options.logParams?.push({
                    entityType: 'payment_schedules',
                    entityId: schedule.id,
                    action: 'UPDATE',
                    performedBy: options.performedBy,
                    oldData: { status: previousStatus },
                    newData: { status: nextStatus },
                });
            }
        }

        await this.reconcileAutoDeposits(db, loan, schedules, options);
    }

    private static async reconcileAutoDeposits(
        db: Database,
        loan: Loan,
        schedules: PaymentSchedule[],
        options: { paymentId?: string; paymentDate?: number; performedBy?: string; logParams?: LogParams[] }
    ): Promise<void> {
        const perScheduleDeposit = schedules.length > 0 ? (loan.depositAmount || 0) / schedules.length : 0;
        if (perScheduleDeposit <= PESO_TOLERANCE) return;

        const paidSchedules = schedules.filter(schedule => schedule.status === 'paid');
        const desiredCount = paidSchedules.length;

        const loanPayments = await db.get<Payment>('payments').query(
            NOT_DELETED,
            Q.where('loan_id', loan.id),
            Q.sortBy('payment_date', Q.asc)
        ).fetch();
        const paymentIds = new Set(loanPayments.map(payment => payment.id));

        const borrowerDeposits = await db.get<SavingsTransaction>('savings_transactions').query(
            NOT_DELETED,
            Q.where('borrower_id', loan.borrowerId),
            Q.where('type', 'deposit')
        ).fetch();

        const autoDeposits = borrowerDeposits
            .filter(tx => paymentIds.has(tx.referenceId) && (tx.notes || '').startsWith(AUTO_DEPOSIT_NOTE_PREFIX))
            .sort((a, b) => (a.date as number) - (b.date as number));

        if (autoDeposits.length > desiredCount) {
            const deletedAt = Date.now();
            const extraDeposits = autoDeposits.slice(desiredCount);

            for (const savings of extraDeposits) {
                const oldSavingsData = { ...savings._raw };
                await savings.update(record => {
                    record.deletedAt = deletedAt;
                });
                options.logParams?.push({
                    entityType: 'savings_transactions',
                    entityId: savings.id,
                    action: 'DELETE',
                    performedBy: options.performedBy,
                    oldData: oldSavingsData,
                });
            }
        }

        if (autoDeposits.length < desiredCount) {
            const missingSchedules = paidSchedules.slice(autoDeposits.length);
            const referenceId = options.paymentId || loanPayments[loanPayments.length - 1]?.id || '';
            const date = options.paymentDate || Date.now();

            for (const schedule of missingSchedules) {
                const savings = await db.get<SavingsTransaction>('savings_transactions').create(record => {
                    record._raw.id = uuid.v4().toString();
                    record.borrowerId = loan.borrowerId;
                    record.type = 'deposit';
                    record.amount = perScheduleDeposit;
                    record.referenceId = referenceId;
                    record.date = date;
                    record.notes = `${AUTO_DEPOSIT_NOTE_PREFIX} ${new Date(schedule.dueDate as number).toLocaleDateString()}`;
                });

                options.logParams?.push({
                    entityType: 'savings_transactions',
                    entityId: savings.id,
                    action: 'CREATE',
                    performedBy: options.performedBy,
                    newData: {
                        borrowerId: loan.borrowerId,
                        amount: perScheduleDeposit,
                        referenceId,
                    },
                });
            }
        }
    }

    private static async fetchSchedules(db: Database, loanId: string): Promise<PaymentSchedule[]> {
        return await db.get<PaymentSchedule>('payment_schedules').query(
            NOT_DELETED,
            Q.where('loan_id', loanId),
            Q.sortBy('due_date', Q.asc)
        ).fetch();
    }

    private static async createPaymentWithinTransaction(
        db: Database,
        params: PostPaymentParams,
        logParams: LogParams[]
    ): Promise<Payment> {
        const paymentDate = typeof params.paymentDate === 'number'
            ? params.paymentDate
            : params.paymentDate.getTime();
        const loan = await db.get<Loan>('loans').find(params.loanId);
        const schedules = await this.fetchSchedules(db, params.loanId);
        const firstOpenSchedule = schedules.find(schedule => schedule.status !== 'paid');

        const payment = await db.get<Payment>('payments').create(record => {
            record._raw.id = uuid.v4().toString();
            record.loanId = params.loanId;
            record.borrowerId = loan.borrowerId;
            record.scheduleId = firstOpenSchedule?.id || '';
            record.collectorId = loan.collectorId || params.collectorId || params.encodedBy || '';
            record.amount = params.amount;
            record.currentSalary = Number.isFinite(params.currentSalary as number) ? params.currentSalary as number : 0;
            record.excessCash = ExcessCashReceiptService.calculateExcessCash(record.currentSalary || 0, params.amount);
            record.paymentDate = paymentDate;
            record.paymentType = params.paymentType || 'cash';
            record.receiptNumber = params.receiptNumber ? String(params.receiptNumber).trim() : null;
            record.notes = params.notes ? String(params.notes).trim() : null;
            record.encodedAt = Date.now();
        });

        logParams.push({
            entityType: 'payments',
            entityId: payment.id,
            action: 'CREATE',
            performedBy: params.encodedBy || undefined,
            newData: {
                loanId: params.loanId,
                borrowerId: loan.borrowerId,
                amount: params.amount,
                currentSalary: payment.currentSalary,
                excessCash: payment.excessCash,
                paymentDate,
                paymentType: params.paymentType || 'cash',
                scheduleId: firstOpenSchedule?.id || '',
            },
        });

        await this.recomputeLoanAfterPayment(db, loan, {
            paymentId: payment.id,
            paymentDate,
            performedBy: params.encodedBy || undefined,
            logParams,
        });

        return payment;
    }
}
