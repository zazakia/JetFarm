import { synchronize } from '@nozbe/watermelondb/sync';
import { Q } from '@nozbe/watermelondb';
import { Platform } from 'react-native';
import { database } from '../database';
import { supabase as globalSupabase, withTimeout } from '../database/supabase';
import { perf } from '../utils/PerformanceTracker';
import { useSyncStore } from '../stores/syncStore';
import { ErrorService, ErrorType } from './ErrorService';
import syncTableContract from './syncTableContract.json';
import {
    assertAgriDatabaseUsable, quarantineAgriDatabase, withAgriDatabaseOperation, withAgriSyncWriteScope,
} from './AgriWriteSafety';
import {
    syncAuditLogService,
    SyncAuditEventInput,
    SyncAuditFailureInput,
    SyncAuditLogService,
} from './SyncAuditLogService';
import { isLocalWebE2E } from '../utils/e2eEnvironment';
import {
    sanitizeAuditJsonString,
    stripLocalOnlySettingValue,
} from '../utils/auditPayloadSanitizer';

const CONFIG_SYNC_ENABLED =
    process.env.EXPO_PUBLIC_ENABLE_CONFIG_SYNC === '1' ||
    process.env.EXPO_PUBLIC_ENABLE_CONFIG_SYNC === 'true';

// Local WatermelonDB table names that are guaranteed to exist on the remote API.
const CORE_SYNC_TABLES = syncTableContract.coreTables;

// Settings/configuration tables were added after the production Supabase schema.
// Keep them out of the default sync set until the remote migration has been
// applied, otherwise PostgREST logs noisy 404s for every sync cycle.
export const CONFIG_SYNC_TABLES = syncTableContract.configTables;

// Priority Sync Groups for future optimizations
export const HIGH_PRIORITY_SYNC_TABLES = [
    'payments',
    'remittances',
    'action_logs',
];

export const LOW_PRIORITY_SYNC_TABLES = [
    'expense_categories',
    'areas',
    'app_settings',
    'loan_products',
];

// These domains require verified atomic layout cloud support, not independent
// upserts/pulls. Config sync does NOT enable them; no validated layout RPC exists yet.
const DEFERRED_LAYOUT_TABLES = new Set([
    'agri_parcel_blocks', 'agri_block_assignments', 'agri_block_progress',
    ...syncTableContract.localOnlyTables,
]);
const NEW_PARCEL_GEOMETRY_COLUMNS = [
    'gps_exclusions', 'boundary_revision', 'layout_revision', 'boundary_saved_at',
];
const MANAGED_PARCEL_GEOMETRY_COLUMNS = [
    'gps_coordinates', 'area_hectares', ...NEW_PARCEL_GEOMETRY_COLUMNS,
];

function parseAuditObject(value: unknown): Record<string, any> | null {
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function isLocalMappingAudit(record: any): boolean {
    if (DEFERRED_LAYOUT_TABLES.has(record.entity_type)) return true;
    const oldData = parseAuditObject(record.old_data);
    const newData = parseAuditObject(record.new_data);
    const hasScope = (value: unknown, parsed: Record<string, any> | null) => parsed
        ? parsed.sync_scope === 'agri_mapping_local'
        : typeof value === 'string' && value.trimStart().startsWith('{') &&
            /"sync_scope"\s*:\s*"agri_mapping_local"/.test(value);
    // The audit sanitizer can truncate JSON mid-object. Such a payload with
    // mapping signals cannot be proven unrelated, so retain it conservatively.
    // Valid JSON still requires a TOP-LEVEL scope, not a nested marker.
    if (hasScope(record.old_data, oldData) || hasScope(record.new_data, newData)) return true;
    if (record.entity_type !== 'agri_parcels') return false;
    // Older parcel layout audits predate the explicit scope marker, including clear commands.
    if (newData) return Object.prototype.hasOwnProperty.call(newData, 'geometry') &&
        typeof newData.operationId === 'string' && newData.operationId.length > 0 &&
        (Object.prototype.hasOwnProperty.call(newData, 'targetRevision') ||
            Object.prototype.hasOwnProperty.call(newData, 'requestJson'));
    return typeof record.new_data === 'string' && record.new_data.trimStart().startsWith('{') &&
        /"geometry"\s*:/.test(record.new_data) && /"operationId"\s*:\s*"[^"]+"/.test(record.new_data) &&
        /"(?:targetRevision|requestJson)"\s*:/.test(record.new_data);
}

// Local WatermelonDB table names eligible for generic sync.
export const SYNC_TABLES = (CONFIG_SYNC_ENABLED
    ? [...CONFIG_SYNC_TABLES, ...CORE_SYNC_TABLES]
    : CORE_SYNC_TABLES).filter(table => !DEFERRED_LAYOUT_TABLES.has(table));
const ENABLED_SYNC_TABLES = new Set(SYNC_TABLES);

// Mapping from WatermelonDB local table name → Supabase remote table name
export const REMOTE_TABLE_MAP: Record<string, string> = syncTableContract.remoteTableMap;

const TABLE_UPSERT_OPTIONS: Record<string, { onConflict?: string }> = {
    app_settings: { onConflict: 'key' },
};


// Only feature-gated configuration tables may be absent. Every core table is
// required: silently skipping a missing core table would advance the global
// WatermelonDB watermark and make that data loss persistent.
const OPTIONAL_REMOTE_TABLES = new Set(CONFIG_SYNC_TABLES);

function isMissingRemoteTableError(error: any): boolean {
    const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return (
        error?.code === 'PGRST205' ||
        error?.status === 404 ||
        message.includes('could not find the table') ||
        message.includes('schema cache')
    );
}

type SyncFailureKind = 'schema' | 'permission' | 'auth' | 'timeout' | 'network' | 'constraint' | 'unknown';

function getSyncFailureKind(error: unknown): SyncFailureKind {
    const value = error as any;
    const search = [
        value?.message,
        value?.details,
        value?.hint,
        value?.code,
        value?.status,
        value?.name,
    ].filter(Boolean).join(' ').toLowerCase();

    if (
        value?.code === 'PGRST205' ||
        value?.code === 'PGRST204' ||
        value?.code === '22P02' ||
        search.includes('pgrst205') ||
        search.includes('pgrst204') ||
        search.includes('22p02') ||
        search.includes('invalid_text_representation') ||
        search.includes('invalid input syntax for type') ||
        (search.includes('could not find') && search.includes('column')) ||
        search.includes('schema cache') ||
        search.includes('could not find the table') ||
        search.includes('schema/configuration')
    ) return 'schema';
    if (
        value?.status === 403 ||
        value?.code === '42501' ||
        search.includes('permission denied') ||
        search.includes('row-level security') ||
        search.includes('rls')
    ) return 'permission';
    if (
        value?.status === 401 ||
        search.includes('invalid jwt') ||
        search.includes('jwt expired') ||
        search.includes('authentication') ||
        search.includes('session missing')
    ) return 'auth';
    if (search.includes('timed out') || search.includes('timeout') || search.includes('aborterror')) return 'timeout';
    if (
        value?.code === '23502' ||
        value?.code === '23503' ||
        value?.code === '23505' ||
        search.includes('foreign key') ||
        search.includes('duplicate key') ||
        search.includes('constraint') ||
        search.includes('not-null')
    ) return 'constraint';
    if (
        search.includes('failed to fetch') ||
        search.includes('network request failed') ||
        search.includes('networkerror') ||
        search.includes('connection problem')
    ) return 'network';
    return 'unknown';
}

function formatSupabaseError(error: any): string {
    return [error?.code, error?.message, error?.details, error?.hint]
        .filter(Boolean)
        .join(' - ') || String(error);
}

function isPermanentSyncError(error: unknown): boolean {
    return (error as any)?.code === 'AGRI_DATABASE_REOPEN_REQUIRED' ||
        ['schema', 'permission', 'auth', 'constraint'].includes(getSyncFailureKind(error));
}

const MIN_SYNC_INTERVAL = 60000; // 60 seconds cooldown
const SYNC_SESSION_TIMEOUT_MS = 8000;
const SERVER_TIME_TIMEOUT_MS = 5000;
const TABLE_PAGE_TIMEOUT_MS = 30000;
const UPSERT_TIMEOUT_MS = 30000;

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (isPermanentSyncError(err)) throw err;
            if (attempt < maxAttempts) {
                const exponentialDelay = 250 * (2 ** (attempt - 1));
                const jitter = Math.floor(Math.random() * 100);
                await new Promise(r => setTimeout(r, exponentialDelay + jitter));
            }
        }
    }
    throw lastError;
}

const withSyncTimeout = async <T,>(
    promise: PromiseLike<T>,
    timeoutMs: number,
    operationName: string
): Promise<T> => {
    const normalizedPromise = Promise.resolve(promise);

    if (typeof withTimeout === 'function') {
        return withTimeout(normalizedPromise, timeoutMs, operationName);
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
            () => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
            timeoutMs
        );
    });

    try {
        return await Promise.race([normalizedPromise, timeoutPromise]);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
};

export interface SyncPartitionFilter {
    branchId?: string | null;
    role?: string | null;
    areaId?: string | null;
    accessibleBranchIds?: string[];
}

const REMOTE_TO_LOCAL_MAPPING: Record<string, string> = Object.fromEntries(
    Object.entries(REMOTE_TABLE_MAP).map(([local, remote]) => [remote, local])
);

export function deterministicUuid(seedStr: string): string {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        hash = (Math.imul(31, hash) + seedStr.charCodeAt(i)) | 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `00000000-0000-4000-8000-${hex.repeat(2).slice(0, 12)}`;
}

