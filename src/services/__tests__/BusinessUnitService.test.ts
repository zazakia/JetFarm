/**
 * BusinessUnitService — Phase 1 AI-authored test suite (trial).
 *
 * Covers register/get/active-state flows on a LokiJS test database.
 * COA seeding and action logging are side collaborators, mocked here so
 * the suite pins BusinessUnitService's own decisions (create vs reactivate,
 * soft-delete filtering, log verbs, seed-once semantics).
 */
import { Database } from '@nozbe/watermelondb';
import { createTestDatabase } from '../../__tests__/test-utils';
import BusinessUnit from '../../database/models/BusinessUnit';
import { BusinessUnitServiceClass } from '../BusinessUnitService';

const mockCreateAccount = jest.fn();
jest.mock('../ChartOfAccountsService', () => ({
    ChartOfAccountsServiceClass: class {
        create = (...args: any[]) => mockCreateAccount(...args);
    },
}));

const mockLogAction = jest.fn().mockResolvedValue(undefined);
jest.mock('../ActionLogService', () => ({
    __esModule: true,
    default: { logAction: (...args: any[]) => mockLogAction(...args) },
}));

const fakeModule = {
    id: 'water-station',
    name: 'Water Station',
    description: 'Potable water distribution',
    defaultCoA: [
        { code: '1100-W', name: 'WS Cash' },
        { code: '4100-W', name: 'WS Revenue' },
    ],
} as any;

let database: Database;
let service: BusinessUnitServiceClass;

interface SeedOverrides {
    name?: string;
    slug?: string;
    module_id?: string;
    is_active?: boolean;
    deleted_at?: number;
}

async function seedUnit(overrides: SeedOverrides = {}) {
    return database.write(async () =>
        database.get<BusinessUnit>('business_units').create((rec) => {
            rec.name = overrides.name ?? 'Water Station';
            rec.slug = overrides.slug ?? 'water-station';
            rec.moduleId = overrides.module_id ?? 'water-station';
            rec.isActive = overrides.is_active ?? true;
            rec.description = 'seeded';
            if (overrides.deleted_at != null) rec.deletedAt = new Date(overrides.deleted_at);
        }),
    );
}

beforeEach(() => {
    database = createTestDatabase();
    service = new BusinessUnitServiceClass(database);
    jest.clearAllMocks();
});

describe('BusinessUnitService — reads', () => {
    it('getAll returns only non-soft-deleted units', async () => {
        await seedUnit({ slug: 'alive-1', module_id: 'm-1' });
        await seedUnit({ slug: 'gone-1', module_id: 'm-2', deleted_at: Date.now() });
        const all = await service.getAll();
        expect(all.map((u) => u.slug)).toEqual(['alive-1']);
    });

    it('getBySlug and getByModuleId find active records and miss deleted ones', async () => {
        await seedUnit({ slug: 'water-station', module_id: 'wm' });
        await seedUnit({ slug: 'dead', module_id: 'dm', deleted_at: Date.now() });

        expect((await service.getBySlug('water-station'))?.moduleId).toBe('wm');
        expect(await service.getBySlug('dead')).toBeNull();
        expect((await service.getByModuleId('wm'))?.slug).toBe('water-station');
        expect(await service.getByModuleId('dm')).toBeNull();
        expect(await service.getBySlug('nope')).toBeNull();
    });
});

describe('BusinessUnitService — registerModule', () => {
    it('creates the unit, logs CREATE, and seeds each default CoA account once', async () => {
        const bu = await service.registerModule(fakeModule, 'user-1');

        expect(bu.slug).toBe('water-station');
        expect(bu.moduleId).toBe('water-station');
        expect(bu.isActive).toBe(true);
        expect(bu.name).toBe('Water Station');

        expect(mockCreateAccount).toHaveBeenCalledTimes(2);
        expect(mockCreateAccount).toHaveBeenCalledWith(
            expect.objectContaining({ code: '1100-W' }),
            'user-1',
        );
        expect(mockLogAction).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'business_units', action: 'CREATE', performedBy: 'user-1' }),
        );
        expect(await service.getAll()).toHaveLength(1);
    });

    it('continues seeding when one account fails (already exists)', async () => {
        mockCreateAccount
            .mockRejectedValueOnce(new Error('duplicate code'))
            .mockResolvedValueOnce({} as any);
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

        await service.registerModule(fakeModule);

        expect(mockCreateAccount).toHaveBeenCalledTimes(2);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('re-activates an inactive unit without duplicating or re-seeding, logging UPDATE', async () => {
        const existing = await seedUnit({ is_active: false });
        const bu = await service.registerModule(fakeModule, 'user-2');

        expect(bu.id).toBe(existing.id);
        expect(bu.isActive).toBe(true);
        expect(mockCreateAccount).not.toHaveBeenCalled();
        expect(mockLogAction).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'UPDATE', entityId: existing.id, performedBy: 'user-2' }),
        );
        expect(await service.getAll()).toHaveLength(1);
    });

    it('is a pure no-op when the module is already registered and active', async () => {
        const existing = await seedUnit();
        const bu = await service.registerModule(fakeModule);
        expect(bu.id).toBe(existing.id);
        expect(mockLogAction).not.toHaveBeenCalled();
        expect(mockCreateAccount).not.toHaveBeenCalled();
    });
});

describe('BusinessUnitService — setActiveState', () => {
    it('toggles a known unit and logs the UPDATE', async () => {
        const bu = await seedUnit();
        const updated = await service.setActiveState('water-station', false, 'user-3');
        expect(updated.isActive).toBe(false);
        expect(mockLogAction).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'UPDATE', entityId: bu.id, performedBy: 'user-3' }),
        );
    });

    it('throws for an unknown or soft-deleted slug and logs nothing', async () => {
        await seedUnit({ slug: 'gone', deleted_at: Date.now() });
        await expect(service.setActiveState('gone', false)).rejects.toThrow(/not found/i);
        await expect(service.setActiveState('never-existed', true)).rejects.toThrow('Business unit with slug "never-existed" not found.');
        expect(mockLogAction).not.toHaveBeenCalled();
    });
});
