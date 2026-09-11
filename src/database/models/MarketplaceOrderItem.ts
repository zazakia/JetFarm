import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class MarketplaceOrderItem extends Model {
    static table = 'marketplace_order_items'

    @field('sub_order_id') subOrderId: string;
    @field('product_id') productId: string;
    @field('variant_id') variantId: string | null;
    @field('quantity') quantity: number;
    @field('unit_price') unitPrice: number;
    @field('total_price') totalPrice: number;
    @readonly @date('created_at') createdAt: number;
    @readonly @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
