import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AccountsPayableVoucher extends Model {
    static table = 'accounts_payable_vouchers'

    @field('supplier_id') supplierId!: string
    @field('voucher_number') voucherNumber!: string
    @field('invoice_number') invoiceNumber!: string | null
    @date('invoice_date') invoiceDate!: Date
    @date('due_date') dueDate!: Date | null
    @field('description') description!: string
    @field('amount') amount!: number
    @field('amount_paid') amountPaid!: number | null
    @field('balance') balance!: number
    /** open | partial | paid | cancelled */
    @field('status') status!: string
    @field('expense_account_code') expenseAccountCode!: string | null
    @field('module_id') moduleId!: string | null
    @field('posted_by') postedBy!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
