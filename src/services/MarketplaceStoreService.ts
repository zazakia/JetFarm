import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import MarketplaceStore from '../database/models/MarketplaceStore';
import ActionLogService from './ActionLogService';
import { sanitizeMarketplaceInput } from '../utils/MarketplaceErrorHandler';

export interface CreateStoreParams {
    borrowerId: string;
    name: string;
    description?: string;
    category?: string;
    logoUrl?: string;
    bannerUrl?: string;
    commissionTier?: string;
}

export class MarketplaceStoreService {
    static async createStore(params: CreateStoreParams): Promise<MarketplaceStore> {
        const cleanName = sanitizeMarketplaceInput(params.name);
        if (!cleanName) {
            throw new Error('Store name cannot be empty');
        }

        const cleanDesc = sanitizeMarketplaceInput(params.description);
        const cleanCat = sanitizeMarketplaceInput(params.category) || 'General';
        const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        
        let storeRecord: MarketplaceStore;
        await database.write(async () => {
            storeRecord = await database.get<MarketplaceStore>('marketplace_stores').create(store => {
                store.borrowerId = params.borrowerId;
                store.name = cleanName;
                store.slug = slug;
                store.description = cleanDesc || null;
                store.category = cleanCat;
                store.logoUrl = params.logoUrl || null;
                store.bannerUrl = params.bannerUrl || null;
                store.status = 'pending'; // Requires Admin Approval
                store.holidayMode = false;
                store.rating = 5.0;
                store.commissionTier = params.commissionTier || 'standard';
            });
        });

        await ActionLogService.logAction({
            entityType: 'marketplace_stores',
            entityId: storeRecord!.id,
            action: 'CREATE',
            newData: { ...params, name: cleanName, status: 'pending' },
        });

        return storeRecord!;
    }

    static async updateStoreStatus(storeId: string, status: 'active' | 'rejected' | 'suspended', performedBy?: string): Promise<MarketplaceStore> {
        const store = await database.get<MarketplaceStore>('marketplace_stores').find(storeId);
        await database.write(async () => {
            await store.update(s => {
                s.status = status;
            });
        });

        await ActionLogService.logAction({
            entityType: 'marketplace_stores',
            entityId: storeId,
            action: 'UPDATE',
            newData: { status },
            performedBy,
        });

        return store;
    }

    static async toggleHolidayMode(storeId: string, holidayMode: boolean): Promise<MarketplaceStore> {
        const store = await database.get<MarketplaceStore>('marketplace_stores').find(storeId);
        await database.write(async () => {
            await store.update(s => {
                s.holidayMode = holidayMode;
            });
        });
        return store;
    }

    static async getStoreByBorrowerId(borrowerId: string): Promise<MarketplaceStore | null> {
        const stores = await database.get<MarketplaceStore>('marketplace_stores')
            .query(Q.where('borrower_id', borrowerId), Q.where('deleted_at', Q.eq(null)))
            .fetch();
        return stores.length > 0 ? stores[0] : null;
    }

    static async fetchActiveStores(): Promise<MarketplaceStore[]> {
        return await database.get<MarketplaceStore>('marketplace_stores')
            .query(Q.where('status', 'active'), Q.where('deleted_at', Q.eq(null)))
            .fetch();
    }

    static async fetchPendingStores(): Promise<MarketplaceStore[]> {
        return await database.get<MarketplaceStore>('marketplace_stores')
            .query(Q.where('status', 'pending'), Q.where('deleted_at', Q.eq(null)))
            .fetch();
    }
}

export default MarketplaceStoreService;
