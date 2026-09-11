import { SyncService } from '../SyncService';
import { createTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';
import { synchronize } from '@nozbe/watermelondb/sync';

jest.mock('@nozbe/watermelondb/sync', () => ({
    synchronize: jest.fn().mockResolvedValue(undefined),
}));

const createQueryBuilder = (result = { data: [], error: null }) => {
    const builder: any = {
        is: jest.fn(() => builder),
        not: jest.fn(() => builder),
        order: jest.fn(() => builder),
        gte: jest.fn(() => builder),
        lte: jest.fn(() => builder),
        eq: jest.fn(() => builder),
        in: jest.fn(() => builder),
        range: jest.fn().mockResolvedValue(result),
        then: (resolve: any) => resolve(result),
    };
    return builder;
};

// Mock supabase with a valid auth session so sync() doesn't bail out
const mockSupabase = {
    auth: {
        getSession: jest.fn().mockResolvedValue({
            data: { session: { user: { id: 'test-user-id' } } },
            error: null,
        }),
    },
    rpc: jest.fn().mockResolvedValue({ data: new Date().toISOString(), error: null }),
    from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
            is: jest.fn(() => createQueryBuilder()),
            not: jest.fn(() => createQueryBuilder()),
        }),
        upsert: jest.fn().mockResolvedValue({ error: null }),
    }),
};

// Mock the syncStore
jest.mock('../../stores/syncStore', () => ({
    useSyncStore: {
        getState: jest.fn().mockReturnValue({
            isOnline: true,
            lastSyncAt: null,
            setSyncProgress: jest.fn(),
            addLog: jest.fn(),
        }),
        setState: jest.fn(),
    },
}));

// Mock ErrorService
jest.mock('../ErrorService', () => ({
    ErrorService: {
        handleError: jest.fn((err: any) => err instanceof Error ? err : new Error(String(err))),
        getUserMessage: jest.fn((error: any, fallback?: string) => error?.message || fallback || 'Friendly error'),
    },
    ErrorType: { SYNC: 'sync' },
}));

// Mock PerformanceTracker
jest.mock('../../utils/PerformanceTracker', () => ({
    perf: {
        measure: jest.fn((_name: string, fn: () => any) => fn()),
    },
}));

