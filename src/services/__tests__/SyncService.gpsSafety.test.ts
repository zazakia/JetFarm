import { Database } from '@nozbe/watermelondb';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import syncTableContract from '../syncTableContract.json';
import { sanitizeAuditJsonString } from '../../utils/auditPayloadSanitizer';

// Capture the real service callbacks, then run them with the real WatermelonDB
// sync implementation where acknowledgement/dirty-state semantics matter.
let mockSyncOptions: any;
jest.mock('@nozbe/watermelondb/sync', () => ({
    synchronize: jest.fn(async (options: any) => { mockSyncOptions = options; }),
}));
jest.mock('../../database', () => ({ database: {} }));
jest.mock('../../database/supabase', () => ({
    supabase: {},
    withTimeout: (promise: Promise<unknown>) => Promise.resolve(promise),
}));
jest.mock('../ChartOfAccountsService', () => ({
    ChartOfAccountsService: { ensureDeterministicIds: jest.fn() },
}));
jest.mock('../../utils/PerformanceTracker', () => ({
    perf: { measure: (_name: string, operation: () => unknown) => operation() },
}));
jest.mock('../../stores/syncStore', () => ({
    useSyncStore: { getState: () => ({
        isOnline: true, lastSyncAt: null, setSyncProgress: jest.fn(), addLog: jest.fn(),
    }) },
}));
jest.mock('../ErrorService', () => ({
    ErrorService: {
        handleError: (error: any) => error instanceof Error ? error : Object.assign(new Error(error.message), error),
        getUserMessage: (error: any, fallback: string) => error?.message || fallback,
    },
    ErrorType: { SYNC: 'sync' },
}));

