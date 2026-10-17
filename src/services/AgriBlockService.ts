import { Database, Model, Q } from '@nozbe/watermelondb';
import randomId from '@nozbe/watermelondb/utils/common/randomId';
import { database as globalDatabase } from '../database';
import AgriParcel from '../database/models/AgriParcel';
import AgriParcelBlock from '../database/models/AgriParcelBlock';
import AgriBlockAssignment from '../database/models/AgriBlockAssignment';
import AgriPendingLayoutOperation from '../database/models/AgriPendingLayoutOperation';
import { parseGpsCoordinatesStrict } from '../utils/coordinates';
import { ParcelGeometry, measureParcelGeometry, validateBlockLayout, validateParcelGeometry } from '../utils/parcelGeometry';
import { isValidCoordinate } from '../utils/coordinates';
import { ActionLogService, LogParams } from './ActionLogService';
import { AuthService } from './AuthService';
import { assertAgriDatabaseUsable, runAuditedAgriBatch, writeAgriDatabase } from './AgriWriteSafety';

export interface SaveLayoutInput {
    parcelId: string;
    expectedRevision: number;
    geometry: ParcelGeometry;
    blocks: Array<{ id: string; name: string; geometry: ParcelGeometry }>;
    operationId: string;
}

export interface ClearBoundaryInput {
    parcelId: string;
    expectedRevision: number;
    operationId: string;
}

export interface SaveBoundaryInput extends ClearBoundaryInput {
    geometry: ParcelGeometry;
}

type BoundaryCommandKind = 'layout' | 'clear' | 'legacy_point';

export interface LayoutBlockSnapshot {
    id: string;
    parcelId: string;
    name: string;
    code: string | null;
    geometry: ParcelGeometry;
    areaHectares: number;
    status: 'active';
    boundaryRevision: number;
    layoutRevision: number;
    createdAt: number;
    updatedAt: number;
    deletedAt: null;
}

/** Complete immutable publication command; no future RPC needs mutable current rows. */
export interface PendingLayoutPayload {
    /** Absent in older local commands means layout. */
    kind?: BoundaryCommandKind;
    operationId: string;
    expectedRevision: number;
    parcelId: string;
    performedBy: string;
    targetRevision: number;
    boundaryRevision: number;
    boundarySavedAt: number;
    geometry: ParcelGeometry;
    netAreaHectares: number;
    blocks: LayoutBlockSnapshot[];
    archivedIds: string[];
    requestJson: string;
}

/** Internal helpers shared with assignment handlers; all reference checks run in their writer. */
export function stablePayload(value: any): string {
    return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}

export function requireSubmissionUuid(value: string): void {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new Error('Operation/submission/block ID must be a UUID');
    }
}

export async function resolveSupervisor(performedBy?: string): Promise<string> {
    const supervisor = performedBy || await AuthService.getCurrentUserId();
    if (!supervisor || !supervisor.trim()) throw new Error('Recording supervisor is required');
    return supervisor;
}

export function requireActiveParcel(parcel: AgriParcel): void {
    if (parcel.deletedAt || !['available', 'land_prep', 'planted', 'harvesting', 'fallow'].includes(parcel.status)) {
        throw new Error('Parcel is deleted or inactive');
    }
}

export function readParcelGeometry(parcel: AgriParcel): ParcelGeometry {
    try {
        const outer = parseGpsCoordinatesStrict(parcel.gpsCoordinates);
        const holes = parcel.gpsExclusions == null ? [] : JSON.parse(parcel.gpsExclusions);
        if (!Array.isArray(holes)) throw new Error('Invalid exclusion rings');
        const geometry = { outer, holes: holes.map(ring => parseGpsCoordinatesStrict(JSON.stringify(ring))) };
        if (outer.length < 3 ? outer.length === 2 || geometry.holes.length > 0 : validateParcelGeometry(geometry).length > 0) {
            throw new Error('Invalid stored GPS topology');
        }
        return geometry;
    } catch {
        throw new Error('Existing GPS geometry is corrupt; explicitly clear before replacing the boundary');
    }
}

