import { Database } from '@nozbe/watermelondb';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { LookupDataService, LookupCategory } from '../LookupDataService';

describe('LookupDataService', () => {
    let database: Database;
    let service: typeof LookupDataService;

    beforeEach(() => {
        database = createTestDatabase();
        service = LookupDataService;
        (service as any).db = database;
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('returns default options for UOM when no custom data is saved', async () => {
        const uoms = await service.getLookupItems('uom');
        expect(uoms.length).toBeGreaterThan(0);
        expect(uoms.some(item => item.code === 'kg')).toBe(true);
        expect(uoms.some(item => item.code === 'box')).toBe(true);

        const activeCodesOrNames = await service.getActiveOptions('uom');
        expect(activeCodesOrNames.includes('Kilogram (kg)')).toBe(true);
    });

    it('returns default categories catalog with metadata', () => {
        const categories = service.getCategoriesList();
        expect(categories.length).toBeGreaterThanOrEqual(10);
        expect(categories.some(c => c.key === 'uom')).toBe(true);
        expect(categories.some(c => c.key === 'return_reason')).toBe(true);
        expect(categories.some(c => c.key === 'payment_method')).toBe(true);
        expect(categories.some(c => c.key === 'soil_type')).toBe(true);
        expect(categories.some(c => c.key === 'crop_variety')).toBe(true);
    });

    it('adds a new custom lookup item and persists to database', async () => {
        const newItem = await service.saveLookupItem('return_reason', {
            name: 'Wrong Temperature at Delivery',
            code: 'temp_issue',
            description: 'Item was delivered cold instead of hot',
            isActive: true,
        });

        expect(newItem.id).toBeDefined();
        expect(newItem.name).toBe('Wrong Temperature at Delivery');
        expect(newItem.code).toBe('temp_issue');

        const items = await service.getLookupItems('return_reason');
        expect(items.some(i => i.id === newItem.id)).toBe(true);

        const activeOptions = await service.getActiveOptions('return_reason');
        expect(activeOptions.includes('Wrong Temperature at Delivery')).toBe(true);
    });

    it('updates an existing lookup item', async () => {
        const items = await service.getLookupItems('payment_method');
        const first = items[0];

        await service.saveLookupItem('payment_method', {
            id: first.id,
            name: `${first.name} (Updated)`,
        });

        const updatedItems = await service.getLookupItems('payment_method');
        const updated = updatedItems.find(i => i.id === first.id);
        expect(updated?.name).toBe(`${first.name} (Updated)`);
    });

    it('toggles active status of an item', async () => {
        const items = await service.getLookupItems('soil_type');
        const first = items[0];
        const initialStatus = first.isActive;

        await service.toggleLookupItemStatus('soil_type', first.id);

        const updatedItems = await service.getLookupItems('soil_type');
        const updated = updatedItems.find(i => i.id === first.id);
        expect(updated?.isActive).toBe(!initialStatus);
    });

    it('deletes an item and removes it from active list', async () => {
        const created = await service.saveLookupItem('leave_type', {
            name: 'Study Leave',
            code: 'STUDY',
            isActive: true,
        });

        let items = await service.getLookupItems('leave_type');
        expect(items.some(i => i.id === created.id)).toBe(true);

        await service.deleteLookupItem('leave_type', created.id);

        items = await service.getLookupItems('leave_type');
        expect(items.some(i => i.id === created.id)).toBe(false);
    });

    it('resets a category to its initial system defaults', async () => {
        await service.saveLookupItem('waste_reason', {
            name: 'Temporary Mystery Spoilage',
            code: 'temp_spoil',
            isActive: true,
        });

        let items = await service.getLookupItems('waste_reason');
        expect(items.some(i => i.code === 'temp_spoil')).toBe(true);

        const resetItems = await service.resetCategoryToDefaults('waste_reason');
        expect(resetItems.some(i => i.code === 'temp_spoil')).toBe(false);
        expect(resetItems.length).toBeGreaterThan(0);
    });
});
