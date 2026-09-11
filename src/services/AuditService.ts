import { database as globalDatabase } from '../database';
import { Database, Q } from '@nozbe/watermelondb';
import Loan from '../database/models/Loan';
import Borrower from '../database/models/Borrower';
import Payment from '../database/models/Payment';
import PaymentSchedule from '../database/models/PaymentSchedule';
import Collector from '../database/models/Collector';
import LoanPenalty from '../database/models/LoanPenalty';
import ActionLogService from './ActionLogService';
import { LoanCalculatorService, LoanCalcResult } from './LoanCalculatorService';
import { findActiveLoanForType } from '../utils/activeLoanPolicy';
import { loanProductLabel } from '../utils/loanProducts';
import { ErrorService } from "./ErrorService";

export type AuditCategory = 'Critical' | 'Warning' | 'Info';
export type AuditEntityType = 'Loan' | 'Borrower' | 'Collector' | 'Payment' | 'Schedule';

export interface AuditIssue {
    id: string;
    category: AuditCategory;
    entityType: AuditEntityType;
    entityId: string;
    entityName?: string;
    message: string;
    suggestedFix?: string;
}

export interface AuditReport {
    timestamp: number;
    totalIssues: number;
    issues: AuditIssue[];
}

export class AuditService {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    async runFullAudit(): Promise<AuditReport> {
        let issues: AuditIssue[] = [];

        await Promise.all([
            this.auditLoans(issues),
            this.auditBorrowers(issues),
            this.auditPayments(issues),
            this.auditSchedules(issues),
            this.auditCollectors(issues),
        ]);

        const reconIssues = await this.auditReconciliation();
        issues = issues.concat(reconIssues);

        return {
            timestamp: Date.now(),
            totalIssues: issues.length,
            issues: issues.sort((a, b) => {
                const priority = { Critical: 0, Warning: 1, Info: 2 };
                return priority[a.category] - priority[b.category];
            }),
        };
    }

