import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class JournalEntry extends Model {
    static table = 'journal_entries'

    @date('entry_date') entryDate!: Date
    @field('reference_number') referenceNumber!: string
    @field('description') description!: string
    /** auto | manual | adjusting | closing | reversing */
    @field('entry_type') entryType!: string
    @field('source_table') sourceTable!: string | null
    @field('source_id') sourceId!: string | null
    @field('posted_by') postedBy!: string | null
    @field('is_posted') isPosted!: boolean
    @field('total_debit') totalDebit!: number
    @field('total_credit') totalCredit!: number
    @field('fiscal_year') fiscalYear!: number | null
    @field('fiscal_month') fiscalMonth!: number | null

    @readonly @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
