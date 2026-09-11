import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class JournalEntryLine extends Model {
    static table = 'journal_entry_lines'

    @field('journal_entry_id') journalEntryId!: string
    @field('account_code') accountCode!: string
    @field('account_name') accountName!: string | null
    @field('debit_amount') debitAmount!: number
    @field('credit_amount') creditAmount!: number
    @field('description') description!: string | null
    @field('business_unit_id') businessUnitId!: string | null
    @field('module_source_table') moduleSourceTable!: string | null
    @field('module_source_id') moduleSourceId!: string | null

    @readonly @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
