import { synchronize } from '@nozbe/watermelondb/sync';
import { SyncService } from '../SyncService';
import { DefaultSyncAuditStorage } from '../SyncAuditLogService';
import { assertAgriDatabaseUsable } from '../AgriWriteSafety';

jest.mock('@nozbe/watermelondb/sync', () => ({
    synchronize: jest.fn(),
}));

jest.mock('../../database', () => ({
    database: {},
}));

jest.mock('../../database/supabase', () => ({
    supabase: {},
    withTimeout: jest.fn((promise: Promise<unknown>) => Promise.resolve(promise)),
}));

jest.mock('../../stores/syncStore', () => ({
    useSyncStore: {
        getState: jest.fn(),
        setState: jest.fn(),
    },
}));

jest.mock('../ErrorService', () => ({
    ErrorService: {
        handleError: jest.fn((error: any, context?: string, defaultType: any = 'sync') => ({
            type: defaultType,
            message: error?.message || String(error),
            originalError: error,
            context,
        })),
        getUserMessage: jest.fn((error: any, fallback?: string) =>
            error?.message || fallback || 'Unknown sync error'
        ),
    },
    ErrorType: { SYNC: 'sync' },
}));

jest.mock('../../utils/PerformanceTracker', () => ({
    perf: {
        measure: jest.fn((_name: string, operation: () => unknown) => operation()),
    },
}));

const EMPTY_CHANGES = { created: [], updated: [], deleted: [] };

function createQueryBuilder(result: { data: unknown; error: unknown }) {
    const builder: any = {
        is: jest.fn(() => builder),
        not: jest.fn(() => builder),
        order: jest.fn(() => builder),
        gte: jest.fn(() => builder),
        range: jest.fn().mockResolvedValue(result),
    };
    return builder;
}

