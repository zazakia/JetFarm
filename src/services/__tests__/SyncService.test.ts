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

    // Retargeted 2026-10-20 from loan_penalties.penalty_date (lending domain retired).
    // The BIGINT-preservation invariant now belongs to the block-layout tables, but
    // agri_parcel_blocks / agri_block_assignments / agri_block_progress are in
    // DEFERRED_LAYOUT_TABLES, so fetchTableChanges short-circuits before the row-mapping
    // loop and they can never be pull-sanitized generically. The invariant is therefore
    // pinned on the reachable half of the contract: the push-side sanitizer (sanitizeRecord)
    // must leave declared BIGINT timestamps numeric instead of ISO-ifying them.
    it('preserves bigint block-layout timestamps when preparing a push payload', () => {
        const updateDate = 1712345678901;

        const sanitized = (service as any).sanitizeRecord({
            id: '11111111-1111-4111-8111-111111111111',
            assignment_id: '22222222-2222-4222-8222-222222222222',
            update_date: updateDate,
            created_at: updateDate,
            progress_percent: 45,
        }, 'agri_block_progress');

        expect(sanitized.update_date).toBe(updateDate);
        expect(sanitized.created_at).toBe(updateDate);
        expect(typeof sanitized.updated_at).toBe('number');
        expect(sanitized.assignment_id).toBe('22222222-2222-4222-8222-222222222222');
    });

    it('converts pulled ISO timestamps to epoch milliseconds for surviving finance tables', async () => {
        const validEncodedBy = '11111111-1111-4111-8111-111111111111';
        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                is: jest.fn(() => createQueryBuilder({
                        data: [{
                            id: 'expense-1',
                            encoded_by: validEncodedBy,
                            expense_date: '2026-05-11T10:00:00.000Z',
                        }],
                        error: null,
                    })),
                not: jest.fn(() => createQueryBuilder()),
            }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
        });

        const result = await (service as any).fetchTableChanges('expenses', null);

        expect(result.updated).toHaveLength(1);
        expect(result.updated[0].expense_date).toBe(Date.UTC(2026, 4, 11, 10, 0, 0));
        expect(result.updated[0].encoded_by).toBe(validEncodedBy);
    });

    it('throws when a pull table fetch fails instead of returning empty changes', async () => {
        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                is: jest.fn(() => createQueryBuilder({
                    data: null,
                    error: { message: 'missing area_id' },
                })),
                not: jest.fn(() => createQueryBuilder()),
            }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
        });

        await expect((service as any).fetchTableChanges('expenses', null))
            .rejects.toThrow('Failed to fetch expenses');
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
            upsert: jest.fn().mockResolvedValue({ error: { message: 'violates not-null column area_id' } }),
        });

        await expect((service as any).pushChangesToSupabase({
            expenses: {
                created: [{ id: 'e1', amount: 100 }],
                updated: [],
                deleted: [],
            },
        })).rejects.toThrow('Push failed for 1 table');
    });

    it('returns rejected ids for rows changed remotely after lastPulledAt', async () => {
        const conflictQuery = createQueryBuilder({
            data: [{
                id: 'c1',
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
            cash_transactions: {
                created: [],
                updated: [{ id: 'c1', amount: 100 }],
                deleted: [],
            },
        }, new Date('2026-05-11T10:00:00.000Z').getTime());

        expect(rejectedIds).toEqual({ cash_transactions: ['c1'] });
        expect(upsert).not.toHaveBeenCalled();
    });
    it('pulls expenses with all columns so the local-to-remote table mapping cannot regress out of the schema payload', async () => {
        const validEncodedBy = '11111111-1111-4111-8111-111111111111';
        const activeBuilder = createQueryBuilder({
            data: [{
                id: 'expense-1',
                category: 'Farm Inputs',
                encoded_by: validEncodedBy,
                bank_account_id: '22222222-2222-4222-8222-222222222222',
                amount: 250,
                expense_date: '2026-05-11T10:00:00.000Z',
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

        const result = await (service as any).fetchTableChanges('expenses', null);

        expect(mockSupabase.from).toHaveBeenCalledWith('app_expenses');
        expect(select).toHaveBeenCalledWith('*');
        expect(result.updated).toHaveLength(1);
        expect(result.updated[0].encoded_by).toBe(validEncodedBy);
        expect(result.updated[0].bank_account_id).toBe('22222222-2222-4222-8222-222222222222');
        expect(typeof result.updated[0].expense_date).toBe('number');
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

    // Retargeted 2026-10-20 from payments.borrower_id (retired lending table). The invariant
    // "an invalid UUID in a FK column is nullified, not silently pushed" is carried by
    // expenses/app_expenses, whose bank_account_id is a real UUID_FK_FIELD.
    it('sanitizes invalid expense bank_account_id values before pushing to Supabase', () => {
        const validEncodedBy = '11111111-1111-4111-8111-111111111111';

        const sanitized = (service as any).sanitizeRecord({
            id: 'expense-1',
            encoded_by: validEncodedBy,
            bank_account_id: 'not-a-valid-uuid',
            expense_date: Date.UTC(2026, 4, 11),
            _status: 'created',
            _changed: 'bank_account_id,expense_date',
        }, 'expenses');

        expect(sanitized.bank_account_id).toBeNull();
        expect(sanitized.encoded_by).toBe(validEncodedBy);
        expect(sanitized.expense_date).toBe('2026-05-11T00:00:00.000Z');
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
            cash_transactions: {
                created: [],
                updated: [],
                deleted: ['cash-1'],
            },
        });

        expect(mockSupabase.from).toHaveBeenCalledWith('app_cash_transactions');
        expect(upsert).toHaveBeenCalledWith([expect.objectContaining({
            id: 'cash-1',
            deleted_at: expect.any(String),
            updated_at: expect.any(String),
        })]);
    });

    it('rejects local deletes when the remote row changed after lastPulledAt', async () => {
        const conflictQuery = createQueryBuilder({
            data: [{
                id: 'cash-1',
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
            cash_transactions: {
                created: [],
                updated: [],
                deleted: ['cash-1'],
            },
        }, new Date('2026-05-11T10:00:00.000Z').getTime());

        expect(rejectedIds).toEqual({ cash_transactions: ['cash-1'] });
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

    it('logs post-sync integrity warning when unsync\'d journal entries remain', async () => {
        const mockSync = synchronize as jest.Mock;
        mockSync.mockResolvedValue(undefined);
        (service as any).isSyncing = false;

        // Mock the journal_entries collection to return 2 unsync'd records
        const mockFetchCount = jest.fn().mockResolvedValue(2);
        const mockQuery = jest.fn().mockReturnValue({ fetchCount: mockFetchCount });
        const mockGet = jest.fn().mockReturnValue({ query: mockQuery });
        (service as any).db = { collections: { get: mockGet } };

        const { ErrorService } = require('../ErrorService');
        await service.sync(true);

        expect(ErrorService.handleError).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining('unsync\'d journal entries remain') }),
            'SyncService.integrityCheck',
            expect.anything()
        );
    });

    it('sanitizes empty string UUID and _by fields to null before pushing', () => {
        const record = {
            id: '11111111-2222-3333-4444-555555555555',
            land_owner_id: '',
            area_id: '   ',
            parcel_id: 'invalid-uuid',
            created_by: '',
            approved_by: '   ',
            recorded_by: 'not-a-uuid',
            name: 'Parcel A',
        };
        const sanitized = (service as any).sanitizeRecord(record, 'agri_parcels');
        expect(sanitized.land_owner_id).toBeNull();
        expect(sanitized.area_id).toBeNull();
        expect(sanitized.parcel_id).toBeNull();
        expect(sanitized.created_by).toBeNull();
        expect(sanitized.approved_by).toBeNull();
        expect(sanitized.recorded_by).toBeNull();
        expect(sanitized.name).toBe('Parcel A');
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

    it('converts agri timestamptz dates to ISO strings on push and epoch ms on pull', async () => {
        const epoch = 1712345678901;
        const iso = new Date(epoch).toISOString();

        // Push sanitization
        const pushRecord = (service as any).sanitizeRecord({
            id: 'cycle-1',
            planting_date: epoch,
            target_harvest_date: epoch,
            actual_harvest_date: epoch,
        }, 'agri_crop_cycles');
        expect(pushRecord.planting_date).toBe(iso);
        expect(pushRecord.target_harvest_date).toBe(iso);
        expect(pushRecord.actual_harvest_date).toBe(iso);

        // Weekly settlement push sanitization
        const pushSettlement = (service as any).sanitizeRecord({
            id: 'settlement-1',
            week_start_date: epoch,
            week_end_date: epoch,
            disbursement_date: epoch,
        }, 'agri_weekly_settlements');
        expect(pushSettlement.week_start_date).toBe(iso);
        expect(pushSettlement.week_end_date).toBe(iso);
        expect(pushSettlement.disbursement_date).toBe(iso);

        // Growth checkin push sanitization
        const pushCheckin = (service as any).sanitizeRecord({
            id: 'checkin-1',
            checkin_date: epoch,
        }, 'agri_growth_checkins');
        expect(pushCheckin.checkin_date).toBe(iso);

        // Harvest log push sanitization
        const pushHarvest = (service as any).sanitizeRecord({
            id: 'harvest-1',
            harvest_date: epoch,
        }, 'agri_harvest_logs');
        expect(pushHarvest.harvest_date).toBe(iso);

        // Labor log push sanitization
        const pushLabor = (service as any).sanitizeRecord({
            id: 'labor-1',
            work_date: epoch,
        }, 'agri_labor_logs');
        expect(pushLabor.work_date).toBe(iso);

        // Pull conversion
        mockSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnValue({
                is: jest.fn(() => createQueryBuilder({
                    data: [{
                        id: 'cycle-1',
                        planting_date: iso,
                        target_harvest_date: iso,
                        actual_harvest_date: iso,
                    }],
                    error: null,
                })),
                not: jest.fn(() => createQueryBuilder()),
            }),
        });

        const pullResult = await (service as any).fetchTableChanges('agri_crop_cycles', null);
        expect(pullResult.updated[0].planting_date).toBe(epoch);
        expect(pullResult.updated[0].target_harvest_date).toBe(epoch);
        expect(pullResult.updated[0].actual_harvest_date).toBe(epoch);
    });

    it('preserves non-uuid text fields paid_by and submission_id without nullifying', () => {
        const expense = (service as any).sanitizeRecord({
            id: '11111111-2222-3333-4444-555555555555',
            paid_by: 'jet',
            amount: 5000,
        }, 'agri_farm_expenses');
        expect(expense.paid_by).toBe('jet');

        const assignment = (service as any).sanitizeRecord({
            id: '11111111-2222-3333-4444-555555555555',
            submission_id: 'sub-assignment-1234',
        }, 'agri_block_assignments');
        expect(assignment.submission_id).toBe('sub-assignment-1234');
    });

    it('aligns chart_of_accounts record id to existing remote row when account code matches', async () => {
        const upsert = jest.fn().mockResolvedValue({ error: null });
        const from = jest.fn().mockImplementation((table) => ({
            select: jest.fn().mockImplementation(() => ({
                in: jest.fn().mockImplementation(() => ({
                    is: jest.fn().mockResolvedValue({
                        data: table === 'chart_of_accounts' ? [{ id: 'server-coa-id-9999', code: '1000' }] : [],
                        error: null,
                    }),
                    range: jest.fn().mockResolvedValue({ data: [], error: null }),
                    then: (resolve) => resolve({ data: [], error: null }),
                })),
            })),
            upsert,
        }));
        (service as any).supabase = { from };

        await (service as any).pushChangesToSupabase({
            chart_of_accounts: {
                created: [{ id: 'local-coa-id-1111', code: '1000', name: 'Assets' }],
                updated: [],
                deleted: [],
            },
        });

        expect(upsert).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'server-coa-id-9999',
                    code: '1000',
                }),
            ]),
            undefined
        );
    });
});

