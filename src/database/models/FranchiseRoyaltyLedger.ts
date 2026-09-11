import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class FranchiseRoyaltyLedger extends Model {
    static table = 'franchise_royalty_ledger'

    @field('contract_id') contractId!: string | null
    @field('branch_id') branchId!: string
    @field('fiscal_year') fiscalYear!: number
    @field('fiscal_month') fiscalMonth!: number
    @field('gross_sales') grossSales!: number
    @field('cogs') cogs!: number
    @field('opex') opex!: number
    @field('net_income') netIncome!: number
    @field('royalty_pct') royaltyPct!: number
    @field('royalty_amount') royaltyAmount!: number
    @field('operator_share') operatorShare!: number
    /** pending | invoiced | paid | overdue | disputed */
    @field('settlement_status') settlementStatus!: string
    @date('settled_at') settledAt!: Date | null
    @field('settled_amount') settledAmount!: number | null
    @field('notes') notes!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
