import { Database, Q } from '@nozbe/watermelondb';
import randomId from '@nozbe/watermelondb/utils/common/randomId';
import { database as globalDatabase } from '../database';
import AgriParcel from '../database/models/AgriParcel';
import AgriParcelBlock from '../database/models/AgriParcelBlock';
import AgriFarmWorker from '../database/models/AgriFarmWorker';
import AgriCropCycle from '../database/models/AgriCropCycle';
import AgriBlockAssignment, { BlockAssignmentStatus } from '../database/models/AgriBlockAssignment';
import AgriBlockProgress from '../database/models/AgriBlockProgress';
import { validateBlockLayout } from '../utils/parcelGeometry';
import { assertUuidNotUsedElsewhere, prepareRequiredAudit, readParcelGeometry, requireActiveParcel,
    requireSubmissionUuid, resolveSupervisor, stablePayload } from './AgriBlockService';
import { assertAgriDatabaseUsable, runAuditedAgriBatch, writeAgriDatabase } from './AgriWriteSafety';

export interface AssignWorkersInput {
    blockId: string;
    workerIds: string[];
    cropCycleId?: string;
    task: string;
    startDate: number;
    dueDate?: number;
    submissionId: string;
}

export interface RecordBlockProgressInput {
    assignmentId: string;
    progressPercent: number;
    status: 'assigned' | 'in_progress' | 'completed' | 'cancelled';
    updateDate: number;
    notes?: string;
    submissionId: string;
    correctionOfId?: string;
}

export function deriveAssignmentStatus(assignment: Pick<AgriBlockAssignment, 'status' | 'dueDate'>, now: number | Date = Date.now()): BlockAssignmentStatus | 'overdue' {
    const timestamp = now instanceof Date ? now.getTime() : now;
    return ['assigned', 'in_progress'].includes(assignment.status) && assignment.dueDate && assignment.dueDate.getTime() < timestamp
        ? 'overdue' : assignment.status;
}

function requireTimestamp(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0 || !Number.isFinite(new Date(value).getTime())) throw new Error('Invalid date; expected epoch milliseconds');
}

async function validateReferences(db: Database, blockId: string, workerIds: string[], cropCycleId?: string | null): Promise<AgriParcelBlock> {
    const block = await db.get<AgriParcelBlock>('agri_parcel_blocks').find(blockId);
    if (block.deletedAt || block.status !== 'active') throw new Error('Block is archived or inactive');
    const parcel = await db.get<AgriParcel>('agri_parcels').find(block.parcelId);
    requireActiveParcel(parcel);
    const errors = validateBlockLayout(readParcelGeometry(parcel), [JSON.parse(block.geometryJson)]);
    if (errors.length) throw new Error(`Block no longer matches parcel geometry: ${errors.join('; ')}`);
    for (const workerId of workerIds) {
        const worker = await db.get<AgriFarmWorker>('agri_farm_workers').find(workerId);
        if (worker.deletedAt || worker.status !== 'active') throw new Error('Worker is deleted or inactive');
    }
    if (cropCycleId) {
        const cycle = await db.get<AgriCropCycle>('agri_crop_cycles').find(cropCycleId);
        if (cycle.deletedAt || cycle.parcelId !== parcel.id || !['planning', 'land_prep', 'planted', 'growing', 'harvesting'].includes(cycle.status)) {
            throw new Error('Crop cycle is inactive or belongs to another parcel');
        }
    }
    return block;
}

/** Historical identity is independent of NEW assignment eligibility. */
async function validateProgressReferences(db: Database, assignment: AgriBlockAssignment, active: boolean): Promise<void> {
    const block = await db.get<AgriParcelBlock>('agri_parcel_blocks').find(assignment.blockId);
    const parcel = await db.get<AgriParcel>('agri_parcels').find(block.parcelId);
    await db.get<AgriFarmWorker>('agri_farm_workers').find(assignment.workerId);
    if (assignment.cropCycleId) {
        const cycle = await db.get<AgriCropCycle>('agri_crop_cycles').find(assignment.cropCycleId);
        if (cycle.parcelId !== parcel.id) throw new Error('Crop cycle belongs to another parcel');
    }
    if (active) {
        if (block.deletedAt || block.status !== 'active') throw new Error('Block is archived or inactive; cannot recreate active assignment');
        requireActiveParcel(parcel);
        const geometry = JSON.parse(block.geometryJson);
        if (assignment.assignedBoundaryRevision !== block.boundaryRevision
            || stablePayload(JSON.parse(assignment.assignedGeometrySnapshot)) !== stablePayload(geometry)) {
            throw new Error('Assigned block snapshot or boundary revision changed; create a new assignment');
        }
        const errors = validateBlockLayout(readParcelGeometry(parcel), [geometry]);
        if (errors.length) throw new Error(`Block no longer matches parcel geometry: ${errors.join('; ')}`);
    }
}