export class SyncService {
    private static readonly DATE_FIELDS = [
        'created_at',
        'updated_at',
        'deleted_at',
        'date_of_birth',
        'release_date',
        'first_payment_date',
        'maturity_date',
        'due_date',
        'payment_date',
        'entry_date',
        'penalty_date',
        'expense_date',
        'transaction_date',
        'log_date',
        'snapshot_date',
        'encoded_at',
        'remittance_date',
        'date',
        'timestamp',
        'period_start',
        'period_end',
        'term_start',
        'term_end',
        'resolution_date',
        'meeting_date',
        'delivery_date',
        'date_joined',
        'date_accepted',
        'pmes_date',
        'spouse_date_of_birth',
        'termination_date',
        'date_of_death',
        'approved_at',
        'application_date',
        'cleared_at',
        'hire_date',
        'separation_date',
        'posted_at',
        'start_date',
        'end_date',
        'invoice_date',
        'movement_date',
        'dispatched_at',
        'received_at',
        'verified_at',
        'contract_start',
        'contract_end',
        'renewal_date',
        'audit_date',
        'resolved_at',
        'wipe_completed_at',
        'last_heartbeat',
        'last_sync_at',
        'registered_at',
        'settled_at',
        'pay_date',
        'effective_from',
        'effective_to'
    ];

    /**
     * Maps table names to date field names that are stored as BIGINT (epoch milliseconds) in Supabase.
     * These should NOT be converted to ISO strings.
     */
    private static readonly TABLE_BIGINT_FIELDS: Record<string, string[]> = {
        loan_penalties: ['penalty_date'],
        dependents: ['created_at', 'updated_at', 'deleted_at', 'date_of_birth'],
        children: ['created_at', 'updated_at', 'deleted_at', 'date_of_birth'],
        share_capital_transactions: ['created_at', 'updated_at', 'deleted_at', 'date'],
        committees: ['created_at', 'updated_at', 'deleted_at'],
        committee_members: ['created_at', 'updated_at', 'deleted_at', 'term_start', 'term_end'],
        board_resolutions: ['created_at', 'updated_at', 'deleted_at', 'resolution_date'],
        meeting_attendance: ['created_at', 'updated_at', 'deleted_at', 'meeting_date'],
        file_cases: ['filed_date', 'created_at', 'updated_at', 'deleted_at'],
        borrowers: ['date_accepted', 'pmes_date', 'spouse_date_of_birth', 'termination_date'],
        loans: ['approved_at', 'delinquent_since'],
        agri_parcel_blocks: ['created_at', 'updated_at', 'deleted_at'],
        agri_block_assignments: ['start_date', 'due_date', 'created_at', 'updated_at', 'deleted_at'],
        agri_block_progress: ['update_date', 'created_at', 'updated_at'],
    };

    private static isBigIntField(tableName: string, fieldName: string): boolean {
        if (fieldName === 'penalty_date') return true;
        const fields = this.TABLE_BIGINT_FIELDS[tableName];
        return fields ? fields.includes(fieldName) : false;
    }

    /**
     * FK fields that must contain valid UUIDs or be nullified.
     * Invalid UUIDs in these fields cause FK constraint violations on push.
     */
    public static readonly UUID_FK_FIELDS = [
        'collector_id', 'auth_id', 'created_by', 'encoded_by', 'borrower_id',
        'loan_id', 'schedule_id', 'previous_loan_id', 'bank_account_id',
        'area_id', 'member_id', 'application_id', 'employee_id', 'committee_id',
        'parent_area_id', 'customer_id', 'delivery_id', 'approved_by',
        'recorded_by', 'posted_by', 'product_id', 'ao_id',
        'journal_entry_id', 'source_id'
    ];

    public static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    public static readonly TEXT_NON_UUID_FIELDS = new Set([
        'module_id',
        'module_source_id',
        'device_id',
        'business_unit_id',
        'area_supervisor_id',
        'entity_id',
        'performed_by',
        'source_table',
        'module_source_table',
        'reference_entity_id',
    ]);

    private isSyncing = false;
    private clockOffset = 0;
    private unavailableOptionalRemoteTables = new Set<string>();
    private activeAuditAttempt = 1;
    private auditSessionActive = false;
    private partitionFilter: SyncPartitionFilter | null = null;

    constructor(
        private db = database,
        private supabase = globalSupabase,
        private audit: Pick<SyncAuditLogService, 'beginSession' | 'startAttempt' | 'record' | 'recordFailure' | 'completeSession' | 'failSession'> = syncAuditLogService
    ) {}

    static setPartitionFilter(filter: SyncPartitionFilter | null): void {
        this.instance.partitionFilter = filter;
    }

    static getPartitionFilter(): SyncPartitionFilter | null {
        return this.instance.partitionFilter;
    }

    public setPartitionFilter(filter: SyncPartitionFilter | null): void {
        this.partitionFilter = filter;
    }

    public getPartitionFilter(): SyncPartitionFilter | null {
        return this.partitionFilter;
    }

    private applyBranchPartitionFilter(query: any, localTableName: string): any {
        if (!this.partitionFilter) return query;
        const { branchId, role, accessibleBranchIds } = this.partitionFilter;

        // Executive, admin, and main_office roles see all branches globally
        if (!role || role === 'admin' || role === 'main_office' || role === 'executive') {
            return query;
        }

        // Branch-scoped roles: cashier, manager
        if (role === 'branch_cashier' || role === 'branch_manager') {
            if (!branchId) return query;
            if (localTableName === 'commissary_dispatches') {
                return typeof query.eq === 'function' ? query.eq('to_branch_id', branchId) : query;
            }
            if (localTableName === 'waste_logs' || localTableName === 'royalty_calculations') {
                return typeof query.eq === 'function' ? query.eq('branch_id', branchId) : query;
            }
        }

        // Area supervisor scoped to their assigned store cluster
        if (role === 'area_supervisor') {
            const targetBranchIds = accessibleBranchIds && accessibleBranchIds.length > 0
                ? accessibleBranchIds
                : (branchId ? [branchId] : []);
            if (targetBranchIds.length === 0) return query;

            if (localTableName === 'commissary_dispatches') {
                return typeof query.in === 'function' ? query.in('to_branch_id', targetBranchIds) : query;
            }
            if (localTableName === 'waste_logs' || localTableName === 'royalty_calculations') {
                return typeof query.in === 'function' ? query.in('branch_id', targetBranchIds) : query;
            }
        }

        return query;
    }

    private async writeAudit<T>(operation: () => Promise<T>): Promise<T | null> {
        assertAgriDatabaseUsable(this.db);
        try {
            return await operation();
        } catch (error) {
            assertAgriDatabaseUsable(this.db);
            // The concrete default writes only files/AsyncStorage, not WDB. An
            // injected callback has no read-only contract and may have mutated
            // cached models before rejecting; never blindly swallow its failure.
            if (this.audit !== syncAuditLogService) throw quarantineAgriDatabase(this.db, error);
            console.warn('[SyncService] Detailed sync audit persistence failed', error);
            useSyncStore.getState().setSyncProgress({
                auditPersistenceWarning: 'Detailed sync log could not be saved on this device. The data sync itself will continue.',
            });
            return null;
        }
    }

    private async recordAudit(input: SyncAuditEventInput): Promise<void> {
        if (!this.auditSessionActive) return;
        await this.writeAudit(() => this.audit.record(input));
    }

    private async recordAuditFailure(input: SyncAuditFailureInput): Promise<void> {
        if (!this.auditSessionActive) return;
        await this.writeAudit(() => this.audit.recordFailure(input));
    }

    private getAuditEnvironment(): 'local' | 'production' | 'unknown' {
        const url = String((this.supabase as any)?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '').toLowerCase();
        if (url.includes('YOUR_SUPABASE_PROJECT.supabase.co')) return 'production';
        if (url.includes('127.0.0.1') || url.includes('localhost') || url.includes('10.0.2.2')) return 'local';
        return 'unknown';
    }

    private static instance = new SyncService();

    static setInstance(instance: SyncService): void {
        this.instance = instance;
    }

    static async checkAndSync(options: { force?: boolean; localChange?: boolean; reason?: string } = {}): Promise<void> {
        return this.instance.checkAndSync(options);
    }

    static async updatePendingCount(): Promise<number> {
        return this.instance.updatePendingCount();
    }

    static async sync(force: boolean = false): Promise<void> {
        return this.instance.sync(force);
    }

    /**
     * Entry point for sync check
     */
    public async checkAndSync(options: { force?: boolean; localChange?: boolean; reason?: string } = {}): Promise<void> {
        assertAgriDatabaseUsable(this.db);
        if (this.isSyncing) {
            console.log('[SyncService] Sync already in progress, skipping checkAndSync...');
            useSyncStore.getState().setSyncProgress({
                currentModel: 'Sync already running',
            });
            return;
        }
        await this.sync(options.force, { localChange: options.localChange, reason: options.reason });
        await this.updatePendingCount();
    }

    /**
     * Updates the global store with the number of pending changes.
     * Uses a single query per table (Q.oneOf) instead of 3 separate queries.
     */
    public async updatePendingCount(): Promise<number> {
        assertAgriDatabaseUsable(this.db);
        try {
            let totalPending = 0;
            for (const tableName of SYNC_TABLES) {
                try {
                    const collection = this.db.collections.get(tableName);
                    if (!collection) continue;
                    const count = await collection.query(
                        Q.where('_status', Q.oneOf(['created', 'updated', 'deleted']))
                    ).fetchCount();
                    totalPending += count;
                } catch (tableErr) {
                    console.warn(`[SyncService] Skipping pending count for ${tableName}:`, tableErr);
                }
            }
            useSyncStore.getState().setSyncProgress({ pendingChanges: totalPending });
            return totalPending;
        } catch (error) {
            console.warn('[SyncService] Failed to update pending count:', error);
            return 0;
        }
    }

    /**
     * Performs the actual synchronization
     */
    public async sync(force: boolean = false, options: { localChange?: boolean; reason?: string } = {}): Promise<void> {
        assertAgriDatabaseUsable(this.db);
        if (this.isSyncing) {
            console.log('[SyncService] Sync already in progress, skipping...');
            useSyncStore.getState().setSyncProgress({
                currentModel: 'Sync already running',
            });
            return;
        }

        // Reserve synchronously: duplicate requests must skip even while we wait
        // for a domain operation. Never wrap synchronize in a WatermelonDB writer.
        this.isSyncing = true;
        try {
            await withAgriDatabaseOperation(this.db, () => this.syncWithinOperation(force, options));
        } finally {
            this.isSyncing = false;
        }
    }

