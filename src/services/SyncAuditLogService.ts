import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type SyncAuditDirection = 'pull' | 'push' | 'system';
export type SyncAuditResult = 'success' | 'failed' | 'deferred' | 'rejected-conflict';
export type SyncAuditFailureKind = 'schema' | 'permission' | 'auth' | 'timeout' | 'network' | 'constraint' | 'unknown';

export interface SyncAuditEvent {
    eventId: string;
    timestamp: string;
    attempt: number;
    direction: SyncAuditDirection;
    source: 'watermelon' | 'supabase' | 'sync-engine';
    target: 'watermelon' | 'supabase' | 'sync-engine';
    localTable: string | null;
    remoteTable: string | null;
    operation: string;
    recordIds: string[];
    count: number;
    result: SyncAuditResult;
    durationMs: number | null;
    failureKind: SyncAuditFailureKind | null;
    errorCode: string | null;
}

export interface SyncAuditSession {
    format: 'poscursor.sync-audit.v1';
    sessionId: string;
    status: 'running' | 'completed' | 'failed';
    remoteEnvironment: 'local' | 'production' | 'unknown';
    platform: string;
    watermelonSchemaVersion: number | null;
    payloadFieldsLogged: false;
    startedAt: string;
    finishedAt: string | null;
    attempts: number[];
    events: SyncAuditEvent[];
    failureKind: SyncAuditFailureKind | null;
    errorCode: string | null;
}

export interface SyncAuditStorage {
    loadSessions(): Promise<SyncAuditSession[]>;
    saveSessions(sessions: SyncAuditSession[]): Promise<void>;
    exportSession(session: SyncAuditSession): Promise<string>;
    clearSessions(): Promise<void>;
}

export interface SyncAuditEventInput {
    attempt: number;
    direction: SyncAuditDirection;
    source: SyncAuditEvent['source'];
    target: SyncAuditEvent['target'];
    localTable?: string | null;
    remoteTable?: string | null;
    operation: string;
    recordIds?: (string | null | undefined)[];
    result: SyncAuditResult;
    durationMs?: number | null;
    failureKind?: SyncAuditFailureKind | null;
    errorCode?: string | null;
}

export interface SyncAuditFailureInput {
    attempt: number;
    direction: SyncAuditDirection;
    localTable?: string | null;
    remoteTable?: string | null;
    operation: string;
    recordIds?: (string | null | undefined)[];
    failureKind: SyncAuditFailureKind;
    error?: { code?: unknown; [key: string]: unknown } | null;
}

const STORAGE_KEY = 'poscursor.sync-audit.sessions.v1';

function createId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeErrorCode(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return /^[A-Za-z0-9_-]{1,64}$/.test(trimmed) ? trimmed : null;
}

function serializeSession(session: SyncAuditSession): string {
    return JSON.stringify(session, null, 2);
}

export class DefaultSyncAuditStorage implements SyncAuditStorage {
    async loadSessions(): Promise<SyncAuditSession[]> {
        if (process.env.NODE_ENV !== 'test' && Platform.OS !== 'web') {
            return this.loadNativeFiles();
        }
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        try {
            const parsed = JSON.parse(stored);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    async saveSessions(sessions: SyncAuditSession[]): Promise<void> {
        if (process.env.NODE_ENV !== 'test' && Platform.OS !== 'web') {
            await this.saveNativeFiles(sessions);
            return;
        }
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    }

    async exportSession(session: SyncAuditSession): Promise<string> {
        const fileName = `sync-audit-${session.sessionId}.json`;
        const contents = serializeSession(session);
        if (Platform.OS === 'web') {
            if (typeof document === 'undefined') return fileName;
            const blob = new Blob([contents], { type: 'application/json' });
            const href = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = href;
            anchor.download = fileName;
            anchor.click();
            URL.revokeObjectURL(href);
            return fileName;
        }

        const uri = await this.writeNativeFile(session);
        const Sharing = await import('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export detailed sync log' });
        }
        return uri;
    }

