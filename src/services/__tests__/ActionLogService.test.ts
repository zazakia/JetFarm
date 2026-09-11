import { ActionLogService } from '../ActionLogService';
import { createTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';
import { AuthService } from '../AuthService';

jest.mock('../AuthService', () => ({
    AuthService: {
        getCurrentUserId: jest.fn().mockResolvedValue('user-123'),
        getCurrentUserRole: jest.fn().mockResolvedValue('collector'),
    }
}));

jest.mock('../../database', () => ({
    database: null,
}));

describe('ActionLogService', () => {
    let database: Database;
    let service: ActionLogService;

    beforeEach(async () => {
        database = createTestDatabase();
        service = new ActionLogService(database);
        jest.clearAllMocks();
    });

    describe('logAction / logActions', () => {
        it('logs a single action with default user', async () => {
            const params = {
                entityType: 'loans',
                entityId: 'loan-1',
                action: 'CREATE' as const,
                newData: { amount: 1000 }
            };

            await service.logAction(params);

            const logs = await database.get('action_logs').query().fetch() as any[];
            expect(logs.length).toBe(1);
            expect(logs[0].entityType).toBe('loans');
            expect(logs[0].entityId).toBe('loan-1');
            expect(logs[0].action).toBe('CREATE');
            expect(logs[0].performedBy).toBe('user-123');
            expect(logs[0].newData).toBe(JSON.stringify({ amount: 1000 }));
        });

        it('logs multiple actions in batch', async () => {
            const paramsList = [
                { entityType: 'loans', entityId: 'L1', action: 'CREATE' as const },
                { entityType: 'loans', entityId: 'L2', action: 'UPDATE' as const, oldData: { s: 1 }, newData: { s: 2 } }
            ];

            await service.logActions(paramsList);

            const logs = await database.get('action_logs').query().fetch() as any[];
            expect(logs.length).toBe(2);
            expect(logs.find(l => l.entityId === 'L2')?.oldData).toBe(JSON.stringify({ s: 1 }));
        });

        it('redacts bulky logo / base64 payloads before persisting action logs', async () => {
            const logo = `data:image/png;base64,${'A'.repeat(5000)}`;
            await service.logAction({
                entityType: 'app_settings',
                entityId: 'setting-brand-logo-base64',
                action: 'UPDATE',
                oldData: { key: 'brand.logo_base64', value: '' },
                newData: { key: 'brand.logo_base64', value: logo },
            });

            const logs = await database.get('action_logs').query().fetch() as any[];
            expect(logs.length).toBe(1);
            expect(logs[0].newData).not.toContain('data:image/png;base64,AAA');
            expect(logs[0].newData).toContain('[omitted:base64:');
            expect(logs[0].newData.length).toBeLessThan(500);
        });

        it('uses provided performedBy if available', async () => {
            await service.logAction({
                entityType: 'b', entityId: '1', action: 'DELETE' as const, performedBy: 'admin'
            });
            const logs = await database.get('action_logs').query().fetch() as any[];
            expect(logs[0].performedBy).toBe('admin');
        });

        it('uses "system" if getCurrentUserId returns null', async () => {
            (AuthService.getCurrentUserId as jest.Mock).mockResolvedValueOnce(null);
            await service.logAction({ entityType: 'e', entityId: 'sys', action: 'CREATE' as any });
            const logs = await database.get('action_logs').query().fetch() as any[];
            const log = logs.find(l => l.entityId === 'sys');
            expect(log.performedBy).toBe('system');
        });

        it('handles errors gracefully in logActions', async () => {
            const spy = jest.spyOn(database, 'write').mockImplementation(() => { throw new Error('Write Failed'); });
            await service.logAction({ entityType: 'e', entityId: '1', action: 'CREATE' as const });
            // Should not throw, should just catch and log
            expect(spy).toHaveBeenCalled();
        });

        it('returns early if database is not available', async () => {
             const brokenService = new ActionLogService(null as any);
             // Should not throw
             await brokenService.logAction({ entityType: 'e', entityId: '1', action: 'CREATE' as const });
        });

        it('handles missing collections', async () => {
             const mockDb = { get: jest.fn().mockReturnValue(null), write: jest.fn() } as any;
             const brokenService = new ActionLogService(mockDb);
             await brokenService.logAction({ entityType: 'e', entityId: '1', action: 'CREATE' as const });
             expect(mockDb.get).toHaveBeenCalled();
        });
    });

    describe('getLogs', () => {
        beforeEach(async () => {
            await database.write(async () => {
                const collection = database.get('action_logs');
                await database.batch(
                    collection.prepareCreate((l: any) => { l.entityType = 'type-A'; l.entityId = '1'; l.action = 'CREATE'; l.timestamp = 100; }),
                    collection.prepareCreate((l: any) => { l.entityType = 'type-B'; l.entityId = '2'; l.action = 'UPDATE'; l.timestamp = 200; }),
                    collection.prepareCreate((l: any) => { l.entityType = 'type-A'; l.entityId = '3'; l.action = 'DELETE'; l.timestamp = 300; })
                );
            });
        });

        it('returns all logs sorted by timestamp desc', async () => {
            const logs = await service.getLogs() as any[];
            expect(logs.length).toBe(3);
            expect(logs[0].entityId).toBe('3'); // Latest
            expect(logs[2].entityId).toBe('1'); // Oldest
        });

        it('filters logs by entityType', async () => {
            const logs = await service.getLogs(50, 'type-A') as any[];
            expect(logs.length).toBe(2);
            expect(logs.every(l => l.entityType === 'type-A')).toBe(true);
        });

        it('returns empty array on fetch error', async () => {
            jest.spyOn(database, 'get').mockImplementationOnce(() => {
                throw new Error('Fetch error');
            });
            const logs = await service.getLogs();
            expect(logs).toEqual([]);
        });

        it('limits the number of logs', async () => {
            const logs = await service.getLogs(1);
            expect(logs.length).toBe(1);
        });

        it('exposes an observable query for realtime audit trail updates', () => {
            const observable = service.observeLogs(100);
            expect(observable).toBeTruthy();
            expect(typeof observable?.subscribe).toBe('function');
        });

        it('handles errors in getLogs', async () => {
            jest.spyOn(database, 'get').mockImplementation(() => { throw new Error('Query Failed'); });
            const logs = await service.getLogs();
            expect(logs).toEqual([]);
        });

        it('returns empty if database is not available in getLogs', async () => {
             const brokenService = new ActionLogService(null as any);
             expect(await brokenService.getLogs()).toEqual([]);
        });
    });

    describe('Error Handling', () => {
        it('logs error when database is not initialized', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const uninitializedService = new (service.constructor as any)(null);
            
            // Accessing db property through a method
            await uninitializedService.getLogs();
            
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Database is not initialized!'), expect.anything(), expect.anything());
            consoleSpy.mockRestore();
        });

        it('handles error in logActions', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            jest.spyOn(database, 'write').mockRejectedValueOnce(new Error('Write error'));
            
            await service.logActions([{ entityType: 'Loan', entityId: '1', action: 'CREATE' as any }]);
            
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to log actions:'), expect.anything(), expect.anything());
            consoleSpy.mockRestore();
        });
    });
});