export function prepareRequiredAudit(db: Database, params: LogParams[], supervisor: string): any[] {
    // Keep the marker first so audit-size truncation cannot remove its sync scope.
    // These complete local audit snapshots must not escape through encoder-readable core sync.
    const localPayload = (value: any) => value == null ? value : { sync_scope: 'agri_mapping_local', ...value };
    const logs = new ActionLogService(db).prepareLogActionsSync(params.map(param => ({ ...param,
        oldData: localPayload(param.oldData), newData: localPayload(param.newData),
    })), supervisor);
    if (!Array.isArray(logs) || logs.length !== params.length || logs.some(log => !log || log.table !== 'action_logs')) {
        throw new Error('Required audit records could not be prepared');
    }
    return logs;
}

export async function assertUuidNotUsedElsewhere(db: Database, submissionId: string, ownTable: string): Promise<void> {
    for (const [table, column] of [
        ['agri_pending_layout_operations', 'operation_id'],
        ['agri_block_assignments', 'submission_id'],
        ['agri_block_progress', 'submission_id'],
    ]) {
        if (table !== ownTable && await db.get(table).query(Q.where(column, submissionId)).fetchCount()) {
            throw new Error('UUID reused for a different payload/operation');
        }
    }
}

export class AgriBlockService {
    static async listBlocks(parcelId: string, db: Database = globalDatabase): Promise<AgriParcelBlock[]> {
        assertAgriDatabaseUsable(db);
        const rows = await db.get<AgriParcelBlock>('agri_parcel_blocks').query(
            Q.where('parcel_id', parcelId), Q.where('deleted_at', null), Q.where('status', 'active'),
            Q.sortBy('created_at', Q.asc), Q.sortBy('id', Q.asc),
        ).fetch();
        assertAgriDatabaseUsable(db);
        return rows;
    }

    static async saveLayout(input: SaveLayoutInput, db: Database = globalDatabase, performedBy?: string): Promise<number> {
        return this.saveCommand(input, 'layout', db, performedBy);
    }

    static async clearBoundary(input: ClearBoundaryInput, db: Database = globalDatabase, performedBy?: string): Promise<number> {
        return this.saveCommand({ ...input, geometry: { outer: [], holes: [] }, blocks: [] }, 'clear', db, performedBy);
    }

    /** Legacy boundary-only command. Polygon saves retain the accepted blocks, never archive implicitly. */
    static async saveBoundary(input: SaveBoundaryInput, db: Database = globalDatabase, performedBy?: string): Promise<number> {
        assertAgriDatabaseUsable(db);
        requireSubmissionUuid(input.operationId);
        const geometry = input.geometry;
        if (!geometry || !Array.isArray(geometry.outer) || !Array.isArray(geometry.holes)) throw new Error('Invalid GPS geometry');
        if (!geometry.outer.length && !geometry.holes.length) return this.clearBoundary(input, db, performedBy);
        if (geometry.outer.length === 1 && !geometry.holes.length) {
            const point = geometry.outer[0];
            if (!point || !isValidCoordinate(point.latitude, point.longitude)) throw new Error('Invalid GPS coordinate');
            return this.saveCommand({ ...input, blocks: [] }, 'legacy_point', db, performedBy);
        }
        const errors = validateParcelGeometry(geometry);
        if (errors.length) throw new Error(`Invalid GPS geometry: ${errors.join('; ')}`);
        // Snapshot before awaiting. CAS in saveLayout rejects any intervening layout/block change.
        const command = JSON.parse(JSON.stringify(input));
        const retained = await this.listBlocks(input.parcelId, db);
        return this.saveLayout({ ...command, blocks: retained.map(block => ({ id: block.id,
            name: block.name, geometry: JSON.parse(block.geometryJson) })) }, db, performedBy);
    }

    private static async saveCommand(input: SaveLayoutInput, kind: BoundaryCommandKind, db: Database, performedBy?: string): Promise<number> {
        assertAgriDatabaseUsable(db);
        requireSubmissionUuid(input.operationId);
        if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) throw new Error('Invalid expected layout revision');
        if (!Array.isArray(input.blocks)) throw new Error('Blocks must be an array');
        const ids = new Set<string>();
        for (const block of input.blocks) {
            requireSubmissionUuid(block.id);
            if (ids.has(block.id)) throw new Error('Duplicate block UUID');
            ids.add(block.id);
            if (typeof block.name !== 'string' || !block.name.trim()) throw new Error('Block name is required');
        }
        if (kind === 'layout') {
            const errors = validateBlockLayout(input.geometry, input.blocks.map(block => block.geometry));
            if (errors.length) throw new Error(`Invalid block layout: ${errors.join('; ')}`);
        }
        // Capture caller-owned data before awaiting; later UI edits cannot alter this command.
        const command: SaveLayoutInput = JSON.parse(JSON.stringify(input));
        const supervisor = await resolveSupervisor(performedBy);
        // Preserve old layout request identity; only the new non-polygon commands need a discriminator.
        const requestJson = stablePayload({ ...command, ...(kind === 'layout' ? {} : { kind }),
            blocks: [...command.blocks].sort((a, b) => a.id.localeCompare(b.id)), performedBy: supervisor });

