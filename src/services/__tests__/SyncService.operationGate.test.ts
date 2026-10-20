import { Database } from '@nozbe/watermelondb';
import { synchronize } from '@nozbe/watermelondb/sync';
import { getLastPulledAt } from '@nozbe/watermelondb/sync/impl';
import uuid from 'react-native-uuid';
import { createTestDatabase } from '../../__tests__/test-utils';
import { SyncService } from '../SyncService';
import syncTableContract from '../syncTableContract.json';
import { AgriParcelService } from '../AgriParcelService';
import { AgriBlockService } from '../AgriBlockService';
import { AgriBlockAssignmentService } from '../AgriBlockAssignmentService';
import { assertAgriDatabaseUsable, runAuditedAgriBatch, withAgriDatabaseOperation, writeAgriDatabase } from '../AgriWriteSafety';
import { ChartOfAccountsService } from '../ChartOfAccountsService';
import { isLocalWebE2E } from '../../utils/e2eEnvironment';
import { useSyncStore } from '../../stores/syncStore';

// Only remove migration history requirements from this in-memory fixture. Public
// SyncService.sync awaits the INSTALLED synchronize, including its real writers.
jest.mock('@nozbe/watermelondb/sync', () => ({
    synchronize: jest.fn((options: any) => jest.requireActual('@nozbe/watermelondb/sync').synchronize({
        ...options, migrationsEnabledAtVersion: undefined,
    })),
}));
jest.mock('../../database', () => ({ database: {} }));
jest.mock('../../database/supabase', () => ({
    supabase: {}, withTimeout: (promise: Promise<unknown>) => Promise.resolve(promise),
}));
jest.mock('../AuthService', () => ({ AuthService: { getCurrentUserId: jest.fn().mockResolvedValue('DUMMY: supervisor') } }));
jest.mock('../ChartOfAccountsService', () => ({ ChartOfAccountsService: { ensureDeterministicIds: jest.fn() } }));
jest.mock('../../utils/e2eEnvironment', () => ({ isLocalWebE2E: jest.fn(() => false) }));
jest.mock('../../utils/PerformanceTracker', () => ({
    perf: { measure: (_name: string, operation: () => unknown) => operation() },
}));
jest.mock('../../stores/syncStore', () => ({ useSyncStore: { getState: jest.fn() } }));
jest.mock('../ErrorService', () => ({
    ErrorService: {
        handleError: (error: any) => error instanceof Error ? error : Object.assign(new Error(error.message), error),
        getUserMessage: (error: any, fallback: string) => error?.message || fallback,
    }, ErrorType: { SYNC: 'sync' },
}));

// All identities, coordinates, timestamps and remote rows are synthetic; no I/O.
const realSynchronize = jest.requireActual('@nozbe/watermelondb/sync').synchronize;
const id = () => uuid.v4() as string;
const geometry = { outer: [{ latitude: 0, longitude: 0 }, { latitude: 0.001, longitude: 0 },
    { latitude: 0.001, longitude: 0.001 }, { latitude: 0, longitude: 0.001 }], holes: [] };
const kinds = ['layout', 'assignment', 'progress'] as const;
type Kind = typeof kinds[number];
// Post-teardown core carrier: `expenses` is a surviving core table (synced in the default
// config), so it still proves that ACK holds domain writers outside db.write.
const CORE_TABLE = 'expenses';
const CORE_REMOTE = 'app_expenses';

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
}
async function flushMicrotasks() {
    for (let i = 0; i < 40; i++) await Promise.resolve();
}
const outcome = <T>(promise: Promise<T>) => promise.then(value => ({ value, error: null }), error => ({ value: null, error }));

// Positive control for the pruned contract: the carrier really is a synced core table,
// so the ACK/watermark assertions below cannot be satisfied by an empty sync set.
function assertCarrierIsSynced(): void {
    expect(syncTableContract.coreTables.length).toBeGreaterThan(0);
    expect(syncTableContract.coreTables).toContain(CORE_TABLE);
    expect(CORE_REMOTE).toBe('app_expenses');
    expect(Object.keys(syncTableContract.remoteTableMap).length)
        .toBe(syncTableContract.coreTables.length + syncTableContract.configTables.length);
}

