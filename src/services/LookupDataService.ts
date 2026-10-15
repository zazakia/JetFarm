import { Database, Q } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import AppSetting from '../database/models/AppSetting';
import uuid from 'react-native-uuid';

export type LookupCategory =
    | 'uom'
    | 'payment_method'
    | 'return_reason'
    | 'waste_reason'
    | 'soil_type'
    | 'crop_variety'
    | 'farm_task'
    | 'leave_type'
    | 'civil_status'
    | 'warehouse_type';

export interface LookupItem {
    id: string;
    name: string;
    code?: string;
    description?: string;
    isActive: boolean;
    isSystemDefault?: boolean;
    sortOrder?: number;
}

export interface LookupCategoryMeta {
    key: LookupCategory;
    label: string;
    description: string;
    icon: string;
}

export const DEFAULT_LOOKUP_ITEMS: Record<LookupCategory, LookupItem[]> = {
    uom: [
        { id: 'uom-kg', name: 'Kilogram (kg)', code: 'kg', description: 'Standard metric weight', isActive: true, isSystemDefault: true, sortOrder: 1 },
        { id: 'uom-g', name: 'Gram (g)', code: 'g', description: 'Fractional metric weight', isActive: true, isSystemDefault: true, sortOrder: 2 },
        { id: 'uom-sack-50', name: 'Sack (50 kg)', code: 'sack_50kg', description: 'Standard agricultural sack', isActive: true, isSystemDefault: true, sortOrder: 3 },
        { id: 'uom-box', name: 'Box', code: 'box', description: 'Packaging box container', isActive: true, isSystemDefault: true, sortOrder: 4 },
        { id: 'uom-crate', name: 'Crate', code: 'crate', description: 'Plastic or wooden storage crate', isActive: true, isSystemDefault: true, sortOrder: 5 },
        { id: 'uom-pack', name: 'Pack', code: 'pack', description: 'Pre-packaged retail pack', isActive: true, isSystemDefault: true, sortOrder: 6 },
        { id: 'uom-bottle', name: 'Bottle', code: 'bottle', description: 'Glass or plastic bottle', isActive: true, isSystemDefault: true, sortOrder: 7 },
        { id: 'uom-pc', name: 'Piece (pc)', code: 'pc', description: 'Individual unit', isActive: true, isSystemDefault: true, sortOrder: 8 },
        { id: 'uom-liter', name: 'Liter (L)', code: 'L', description: 'Standard metric liquid volume', isActive: true, isSystemDefault: true, sortOrder: 9 },
        { id: 'uom-gallon', name: 'Gallon (gal)', code: 'gal', description: 'Standard liquid gallon', isActive: true, isSystemDefault: true, sortOrder: 10 },
        { id: 'uom-can', name: 'Can / Tin', code: 'can', description: 'Metal canned item', isActive: true, isSystemDefault: true, sortOrder: 11 },
        { id: 'uom-bundle', name: 'Bundle', code: 'bundle', description: 'Tied bundle or bunch', isActive: true, isSystemDefault: true, sortOrder: 12 },
    ],
    payment_method: [
        { id: 'pm-cash', name: 'Cash', code: 'cash', description: 'Physical cash notes and coins', isActive: true, isSystemDefault: true, sortOrder: 1 },
        { id: 'pm-gcash', name: 'GCash', code: 'gcash', description: 'GCash e-wallet payment', isActive: true, isSystemDefault: true, sortOrder: 2 },
        { id: 'pm-maya', name: 'Maya / PayMaya', code: 'maya', description: 'Maya e-wallet payment', isActive: true, isSystemDefault: true, sortOrder: 3 },
        { id: 'pm-bank-transfer', name: 'Bank Transfer', code: 'bank_transfer', description: 'Direct bank transfer / InstaPay / PESONet', isActive: true, isSystemDefault: true, sortOrder: 4 },
        { id: 'pm-cheque', name: 'Check / Cheque', code: 'cheque', description: 'Commercial or post-dated bank check', isActive: true, isSystemDefault: true, sortOrder: 5 },
        { id: 'pm-credit', name: 'Store Credit / AR', code: 'store_credit', description: 'On-account credit or member ledger', isActive: true, isSystemDefault: true, sortOrder: 6 },
    ],
    return_reason: [
        { id: 'rr-defective', name: 'Defective / Damaged', code: 'defective', description: 'Item received broken or defective', isActive: true, isSystemDefault: true, sortOrder: 1 },
        { id: 'rr-expired', name: 'Expired Item', code: 'expired', description: 'Product exceeded its expiry or best-by date', isActive: true, isSystemDefault: true, sortOrder: 2 },
        { id: 'rr-wrong-item', name: 'Wrong Item / Specification', code: 'wrong_item', description: 'Incorrect item given to customer', isActive: true, isSystemDefault: true, sortOrder: 3 },
        { id: 'rr-quality-reject', name: 'Quality Rejection / Cold', code: 'quality_reject', description: 'Food quality or temperature non-compliance', isActive: true, isSystemDefault: true, sortOrder: 4 },
        { id: 'rr-customer-change', name: 'Customer Changed Mind', code: 'customer_change', description: 'Customer requested cancellation or return', isActive: true, isSystemDefault: true, sortOrder: 5 },
        { id: 'rr-packaging-damage', name: 'Broken Packaging / Seal', code: 'packaging_damage', description: 'Tampered or damaged product seal', isActive: true, isSystemDefault: true, sortOrder: 6 },
    ],
    waste_reason: [
        { id: 'wr-spoiled', name: 'Spoiled / Rotten', code: 'spoiled', description: 'Perished or decayed ingredients/goods', isActive: true, isSystemDefault: true, sortOrder: 1 },
        { id: 'wr-overcooked', name: 'Overcooked / Burnt', code: 'overcooked', description: 'Cooking defect or burning during prep', isActive: true, isSystemDefault: true, sortOrder: 2 },
        { id: 'wr-dropped', name: 'Spilled / Dropped', code: 'spilled', description: 'Accidental drop or floor spill in store', isActive: true, isSystemDefault: true, sortOrder: 3 },
        { id: 'wr-expired', name: 'Expired Shelf Life', code: 'expired', description: 'Exceeded maximum holding time / expiration', isActive: true, isSystemDefault: true, sortOrder: 4 },
        { id: 'wr-pest', name: 'Pest / Contamination', code: 'pest', description: 'Pest infestation or storage contamination', isActive: true, isSystemDefault: true, sortOrder: 5 },
        { id: 'wr-reject', name: 'Quality Non-Compliance', code: 'quality_reject', description: 'Failed commissary or health inspection standard', isActive: true, isSystemDefault: true, sortOrder: 6 },
    ],
    soil_type: [
        { id: 'st-loam', name: 'Loam', code: 'loam', description: 'Balanced fertile soil ideal for cassava & crops', isActive: true, isSystemDefault: true, sortOrder: 1 },
        { id: 'st-clay', name: 'Clay', code: 'clay', description: 'Heavy moisture-retentive clay soil', isActive: true, isSystemDefault: true, sortOrder: 2 },
        { id: 'st-sandy-loam', name: 'Sandy Loam', code: 'sandy_loam', description: 'Free-draining sandy loam for root crops', isActive: true, isSystemDefault: true, sortOrder: 3 },
        { id: 'st-silty-clay', name: 'Silty Clay', code: 'silty_clay', description: 'High mineral silt-clay mixture', isActive: true, isSystemDefault: true, sortOrder: 4 },
        { id: 'st-clay-loam', name: 'Clay Loam', code: 'clay_loam', description: 'Moderate drainage and nutrient density', isActive: true, isSystemDefault: true, sortOrder: 5 },
        { id: 'st-peat', name: 'Peat / Organic Muck', code: 'peat', description: 'Decomposed high-organic content soil', isActive: true, isSystemDefault: true, sortOrder: 6 },
        { id: 'st-sandy', name: 'Sandy Soil', code: 'sandy', description: 'High drainage coarse grain soil', isActive: true, isSystemDefault: true, sortOrder: 7 },
    ],
    crop_variety: [
        { id: 'cv-cassava-golden', name: 'Cassava (Golden Yellow)', code: 'cassava_golden', description: 'High-starch yellow industrial & table variety', isActive: true, isSystemDefault: true, sortOrder: 1 },
        { id: 'cv-cassava-lakan', name: 'Cassava (Lakan 1)', code: 'cassava_lakan', description: 'Commercial flour & starch outgrower variety', isActive: true, isSystemDefault: true, sortOrder: 2 },
        { id: 'cv-rice-rc216', name: 'Rice (NSIC Rc216)', code: 'rice_rc216', description: 'High yielding inbred palay seed', isActive: true, isSystemDefault: true, sortOrder: 3 },
        { id: 'cv-rice-rc222', name: 'Rice (NSIC Rc222)', code: 'rice_rc222', description: 'Triple two hardy flood-tolerant palay', isActive: true, isSystemDefault: true, sortOrder: 4 },
        { id: 'cv-corn-yellow', name: 'Yellow Corn (Pioneer Hybrid)', code: 'corn_yellow', description: 'Animal feed grade hybrid yellow corn', isActive: true, isSystemDefault: true, sortOrder: 5 },
        { id: 'cv-corn-white', name: 'White Corn (Lagkitan)', code: 'corn_white', description: 'Glutinous white table corn', isActive: true, isSystemDefault: true, sortOrder: 6 },
        { id: 'cv-vegetables', name: 'Highland Vegetables', code: 'vegetables', description: 'Mixed cabbage, carrots, bell peppers', isActive: true, isSystemDefault: true, sortOrder: 7 },
        { id: 'cv-banana', name: 'Banana (Cavendish / Saba)', code: 'banana', description: 'Fresh fruit and processing banana cultivars', isActive: true, isSystemDefault: true, sortOrder: 8 },
    ],
    farm_task: [
        { id: 'ft-land-prep', name: 'Land Preparation', code: 'land_prep', description: 'Clearing and debris removal', isActive: true, isSystemDefault: true, sortOrder: 1 },
        { id: 'ft-plowing', name: 'Plowing & Harrowing', code: 'plowing', description: 'Tillage and tractor furrowing', isActive: true, isSystemDefault: true, sortOrder: 2 },
        { id: 'ft-planting', name: 'Planting / Transplanting', code: 'planting', description: 'Inserting cassava stalks / seedlings', isActive: true, isSystemDefault: true, sortOrder: 3 },
        { id: 'ft-fertilizing', name: 'Fertilizer Application', code: 'fertilizing', description: 'Basal and side-dressing nutrition', isActive: true, isSystemDefault: true, sortOrder: 4 },
        { id: 'ft-weeding', name: 'Weeding & Cultivation', code: 'weeding', description: 'Manual and off-barring weed removal', isActive: true, isSystemDefault: true, sortOrder: 5 },
        { id: 'ft-spraying', name: 'Pesticide & Foliar Spraying', code: 'spraying', description: 'Crop protection and bio-stimulant spraying', isActive: true, isSystemDefault: true, sortOrder: 6 },
        { id: 'ft-harvesting', name: 'Harvesting', code: 'harvesting', description: 'Uprooting and cutting tubers', isActive: true, isSystemDefault: true, sortOrder: 7 },
        { id: 'ft-hauling', name: 'Hauling, Weighing & Packing', code: 'hauling', description: 'Loading to transport trucks and scale weigh-in', isActive: true, isSystemDefault: true, sortOrder: 8 },
    ],
    leave_type: [
        { id: 'lt-vacation', name: 'Vacation Leave (VL)', code: 'VL', description: 'Annual statutory paid vacation', isActive: true, isSystemDefault: true, sortOrder: 1 },
        { id: 'lt-sick', name: 'Sick Leave (SL)', code: 'SL', description: 'Medical and recuperation leave', isActive: true, isSystemDefault: true, sortOrder: 2 },
        { id: 'lt-emergency', name: 'Emergency Leave', code: 'EL', description: 'Unforeseen urgent family matters', isActive: true, isSystemDefault: true, sortOrder: 3 },
        { id: 'lt-maternity', name: 'Maternity Leave', code: 'ML', description: 'RA 11210 105-day paid maternity benefit', isActive: true, isSystemDefault: true, sortOrder: 4 },
        { id: 'lt-paternity', name: 'Paternity Leave', code: 'PL', description: 'RA 8187 7-day paid paternity benefit', isActive: true, isSystemDefault: true, sortOrder: 5 },
        { id: 'lt-bereavement', name: 'Bereavement Leave', code: 'BL', description: 'Immediate family bereavement absence', isActive: true, isSystemDefault: true, sortOrder: 6 },
        { id: 'lt-cto', name: 'Compensatory Time Off (CTO)', code: 'CTO', description: 'Time-off in lieu of worked holiday/overtime', isActive: true, isSystemDefault: true, sortOrder: 7 },
    ],
    civil_status: [
        { id: 'cs-single', name: 'Single', code: 'single', description: 'Unmarried individual', isActive: true, isSystemDefault: true, sortOrder: 1 },
        { id: 'cs-married', name: 'Married', code: 'married', description: 'Legally married', isActive: true, isSystemDefault: true, sortOrder: 2 },
        { id: 'cs-widowed', name: 'Widowed', code: 'widowed', description: 'Surviving spouse', isActive: true, isSystemDefault: true, sortOrder: 3 },
        { id: 'cs-separated', name: 'Separated', code: 'separated', description: 'Legally or de facto separated', isActive: true, isSystemDefault: true, sortOrder: 4 },
        { id: 'cs-annulled', name: 'Annulled', code: 'annulled', description: 'Court-annulled marriage', isActive: true, isSystemDefault: true, sortOrder: 5 },
    ],
    warehouse_type: [
        { id: 'wt-store', name: 'Store / Retail Floor', code: 'store', description: 'Selling area & active stock shelf', isActive: true, isSystemDefault: true, sortOrder: 1 },
        { id: 'wt-transit', name: 'Transit / Dispatch Hub', code: 'transit', description: 'Goods in transit between commissary and branches', isActive: true, isSystemDefault: true, sortOrder: 2 },
        { id: 'wt-commissary', name: 'Central Commissary Warehouse', code: 'commissary', description: 'Central storage, bulk packing and deep freeze', isActive: true, isSystemDefault: true, sortOrder: 3 },
        { id: 'wt-quarantine', name: 'Quarantine / Damaged Holding', code: 'quarantine', description: 'Damaged, returned, or expired goods awaiting disposal', isActive: true, isSystemDefault: true, sortOrder: 4 },
    ],
};

