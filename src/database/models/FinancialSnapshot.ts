import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class FinancialSnapshot extends Model {
    static table = 'financial_snapshots'

    @date('snapshot_date') snapshotDate: number;
    @field('total_assets') totalAssets: number;
    @field('total_equity') totalEquity: number;
    @field('total_liabilities') totalLiabilities: number;
    @field('loan_loss_reserve') loanLossReserve: number;
    @field('operating_revenue') operatingRevenue: number;
    @field('financial_costs') financialCosts: number;
    @field('subsidy_adjustment') subsidyAdjustment: number;
    @field('inflation_adjustment') inflationAdjustment: number;
    @field('risk_weighted_assets') riskWeightedAssets: number;
    @date('created_at') createdAt: number;
    @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