const realSynchronize = jest.requireActual('@nozbe/watermelondb/sync').synchronize;
// The shared in-memory fixture has no migration history. Exercise the service's
// actual callbacks/acknowledgement without asking this fixture to upgrade storage.
const runInMemorySync = (options: any) => realSynchronize({ ...options, migrationsEnabledAtVersion: undefined });
const EMPTY = { created: [], updated: [], deleted: [] };
const DUMMY_IDS = Array.from({ length: 8 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
const NEW_GEOMETRY = ['gps_exclusions', 'boundary_revision', 'layout_revision', 'boundary_saved_at'];
const MAPPING_TABLES = ['agri_parcel_blocks', 'agri_block_assignments', 'agri_block_progress'];
// Post-teardown core seam: `expenses` is a surviving core table (synced for both config
// flag values) and therefore carries the "core changes still sync" half of these tests.
const CORE_TABLE = 'expenses';
const CORE_REMOTE = syncTableContract.remoteTableMap[CORE_TABLE];
// Ordinary (non-mapping) audit subject used where the intent is "an unrelated log".
const ORDINARY_ENTITY = CORE_TABLE;
const LOCAL_AUDIT_PAYLOADS = [
    ...[...MAPPING_TABLES, ...syncTableContract.localOnlyTables].map(entity_type => ({ entity_type })),
    { entity_type: 'agri_parcels', old_data: JSON.stringify({ sync_scope: 'agri_mapping_local' }) },
    { entity_type: 'agri_crop_cycles', new_data: JSON.stringify({ sync_scope: 'agri_mapping_local' }) },
    { entity_type: 'agri_parcels', new_data: JSON.stringify({ geometry: { outer: [], holes: [] }, operationId: DUMMY_IDS[5], targetRevision: 0 }) },
    { entity_type: 'agri_parcels', new_data: JSON.stringify({ geometry: null, operationId: DUMMY_IDS[5], requestJson: 'DUMMY: clear request' }) },
];
const allKinds = () => ({
    created: [{ id: DUMMY_IDS[0], name: 'DUMMY: created' }],
    updated: [{ id: DUMMY_IDS[1], name: 'DUMMY: updated' }],
    deleted: [DUMMY_IDS[2]],
});

function createRemote() {
    const writes: { table: string; rows: any[] }[] = [];
    const remote = {
        writes,
        activeRows: {} as Record<string, any[]>,
        deletedRows: {} as Record<string, any[]>,
        errors: {} as Record<string, any>,
        auth: { getSession: jest.fn().mockResolvedValue({
            data: { session: { user: { id: DUMMY_IDS[7] } } }, error: null,
        }) },
        rpc: jest.fn().mockResolvedValue({ data: new Date().toISOString(), error: null }),
        from: jest.fn((table: string) => {
            let deleted = false;
            const query: any = {
                is: jest.fn(() => query),
                not: jest.fn(() => { deleted = true; return query; }),
                order: jest.fn(() => query),
                gte: jest.fn(() => query),
                lte: jest.fn(() => query),
                in: jest.fn().mockResolvedValue({ data: [], error: null }),
                range: jest.fn(async () => ({
                    data: (deleted ? remote.deletedRows[table] : remote.activeRows[table]) || [],
                    error: remote.errors[table] || null,
                })),
            };
            return {
                select: jest.fn(() => query),
                upsert: jest.fn(async (rows: any[]) => {
                    writes.push({ table, rows });
                    return { error: remote.errors[table] || null };
                }),
            };
        }),
    };
    return remote;
}

async function seedSynced(db: Database) {
    await realSynchronize({
        database: db,
        pullChanges: async () => ({ changes: {}, timestamp: Date.now() - 10000 }),
        pushChanges: async () => ({}),
    });
}

async function createParcel(db: Database, id = DUMMY_IDS[0]) {
    return db.write(() => db.get('agri_parcels').create((row: any) => {
        row._raw.id = id;
        row.name = 'DUMMY: parcel';
        row.landOwnerId = DUMMY_IDS[7];
        row.areaHectares = 1;
        row.gpsCoordinates = 'DUMMY: local boundary';
    }));
}

async function createExpenseRow(db: Database, id: string, category: string) {
    // Runs inside an already-open write transaction (never nests db.write).
    return db.get(CORE_TABLE).create((row: any) => {
        row._raw.id = id;
        row._setRaw('category', category);
        row._setRaw('amount', 1);
        row._setRaw('expense_date', 0);
    });
}

async function queueLayout(db: Database, parcelId = DUMMY_IDS[0], state = 'queued') {
    return db.write(() => db.get('agri_pending_layout_operations').create((row: any) => {
        row._raw.id = DUMMY_IDS[6];
        row._setRaw('operation_id', DUMMY_IDS[5]);
        row._setRaw('parcel_id', parcelId);
        row._setRaw('payload_json', 'DUMMY: immutable local payload');
        row.state = state;
    }));
}

async function createActionLog(db: Database, id: string, payload: any) {
    return db.write(() => db.get('action_logs').create((row: any) => {
        row._raw.id = id;
        row.entityType = payload.entity_type;
        row.entityId = DUMMY_IDS[7];
        row.action = 'UPDATE';
        row.performedBy = DUMMY_IDS[7];
        row.oldData = payload.old_data || '';
        row.newData = payload.new_data || '';
    }));
}

describe.each(['0', 'true'])('GPS cloud safety with config flag %s', flag => {
    let SyncService: any;
    let safety: typeof import('../AgriWriteSafety');
    let db: Database;
    let service: any;
    let remote: ReturnType<typeof createRemote>;
    const originalFlag = process.env.EXPO_PUBLIC_ENABLE_CONFIG_SYNC;

    beforeAll(() => {
        process.env.EXPO_PUBLIC_ENABLE_CONFIG_SYNC = flag;
        jest.isolateModules(() => {
            SyncService = require('../SyncService').SyncService;
            safety = require('../AgriWriteSafety');
        });
    });
    afterAll(() => {
        if (originalFlag === undefined) delete process.env.EXPO_PUBLIC_ENABLE_CONFIG_SYNC;
        else process.env.EXPO_PUBLIC_ENABLE_CONFIG_SYNC = originalFlag;
    });
    beforeEach(() => {
        db = createTestDatabase();
        remote = createRemote();
        service = new SyncService(db, remote, {
            beginSession: jest.fn(), startAttempt: jest.fn(), record: jest.fn(),
            recordFailure: jest.fn(), completeSession: jest.fn(), failSession: jest.fn(),
        });
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(async () => {
        jest.restoreAllMocks();
        await closeTestDatabase(db);
    });

    async function callbacks() {
        await service.sync(true);
        return mockSyncOptions;
    }

    it('actual push handler rejects every disabled config kind while core changes sync', async () => {
        // Positive controls: the pruned contract must still carry deferred config
        // tables and the core table that proves the enabled half of the seam.
        expect(syncTableContract.configTables.length).toBeGreaterThan(0);
        expect(syncTableContract.coreTables).toContain(CORE_TABLE);
        expect(CORE_REMOTE).toBe('app_expenses');
        const changes = Object.fromEntries(syncTableContract.configTables.map(table => [table, allKinds()]));
        changes[CORE_TABLE] = allKinds();
        const options = await callbacks();
        remote.from.mockClear();
        const result = await options.pushChanges({ changes });
        const deferred = flag === '0' ? syncTableContract.configTables : MAPPING_TABLES;
        expect(deferred.length).toBeGreaterThan(0);
        for (const table of deferred) {
            expect(result.experimentalRejectedIds[table]).toEqual(DUMMY_IDS.slice(0, 3));
            expect(remote.from).not.toHaveBeenCalledWith(syncTableContract.remoteTableMap[table]);
        }
        expect(result.experimentalRejectedIds[CORE_TABLE]).toBeUndefined();
        expect(remote.writes.filter(write => write.table === CORE_REMOTE)).toHaveLength(2);
    });

    it('keeps the local outbox dirty, including updates/deletions, without generic remote calls', async () => {
        const options = await callbacks();
        remote.from.mockClear();
        const result = await options.pushChanges({ changes: { agri_pending_layout_operations: allKinds() } });
        expect(syncTableContract.localOnlyTables).toContain('agri_pending_layout_operations');
        expect(result.experimentalRejectedIds.agri_pending_layout_operations).toEqual(DUMMY_IDS.slice(0, 3));
        expect(remote.from).not.toHaveBeenCalled();
    });

    it('does not pull mapping domains even when schema migration requests them', async () => {
        expect(MAPPING_TABLES.length).toBeGreaterThan(0);
        const options = await callbacks();
        remote.from.mockClear();
        const result = await options.pullChanges({ lastPulledAt: null, migration: { tables: MAPPING_TABLES, columns: [] } });
        for (const table of [...MAPPING_TABLES, 'agri_pending_layout_operations']) {
            expect(remote.from).not.toHaveBeenCalledWith(table);
            expect(result.changes[table]).toBeUndefined();
            expect(await service.fetchTableChanges(table, null)).toEqual(EMPTY);
        }
    });

    it('real WDB acknowledgement retains deferred created/updated/deleted rows and cleans core', async () => {
        expect(syncTableContract.coreTables).toContain(CORE_TABLE);
        const rows: any[] = [];
        await db.write(async () => {
            for (const id of DUMMY_IDS.slice(0, 3)) {
                rows.push(await db.get('feature_flags').create((row: any) => { row._raw.id = id; row.key = `DUMMY: ${id}`; }));
            }
        });
        await seedSynced(db);
        await db.write(async () => {
            await rows[0].update((row: any) => { row.enabled = true; });
            await rows[1].markAsDeleted();
            await db.get('feature_flags').create((row: any) => { row._raw.id = DUMMY_IDS[3]; row.key = 'DUMMY: new'; });
            await createExpenseRow(db, DUMMY_IDS[4], 'DUMMY: core');
        });
        const options = await callbacks();
        const result = await runInMemorySync(options);
        expect(result).toBeUndefined();
        expect((await db.get(CORE_TABLE).find(DUMMY_IDS[4]))._raw._status).toBe('synced');
        expect(rows[0]._raw._status).toBe(flag === '0' ? 'updated' : 'synced');
        expect((await db.get('feature_flags').find(DUMMY_IDS[3]))._raw._status).toBe(flag === '0' ? 'created' : 'synced');
        expect(await db.adapter.getDeletedRecords('feature_flags')).toEqual(flag === '0' ? [DUMMY_IDS[1]] : []);
    });

    it('does not acknowledge rows if DB becomes quarantined while a remote upsert is in flight', async () => {
        remote.from.mockImplementation(() => ({
            upsert: jest.fn(async () => {
                const batch = jest.spyOn(db, 'batch').mockRejectedValueOnce(new Error('DUMMY: uncertain concurrent batch'));
                await expect(safety.runAuditedAgriBatch(db, () => [])).rejects.toHaveProperty('code', 'AGRI_DATABASE_REOPEN_REQUIRED');
                batch.mockRestore();
                return { error: null };
            }),
        }) as any);
        await expect(service.pushChangesToSupabase({ [CORE_TABLE]: { ...EMPTY, created: [{ id: DUMMY_IDS[0] }] } }))
            .rejects.toHaveProperty('code', 'AGRI_DATABASE_REOPEN_REQUIRED');
    });

    it('quarantined DB cannot start sync, pull, or push phantom cached values', async () => {
        const batch = jest.spyOn(db, 'batch').mockRejectedValueOnce(new Error('DUMMY: uncertain batch'));
        await expect(safety.runAuditedAgriBatch(db, () => [])).rejects.toHaveProperty('code', 'AGRI_DATABASE_REOPEN_REQUIRED');
        batch.mockRestore();
        remote.from.mockClear();
        remote.rpc.mockClear();
        await expect(service.sync(true)).rejects.toHaveProperty('code', 'AGRI_DATABASE_REOPEN_REQUIRED');
        await expect(service.pushChangesToSupabase({ [CORE_TABLE]: allKinds() })).rejects.toHaveProperty('code', 'AGRI_DATABASE_REOPEN_REQUIRED');
        await expect(service.fetchTableChanges(CORE_TABLE, null)).rejects.toHaveProperty('code', 'AGRI_DATABASE_REOPEN_REQUIRED');
        expect(remote.auth.getSession).not.toHaveBeenCalled();
        expect(remote.from).not.toHaveBeenCalled();
        expect(remote.rpc).not.toHaveBeenCalled();
    });

    it.each(['created', 'updated'])('actual handler rejects local mapping audit %s before any remote conflict check', async kind => {
        expect(LOCAL_AUDIT_PAYLOADS.length).toBeGreaterThan(0);
        const options = await callbacks();
        for (const payload of LOCAL_AUDIT_PAYLOADS) {
            remote.from.mockClear();
            const result = await options.pushChanges({ changes: { action_logs: {
                ...EMPTY, [kind]: [{ id: DUMMY_IDS[0], ...payload }],
            } }, lastPulledAt: Date.now() });
            expect(result.experimentalRejectedIds.action_logs).toEqual([DUMMY_IDS[0]]);
            expect(remote.from).not.toHaveBeenCalled();
        }
    });

    it.each(['scope', 'legacy'])('retains mapping audits when the real sanitizer truncates %s JSON', async kind => {
        const geometry = { outer: Array.from({ length: 1000 }, () => ({ latitude: 0, longitude: 0 })), holes: [] };
        const encoded = sanitizeAuditJsonString(kind === 'scope'
            ? { sync_scope: 'agri_mapping_local', geometry }
            : { operationId: DUMMY_IDS[5], targetRevision: 1, geometry });
        expect(() => JSON.parse(encoded)).toThrow();
        const payload = { entity_type: 'agri_parcels', [kind === 'scope' ? 'old_data' : 'new_data']: encoded };
        const deleted: any = await createActionLog(db, DUMMY_IDS[0], payload);
        await seedSynced(db);
        await db.write(() => deleted.markAsDeleted());
        const created: any = await createActionLog(db, DUMMY_IDS[1], payload);
        const options = await callbacks();
        await runInMemorySync(options);
        expect(created._raw._status).toBe('created');
        expect(await db.adapter.getDeletedRecords('action_logs')).toEqual([deleted.id]);
        expect(remote.writes).toHaveLength(0);
    });

    it('mixed audit batch preserves unrelated payloads and merges mapping and remote-conflict rejections', async () => {
        const originalFrom = remote.from.getMockImplementation()!;
        const checkedIds: string[][] = [];
        remote.from.mockImplementation((table: string) => {
            const builder = originalFrom(table);
            builder.select = jest.fn(() => ({ in: jest.fn(async (_column: string, ids: string[]) => {
                checkedIds.push(ids);
                return { data: [{ id: DUMMY_IDS[1], updated_at: Date.now() + 10000 }], error: null };
            }) })) as any;
            return builder;
        });
        const ordinary = [
            { id: DUMMY_IDS[2], entity_type: ORDINARY_ENTITY, new_data: JSON.stringify({ geometry: null, operationId: DUMMY_IDS[5], targetRevision: 0 }) },
            { id: DUMMY_IDS[3], entity_type: 'agri_parcels', new_data: JSON.stringify({ geometry: [], name: 'DUMMY: ordinary parcel metadata' }) },
            { id: DUMMY_IDS[4], entity_type: ORDINARY_ENTITY, old_data: 'DUMMY: non-JSON legacy audit', new_data: JSON.stringify({ nested: { sync_scope: 'agri_mapping_local' } }) },
        ];
        const options = await callbacks();
        const result = await options.pushChanges({ changes: { action_logs: {
            ...EMPTY,
            created: [{ id: DUMMY_IDS[0], ...LOCAL_AUDIT_PAYLOADS[0] }, ...ordinary],
            updated: [{ id: DUMMY_IDS[1], entity_type: ORDINARY_ENTITY }],
        } }, lastPulledAt: Date.now() });
        expect(result.experimentalRejectedIds.action_logs).toEqual(DUMMY_IDS.slice(0, 2));
        expect(checkedIds.flat()).not.toContain(DUMMY_IDS[0]);
        expect(remote.writes[0].rows.map(row => row.id)).toEqual(ordinary.map(row => row.id));
        for (const row of ordinary) expect(remote.writes[0].rows.find(value => value.id === row.id)).toMatchObject(row);
    });

    it.each(LOCAL_AUDIT_PAYLOADS)('real WDB retains mapping audit creates/updates/tombstones for %j and cleans unrelated audits', async payload => {
        const updated: any = await createActionLog(db, DUMMY_IDS[0], payload);
        const deleted: any = await createActionLog(db, DUMMY_IDS[1], payload);
        const ordinaryDeleted: any = await createActionLog(db, DUMMY_IDS[3], { entity_type: ORDINARY_ENTITY });
        await seedSynced(db);
        await db.write(async () => {
            await updated.update((row: any) => { row.action = 'RESTORE'; });
            await deleted.markAsDeleted();
            await ordinaryDeleted.markAsDeleted();
        });
        const created: any = await createActionLog(db, DUMMY_IDS[2], payload);
        const ordinary: any = await createActionLog(db, DUMMY_IDS[4], { entity_type: ORDINARY_ENTITY });
        // A normal query hides persisted tombstones; read raw without hydrating models.
        expect((await db.get('action_logs').query().fetch()).map(row => row.id)).not.toContain(deleted.id);
        const readRaw = jest.spyOn(db.adapter, 'unsafeQueryRaw');
        await runInMemorySync(await callbacks());
        expect(readRaw).toHaveBeenCalledWith(expect.objectContaining({ table: 'action_logs' }));
        expect(updated._raw._status).toBe('updated');
        expect(updated._raw._changed).toContain('action');
        expect(created._raw._status).toBe('created');
        expect(ordinary._raw._status).toBe('synced');
        expect(await db.adapter.getDeletedRecords('action_logs')).toEqual([deleted.id]);
        expect(remote.writes.filter(write => write.table === 'app_action_logs').flatMap(write => write.rows).map(row => row.id))
            .toEqual([ordinary.id, ordinaryDeleted.id]);
    });

    it.each(['missing', 'unreadable', 'incomplete'])('retains an audit deletion with %s local identity without blocking unrelated logs', async mode => {
        if (mode === 'unreadable') jest.spyOn(db.adapter, 'unsafeQueryRaw').mockRejectedValue(new Error('DUMMY: unreadable tombstone'));
        if (mode === 'incomplete') await createActionLog(db, DUMMY_IDS[0], { entity_type: '' });
        const options = await callbacks();
        const result = await options.pushChanges({ changes: { action_logs: {
            ...EMPTY, created: [{ id: DUMMY_IDS[1], entity_type: ORDINARY_ENTITY }], deleted: [DUMMY_IDS[0]],
        } }, lastPulledAt: Date.now() });
        expect(result.experimentalRejectedIds.action_logs).toEqual([DUMMY_IDS[0]]);
        expect(remote.writes.flatMap(write => write.rows).map(row => row.id)).toEqual([DUMMY_IDS[1]]);
    });

    it('resolves persisted ordinary audit tombstones without leaving phantom records in the WDB model cache', async () => {
        const log: any = await createActionLog(db, DUMMY_IDS[0], { entity_type: ORDINARY_ENTITY });
        await seedSynced(db);
        await db.write(() => log.markAsDeleted());
        await runInMemorySync(await callbacks());
        expect(await db.adapter.getDeletedRecords('action_logs')).toEqual([]);
        // WDB destroys acknowledged tombstones through the adapter, not Database.batch.
        // Hydrating them via collection.find() would leave a stale cached deleted model.
        await expect(db.get('action_logs').find(log.id)).rejects.toThrow('not found');
    });

    it('real WDB preserves a persisted tombstone when identity reads fail, then acknowledges an ordinary deletion after recovery', async () => {
        const log: any = await createActionLog(db, DUMMY_IDS[0], { entity_type: ORDINARY_ENTITY });
        await seedSynced(db);
        await db.write(() => log.markAsDeleted());
        const readRaw = jest.spyOn(db.adapter, 'unsafeQueryRaw').mockRejectedValue(new Error('DUMMY: storage read failure'));
        const options = await callbacks();
        await runInMemorySync(options);
        expect(await db.adapter.getDeletedRecords('action_logs')).toEqual([log.id]);
        expect(remote.writes).toHaveLength(0);
        readRaw.mockRestore();
        await runInMemorySync(options);
        expect(await db.adapter.getDeletedRecords('action_logs')).toEqual([]);
        expect(remote.writes[0].rows[0]).toHaveProperty('deleted_at');
    });

    if (flag === 'true') {
        it('legacy config handler still upserts and deletes when enabled', async () => {
            expect(await service.pushChangesToSupabase({ feature_flags: allKinds() })).toEqual({});
            expect(remote.writes).toHaveLength(2);
            expect(remote.writes[0].table).toBe('app_feature_flags');
        });

        it.each(['created', 'updated'])('pending parcel %s defers the entire row without metadata upsert or conflict access', async kind => {
            await queueLayout(db);
            const parcel = {
                id: DUMMY_IDS[0], name: 'DUMMY: renamed', gps_coordinates: 'DUMMY: geometry', area_hectares: 2,
                gps_exclusions: 'DUMMY: exclusions', boundary_revision: 2, layout_revision: 3, boundary_saved_at: Date.now(),
            };
            const options = await callbacks();
            remote.from.mockClear();
            const result = await options.pushChanges({ changes: { agri_parcels: { ...EMPTY, [kind]: [parcel] } }, lastPulledAt: Date.now() });
            expect(remote.writes).toHaveLength(0);
            expect(remote.from).not.toHaveBeenCalled();
            expect(result.experimentalRejectedIds.agri_parcels).toEqual([parcel.id]);
            expect(parcel.gps_coordinates).toBe('DUMMY: geometry');
        });

        it.each([null, 'DUMMY: exclusions'])('strips new nullable geometry columns without breaking legacy parcel sync (%s)', async exclusions => {
            const result = await service.pushChangesToSupabase({ agri_parcels: {
                ...EMPTY, updated: [{ id: DUMMY_IDS[0], name: 'DUMMY: legacy', gps_coordinates: 'DUMMY: legacy point',
                    area_hectares: 1, gps_exclusions: exclusions, boundary_revision: null, layout_revision: null, boundary_saved_at: null }],
            } });
            expect(result).toEqual({});
            expect(remote.writes[0].rows[0]).toMatchObject({ gps_coordinates: 'DUMMY: legacy point', area_hectares: 1 });
            for (const field of NEW_GEOMETRY) expect(remote.writes[0].rows[0]).not.toHaveProperty(field);
        });

        it('acknowledged local operations do not shield legacy metadata/geometry and remain local-only', async () => {
            await queueLayout(db, DUMMY_IDS[0], 'acknowledged');
            const result = await service.pushChangesToSupabase({ agri_parcels: {
                ...EMPTY, updated: [{ id: DUMMY_IDS[0], name: 'DUMMY: metadata', gps_coordinates: 'DUMMY: point', area_hectares: 1 }],
            } });
            expect(result).toEqual({});
            expect(remote.writes[0].rows[0]).toHaveProperty('gps_coordinates', 'DUMMY: point');
            expect(remote.from).not.toHaveBeenCalledWith('agri_pending_layout_operations');
        });

        it('shields only the parcel with a queued operation, not unrelated parcels', async () => {
            await queueLayout(db, DUMMY_IDS[0]);
            const result = await service.pushChangesToSupabase({ agri_parcels: {
                ...EMPTY, updated: DUMMY_IDS.slice(0, 2).map(id => ({ id, name: 'DUMMY: metadata', gps_coordinates: 'DUMMY: point', area_hectares: 1 })),
            } });
            expect(result.agri_parcels).toEqual([DUMMY_IDS[0]]);
            expect(remote.writes[0].rows.map(row => row.id)).toEqual([DUMMY_IDS[1]]);
            expect(remote.writes[0].rows[0]).toHaveProperty('gps_coordinates', 'DUMMY: point');
        });

        it.each(['queued', 'DUMMY: sending', 'DUMMY: failed', 'DUMMY: conflict'])('real WDB retains whole parent create/update/delete with %s outbox state while ordinary parcels sync', async state => {
            const updated: any = await createParcel(db);
            const deleted: any = await createParcel(db, DUMMY_IDS[1]);
            const ordinaryDeleted: any = await createParcel(db, DUMMY_IDS[4]);
            await seedSynced(db);
            await queueLayout(db, updated.id, state);
            await db.write(async () => {
                const outbox = db.get('agri_pending_layout_operations');
                for (const [index, parcelId] of [deleted.id, DUMMY_IDS[2]].entries()) {
                    await outbox.create((row: any) => {
                        row._raw.id = `DUMMY: outbox ${index}`;
                        row._setRaw('parcel_id', parcelId);
                        row.state = state;
                    });
                }
                await updated.update((row: any) => { row.name = 'DUMMY: renamed parent'; row.gpsCoordinates = 'DUMMY: edited boundary'; });
                await deleted.markAsDeleted();
                await ordinaryDeleted.markAsDeleted();
            });
            const created: any = await createParcel(db, DUMMY_IDS[2]);
            const ordinary: any = await createParcel(db, DUMMY_IDS[3]);
            const before = { ...updated._raw };
            const options = await callbacks();
            await runInMemorySync(options);
            expect(updated._raw).toEqual(before);
            expect(created._raw._status).toBe('created');
            expect(await db.adapter.getDeletedRecords('agri_parcels')).toEqual([deleted.id]);
            expect(ordinary._raw._status).toBe('synced');
            expect(remote.writes.filter(write => write.table === 'agri_parcels').flatMap(write => write.rows).map(row => row.id))
                .toEqual([ordinary.id, ordinaryDeleted.id]);
            // Pulling a remote active parent must not recreate a suppressed local tombstone.
            remote.activeRows.agri_parcels = [{ id: deleted.id, name: 'DUMMY: stale active parent', deleted_at: null }];
            await runInMemorySync(options);
            expect(await db.adapter.getDeletedRecords('agri_parcels')).toEqual([deleted.id]);
            expect((await db.get('agri_parcels').query().fetch()).map(row => row.id)).not.toContain(deleted.id);
        });

        it('defers a deleted parcel with queued layout instead of publishing a tombstone', async () => {
            await queueLayout(db);
            const options = await callbacks();
            remote.from.mockClear();
            const result = await options.pushChanges({ changes: { agri_parcels: { ...EMPTY, deleted: [DUMMY_IDS[0]] } }, lastPulledAt: Date.now() });
            expect(result.experimentalRejectedIds.agri_parcels).toEqual([DUMMY_IDS[0]]);
            expect(remote.from).not.toHaveBeenCalled();
        });

        it('real WDB keeps a deleted parcel tombstone while its layout operation is queued', async () => {
            const parcel: any = await createParcel(db);
            await seedSynced(db);
            const operation: any = await queueLayout(db);
            await db.write(() => parcel.markAsDeleted());
            await runInMemorySync(await callbacks());
            expect(await db.adapter.getDeletedRecords('agri_parcels')).toEqual([parcel.id]);
            expect(operation._raw._status).toBe('created');
            expect(operation.state).toBe('queued');
            expect(remote.writes.some(write => write.table === 'agri_parcels')).toBe(false);
        });

        it('merges remote conflicts with pending-layout rejected IDs instead of overwriting them', async () => {
            await queueLayout(db);
            const originalFrom = remote.from.getMockImplementation()!;
            remote.from.mockImplementation((table: string) => {
                const builder = originalFrom(table);
                builder.select = jest.fn(() => ({ in: jest.fn().mockResolvedValue({ data: [
                    { id: DUMMY_IDS[1], updated_at: Date.now() + 10000 },
                ], error: null }) })) as any;
                return builder;
            });
            const result = await service.pushChangesToSupabase({ agri_parcels: {
                ...EMPTY, updated: DUMMY_IDS.slice(0, 2).map(id => ({ id, name: 'DUMMY: metadata' })),
            } }, Date.now());
            expect(result.agri_parcels).toEqual(DUMMY_IDS.slice(0, 2));
            expect(remote.writes).toHaveLength(0);
        });

        it('fails closed when the local outbox cannot be read, before remote parcel access', async () => {
            jest.spyOn(db.collections, 'get').mockImplementation((table: any) => {
                if (table === 'agri_pending_layout_operations') throw new Error('DUMMY: missing optional local schema');
                throw new Error('DUMMY: unexpected lookup');
            });
            const result = await service.pushChangesToSupabase({ agri_parcels: allKinds(), [CORE_TABLE]: allKinds() });
            expect(result.agri_parcels).toEqual(DUMMY_IDS.slice(0, 3));
            expect(remote.from).not.toHaveBeenCalledWith('agri_parcels');
            // The unreadable outbox shields only the GPS-bearing parcel domain; core
            // finance rows still publish, so a broken agri seam cannot stall the ledger.
            expect(remote.writes.filter(write => write.table === CORE_REMOTE)).toHaveLength(2);
        });

        it('missing optional remote schema retains every kind, and cached missing schema makes no calls', async () => {
            remote.errors.app_feature_flags = { code: 'PGRST205', message: 'DUMMY: missing table in schema cache' };
            expect(await service.pushChangesToSupabase({ feature_flags: allKinds() })).toEqual({ feature_flags: DUMMY_IDS.slice(0, 3) });
            remote.from.mockClear();
            expect(await service.pushChangesToSupabase({ feature_flags: allKinds() })).toEqual({ feature_flags: DUMMY_IDS.slice(0, 3) });
            expect(remote.from).not.toHaveBeenCalled();
        });

        it('real pull preserves queued geometry and avoids remote deletion, then defers the entire parent/outbox', async () => {
            const parcel: any = await createParcel(db);
            await db.write(() => parcel.update((row: any) => {
                row.gpsExclusions = 'DUMMY: local exclusions';
                row.boundaryRevision = 2;
                row.layoutRevision = 3;
                row.boundarySavedAt = new Date(1700000000000);
            }));
            await seedSynced(db);
            // Even columns not in _changed must survive the old remote's missing columns.
            await db.write(() => parcel.update((row: any) => { row.name = 'DUMMY: local metadata'; }));
            const operation: any = await queueLayout(db);
            remote.activeRows.agri_parcels = [{ id: parcel.id, name: 'DUMMY: remote metadata',
                gps_coordinates: 'DUMMY: stale remote geometry', area_hectares: 99, deleted_at: null }];
            const options = await callbacks();
            await runInMemorySync(options);
            expect(parcel.gpsCoordinates).toBe('DUMMY: local boundary');
            expect(parcel.areaHectares).toBe(1);
            expect(parcel.gpsExclusions).toBe('DUMMY: local exclusions');
            expect(parcel.boundaryRevision).toBe(2);
            expect(parcel.layoutRevision).toBe(3);
            expect(parcel.boundarySavedAt.getTime()).toBe(1700000000000);
            expect(parcel._raw._status).toBe('updated');
            expect(operation._raw._status).toBe('created');
            expect(operation.state).toBe('queued');
            expect(parcel.name).toBe('DUMMY: local metadata');
            expect(parcel._raw._changed).toContain('name');
            expect(remote.writes.some(write => write.table === 'agri_parcels')).toBe(false);
            remote.activeRows.agri_parcels = [];
            remote.deletedRows.agri_parcels = [{ id: parcel.id, deleted_at: new Date().toISOString() }];
            await runInMemorySync(options);
            expect((await db.get('agri_parcels').find(parcel.id))._raw._status).toBe('updated');
        });
    }
});
