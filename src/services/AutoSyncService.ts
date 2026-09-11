import { Q } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import { supabase as globalSupabase } from '../database/supabase';
import { useSyncStore } from '../stores/syncStore';
import { REMOTE_TABLE_MAP, SyncService, SYNC_TABLES } from './SyncService';

type Timer = ReturnType<typeof setTimeout>;
type Subscription = { unsubscribe: () => void };
type RealtimeChannel = {
    on: (type: string, filter: Record<string, unknown>, callback: (payload: unknown) => void) => RealtimeChannel;
    subscribe: (callback?: (status: string) => void) => RealtimeChannel;
    unsubscribe?: () => Promise<unknown> | unknown;
};
type RealtimeClient = {
    channel?: (name: string) => RealtimeChannel;
    removeChannel?: (channel: RealtimeChannel) => Promise<unknown> | unknown;
};

const DEFAULT_DEBOUNCE_MS = 3000;
const SYNCING_RECHECK_MS = 5000;
const RETRY_DELAYS_MS = [5000, 15000, 60000, 300000];

/**
 * Watches WatermelonDB's `_status` metadata and uploads pending local changes
 * automatically. WatermelonDB remains the source of truth for what is new,
 * updated, or deleted; this service only debounces and schedules sync cycles.
 */
export class AutoSyncServiceClass {
    private timer: Timer | null = null;
    private subscriptions: Subscription[] = [];
    private realtimeChannel: RealtimeChannel | null = null;
    private started = false;
    private retryAttempt = 0;
    private realtimeRetryAttempt = 0;
    private realtimeRetryTimer: Timer | null = null;
    private realtimeDisabled = false;
    private authenticated = false;
    private lastReason = 'local-change';

    constructor(
        private db = globalDatabase,
        private syncService = SyncService,
        private realtimeClient: RealtimeClient = globalSupabase
    ) {}

    start(): void {
        if (this.started) return;
        this.started = true;

        for (const tableName of SYNC_TABLES) {
            try {
                const collection = this.db.collections.get(tableName);
                const observable = collection
                    .query(Q.where('_status', Q.oneOf(['created', 'updated', 'deleted'])))
                    .observeCount(false);

                const subscription = observable.subscribe((count: number) => {
                    if (count > 0) {
                        this.queue(`${tableName}-pending`);
                    }
                });
                this.subscriptions.push(subscription);
            } catch (error) {
                console.warn(`[AutoSyncService] Could not watch ${tableName}:`, error);
            }
        }

        if (this.authenticated) this.startRealtimePullTriggers();
        this.queue('autosync-start', 0);
    }

    setAuthenticated(authenticated: boolean): void {
        if (this.authenticated === authenticated) return;
        this.authenticated = authenticated;
        if (!this.started) return;

        if (authenticated) {
            this.realtimeDisabled = false;
            this.realtimeRetryAttempt = 0;
            this.startRealtimePullTriggers();
            this.queue('auth-session-ready', 0);
            return;
        }

        if (this.realtimeRetryTimer) {
            clearTimeout(this.realtimeRetryTimer);
            this.realtimeRetryTimer = null;
        }
        this.realtimeRetryAttempt = 0;
        this.realtimeDisabled = false;
        void this.stopRealtimePullTriggers();
    }

    stop(): void {
        this.started = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.realtimeRetryTimer) {
            clearTimeout(this.realtimeRetryTimer);
            this.realtimeRetryTimer = null;
        }
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
        this.subscriptions = [];
        void this.stopRealtimePullTriggers();
        this.retryAttempt = 0;
        this.realtimeRetryAttempt = 0;
        this.authenticated = false;
    }

    queue(reason = 'local-change', debounceMs = DEFAULT_DEBOUNCE_MS): void {
        this.lastReason = reason;
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.flush();
        }, debounceMs);
    }

    async flush(): Promise<void> {
        const store = useSyncStore.getState();
        if (store.isOnline === false) {
            await this.syncService.updatePendingCount();
            return;
        }

        if (store.status === 'syncing') {
            this.queue('sync-already-running', SYNCING_RECHECK_MS);
            return;
        }

        const pendingBefore = await this.syncService.updatePendingCount();
        if (pendingBefore <= 0) {
            this.retryAttempt = 0;
            return;
        }

        try {
            await this.syncService.checkAndSync({
                force: false,
                localChange: true,
                reason: this.lastReason,
            });

            const pendingAfter = await this.syncService.updatePendingCount();
            const latestStore = useSyncStore.getState();
            if (pendingAfter <= 0 && latestStore.status !== 'error') {
                this.retryAttempt = 0;
                return;
            }

            if (latestStore.errorMessage?.includes('No active session')) {
                return;
            }

            this.scheduleRetry();
        } catch (error) {
            console.warn('[AutoSyncService] Automatic sync failed:', error);
            this.scheduleRetry();
        }
    }

    private scheduleRetry(): void {
        if (useSyncStore.getState().isOnline === false) return;

        const delay = RETRY_DELAYS_MS[Math.min(this.retryAttempt, RETRY_DELAYS_MS.length - 1)];
        this.retryAttempt += 1;
        this.queue('autosync-retry', delay);
    }

    private startRealtimePullTriggers(): void {
        if (!this.authenticated || !this.realtimeClient.channel || this.realtimeChannel || this.realtimeDisabled) return;

        try {
            const remoteTables = Array.from(new Set(
                SYNC_TABLES.map(tableName => REMOTE_TABLE_MAP[tableName] ?? tableName)
            ));

            let channel = this.realtimeClient.channel('autosync-remote-changes');
            for (const table of remoteTables) {
                channel = channel.on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table },
                    () => this.queue(`remote-change:${table}`, 1000)
                );
            }

            this.realtimeChannel = channel.subscribe((status: string) => {
                if (status === 'SUBSCRIBED') {
                    this.realtimeRetryAttempt = 0;
                    return;
                }

                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn(`[AutoSyncService] Realtime channel status: ${status}`);
                    this.scheduleRealtimeReconnect(status);
                }
            });
        } catch (error) {
            console.warn('[AutoSyncService] Could not start realtime pull triggers:', error);
            this.realtimeChannel = null;
        }
    }

    private scheduleRealtimeReconnect(status: string): void {
        if (!this.started || !this.authenticated || this.realtimeRetryTimer || this.realtimeDisabled) return;

        if (this.realtimeRetryAttempt >= RETRY_DELAYS_MS.length) {
            this.realtimeDisabled = true;
            console.warn(`[AutoSyncService] Realtime disabled after repeated ${status}. Local-change auto sync remains active.`);
            void this.stopRealtimePullTriggers();
            return;
        }

        const delay = RETRY_DELAYS_MS[this.realtimeRetryAttempt++];
        this.realtimeRetryTimer = setTimeout(async () => {
            this.realtimeRetryTimer = null;
            await this.stopRealtimePullTriggers();
            if (this.started && this.authenticated) this.startRealtimePullTriggers();
        }, delay);
    }

    private async stopRealtimePullTriggers(): Promise<void> {
        if (!this.realtimeChannel) return;

        const channel = this.realtimeChannel;
        this.realtimeChannel = null;

        try {
            if (this.realtimeClient.removeChannel) {
                await this.realtimeClient.removeChannel(channel);
            } else if (channel.unsubscribe) {
                await channel.unsubscribe();
            }
        } catch (error) {
            console.warn('[AutoSyncService] Could not stop realtime pull triggers:', error);
        }
    }
}

export const AutoSyncService = new AutoSyncServiceClass();
export default AutoSyncService;
