import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class AgriFarmExpense extends Model {
    static table = 'agri_farm_expenses'

    @field('crop_cycle_id') cropCycleId!: string | null
    @field('parcel_id') parcelId!: string | null
    @date('expense_date') expenseDate!: Date
    @field('category') category!: string
    @field('description') description!: string
    @field('amount') amount!: number
    @field('paid_by') paidBy!: string // jet, investor
    @field('receipt_photo_uri') receiptPhotoUri!: string | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