    /** Non-reentrant: caller owns the operation gate through retries, ACK and audit. */
    private async syncWithinOperation(force: boolean, options: { localChange?: boolean; reason?: string }): Promise<void> {
        const store = useSyncStore.getState();

        // Offline devices should not start a regular sync cycle.
        if (store.isOnline === false && !force) {
            console.log('[SyncService] Device is offline, skipping sync...');
            store.setSyncProgress({
                status: 'completed',
                progress: 1,
                currentModel: 'Offline mode',
            });
            return;
        }

        // Throttling logic: skip automatic syncs if last sync was very recent.
        // Local-change autosync may bypass this cooldown only when WatermelonDB
        // has pending records. This keeps background checks quiet while still
        // uploading newly-created/updated/deleted data quickly.
        const lastSyncAt = store.lastSyncAt;
        if (!force && lastSyncAt) {
            const timeSinceLastSync = Date.now() - new Date(lastSyncAt).getTime();
            if (timeSinceLastSync < MIN_SYNC_INTERVAL) {
                if (options.localChange) {
                    const pendingChanges = await this.updatePendingCount();
                    if (pendingChanges > 0) {
                        console.log(`[SyncService] Bypassing sync cooldown for ${pendingChanges} pending local change(s).`);
                    } else {
                        console.log('[SyncService] Local-change sync requested but no pending changes were found.');
                        store.setSyncProgress({
                            status: 'completed',
                            progress: 1,
                            currentModel: 'No pending changes',
                        });
                        return;
                    }
                } else {
                    console.log(`[SyncService] Sync throttled (last sync ${Math.round(timeSinceLastSync / 1000)}s ago). Use force=true to override.`);
                    store.setSyncProgress({
                        status: 'completed',
                        progress: 1,
                        currentModel: 'Sync recently completed',
                    });
                    return;
                }
            }
        }

        const startTime = Date.now();
        console.log('[SyncService] Starting sync cycle...');

        // Execute data cleanup/migrations for Chart of Accounts to ensure deterministic IDs
        try {
            const { ChartOfAccountsService } = require('./ChartOfAccountsService');
            await ChartOfAccountsService.ensureDeterministicIds();
        } catch (err) {
            console.warn('[SyncService] Failed to run Chart of Accounts deterministic ID migration:', err);
        }

        if (isLocalWebE2E()) {
            console.log('[SyncService] Mock sync completed (E2E/pages.dev mode)');
            store.setSyncProgress({
                status: 'completed',
                progress: 1,
                currentModel: 'Sync completed (mock mode)',
                errorMessage: null,
                lastSyncAt: new Date(),
            });
            return;
        }

        try {
            store.setSyncProgress({ status: 'syncing', progress: 0.04, currentModel: 'Checking session...', errorMessage: null });

            // Ensure we have a session before attempting to sync with Supabase
            const { data: { session }, error: sessionError } = await withSyncTimeout(
                this.supabase.auth.getSession(),
                SYNC_SESSION_TIMEOUT_MS,
                'Sync session check'
            );
            if (sessionError) {
                console.warn('[SyncService] Skipping sync: session lookup failed', sessionError);
                store.setSyncProgress({
                    status: 'error',
                    progress: 1,
                    currentModel: 'Session check failed',
                    errorMessage: ErrorService.getUserMessage(sessionError, 'Unable to verify your session. Please sign in again.'),
                });
                return;
            }
            if (!session) {
                console.warn('[SyncService] Skipping sync: No active session found');
                store.setSyncProgress({
                    status: 'error',
                    progress: 1,
                    currentModel: 'No active session',
                    errorMessage: 'Please sign in to sync your data.',
                });
                return;
            }
            store.setSyncProgress({
                status: 'syncing',
                progress: 0,
                currentModel: 'Initializing...',
                errorMessage: null,
                auditPersistenceWarning: null,
            });
            store.addLog({ timestamp: new Date(), type: 'info', message: 'Sync started' });
            const auditSessionId = await this.writeAudit(() => this.audit.beginSession({
                remoteEnvironment: this.getAuditEnvironment(),
                platform: Platform.OS,
                watermelonSchemaVersion: (this.db as any)?.schema?.version ?? null,
            }));
            this.auditSessionActive = typeof auditSessionId === 'string';
            if (auditSessionId) {
                store.setSyncProgress({ latestAuditSessionId: auditSessionId });
            }

            // Calculate clock offset with server to account for device clock skew
            try {
                const { data } = await withSyncTimeout(
                    this.supabase.rpc('get_server_time'),
                    SERVER_TIME_TIMEOUT_MS,
                    'Server time lookup'
                );
                if (data) {
                    const serverTime = new Date(data).getTime();
                    this.clockOffset = serverTime - Date.now();
                    console.log(`[SyncService] Clock offset with server: ${this.clockOffset}ms`);
                }
            } catch (e) {
                console.log('[SyncService] Could not fetch server time for offset, using last known drift', e);
            }

            let totalPulled = 0;
            let syncAttempt = 0;
            await withRetry(async () => {
                assertAgriDatabaseUsable(this.db);
                syncAttempt += 1;
                this.activeAuditAttempt = syncAttempt;
                if (this.auditSessionActive) {
                    await this.writeAudit(() => this.audit.startAttempt(syncAttempt));
                }
                return withAgriSyncWriteScope(this.db, view => synchronize({
                database: view,
                // sendCreatedAsUpdated: true tells WatermelonDB to treat local
                // 'created' records as 'updated' on push. Combined with our pull
                // strategy (all active records go into the 'updated' array),
                // this ensures that records missing locally are auto-created by
                // WatermelonDB from the 'updated' array. This is the recommended
                // pattern per WatermelonDB docs for server-centric sync.
                sendCreatedAsUpdated: true,
                // Version 11 is the version immediately before this repository's
                // first WatermelonDB migration (toVersion: 12). Enabling migration
                // sync prevents an upgraded client from applying its old global
                // watermark to a newly added table or column.
                migrationsEnabledAtVersion: 11,
                pullChanges: async ({ lastPulledAt, migration }) => {
                    assertAgriDatabaseUsable(this.db);
                    return await perf.measure('Sync.Pull', async () => {
                        // Use a 2-second look-back safety window to ensure no records are missed
                        // due to network latency or database commit timing differences.
                        const lastSyncDate = lastPulledAt 
                            ? new Date(lastPulledAt - 2000).toISOString() 
                            : null;
                        
                        // Try to get server time for WatermelonDB's next lastPulledAt.
                        let serverTime = Date.now() + this.clockOffset;
                        try {
                            const { data } = await withSyncTimeout(
                                this.supabase.rpc('get_server_time'),
                                SERVER_TIME_TIMEOUT_MS,
                                'Pull server time lookup'
                            );
                            if (data) serverTime = new Date(data).getTime();
                        } catch (e) {
                            console.log('[SyncService] Could not refresh server time, using offset-adjusted clock', e);
                        }
                        const serverWatermark = new Date(serverTime).toISOString();

                        const tablesToPull = SYNC_TABLES;
                        const migrationTables = new Set<string>([
                            ...(migration?.tables ?? []),
                            ...(migration?.columns ?? []).map(entry => entry.table),
                        ]);
                        const total = tablesToPull.length;

                        store.setSyncProgress({ currentModel: 'Pulling changes...', progress: 0.1 });
                        const pullStartTime = Date.now();

                        const results = await Promise.allSettled(
                            tablesToPull.map(tableName => this.fetchTableChanges(
                                tableName,
                                migrationTables.has(tableName) ? null : lastSyncDate,
                                serverWatermark
                            ))
                        );
                        const changes: Record<string, any> = {};
                        
                        // Surface table-level failures to sync logs (not just console)
                        const failures = results
                            .map((r, i) => ({ result: r, table: tablesToPull[i] }))
                            .filter(f => f.result.status === 'rejected');
                        if (failures.length > 0) {
                            ErrorService.handleError(failures, '[SyncService] Some table fetches failed:');
                            const details = failures.map(f => {
                                const reason = (f.result as PromiseRejectedResult).reason;
                                return `${f.table}: ${reason?.message || String(reason)}`;
                            });
                            for (const f of failures) {
                                const reason = (f.result as PromiseRejectedResult).reason;
                                store.addLog({
                                    timestamp: new Date(),
                                    type: 'error',
                                    message: `Pull failed: ${f.table}`,
                                    detail: reason?.message || String(reason),
                                });
                                await this.recordAuditFailure({
                                    attempt: this.activeAuditAttempt,
                                    direction: 'pull',
                                    localTable: f.table,
                                    remoteTable: REMOTE_TABLE_MAP[f.table] ?? f.table,
                                    operation: 'remote-fetch',
                                    recordIds: [],
                                    failureKind: getSyncFailureKind(reason),
                                    error: reason,
                                });
                            }
                            throw new Error(this.buildPullFailureMessage(failures.length, details));
                        }

                        for (let i = 0; i < results.length; i += 1) {
                            const result = results[i];
                            const localTableName = tablesToPull[i];
                            const remoteTableName = REMOTE_TABLE_MAP[localTableName] ?? localTableName;
                            const tableData = result.status === 'fulfilled'
                                ? result.value
                                : { created: [], updated: [], deleted: [] };

                            changes[localTableName] = tableData;
                            const upsertIds = [
                                ...(tableData.created ?? []).map((record: any) => record.id),
                                ...(tableData.updated ?? []).map((record: any) => record.id),
                            ].filter(Boolean);
                            const deletedIds = (tableData.deleted ?? []).filter(Boolean);
                            const rowCount = upsertIds.length + deletedIds.length;
                            totalPulled += rowCount;

                            await this.recordAudit({
                                attempt: this.activeAuditAttempt,
                                direction: 'pull',
                                source: 'supabase',
                                target: 'watermelon',
                                localTable: localTableName,
                                remoteTable: remoteTableName,
                                operation: 'remote-fetch-upsert',
                                recordIds: upsertIds,
                                result: 'success',
                            });
                            await this.recordAudit({
                                attempt: this.activeAuditAttempt,
                                direction: 'pull',
                                source: 'supabase',
                                target: 'watermelon',
                                localTable: localTableName,
                                remoteTable: remoteTableName,
                                operation: 'remote-fetch-delete',
                                recordIds: deletedIds,
                                result: 'success',
                            });

                            if (rowCount > 0) {
                                store.addLog({
                                    timestamp: new Date(),
                                    type: 'table',
                                    message: `Pulled ${localTableName}`,
                                    detail: `${tableData.created?.length ?? 0} new · ${tableData.updated?.length ?? 0} updated · ${tableData.deleted?.length ?? 0} deleted`,
                                    rowCount,
                                });
                            }
                        }

                        store.setSyncProgress({ currentModel: 'Pull complete', progress: 0.8 });
                        console.log(`[SyncService] Pulled all ${total} tables in ${Date.now() - pullStartTime}ms (${totalPulled} rows total)`);

                        assertAgriDatabaseUsable(this.db);
                        return { changes, timestamp: serverTime };
                    });
                },
                pushChanges: async ({ changes, lastPulledAt }) => {
                    return await perf.measure('Sync.Push', async () => {
                        const pushStartTime = Date.now();
                        store.setSyncProgress({ currentModel: 'Pushing changes...', progress: 0.8 });
                        const experimentalRejectedIds = await this.pushChangesToSupabase(changes, lastPulledAt);

                        const duration = Date.now() - pushStartTime;
                        const totalPushed = Object.entries(changes as any).reduce((sum: number, [table, t]: [string, any]) => {
                            const pending = new Set(experimentalRejectedIds[table] || []);
                            return sum + [...(t.created || []), ...(t.updated || [])].filter(record => !pending.has(record.id)).length
                                + (t.deleted || []).filter(id => !pending.has(id)).length;
                        }, 0);

                        if (totalPushed > 0) {
                            store.addLog({
                                timestamp: new Date(),
                                type: 'info',
                                message: `Pushed ${totalPushed} local changes`,
                                duration,
                                rowCount: totalPushed,
                            });
                        }

                        console.log(`[SyncService] Pushed changes in ${duration}ms`);
                        return { experimentalRejectedIds };
                    });
                },
            }));
            });

            // Post-sync integrity check: warn if unsync'd loan records remain
            try {
                const changedCount = await this.db.collections
                    .get('loans')
                    .query(Q.where('_status', Q.oneOf(['created', 'updated', 'deleted'])))
                    .fetchCount();
                if (changedCount > 0) {
                    ErrorService.handleError(
                        new Error(`Post-sync: ${changedCount} unsync'd loan records remain`),
                        'SyncService.integrityCheck',
                        ErrorType.SYNC
                    );
                }
            } catch {
                // Non-fatal: integrity check failure should not abort the sync result
            }

            const totalDuration = Date.now() - startTime;
            console.log(`[SyncService] Sync completed in ${totalDuration}ms`);
            const endStore = useSyncStore.getState();
            const pendingChanges = await this.updatePendingCount();
            endStore.setSyncProgress({
                status: 'completed',
                progress: 1,
                currentModel: 'Sync complete',
                pendingChanges,
                lastSyncAt: new Date(),
            });
            endStore.addLog({
                timestamp: new Date(),
                type: 'success',
                message: `Sync completed successfully (${totalPulled} pulled)`,
                duration: totalDuration,
            });
            if (this.auditSessionActive) {
                await this.writeAudit(() => this.audit.completeSession());
            }
        } catch (error: any) {
            if (error?.message?.includes('Concurrent synchronization is not allowed')) {
                console.log('[SyncService] Ignored concurrent sync error (already syncing)');
                return;
            }
            // Failure callbacks can write locally too. Never invoke one on a
            // quarantined Database; if it itself fails, report that uncertainty.
            if (this.auditSessionActive && error?.code !== 'AGRI_DATABASE_REOPEN_REQUIRED') {
                try {
                    await this.writeAudit(() => this.audit.failSession({
                        code: error?.code,
                        failureKind: getSyncFailureKind(error),
                    }));
                } catch (auditError) { error = auditError; }
            }
            ErrorService.handleError(error, 'SyncService.sync', ErrorType.SYNC);
            const errStore = useSyncStore.getState();
            errStore.setSyncProgress({
                status: 'error',
                errorMessage: ErrorService.getUserMessage(error, 'Sync failed. Your local changes are safe and will retry later.'),
            });
            errStore.addLog({
                timestamp: new Date(),
                type: 'error',
                message: 'Sync failed',
                detail: ErrorService.getUserMessage(error, 'Unknown sync error'),
            });
            if (error?.code === 'AGRI_DATABASE_REOPEN_REQUIRED') throw error;
        } finally {
            this.auditSessionActive = false;
        }
    }

