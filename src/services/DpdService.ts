import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import Loan from '../database/models/Loan';
import PaymentSchedule from '../database/models/PaymentSchedule';
import { ErrorService, ErrorType } from './ErrorService';

export class DpdService {
    /**
     * Re-calculates DPD (Days Past Due) and updates the aging bucket for a given loan.
     */
    async calculateAndSyncDpd(loanId: string): Promise<Loan> {
        return await database.write(async () => {
            try {
                const loan = await database.get<Loan>('loans').find(loanId);
                const schedules = await database.get<PaymentSchedule>('payment_schedules')
                    .query(
                        Q.where('loan_id', loanId),
                        Q.where('status', Q.notEq('paid')),
                        Q.sortBy('due_date', Q.asc)
                    )
                    .fetch();

                if (schedules.length === 0) {
                    // Loan is fully paid or has no active schedules
                    await loan.update((record: any) => {
                        record.dpd = 0;
                        record.agingBucket = 'CURRENT';
                        record.isDelinquent = false;
                        record.delinquentSince = null;
                    });
                    return loan;
                }

                // Find the earliest unpaid schedule that is past due
                const today = new Date().getTime();
                const earliestUnpaid = schedules[0];
                const dueDate = typeof earliestUnpaid.dueDate === 'number' 
                    ? earliestUnpaid.dueDate 
                    : new Date(earliestUnpaid.dueDate).getTime();

                let dpd = 0;
                if (today > dueDate) {
                    const diffTime = Math.abs(today - dueDate);
                    dpd = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                }

                const agingBucket = this.determineAgingBucket(dpd);

                await loan.update((record: any) => {
                    record.dpd = dpd;
                    record.agingBucket = agingBucket;
                    record.isDelinquent = dpd > 0;
                    if (dpd > 0 && !record.delinquentSince) {
                        record.delinquentSince = dueDate;
                    } else if (dpd === 0) {
                        record.delinquentSince = null;
                    }
                });

                return loan;
            } catch (error) {
                throw ErrorService.handleError(error, 'DpdService.calculateAndSyncDpd', ErrorType.DATABASE);
            }
        });
    }

    /**
     * Determines the aging bucket based on DPD
     */
    private determineAgingBucket(dpd: number): string {
        if (dpd === 0) return 'CURRENT';
        if (dpd >= 1 && dpd <= 30) return '1-30 Days';
        if (dpd >= 31 && dpd <= 60) return '31-60 Days';
        if (dpd >= 61 && dpd <= 90) return '61-90 Days';
        return 'Over 90 Days';
    }

    /**
     * Batch process to update DPD for all active loans
     * Useful for an overnight cron job or manual trigger
     */
    async batchUpdateAllActiveLoansDpd(): Promise<void> {
        try {
            const activeLoans = await database.get<Loan>('loans')
                .query(
                    Q.where('status', 'active'),
                    Q.where('deleted_at', null)
                )
                .fetch();

            for (const loan of activeLoans) {
                await this.calculateAndSyncDpd(loan.id);
            }
        } catch (error) {
            throw ErrorService.handleError(error, 'DpdService.batchUpdateAllActiveLoansDpd', ErrorType.DATABASE);
        }
    }
}

export const dpdService = new DpdService();
