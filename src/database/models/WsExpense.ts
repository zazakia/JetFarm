import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class WsExpense extends Model {
    static table = 'ws_expenses'

    @field('category') category!: string
    @field('amount') amount!: number
    @field('expense_date') expenseDate!: number
    @field('description') description!: string | null

    @readonly @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