describe('SyncService', () => {
    let database: Database;
    let service: SyncService;

    beforeEach(() => {
        database = createTestDatabase();
        service = new SyncService(database, mockSupabase as any);
        // Reset the isSyncing flag via the instance
        (service as any).isSyncing = false;
        jest.clearAllMocks();

        // Re-apply default mock returns after clearAllMocks
        mockSupabase.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: 'test-user-id' } } },
            error: null,
        });
        mockSupabase.rpc.mockResolvedValue({ data: new Date().toISOString(), error: null });
        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                is: jest.fn(() => createQueryBuilder()),
                not: jest.fn(() => createQueryBuilder()),
            }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
        });

        // Restore syncStore mock
        const { useSyncStore } = require('../../stores/syncStore');
        useSyncStore.getState.mockReturnValue({
            isOnline: true,
            lastSyncAt: null,
            setSyncProgress: jest.fn(),
            addLog: jest.fn(),
        });
    });

    afterEach(() => {
        delete (globalThis as any).window;
    });

    it('calls synchronize when online with valid session', async () => {
        await service.sync();
        expect(synchronize).toHaveBeenCalled();
    });

    it.each([
        'jetfarm.pages.dev',
        'f451061c.jetfarm.pages.dev',
    ])('uses real sync on Cloudflare project host %s', async (hostname) => {
        (globalThis as any).window = { location: { hostname, port: '' } };

        await service.sync(true);

        expect(mockSupabase.auth.getSession).toHaveBeenCalled();
        expect(synchronize).toHaveBeenCalled();
    });

    it('keeps unrelated Pages preview hosts in mock sync mode', async () => {
        (globalThis as any).window = { location: { hostname: 'example.pages.dev', port: '' } };

        await service.sync(true);

        expect(mockSupabase.auth.getSession).not.toHaveBeenCalled();
        expect(synchronize).not.toHaveBeenCalled();
    });

    it('skips sync when already syncing', async () => {
        const { useSyncStore } = require('../../stores/syncStore');
        const setSyncProgress = jest.fn();
        useSyncStore.getState.mockReturnValue({
            isOnline: true,
            lastSyncAt: null,
            setSyncProgress,
            addLog: jest.fn(),
        });
        (service as any).isSyncing = true;
        await service.sync();
        expect(synchronize).not.toHaveBeenCalled();
        expect(setSyncProgress).toHaveBeenCalledWith({
            currentModel: 'Sync already running',
        });
        expect(setSyncProgress).not.toHaveBeenCalledWith(expect.objectContaining({
            status: 'completed',
        }));
    });

    it('skips sync when device is offline and not forced', async () => {
        const { useSyncStore } = require('../../stores/syncStore');
        useSyncStore.getState.mockReturnValue({
            isOnline: false,
            lastSyncAt: null,
            setSyncProgress: jest.fn(),
            addLog: jest.fn(),
        });
        await service.sync();
        expect(synchronize).not.toHaveBeenCalled();
    });

    it('syncs when offline if force=true', async () => {
        const { useSyncStore } = require('../../stores/syncStore');
        useSyncStore.getState.mockReturnValue({
            isOnline: false,
            lastSyncAt: null,
            setSyncProgress: jest.fn(),
            addLog: jest.fn(),
        });
        await service.sync(true);
        expect(synchronize).toHaveBeenCalled();
    });

    it('skips sync when no active session', async () => {
        mockSupabase.auth.getSession.mockResolvedValue({
            data: { session: null },
            error: null,
        });
        await service.sync();
        expect(synchronize).not.toHaveBeenCalled();
    });

    it('throttles sync if last sync was recent', async () => {
        const { useSyncStore } = require('../../stores/syncStore');
        useSyncStore.getState.mockReturnValue({
            isOnline: true,
            lastSyncAt: new Date().toISOString(), // Just now
            setSyncProgress: jest.fn(),
            addLog: jest.fn(),
        });
        await service.sync();
        expect(synchronize).not.toHaveBeenCalled();
    });

    it('overrides throttle with force=true', async () => {
        const { useSyncStore } = require('../../stores/syncStore');
        useSyncStore.getState.mockReturnValue({
            isOnline: true,
            lastSyncAt: new Date().toISOString(), // Just now
            setSyncProgress: jest.fn(),
            addLog: jest.fn(),
        });
        await service.sync(true);
        expect(synchronize).toHaveBeenCalled();
    });

    it('bypasses recent-sync throttle for pending local changes', async () => {
        const { useSyncStore } = require('../../stores/syncStore');
        useSyncStore.getState.mockReturnValue({
            isOnline: true,
            lastSyncAt: new Date().toISOString(), // Just now
            setSyncProgress: jest.fn(),
            addLog: jest.fn(),
        });
        jest.spyOn(service, 'updatePendingCount').mockResolvedValue(1);

        await service.checkAndSync({ localChange: true, reason: 'unit-test' });

        expect(synchronize).toHaveBeenCalled();
    });

    it('does not bypass recent-sync throttle for local-change checks with no pending records', async () => {
        const { useSyncStore } = require('../../stores/syncStore');
        const setSyncProgress = jest.fn();
        useSyncStore.getState.mockReturnValue({
            isOnline: true,
            lastSyncAt: new Date().toISOString(), // Just now
            setSyncProgress,
            addLog: jest.fn(),
        });
        jest.spyOn(service, 'updatePendingCount').mockResolvedValue(0);

        await service.checkAndSync({ localChange: true, reason: 'unit-test' });

        expect(synchronize).not.toHaveBeenCalled();
        expect(setSyncProgress).toHaveBeenCalledWith(expect.objectContaining({
            currentModel: 'No pending changes',
        }));
    });

    it('handles sync errors gracefully', async () => {
        (synchronize as jest.Mock).mockRejectedValueOnce(new Error('Sync failed'));
        // Should not throw
        await service.sync();
    });

    it('ignores concurrent synchronization errors', async () => {
        (synchronize as jest.Mock).mockRejectedValueOnce(
            new Error('Concurrent synchronization is not allowed')
        );
        // Should not throw
        await service.sync();
    });

    it('updatePendingCount returns 0 for empty database', async () => {
        const count = await service.updatePendingCount();
        expect(count).toBe(0);
    });

    it('preserves bigint penalty_date values during pull sanitization', async () => {
        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                is: jest.fn(() => createQueryBuilder({
                        data: [{ id: 'penalty-1', penalty_date: '1712345678901' }],
                        error: null,
                    })),
                not: jest.fn(() => createQueryBuilder()),
            }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
        });

        const result = await (service as any).fetchTableChanges('loan_penalties', null);

        expect(result.updated).toHaveLength(1);
        expect(result.updated[0].penalty_date).toBe(1712345678901);
    });

    it('throws when a pull table fetch fails instead of returning empty changes', async () => {
        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                is: jest.fn(() => createQueryBuilder({
                    data: null,
                    error: { message: 'missing borrower_id' },
                })),
                not: jest.fn(() => createQueryBuilder()),
            }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
        });

        await expect((service as any).fetchTableChanges('payments', null))
            .rejects.toThrow('Failed to fetch payments');
    });

    it('shows a user-friendly sync error when session lookup fails', async () => {
        const { useSyncStore } = require('../../stores/syncStore');
        const setSyncProgress = jest.fn();
        useSyncStore.getState.mockReturnValue({
            isOnline: true,
            lastSyncAt: null,
            setSyncProgress,
            addLog: jest.fn(),
        });
        mockSupabase.auth.getSession.mockResolvedValue({
            data: { session: null },
            error: { message: 'Auth session missing!' },
        });

        await service.sync(true);

        expect(setSyncProgress).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
            currentModel: 'Session check failed',
            errorMessage: 'Auth session missing!',
        }));
        expect(synchronize).not.toHaveBeenCalled();
    });

    it('throws after a push table failure so WatermelonDB keeps local changes pending', async () => {
        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                is: jest.fn(() => createQueryBuilder()),
                not: jest.fn(() => createQueryBuilder()),
            }),
            upsert: jest.fn().mockResolvedValue({ error: { message: 'schema cache missing borrower_id' } }),
        });

        await expect((service as any).pushChangesToSupabase({
            payments: {
                created: [{ id: 'p1', amount: 100 }],
                updated: [],
                deleted: [],
            },
        })).rejects.toThrow('Push failed for 1 table');
    });

    it('returns rejected ids for rows changed remotely after lastPulledAt', async () => {
        const conflictQuery = createQueryBuilder({
            data: [{
                id: 'p1',
                updated_at: new Date('2026-05-11T10:00:01.000Z').toISOString(),
                deleted_at: null,
            }],
            error: null,
        });
        const upsert = jest.fn().mockResolvedValue({ error: null });
        mockSupabase.from.mockReturnValue({
            select: jest.fn(() => conflictQuery),
            upsert,
        });

        const rejectedIds = await (service as any).pushChangesToSupabase({
            payments: {
                created: [],
                updated: [{ id: 'p1', amount: 100 }],
                deleted: [],
            },
        }, new Date('2026-05-11T10:00:00.000Z').getTime());

        expect(rejectedIds).toEqual({ payments: ['p1'] });
        expect(upsert).not.toHaveBeenCalled();
    });
    it('pulls payments with all columns so borrower_id cannot regress out of the schema payload', async () => {
        const validBorrowerId = '11111111-1111-4111-8111-111111111111';
        const activeBuilder = createQueryBuilder({
            data: [{
                id: 'payment-1',
                loan_id: '22222222-2222-4222-8222-222222222222',
                borrower_id: validBorrowerId,
                amount: 250,
                payment_date: '2026-05-11T10:00:00.000Z',
                deleted_at: null,
                updated_at: '2026-05-11T10:00:00.000Z',
            }],
            error: null,
        });
        const deletedBuilder = createQueryBuilder({ data: [], error: null });
        const select = jest.fn().mockReturnValue({
            is: jest.fn(() => activeBuilder),
            not: jest.fn(() => deletedBuilder),
        });
        mockSupabase.from.mockReturnValue({
            select,
            upsert: jest.fn().mockResolvedValue({ error: null }),
        });

        const result = await (service as any).fetchTableChanges('payments', null);

        expect(mockSupabase.from).toHaveBeenCalledWith('app_payments');
        expect(select).toHaveBeenCalledWith('*');
        expect(result.updated).toHaveLength(1);
        expect(result.updated[0].borrower_id).toBe(validBorrowerId);
        expect(typeof result.updated[0].payment_date).toBe('number');
    });

    it('skips optional settings tables when the remote migration is not applied yet', async () => {
        const missingTableError = {
            code: 'PGRST205',
            status: 404,
            message: "Could not find the table 'public.app_feature_flags' in the schema cache",
        };
        const activeBuilder = createQueryBuilder({ data: null, error: missingTableError });
        const select = jest.fn().mockReturnValue({
            is: jest.fn(() => activeBuilder),
            not: jest.fn(() => createQueryBuilder()),
        });
        mockSupabase.from.mockReturnValue({
            select,
            upsert: jest.fn().mockResolvedValue({ error: null }),
        });

        const { ErrorService } = require('../ErrorService');
        const result = await (service as any).fetchTableChanges('feature_flags', null);

        expect(result).toEqual({ created: [], updated: [], deleted: [] });
        expect(ErrorService.handleError).not.toHaveBeenCalled();
    });

    it('keeps optional settings changes pending when their remote table is missing', async () => {
        const upsert = jest.fn().mockResolvedValue({
            error: {
                code: 'PGRST205',
                status: 404,
                message: "Could not find the table 'public.app_feature_flags' in the schema cache",
            },
        });
        mockSupabase.from.mockReturnValue({
            select: jest.fn(() => createQueryBuilder()),
            upsert,
        });

        const rejectedIds = await (service as any).pushChangesToSupabase({
            feature_flags: {
                created: [{ id: 'feature-dashboard', key: 'dashboard', enabled: true }],
                updated: [],
                deleted: [],
            },
        });

        expect(rejectedIds).toEqual({ feature_flags: ['feature-dashboard'] });
    });

    it('sanitizes invalid payment borrower_id values before pushing to Supabase', () => {
        const validLoanId = '22222222-2222-4222-8222-222222222222';

        const sanitized = (service as any).sanitizeRecord({
            id: 'payment-1',
            loan_id: validLoanId,
            borrower_id: 'not-a-valid-uuid',
            payment_date: Date.UTC(2026, 4, 11),
            _status: 'created',
            _changed: 'borrower_id,payment_date',
        }, 'payments');

        expect(sanitized.borrower_id).toBeNull();
        expect(sanitized.loan_id).toBe(validLoanId);
        expect(sanitized.payment_date).toBe('2026-05-11T00:00:00.000Z');
        expect(sanitized).not.toHaveProperty('_status');
        expect(sanitized).not.toHaveProperty('_changed');
    });

    it('preserves non-UUID entity_id and performed_by strings for action_logs and defaults missing ones to system', () => {
        const sanitizedNonUuid = (service as any).sanitizeRecord({
            id: 'log-1',
            entity_type: 'app_settings',
            entity_id: 'system_config',
            action: 'UPDATE',
            performed_by: 'admin-username',
            timestamp: 1600000000000,
        }, 'action_logs');

        expect(sanitizedNonUuid.entity_id).toBe('system_config');
        expect(sanitizedNonUuid.entity_type).toBe('app_settings');
        expect(sanitizedNonUuid.performed_by).toBe('admin-username');

        const bulkyLogo = `data:image/png;base64,${'Q'.repeat(6000)}`;
        const sanitizedBulkyLog = (service as any).sanitizeRecord({
            id: 'log-heavy',
            entity_type: 'app_settings',
            entity_id: 'setting-brand-logo-base64',
            action: 'UPDATE',
            performed_by: 'admin',
            old_data: JSON.stringify({ key: 'brand.logo_base64', value: '' }),
            new_data: JSON.stringify({ key: 'brand.logo_base64', value: bulkyLogo }),
            timestamp: 1600000000000,
        }, 'action_logs');
        expect(sanitizedBulkyLog.new_data).not.toContain('data:image/png;base64,QQQ');
        expect(sanitizedBulkyLog.new_data).toContain('[omitted:base64:');

        const sanitizedLogoSetting = (service as any).sanitizeRecord({
            id: 'setting-brand-logo-base64',
            key: 'brand.logo_base64',
            value: bulkyLogo,
            updated_at: 1600000000000,
        }, 'app_settings');
        expect(sanitizedLogoSetting.value).toBe('');

        const sanitizedEmpty = (service as any).sanitizeRecord({
            id: 'log-2',
            entity_type: '',
            entity_id: null,
            action: 'UPDATE',
            performed_by: null,
            timestamp: 1600000000000,
        }, 'action_logs');

        expect(sanitizedEmpty.entity_id).toBe('system');
        expect(sanitizedEmpty.entity_type).toBe('system');
        expect(sanitizedEmpty.performed_by).toBe('system');
    });

    it('pushes soft deletes with updated_at so later pulls can observe the deletion', async () => {
        const upsert = jest.fn().mockResolvedValue({ error: null });
        mockSupabase.from.mockReturnValue({
            select: jest.fn(() => createQueryBuilder()),
            upsert,
        });

        await (service as any).pushChangesToSupabase({
            payments: {
                created: [],
                updated: [],
                deleted: ['payment-1'],
            },
        });

        expect(mockSupabase.from).toHaveBeenCalledWith('app_payments');
        expect(upsert).toHaveBeenCalledWith([expect.objectContaining({
            id: 'payment-1',
            deleted_at: expect.any(String),
            updated_at: expect.any(String),
        })]);
    });

    it('rejects local deletes when the remote row changed after lastPulledAt', async () => {
        const conflictQuery = createQueryBuilder({
            data: [{
                id: 'payment-1',
                updated_at: '2026-05-11T10:00:01.000Z',
                deleted_at: null,
            }],
            error: null,
        });
        const upsert = jest.fn().mockResolvedValue({ error: null });
        mockSupabase.from.mockReturnValue({
            select: jest.fn(() => conflictQuery),
            upsert,
        });

        const rejectedIds = await (service as any).pushChangesToSupabase({
            payments: {
                created: [],
                updated: [],
                deleted: ['payment-1'],
            },
        }, new Date('2026-05-11T10:00:00.000Z').getTime());

        expect(rejectedIds).toEqual({ payments: ['payment-1'] });
        expect(upsert).not.toHaveBeenCalled();
    });

    it('checkAndSync calls sync and updatePendingCount', async () => {
        const syncSpy = jest.spyOn(service, 'sync').mockResolvedValue();
        const pendingSpy = jest.spyOn(service, 'updatePendingCount').mockResolvedValue(0);
        await service.checkAndSync();
        expect(syncSpy).toHaveBeenCalled();
        expect(pendingSpy).toHaveBeenCalled();
    });

    it('checkAndSync skips if already syncing', async () => {
        (service as any).isSyncing = true;
        const syncSpy = jest.spyOn(service, 'sync');
        await service.checkAndSync();
        expect(syncSpy).not.toHaveBeenCalled();
    });

    it('retries synchronize on network error and succeeds on third attempt', async () => {
        const mockSync = synchronize as jest.Mock;
        mockSync
            .mockRejectedValueOnce(new Error('Network error'))
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValueOnce(undefined);

        (service as any).isSyncing = false;
        await service.sync(true);
        expect(mockSync).toHaveBeenCalledTimes(3);
    });

    it('prevents concurrent sync calls from running synchronize twice', async () => {
        const mockSync = synchronize as jest.Mock;
        mockSync.mockResolvedValue(undefined);
        (service as any).isSyncing = false;

        // Fire two concurrent syncs
        const [p1, p2] = [service.sync(true), service.sync(true)];
        await Promise.all([p1, p2]);

        // synchronize should only have been called once (second call bails on isSyncing guard)
        expect(mockSync.mock.calls.length).toBeLessThanOrEqual(1);
    });

    it('logs post-sync integrity warning when unsync\'d loan records remain', async () => {
        const mockSync = synchronize as jest.Mock;
        mockSync.mockResolvedValue(undefined);
        (service as any).isSyncing = false;

        // Mock the loans collection to return 2 unsync'd records
        const mockFetchCount = jest.fn().mockResolvedValue(2);
        const mockQuery = jest.fn().mockReturnValue({ fetchCount: mockFetchCount });
        const mockGet = jest.fn().mockReturnValue({ query: mockQuery });
        (service as any).db = { collections: { get: mockGet } };

        const { ErrorService } = require('../ErrorService');
        await service.sync(true);

        expect(ErrorService.handleError).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('unsync\'d loan records remain') }),
            'SyncService.integrityCheck',
            expect.anything()
        );
    });

    it('sanitizes empty string UUID and _by fields to null before pushing', () => {
        const record = {
            id: '11111111-2222-3333-4444-555555555555',
            collector_id: '',
            area_id: '   ',
            auth_id: 'invalid-uuid',
            created_by: '',
            approved_by: '   ',
            recorded_by: 'not-a-uuid',
            full_name: 'John Doe',
        };
        const sanitized = (service as any).sanitizeRecord(record, 'borrowers');
        expect(sanitized.collector_id).toBeNull();
        expect(sanitized.area_id).toBeNull();
        expect(sanitized.auth_id).toBeNull();
        expect(sanitized.created_by).toBeNull();
        expect(sanitized.approved_by).toBeNull();
        expect(sanitized.recorded_by).toBeNull();
        expect(sanitized.full_name).toBe('John Doe');
    });

    it('uses primary key id default upsert when pushing chart_of_accounts', async () => {
        const upsert = jest.fn().mockResolvedValue({ error: null });
        const from = jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({ data: [], error: null })
            }),
            upsert,
        });
        (service as any).supabase = { from };

        await (service as any).pushChangesToSupabase({
            chart_of_accounts: {
                created: [{ id: '11111111-1111-1111-1111-111111111111', code: '1000', name: 'Assets' }],
                updated: [],
                deleted: [],
            },
        });

        expect(upsert).toHaveBeenCalledWith(
            expect.any(Array),
            undefined
        );
    });
});

