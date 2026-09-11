import { GroupService } from '../GroupService';
import { Database } from '@nozbe/watermelondb';

jest.mock('../../database', () => {
    const { createTestDatabase } = jest.requireActual('../../__tests__/test-utils');
    const db = createTestDatabase();
    return { database: db };
});

describe('GroupService', () => {
    let service: GroupService;
    let database: Database;

    beforeEach(async () => {
        const dbModule = require('../../database');
        database = dbModule.database;
        service = new GroupService();
        jest.clearAllMocks();
    });

    describe('createArea and getAreas', () => {
        it('creates an area and fetches it', async () => {
            const area = await service.createArea('San Jose', 'SJ', 'ao-1');
            expect(area).toBeDefined();
            expect(area.name).toBe('San Jose');
            expect(area.code).toBe('SJ');
            expect(area.isActive).toBe(true);

            const areas = await service.getAreas();
            expect(areas.length).toBeGreaterThan(0);
            const fetched = areas.find(a => a.id === area.id);
            expect(fetched).toBeDefined();
        });
    });

    describe('createSolidarityGroup and getSolidarityGroups', () => {
        it('creates a solidarity group properly mapped to an area', async () => {
            const group = await service.createSolidarityGroup({
                name: 'Center 1',
                collectorId: 'c-1',
                areaId: 'a-1',
                centerDayName: 'Monday',
                centerTime: '09:00 AM'
            });

            expect(group).toBeDefined();
            expect(group.name).toBe('Center 1');
            expect(group.groupType).toBe('agap_solidarity');
            expect(group.areaId).toBe('a-1');
            expect(group.collectionDay).toBe(1); // Monday is index 1
            expect(group.centerDayName).toBe('Monday');
            expect(group.centerTime).toBe('09:00 AM');
            expect(group.isActive).toBe(true);
        });

        it('fetches only active solidarity groups', async () => {
            await service.createSolidarityGroup({
                name: 'Center 2',
                collectorId: 'c-1',
                areaId: 'a-1',
                centerDayName: 'Tuesday',
                centerTime: '10:00 AM'
            });

            const groups = await service.getSolidarityGroups();
            expect(groups.length).toBeGreaterThan(0);
            expect(groups[0].groupType).toBe('agap_solidarity');
        });
    });
});
