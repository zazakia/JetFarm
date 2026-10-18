import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class MarketplaceOrder extends Model {
    static table = 'marketplace_orders'

    @field('buyer_id') buyerId!: string;
    @field('order_number') orderNumber!: string;
    @field('total_amount') totalAmount!: number;
    @field('payment_method') paymentMethod!: string;
    @field('payment_status') paymentStatus!: string;
    @readonly @date('created_at') createdAt!: number;
    @readonly @date('updated_at') updatedAt!: number;
    @date('deleted_at') deletedAt!: number | null;
}
