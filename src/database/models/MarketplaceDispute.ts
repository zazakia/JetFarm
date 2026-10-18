import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class MarketplaceDispute extends Model {
    static table = 'marketplace_disputes'

    @field('sub_order_id') subOrderId!: string;
    @field('buyer_id') buyerId!: string;
    @field('store_id') storeId!: string;
    @field('reason') reason!: string;
    @field('status') status!: string;
    @field('resolution_notes') resolutionNotes!: string | null;
    @field('refund_amount') refundAmount!: number | null;
    @readonly @date('created_at') createdAt!: number;
    @readonly @date('updated_at') updatedAt!: number;
    @date('deleted_at') deletedAt!: number | null;
}
