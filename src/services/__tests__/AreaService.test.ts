import { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import { createTestDatabase } from '../../__tests__/test-utils';
import { AreaService, areaService } from '../AreaService';

// The kept (admin)/areas screens only ever used GroupService.getAreas() and createArea(); the rest
// of GroupService is AGAP solidarity groups, which the agribusiness variant does not have. This
// test pins the area half before GroupService is deleted, so the screens move to a service that
// carries only what they call.
describe('AreaService', () => {
    let database: Database;
    let service: AreaService;

    beforeEach(() => {
        database = createTestDatabase();
        service = new AreaService(database);
    });

    it('exports a singleton bound to the live database', () => {
        expect(areaService).toBeInstanceOf(AreaService);
    });

    it('returns only active, non-deleted areas', async () => {
        await database.write(async () => {
            await database.get('areas').create((r: any) => {
                r.name = 'Davao City';
                r.code = 'DVC';
                r.isActive = true;
            });
            await database.get('areas').create((r: any) => {
                r.name = 'Retired Area';
                r.code = 'RET';
                r.isActive = false;
            });
            await database.get('areas').create((r: any) => {
                r.name = 'Soft Deleted Area';
                r.code = 'SFD';
                r.isActive = true;
            });
        });
        // markAsDeleted is what sets deleted_at. Watermelon already hides destroyed records, so this
        // case guards against a regression that switches to fetchWithDeleted/raw SQL rather than
        // proving the deleted_at clause on its own; the is_active clause is the one the
        // 'Retired Area' row catches.
        await database.write(async () => {
            const [row] = await database
                .get('areas')
                .query(Q.where('code', 'SFD'))
                .fetch() as any[];
            await row.markAsDeleted();
        });

        const areas = (await service.getAreas()) as any[];
        expect(areas.map((a: any) => a.name).sort()).toEqual(['Davao City']);
    });

    it('creates an active area with the optional code and area-officer id', async () => {
        const created = await service.createArea('Cagayan de Oro', 'CDO', 'ao-1');

        expect((created as any).name).toBe('Cagayan de Oro');
        expect((created as any).code).toBe('CDO');
        expect((created as any).aoId).toBe('ao-1');
        expect((created as any).isActive).toBe(true);

        const stored = await database.get('areas').query(Q.where('code', 'CDO')).fetch();
        expect(stored).toHaveLength(1);
    });

    it('creates an area without a code or officer when they are omitted', async () => {
        const created = await service.createArea('Tagum');

        expect((created as any).name).toBe('Tagum');
        expect((created as any).aoId ?? null).toBeNull();
    });
});
