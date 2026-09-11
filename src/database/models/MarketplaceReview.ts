import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class MarketplaceReview extends Model {
    static table = 'marketplace_reviews'

    @field('product_id') productId: string;
    @field('store_id') storeId: string;
    @field('buyer_id') buyerId: string;
    @field('rating') rating: number;
    @field('comment') comment: string | null;
    @field('images_json') imagesJson: string | null;
    @readonly @date('created_at') createdAt: number;
    @readonly @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