export const LOOKUP_CATEGORIES_CATALOG: LookupCategoryMeta[] = [
    { key: 'uom', label: 'Units of Measure (UOM)', description: 'Base and packaged quantities (kg, box, sack, pack, liter, pcs)', icon: 'straighten' },
    { key: 'payment_method', label: 'Payment Methods', description: 'Tender types accepted in POS, loans, water station, sales', icon: 'payments' },
    { key: 'return_reason', label: 'Sales Return Reasons', description: 'Reasons for customer refunds and inventory reversals', icon: 'assignment-return' },
    { key: 'waste_reason', label: 'Waste & Spoilage Reasons', description: 'Kitchen waste, bad orders, and commissary discard reasons', icon: 'delete-sweep' },
    { key: 'soil_type', label: 'Soil Types', description: 'Farmland soil classifications used in parcel registration', icon: 'landscape' },
    { key: 'crop_variety', label: 'Crop Varieties & Types', description: 'Cassava, rice, corn, and vegetable cultivars for cycles', icon: 'grass' },
    { key: 'farm_task', label: 'Farm Activity Tasks', description: 'Daily labor operations (plowing, planting, weeding, harvest)', icon: 'engineering' },
    { key: 'leave_type', label: 'Employee Leave Types', description: 'HR leaves (VL, SL, Emergency, Maternity, Paternity, Bereavement)', icon: 'event-note' },
    { key: 'civil_status', label: 'Civil Statuses', description: 'Standard civil status options for members & staff', icon: 'people' },
    { key: 'warehouse_type', label: 'Warehouse Location Types', description: 'Store floor, transit hub, central commissary, quarantine', icon: 'store' },
];

