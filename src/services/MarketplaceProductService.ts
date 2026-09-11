import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import MarketplaceProduct from '../database/models/MarketplaceProduct';
import MarketplaceCategory from '../database/models/MarketplaceCategory';
import ActionLogService from './ActionLogService';
import { sanitizeMarketplaceInput, clampNonNegative } from '../utils/MarketplaceErrorHandler';

export interface CreateProductParams {
    storeId: string;
    inventoryItemId?: string;
    title: string;
    description?: string;
    productType?: 'physical' | 'service' | 'digital';
    price: number;
    compareAtPrice?: number;
    stockQuantity: number;
    sku?: string;
    images?: string[];
    variants?: any[];
}

export class MarketplaceProductService {
    static async createProduct(params: CreateProductParams): Promise<MarketplaceProduct> {
        const cleanTitle = sanitizeMarketplaceInput(params.title);
        if (!cleanTitle) {
            throw new Error('Product title cannot be empty');
        }

        const safePrice = clampNonNegative(params.price, 0);
        const safeStock = Math.floor(clampNonNegative(params.stockQuantity, 0));
        const cleanDesc = sanitizeMarketplaceInput(params.description);

        let product: MarketplaceProduct;

        await database.write(async () => {
            product = await database.get<MarketplaceProduct>('marketplace_products').create(p => {
                p.storeId = params.storeId;
                p.inventoryItemId = params.inventoryItemId || null;
                p.title = cleanTitle;
                p.description = cleanDesc || null;
                p.productType = params.productType || 'physical';
                p.price = safePrice;
                p.compareAtPrice = params.compareAtPrice ? clampNonNegative(params.compareAtPrice, 0) : null;
                p.stockQuantity = safeStock;
                p.sku = params.sku || null;
                p.status = 'pending_approval'; // Admin review before live
                p.imagesJson = params.images ? JSON.stringify(params.images) : null;
                p.variantsJson = params.variants ? JSON.stringify(params.variants) : null;
            });
        });

        await ActionLogService.logAction({
            entityType: 'marketplace_products',
            entityId: product!.id,
            action: 'CREATE',
            newData: { ...params, title: cleanTitle, price: safePrice, stockQuantity: safeStock, status: 'pending_approval' },
        });

        return product!;
    }

    static async updateProductStatus(productId: string, status: 'active' | 'rejected' | 'archived', performedBy?: string): Promise<MarketplaceProduct> {
        const product = await database.get<MarketplaceProduct>('marketplace_products').find(productId);
        await database.write(async () => {
            await product.update(p => {
                p.status = status;
            });
        });

        await ActionLogService.logAction({
            entityType: 'marketplace_products',
            entityId: productId,
            action: 'UPDATE',
            newData: { status },
            performedBy,
        });

        return product;
    }

    static async fetchStoreProducts(storeId: string): Promise<MarketplaceProduct[]> {
        return await database.get<MarketplaceProduct>('marketplace_products')
            .query(Q.where('store_id', storeId), Q.where('deleted_at', Q.eq(null)))
            .fetch();
    }

    static async fetchActiveProducts(): Promise<MarketplaceProduct[]> {
        return await database.get<MarketplaceProduct>('marketplace_products')
            .query(Q.where('status', 'active'), Q.where('deleted_at', Q.eq(null)))
            .fetch();
    }

    static async fetchPendingProducts(): Promise<MarketplaceProduct[]> {
        return await database.get<MarketplaceProduct>('marketplace_products')
            .query(Q.where('status', 'pending_approval'), Q.where('deleted_at', Q.eq(null)))
            .fetch();
    }

    static async seedDefaultCategories(): Promise<MarketplaceCategory[]> {
        const existing = await database.get<MarketplaceCategory>('marketplace_categories').query().fetch();
        if (existing.length > 0) return existing;

        const defaultCats = [
            { name: 'Agriculture & Fresh Produce', slug: 'agriculture', icon: 'sprout' },
            { name: 'Handicrafts & Local Products', slug: 'handicrafts', icon: 'basket' },
            { name: 'Food & Beverages', slug: 'food-beverage', icon: 'silverware-fork-knife' },
            { name: 'Services & Consultancy', slug: 'services', icon: 'account-cog' },
            { name: 'Apparel & Textiles', slug: 'apparel', icon: 'tshirt-crew' },
        ];

        const created: MarketplaceCategory[] = [];
        await database.write(async () => {
            for (const cat of defaultCats) {
                const item = await database.get<MarketplaceCategory>('marketplace_categories').create(c => {
                    c.name = cat.name;
                    c.slug = cat.slug;
                    c.icon = cat.icon;
                    c.parentId = null;
                    c.isActive = true;
                });
                created.push(item);
            }
        });
        return created;
    }
}

export default MarketplaceProductService;
