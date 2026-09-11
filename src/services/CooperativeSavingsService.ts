import { database } from '../database';
import SavingsTransaction from '../database/models/SavingsTransaction';
import { Q } from '@nozbe/watermelondb';
import { getDaysInMonth, endOfMonth, startOfMonth, format, isBefore, isEqual, differenceInDays } from 'date-fns';
import { SettingsService } from './SettingsService';

import ActionLogService from './ActionLogService';

export class CooperativeSavingsService {
    static readonly INTEREST_RATE_PER_ANNUM = 0.06;
    static readonly MIN_MAINTAINING_BALANCE = 100;
    static readonly CUT_OFF_DAY = 10;

    static async getInterestRate(): Promise<number> {
        return SettingsService.getNumberSetting('savings.interest_rate', 0.06);
    }

    static async getMinMaintainingBalance(): Promise<number> {
        return SettingsService.getNumberSetting('savings.min_maintaining_balance', 100);
    }

    /**
     * Get all transactions for a borrower, sorted by date
     */
    static async getTransactions(borrowerId: string): Promise<SavingsTransaction[]> {
        return database.get<SavingsTransaction>('savings_transactions').query(
            Q.where('borrower_id', borrowerId),
            Q.where('deleted_at', null),
            Q.sortBy('date', Q.asc)
        ).fetch();
    }

    static isSavingsIncrease(type: string): boolean {
        return !['WITHDRAWAL', 'WITHDRAW', 'WITHDRAW_CASH', 'WITHDRAW_LOAN', 'REDEMPTION', 'REVERSAL'].includes((type || '').toUpperCase());
    }

    /**
     * Calculate running balance as of a specific date
     */
    static async getBalanceAsOf(borrowerId: string, asOfDate: Date): Promise<number> {
        const transactions = await this.getTransactions(borrowerId);
        return transactions.reduce((sum, t) => {
            if (t.date > asOfDate.getTime()) return sum;
            return this.isSavingsIncrease(t.type) ? sum + t.amount : sum - t.amount;
        }, 0);
    }

    /**
     * Calculates the Average Daily Balance (ADB) for a specific month
     * ADB = sum(daily balance) / days_in_month
     */
    static async calculateAverageMonthlyBalance(borrowerId: string, year: number, month: number): Promise<number> {
        // month is 0-indexed in JS (0=Jan, 11=Dec)
        const firstDay = new Date(year, month, 1);
        const daysInMonth = getDaysInMonth(firstDay);
        
        let sumDailyBalances = 0;
        let currentBalance = await this.getBalanceAsOf(borrowerId, new Date(firstDay.getTime() - 86400000)); // Balance before 1st day

        const transactions = await this.getTransactions(borrowerId);
        // Filter transactions for this month
        const monthTx = transactions.filter(t => {
            const txDate = new Date(t.date);
            return txDate.getFullYear() === year && txDate.getMonth() === month;
        });

        // Calculate daily balance
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDayStart = new Date(year, month, day, 0, 0, 0);
            const currentDayEnd = new Date(year, month, day, 23, 59, 59);

            // Apply transactions for the day
            const dailyTx = monthTx.filter(t => t.date >= currentDayStart.getTime() && t.date <= currentDayEnd.getTime());
            for (const t of dailyTx) {
                if (this.isSavingsIncrease(t.type)) {
                    currentBalance += t.amount;
                } else {
                    currentBalance -= t.amount;
                }
            }

            sumDailyBalances += currentBalance;
        }

        return sumDailyBalances / daysInMonth;
    }

    /**
     * Calculates quarterly interest based on the AMB of the 3 months in the quarter
     * Quarter: 1 (Jan-Mar), 2 (Apr-Jun), 3 (Jul-Sep), 4 (Oct-Dec)
     */
    static async calculateQuarterlyInterest(borrowerId: string, year: number, quarter: number): Promise<number> {
        const startMonth = (quarter - 1) * 3; // 0, 3, 6, 9
        
        let totalAmb = 0;
        for (let i = 0; i < 3; i++) {
            totalAmb += await this.calculateAverageMonthlyBalance(borrowerId, year, startMonth + i);
        }

        const averageQuarterlyAmb = totalAmb / 3;

        const minMaintainingBalance = await this.getMinMaintainingBalance();
        const interestRatePerAnnum = await this.getInterestRate();

        // Interest only applies if AMB >= Min Maintaining Balance
        if (averageQuarterlyAmb < minMaintainingBalance) {
            return 0;
        }

        const quarterlyInterest = averageQuarterlyAmb * (interestRatePerAnnum / 4);
        return Math.round(quarterlyInterest * 100) / 100;
    }

    /**
     * Update an existing savings transaction
     */
    static async updateTransaction(
        transactionId: string,
        params: {
            amount?: number;
            type?: string;
            date?: number;
            notes?: string | null;
        },
        performedBy?: string
    ): Promise<SavingsTransaction> {
        const tx = await database.get<SavingsTransaction>('savings_transactions').find(transactionId);
        const oldData = { ...tx._raw };

        await database.write(async () => {
            await tx.update((record: SavingsTransaction) => {
                if (params.amount !== undefined) record.amount = params.amount;
                if (params.type !== undefined) record.type = params.type;
                if (params.date !== undefined) record.date = params.date;
                if (params.notes !== undefined) record.notes = params.notes;
            });
        });

        await ActionLogService.logAction({
            entityType: 'savings_transactions',
            entityId: tx.id,
            action: 'UPDATE',
            oldData,
            newData: tx._raw,
            performedBy,
        });

        return tx;
    }

    /**
     * Soft delete a savings transaction
     */
    static async deleteTransaction(transactionId: string, performedBy?: string): Promise<void> {
        const tx = await database.get<SavingsTransaction>('savings_transactions').find(transactionId);
        const oldData = { ...tx._raw };

        await database.write(async () => {
            await tx.update((record: SavingsTransaction) => {
                record.deletedAt = Date.now();
            });
        });

        await ActionLogService.logAction({
            entityType: 'savings_transactions',
            entityId: tx.id,
            action: 'DELETE',
            oldData,
            performedBy,
        });
    }
}