export class LookupDataServiceClass {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    private getSettingKey(category: LookupCategory): string {
        return `lookup.${category}`;
    }

    getCategoriesList(): LookupCategoryMeta[] {
        return LOOKUP_CATEGORIES_CATALOG;
    }

    /**
     * Retrieve all lookup items for a given category.
     * Reads from WatermelonDB app_settings. If none saved, returns system defaults.
     */
    async getLookupItems(category: LookupCategory): Promise<LookupItem[]> {
        const key = this.getSettingKey(category);
        try {
            if (!this.db || !this.db.get) {
                return DEFAULT_LOOKUP_ITEMS[category] || [];
            }
            const settings = await this.db.get<AppSetting>('app_settings')
                .query(
                    Q.where('key', key),
                    Q.where('deleted_at', null)
                )
                .fetch();

            if (settings.length > 0 && settings[0].value) {
                try {
                    const parsed = JSON.parse(settings[0].value);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed;
                    }
                } catch (e) {
                    console.warn(`[LookupDataService] Failed to parse setting JSON for ${key}:`, e);
                }
            }
        } catch (err) {
            console.warn(`[LookupDataService] Error querying app_settings for ${key}:`, err);
        }

        return DEFAULT_LOOKUP_ITEMS[category] ? [...DEFAULT_LOOKUP_ITEMS[category]] : [];
    }

    /**
     * Return active lookup names/labels suitable for dropdown selectors and pickers.
     */
    async getActiveOptions(category: LookupCategory): Promise<string[]> {
        const items = await this.getLookupItems(category);
        return items.filter(i => i.isActive).map(i => i.name);
    }

    /**
     * Save an item (create or update) in a lookup category.
     */
    async saveLookupItem(
        category: LookupCategory,
        item: { id?: string; name: string; code?: string; description?: string; isActive?: boolean }
    ): Promise<LookupItem> {
        const existingItems = await this.getLookupItems(category);
        let targetItem: LookupItem;

        if (item.id) {
            const index = existingItems.findIndex(i => i.id === item.id);
            if (index >= 0) {
                targetItem = {
                    ...existingItems[index],
                    name: item.name.trim(),
                    code: item.code ? item.code.trim() : existingItems[index].code,
                    description: item.description !== undefined ? item.description?.trim() : existingItems[index].description,
                    isActive: item.isActive !== undefined ? item.isActive : existingItems[index].isActive,
                };
                existingItems[index] = targetItem;
            } else {
                targetItem = {
                    id: item.id,
                    name: item.name.trim(),
                    code: item.code?.trim() || item.name.trim().toLowerCase().replace(/\s+/g, '_'),
                    description: item.description?.trim(),
                    isActive: item.isActive ?? true,
                    isSystemDefault: false,
                    sortOrder: existingItems.length + 1,
                };
                existingItems.push(targetItem);
            }
        } else {
            targetItem = {
                id: `custom-${category}-${uuid.v4().toString().slice(0, 8)}`,
                name: item.name.trim(),
                code: item.code?.trim() || item.name.trim().toLowerCase().replace(/\s+/g, '_'),
                description: item.description?.trim(),
                isActive: item.isActive ?? true,
                isSystemDefault: false,
                sortOrder: existingItems.length + 1,
            };
            existingItems.push(targetItem);
        }

        await this.persistItems(category, existingItems);
        return targetItem;
    }

    /**
     * Toggle the active status of an item.
     */
    async toggleLookupItemStatus(category: LookupCategory, itemId: string): Promise<void> {
        const items = await this.getLookupItems(category);
        const item = items.find(i => i.id === itemId);
        if (item) {
            item.isActive = !item.isActive;
            await this.persistItems(category, items);
        }
    }

    /**
     * Delete an item from a lookup category.
     */
    async deleteLookupItem(category: LookupCategory, itemId: string): Promise<void> {
        const items = await this.getLookupItems(category);
        const filtered = items.filter(i => i.id !== itemId);
        await this.persistItems(category, filtered);
    }

    /**
     * Reset a lookup category back to original defaults.
     */
    async resetCategoryToDefaults(category: LookupCategory): Promise<LookupItem[]> {
        const defaults = DEFAULT_LOOKUP_ITEMS[category] ? [...DEFAULT_LOOKUP_ITEMS[category]] : [];
        await this.persistItems(category, defaults);
        return defaults;
    }

    /**
     * Persist array of items to WatermelonDB app_settings row.
     */
    private async persistItems(category: LookupCategory, items: LookupItem[]): Promise<void> {
        const key = this.getSettingKey(category);
        const jsonValue = JSON.stringify(items);
        const now = Date.now();

        const collection = this.db.get<AppSetting>('app_settings');
        const existing = await collection.query(
            Q.where('key', key),
            Q.where('deleted_at', null)
        ).fetch();

        await this.db.write(async () => {
            if (existing.length > 0) {
                await existing[0].update(record => {
                    record.value = jsonValue;
                    record.valueType = 'json';
                    record.updatedAt = now;
                });
            } else {
                await collection.create(record => {
                    (record as any)._raw.id = uuid.v4().toString();
                    record.key = key;
                    record.value = jsonValue;
                    record.valueType = 'json';
                    record.scope = 'global';
                    record.isActive = true;
                    record.createdAt = now;
                    record.updatedAt = now;
                    record.deletedAt = null;
                });
            }
        });
    }
}

export const LookupDataService = new LookupDataServiceClass();
export default LookupDataService;