    async clearSessions(): Promise<void> {
        await AsyncStorage.removeItem(STORAGE_KEY);
        if (process.env.NODE_ENV !== 'test' && Platform.OS !== 'web') {
            const FileSystem = await import('expo-file-system/legacy');
            const directory = `${FileSystem.documentDirectory}sync-audit/`;
            await FileSystem.deleteAsync(directory, { idempotent: true });
        }
    }

    private async loadNativeFiles(): Promise<SyncAuditSession[]> {
        const FileSystem = await import('expo-file-system/legacy');
        if (!FileSystem.documentDirectory) return [];
        const directory = `${FileSystem.documentDirectory}sync-audit/`;
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
        const files = await FileSystem.readDirectoryAsync(directory);
        const sessions: SyncAuditSession[] = [];
        for (const file of files.filter(name => name.endsWith('.json'))) {
            try {
                const contents = await FileSystem.readAsStringAsync(`${directory}${file}`);
                const session = JSON.parse(contents);
                if (session?.format === 'poscursor.sync-audit.v1') sessions.push(session);
            } catch {
                // Ignore a damaged log file; other retained sessions remain exportable.
            }
        }
        return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    }

    private async saveNativeFiles(sessions: SyncAuditSession[]): Promise<void> {
        const FileSystem = await import('expo-file-system/legacy');
        if (!FileSystem.documentDirectory) throw new Error('Sync audit document directory is unavailable');
        const directory = `${FileSystem.documentDirectory}sync-audit/`;
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
        const retainedFiles = new Set(sessions.map(session => `sync-audit-${session.sessionId}.json`));
        for (const session of sessions) await this.writeNativeFile(session);
        for (const file of await FileSystem.readDirectoryAsync(directory)) {
            if (file.endsWith('.json') && !retainedFiles.has(file)) {
                await FileSystem.deleteAsync(`${directory}${file}`, { idempotent: true });
            }
        }
    }

    private async writeNativeFile(session: SyncAuditSession): Promise<string> {
        const FileSystem = await import('expo-file-system/legacy');
        if (!FileSystem.documentDirectory) throw new Error('Sync audit document directory is unavailable');
        const directory = `${FileSystem.documentDirectory}sync-audit/`;
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
        const uri = `${directory}sync-audit-${session.sessionId}.json`;
        await FileSystem.writeAsStringAsync(uri, serializeSession(session));
        return uri;
    }
}

export class SyncAuditLogService {
    private sessions: SyncAuditSession[] | null = null;
    private currentSessionId: string | null = null;
    private writeQueue: Promise<unknown> = Promise.resolve();

    constructor(
        private storage: SyncAuditStorage = new DefaultSyncAuditStorage(),
        private options: { maxSessions?: number; maxIdsPerEvent?: number } = {},
    ) {}

    async beginSession(metadata: {
        remoteEnvironment: SyncAuditSession['remoteEnvironment'];
        platform: string;
        watermelonSchemaVersion: number | null;
    }): Promise<string> {
        return this.enqueue(async () => {
            await this.ensureLoaded();
            const sessionId = createId('sync');
            const session: SyncAuditSession = {
                format: 'poscursor.sync-audit.v1',
                sessionId,
                status: 'running',
                remoteEnvironment: metadata.remoteEnvironment,
                platform: metadata.platform,
                watermelonSchemaVersion: metadata.watermelonSchemaVersion,
                payloadFieldsLogged: false,
                startedAt: new Date().toISOString(),
                finishedAt: null,
                attempts: [],
                events: [],
                failureKind: null,
                errorCode: null,
            };
            this.currentSessionId = sessionId;
            this.sessions = [session, ...(this.sessions ?? [])].slice(0, this.options.maxSessions ?? 30);
            await this.persist();
            return sessionId;
        });
    }

    async startAttempt(attempt: number): Promise<void> {
        return this.enqueue(async () => {
            const session = await this.requireCurrentSession();
            if (!session.attempts.includes(attempt)) session.attempts.push(attempt);
            await this.persist();
        });
    }

