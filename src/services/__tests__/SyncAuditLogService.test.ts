import { SyncAuditLogService, SyncAuditSession, SyncAuditStorage } from '../SyncAuditLogService';

class MemoryAuditStorage implements SyncAuditStorage {
    sessions: SyncAuditSession[] = [];
    exportedSessionId: string | null = null;
    activeWrites = 0;
    maxActiveWrites = 0;

    async loadSessions(): Promise<SyncAuditSession[]> {
        return structuredClone(this.sessions);
    }

    async saveSessions(sessions: SyncAuditSession[]): Promise<void> {
        this.activeWrites += 1;
        this.maxActiveWrites = Math.max(this.maxActiveWrites, this.activeWrites);
        await new Promise(resolve => setTimeout(resolve, 1));
        this.sessions = structuredClone(sessions);
        this.activeWrites -= 1;
    }

    async exportSession(session: SyncAuditSession): Promise<string> {
        this.exportedSessionId = session.sessionId;
        return `sync-audit-${session.sessionId}.json`;
    }

    async clearSessions(): Promise<void> {
        this.sessions = [];
    }
}

describe('SyncAuditLogService', () => {
    function createService() {
        const storage = new MemoryAuditStorage();
        const service = new SyncAuditLogService(storage, { maxSessions: 30, maxIdsPerEvent: 500 });
        return { storage, service };
    }

    it('persists every record id while chunking large table events', async () => {
        const { service } = createService();
        const sessionId = await service.beginSession({
            remoteEnvironment: 'production',
            platform: 'android',
            watermelonSchemaVersion: 41,
        });
        const ids = Array.from({ length: 1001 }, (_, index) => `borrower-${index}`);

        await service.record({
            attempt: 1,
            direction: 'push',
            source: 'watermelon',
            target: 'supabase',
            localTable: 'borrowers',
            remoteTable: 'app_borrowers',
            operation: 'upsert-created',
            recordIds: ids,
            result: 'success',
            durationMs: 12,
        });
        await service.completeSession();

        const session = await service.getSession(sessionId);
        expect(session?.events).toHaveLength(3);
        expect(session?.events.every(event => event.recordIds.length <= 500)).toBe(true);
        expect(session?.events.flatMap(event => event.recordIds)).toEqual(ids);
        expect(session?.payloadFieldsLogged).toBe(false);
    });

    it('serializes concurrent persistence writes', async () => {
        const { service, storage } = createService();
        await service.beginSession({ remoteEnvironment: 'local', platform: 'web', watermelonSchemaVersion: 41 });

        await Promise.all(Array.from({ length: 8 }, (_, index) => service.record({
            attempt: 1,
            direction: 'pull',
            source: 'supabase',
            target: 'watermelon',
            localTable: 'payments',
            remoteTable: 'app_payments',
            operation: 'remote-fetch-upsert',
            recordIds: [`payment-${index}`],
            result: 'success',
            durationMs: index,
        })));

        expect(storage.maxActiveWrites).toBe(1);
        expect((await service.getLatestSession())?.events).toHaveLength(8);
    });

    it('retains only safe error metadata and never raw payload details', async () => {
        const { service } = createService();
        await service.beginSession({ remoteEnvironment: 'production', platform: 'web', watermelonSchemaVersion: 41 });

        await service.recordFailure({
            attempt: 1,
            direction: 'push',
            localTable: 'borrowers',
            remoteTable: 'app_borrowers',
            operation: 'upsert-updated',
            recordIds: ['borrower-1'],
            failureKind: 'schema',
            error: {
                code: 'PGRST204',
                message: 'gsis_number failed for jane@example.com token=secret address=Main Street',
                details: 'raw borrower payload',
            },
        });

        const serialized = JSON.stringify(await service.getLatestSession());
        expect(serialized).toContain('PGRST204');
        expect(serialized).toContain('schema');
        expect(serialized).not.toContain('jane@example.com');
        expect(serialized).not.toContain('token=secret');
        expect(serialized).not.toContain('Main Street');
        expect(serialized).not.toContain('raw borrower payload');
    });

    it('keeps failed sessions exportable', async () => {
        const { service, storage } = createService();
        const sessionId = await service.beginSession({ remoteEnvironment: 'production', platform: 'android', watermelonSchemaVersion: 41 });
        await service.failSession({ code: 'PGRST204', failureKind: 'schema' });

        const exported = await service.exportLatest();
        expect(exported).toBe(`sync-audit-${sessionId}.json`);
        expect(storage.exportedSessionId).toBe(sessionId);
        expect((await service.getSession(sessionId))?.status).toBe('failed');
    });

    it('enforces the retained session limit', async () => {
        const { service } = createService();
        for (let index = 0; index < 31; index += 1) {
            await service.beginSession({ remoteEnvironment: 'local', platform: 'web', watermelonSchemaVersion: 41 });
            await service.completeSession();
        }

        expect(await service.listSessions()).toHaveLength(30);
    });
});
