import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class MarketplacePromotion extends Model {
    static table = 'marketplace_promotions'

    @field('store_id') storeId: string;
    @field('code') code: string;
    @field('discount_type') discountType: string;
    @field('discount_value') discountValue: number;
    @field('min_spend') minSpend: number | null;
    @date('start_date') startDate: number;
    @date('end_date') endDate: number;
    @field('is_active') isActive: boolean;
    @readonly @date('created_at') createdAt: number;
    @readonly @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