    async record(input: SyncAuditEventInput): Promise<void> {
        return this.enqueue(async () => {
            const session = await this.requireCurrentSession();
            const ids = (input.recordIds ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0);
            const chunkSize = Math.max(1, this.options.maxIdsPerEvent ?? 500);
            const chunks: string[][] = ids.length === 0
                ? [[]]
                : Array.from({ length: Math.ceil(ids.length / chunkSize) }, (_, index) => ids.slice(index * chunkSize, (index + 1) * chunkSize));
            for (const recordIds of chunks) {
                session.events.push({
                    eventId: createId('event'),
                    timestamp: new Date().toISOString(),
                    attempt: input.attempt,
                    direction: input.direction,
                    source: input.source,
                    target: input.target,
                    localTable: input.localTable ?? null,
                    remoteTable: input.remoteTable ?? null,
                    operation: input.operation,
                    recordIds,
                    count: recordIds.length,
                    result: input.result,
                    durationMs: typeof input.durationMs === 'number' ? input.durationMs : null,
                    failureKind: input.failureKind ?? null,
                    errorCode: safeErrorCode(input.errorCode),
                });
            }
            await this.persist();
        });
    }

    async recordFailure(input: SyncAuditFailureInput): Promise<void> {
        await this.record({
            attempt: input.attempt,
            direction: input.direction,
            source: input.direction === 'pull' ? 'supabase' : 'watermelon',
            target: input.direction === 'pull' ? 'watermelon' : 'supabase',
            localTable: input.localTable,
            remoteTable: input.remoteTable,
            operation: input.operation,
            recordIds: input.recordIds,
            result: 'failed',
            failureKind: input.failureKind,
            errorCode: safeErrorCode(input.error?.code),
        });
    }

    async completeSession(): Promise<void> {
        return this.finishSession('completed', null, null);
    }

    async failSession(error: { code?: unknown; failureKind: SyncAuditFailureKind }): Promise<void> {
        return this.finishSession('failed', error.failureKind, safeErrorCode(error.code));
    }

    async exportLatest(): Promise<string> {
        await this.writeQueue;
        const session = await this.getLatestSession();
        if (!session) throw new Error('No detailed sync log is available yet');
        return this.storage.exportSession(session);
    }

    async clearRetainedSessions(): Promise<void> {
        return this.enqueue(async () => {
            this.sessions = [];
            this.currentSessionId = null;
            await this.storage.clearSessions();
        });
    }

    async listSessions(): Promise<SyncAuditSession[]> {
        await this.writeQueue;
        await this.ensureLoaded();
        return JSON.parse(JSON.stringify(this.sessions ?? []));
    }

    async getLatestSession(): Promise<SyncAuditSession | null> {
        const sessions = await this.listSessions();
        return sessions[0] ?? null;
    }

    async getSession(sessionId: string): Promise<SyncAuditSession | null> {
        const sessions = await this.listSessions();
        return sessions.find(session => session.sessionId === sessionId) ?? null;
    }

    private async finishSession(
        status: 'completed' | 'failed',
        failureKind: SyncAuditFailureKind | null,
        errorCode: string | null,
    ): Promise<void> {
        return this.enqueue(async () => {
            const session = await this.requireCurrentSession();
            session.status = status;
            session.finishedAt = new Date().toISOString();
            session.failureKind = failureKind;
            session.errorCode = errorCode;
            await this.persist();
        });
    }

    private async requireCurrentSession(): Promise<SyncAuditSession> {
        await this.ensureLoaded();
        const session = (this.sessions ?? []).find(item => item.sessionId === this.currentSessionId);
        if (!session) throw new Error('No active sync audit session');
        return session;
    }

    private async ensureLoaded(): Promise<void> {
        if (this.sessions !== null) return;
        this.sessions = await this.storage.loadSessions();
    }

    private async persist(): Promise<void> {
        await this.storage.saveSessions(this.sessions ?? []);
    }

    private enqueue<T>(operation: () => Promise<T>): Promise<T> {
        const next = this.writeQueue.then(operation, operation);
        this.writeQueue = next.then(() => undefined, () => undefined);
        return next;
    }
}

export const syncAuditLogService = new SyncAuditLogService();
