import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export default class RoyaltyCalculation extends Model {
    static table = 'royalty_calculations';

    @field('branch_id') branchId!: string;
    @field('period_year') periodYear!: number;
    @field('period_month') periodMonth!: number;
    @field('gross_sales') grossSales!: number;
    @field('cogs') cogs!: number;
    @field('cogs_ratio') cogsRatio!: number;
    @field('gross_profit') grossProfit!: number;
    @field('opex') opex!: number;
    @field('net_income') netIncome!: number;
    @field('net_margin') netMargin!: number;
    /** 80% Operator Share */
    @field('operator_share') operatorShare!: number;
    /** 20% Franchisor Share */
    @field('franchisor_share') franchisorShare!: number;
    /** draft | computed | approved | settled */
    @field('status') status!: string;
    @field('approved_by') approvedBy!: string | null;
    @date('approved_at') approvedAt!: Date | null;
    @field('ap_voucher_id') apVoucherId!: string | null;
    @field('notes') notes!: string | null;

    @date('created_at') createdAt!: Date;
    @date('updated_at') updatedAt!: Date;
    @date('deleted_at') deletedAt!: Date | null;
}