function createExpense(db: Database, category: string) {
    return db.get<any>(CORE_TABLE).create((row: any) => {
        row.category = category;
        row.amount = 1;
        row.expenseDate = 0;
    });
}

async function fixture(kind: Kind = 'layout') {
    assertCarrierIsSynced();
    const db = createTestDatabase();
    const parcel = await AgriParcelService.createParcel({ name: 'DUMMY: parcel', landOwnerId: 'DUMMY: owner',
        areaHectares: 1, gpsCoordinates: geometry.outer }, db);
    const blockId = id();
    let workerId = ''; let assignmentId = '';
    if (kind !== 'layout') {
        await AgriBlockService.saveLayout({ parcelId: parcel.id, expectedRevision: 0, geometry,
            blocks: [{ id: blockId, name: 'DUMMY: block', geometry }], operationId: id() }, db);
        const worker = await db.write(() => db.get<any>('agri_farm_workers').create(row => {
            row.name = 'DUMMY: worker'; row.status = 'active';
        }));
        workerId = worker.id;
        if (kind === 'progress') {
            const [assignment] = await AgriBlockAssignmentService.assignWorkers({ blockId, workerIds: [workerId],
                task: 'DUMMY: weeding', startDate: 0, submissionId: id() }, db);
            assignmentId = assignment.id;
        }
    }
    const dirty = await db.write(() => createExpense(db, 'DUMMY: pending carrier'));
    const tombstone = await db.write(() => createExpense(db, 'DUMMY: tombstoned carrier'));
    await realSynchronize({ database: db, pullChanges: async () => ({ changes: {}, timestamp: 100 }), pushChanges: async () => ({}) });
    await db.write(async () => {
        await dirty.update(row => { row.category = 'DUMMY: dirty carrier'; });
        await tombstone.markAsDeleted();
    });
    const operationId = id();
    const submit = (): Promise<unknown> => {
        if (kind === 'layout') return AgriBlockService.saveLayout({ parcelId: parcel.id,
            expectedRevision: parcel.layoutRevision, geometry, blocks: [], operationId }, db);
        if (kind === 'assignment') return AgriBlockAssignmentService.assignWorkers({ blockId, workerIds: [workerId],
            task: 'DUMMY: weeding', startDate: 0, submissionId: operationId }, db);
        return AgriBlockAssignmentService.recordProgress({ assignmentId, progressPercent: 40,
            status: 'in_progress', updateDate: 0, submissionId: operationId }, db);
    };
    return { db, parcel, dirty, tombstone, submit };
}

function remoteHarness() {
    const pullEntered = deferred(); const pullRelease = deferred();
    const pushEntered = deferred(); const pushRelease = deferred();
    const remoteId = id();
    const writes: { table: string; rows: any[] }[] = [];
    const remote = {
        auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: id() } } }, error: null }) },
        rpc: jest.fn().mockResolvedValue({ data: new Date(200).toISOString(), error: null }),
        from: jest.fn((table: string) => {
            let deleted = false;
            const query: any = {
                is: jest.fn(() => query), not: jest.fn(() => { deleted = true; return query; }),
                order: jest.fn(() => query), gte: jest.fn(() => query), lte: jest.fn(() => query),
                in: jest.fn().mockResolvedValue({ data: [], error: null }),
                range: jest.fn(async () => {
                    pullEntered.resolve(); await pullRelease.promise;
                    return { data: table === CORE_REMOTE
                        ? deleted ? remoteDeletedIds.map(id => ({ id }))
                            : [{ id: remoteId, category: 'DUMMY: pulled carrier' }] : [], error: pullError };
                }),
            };
            return { select: jest.fn(() => query), upsert: jest.fn(async (rows: any[]) => {
                writes.push({ table, rows }); pushEntered.resolve(); await pushRelease.promise;
                return { error: pushError };
            }) };
        }),
    };
    let pullError: any = null; let pushError: any = null; let remoteDeletedIds: string[] = [];
    const releaseAll = () => { pullRelease.resolve(); pushRelease.resolve(); };
    return { remote, remoteId, writes, pullEntered, pullRelease, pushEntered, pushRelease, releaseAll,
        failPull: (error: any) => { pullError = error; }, failPush: (error: any) => { pushError = error; },
        deleteOnPull: (id: string) => { remoteDeletedIds = [id]; } };
}

