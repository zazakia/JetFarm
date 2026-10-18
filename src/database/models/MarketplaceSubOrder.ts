import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class MarketplaceSubOrder extends Model {
    static table = 'marketplace_sub_orders'

    @field('order_id') orderId!: string;
    @field('store_id') storeId!: string;
    @field('sub_order_number') subOrderNumber!: string;
    @field('subtotal') subtotal!: number;
    @field('commission_amount') commissionAmount!: number;
    @field('shipping_fee') shippingFee!: number;
    @field('net_payout') netPayout!: number;
    @field('fulfillment_status') fulfillmentStatus!: string;
    @field('payout_status') payoutStatus!: string;
    @readonly @date('created_at') createdAt!: number;
    @readonly @date('updated_at') updatedAt!: number;
    @date('deleted_at') deletedAt!: number | null;
}
