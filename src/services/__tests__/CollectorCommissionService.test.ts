import { CollectorCommissionServiceClass } from '../CollectorCommissionService';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';

describe('CollectorCommissionService', () => {
    let database: Database;
    let service: CollectorCommissionServiceClass;

    beforeEach(async () => {
        database = createTestDatabase();
        service = new CollectorCommissionServiceClass(database);
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('calculates percentage commission correctly', () => {
        // 5% of 10,000 = 500
        expect(service.calculateCommission(10000, 5)).toBe(500);
        // Decimal rate 0.05 of 10,000 = 500
        expect(service.calculateCommission(10000, 0.05)).toBe(500);
    });

    it('links collector to member and updates commission rate', async () => {
        const collector = await service.updateCollectorCommissionSettings({
            collectorId: 'coll-101',
            memberId: 'mem-202',
            commissionRate: 7.5,
        });

        expect(collector.commissionRate).toBe(7.5);
        expect(collector.memberId).toBe('mem-202');
    });
});
