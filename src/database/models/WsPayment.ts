import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class WsPayment extends Model {
    static table = 'ws_payments'

    @field('customer_id') customerId!: string
    @field('delivery_id') deliveryId!: string | null
    @field('payment_date') paymentDate!: number
    @field('amount') amount!: number
    @field('payment_method') paymentMethod!: string // cash | gcash

    @readonly @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
