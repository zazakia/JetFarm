import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class MarketplaceProduct extends Model {
    static table = 'marketplace_products'

    @field('store_id') storeId: string;
    @field('inventory_item_id') inventoryItemId: string | null;
    @field('title') title: string;
    @field('description') description: string | null;
    @field('product_type') productType: string;
    @field('price') price: number;
    @field('compare_at_price') compareAtPrice: number | null;
    @field('stock_quantity') stockQuantity: number;
    @field('sku') sku: string | null;
    @field('status') status: string;
    @field('images_json') imagesJson: string | null;
    @field('variants_json') variantsJson: string | null;
    @readonly @date('created_at') createdAt: number;
    @readonly @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
