import { Database } from '@nozbe/watermelondb';
import { synchronize } from '@nozbe/watermelondb/sync';
import { getLastPulledAt } from '@nozbe/watermelondb/sync/impl';
import uuid from 'react-native-uuid';
import { createTestDatabase } from '../../__tests__/test-utils';
import { AgriParcelService } from '../AgriParcelService';
import { AgriBlockService } from '../AgriBlockService';
import { AgriBlockAssignmentService } from '../AgriBlockAssignmentService';
import { ActionLogService } from '../ActionLogService';
import { assertAgriDatabaseUsable, runAuditedAgriBatch, withAgriDatabaseOperation, writeAgriDatabase } from '../AgriWriteSafety';

jest.mock('../../database', () => ({ database: {} }));
jest.mock('../AuthService', () => ({ AuthService: { getCurrentUserId: jest.fn().mockResolvedValue('DUMMY: supervisor') } }));

// DUMMY: synthetic geometry, UUIDs, dates and identities; no network or production storage.
const geometry = { outer: [{ latitude: 0, longitude: 0 }, { latitude: 0.001, longitude: 0 },
    { latitude: 0.001, longitude: 0.001 }, { latitude: 0, longitude: 0.001 }], holes: [] };
const id = () => uuid.v4() as string;
const EMPTY = { created: [], updated: [], deleted: [] };
const kinds = ['layout', 'clear', 'boundary', 'assignment', 'progress'] as const;
type Kind = typeof kinds[number];

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
}

// Flush promise continuations only. Barriers, never elapsed-time races, control I/O.
async function flushMicrotasks() {
    for (let i = 0; i < 20; i++) await Promise.resolve();
}

const outcome = <T>(promise: Promise<T>) => promise.then(value => ({ value, error: null }), error => ({ value: null, error }));

async function fixture(kind: Kind = 'layout') {
    const db = createTestDatabase();
    const parcel = await AgriParcelService.createParcel({ name: 'DUMMY: parcel', landOwnerId: 'DUMMY: owner',
        areaHectares: 1, gpsCoordinates: geometry.outer }, db);
    const blockId = id();
    let workerId = '';
    let assignmentId = '';
    if (kind === 'assignment' || kind === 'progress') {
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
    const tombstone = await db.write(() => db.get<any>('feature_flags').create(row => { row.key = 'DUMMY: deleted flag'; }));
    await synchronize({ database: db, pullChanges: async () => ({ changes: {}, timestamp: 100 }), pushChanges: async () => ({}) });
    await db.write(async () => {
        await parcel.update(row => { row.name = 'DUMMY: dirty parcel'; });
        await tombstone.markAsDeleted();
    });
    const operationId = id();
    const command = { parcelId: parcel.id, expectedRevision: parcel.layoutRevision, operationId };
    const submit = (): Promise<unknown> => {
        switch (kind) {
            case 'layout': return AgriBlockService.saveLayout({ ...command, geometry, blocks: [] }, db);
            case 'clear': return AgriBlockService.clearBoundary(command, db);
            case 'boundary': return AgriBlockService.saveBoundary({ ...command, geometry }, db);
            case 'assignment': return AgriBlockAssignmentService.assignWorkers({ blockId, workerIds: [workerId],
                task: 'DUMMY: weeding', startDate: 0, submissionId: operationId }, db);
            case 'progress': return AgriBlockAssignmentService.recordProgress({ assignmentId, progressPercent: 40,
                status: 'in_progress', updateDate: 0, submissionId: operationId }, db);
        }
    };
    return { db, parcel, tombstone, submit };
}

function syncHarness(db: Database) {
    const pullEntered = deferred(); const pullRelease = deferred();
    const pushEntered = deferred(); const pushRelease = deferred();
    const ackQueued = deferred(); const batchEntered = deferred(); const batchRelease = deferred(); const batchDone = deferred();
    const deleteEntered = deferred(); const deleteRelease = deferred();
    const events: string[] = [];
    let ackRunning = false;
    let pushed: any;
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
    });
    const remoteId = id();
    const start = () => withAgriDatabaseOperation(db, async () => {
        events.push('sync:entered');
        await synchronize({ database: db,
            pullChanges: async () => {
                events.push('pull'); pullEntered.resolve(); await pullRelease.promise;
                return { changes: { feature_flags: { ...EMPTY, created: [{ id: remoteId, key: 'DUMMY: pulled flag' }] } }, timestamp: 200 };
            },
            pushChanges: async ({ changes }) => {
                pushed = changes; events.push('push'); pushEntered.resolve(); await pushRelease.promise;
                events.push('push:returned'); return {};
            },
        });
        events.push('sync:done');
    });
    const releaseAll = () => { pullRelease.resolve(); pushRelease.resolve(); batchRelease.resolve(); deleteRelease.resolve(); };
    const domainWrites = () => writeSpy.mock.calls.filter(([, description]) => description === undefined).length;
    return { start, events, remoteId, pullEntered, pullRelease, pushEntered, pushRelease, ackQueued,
        batchEntered, batchRelease, batchDone, deleteEntered, deleteRelease, releaseAll, domainWrites, pushed: () => pushed };
}

