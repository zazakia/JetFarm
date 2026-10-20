/**
 * BusinessUnitService — agribusiness-only build.
 *
 * The coop module-manifest API (registerModule / getByModuleId / module CoA
 * seeding) is gone: segments are created directly. This suite pins the reads,
 * the create path (including the idempotent re-activation of an existing slug)
 * and the active-state toggle, with ActionLogService mocked so the assertions
 * are about this service's own decisions.
 */
import { Database } from '@nozbe/watermelondb';
import { createTestDatabase } from '../../__tests__/test-utils';
import BusinessUnit from '../../database/models/BusinessUnit';
import { BusinessUnitServiceClass } from '../BusinessUnitService';

const mockLogAction = jest.fn().mockResolvedValue(undefined);
jest.mock('../ActionLogService', () => ({
    __esModule: true,
    default: { logAction: (...args: any[]) => mockLogAction(...args) },
}));

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
            rec.name = overrides.name ?? 'Agri-Store';
            rec.slug = overrides.slug ?? 'agri-store';
            rec.moduleId = overrides.module_id ?? 'agri-store';
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

    it('getBySlug finds a live unit and misses soft-deleted or unknown slugs', async () => {
        await seedUnit({ slug: 'agri-store', module_id: 'ag' });
        await seedUnit({ slug: 'dead', module_id: 'dm', deleted_at: Date.now() });

        expect((await service.getBySlug('agri-store'))?.moduleId).toBe('ag');
        expect(await service.getBySlug('dead')).toBeNull();
        expect(await service.getBySlug('nope')).toBeNull();
    });
});

describe('BusinessUnitService — create', () => {
    it('creates the segment, logs CREATE, and leaves it active', async () => {
        const bu = await service.create(
            { name: 'Agribusiness Operations', slug: 'agribusiness', description: 'Outgrower operations' },
            'user-1',
        );

        expect(bu.slug).toBe('agribusiness');
        expect(bu.name).toBe('Agribusiness Operations');
        expect(bu.description).toBe('Outgrower operations');
        expect(bu.isActive).toBe(true);
        expect(mockLogAction).toHaveBeenCalledWith(
            expect.objectContaining({ entityType: 'business_units', action: 'CREATE', performedBy: 'user-1' }),
        );
        expect(await service.getAll()).toHaveLength(1);
    });

    it('defaults description to null when the caller omits it', async () => {
        const bu = await service.create({ name: 'Agri-Store', slug: 'agri-store' });
        expect(bu.description).toBeNull();
    });

    it('re-activates an existing inactive slug instead of duplicating it, logging UPDATE', async () => {
        const existing = await seedUnit({ slug: 'agri-store', is_active: false });
        const bu = await service.create({ name: 'Agri-Store', slug: 'agri-store' }, 'user-2');

        expect(bu.id).toBe(existing.id);
        expect(bu.isActive).toBe(true);
        expect(mockLogAction).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'UPDATE', entityId: existing.id, performedBy: 'user-2' }),
        );
        expect(await service.getAll()).toHaveLength(1);
    });

    it('is a pure no-op when the slug already exists and is active', async () => {
        const existing = await seedUnit({ slug: 'agri-store' });
        const bu = await service.create({ name: 'Agri-Store', slug: 'agri-store' });

        expect(bu.id).toBe(existing.id);
        expect(mockLogAction).not.toHaveBeenCalled();
        expect(await service.getAll()).toHaveLength(1);
    });
});

describe('BusinessUnitService — setActiveState', () => {
    it('toggles a known unit and logs the UPDATE', async () => {
        const bu = await seedUnit({ slug: 'agri-store' });
        const updated = await service.setActiveState('agri-store', false, 'user-3');
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