function serviceHarness(db: Database) {
    const remote = remoteHarness();
    const auditEntered = deferred(); const auditRelease = deferred();
    const failedAuditEntered = deferred(); const failedAuditRelease = deferred();
    const events: string[] = [];
    const audit = {
        beginSession: jest.fn(() => db.write(async () => 'DUMMY: audit session', 'DUMMY: sync audit')),
        startAttempt: jest.fn().mockResolvedValue(undefined), record: jest.fn().mockResolvedValue(undefined),
        recordFailure: jest.fn().mockResolvedValue(undefined),
        completeSession: jest.fn(async () => {
            auditEntered.resolve(); await auditRelease.promise;
            await db.write(async () => { events.push('audit:done'); }, 'DUMMY: sync audit');
        }),
        failSession: jest.fn(async () => { failedAuditEntered.resolve(); await failedAuditRelease.promise; }),
    };
    const service = new SyncService(db, remote.remote as any, audit);
    const releaseAll = () => { remote.releaseAll(); auditRelease.resolve(); failedAuditRelease.resolve(); };
    return { ...remote, service, audit, auditEntered, auditRelease, failedAuditEntered, failedAuditRelease, events, releaseAll };
}

function ackHarness(db: Database, events: string[], cleanupFailure?: Error) {
    const ackQueued = deferred(); const batchEntered = deferred(); const batchRelease = deferred(); const batchDone = deferred();
    const deleteEntered = deferred(); const deleteRelease = deferred();
    let ackRunning = false;
    const write = db.write.bind(db);
    const writeSpy = jest.spyOn(db, 'write').mockImplementation((writer: any, description?: string) => {
        const isAck = description === 'sync-markLocalChangesAsSynced';
        if (isAck) { events.push('ack:queued'); ackQueued.resolve(); }
        return write(async handle => {
            events.push(description || 'domain:writer');
            if (isAck) ackRunning = true;
            try { return await writer(handle); }
            finally { if (isAck) ackRunning = false; }
        }, description);
    });
    const batch = db.adapter.batch.bind(db.adapter);
    jest.spyOn(db.adapter, 'batch').mockImplementation(async operations => {
        const isAck = ackRunning;
        if (isAck) { batchEntered.resolve(); await batchRelease.promise; }
        await batch(operations);
        if (isAck) { events.push('ack:batch:done'); batchDone.resolve(); }
    });
    const destroy = db.adapter.destroyDeletedRecords.bind(db.adapter);
    jest.spyOn(db.adapter, 'destroyDeletedRecords').mockImplementation(async (table, ids) => {
        deleteEntered.resolve(); await deleteRelease.promise;
        await destroy(table, ids); events.push('ack:delete:done');
        if (cleanupFailure) throw cleanupFailure;
    });
    const domainWrites = () => writeSpy.mock.calls.filter(([, description]) => description === undefined).length;
    return { ackQueued, batchEntered, batchRelease, batchDone, deleteEntered, deleteRelease, domainWrites,
        releaseAll: () => { batchRelease.resolve(); deleteRelease.resolve(); } };
}

// Faults enter the installed sync's public adapter I/O, never a fake synchronize.
function localFailureHarness(db: Database, point: 'apply' | 'ack', committed: boolean) {
    const entered = deferred(); const release = deferred(); const failed = deferred();
    const siblingEntered = deferred(); const siblingRelease = deferred(); const siblingDone = deferred();
    const cause = new Error(`DUMMY: ${point} local batch failure`);
    const batch = db.adapter.batch.bind(db.adapter);
    let injected = false;
    jest.spyOn(db.adapter, 'batch').mockImplementation(async operations => {
        const target = point === 'apply'
            ? operations.some(operation => operation[0] === 'create' && operation[1] === CORE_TABLE)
            : operations.some(operation => operation[0] === 'update' && operation[2]._status === 'synced');
        if (!target || injected) return batch(operations);
        injected = true; entered.resolve(); await release.promise;
        if (committed) await batch(operations);
        failed.resolve(); throw cause;
    });
    const destroy = db.adapter.destroyDeletedRecords.bind(db.adapter);
    jest.spyOn(db.adapter, 'destroyDeletedRecords').mockImplementation(async (table, ids) => {
        siblingEntered.resolve(); await siblingRelease.promise;
        await destroy(table, ids); siblingDone.resolve();
    });
    return { cause, entered, release, failed, siblingEntered, siblingRelease, siblingDone,
        releaseAll: () => { release.resolve(); siblingRelease.resolve(); } };
}