describe('per-Database operation gate with installed WDB synchronize', () => {
    afterEach(() => jest.restoreAllMocks());

    it.each(kinds)('sync first: %s cannot enqueue a writer until queued ACK, batch AND tombstone cleanup finish', async kind => {
        const { db, parcel, tombstone, submit } = await fixture(kind);
        const sync = syncHarness(db);
        const syncing = outcome(sync.start());
        await sync.pullEntered.promise;
        const writing = outcome(submit());
        const blockerRelease = deferred();
        let blocker: Promise<unknown> | undefined;
        try {
            await flushMicrotasks();
            expect(sync.domainWrites()).toBe(0); // catches bypass BEFORE db.write, even while pull has no WDB writer
            expect(parcel._raw._status).toBe('updated');
            expect(await getLastPulledAt(db)).toBe(100);
            sync.pullRelease.resolve();
            await sync.pushEntered.promise;
            expect(await getLastPulledAt(db)).toBe(200);
            expect((await db.get<any>('feature_flags').find(sync.remoteId)).key).toBe('DUMMY: pulled flag');
            expect(sync.pushed().agri_parcels.updated[0].name).toBe('DUMMY: dirty parcel');
            expect(sync.domainWrites()).toBe(0);
            const blockerEntered = deferred();
            blocker = db.write(async () => { blockerEntered.resolve(); await blockerRelease.promise; }, 'DUMMY: ACK queue blocker');
            await blockerEntered.promise;
            sync.pushRelease.resolve();
            await sync.ackQueued.promise;
            expect(sync.events).toContain('push:returned');
            expect(sync.domainWrites()).toBe(0); // not released at the push callback boundary
            blockerRelease.resolve();
            await Promise.all([sync.batchEntered.promise, sync.deleteEntered.promise]);
            expect(await db.adapter.getDeletedRecords('feature_flags')).toEqual([tombstone.id]);
            expect(sync.domainWrites()).toBe(0);
            sync.batchRelease.resolve();
            await sync.batchDone.promise;
            expect(sync.events).not.toContain('sync:done');
            expect(sync.domainWrites()).toBe(0); // batch completion alone is not complete ACK
            sync.deleteRelease.resolve();
            expect((await syncing).error).toBeNull();
            expect((await writing).error).toBeNull();
            expect(await db.adapter.getDeletedRecords('feature_flags')).toEqual([]);
            expect(sync.events.indexOf('domain:writer')).toBeGreaterThan(sync.events.indexOf('sync:done'));
            expect(sync.domainWrites()).toBe(1); // delegated boundary commands do not nest the gate
        } finally {
            blockerRelease.resolve(); sync.releaseAll();
            await Promise.all([syncing, writing, blocker]);
        }
    });

    it.each(['layout', 'assignment', 'progress'] as const)('domain first: %s holds sync outside pull until its real adapter batch settles', async kind => {
        const { db, parcel, submit } = await fixture(kind);
        const entered = deferred(); const release = deferred();
        const batch = db.adapter.batch.bind(db.adapter);
        const adapterSpy = jest.spyOn(db.adapter, 'batch').mockImplementationOnce(async operations => {
            entered.resolve(); await release.promise; return batch(operations);
        });
        const writing = outcome(submit());
        await entered.promise;
        adapterSpy.mockRestore(); // Keep the in-flight barrier, but do not wrap an existing spy recursively.
        const sync = syncHarness(db);
        const syncing = outcome(sync.start());
        try {
            await flushMicrotasks();
            expect(sync.events).toEqual([]); // no local sync reads, remote pull, or apply writer before acquisition
            expect(await getLastPulledAt(db)).toBe(100);
            release.resolve();
            expect((await writing).error).toBeNull();
            sync.releaseAll();
            expect((await syncing).error).toBeNull();
            expect(await getLastPulledAt(db)).toBe(200);
            expect(parcel._raw._status).toBe('synced');
        } finally {
            release.resolve(); sync.releaseAll(); await Promise.all([writing, syncing]);
        }
    });

    it.each(['layout', 'assignment', 'progress'] as const)('failed audited %s poisons before queued sync acquisition: no pull/watermark/ACK cleanup', async kind => {
        const { db, tombstone, submit } = await fixture(kind);
        const entered = deferred(); const release = deferred();
        const adapterSpy = jest.spyOn(db.adapter, 'batch').mockImplementationOnce(async () => {
            entered.resolve(); await release.promise; throw new Error('DUMMY: uncertain adapter result');
        });
        const writing = outcome(submit());
        await entered.promise;
        adapterSpy.mockRestore();
        const sync = syncHarness(db);
        const syncing = outcome(sync.start());
        try {
            await flushMicrotasks();
            expect(sync.events).toEqual([]);
            release.resolve(); sync.releaseAll();
            const failedWrite = await writing;
            expect(failedWrite.error).toMatchObject({ code: 'AGRI_DATABASE_REOPEN_REQUIRED' });
            expect((await syncing).error).toBe(failedWrite.error);
            expect(sync.events).toEqual([]);
            expect(await getLastPulledAt(db)).toBe(100);
            expect(await db.adapter.getDeletedRecords('feature_flags')).toEqual([tombstone.id]);
        } finally {
            release.resolve(); sync.releaseAll(); await Promise.all([writing, syncing]);
        }
    });

    it('ordinary audit-preparation failure releases to the next sync without quarantining', async () => {
        const { db, submit } = await fixture();
        const entered = deferred(); const release = deferred();
        const collection = db.get('agri_parcels');
        const find = collection.find.bind(collection);
        jest.spyOn(collection, 'find').mockImplementationOnce(async recordId => {
            entered.resolve(); await release.promise; return find(recordId);
        });
        jest.spyOn(ActionLogService.prototype, 'prepareLogActionsSync').mockImplementationOnce(() => { throw new Error('DUMMY: audit unavailable'); });
        const writing = outcome(submit());
        await entered.promise;
        const sync = syncHarness(db); const syncing = outcome(sync.start());
        try {
            await flushMicrotasks(); expect(sync.events).toEqual([]);
            release.resolve();
            expect((await writing).error.message).toBe('DUMMY: audit unavailable');
            sync.releaseAll(); expect((await syncing).error).toBeNull();
            expect(() => assertAgriDatabaseUsable(db)).not.toThrow();
        } finally {
            release.resolve(); sync.releaseAll(); await Promise.all([writing, syncing]);
        }
    });

    it('FIFO survives ordinary rejection and a synchronous throw; work results propagate', async () => {
        const db = createTestDatabase();
        const entered = deferred(); const release = deferred(); const events: number[] = [];
        const failure = new Error('DUMMY: ordinary failure');
        const first = outcome(withAgriDatabaseOperation(db, async () => { events.push(1); entered.resolve(); await release.promise; throw failure; }));
        await entered.promise;
        const second = outcome(withAgriDatabaseOperation(db, () => { events.push(2); throw failure; }));
        const third = withAgriDatabaseOperation(db, async () => { events.push(3); return 42; });
        try {
            await flushMicrotasks(); expect(events).toEqual([1]);
        } finally { release.resolve(); }
        expect((await first).error).toBe(failure);
        expect((await second).error).toBe(failure);
        expect(await third).toBe(42);
        expect(events).toEqual([1, 2, 3]);
    });

    it('waiting/rejection on one Database never blocks or poisons another Database', async () => {
        const first = await fixture(); const other = await fixture();
        const entered = deferred(); const release = deferred();
        jest.spyOn(first.db.adapter, 'batch').mockImplementationOnce(async () => {
            entered.resolve(); await release.promise; throw new Error('DUMMY: first DB uncertain');
        });
        const failing = outcome(first.submit()); await entered.promise;
        try { expect(await other.submit()).toBe(1); }
        finally { release.resolve(); }
        expect((await failing).error).toMatchObject({ code: 'AGRI_DATABASE_REOPEN_REQUIRED' });
        expect(await withAgriDatabaseOperation(other.db, async () => 'DUMMY: usable')).toBe('DUMMY: usable');
    });

    it('reasserts quarantine INSIDE a WDB writer queued behind a direct audited utility failure', async () => {
        const { db } = await fixture(); const entered = deferred(); const release = deferred();
        jest.spyOn(db.adapter, 'batch').mockImplementationOnce(async () => {
            entered.resolve(); await release.promise; throw new Error('DUMMY: uncertain direct batch');
        });
        const direct = outcome(db.write(() => runAuditedAgriBatch(db, () => [
            db.get<any>('feature_flags').prepareCreate(row => { row.key = 'DUMMY: utility'; }),
        ])));
        await entered.promise;
        let ran = false;
        const writing = outcome(writeAgriDatabase(db, async () => { ran = true; return 1; }));
        await flushMicrotasks(); release.resolve();
        const failure = (await direct).error;
        expect((await writing).error).toBe(failure);
        expect(ran).toBe(false);
    });

    it('has no timeout early-release or waiter cancellation while the holder remains unsettled', async () => {
        const db = createTestDatabase(); const entered = deferred(); const release = deferred();
        let ran = false;
        jest.useFakeTimers();
        const holding = withAgriDatabaseOperation(db, async () => { entered.resolve(); await release.promise; });
        await entered.promise;
        const waiting = withAgriDatabaseOperation(db, async () => { ran = true; return 7; });
        try {
            await jest.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
            expect(ran).toBe(false);
            expect(jest.getTimerCount()).toBe(0);
        } finally { release.resolve(); jest.useRealTimers(); }
        await holding;
        expect(await waiting).toBe(7); // waiting operation was not cancelled
    });
});
