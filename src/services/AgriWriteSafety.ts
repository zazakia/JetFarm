import { Database, Model } from '@nozbe/watermelondb';

/** Scoped quarantine, not a global Database/adapter monkeypatch. */
const poisonedDatabases = new WeakMap<Database, AgriDatabaseReopenRequiredError>();

export class AgriDatabaseReopenRequiredError extends Error {
    readonly code = 'AGRI_DATABASE_REOPEN_REQUIRED';
    constructor(readonly originalError: unknown) {
        super('Local database write outcome is uncertain. Discard this Database and all cached models/subscriptions; reopen persisted storage before reading or retrying the same operation ID.');
        this.name = 'AgriDatabaseReopenRequiredError';
    }
}

export function assertAgriDatabaseUsable(db: Database): void {
    const error = poisonedDatabases.get(db);
    if (error) throw error;
}

/** Preserve the first uncertainty and the exact error shared by all later callers. */
export function quarantineAgriDatabase(db: Database, cause: unknown): AgriDatabaseReopenRequiredError {
    let error = poisonedDatabases.get(db);
    if (!error) {
        error = cause instanceof AgriDatabaseReopenRequiredError ? cause : new AgriDatabaseReopenRequiredError(cause);
        poisonedDatabases.set(db, error);
    }
    return error;
}

/**
 * Internal-only WDB 0.27.1 sync scope; caller already owns the operation FIFO.
 * Delegate to the SAME Database, caches and writer queue, without replacing any
 * methods on it or its adapter. Only synchronize receives this short-lived view.
 * Its apply/ACK writers run batch and tombstone cleanup in fail-fast Promise.all:
 * drain both branches INSIDE the writer before it (or the FIFO) can release.
 * Remote callbacks run outside these writers, so transport failures still retry.
 * No phase-string/private-adapter dependency; turbo sync is not supported here.
 */
export async function withAgriSyncWriteScope<T>(db: Database, work: (view: Database) => Promise<T>): Promise<T> {
    assertAgriDatabaseUsable(db);
    const pending = new Set<Promise<void>>();
    const settle = async () => {
        while (pending.size) await Promise.all(Array.from(pending));
    };
    const track = <R>(operation: () => Promise<R>): Promise<R> => {
        assertAgriDatabaseUsable(db);
        // Dispatch synchronously: WDB preparation and batch must not be separated by await.
        const result = (async () => {
            try { return await operation(); }
            catch (cause) { throw quarantineAgriDatabase(db, cause); }
        })();
        const settlement = result.then(() => undefined, () => undefined);
        pending.add(settlement);
        void settlement.then(() => pending.delete(settlement));
        return result;
    };
    const batch: Database['batch'] = (...records) => track(() => db.batch(...records));
    const write: Database['write'] = (writer, description) => db.write(async handle => {
        assertAgriDatabaseUsable(db);
        try { return await writer(handle); }
        catch (cause) { throw quarantineAgriDatabase(db, cause); }
        finally {
            await settle();
            assertAgriDatabaseUsable(db);
        }
    }, description);
    let adapter: Database['adapter'] | undefined;
    const getAdapter = () => adapter ?? (adapter = new Proxy(db.adapter, {
        get(target, key) {
            if (key === 'destroyDeletedRecords') return (...args: Parameters<typeof target.destroyDeletedRecords>) =>
                track(() => target.destroyDeletedRecords(...args));
            if (key === 'setLocal') return (...args: Parameters<typeof target.setLocal>) =>
                track(() => target.setLocal(...args));
            const value = Reflect.get(target, key);
            return typeof value === 'function' ? value.bind(target) : value;
        },
    }));
    const view = new Proxy(db, {
        get(target, key) {
            if (key === 'adapter') return getAdapter();
            if (key === 'batch') return batch;
            if (key === 'write') return write;
            const value = Reflect.get(target, key);
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });
    try { return await work(view); }
    finally {
        await settle();
        assertAgriDatabaseUsable(db);
    }
}

// Each tail is a release signal, never the work promise: failures cannot reject the queue.
const operationTails = new WeakMap<Database, Promise<void>>();

/**
 * Internal-only, non-reentrant operation gate. Acquire outside WDB readers/writers,
 * never from an existing gated operation. Hold whole sync executions, including
 * acknowledgement, cleanup and retries, not just their remote callbacks.
 */
export async function withAgriDatabaseOperation<T>(db: Database, work: () => Promise<T>): Promise<T> {
    const previous = operationTails.get(db) ?? Promise.resolve();
    let release!: () => void;
    const tail = new Promise<void>(resolve => { release = resolve; });
    operationTails.set(db, tail);
    await previous;
    try {
        // A preceding audited writer may have quarantined this Database while we waited.
        assertAgriDatabaseUsable(db);
        return await work();
    } finally {
        release();
        if (operationTails.get(db) === tail) operationTails.delete(db);
    }
}

/**
 * Internal-only writer owner; all domain callers enter from outside a WDB writer.
 * Do not use through callWriter: WDB 0.27.1 requires synchronous db.write entry,
 * whereas acquiring this gate awaits. Delegates and audited batches must not reacquire.
 */
export function writeAgriDatabase<T>(db: Database, writer: () => Promise<T>): Promise<T> {
    return withAgriDatabaseOperation(db, () => db.write(async () => {
        assertAgriDatabaseUsable(db);
        return writer();
    }));
}

/** Call inside the writer; prepare and dispatch synchronously, without an intervening await. */
export async function runAuditedAgriBatch(db: Database, prepare: () => Model[]): Promise<void> {
    assertAgriDatabaseUsable(db);
    try {
        await db.batch(...prepare());
    } catch (cause) {
        // Watermelon 0.27.1 Model.prepareUpdate mutates _raw, and Database.batch clears
        // update pending flags BEFORE adapter I/O. Neither exposes a supported rollback API.
        // Cache eviction alone leaves live models/subscriptions and adapter-side ID caches stale.
        // A rejected promise may also follow a committed batch or a notification failure:
        // never restore snapshots or claim the operation was uncommitted on that evidence.
        throw quarantineAgriDatabase(db, cause);
    }
}