    async validateLoanPreSave(data: any, calcResult: LoanCalcResult, isEditing: boolean = false): Promise<AuditIssue[]> {
        const issues: AuditIssue[] = [];
        const TOLERANCE = 1.0; // 1 Peso tolerance for rounding
        
        const principal = parseFloat(data.principal);
        const interestRate = parseFloat(data.ratePercent);
        const deposit = parseFloat(data.deposit) || 0;
        const insurance = parseFloat(data.insurance) || 0;
        const totalFees = deposit + insurance;
        const releaseDate = new Date(data.releaseDate).getTime();
        const now = Date.now();

        // 1. Computation Checks
        const expectedTotal = principal + calcResult.totalInterest + calcResult.totalFees;
        if (Math.abs(calcResult.totalAmount - expectedTotal) > TOLERANCE) {
            issues.push({
                id: 'pre_save_calc_mismatch',
                category: 'Critical',
                entityType: 'Loan',
                entityId: 'new',
                message: `Total amount (PHP ${calcResult.totalAmount.toFixed(2)}) doesn't match sum of Principal + Interest + Fees (PHP ${expectedTotal.toFixed(2)}).`,
                suggestedFix: 'Recalculate or check interest settings.'
            });
        }

        const scheduleTotal = calcResult.schedule.reduce((sum, row) => sum + row.scheduledAmount, 0);
        if (Math.abs(scheduleTotal - calcResult.totalAmount) > TOLERANCE) {
            issues.push({
                id: 'pre_save_schedule_sum_mismatch',
                category: 'Critical',
                entityType: 'Loan',
                entityId: 'new',
                message: `Sum of installments (PHP ${scheduleTotal.toFixed(2)}) doesn't match loan total (PHP ${calcResult.totalAmount.toFixed(2)}).`,
                suggestedFix: 'This is a system calculation error. Try changing the term or frequency slightly.'
            });
        }

        // 2. Policy Checks
        if (!isEditing && data.borrowerId) {
            const activeLoans = await this.db.get<Loan>('loans').query(
                Q.where('borrower_id', data.borrowerId),
                Q.where('status', 'active'),
                Q.where('deleted_at', Q.eq(null))
            ).fetch();

            const sameTypeActiveLoan = findActiveLoanForType(activeLoans, data.loanType);
            const renewsSameTypeActiveLoan = data.isReloan && data.previousLoanId === sameTypeActiveLoan?.id;

            if (sameTypeActiveLoan && !renewsSameTypeActiveLoan) {
                issues.push({
                    id: 'pre_save_active_loan',
                    category: 'Warning',
                    entityType: 'Loan',
                    entityId: 'new',
                    message: `Borrower already has an active ${loanProductLabel(data.loanType)} (${sameTypeActiveLoan.loanNumber}). Only one active loan is allowed per loan type.`,
                    suggestedFix: `Use Renewal for the existing ${loanProductLabel(data.loanType)}, or choose a different loan type.`
                });
            }
        }

        if (data.isReloan) {
            const deductedAmount = parseFloat(data.deductedAmount) || 0;
            const netProceeds = principal - deductedAmount;
            if (netProceeds <= 0) {
                issues.push({
                    id: 'pre_save_negative_net',
                    category: 'Critical',
                    entityType: 'Loan',
                    entityId: 'new',
                    message: `Renewal results in negative or zero net release (PHP ${netProceeds.toFixed(2)}). Principal must be higher than the previous balance.`,
                    suggestedFix: 'Increase the principal amount.'
                });
            }
        }

        // 3. Heuristic / Sanity Checks
        if (interestRate > 50) {
            issues.push({
                id: 'pre_save_high_rate',
                category: 'Warning',
                entityType: 'Loan',
                entityId: 'new',
                message: `Interest rate (${interestRate}%) seems unusually high.`,
            });
        }

        const sixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000);
        if (releaseDate < sixtyDaysAgo) {
            issues.push({
                id: 'pre_save_backdated',
                category: 'Warning',
                entityType: 'Loan',
                entityId: 'new',
                message: `Loan release date is backdated by more than 2 months (${new Date(releaseDate).toLocaleDateString()}).`,
            });
        }

        const fourYearsFuture = now + (4 * 365 * 24 * 60 * 60 * 1000);
        if (calcResult.maturityDate.getTime() > fourYearsFuture) {
            issues.push({
                id: 'pre_save_far_future',
                category: 'Warning',
                entityType: 'Loan',
                entityId: 'new',
                message: `Loan maturity date is very far in the future (${calcResult.maturityDate.toLocaleDateString()}).`,
            });
        }

