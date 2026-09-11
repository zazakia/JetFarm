import { Model } from '@nozbe/watermelondb'
import { field, date, children } from '@nozbe/watermelondb/decorators'

export default class PayrollRun extends Model {
    static table = 'payroll_runs'

    @field('branch_id') branchId!: string
    @date('period_start') periodStart!: Date
    @date('period_end') periodEnd!: Date
    @date('pay_date') payDate!: Date | null
    /** draft | computed | approved | posted | reversed */
    @field('status') status!: string
    @field('total_gross') totalGross!: number
    @field('total_deductions') totalDeductions!: number
    @field('total_net') totalNet!: number
    @field('total_employer_contributions') totalEmployerContributions!: number
    @field('computed_by') computedBy!: string | null
    @field('approved_by') approvedBy!: string | null
    @date('approved_at') approvedAt!: Date | null
    @field('journal_entry_id') journalEntryId!: string | null
    @field('notes') notes!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null

    @children('payroll_lines') lines: any
}