export class AgriBlockAssignmentService {
    static deriveAssignmentStatus = deriveAssignmentStatus;

    static async listAssignments(blockId: string, db: Database = globalDatabase): Promise<AgriBlockAssignment[]> {
        assertAgriDatabaseUsable(db);
        const rows = await db.get<AgriBlockAssignment>('agri_block_assignments').query(
            Q.where('block_id', blockId), Q.where('deleted_at', null), Q.sortBy('created_at', Q.asc), Q.sortBy('id', Q.asc),
        ).fetch();
        assertAgriDatabaseUsable(db);
        return rows;
    }

    /** Append order, not updateDate order: a correction may refer to an older work date. */
    static async listProgress(assignmentId: string, db: Database = globalDatabase): Promise<AgriBlockProgress[]> {
        assertAgriDatabaseUsable(db);
        const rows = await db.get<AgriBlockProgress>('agri_block_progress').query(
            Q.where('assignment_id', assignmentId), Q.sortBy('created_at', Q.asc), Q.sortBy('id', Q.asc),
        ).fetch();
        assertAgriDatabaseUsable(db);
        return rows;
    }

    static async assignWorkers(input: AssignWorkersInput, db: Database = globalDatabase, performedBy?: string): Promise<AgriBlockAssignment[]> {
        assertAgriDatabaseUsable(db);
        requireSubmissionUuid(input.submissionId);
        if (!Array.isArray(input.workerIds) || !input.workerIds.length || input.workerIds.some(id => typeof id !== 'string' || !id.trim()) || new Set(input.workerIds).size !== input.workerIds.length) {
            throw new Error('Select unique worker IDs');
        }
        if (typeof input.task !== 'string' || !input.task.trim()) throw new Error('Assignment task is required');
        requireTimestamp(input.startDate);
        if (input.dueDate != null) {
            requireTimestamp(input.dueDate);
            if (input.dueDate < input.startDate) throw new Error('Due date cannot precede start date');
        }
        if (input.cropCycleId !== undefined && (typeof input.cropCycleId !== 'string' || !input.cropCycleId.trim())) throw new Error('Invalid crop cycle ID');
        const command: AssignWorkersInput = { ...input, workerIds: [...input.workerIds].sort() };
        const supervisor = await resolveSupervisor(performedBy);
        const requestJson = stablePayload({ ...command, cropCycleId: command.cropCycleId ?? null,
            dueDate: command.dueDate ?? null, performedBy: supervisor });
        return writeAgriDatabase(db, async () => {
            assertAgriDatabaseUsable(db);
            const collection = db.get<AgriBlockAssignment>('agri_block_assignments');
            const existing = await collection.query(Q.where('submission_id', command.submissionId)).fetch();
            if (existing.length) {
                if (existing.length !== command.workerIds.length || existing.some(record => record.requestJson !== requestJson)) {
                    throw new Error('UUID reused for a different payload');
                }
                return existing.sort((a, b) => a.workerId.localeCompare(b.workerId));
            }
            await assertUuidNotUsedElsewhere(db, command.submissionId, collection.table);
            const block = await validateReferences(db, command.blockId, command.workerIds, command.cropCycleId);
            const now = Date.now();
            const values = command.workerIds.map(workerId => ({
                id: randomId(), block_id: block.id, worker_id: workerId, crop_cycle_id: command.cropCycleId ?? null,
                task: command.task, start_date: command.startDate, due_date: command.dueDate ?? null,
                status: 'assigned' as const, progress_percent: 0, created_by: supervisor,
                assigned_geometry_snapshot: block.geometryJson, assigned_boundary_revision: block.boundaryRevision,
                submission_id: command.submissionId, request_json: requestJson, created_at: now, updated_at: now, deleted_at: null,
            }));
            const audits = prepareRequiredAudit(db, values.map(value => ({ entityType: collection.table,
                entityId: value.id, action: 'CREATE', newData: value })), supervisor);
            let records: AgriBlockAssignment[] = [];
            await runAuditedAgriBatch(db, () => {
                records = values.map(value => collection.prepareCreate(record => {
                    record._raw.id = value.id;
                    // Initialize @readonly snapshot fields with sanitized setters inside prepareCreate only.
                    for (const [column, fieldValue] of Object.entries(value)) {
                        if (column !== 'id') record._setRaw(column, fieldValue);
                    }
                }));
                return [...records, ...audits];
            });
            return records;
        });
    }