        return writeAgriDatabase(db, async () => {
            assertAgriDatabaseUsable(db);
            const outbox = db.get<AgriPendingLayoutOperation>('agri_pending_layout_operations');
            const previous = await outbox.query(Q.where('operation_id', command.operationId)).fetch();
            if (previous.length) {
                const payload: PendingLayoutPayload = JSON.parse(previous[0].payloadJson);
                if (payload.requestJson !== requestJson) throw new Error('UUID reused for a different payload');
                return payload.targetRevision;
            }
            await assertUuidNotUsedElsewhere(db, command.operationId, outbox.table);
            const parcel = await db.get<AgriParcel>('agri_parcels').find(command.parcelId);
            // Clear is a repair operation, not new active topology; legacy rows may lack status.
            if (kind === 'clear') {
                if (parcel.deletedAt) throw new Error('Parcel is deleted');
            } else requireActiveParcel(parcel);
            if (parcel.layoutRevision !== command.expectedRevision) throw new Error('Layout revision conflict; reload the accepted local layout');
            let oldGeometry: ParcelGeometry | null;
            if (kind === 'clear') {
                try { oldGeometry = readParcelGeometry(parcel); } catch { oldGeometry = null; }
            } else oldGeometry = readParcelGeometry(parcel);
            const retained = await this.listBlocks(parcel.id, db);
            if (kind !== 'layout' && retained.length) throw new Error('Cannot clear or replace with a legacy point with retained blocks; archive them first');
            // Even a block archived by this command must not be orphaned by its new parent.
            for (const block of retained) {
                const errors = validateBlockLayout(command.geometry, [JSON.parse(block.geometryJson)]);
                if (errors.length) throw new Error(`Parent boundary would orphan retained block ${block.id}: ${errors.join('; ')}`);
            }
            const collection = db.get<AgriParcelBlock>('agri_parcel_blocks');
            const existing = await collection.query(Q.where('id', Q.oneOf([...ids]))).fetch();
            const byId = new Map(existing.map(block => [block.id, block]));
            for (const block of existing) {
                if (block.parcelId !== parcel.id) throw new Error('Block UUID belongs to another parcel');
                if (block.deletedAt || block.status !== 'active') throw new Error('Archived block UUID cannot be reused; use a new block UUID');
            }
            const nextGeometry = new Map(command.blocks.map(block => [block.id, stablePayload(block.geometry)]));
            for (const block of retained) {
                const changed = !nextGeometry.has(block.id) || nextGeometry.get(block.id) !== stablePayload(JSON.parse(block.geometryJson));
                if (changed && await db.get<AgriBlockAssignment>('agri_block_assignments').query(
                    Q.where('block_id', block.id), Q.where('deleted_at', null), Q.where('status', Q.oneOf(['assigned', 'in_progress'])),
                ).fetchCount()) throw new Error('Block boundary edit/archive forbidden with active assignments; complete or cancel first');
            }
            const targetRevision = command.expectedRevision + 1;
            if (!Number.isSafeInteger(targetRevision)) throw new Error('Layout revision overflow');
            const now = Date.now();
            const geometryChanged = stablePayload(oldGeometry) !== stablePayload(command.geometry);
            const boundaryRevision = parcel.boundaryRevision + (geometryChanged ? 1 : 0);
            if (!Number.isSafeInteger(boundaryRevision)) throw new Error('Boundary revision overflow');
            const netAreaHectares = kind === 'layout' ? measureParcelGeometry(command.geometry).areaHectares : parcel.areaHectares;
            const snapshots: LayoutBlockSnapshot[] = command.blocks.map(block => {
                const old = byId.get(block.id);
                const changed = !old || stablePayload(JSON.parse(old.geometryJson)) !== stablePayload(block.geometry);
                return { id: block.id, parcelId: parcel.id, name: block.name, code: old?.code ?? null,
                    geometry: block.geometry, areaHectares: measureParcelGeometry(block.geometry).areaHectares,
                    status: 'active', boundaryRevision: (old?.boundaryRevision ?? 0) + (changed ? 1 : 0),
                    layoutRevision: targetRevision, createdAt: old?.createdAt.getTime() ?? now, updatedAt: now, deletedAt: null };
            });
            const archived = retained.filter(block => !ids.has(block.id));
            const payload: PendingLayoutPayload = { kind, operationId: command.operationId, expectedRevision: command.expectedRevision,
                parcelId: parcel.id, performedBy: supervisor, targetRevision, boundaryRevision, boundarySavedAt: now,
                geometry: command.geometry, netAreaHectares, blocks: snapshots, archivedIds: archived.map(b => b.id), requestJson };
            const operationRecordId = randomId();
            const logs: LogParams[] = [
                { entityType: parcel.table, entityId: parcel.id, action: 'UPDATE', oldData: { ...parcel._raw }, newData: payload },
                ...snapshots.map(block => ({ entityType: collection.table, entityId: block.id,
                    action: byId.has(block.id) ? 'UPDATE' as const : 'CREATE' as const,
                    oldData: byId.has(block.id) ? { ...byId.get(block.id)!._raw } : undefined, newData: block })),
                ...archived.map(block => ({ entityType: collection.table, entityId: block.id, action: 'DELETE' as const,
                    oldData: { ...block._raw }, newData: { ...block._raw, status: 'archived', deleted_at: now } })),
                { entityType: outbox.table, entityId: operationRecordId, action: 'CREATE', newData: payload },
            ];
            // Audit must be ready before any prepareUpdate mutates Watermelon's cached _raw.
            const audits = prepareRequiredAudit(db, logs, supervisor);
            await runAuditedAgriBatch(db, () => {
                const mutations: Model[] = [parcel.prepareUpdate(record => {
                    record.gpsCoordinates = command.geometry.outer.length ? JSON.stringify(command.geometry.outer) : null;
                    record.gpsExclusions = command.geometry.holes.length ? JSON.stringify(command.geometry.holes) : null;
                    record.areaHectares = netAreaHectares;
                    record.boundaryRevision = boundaryRevision;
                    record.layoutRevision = targetRevision;
                    record.boundarySavedAt = new Date(now);
                    record.updatedAt = new Date(now);
                })];
                for (const snapshot of snapshots) {
                    const fill = (record: AgriParcelBlock) => {
                        record.parcelId = snapshot.parcelId; record.name = snapshot.name; record.code = snapshot.code;
                        record.geometryJson = JSON.stringify(snapshot.geometry); record.areaHectares = snapshot.areaHectares;
                        record.status = 'active'; record.boundaryRevision = snapshot.boundaryRevision;
                        record.layoutRevision = targetRevision; record.updatedAt = new Date(now);
                    };
                    const old = byId.get(snapshot.id);
                    mutations.push(old ? old.prepareUpdate(fill) : collection.prepareCreate(record => {
                        record._raw.id = snapshot.id; fill(record); record.createdAt = new Date(now);
                    }));
                }
                for (const block of archived) mutations.push(block.prepareUpdate(record => {
                    record.status = 'archived'; record.deletedAt = new Date(now); record.updatedAt = new Date(now);
                    record.layoutRevision = targetRevision;
                }));
                mutations.push(outbox.prepareCreate(record => {
                    record._raw.id = operationRecordId;
                    // @readonly has no setter, even during creation. Initialize through Watermelon's
                    // sanitized setter, only inside prepareCreate; subsequent payload edits are forbidden.
                    record._setRaw('operation_id', command.operationId); record._setRaw('parcel_id', parcel.id);
                    record._setRaw('expected_revision', command.expectedRevision); record._setRaw('payload_json', JSON.stringify(payload));
                    record._setRaw('created_by', supervisor); record._setRaw('created_at', now);
                    record.state = 'queued'; record.updatedAt = new Date(now);
                }));
                return [...mutations, ...audits];
            });
            return targetRevision;
        });
    }
}

export default AgriBlockService;