    private buildPullFailureMessage(failureCount: number, details: string[]): string {
        const tableNames = details
            .map(detail => detail.split(':', 1)[0]?.trim())
            .filter(Boolean);
        const tableSummary = tableNames.length > 0 ? ` Affected tables: ${tableNames.join(', ')}.` : '';
        const kinds = new Set(details.map(detail => getSyncFailureKind(new Error(detail))));

        if (kinds.has('schema')) {
            return `Sync schema/configuration mismatch for ${failureCount} required table(s).${tableSummary} Apply the required Supabase migrations and verify Data API exposure.`;
        }
        if (kinds.has('permission')) {
            return `Sync could not access ${failureCount} table(s).${tableSummary} Please contact an administrator to check grants and row-level security policies.`;
        }
        if (kinds.has('auth')) {
            return `Sync authentication failed for ${failureCount} table(s).${tableSummary} Please sign in again.`;
        }
        if (kinds.has('constraint')) {
            return `Sync encountered a data constraint conflict in ${failureCount} table(s).${tableSummary} Your local changes remain pending.`;
        }
        if (kinds.has('timeout')) {
            return `Sync timed out while reading ${failureCount} table(s).${tableSummary} Your data is safe and sync will retry.`;
        }
        if (kinds.has('network')) {
            return `Connection problem while syncing ${failureCount} table(s).${tableSummary} Your data is safe and sync will retry.`;
        }
        return `Sync failed for ${failureCount} table(s).${tableSummary} Your local data is safe and sync will retry.`;
    }

    private getRemoteCursorValue(localTableName: string, fieldName: string, lastSyncDate: string): string | number {
        if (SyncService.isBigIntField(localTableName, fieldName)) {
            return Date.parse(lastSyncDate);
        }
        return lastSyncDate;
    }

    private getRemoteTimestampValue(localTableName: string, fieldName: string, timestampMs: number): string | number {
        if (SyncService.isBigIntField(localTableName, fieldName)) {
            return timestampMs;
        }
        return new Date(timestampMs).toISOString();
    }

