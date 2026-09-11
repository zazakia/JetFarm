import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class StatutoryFundAllocation extends Model {
    static table = 'statutory_fund_allocations'

    @field('fiscal_year') fiscalYear!: number
    @field('fiscal_month') fiscalMonth!: number | null
    @field('fund_type') fundType!: string // reserve | education | union_federation | community_dev | optional | interest_on_capital | patronage_refund
    @field('amount') amount!: number
    @field('percentage') percentage!: number
    @field('notes') notes!: string | null
    @field('performed_by') performedBy!: string | null

    @readonly @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
