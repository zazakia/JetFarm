import { database } from '../database';
import FinancialSnapshot from '../database/models/FinancialSnapshot';
import { MfiKpiService } from './MfiKpiService';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Q } from '@nozbe/watermelondb';
import { BaseModelService } from './BaseModelService';
import { ErrorService } from "./ErrorService";

export class MonthlyClosingService {
    /**
     * Captures a financial snapshot for a specific month.
     * @param date Any date within the month to close.
     */
    static async closeMonth(date: Date): Promise<FinancialSnapshot | null> {
        try {
            const start = startOfMonth(date).getTime();
            const end = endOfMonth(date).getTime();

            // 1. Get Balance Sheet Data (as of end of month)
            const balanceSheet = await MfiKpiService.getBalanceSheet();
            
            // 2. Get Income Statement Data (for the month)
            const incomeStatement = await MfiKpiService.getIncomeStatement(start, end);

            // 3. Get Advanced KPIs for risk weighting
            const advancedKpis = await MfiKpiService.getAdvancedKpis();

            // 4. Create the Snapshot
            return await BaseModelService.create<FinancialSnapshot>('financial_snapshots', snapshot => {
                snapshot.snapshotDate = end;
                snapshot.totalAssets = balanceSheet.assets.totalAssets;
                snapshot.totalEquity = balanceSheet.equity.totalEquity;
                snapshot.totalLiabilities = balanceSheet.liabilities.totalLiabilities;
                snapshot.loanLossReserve = incomeStatement.loanLossProvisions;
                snapshot.operatingRevenue = incomeStatement.operatingRevenue;
                snapshot.financialCosts = incomeStatement.financialCosts;
                
                // These might be calculated or manually entered in a full ERP, 
                // but for our MVP we use 0 or derived estimates.
                snapshot.subsidyAdjustment = 0;
                snapshot.inflationAdjustment = 0;
                snapshot.riskWeightedAssets = balanceSheet.assets.loanPortfolio * 1.2; // Example risk weight
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