describe('SyncService pull failure regressions', () => {
    let service: SyncService;
    let mockSetSyncProgress: jest.Mock;
    let mockAddLog: jest.Mock;
    let mockSupabase: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockSetSyncProgress = jest.fn();
        mockAddLog = jest.fn();
        const { useSyncStore } = require('../../stores/syncStore');
        useSyncStore.getState.mockReturnValue({
            isOnline: true,
            lastSyncAt: null,
            setSyncProgress: mockSetSyncProgress,
            addLog: mockAddLog,
        });

        mockSupabase = {
            auth: {
                getSession: jest.fn().mockResolvedValue({
                    data: { session: { user: { id: 'sync-regression-user' } } },
                    error: null,
                }),
            },
            rpc: jest.fn().mockResolvedValue({
                data: '2026-07-14T00:00:00.000Z',
                error: null,
            }),
            from: jest.fn(),
        };

        const mockDatabase = {
            collections: {
                get: jest.fn(() => ({
                    query: jest.fn(() => ({
                        fetchCount: jest.fn().mockResolvedValue(0),
                    })),
                })),
            },
        };

        service = new SyncService(mockDatabase as any, mockSupabase);
        jest.spyOn(service, 'updatePendingCount').mockResolvedValue(0);
        (synchronize as jest.Mock).mockResolvedValue(undefined);

        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // 2026-10-20 agribusiness-only teardown: every retired-table name below (payments, loans,
    // borrowers, file_cases, dependents) was retargeted onto surviving contract tables -
    // expenses/app_expenses, cash_transactions/app_cash_transactions, journal_entries and the
    // agri block-layout tables. Same invariants, reachable subjects.
    it('rejects a required table schema-cache failure instead of treating it as empty changes', async () => {
        const schemaError = {
            code: 'PGRST205',
            status: 404,
            message: "Could not find the table 'public.app_expenses' in the schema cache",
        };
        const query = createQueryBuilder({ data: null, error: schemaError });
        mockSupabase.from.mockReturnValue({
            select: jest.fn(() => query),
        });

        await expect((service as any).fetchTableChanges('expenses', null)).rejects.toEqual(
            expect.objectContaining({ originalError: expect.objectContaining({ message: expect.stringMatching(/schema cache/i) }) })
        );
    });

    it('classifies PostgREST missing-table failures as schema/configuration errors, not connection errors', () => {
        const message = (service as any).buildPullFailureMessage(1, [
            "expenses: PGRST205 Could not find the table 'public.app_expenses' in the schema cache",
        ]);

        expect(message).toMatch(/schema|configuration/i);
        expect(message).not.toMatch(/connection problem/i);
    });

    it('classifies PostgreSQL invalid text representations as schema/type mismatches', () => {
        const message = (service as any).buildPullFailureMessage(1, [
            'agri_block_progress: 22P02 invalid input syntax for type bigint: "2026-07-15T08:21:41.429Z"',
        ]);

        expect(message).toMatch(/schema|configuration/i);
        expect(message).toContain('agri_block_progress');
        expect(message).not.toMatch(/connection problem/i);
    });

    it('rejects a partial pull with every failed required table identified', async () => {
        let pullChanges: ((args: { lastPulledAt: number | null }) => Promise<unknown>) | undefined;
        (synchronize as jest.Mock).mockImplementationOnce(async (options: any) => {
            pullChanges = options.pullChanges;
        });

        await service.sync(true);
        expect(pullChanges).toBeDefined();

        jest.spyOn(service as any, 'fetchTableChanges').mockImplementation((tableName: string) => {
            if (tableName === 'journal_entries') {
                return Promise.reject(new Error('permission denied by row-level security'));
            }
            if (tableName === 'expenses') {
                return Promise.reject(new Error('PGRST205 table missing from schema cache'));
            }
            return Promise.resolve(EMPTY_CHANGES);
        });

        let pullError: Error | undefined;
        try {
            await pullChanges!({ lastPulledAt: Date.UTC(2026, 6, 14) });
        } catch (error) {
            pullError = error as Error;
        }

        expect(pullError).toBeDefined();
        expect(pullError?.message).toContain('journal_entries');
        expect(pullError?.message).toContain('expenses');
        expect(mockAddLog).toHaveBeenCalledWith(expect.objectContaining({
            type: 'error',
            message: 'Pull failed: journal_entries',
        }));
        expect(mockAddLog).toHaveBeenCalledWith(expect.objectContaining({
            type: 'error',
            message: 'Pull failed: expenses',
        }));
    });

    it('leaves completion time untouched, reports error status, and releases the lock after pull failure', async () => {
        (synchronize as jest.Mock).mockRejectedValue(
            new Error('Required pull table expenses failed: PGRST205 schema cache')
        );

        await service.sync(true);

        expect(mockSetSyncProgress).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
        }));
        expect(mockSetSyncProgress).not.toHaveBeenCalledWith(expect.objectContaining({
            status: 'completed',
        }));
        expect(mockSetSyncProgress).not.toHaveBeenCalledWith(expect.objectContaining({
            lastSyncAt: expect.anything(),
        }));
        expect(service.updatePendingCount).not.toHaveBeenCalled();
        expect((service as any).isSyncing).toBe(false);
    });

    // The former `dependents` / `file_cases` cursor tests pinned that BIGINT-backed columns are
    // queried as epoch milliseconds. On this branch the only BIGINT-backed tables are the block
    // layout tables, and they are in DEFERRED_LAYOUT_TABLES: fetchTableChanges returns empty
    // changes for them before building any query (asserted below), so the numeric-cursor
    // behaviour is pinned at the helpers fetchTableChanges itself uses.
    it('uses numeric incremental cursors for BIGINT-backed block layout timestamps', () => {
        const lastSyncDate = '2026-07-14T00:00:00.000Z';
        const cursorMs = Date.parse(lastSyncDate);

        expect((service as any).getRemoteCursorValue('agri_block_assignments', 'updated_at', lastSyncDate))
            .toBe(cursorMs);
        expect((service as any).getRemoteCursorValue('agri_block_assignments', 'start_date', lastSyncDate))
            .toBe(cursorMs);
        expect((service as any).getRemoteCursorValue('agri_block_assignments', 'due_date', lastSyncDate))
            .toBe(cursorMs);
        expect((service as any).getRemoteCursorValue('agri_parcel_blocks', 'deleted_at', lastSyncDate))
            .toBe(cursorMs);

        // A table without declared BIGINT columns keeps the ISO cursor, so a widening of
        // TABLE_BIGINT_FIELDS cannot quietly turn every cursor numeric.
        expect((service as any).getRemoteCursorValue('expenses', 'updated_at', lastSyncDate))
            .toBe(lastSyncDate);
    });

    it('uses numeric upper-bound timestamps for BIGINT-backed audit payloads', () => {
        const watermark = '2026-07-14T00:00:00.000Z';
        const watermarkMs = Date.parse(watermark);

        expect((service as any).getRemoteCursorValue('agri_block_progress', 'update_date', watermark))
            .toBe(watermarkMs);
        expect((service as any).getRemoteCursorValue('agri_block_progress', 'created_at', watermark))
            .toBe(watermarkMs);
        expect((service as any).getRemoteCursorValue('agri_block_progress', 'updated_at', watermark))
            .toBe(watermarkMs);
        expect((service as any).getRemoteCursorValue('cash_transactions', 'updated_at', watermark))
            .toBe(watermark);
    });

    it('defers the BIGINT-backed block layout tables from any generic pull query', async () => {
        const from = jest.fn();
        mockSupabase.from.mockReturnValue(from);

        const lastSyncDate = '2026-07-14T00:00:00.000Z';
        for (const tableName of ['agri_parcel_blocks', 'agri_block_assignments', 'agri_block_progress']) {
            await expect((service as any).fetchTableChanges(tableName, lastSyncDate))
                .resolves.toEqual(EMPTY_CHANGES);
        }
        expect(from).not.toHaveBeenCalled();
    });

    it('keeps block layout timestamps numeric when preparing an upsert', () => {
        jest.spyOn(Date, 'now').mockReturnValue(1_789_000_000_000);

        const sanitized = (service as any).sanitizeRecord({
            id: '00000000-0000-4000-8000-000000000001',
            update_date: 1_788_000_000_000,
            created_at: 1_788_000_000_000,
            updated_at: 1_788_000_000_000,
            deleted_at: null,
        }, 'agri_block_progress');

        expect(sanitized).toEqual(expect.objectContaining({
            update_date: 1_788_000_000_000,
            created_at: 1_788_000_000_000,
            updated_at: 1_789_000_000_000,
            deleted_at: null,
        }));
    });

    it('uses numeric timestamps for BIGINT-backed soft deletes', () => {
        const deletedMs = 1_789_000_000_000;

        // Soft-delete payloads are built with getRemoteTimestampValue; the block layout tables
        // must keep epoch milliseconds while every synced finance table stays ISO.
        expect((service as any).getRemoteTimestampValue('agri_parcel_blocks', 'deleted_at', deletedMs))
            .toBe(deletedMs);
        expect((service as any).getRemoteTimestampValue('agri_block_assignments', 'updated_at', deletedMs))
            .toBe(deletedMs);
        expect((service as any).getRemoteTimestampValue('expenses', 'deleted_at', deletedMs))
            .toBe('2026-09-10T00:26:40.000Z');
    });

    it('compares stringified BIGINT conflict timestamps as epoch milliseconds', async () => {
        const lastPulledAt = 1_789_000_000_000;
        const inQuery = jest.fn().mockResolvedValue({
            data: [{
                id: '00000000-0000-4000-8000-000000000001',
                updated_at: String(lastPulledAt + 1),
                deleted_at: null,
            }],
            error: null,
        });
        mockSupabase.from.mockReturnValue({
            select: jest.fn(() => ({ in: inQuery })),
        });

        const conflicts = await (service as any).findConflictingRemoteIds(
            'agri_block_progress',
            [{ id: '00000000-0000-4000-8000-000000000001' }],
            lastPulledAt
        );

        expect(conflicts).toEqual(new Set(['00000000-0000-4000-8000-000000000001']));
    });

    it('caps active and deleted pulls at the server watermark', async () => {
        const query = createQueryBuilder({ data: [], error: null });
        query.lte = jest.fn(() => query);
        mockSupabase.from.mockReturnValue({
            select: jest.fn(() => query),
        });

        const lastSyncDate = '2026-07-13T00:00:00.000Z';
        const serverWatermark = '2026-07-14T00:00:00.000Z';
        await (service as any).fetchTableChanges('expenses', lastSyncDate, serverWatermark);

        expect(query.lte).toHaveBeenCalledWith('updated_at', serverWatermark);
        expect(query.lte).toHaveBeenCalledWith('deleted_at', serverWatermark);
    });

    it('pulls every row across a 1000-row page boundary with identical timestamps', async () => {
        const timestamp = '2026-07-13T12:00:00.000Z';
        const firstPage = Array.from({ length: 1000 }, (_, index) => ({
            id: `expense-${String(index).padStart(4, '0')}`,
            updated_at: timestamp,
            deleted_at: null,
        }));
        const finalPage = [{ id: 'expense-1000', updated_at: timestamp, deleted_at: null }];
        const activeQuery = createQueryBuilder({ data: [], error: null });
        activeQuery.lte = jest.fn(() => activeQuery);
        activeQuery.range
            .mockResolvedValueOnce({ data: firstPage, error: null })
            .mockResolvedValueOnce({ data: finalPage, error: null });
        const deletedQuery = createQueryBuilder({ data: [], error: null });
        deletedQuery.lte = jest.fn(() => deletedQuery);
        mockSupabase.from.mockReturnValue({
            select: jest.fn()
                .mockReturnValueOnce(activeQuery)
                .mockReturnValueOnce(activeQuery)
                .mockReturnValueOnce(deletedQuery),
        });

        const changes = await (service as any).fetchTableChanges(
            'expenses',
            null,
            '2026-07-14T00:00:00.000Z'
        );

        expect(changes.updated).toHaveLength(1001);
        expect(new Set(changes.updated.map((row: any) => row.id)).size).toBe(1001);
        expect(activeQuery.range).toHaveBeenNthCalledWith(1, 0, 999);
        expect(activeQuery.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    });

    it('does not retry permanent schema failures', async () => {
        (synchronize as jest.Mock).mockRejectedValue(
            new Error("PGRST205 Could not find the table 'public.app_expenses' in the schema cache")
        );

        await service.sync(true);

        expect(synchronize).toHaveBeenCalledTimes(1);
        expect(mockSetSyncProgress).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
        }));
    });

    it('performs a full pull for tables affected by a WatermelonDB schema migration', async () => {
        let syncOptions: any;
        (synchronize as jest.Mock).mockImplementationOnce(async (options: any) => {
            syncOptions = options;
        });

        await service.sync(true);

        expect(syncOptions.migrationsEnabledAtVersion).toBe(11);
        const fetchSpy = jest.spyOn(service as any, 'fetchTableChanges').mockResolvedValue(EMPTY_CHANGES);
        const lastPulledAt = Date.UTC(2026, 6, 14);

        await syncOptions.pullChanges({
            lastPulledAt,
            schemaVersion: 41,
            migration: {
                from: 40,
                tables: [],
                columns: [{ table: 'cash_transactions', columns: ['is_petty_cash'] }],
            },
        });

        const serverWatermark = '2026-07-14T00:00:00.000Z';
        expect(fetchSpy).toHaveBeenCalledWith('cash_transactions', null, serverWatermark);
        expect(fetchSpy).toHaveBeenCalledWith(
            'expenses',
            new Date(lastPulledAt - 2000).toISOString(),
            serverWatermark
        );
    });
    it('records detailed pull and push manifests and completes the audit session', async () => {
        const audit = {
            beginSession: jest.fn().mockResolvedValue('audit-session-1'),
            startAttempt: jest.fn().mockResolvedValue(undefined),
            record: jest.fn().mockResolvedValue(undefined),
            recordFailure: jest.fn().mockResolvedValue(undefined),
            completeSession: jest.fn().mockResolvedValue(undefined),
            failSession: jest.fn().mockResolvedValue(undefined),
        };
        service = new SyncService((service as any).db, mockSupabase, audit as any);
        jest.spyOn(service, 'updatePendingCount').mockResolvedValue(0);
        jest.spyOn(service as any, 'fetchTableChanges').mockImplementation((tableName: string) => {
            if (tableName === 'expenses') {
                return Promise.resolve({ created: [], updated: [{ id: 'remote-expense-1' }], deleted: ['remote-expense-2'] });
            }
            return Promise.resolve(EMPTY_CHANGES);
        });
        mockSupabase.from.mockReturnValue({
            upsert: jest.fn().mockResolvedValue({ error: null }),
        });
        (synchronize as jest.Mock).mockImplementationOnce(async (options: any) => {
            await options.pullChanges({ lastPulledAt: null, migration: null });
            await options.pushChanges({
                lastPulledAt: null,
                changes: {
                    expenses: {
                        created: [{ id: 'local-created-1' }],
                        updated: [{ id: 'local-updated-1' }],
                        deleted: ['local-deleted-1'],
                    },
                },
            });
        });

        await service.sync(true);

        expect(audit.beginSession).toHaveBeenCalled();
        expect(audit.startAttempt).toHaveBeenCalledWith(1);
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
            direction: 'pull',
            localTable: 'expenses',
            remoteTable: 'app_expenses',
            operation: 'remote-fetch-upsert',
            recordIds: ['remote-expense-1'],
            result: 'success',
        }));
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
            direction: 'pull',
            operation: 'remote-fetch-delete',
            recordIds: ['remote-expense-2'],
        }));
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
            direction: 'push',
            localTable: 'expenses',
            operation: 'upsert-created',
            recordIds: ['local-created-1'],
        }));
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
            direction: 'push',
            operation: 'upsert-updated',
            recordIds: ['local-updated-1'],
        }));
        expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
            direction: 'push',
            operation: 'soft-delete',
            recordIds: ['local-deleted-1'],
        }));
        expect(audit.completeSession).toHaveBeenCalled();
        expect(audit.failSession).not.toHaveBeenCalled();
    });

    it('marks the detailed audit session failed with only a safe failure classification', async () => {
        const audit = {
            beginSession: jest.fn().mockResolvedValue('audit-session-2'),
            startAttempt: jest.fn().mockResolvedValue(undefined),
            record: jest.fn().mockResolvedValue(undefined),
            recordFailure: jest.fn().mockResolvedValue(undefined),
            completeSession: jest.fn().mockResolvedValue(undefined),
            failSession: jest.fn().mockResolvedValue(undefined),
        };
        service = new SyncService((service as any).db, mockSupabase, audit as any);
        jest.spyOn(service, 'updatePendingCount').mockResolvedValue(0);
        (synchronize as jest.Mock).mockRejectedValueOnce(Object.assign(new Error('raw parcel value jane@example.com'), { code: 'PGRST204' }));

        await service.sync(true);

        expect(audit.failSession).toHaveBeenCalledWith({ code: 'PGRST204', failureKind: 'schema' });
        expect(JSON.stringify(audit.failSession.mock.calls)).not.toContain('jane@example.com');
    });

    it('does not fail a successful sync when the default detailed log storage is unavailable', async () => {
        // Exercise the actual default audit service at its storage boundary. An
        // opaque injected callback has no storage-only contract and may write WDB.
        jest.spyOn(DefaultSyncAuditStorage.prototype, 'saveSessions')
            .mockRejectedValueOnce(new Error('filesystem unavailable'));
        (synchronize as jest.Mock).mockResolvedValueOnce(undefined);

        await service.sync(true);

        expect(synchronize).toHaveBeenCalledTimes(1);
        expect(() => assertAgriDatabaseUsable((service as any).db)).not.toThrow();
        expect(mockSetSyncProgress).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
        expect(mockSetSyncProgress).toHaveBeenCalledWith(expect.objectContaining({
            auditPersistenceWarning: expect.stringMatching(/detailed sync log/i),
        }));
    });

});
