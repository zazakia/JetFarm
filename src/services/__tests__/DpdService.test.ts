import { DpdService } from '../DpdService';
import { Database } from '@nozbe/watermelondb';
import { createTestData } from '../../__tests__/test-utils';

jest.mock('../../database', () => {
    const { createTestDatabase } = jest.requireActual('../../__tests__/test-utils');
    const db = createTestDatabase();
    return { database: db };
});

describe('DpdService', () => {
    let service: DpdService;
    let database: Database;

    beforeEach(async () => {
        const dbModule = require('../../database');
        database = dbModule.database;
        service = new DpdService();
        jest.clearAllMocks();
    });

    describe('calculateAndSyncDpd', () => {
        it('calculates 0 DPD for loans with no active schedules', async () => {
            const { loan } = await createTestData(database);
            
            const updatedLoan = await service.calculateAndSyncDpd(loan.id);
            expect(updatedLoan.dpd).toBe(0);
            expect(updatedLoan.agingBucket).toBe('CURRENT');
            expect(updatedLoan.isDelinquent).toBe(false);
        });

        it('calculates >0 DPD when an unpaid schedule is past due', async () => {
            const { loan } = await createTestData(database);
            
            // Create a schedule that was due 10 days ago
            const tenDaysAgo = new Date().getTime() - (10 * 24 * 60 * 60 * 1000);
            
            await database.write(async () => {
                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = loan.id;
                    s.dueDate = tenDaysAgo;
                    s.status = 'unpaid';
                    s.amount = 100;
                });
            });

            const updatedLoan = await service.calculateAndSyncDpd(loan.id);
            
            expect(updatedLoan.dpd).toBeGreaterThanOrEqual(9);
            expect(updatedLoan.dpd).toBeLessThanOrEqual(11); // Account for timezone/rounding
            expect(updatedLoan.agingBucket).toBe('1-30 Days');
            expect(updatedLoan.isDelinquent).toBe(true);
            const returnedTime = typeof updatedLoan.delinquentSince === 'number' 
                ? updatedLoan.delinquentSince 
                : new Date(updatedLoan.delinquentSince as any).getTime();
            expect(returnedTime).toBe(tenDaysAgo);
        });

        it('determines the correct aging bucket for over 90 days', async () => {
            const { loan } = await createTestData(database);
            
            const hundredDaysAgo = new Date().getTime() - (100 * 24 * 60 * 60 * 1000);
            
            await database.write(async () => {
                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = loan.id;
                    s.dueDate = hundredDaysAgo;
                    s.status = 'unpaid';
                    s.amount = 100;
                });
            });

            const updatedLoan = await service.calculateAndSyncDpd(loan.id);
            expect(updatedLoan.agingBucket).toBe('Over 90 Days');
            expect(updatedLoan.isDelinquent).toBe(true);
        });
    });

    describe('batchUpdateAllActiveLoansDpd', () => {
        it('processes all active loans without throwing', async () => {
            await createTestData(database);
            await createTestData(database);
            
            await expect(service.batchUpdateAllActiveLoansDpd()).resolves.not.toThrow();
        });
    });
});
