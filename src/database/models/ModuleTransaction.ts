import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class ModuleTransaction extends Model {
    static table = 'module_transactions'

    @field('module_id') moduleId!: string
    @field('business_unit_id') businessUnitId!: string
    @field('source_table') sourceTable!: string
    @field('source_id') sourceId!: string
    @field('amount') amount!: number
    @field('transaction_type') transactionType!: string // e.g. 'sale', 'payment', 'expense'
    @field('posted_at') postedAt!: number
    @field('fiscal_year') fiscalYear!: number | null
    @field('fiscal_month') fiscalMonth!: number | null

    @readonly @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
