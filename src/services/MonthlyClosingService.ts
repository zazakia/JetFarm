import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import ChartOfAccount from '../database/models/ChartOfAccount';
import FinancialSnapshot from '../database/models/FinancialSnapshot';
import { ConsolidationService } from './ConsolidationService';
import { startOfMonth, endOfMonth } from 'date-fns';
import { BaseModelService } from './BaseModelService';
import { ErrorService } from "./ErrorService";

/** Normal-balance classification of the general ledger as of one instant. */
interface LedgerTotals {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
}

export class MonthlyClosingService {
    /**
     * Aggregate asset / liability / equity balances from the chart of accounts,
     * absorbing the unclosed net surplus (income minus expense) into equity so the
     * snapshot balances the way the printed statement of financial condition does.
     */
    private static async totalsFrom(
        balances: Map<string, number>,
        accounts: ChartOfAccount[]
    ): Promise<LedgerTotals> {
        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;
        let unclosedNetSurplus = 0;

        for (const account of accounts) {
            const balance = balances.get(account.code) ?? 0;
            switch (account.accountType) {
                case 'asset':
                    totalAssets += balance;
                    break;
                case 'liability':
                    totalLiabilities += balance;
                    break;
                case 'equity':
                    totalEquity += balance;
                    break;
                case 'income':
                    unclosedNetSurplus += balance;
                    break;
                case 'expense':
                    unclosedNetSurplus -= balance;
                    break;
            }
        }

        return {
            totalAssets,
            totalLiabilities,
            totalEquity: totalEquity + unclosedNetSurplus,
        };
    }

    /**
     * Captures a financial snapshot for a specific month, sourced from the general
     * ledger rather than the retired lending KPI service. Revenue and cost are the
     * month's movement (closing minus opening); the balance sheet is as-of month end.
     * @param date Any date within the month to close.
     */
    static async closeMonth(date: Date): Promise<FinancialSnapshot | null> {
        try {
            const start = startOfMonth(date).getTime();
            const end = endOfMonth(date).getTime();

            // Read sequentially: the LokiJS adapter reuses one query cursor per collection, so
            // two concurrent getBalances() calls make the second return the first's result set and
            // the open-to-close movement collapses to zero.
            const closingBalances = await ConsolidationService.getBalances(new Date(end));
            const openingBalances = await ConsolidationService.getBalances(new Date(start - 1));

            const accounts = await database.collections
                .get<ChartOfAccount>('chart_of_accounts')
                .query(Q.where('deleted_at', Q.eq(null)))
                .fetch();

            const balanceSheet = await MonthlyClosingService.totalsFrom(closingBalances, accounts);

            let operatingRevenue = 0;
            let financialCosts = 0;
            for (const account of accounts) {
                const movement =
                    (closingBalances.get(account.code) ?? 0) - (openingBalances.get(account.code) ?? 0);
                if (account.accountType === 'income') operatingRevenue += movement;
                else if (account.accountType === 'expense') financialCosts += movement;
            }

            // Credit operations are retired on this branch: loan_loss_reserve stays a column and
            // is always 0, and there is no loan portfolio to risk-weight, so the snapshot records
            // total assets as the exposure base.
            return await BaseModelService.create<FinancialSnapshot>('financial_snapshots', snapshot => {
                snapshot.snapshotDate = end;
                snapshot.totalAssets = balanceSheet.totalAssets;
                snapshot.totalEquity = balanceSheet.totalEquity;
                snapshot.totalLiabilities = balanceSheet.totalLiabilities;
                snapshot.loanLossReserve = 0;
                snapshot.operatingRevenue = operatingRevenue;
                snapshot.financialCosts = financialCosts;
                snapshot.subsidyAdjustment = 0;
                snapshot.inflationAdjustment = 0;
                snapshot.riskWeightedAssets = balanceSheet.totalAssets;
            });

        } catch (error) {
            ErrorService.handleError(error, '[MonthlyClosingService] Failed to close month:');
            return null;
        }
    }

    /**
     * Checks if a month has already been closed.
     * Uses a filtered query instead of loading all snapshots into memory.
     */
    static async isMonthClosed(date: Date): Promise<boolean> {
        const end = endOfMonth(date).getTime();
        const count = await database.collections.get<FinancialSnapshot>('financial_snapshots')
            .query(
                Q.where('snapshot_date', end),
                Q.where('deleted_at', null)
            )
            .fetchCount();

        return count > 0;
    }

    /**
     * Gets the history of all closed months (excluding deleted).
     */
    static async getClosingHistory(): Promise<FinancialSnapshot[]> {
        return await database.collections.get<FinancialSnapshot>('financial_snapshots')
            .query(Q.where('deleted_at', null))
            .fetch();
    }
}