        return issues;
    }

    async recalculateLoanTotals(loanId: string): Promise<{ success: boolean; message: string }> {
        try {
            const result = await this.db.write(async () => {
                const loan = await this.db.get<Loan>('loans').find(loanId);
                const oldStatus = loan.status;
                const payments = await this.db.get<Payment>('payments').query(Q.where('deleted_at', null), 
                    Q.where('loan_id', loanId),
                    Q.where('deleted_at', Q.eq(null))
                ).fetch();
                const penalties = await this.db.get<LoanPenalty>('loan_penalties').query(Q.where('deleted_at', null), 
                    Q.where('loan_id', loanId),
                    Q.where('deleted_at', Q.eq(null))
                ).fetch();

                const totalPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
                const totalPenalties = penalties.reduce((sum, p) => sum + (p.amount || 0), 0);
                
                const totalExpected = (loan.totalAmount || 0) + totalPenalties;
                const remaining = totalExpected - totalPayments;

                // Check for status update
                let newStatus = loan.status;
                if (remaining <= 1 && loan.status === 'active') {
                    newStatus = 'paid';
                } else if (remaining > 1 && loan.status === 'paid') {
                    // Only revert if we are sure it shouldn't be paid (e.g. not renewed)
                    const isRenewed = await this.db.get<Loan>('loans').query(Q.where('deleted_at', null), 
                        Q.where('previous_loan_id', loan.id),
                        Q.where('is_reloan', true)
                    ).fetch();
                    
                    if (isRenewed.length === 0) {
                        newStatus = 'active';
                    }
                }

                await loan.update(l => {
                    l.status = newStatus;
                });

                return { 
                    success: true, 
                    loanNumber: loan.loanNumber, 
                    oldStatus, 
                    newStatus 
                };
            });

            // Log the action to the Audit Trail
            await ActionLogService.logAction({
                entityType: 'Loan',
                entityId: loanId,
                action: 'UPDATE',
                oldData: { status: result.oldStatus },
                newData: { 
                    status: result.newStatus, 
                    note: 'System-triggered recomputation via Audit' 
                }
            });

            return { success: true, message: `Loan ${result.loanNumber} totals recalculated and status updated to ${result.newStatus}.` };
        } catch (error) {
            ErrorService.handleError(error, `Failed to recalculate loan ${loanId}:`);
            return { success: false, message: `Error: ${error instanceof Error ? ErrorService.getUserMessage(error) : String(error)}` };
        }
    }

    private async auditLoans(issues: AuditIssue[]) {
        const loans = await this.db.get<Loan>('loans').query(Q.where('deleted_at', null)).fetch();
        const borrowers = await this.db.get<Borrower>('borrowers').query(Q.where('deleted_at', null)).fetch();
        const borrowerIds = new Set(borrowers.map(b => b.id));

        const now = Date.now();
        const futureThreshold = now + (365 * 24 * 60 * 60 * 1000); // 1 year future

        for (const loan of loans) {
            const releaseDate = loan.releaseDate 
                ? (typeof loan.releaseDate === 'object' ? (loan.releaseDate as Date).getTime() : (loan.releaseDate as number))
                : 0;
            const maturityDate = loan.maturityDate
                ? (typeof loan.maturityDate === 'object' ? (loan.maturityDate as Date).getTime() : (loan.maturityDate as number))
                : 0;

            if (releaseDate && maturityDate && maturityDate < releaseDate) {
                issues.push({
                    id: `loan_invalid_dates_${loan.id}`,
                    category: 'Critical',
                    entityType: 'Loan',
                    entityId: loan.id,
                    entityName: loan.loanNumber,
                    message: `Maturity date is earlier than release date.`,
                    suggestedFix: 'Correct the loan dates.'
                });
            }

            if (!loan.releaseDate) {
                issues.push({
                    id: `loan_missing_date_${loan.id}`,
                    category: 'Warning',
                    entityType: 'Loan',
                    entityId: loan.id,
                    entityName: loan.loanNumber,
                    message: `Loan has no release date specified.`,
                });
            }

            // 1. Orphan check
            if (!borrowerIds.has(loan.borrowerId)) {
                issues.push({
                    id: `loan_orphan_${loan.id}`,
                    category: 'Critical',
                    entityType: 'Loan',
                    entityId: loan.id,
                    entityName: loan.loanNumber,
                    message: `Loan references non-existent borrower ID: ${loan.borrowerId}`,
                    suggestedFix: 'Re-assign to a valid borrower.'
                });
            }

            // 2. Financial check
            if (loan.totalAmount <= 0) {
                issues.push({
                    id: `loan_zero_amount_${loan.id}`,
                    category: 'Warning',
                    entityType: 'Loan',
                    entityId: loan.id,
                    entityName: loan.loanNumber,
                    message: `Loan has total amount <= 0.`,
                });
            }

            // 3. Date check
            if (releaseDate > futureThreshold) {
                issues.push({
                    id: `loan_future_date_${loan.id}`,
                    category: 'Warning',
                    entityType: 'Loan',
                    entityId: loan.id,
                    entityName: loan.loanNumber,
                    message: `Loan release date is in the far future: ${new Date(releaseDate).toLocaleDateString()}`,
                });
            }
        }
    }

    private async auditBorrowers(issues: AuditIssue[]) {
        const borrowers = await this.db.get<Borrower>('borrowers').query(Q.where('deleted_at', null)).fetch();

        for (const borrower of borrowers) {
            if (!borrower.fullName || borrower.fullName.toLowerCase().includes('undefined')) {
                issues.push({
                    id: `borrower_name_invalid_${borrower.id}`,
                    category: 'Critical',
                    entityType: 'Borrower',
                    entityId: borrower.id,
                    entityName: borrower.fullName || 'UNKNOWN',
                    message: `Borrower name is invalid or 'undefined'.`,
                    suggestedFix: 'Rename the borrower accurately.'
                });
            }
        }
    }

    private async auditPayments(issues: AuditIssue[]) {
        const payments = await this.db.get<Payment>('payments').query(Q.where('deleted_at', null)).fetch();
        const loans = await this.db.get<Loan>('loans').query(Q.where('deleted_at', null)).fetch();
        const loanIds = new Set(loans.map(l => l.id));

        const now = Date.now();

        for (const payment of payments) {
            if (!loanIds.has(payment.loanId)) {
                issues.push({
                    id: `payment_orphan_${payment.id}`,
                    category: 'Critical',
                    entityType: 'Payment',
                    entityId: payment.id,
                    message: `Payment references non-existent loan ID: ${payment.loanId}`,
                    suggestedFix: 'Verify and delete if orphaned.'
                });
            }

            if (payment.amount <= 0) {
                issues.push({
                    id: `payment_invalid_amount_${payment.id}`,
                    category: 'Critical',
                    entityType: 'Payment',
                    entityId: payment.id,
                    message: `Payment amount is zero or negative: PHP ${payment.amount}`,
                    suggestedFix: 'Delete or correct invalid payment.'
                });
            }

            const paymentDate = payment.paymentDate 
                ? (typeof payment.paymentDate === 'object' ? (payment.paymentDate as Date).getTime() : (payment.paymentDate as number))
                : 0;

            if (paymentDate > now) {
                issues.push({
                    id: `payment_future_date_${payment.id}`,
                    category: 'Warning',
                    entityType: 'Payment',
                    entityId: payment.id,
                    message: `Payment date is in the future: ${new Date(paymentDate).toLocaleDateString()}`,
                    suggestedFix: 'Verify the date of payment.'
                });
            }
        }
    }

    private async auditSchedules(issues: AuditIssue[]) {
        const schedules = await this.db.get<PaymentSchedule>('payment_schedules').query(Q.where('deleted_at', null)).fetch();
        const loans = await this.db.get<Loan>('loans').query(Q.where('deleted_at', null)).fetch();
        const loanIds = new Set(loans.map(l => l.id));

        for (const schedule of schedules) {
            if (!loanIds.has(schedule.loanId)) {
                issues.push({
                    id: `schedule_orphan_${schedule.id}`,
                    category: 'Warning',
                    entityType: 'Schedule',
                    entityId: schedule.id,
                    message: `Schedule references non-existent loan ID: ${schedule.loanId}`,
                });
            }
        }
    }

    private async auditCollectors(issues: AuditIssue[]) {
        const collectors = await this.db.get<Collector>('collectors').query(Q.where('deleted_at', null)).fetch();
        const loans = await this.db.get<Loan>('loans').query(Q.where('deleted_at', null)).fetch();
        
        for (const loan of loans) {
            if (loan.collectorId && !collectors.find(c => c.id === loan.collectorId)) {
                issues.push({
                    id: `loan_collector_missing_${loan.id}`,
                    category: 'Warning',
                    entityType: 'Loan',
                    entityId: loan.id,
                    entityName: loan.loanNumber,
                    message: `Loan assigned to unknown collector ID: ${loan.collectorId}`,
                });
            }
        }
    }

    async auditReconciliation(): Promise<AuditIssue[]> {
        const issues: AuditIssue[] = [];
        const loans = await this.db.get<Loan>('loans').query(Q.where('deleted_at', null)).fetch();
        const payments = await this.db.get<Payment>('payments').query(Q.where('deleted_at', null)).fetch();
        const schedules = await this.db.get<PaymentSchedule>('payment_schedules').query(Q.where('deleted_at', null)).fetch();
        const penalties = await this.db.get<LoanPenalty>('loan_penalties').query(Q.where('deleted_at', null)).fetch();

        for (const loan of loans) {
            const loanPayments = payments.filter(p => p.loanId === loan.id);
            const totalPaid = loanPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            
            const loanSchedules = schedules.filter(s => s.loanId === loan.id);
            const scheduledTotal = loanSchedules.reduce((sum, s) => sum + (s.scheduledAmount || 0), 0);
            
            const loanPenalties = penalties.filter(p => p.loanId === loan.id);
            const penaltyTotal = loanPenalties.reduce((sum, p) => sum + (p.amount || 0), 0);
            
            // Check if this loan was renewed (Implicit Forgiveness of remaining balance)
            const wasRenewed = loans.some(l => l.isReloan && l.previousLoanId === loan.id);
            
            const totalExpected = (loan.totalAmount || 0) + penaltyTotal;

            if (loanSchedules.length === 0 && (loan.status === 'active' || loan.status === 'paid')) {
                issues.push({
                    id: `recon_no_schedules_${loan.id}`,
                    category: 'Warning',
                    entityType: 'Loan',
                    entityId: loan.id,
                    entityName: loan.loanNumber,
                    message: `Loan is active/paid but has no payment schedules generated.`,
                });
            }

            // Check scheduled vs total
            if (Math.abs(scheduledTotal - (loan.totalAmount || 0)) > 1) {
                issues.push({
                    id: `recon_schedule_mismatch_${loan.id}`,
                    category: 'Warning',
                    entityType: 'Loan',
                    entityId: loan.id,
                    entityName: loan.loanNumber,
                    message: `Scheduled amount (PHP ${scheduledTotal}) mismatch with Loan Total (PHP ${loan.totalAmount}).`,
                });
            }

            // Term vs Schedule Count Check
            if (loanSchedules.length > 0 && loan.term && loan.termUnit && loan.frequency) {
                const expectedPaymentCount = LoanCalculatorService.paymentsForFrequency(
                    loan.term,
                    loan.termUnit,
                    loan.frequency
                );
                if (loanSchedules.length !== expectedPaymentCount) {
                    issues.push({
                        id: `recon_term_mismatch_${loan.id}`,
                        category: 'Warning',
                        entityType: 'Loan',
                        entityId: loan.id,
                        entityName: loan.loanNumber,
                        message: `Generated schedules (${loanSchedules.length}) do not match expected payment count (${expectedPaymentCount}) for ${loan.term} ${loan.termUnit} at ${loan.frequency} frequency.`,
                    });
                }
            }

            // Status check
            const remaining = totalExpected - totalPaid;
            
            if (wasRenewed) {
                // Implicit Forgiveness: If it was renewed, we expect it to be paid.
                if (loan.status !== 'paid') {
                    issues.push({
                        id: `recon_renewed_not_paid_${loan.id}`,
                        category: 'Warning',
                        entityType: 'Loan',
                        entityId: loan.id,
                        entityName: loan.loanNumber,
                        message: `Loan was renewed into a new loan but status is '${loan.status}' instead of 'paid'.`,
                        suggestedFix: "Change status to 'paid'."
                    });
                }
            } else {
                if (remaining <= 0 && loan.status === 'active') {
                    issues.push({
                        id: `recon_status_active_but_paid_${loan.id}`,
                        category: 'Info',
                        entityType: 'Loan',
                        entityId: loan.id,
                        entityName: loan.loanNumber,
                        message: `Loan is fully paid but status is 'active'.`,
                        suggestedFix: "Change status to 'paid'."
                    });
                } else if (remaining > 1 && loan.status === 'paid') {
                    issues.push({
                        id: `recon_status_paid_but_active_${loan.id}`,
                        category: 'Critical',
                        entityType: 'Loan',
                        entityId: loan.id,
                        entityName: loan.loanNumber,
                        message: `Loan is marked 'paid' but has a remaining balance of PHP ${remaining.toFixed(2)}.`,
                        suggestedFix: "Revert status to 'active' or verify missing payments."
                    });
                }
            }

            // Overpayment check
            if (totalPaid > totalExpected + 1) {
                issues.push({
                    id: `recon_overpayment_${loan.id}`,
                    category: 'Warning',
                    entityType: 'Loan',
                    entityId: loan.id,
                    entityName: loan.loanNumber,
                    message: `Overpayment detected. Total paid (PHP ${totalPaid.toFixed(2)}) exceeds Total + Penalties (PHP ${totalExpected.toFixed(2)}).`,
                });
            }

            // Partial / Schedule Status check 
            if (loanSchedules.length > 0 && totalPaid >= 0 && !wasRenewed) {
                let cumulativePaid = totalPaid;
                const sortedSchedules = [...loanSchedules].sort((a, b) => {
                    const dateA = typeof a.dueDate === 'object' ? (a.dueDate as Date).getTime() : (a.dueDate as number);
                    const dateB = typeof b.dueDate === 'object' ? (b.dueDate as Date).getTime() : (b.dueDate as number);
                    return dateA - dateB;
                });

                let hasScheduleStatusMismatch = false;
                for (const sched of sortedSchedules) {
                    const amount = sched.scheduledAmount || 0;
                    if (cumulativePaid >= amount) {
                        cumulativePaid -= amount;
                        if (sched.status !== 'paid') hasScheduleStatusMismatch = true;
                    } else if (cumulativePaid > 1) { // partial with at least 1 peso
                        cumulativePaid = 0;
                        if (sched.status !== 'partial') hasScheduleStatusMismatch = true;
                    } else {
                        // cumulativePaid is exhausted
                        if (sched.status !== 'pending' && sched.status !== 'late') hasScheduleStatusMismatch = true;
                    }
                }

                if (hasScheduleStatusMismatch) {
                    issues.push({
                        id: `recon_schedule_status_mismatch_${loan.id}`,
                        category: 'Info',
                        entityType: 'Loan',
                        entityId: loan.id,
                        entityName: loan.loanNumber,
                        message: `Amortization schedule statuses do not accurately mirror the physical cash payments (PHP ${totalPaid.toFixed(2)}).`,
                        suggestedFix: 'Run a recalculation or visualization of the amortization table.'
                    });
                }
            }
        }

        // 3. Report Audit: Financial Snapshots
        try {
            const snapshots = await this.db.collections.get('financial_snapshots').query(Q.where('deleted_at', null)).fetch();
            if (snapshots.length === 0) {
                issues.push({
                    id: 'report_no_snapshots',
                    category: 'Warning',
                    entityType: 'Loan', // Using Loan as proxy for general reports
                    entityId: 'system',
                    message: 'No financial snapshots found. KPI history might be missing.',
                    suggestedFix: 'Run an end-of-day or end-of-month snapshot.'
                });
            } else {
                // Check for outliers in snapshots (e.g. negative assets)
                for (const snap of snapshots as any[]) {
                    if (snap.totalAssets < 0) {
                        issues.push({
                            id: `report_neg_assets_${snap.id}`,
                            category: 'Critical',
                            entityType: 'Loan',
                            entityId: snap.id,
                            message: `Financial snapshot has negative total assets: ${snap.totalAssets}`,
                        });
                    }
                }
            }
        } catch (e) {
            ErrorService.handleError(e, 'Snapshot audit failed:');
        }

        return issues;
    }
}

export default new AuditService(globalDatabase);