    private getTimestampMillis(value: unknown): number | null {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : null;
        }
        if (typeof value !== 'string' || value.length === 0) {
            return null;
        }
        if (/^\d+$/.test(value)) {
            const numericValue = Number(value);
            return Number.isFinite(numericValue) ? numericValue : null;
        }
        const parsedValue = Date.parse(value);
        return Number.isFinite(parsedValue) ? parsedValue : null;
    }

    private async getPendingLayoutParcelIds(parcelIds: string[]): Promise<Set<string> | null> {
        assertAgriDatabaseUsable(this.db);
        if (parcelIds.length === 0) return new Set();
        try {
            const operations = await this.db.collections.get('agri_pending_layout_operations').query(
                Q.where('parcel_id', Q.oneOf(Array.from(new Set(parcelIds)))),
                Q.where('state', Q.notEq('acknowledged'))
            ).fetch();
            assertAgriDatabaseUsable(this.db);
            return new Set(operations.map(operation => String(operation._raw['parcel_id'])));
        } catch (error) {
            assertAgriDatabaseUsable(this.db);
            // Missing/unreadable local outbox is not evidence of no pending layout.
            console.warn('[SyncService] Cannot verify pending parcel layouts; retaining local changes.', error);
            return null;
        }
    }

    private async getLocalMappingAuditRejectedIds(upserts: any[], deleted: string[]): Promise<Set<string>> {
        const rejected = new Set<string>(upserts.filter(isLocalMappingAudit).map(record => record.id));
        if (!deleted.length) return rejected;
        assertAgriDatabaseUsable(this.db);
        try {
            const identityClause = Q.where('id', Q.oneOf(deleted));
            const query = this.db.collections.get('action_logs').query(identityClause).serialize();
            // WDB queries normally exclude tombstones. Read raw by ID, without
            // that implicit filter, using the portable Loki/SQLite adapter API.
            // Never hydrate deleted models: sync destroys acknowledged tombstones
            // via the adapter and would leave collection.find()'s cache stale.
            const identities = await this.db.adapter.unsafeQueryRaw({
                ...query, description: { ...query.description, where: [identityClause] },
            });
            assertAgriDatabaseUsable(this.db);
            const byId = new Map(identities.map(raw => [raw.id, raw]));
            for (const id of deleted) {
                const raw = byId.get(id);
                if (!raw || typeof raw.entity_type !== 'string' || !raw.entity_type.trim() || isLocalMappingAudit(raw)) {
                    rejected.add(id);
                }
            }
        } catch {
            assertAgriDatabaseUsable(this.db);
            // Missing/unreadable identity is not evidence of an unrelated audit.
            for (const id of deleted) rejected.add(id);
        }
        return rejected;
    }

    private async fetchTableChanges(
        localTableName: string,
        lastSyncDate: string | null,
        upperBoundDate: string | null = null
    ) {
        assertAgriDatabaseUsable(this.db);
        if (DEFERRED_LAYOUT_TABLES.has(localTableName)) {
            return { created: [], updated: [], deleted: [] };
        }
        const tableName = REMOTE_TABLE_MAP[localTableName] ?? localTableName;
        if (OPTIONAL_REMOTE_TABLES.has(localTableName) && this.unavailableOptionalRemoteTables.has(localTableName)) {
            return { created: [], updated: [], deleted: [] };
        }
        try {
            const timeColumn = 'updated_at';
            const pageSize = 1000;

            // Fetch active records with pagination.
            // IMPORTANT: Rebuild the query for each page to avoid Supabase
            // client .range() stacking on the same builder instance.
            let allActive: any[] = [];
            let activePage = 0;
            let activeHasMore = true;

            while (activeHasMore) {
                assertAgriDatabaseUsable(this.db);
                let pageQuery = this.supabase
                    .from(tableName)
                    .select('*')
                    .is('deleted_at', null)
                    .order('updated_at', { ascending: true })
                    .order('id', { ascending: true });
                if (lastSyncDate) {
                    pageQuery = pageQuery.gte(
                        timeColumn,
                        this.getRemoteCursorValue(localTableName, timeColumn, lastSyncDate)
                    );
                }
                if (upperBoundDate) {
                    pageQuery = pageQuery.lte(
                        timeColumn,
                        this.getRemoteCursorValue(localTableName, timeColumn, upperBoundDate)
                    );
                }
                pageQuery = this.applyBranchPartitionFilter(pageQuery, localTableName);
                const { data, error } = await withSyncTimeout(
                    pageQuery.range(activePage * pageSize, (activePage + 1) * pageSize - 1),
                    TABLE_PAGE_TIMEOUT_MS,
                    `Fetch ${tableName} active page ${activePage + 1}`
                );
                if (error && OPTIONAL_REMOTE_TABLES.has(localTableName) && isMissingRemoteTableError(error)) {
                    this.unavailableOptionalRemoteTables.add(localTableName);
                    console.warn(
                        `[SyncService] Optional remote table ${tableName} is not available; skipping pull until the Supabase migration is applied.`
                    );
                    return { created: [], updated: [], deleted: [] };
                }
                if (error) {
                    const msg = `Failed to fetch ${localTableName}: ${formatSupabaseError(error)}`;
                    ErrorService.handleError(msg, 'SyncService');
                    const tableError = new Error(msg);
                    Object.assign(tableError, { code: error?.code, status: (error as any)?.status, cause: error });
                    throw tableError;
                }
                if (data && data.length > 0) {
                    allActive = allActive.concat(data);
                    if (data.length < pageSize) activeHasMore = false;
                    else activePage++;
                } else {
                    activeHasMore = false;
                }
            }

            // Fetch deleted records with pagination (same rebuild-per-page pattern)
            let allDeleted: any[] = [];
            let deletedPage = 0;
            let deletedHasMore = true;

            while (deletedHasMore) {
                assertAgriDatabaseUsable(this.db);
                let delPageQuery = this.supabase
                    .from(tableName)
                    .select('id,deleted_at')
                    .not('deleted_at', 'is', null)
                    .order('deleted_at', { ascending: true })
                    .order('id', { ascending: true });
                if (lastSyncDate) {
                    delPageQuery = delPageQuery.gte(
                        'deleted_at',
                        this.getRemoteCursorValue(localTableName, 'deleted_at', lastSyncDate)
                    );
                }
                if (upperBoundDate) {
                    delPageQuery = delPageQuery.lte(
                        'deleted_at',
                        this.getRemoteCursorValue(localTableName, 'deleted_at', upperBoundDate)
                    );
                }
                delPageQuery = this.applyBranchPartitionFilter(delPageQuery, localTableName);
                const { data, error } = await withSyncTimeout(
                    delPageQuery.range(deletedPage * pageSize, (deletedPage + 1) * pageSize - 1),
                    TABLE_PAGE_TIMEOUT_MS,
                    `Fetch ${tableName} deleted page ${deletedPage + 1}`
                );
                if (error) {
                    const msg = `Failed to fetch deleted ${localTableName}: ${formatSupabaseError(error)}`;
                    ErrorService.handleError(msg, 'SyncService');
                    const tableError = new Error(msg);
                    Object.assign(tableError, { code: error?.code, status: (error as any)?.status, cause: error });
                    throw tableError;
                }
                if (data && data.length > 0) {
                    allDeleted = allDeleted.concat(data);
                    if (data.length < pageSize) deletedHasMore = false;
                    else deletedPage++;
                } else {
                    deletedHasMore = false;
                }
            }

            if (localTableName === 'agri_parcels') {
                const pendingParcelIds = await this.getPendingLayoutParcelIds([
                    ...allActive.map(record => record.id), ...allDeleted.map(record => record.id),
                ]);
                if (pendingParcelIds === null) {
                    throw new Error('Sync schema/configuration: cannot verify the local parcel layout outbox');
                }
                const localParcels = allActive.length ? await this.db.collections.get('agri_parcels').query(
                    Q.where('id', Q.oneOf(allActive.map(record => record.id)))
                ).fetch() : [];
                assertAgriDatabaseUsable(this.db);
                const localById = new Map(localParcels.map(parcel => [parcel.id, parcel._raw]));
                allActive = allActive.filter(record => !pendingParcelIds.has(record.id) || localById.has(record.id))
                    .map(record => {
                        const local = localById.get(record.id);
                        const protectedColumns = pendingParcelIds.has(record.id)
                            ? MANAGED_PARCEL_GEOMETRY_COLUMNS : NEW_PARCEL_GEOMETRY_COLUMNS;
                        const safeRecord = { ...record };
                        // WDB defaults absent remote columns before merging _changed.
                        // Preserve local geometry even when it is not in _changed.
                        for (const column of protectedColumns) {
                            if (local) safeRecord[column] = local[column];
                            else delete safeRecord[column];
                        }
                        return safeRecord;
                    });
                allDeleted = allDeleted.filter(record => !pendingParcelIds.has(record.id));
            }

            // All records go to `updated` — WatermelonDB will auto-create
            // any records not present locally (see sendCreatedAsUpdated flag).
            const created: any[] = [];
            const updated: any[] = [];
            const deleted: string[] = allDeleted.map((r: any) => r.id);

            for (const record of allActive) {
                // Convert ISO date strings → epoch milliseconds for WatermelonDB.
                // BIGINT-backed fields are excluded here so they can stay numeric.
                SyncService.DATE_FIELDS
                    .filter(field => !SyncService.isBigIntField(localTableName, field))
                    .forEach(field => {
                    if (record[field] && typeof record[field] === 'string') {
                        record[field] = new Date(record[field]).getTime();
                    }
                    });

                // Ensure BIGINT fields are numbers
                const bigintFields = SyncService.TABLE_BIGINT_FIELDS[localTableName] || [];
                bigintFields.forEach(field => {
                    if (record[field] && typeof record[field] === 'string') {
                        // In case the DB returns it as a stringified number (common with BIGINT)
                        record[field] = parseInt(record[field], 10);
                    }
                });

                // Nullify invalid UUIDs on FK fields to prevent constraint violations
                SyncService.UUID_FK_FIELDS.forEach(field => {
                    if (record[field] && typeof record[field] === 'string' && !SyncService.UUID_REGEX.test(record[field])) {
                        record[field] = null;
                    }
                });

                updated.push(record);
            }

            assertAgriDatabaseUsable(this.db);
            return { created, updated, deleted };
        } catch (err) {
            assertAgriDatabaseUsable(this.db);
            throw ErrorService.handleError(err, `SyncService.fetchTableChanges(${localTableName})`, ErrorType.SYNC);
        }
    }

    private async pushChangesToSupabase(changes: any, lastPulledAt?: number) {
        assertAgriDatabaseUsable(this.db);
        try {
            const store = useSyncStore.getState();
            // Inspect ALL changes, including local-only/disabled tables. Silently
            // filtering a table acknowledges its rows (and destroys deleted tombstones).
            const tableNames = Object.keys(changes || {}).sort((a, b) => {
                const indexA = SYNC_TABLES.indexOf(a);
                const indexB = SYNC_TABLES.indexOf(b);
                return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
            });
            const total = tableNames.length;
            let i = 0;
            const failures: string[] = [];
            const rejectedIds: Record<string, string[]> = {};
            let deferredJournalEntriesToPost: string[] = [];

            for (const localTableName of tableNames) {
                const tableChanges = changes[localTableName];
                if (!tableChanges) {
                    i++;
                    continue;
                }

                store.setSyncProgress({
                    currentModel: `Pushing ${localTableName}...`,
                    progress: 0.8 + ((i / total) * 0.2)
                });

                const remoteName = REMOTE_TABLE_MAP[localTableName] ?? localTableName;
                const { created, updated, deleted } = tableChanges;
                const startTime = Date.now();
                let auditFailureOperation = 'table-push';
                let auditFailureRecordIds: string[] = [];

                try {
                    const incomingUpserts = [...(created || []), ...(updated || [])];
                    const incomingDeletes = deleted || [];
                    const incomingIds = [
                        ...incomingUpserts.map((record: any) => record.id),
                        ...incomingDeletes,
                    ].filter(Boolean);
                    auditFailureRecordIds = incomingIds;
                    if (!ENABLED_SYNC_TABLES.has(localTableName)) {
                        if (incomingIds.length) rejectedIds[localTableName] = incomingIds;
                        await this.recordAudit({
                            attempt: this.activeAuditAttempt, direction: 'push', source: 'watermelon', target: 'supabase',
                            localTable: localTableName, remoteTable: remoteName,
                            operation: 'generic-sync-disabled', recordIds: incomingIds, result: 'deferred',
                        });
                        i++;
                        continue;
                    }
                    if (OPTIONAL_REMOTE_TABLES.has(localTableName) && this.unavailableOptionalRemoteTables.has(localTableName)) {
                        if (incomingIds.length > 0) {
                            rejectedIds[localTableName] = incomingIds;
                        }
                        await this.recordAudit({
                            attempt: this.activeAuditAttempt,
                            direction: 'push',
                            source: 'watermelon',
                            target: 'supabase',
                            localTable: localTableName,
                            remoteTable: remoteName,
                            operation: 'table-unavailable',
                            recordIds: incomingIds,
                            result: 'deferred',
                        });
                        i++;
                        continue;
                    }
                    const pendingParcelIds = localTableName === 'agri_parcels'
                        ? await this.getPendingLayoutParcelIds(incomingIds) : new Set<string>();
                    if (pendingParcelIds === null) {
                        if (incomingIds.length) rejectedIds[localTableName] = incomingIds;
                        i++;
                        continue;
                    }
                    // SAFE DISABLED: no sparse metadata upserts for pending parents.
                    // They can violate NOT NULL or resurrect a remote tombstone. Keep
                    // the entire dirty row until scoped atomic layout publication exists.
                    const deferredIds = localTableName === 'action_logs'
                        ? await this.getLocalMappingAuditRejectedIds(incomingUpserts, incomingDeletes) : pendingParcelIds;
                    if (deferredIds.size) rejectedIds[localTableName] = Array.from(deferredIds);
                    const eligibleUpserts = incomingUpserts.filter((record: any) => !deferredIds.has(record.id));
                    const eligibleDeletes = incomingDeletes.filter((id: string) => !deferredIds.has(id));
                    assertAgriDatabaseUsable(this.db);
                    const conflictingIds = await this.findConflictingRemoteIds(
                        remoteName,
                        [...eligibleUpserts, ...eligibleDeletes.map((id: string) => ({ id }))],
                        lastPulledAt
                    );

                    if (conflictingIds.size > 0) {
                        rejectedIds[localTableName] = Array.from(new Set([
                            ...(rejectedIds[localTableName] || []), ...conflictingIds,
                        ]));
                        store.addLog({
                            timestamp: new Date(),
                            type: 'error',
                            message: `Rejected ${localTableName} conflicts`,
                            detail: `${conflictingIds.size} local change(s) were kept pending because remote data changed after the last pull.`,
                            rowCount: conflictingIds.size,
                        });
                        await this.recordAudit({
                            attempt: this.activeAuditAttempt,
                            direction: 'push',
                            source: 'watermelon',
                            target: 'supabase',
                            localTable: localTableName,
                            remoteTable: remoteName,
                            operation: 'conflict',
                            recordIds: Array.from(conflictingIds),
                            result: 'rejected-conflict',
                        });
                    }

                    const createdToPush = (created ?? []).filter((record: any) => record?.id && typeof record.id === 'string' && record.id.trim() !== '' && !deferredIds.has(record.id) && !conflictingIds.has(record.id));
                    const updatedToPush = (updated ?? []).filter((record: any) => record?.id && typeof record.id === 'string' && record.id.trim() !== '' && !deferredIds.has(record.id) && !conflictingIds.has(record.id));
                    const toUpsert = [...createdToPush, ...updatedToPush]
                        .map(record => this.sanitizeRecord(record, localTableName));

                    // Two-Phase Double-Entry Journal Posting:
                    // Database trigger trg_enforce_balanced_journal_insert rejects INSERT of journal_entries
                    // with is_posted=true when lines do not yet exist in Supabase. We push parent entries as draft
                    // (is_posted=false), push journal_entry_lines, then transition entries to is_posted=true via UPDATE.
                    if (localTableName === 'journal_entries') {
                        const entriesToPost = toUpsert
                            .filter(r => r.is_posted === true)
                            .map(r => r.id);
                        if (entriesToPost.length > 0) {
                            deferredJournalEntriesToPost.push(...entriesToPost);
                        }
                        // Unconditionally ensure that all journal_entries pushed via upsert are saved as drafts (is_posted=false)
                        // to avoid trg_enforce_balanced_journal_insert triggering before journal_entry_lines exist.
                        toUpsert.forEach(r => {
                            r.is_posted = false;
                        });
                    }

                    // Marketplace Orders & Sub-orders consistency:
                    // Ensure a corresponding marketplace_sub_orders row exists on Supabase so that
                    // marketplace_order_items referencing sub_order_id satisfy the FK constraint.
                    if (localTableName === 'marketplace_orders' && toUpsert.length > 0) {
                        const subOrderRows = toUpsert.map(order => ({
                            id: order.id,
                            order_id: order.id,
                            store_id: '00000000-0000-4000-8000-0000000000c1',
                            sub_order_number: `${order.order_number || order.id}-1`,
                            subtotal: order.total_amount || 0,
                            commission_amount: 0,
                            shipping_fee: 0,
                            net_payout: order.total_amount || 0,
                            fulfillment_status: 'completed',
                            payout_status: order.payment_status || 'paid',
                            created_at: order.created_at || new Date().toISOString(),
                            updated_at: order.updated_at || new Date().toISOString(),
                        }));
                        await withSyncTimeout(
                            this.supabase.from('marketplace_sub_orders').upsert(subOrderRows, { onConflict: 'id' }),
                            UPSERT_TIMEOUT_MS,
                            'Ensure marketplace_sub_orders for orders'
                        );
                    }

                    auditFailureOperation = 'upsert';
                    auditFailureRecordIds = [...createdToPush, ...updatedToPush].map((record: any) => record.id);
                    if (toUpsert.length > 0) {
                        assertAgriDatabaseUsable(this.db);
                        const upsertOptions = TABLE_UPSERT_OPTIONS[localTableName] || TABLE_UPSERT_OPTIONS[remoteName];
                        const { error } = await withSyncTimeout(
                            this.supabase.from(remoteName).upsert(toUpsert, upsertOptions),
                            UPSERT_TIMEOUT_MS,
                            `Push ${remoteName} upserts`
                        );
                        if (error) {
                            throw error;
                        }

                        // Post deferred journal entries now that lines exist in Supabase
                        if (localTableName === 'journal_entry_lines' && deferredJournalEntriesToPost.length > 0) {
                            await this.safelyPostEligibleJournalEntries(deferredJournalEntriesToPost);
                            deferredJournalEntriesToPost = [];
                        }
                    }
                    await this.recordAudit({
                        attempt: this.activeAuditAttempt,
                        direction: 'push',
                        source: 'watermelon',
                        target: 'supabase',
                        localTable: localTableName,
                        remoteTable: remoteName,
                        operation: 'upsert-created',
                        recordIds: createdToPush.map((record: any) => record.id),
                        result: 'success',
                        durationMs: Date.now() - startTime,
                    });
                    await this.recordAudit({
                        attempt: this.activeAuditAttempt,
                        direction: 'push',
                        source: 'watermelon',
                        target: 'supabase',
                        localTable: localTableName,
                        remoteTable: remoteName,
                        operation: 'upsert-updated',
                        recordIds: updatedToPush.map((record: any) => record.id),
                        result: 'success',
                        durationMs: Date.now() - startTime,
                    });

                    const deletesToPush = eligibleDeletes.filter((id: string) => !conflictingIds.has(id));
                    auditFailureOperation = 'soft-delete';
                    auditFailureRecordIds = deletesToPush;

                    if (deletesToPush.length > 0) {
                        assertAgriDatabaseUsable(this.db);
                        const serverSafeTimestamp = Date.now() + this.clockOffset;
                        const deletedAt = this.getRemoteTimestampValue(
                            localTableName,
                            'deleted_at',
                            serverSafeTimestamp
                        );
                        const updatedAt = this.getRemoteTimestampValue(
                            localTableName,
                            'updated_at',
                            serverSafeTimestamp
                        );
                        const deletePayload = deletesToPush.map((id: string) => ({
                            id,
                            deleted_at: deletedAt,
                            updated_at: updatedAt, // Update updated_at so pull queries see the change
                        }));
                        const { error } = await withSyncTimeout(
                            this.supabase.from(remoteName).upsert(deletePayload),
                            UPSERT_TIMEOUT_MS,
                            `Push ${remoteName} deletes`
                        );
                        if (error) {
                            throw error;
                        }
                    }
                    await this.recordAudit({
                        attempt: this.activeAuditAttempt,
                        direction: 'push',
                        source: 'watermelon',
                        target: 'supabase',
                        localTable: localTableName,
                        remoteTable: remoteName,
                        operation: 'soft-delete',
                        recordIds: deletesToPush,
                        result: 'success',
                        durationMs: Date.now() - startTime,
                    });

                    const createdCount = created?.length ?? 0;
                    const updatedCount = updated?.length ?? 0;
                    const deletedCount = deleted?.length ?? 0;
                    const totalTablePushed = Math.max(0, createdCount + updatedCount + deletedCount - (rejectedIds[localTableName]?.length || 0));

                    if (totalTablePushed > 0) {
                        const duration = Date.now() - startTime;
                        console.log(`[SyncService] Pushed ${toUpsert.length} upserts and ${deletedCount} deletes for ${remoteName} in ${duration}ms`);
                        
                        store.addLog({
                            timestamp: new Date(),
                            type: 'table',
                            message: `Pushed ${localTableName}`,
                            detail: `${createdCount} new · ${updatedCount} updated · ${deletedCount} deleted`,
                            duration,
                            rowCount: totalTablePushed,
                        });
                    }
                } catch (tableErr: any) {
                    if (OPTIONAL_REMOTE_TABLES.has(localTableName) && isMissingRemoteTableError(tableErr)) {
                        this.unavailableOptionalRemoteTables.add(localTableName);
                        const pendingIds = [
                            ...((created || []).map((record: any) => record.id)),
                            ...((updated || []).map((record: any) => record.id)),
                            ...(deleted || []),
                        ].filter(Boolean);
                        if (pendingIds.length > 0) {
                            rejectedIds[localTableName] = pendingIds;
                        }
                        console.warn(
                            `[SyncService] Optional remote table ${remoteName} is not available; keeping ${pendingIds.length} ${localTableName} change(s) pending until the Supabase migration is applied.`
                        );
                        await this.recordAudit({
                            attempt: this.activeAuditAttempt,
                            direction: 'push',
                            source: 'watermelon',
                            target: 'supabase',
                            localTable: localTableName,
                            remoteTable: remoteName,
                            operation: 'table-unavailable',
                            recordIds: pendingIds,
                            result: 'deferred',
                            failureKind: 'schema',
                            errorCode: tableErr?.code,
                        });
                        i++;
                        continue;
                    }
                    // For optional (config) tables, constraint errors (NOT NULL, FK violations) on
                    // individual records should NOT crash the entire sync cycle. Defer those records
                    // so they remain pending and can be corrected before the next sync attempt.
                    if (OPTIONAL_REMOTE_TABLES.has(localTableName) && getSyncFailureKind(tableErr) === 'constraint') {
                        const pendingIds = [
                            ...((created || []).map((record: any) => record.id)),
                            ...((updated || []).map((record: any) => record.id)),
                            ...(deleted || []),
                        ].filter(Boolean);
                        if (pendingIds.length > 0) {
                            rejectedIds[localTableName] = pendingIds;
                        }
                        console.warn(
                            `[SyncService] Optional table ${remoteName} has constraint error; deferring ${pendingIds.length} record(s): ${tableErr.message}`
                        );
                        store.addLog({
                            timestamp: new Date(),
                            type: 'error',
                            message: `Deferred: ${localTableName} (constraint)`,
                            detail: tableErr.message,
                        });
                        await this.recordAuditFailure({
                            attempt: this.activeAuditAttempt,
                            direction: 'push',
                            localTable: localTableName,
                            remoteTable: remoteName,
                            operation: auditFailureOperation,
                            recordIds: pendingIds,
                            failureKind: 'constraint',
                            error: tableErr,
                        });
                        i++;
                        continue;
                    }
                    const msg = `[SyncService] Partial Failure: Failed to push ${remoteName}: ${tableErr.message}`;
                    console.error(msg, tableErr);
                    ErrorService.handleError(tableErr, msg);
                    failures.push(`${localTableName}: ${tableErr.message || String(tableErr)}`);
                    store.addLog({
                        timestamp: new Date(),
                        type: 'error',
                        message: `Push failed: ${localTableName}`,
                        detail: tableErr.message,
                    });
                    await this.recordAuditFailure({
                        attempt: this.activeAuditAttempt,
                        direction: 'push',
                        localTable: localTableName,
                        remoteTable: remoteName,
                        operation: auditFailureOperation,
                        recordIds: auditFailureRecordIds,
                        failureKind: getSyncFailureKind(tableErr),
                        error: tableErr,
                    });
                }
                
                i++;
            }

            // Fallback: Ensure any deferred journal entries are posted even if journal_entry_lines had no delta
            if (deferredJournalEntriesToPost.length > 0) {
                await this.safelyPostEligibleJournalEntries(deferredJournalEntriesToPost);
                deferredJournalEntriesToPost = [];
            }

            if (failures.length > 0) {
                throw new Error(`Push failed for ${failures.length} table(s): ${failures.join('; ')}`);
            }

            // A concurrent local batch may have become uncertain during remote I/O.
            // Never let that push result clean cached rows or destroy tombstones.
            assertAgriDatabaseUsable(this.db);
            return rejectedIds;
        } catch (err) {
            assertAgriDatabaseUsable(this.db);
            ErrorService.handleError(err, 'SyncService.pushChangesToSupabase', ErrorType.SYNC);
            throw ErrorService.handleError(err, 'SyncService');
        }
    }

    /**
     * Safely updates deferred journal_entries to is_posted=true.
     * Database trigger trg_enforce_balanced_journal rejects posting entries with < 2 lines.
     * This method inspects remote lines first (or updates individually), allowing entries
     * with sufficient balanced lines to be posted while leaving orphans/drafts unposted.
     */
    private async safelyPostEligibleJournalEntries(entryIds: string[]): Promise<void> {
        if (!entryIds || entryIds.length === 0) return;
        try {
            // Check lines in Supabase to determine which entries meet the trigger condition (>= 2 lines)
            const { data: lines, error: linesErr } = await withSyncTimeout(
                this.supabase
                    .from('journal_entry_lines')
                    .select('journal_entry_id,deleted_at')
                    .in('journal_entry_id', entryIds),
                UPSERT_TIMEOUT_MS,
                'Check journal entry lines before posting'
            );

            if (!linesErr && lines && Array.isArray(lines)) {
                const lineCountMap = new Map<string, number>();
                for (const row of lines) {
                    if (row.deleted_at) continue;
                    const jId = row.journal_entry_id;
                    if (jId) {
                        lineCountMap.set(jId, (lineCountMap.get(jId) || 0) + 1);
                    }
                }

                const eligibleIds = entryIds.filter(id => (lineCountMap.get(id) || 0) >= 2);
                const ineligibleIds = entryIds.filter(id => (lineCountMap.get(id) || 0) < 2);

                if (ineligibleIds.length > 0) {
                    console.warn(
                        `[SyncService] Skipping posting for ${ineligibleIds.length} journal entry(ies) without >= 2 lines (kept as drafts):`,
                        ineligibleIds
                    );
                }

                if (eligibleIds.length > 0) {
                    const { error: postErr } = await withSyncTimeout(
                        this.supabase
                            .from('journal_entries')
                            .update({ is_posted: true })
                            .in('id', eligibleIds),
                        UPSERT_TIMEOUT_MS,
                        'Post eligible deferred journal entries'
                    );
                    if (postErr) {
                        console.warn('[SyncService] Failed to post eligible journal entries in batch:', postErr);
                        // Fallback: try individually so one unbalanced entry does not prevent others from posting
                        for (const singleId of eligibleIds) {
                            try {
                                await this.supabase
                                    .from('journal_entries')
                                    .update({ is_posted: true })
                                    .eq('id', singleId);
                            } catch (singleErr) {
                                console.warn(`[SyncService] Failed to post journal entry ${singleId}:`, singleErr);
                            }
                        }
                    }
                }
            } else {
                // If checking lines fails, attempt individual updates safely
                for (const singleId of entryIds) {
                    try {
                        await this.supabase
                            .from('journal_entries')
                            .update({ is_posted: true })
                            .eq('id', singleId);
                    } catch (singleErr) {
                        console.warn(`[SyncService] Individual post fallback warning for ${singleId}:`, singleErr);
                    }
                }
            }
        } catch (err) {
            console.warn('[SyncService] safelyPostEligibleJournalEntries caught error:', err);
        }
    }

    private async findConflictingRemoteIds(
        remoteTableName: string,
        records: { id?: string }[],
        lastPulledAt?: number
    ): Promise<Set<string>> {
        const conflicts = new Set<string>();
        if (!lastPulledAt || records.length === 0) return conflicts;

        const ids = Array.from(
            new Set(
                records
                    .map(record => record.id)
                    .filter(id => id && typeof id === 'string' && id.trim() !== '')
            )
        ) as string[];
        if (ids.length === 0) return conflicts;

        const pageSize = 500;

        for (let i = 0; i < ids.length; i += pageSize) {
            const chunk = ids.slice(i, i + pageSize);
            const { data, error } = await withSyncTimeout(
                this.supabase
                    .from(remoteTableName)
                    .select('id,updated_at,deleted_at')
                    .in('id', chunk),
                TABLE_PAGE_TIMEOUT_MS,
                `Conflict check ${remoteTableName} ${i / pageSize + 1}`
            );

            if (error) {
                throw ErrorService.handleError(error, `[SyncService] Conflict check failed for ${remoteTableName}: ${error.message}`);
            }

            for (const row of data || []) {
                const remoteUpdatedAt = this.getTimestampMillis(row.updated_at);
                const remoteDeletedAt = this.getTimestampMillis(row.deleted_at);
                if (
                    (remoteUpdatedAt !== null && remoteUpdatedAt > lastPulledAt) ||
                    (remoteDeletedAt !== null && remoteDeletedAt > lastPulledAt)
                ) {
                    conflicts.add(row.id);
                }
            }
        }

        return conflicts;
    }

    private sanitizeRecord(record: any, tableName: string) {
        const { _status, _changed, ...clean } = record;
        // New geometry columns (including nulls) do not exist on the legacy API.
        // Only verified layout cloud support may publish them, never generic upsert.
        if (tableName === 'agri_parcels') {
            for (const column of NEW_PARCEL_GEOMETRY_COLUMNS) delete clean[column];
        }

        // Convert epoch milliseconds → ISO strings for Supabase TIMESTAMPTZ columns
        SyncService.DATE_FIELDS.forEach(field => {
            if (clean[field] !== undefined && clean[field] !== null && typeof clean[field] === 'number') {
                // Skip conversion for BIGINT fields
                if (SyncService.isBigIntField(tableName, field)) {
                    return;
                }

                let timestamp = clean[field];
                // Apply clock offset specifically to sync-critical timestamps to prevent skew issues
                if (field === 'updated_at' || field === 'created_at') {
                    timestamp += this.clockOffset;
                }
                clean[field] = new Date(timestamp).toISOString();
            }
        });

        // Table-specific sanitization & normalizations
        if (tableName === 'business_units') {
            if (clean.moduleId !== undefined && clean.module_id === undefined) {
                clean.module_id = clean.moduleId;
                delete clean.moduleId;
            }
            if (clean.isActive !== undefined && clean.is_active === undefined) {
                clean.is_active = clean.isActive;
                delete clean.isActive;
            }
            if (clean.areaId !== undefined && clean.area_id === undefined) {
                clean.area_id = clean.areaId;
                delete clean.areaId;
            }
            if (clean.areaSupervisorId !== undefined && clean.area_supervisor_id === undefined) {
                clean.area_supervisor_id = clean.areaSupervisorId;
                delete clean.areaSupervisorId;
            }
            if (!clean.module_id || typeof clean.module_id !== 'string' || clean.module_id.trim() === '') {
                clean.module_id = 'crispy-king';
            }
        }

        if (tableName === 'marketplace_orders') {
            if (clean.buyerId !== undefined && clean.buyer_id === undefined) {
                clean.buyer_id = clean.buyerId;
                delete clean.buyerId;
            }
            if (clean.orderNumber !== undefined && clean.order_number === undefined) {
                clean.order_number = clean.orderNumber;
                delete clean.orderNumber;
            }
            if (clean.totalAmount !== undefined && clean.total_amount === undefined) {
                clean.total_amount = clean.totalAmount;
                delete clean.totalAmount;
            }
            if (clean.paymentMethod !== undefined && clean.payment_method === undefined) {
                clean.payment_method = clean.paymentMethod;
                delete clean.paymentMethod;
            }
            if (clean.paymentStatus !== undefined && clean.payment_status === undefined) {
                clean.payment_status = clean.paymentStatus;
                delete clean.paymentStatus;
            }
            if (!clean.buyer_id || typeof clean.buyer_id !== 'string' || !SyncService.UUID_REGEX.test(clean.buyer_id)) {
                clean.buyer_id = deterministicUuid(clean.buyer_id ? `buyer-${clean.buyer_id}` : 'buyer-default');
            }
        }

        if (tableName === 'marketplace_order_items') {
            if (clean.subOrderId !== undefined && clean.sub_order_id === undefined) {
                clean.sub_order_id = clean.subOrderId;
                delete clean.subOrderId;
            }
            if (clean.productId !== undefined && clean.product_id === undefined) {
                clean.product_id = clean.productId;
                delete clean.productId;
            }
            if (clean.variantId !== undefined && clean.variant_id === undefined) {
                clean.variant_id = clean.variantId;
                delete clean.variantId;
            }
            if (clean.unitPrice !== undefined && clean.unit_price === undefined) {
                clean.unit_price = clean.unitPrice;
                delete clean.unitPrice;
            }
            if (clean.totalPrice !== undefined && clean.total_price === undefined) {
                clean.total_price = clean.totalPrice;
                delete clean.totalPrice;
            }

            const MENU_CODE_MAP: Record<string, string> = {
                'ck-scut': 'CK-SCUT',
                'ck-rice': 'CK-RICE',
                'ck-sd10': 'CK-SD10',
                'ck-sd15': 'CK-SD15',
                'ck-neck': 'CK-NECK',
                'ck-flt': 'CK-FLT',
                'ck-bola': 'CK-BOLA',
                'ck-lump': 'CK-LUMP',
                'ck-ngoh': 'CK-NGOH',
                'ck-atsr': 'CK-ATSR',
                'ck-fats': 'CK-FATS',
                'ck-skin': 'CK-SKIN',
            };
            if (clean.product_id && typeof clean.product_id === 'string' && !SyncService.UUID_REGEX.test(clean.product_id)) {
                const codeKey = clean.product_id.toLowerCase();
                const sku = MENU_CODE_MAP[codeKey] || clean.product_id.toUpperCase();
                clean.product_id = deterministicUuid(`prod-${sku}`);
            }
            if (!clean.product_id || typeof clean.product_id !== 'string' || !SyncService.UUID_REGEX.test(clean.product_id)) {
                clean.product_id = deterministicUuid(clean.product_id ? `prod-${clean.product_id}` : 'prod-default');
            }
            if (clean.sub_order_id && typeof clean.sub_order_id === 'string' && !SyncService.UUID_REGEX.test(clean.sub_order_id)) {
                clean.sub_order_id = deterministicUuid(`suborder-${clean.sub_order_id}`);
            }
            if (!clean.sub_order_id || typeof clean.sub_order_id !== 'string' || !SyncService.UUID_REGEX.test(clean.sub_order_id)) {
                clean.sub_order_id = deterministicUuid(clean.sub_order_id ? `suborder-${clean.sub_order_id}` : 'suborder-default');
            }
        }

        if (tableName === 'journal_entries') {
            if (clean.referenceNumber !== undefined && clean.reference_number === undefined) {
                clean.reference_number = clean.referenceNumber;
                delete clean.referenceNumber;
            }
            if (clean.entryType !== undefined && clean.entry_type === undefined) {
                clean.entry_type = clean.entryType;
                delete clean.entryType;
            }
            if (clean.sourceTable !== undefined && clean.source_table === undefined) {
                clean.source_table = clean.sourceTable;
                delete clean.sourceTable;
            }
            if (clean.sourceId !== undefined && clean.source_id === undefined) {
                clean.source_id = clean.sourceId;
                delete clean.sourceId;
            }
            if (clean.postedBy !== undefined && clean.posted_by === undefined) {
                clean.posted_by = clean.postedBy;
                delete clean.postedBy;
            }
            if (clean.isPosted !== undefined && clean.is_posted === undefined) {
                clean.is_posted = clean.isPosted;
                delete clean.isPosted;
            }
            if (clean.totalDebit !== undefined && clean.total_debit === undefined) {
                clean.total_debit = clean.totalDebit;
                delete clean.totalDebit;
            }
            if (clean.totalCredit !== undefined && clean.total_credit === undefined) {
                clean.total_credit = clean.totalCredit;
                delete clean.totalCredit;
            }
            if (clean.fiscalYear !== undefined && clean.fiscal_year === undefined) {
                clean.fiscal_year = clean.fiscalYear;
                delete clean.fiscalYear;
            }
            if (clean.fiscalMonth !== undefined && clean.fiscal_month === undefined) {
                clean.fiscal_month = clean.fiscalMonth;
                delete clean.fiscalMonth;
            }
            clean.is_posted = Boolean(clean.is_posted);

            if (clean.source_id !== undefined && clean.source_id !== null && typeof clean.source_id === 'string') {
                if (!SyncService.UUID_REGEX.test(clean.source_id)) {
                    clean.source_id = null;
                }
            }
        }

        if (tableName === 'journal_entry_lines') {
            if (clean.journalEntryId !== undefined && clean.journal_entry_id === undefined) {
                clean.journal_entry_id = clean.journalEntryId;
                delete clean.journalEntryId;
            }
            if (clean.accountCode !== undefined && clean.account_code === undefined) {
                clean.account_code = clean.accountCode;
                delete clean.accountCode;
            }
            if (clean.accountName !== undefined && clean.account_name === undefined) {
                clean.account_name = clean.accountName;
                delete clean.accountName;
            }
            if (clean.debitAmount !== undefined && clean.debit_amount === undefined) {
                clean.debit_amount = clean.debitAmount;
                delete clean.debitAmount;
            }
            if (clean.creditAmount !== undefined && clean.credit_amount === undefined) {
                clean.credit_amount = clean.creditAmount;
                delete clean.creditAmount;
            }
            if (clean.businessUnitId !== undefined && clean.business_unit_id === undefined) {
                clean.business_unit_id = clean.businessUnitId;
                delete clean.businessUnitId;
            }
            if (clean.moduleSourceTable !== undefined && clean.module_source_table === undefined) {
                clean.module_source_table = clean.moduleSourceTable;
                delete clean.moduleSourceTable;
            }
            if (clean.moduleSourceId !== undefined && clean.module_source_id === undefined) {
                clean.module_source_id = clean.moduleSourceId;
                delete clean.moduleSourceId;
            }
        }

        // Fallback for free-form text columns in action_logs that have NOT NULL constraints on Supabase
        if (tableName === 'action_logs' || tableName === 'app_action_logs') {
            if (!clean.entity_id || typeof clean.entity_id !== 'string' || clean.entity_id.trim() === '') {
                clean.entity_id = 'system';
            }
            if (!clean.entity_type || typeof clean.entity_type !== 'string' || clean.entity_type.trim() === '') {
                clean.entity_type = 'system';
            }
            if (!clean.performed_by || typeof clean.performed_by !== 'string' || clean.performed_by.trim() === '') {
                clean.performed_by = 'system';
            }
            if (clean.old_data !== undefined) {
                clean.old_data = sanitizeAuditJsonString(clean.old_data);
            }
            if (clean.new_data !== undefined) {
                clean.new_data = sanitizeAuditJsonString(clean.new_data);
            }
        }

        if (tableName === 'app_settings') {
            clean.value = stripLocalOnlySettingValue(clean.key, clean.value);
        }

        // Also clean empty string "" and invalid UUIDs on any relation _id, _by, _uuid, or id fields
        // Skipping known TEXT fields that are not UUIDs
        Object.keys(clean).forEach(key => {
            if (SyncService.TEXT_NON_UUID_FIELDS.has(key)) return;
            if ((tableName === 'action_logs' || tableName === 'app_action_logs') && (key === 'entity_id' || key === 'performed_by')) return;

            const val = clean[key];
            if (typeof val === 'string') {
                const isFkOrUuidField =
                    key.endsWith('_id') ||
                    key.endsWith('_by') ||
                    key.endsWith('_uuid') ||
                    SyncService.UUID_FK_FIELDS.includes(key);
                if (isFkOrUuidField) {
                    if (val.trim() === '' || !SyncService.UUID_REGEX.test(val)) {
                        // For mandatory NOT NULL foreign keys, supply a deterministic valid UUID fallback instead of null
                        if (tableName === 'marketplace_orders' && key === 'buyer_id') {
                            clean[key] = deterministicUuid('buyer-default');
                        } else if (tableName === 'marketplace_order_items' && key === 'product_id') {
                            clean[key] = deterministicUuid('prod-default');
                        } else if (tableName === 'marketplace_order_items' && key === 'sub_order_id') {
                            clean[key] = deterministicUuid('suborder-default');
                        } else {
                            clean[key] = null;
                        }
                    }
                } else if (key === 'id') {
                    if (val.trim() === '') {
                        clean[key] = null;
                    }
                }
            }
        });

        // Override updated_at to the current server time so that other devices
        // will pull this record. WatermelonDB requires that the server sets its
        // own updated_at during push for conflict resolution to work properly with offline sync.
        clean.updated_at = this.getRemoteTimestampValue(
            tableName,
            'updated_at',
            Date.now() + this.clockOffset
        );

        return clean;
    }
}