function holdDomainBatch(db: Database, fail = false) {
    const entered = deferred(); const release = deferred();
    const batch = db.adapter.batch.bind(db.adapter);
    const spy = jest.spyOn(db.adapter, 'batch').mockImplementationOnce(async operations => {
        entered.resolve(); await release.promise;
        if (fail) throw new Error('DUMMY: uncertain audited batch');
        return batch(operations);
    });
    return { entered, release, spy };
}

describe('public SyncService operation ownership with installed WDB synchronize', () => {
    let store: any;
    beforeEach(() => {
        store = { isOnline: true, lastSyncAt: null, status: 'idle', currentModel: null,
            setSyncProgress: jest.fn(patch => Object.assign(store, patch)), addLog: jest.fn() };
        (useSyncStore.getState as jest.Mock).mockReturnValue(store);
        (isLocalWebE2E as jest.Mock).mockReturnValue(false);
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => jest.restoreAllMocks());

    it.each(kinds)('load-order: audited %s first prevents session/pull/watermark/ACK before acquisition', async kind => {
        const { db, dirty, submit } = await fixture(kind);
        const domain = holdDomainBatch(db);
        const writing = outcome(submit()); await domain.entered.promise;
        domain.spy.mockRestore();
        const sync = serviceHarness(db); const ack = ackHarness(db, sync.events);
        const pendingCount = jest.spyOn(sync.service, 'updatePendingCount');
        const syncing = outcome(sync.service.sync(false, { localChange: true }));
        try {
            await flushMicrotasks();
            expect(sync.remote.auth.getSession).not.toHaveBeenCalled();
            expect(sync.remote.rpc).not.toHaveBeenCalled();
            expect(sync.remote.from).not.toHaveBeenCalled();
            expect(ChartOfAccountsService.ensureDeterministicIds).not.toHaveBeenCalled();
            expect(sync.audit.beginSession).not.toHaveBeenCalled();
            expect(pendingCount).not.toHaveBeenCalled();
            expect(sync.events).toEqual([]);
            expect(await getLastPulledAt(db)).toBe(100);
            domain.release.resolve(); expect((await writing).error).toBeNull();
            sync.releaseAll(); ack.releaseAll();
            expect((await syncing).error).toBeNull();
            expect(synchronize).toHaveBeenCalledTimes(1);
            expect(await getLastPulledAt(db)).toBe(200);
            expect(dirty._raw._status).toBe('synced');
            expect(sync.events).toContain('ack:batch:done');
        } finally {
            domain.release.resolve(); sync.releaseAll(); ack.releaseAll(); await Promise.all([writing, syncing]);
        }
    });

    it.each(kinds)('failed audited %s: queued public sync rejects reopen without remote/watermark/ACK', async kind => {
        const { db, dirty, tombstone, submit } = await fixture(kind);
        const domain = holdDomainBatch(db, true);
        const writing = outcome(submit()); await domain.entered.promise; domain.spy.mockRestore();
        const sync = serviceHarness(db); const ack = ackHarness(db, sync.events);
        const syncing = outcome(sync.service.sync(true));
        try {
            await flushMicrotasks();
            expect(sync.remote.auth.getSession).not.toHaveBeenCalled();
            domain.release.resolve(); sync.releaseAll(); ack.releaseAll();
            const failure = (await writing).error;
            expect(failure).toHaveProperty('code', 'AGRI_DATABASE_REOPEN_REQUIRED');
            expect((await syncing).error).toBe(failure);
            expect(sync.remote.auth.getSession).not.toHaveBeenCalled();
            expect(sync.remote.rpc).not.toHaveBeenCalled();
            expect(sync.remote.from).not.toHaveBeenCalled();
            expect(synchronize).not.toHaveBeenCalled();
            expect(sync.audit.beginSession).not.toHaveBeenCalled();
            expect(sync.events).toEqual([]);
            expect(dirty._raw._status).toBe('updated');
            expect(await getLastPulledAt(db)).toBe(100);
            expect(await db.adapter.getDeletedRecords(CORE_TABLE)).toEqual([tombstone.id]);
            expect((sync.service as any).isSyncing).toBe(false);
        } finally {
            domain.release.resolve(); sync.releaseAll(); ack.releaseAll(); await Promise.all([writing, syncing]);
        }
    });

    it.each(kinds)('actual ACK: sync first holds %s outside db.write through batch, cleanup, post-count and audit', async kind => {
        const { db, dirty, tombstone, submit } = await fixture(kind);
        const sync = serviceHarness(db); const ack = ackHarness(db, sync.events);
        const countEntered = deferred(); const countRelease = deferred();
        const updateCount = sync.service.updatePendingCount.bind(sync.service);
        jest.spyOn(sync.service, 'updatePendingCount').mockImplementation(async () => {
            countEntered.resolve(); await countRelease.promise; return updateCount();
        });
        const syncing = outcome(sync.service.sync(true)); await sync.pullEntered.promise;
        const writing = outcome(submit());
        const blockerEntered = deferred(); const blockerRelease = deferred();
        let blocker: Promise<unknown> | undefined;
        try {
            await flushMicrotasks(); expect(ack.domainWrites()).toBe(0);
            expect(await getLastPulledAt(db)).toBe(100);
            sync.pullRelease.resolve(); await sync.pushEntered.promise;
            expect(await getLastPulledAt(db)).toBe(200);
            expect((await db.get<any>(CORE_TABLE).find(sync.remoteId)).category).toBe('DUMMY: pulled carrier');
            expect(sync.writes[0].rows[0].category).toBe('DUMMY: dirty carrier');
            expect(ack.domainWrites()).toBe(0);
            blocker = db.write(async () => { blockerEntered.resolve(); await blockerRelease.promise; }, 'DUMMY: ACK queue blocker');
            await blockerEntered.promise;
            sync.pushRelease.resolve(); await ack.ackQueued.promise;
            expect(ack.domainWrites()).toBe(0);
            blockerRelease.resolve(); await Promise.all([ack.batchEntered.promise, ack.deleteEntered.promise]);
            expect(await db.adapter.getDeletedRecords(CORE_TABLE)).toEqual([tombstone.id]);
            expect(ack.domainWrites()).toBe(0);
            ack.batchRelease.resolve(); await ack.batchDone.promise;
            expect(ack.domainWrites()).toBe(0);
            expect(sync.audit.completeSession).not.toHaveBeenCalled();
            ack.deleteRelease.resolve(); await countEntered.promise;
            expect(await db.adapter.getDeletedRecords(CORE_TABLE)).toEqual([]);
            expect(dirty._raw._status).toBe('synced');
            expect(ack.domainWrites()).toBe(0);
            countRelease.resolve(); await sync.auditEntered.promise;
            expect(ack.domainWrites()).toBe(0);
            expect((sync.service as any).isSyncing).toBe(true);
            sync.auditRelease.resolve();
            expect((await syncing).error).toBeNull(); expect((await writing).error).toBeNull();
            expect(ack.domainWrites()).toBe(1);
            expect(sync.events.indexOf('domain:writer')).toBeGreaterThan(sync.events.indexOf('audit:done'));
            expect(store.status).toBe('completed');
            expect((sync.service as any).isSyncing).toBe(false);
        } finally {
            blockerRelease.resolve(); countRelease.resolve(); sync.releaseAll(); ack.releaseAll();
            await Promise.all([syncing, writing, blocker]);
        }
    });

    it('duplicate public sync is skipped synchronously while the first waits for the operation gate', async () => {
        const { db, submit } = await fixture(); const domain = holdDomainBatch(db);
        const writing = outcome(submit()); await domain.entered.promise; domain.spy.mockRestore();
        const sync = serviceHarness(db); sync.releaseAll();
        const syncing = outcome(sync.service.sync(true));
        try {
            const duplicate = outcome(sync.service.sync(true));
            await flushMicrotasks();
            expect((sync.service as any).isSyncing).toBe(true);
            expect(await duplicate).toEqual({ value: undefined, error: null });
            expect(store.currentModel).toBe('Sync already running');
            expect(sync.remote.auth.getSession).not.toHaveBeenCalled();
            domain.release.resolve(); await Promise.all([writing, syncing]);
            expect(sync.remote.auth.getSession).toHaveBeenCalledTimes(1);
            expect(synchronize).toHaveBeenCalledTimes(1);
        } finally { domain.release.resolve(); sync.releaseAll(); await Promise.all([writing, syncing]); }
    });

    it.each(['offline', 'throttle', 'no-pending', 'mock'] as const)('%s early return releases to a waiting domain writer', async mode => {
        const { db, submit } = await fixture(); const sync = serviceHarness(db); sync.releaseAll();
        const holding = deferred(); const release = deferred();
        const prior = withAgriDatabaseOperation(db, async () => { holding.resolve(); await release.promise; });
        await holding.promise;
        const pendingCount = jest.spyOn(sync.service, 'updatePendingCount').mockResolvedValue(0);
        if (mode === 'offline') store.isOnline = false;
        if (mode === 'throttle' || mode === 'no-pending') store.lastSyncAt = new Date();
        if (mode === 'mock') (isLocalWebE2E as jest.Mock).mockReturnValue(true);
        const syncing = outcome(sync.service.sync(false, { localChange: mode === 'no-pending' }));
        const writing = outcome(submit());
        try {
            await flushMicrotasks();
            expect(pendingCount).not.toHaveBeenCalled();
            expect(ChartOfAccountsService.ensureDeterministicIds).not.toHaveBeenCalled();
            expect((sync.service as any).isSyncing).toBe(true);
            release.resolve(); expect((await syncing).error).toBeNull(); expect((await writing).error).toBeNull();
            expect(sync.remote.auth.getSession).not.toHaveBeenCalled();
            expect(synchronize).not.toHaveBeenCalled();
            expect(store.status).toBe('completed');
            expect(store.currentModel).toBe({ offline: 'Offline mode', throttle: 'Sync recently completed',
                'no-pending': 'No pending changes', mock: 'Sync completed (mock mode)' }[mode]);
            expect((sync.service as any).isSyncing).toBe(false);
        } finally { release.resolve(); sync.releaseAll(); await Promise.all([prior, syncing, writing]); }
    });

    it('ordinary sync failure retains ownership across retries and failure audit, then releases', async () => {
        const { db, submit } = await fixture(); const sync = serviceHarness(db);
        sync.failPull(new Error('DUMMY: network request failed'));
        const syncing = outcome(sync.service.sync(true)); await sync.pullEntered.promise;
        const ack = ackHarness(db, sync.events); const writing = outcome(submit());
        try {
            await flushMicrotasks(); expect(ack.domainWrites()).toBe(0);
            sync.remote.auth.getSession.mockClear(); sync.pullRelease.resolve();
            await sync.failedAuditEntered.promise;
            expect(synchronize).toHaveBeenCalledTimes(3);
            expect(ack.domainWrites()).toBe(0);
            expect((sync.service as any).isSyncing).toBe(true);
            sync.failedAuditRelease.resolve(); expect((await syncing).error).toBeNull();
            expect((await writing).error).toBeNull(); expect(store.status).toBe('error');
            expect(store.errorMessage).toContain('Connection problem');
            expect((sync.service as any).isSyncing).toBe(false);
        } finally { sync.releaseAll(); ack.releaseAll(); await Promise.all([syncing, writing]); }
    });

    it.each([
        ['apply', false], ['apply', true], ['ack', false], ['ack', true],
    ] as const)('local quarantine: %s batch failure (committed=%s) drains cleanup before FIFO release', async (point, committed) => {
        const { db, dirty, tombstone, submit } = await fixture(); const sync = serviceHarness(db);
        if (point === 'apply') sync.deleteOnPull(tombstone.id);
        const local = localFailureHarness(db, point, committed);
        sync.releaseAll();
        let settled = false; let queuedWriterRan = false;
        const syncing = outcome(sync.service.sync(true)).then(result => { settled = true; return result; });
        await Promise.all([local.entered.promise, local.siblingEntered.promise]);
        const writing = outcome(submit());
        const queued = outcome(writeAgriDatabase(db, async () => { queuedWriterRan = true; }));
        try {
            local.release.resolve(); await local.failed.promise; await flushMicrotasks();
            expect(settled).toBe(false);
            expect(queuedWriterRan).toBe(false);
            expect((sync.service as any).isSyncing).toBe(true);
            expect(synchronize).toHaveBeenCalledTimes(1);
            expect(() => assertAgriDatabaseUsable(db)).toThrow(expect.objectContaining({ code: 'AGRI_DATABASE_REOPEN_REQUIRED' }));
            local.siblingRelease.resolve(); await local.siblingDone.promise;
            const failure = (await syncing).error;
            expect(failure).toHaveProperty('code', 'AGRI_DATABASE_REOPEN_REQUIRED');
            expect(failure.originalError).toBe(local.cause);
            expect((await writing).error).toBe(failure);
            expect((await queued).error).toBe(failure);
            expect(queuedWriterRan).toBe(false);
            await expect(AgriParcelService.listParcels(undefined, db)).rejects.toBe(failure);
            await expect(sync.service.updatePendingCount()).rejects.toBe(failure);
            await expect(sync.service.sync(true)).rejects.toBe(failure);
            expect(synchronize).toHaveBeenCalledTimes(1);
            expect(sync.audit.failSession).not.toHaveBeenCalled(); // unknown callback may write to poisoned DB
            expect(store.status).toBe('error');
            expect(store.errorMessage).not.toContain('retry later');
            if (point === 'ack') expect(dirty._raw._status).toBe('synced'); // ACK mutates cache before I/O
        } finally { local.releaseAll(); sync.releaseAll(); await Promise.all([syncing, writing, queued]); }
    });

    it.each(['__watermelon_last_pulled_at', '__watermelon_last_pulled_schema_version'])('local quarantine: setLocal %s failure is terminal', async key => {
        const { db } = await fixture(); const sync = serviceHarness(db); sync.releaseAll();
        // First sync saves schema metadata too, without needing migration history in this fixture.
        if (key.endsWith('schema_version')) await db.adapter.setLocal('__watermelon_last_pulled_at', '0');
        const cause = new Error('DUMMY: setLocal settlement failure');
        const setLocal = db.adapter.setLocal.bind(db.adapter);
        jest.spyOn(db.adapter, 'setLocal').mockImplementation(async (name, value) => {
            await setLocal(name, value);
            if (name === key) throw cause;
        });
        const failure = (await outcome(sync.service.sync(true))).error;
        expect(failure).toMatchObject({ code: 'AGRI_DATABASE_REOPEN_REQUIRED', originalError: cause });
        expect(synchronize).toHaveBeenCalledTimes(1);
        await expect(sync.service.updatePendingCount()).rejects.toBe(failure);
    });

    it('local quarantine: ACK cleanup failure waits for a still-running batch', async () => {
        const { db } = await fixture(); const sync = serviceHarness(db); sync.releaseAll();
        const cause = new Error('DUMMY: tombstone settlement failure');
        const ack = ackHarness(db, sync.events, cause);
        let settled = false;
        const syncing = outcome(sync.service.sync(true)).then(result => { settled = true; return result; });
        await Promise.all([ack.batchEntered.promise, ack.deleteEntered.promise]);
        const work = jest.fn(async () => undefined);
        const queued = outcome(writeAgriDatabase(db, work));
        try {
            ack.deleteRelease.resolve(); await flushMicrotasks();
            expect(() => assertAgriDatabaseUsable(db)).toThrow(expect.objectContaining({ code: 'AGRI_DATABASE_REOPEN_REQUIRED' }));
            expect(settled).toBe(false); expect(work).not.toHaveBeenCalled();
            ack.batchRelease.resolve();
            const failure = (await syncing).error;
            expect(failure).toMatchObject({ code: 'AGRI_DATABASE_REOPEN_REQUIRED', originalError: cause });
            expect((await queued).error).toBe(failure);
            expect(synchronize).toHaveBeenCalledTimes(1);
        } finally { ack.releaseAll(); sync.releaseAll(); await Promise.all([syncing, queued]); }
    });

    it.each(['beginSession', 'record', 'completeSession', 'failSession'] as const)('local quarantine: %s audit callback cannot hide real local batch failure', async method => {
        const { db } = await fixture(); const sync = serviceHarness(db); sync.releaseAll();
        if (method === 'failSession') sync.failPull(new Error('DUMMY: network request failed'));
        const cause = new Error('DUMMY: audit callback local write failure');
        const batch = db.adapter.batch.bind(db.adapter);
        jest.spyOn(db.adapter, 'batch').mockImplementation(async operations => {
            if (operations.some(operation => operation[1] === 'action_logs')) throw cause;
            return batch(operations);
        });
        sync.audit[method].mockImplementationOnce(() => db.write(() => db.get<any>('action_logs').create(row => {
            row.entityType = 'DUMMY: local sync audit';
        }), 'DUMMY: audit writer'));
        const failure = (await outcome(sync.service.sync(true))).error;
        expect(failure).toMatchObject({ code: 'AGRI_DATABASE_REOPEN_REQUIRED', originalError: cause });
        await expect(sync.service.updatePendingCount()).rejects.toBe(failure);
        expect(synchronize).toHaveBeenCalledTimes(method === 'beginSession' ? 0 : method === 'failSession' ? 3 : 1);
        expect(store.status).toBe('error');
    });

    it('remote push transport failure after settled apply remains retryable and leaves DB usable', async () => {
        const { db, dirty } = await fixture(); const sync = serviceHarness(db); sync.releaseAll();
        sync.failPush(new Error('DUMMY: network request failed'));
        expect((await outcome(sync.service.sync(true))).error).toBeNull();
        expect(synchronize).toHaveBeenCalledTimes(3);
        expect(() => assertAgriDatabaseUsable(db)).not.toThrow();
        expect(dirty._raw._status).toBe('updated');
        expect(store.status).toBe('error');
    });

    it('reopen-required code from the actual ACK adapter is permanent and quarantines the Database', async () => {
        const { db } = await fixture(); const sync = serviceHarness(db); sync.releaseAll();
        const error = Object.assign(new Error('DUMMY: reopen required'), { code: 'AGRI_DATABASE_REOPEN_REQUIRED' });
        const batch = db.adapter.batch.bind(db.adapter);
        jest.spyOn(db.adapter, 'batch').mockImplementation(async operations => {
            if (operations.some(operation => operation[0] === 'update' && operation[2]._status === 'synced')) throw error;
            return batch(operations);
        });
        const failure = (await outcome(sync.service.sync(true))).error;
        expect(failure).toMatchObject({ code: error.code, originalError: error });
        expect(synchronize).toHaveBeenCalledTimes(1);
        expect(sync.audit.startAttempt).toHaveBeenCalledTimes(1);
        expect(sync.audit.failSession).not.toHaveBeenCalled();
        await expect(sync.service.updatePendingCount()).rejects.toBe(failure);
        expect(store.status).toBe('error'); expect((sync.service as any).isSyncing).toBe(false);
    });

    it('asserts DB usability before each retry, before another audit attempt or real synchronize reads', async () => {
        const { db } = await fixture(); const sync = serviceHarness(db); sync.releaseAll();
        sync.failPull(new Error('DUMMY: network request failed'));
        const retryEntered = deferred(); const retryRelease = deferred();
        // Explicit retry continuation barrier, not a delay-based race or fake sync.
        jest.spyOn(global, 'setTimeout').mockImplementation(((callback: () => void) => {
            retryEntered.resolve(); void retryRelease.promise.then(callback); return 1;
        }) as any);
        const syncing = outcome(sync.service.sync(true));
        try {
            await retryEntered.promise;
            const batch = jest.spyOn(db.adapter, 'batch').mockRejectedValueOnce(new Error('DUMMY: direct utility uncertainty'));
            const failed = await outcome(db.write(() => runAuditedAgriBatch(db, () => []), 'DUMMY: direct audited utility'));
            batch.mockRestore(); expect(failed.error).toHaveProperty('code', 'AGRI_DATABASE_REOPEN_REQUIRED');
            retryRelease.resolve(); expect((await syncing).error).toBe(failed.error);
            expect(synchronize).toHaveBeenCalledTimes(1);
            expect(sync.audit.startAttempt).toHaveBeenCalledTimes(1);
            expect(sync.audit.failSession).not.toHaveBeenCalled();
            expect(store.status).toBe('error'); expect((sync.service as any).isSyncing).toBe(false);
        } finally { retryRelease.resolve(); sync.releaseAll(); await syncing; }
    });
});
