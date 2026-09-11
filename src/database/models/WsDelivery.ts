import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class WsDelivery extends Model {
    static table = 'ws_deliveries'

    @field('customer_id') customerId!: string
    @field('delivery_date') deliveryDate!: number
    @field('gallons') gallons!: number
    @field('price_per_gallon') pricePerGallon!: number
    @field('total_amount') totalAmount!: number
    @field('status') status!: string // pending | delivered | cancelled

    @readonly @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