    static async recordProgress(input: RecordBlockProgressInput, db: Database = globalDatabase, performedBy?: string): Promise<AgriBlockProgress> {
        assertAgriDatabaseUsable(db);
        requireSubmissionUuid(input.submissionId);
        requireTimestamp(input.updateDate);
        if (!Number.isFinite(input.progressPercent) || input.progressPercent < 0 || input.progressPercent > 100) throw new Error('Progress percentage must be 0–100');
        if (!['assigned', 'in_progress', 'completed', 'cancelled'].includes(input.status)) throw new Error('Invalid progress status; overdue is derived');
        if (input.status === 'completed' && input.progressPercent !== 100) throw new Error('Complete progress requires 100%');
        if (input.notes !== undefined && typeof input.notes !== 'string') throw new Error('Invalid progress notes');
        if (input.correctionOfId !== undefined && (typeof input.correctionOfId !== 'string' || !input.correctionOfId.trim())) throw new Error('Invalid correction history ID');
        const command = { ...input };
        const supervisor = await resolveSupervisor(performedBy);
        const requestJson = stablePayload({ ...command, notes: command.notes ?? null,
            correctionOfId: command.correctionOfId ?? null, performedBy: supervisor });
        return writeAgriDatabase(db, async () => {
            assertAgriDatabaseUsable(db);
            const collection = db.get<AgriBlockProgress>('agri_block_progress');
            const existing = await collection.query(Q.where('submission_id', command.submissionId)).fetch();
            if (existing.length) {
                if (existing[0].requestJson !== requestJson) throw new Error('UUID reused for a different payload');
                return existing[0];
            }
            await assertUuidNotUsedElsewhere(db, command.submissionId, collection.table);
            const assignment = await db.get<AgriBlockAssignment>('agri_block_assignments').find(command.assignmentId);
            if (assignment.deletedAt) throw new Error('Assignment is deleted');
            await validateProgressReferences(db, assignment, ['assigned', 'in_progress'].includes(command.status));
            if (command.correctionOfId) {
                const corrected = await collection.find(command.correctionOfId);
                if (corrected.assignmentId !== assignment.id) throw new Error('Correction must reference history of the same assignment');
            }
            if (['completed', 'cancelled'].includes(assignment.status) && ['assigned', 'in_progress'].includes(command.status) && !command.correctionOfId) {
                throw new Error('Reopening a finished assignment requires an explicit history correction');
            }
            // Strictly increasing append timestamps provide stable history order even within one millisecond.
            const history = await this.listProgress(assignment.id, db);
            const now = Math.max(Date.now(), (history[history.length - 1]?.createdAt.getTime() ?? 0) + 1);
            const value = { id: randomId(), assignment_id: assignment.id, update_date: command.updateDate,
                progress_percent: command.progressPercent, status: command.status, notes: command.notes ?? null,
                recorded_by: supervisor, submission_id: command.submissionId, correction_of_id: command.correctionOfId ?? null,
                request_json: requestJson, created_at: now, updated_at: now };
            const audits = prepareRequiredAudit(db, [
                { entityType: collection.table, entityId: value.id, action: 'CREATE', newData: value },
                { entityType: assignment.table, entityId: assignment.id, action: 'UPDATE', oldData: { ...assignment._raw },
                    newData: { ...assignment._raw, status: command.status, progress_percent: command.progressPercent, updated_at: now } },
            ], supervisor);
            let record!: AgriBlockProgress;
            await runAuditedAgriBatch(db, () => {
                record = collection.prepareCreate(record => {
                    record._raw.id = value.id;
                    for (const [column, fieldValue] of Object.entries(value)) {
                        if (column !== 'id') record._setRaw(column, fieldValue);
                    }
                });
                const updated = assignment.prepareUpdate(record => {
                    record.progressPercent = command.progressPercent; record.status = command.status; record.updatedAt = new Date(now);
                });
                return [record, updated, ...audits];
            });
            return record;
        });
    }
}

export default AgriBlockAssignmentService;
