import { Database } from '@nozbe/watermelondb';
import uuid from 'react-native-uuid';
import { createTestDatabase, modelClasses } from '../../__tests__/test-utils';
import AgriFarmWorker from '../../database/models/AgriFarmWorker';
import AgriCropCycle from '../../database/models/AgriCropCycle';
import { AgriParcelService } from '../AgriParcelService';
import { AgriBlockService } from '../AgriBlockService';
import { AgriBlockAssignmentService, AssignWorkersInput, RecordBlockProgressInput, deriveAssignmentStatus } from '../AgriBlockAssignmentService';
import { ActionLogService } from '../ActionLogService';
import { AuthService } from '../AuthService';

jest.mock('../AuthService', () => ({ AuthService: { getCurrentUserId: jest.fn().mockResolvedValue('DUMMY: supervisor') } }));
// DUMMY: synthetic test polygon and worker identities.
const geometry = { outer: [{ latitude: 0, longitude: 0 }, { latitude: 0.001, longitude: 0 },
    { latitude: 0.001, longitude: 0.001 }, { latitude: 0, longitude: 0.001 }], holes: [] };
const id = () => uuid.v4() as string;

describe('AgriBlockAssignmentService LOCAL persistence', () => {
    let db: Database;
    let parcelId: string;
    let blockId: string;
    let workers: AgriFarmWorker[];
    let input: AssignWorkersInput;
    beforeEach(async () => {
        db = createTestDatabase();
        (AuthService.getCurrentUserId as jest.Mock).mockResolvedValue('DUMMY: supervisor');
        const parcel = await AgriParcelService.createParcel({ name: 'DUMMY: parcel', landOwnerId: 'DUMMY: owner', areaHectares: 1 }, db);
        parcelId = parcel.id; blockId = id();
        await AgriBlockService.saveLayout({ parcelId, expectedRevision: 0, geometry,
            blocks: [{ id: blockId, name: 'DUMMY: block', geometry }], operationId: id() }, db);
        workers = await db.write(async () => Promise.all([0, 1].map(i => db.get<AgriFarmWorker>('agri_farm_workers').create(w => {
            w.name = `DUMMY: worker ${i}`; w.status = 'active'; w.dailyRate = 123;
        }))));
        input = { blockId, workerIds: workers.map(w => w.id), task: 'DUMMY: weeding', startDate: 1000, dueDate: 2000, submissionId: id() };
    });
    afterEach(() => jest.restoreAllMocks());
    const progress = (assignmentId: string, overrides: Partial<RecordBlockProgressInput> = {}): RecordBlockProgressInput => ({
        assignmentId, progressPercent: 40, status: 'in_progress', updateDate: 1500, submissionId: id(), ...overrides,
    });

    it('creates one assignment per worker with immutable snapshots and audit in one batch; retry is idempotent', async () => {
        const batch = jest.spyOn(db, 'batch');
        const records = await AgriBlockAssignmentService.assignWorkers(input, db);
        expect(batch).toHaveBeenCalledTimes(1);
        expect(records).toHaveLength(2);
        expect(records.map(r => r.workerId).sort()).toEqual(input.workerIds.sort());
        expect(JSON.parse(records[0].assignedGeometrySnapshot)).toEqual(geometry);
        expect(records[0].assignedBoundaryRevision).toBe(1);
        expect(records[0].createdBy).toBe('DUMMY: supervisor');
        expect(records[0].startDate.getTime()).toBe(1000);
        expect((await AgriBlockAssignmentService.listAssignments(blockId, db)).map(r => r.id).sort()).toEqual(records.map(r => r.id).sort());
        expect((await AgriBlockAssignmentService.assignWorkers(input, db)).map(r => r.id)).toEqual(records.map(r => r.id));
        expect(batch).toHaveBeenCalledTimes(1);
        await expect(AgriBlockAssignmentService.assignWorkers({ ...input, task: 'DUMMY: changed' }, db)).rejects.toThrow(/UUID|payload|reused/i);
    });

    it.each(['missing-worker', 'inactive-worker', 'deleted-worker', 'missing-cycle', 'wrong-cycle', 'closed-cycle', 'deleted-cycle', 'date', 'empty', 'duplicate', 'task', 'uuid'])('rejects invalid references/input %s atomically', async kind => {
        if (kind === 'missing-worker') input.workerIds.push(id());
        if (kind === 'inactive-worker') await db.write(() => workers[1].update(w => { w.status = 'inactive'; }));
        if (kind === 'deleted-worker') await db.write(() => workers[1].update(w => { w.deletedAt = new Date(); }));
        if (kind === 'missing-cycle') input.cropCycleId = id();
        if (['wrong-cycle', 'closed-cycle', 'deleted-cycle'].includes(kind)) {
            const cycle = await db.write(() => db.get<AgriCropCycle>('agri_crop_cycles').create(c => {
                c.parcelId = kind === 'wrong-cycle' ? id() : parcelId;
                c.status = kind === 'closed-cycle' ? 'closed' : 'growing';
                if (kind === 'deleted-cycle') c.deletedAt = new Date();
            }));
            input.cropCycleId = cycle.id;
        }
        if (kind === 'date') input.dueDate = 0;
        if (kind === 'empty') input.workerIds = [];
        if (kind === 'duplicate') input.workerIds.push(input.workerIds[0]);
        if (kind === 'task') input.task = ' ';
        if (kind === 'uuid') input.submissionId = 'DUMMY: bad UUID';
        const count = await db.get('action_logs').query().fetchCount();
        await expect(AgriBlockAssignmentService.assignWorkers(input, db)).rejects.toThrow();
        expect(await db.get('agri_block_assignments').query().fetchCount()).toBe(0);
        expect(await db.get('action_logs').query().fetchCount()).toBe(count);
    });

    it('accepts a matching active cycle but rejects archived blocks and inactive parents', async () => {
        const cycle = await db.write(() => db.get<AgriCropCycle>('agri_crop_cycles').create(c => {
            c.parcelId = parcelId; c.status = 'growing';
        }));
        const records = await AgriBlockAssignmentService.assignWorkers({ ...input, cropCycleId: cycle.id }, db);
        expect(records.every(r => r.cropCycleId === cycle.id)).toBe(true);
        const parcel = await db.get<any>('agri_parcels').find(parcelId);
        await db.write(() => parcel.update((p: any) => { p.status = 'inactive'; }));
        await expect(AgriBlockAssignmentService.assignWorkers({ ...input, submissionId: id() }, db)).rejects.toThrow(/parcel/i);
        await db.write(() => parcel.update((p: any) => { p.status = 'available'; }));
        for (const record of records) await AgriBlockAssignmentService.recordProgress(progress(record.id, { status: 'cancelled' }), db);
        await AgriBlockService.saveLayout({ parcelId, expectedRevision: 1, geometry, blocks: [], operationId: id() }, db);
        await expect(AgriBlockAssignmentService.assignWorkers({ ...input, submissionId: id() }, db)).rejects.toThrow(/block/i);
    });

    it('records immutable percentage snapshots/corrections, latest state and derived overdue; history survives archival', async () => {
        const [assignment] = await AgriBlockAssignmentService.assignWorkers({ ...input, workerIds: [workers[0].id] }, db);
        expect(deriveAssignmentStatus(assignment, 3000)).toBe('overdue');
        expect(deriveAssignmentStatus(assignment, 2000)).toBe('assigned');
        const firstInput = progress(assignment.id);
        const batch = jest.spyOn(db, 'batch');
        const first = await AgriBlockAssignmentService.recordProgress(firstInput, db);
        expect(batch).toHaveBeenCalledTimes(1);
        expect((await AgriBlockAssignmentService.recordProgress(firstInput, db)).id).toBe(first.id);
        expect(batch).toHaveBeenCalledTimes(1);
        const second = await AgriBlockAssignmentService.recordProgress(progress(assignment.id, { progressPercent: 25, correctionOfId: first.id }), db);
        expect(assignment.progressPercent).toBe(25);
        expect(second.correctionOfId).toBe(first.id);
        expect(first.progressPercent).toBe(40);
        const completed = await AgriBlockAssignmentService.recordProgress(progress(assignment.id, { progressPercent: 100, status: 'completed' }), db);
        expect(deriveAssignmentStatus(assignment, 9999)).toBe('completed');
        await AgriBlockService.saveLayout({ parcelId, expectedRevision: 1, geometry, blocks: [], operationId: id() }, db);
        expect((await AgriBlockAssignmentService.listProgress(assignment.id, db)).map(p => p.id)).toEqual([first.id, second.id, completed.id]);
        expect((await AgriBlockAssignmentService.listAssignments(blockId, db))[0].assignedGeometrySnapshot).toBe(JSON.stringify(geometry));
        expect((await AgriBlockAssignmentService.recordProgress(firstInput, db)).id).toBe(first.id);
    });

    it('locks boundary edit/archive with assigned and in_progress records; completing/cancelling unlocks', async () => {
        const records = await AgriBlockAssignmentService.assignWorkers(input, db);
        const changed = { ...geometry, outer: geometry.outer.map(p => ({ ...p, latitude: p.latitude * 0.9 })) };
        const save = (blocks: any[]) => AgriBlockService.saveLayout({ parcelId, expectedRevision: 1, geometry, blocks, operationId: id() }, db);
        await expect(save([])).rejects.toThrow(/active assignment/i);
        await expect(save([{ id: blockId, name: 'DUMMY: edit', geometry: changed }])).rejects.toThrow(/active assignment/i);
        await AgriBlockAssignmentService.recordProgress(progress(records[0].id), db);
        await expect(save([])).rejects.toThrow(/active assignment/i);
        await AgriBlockAssignmentService.recordProgress(progress(records[0].id, { progressPercent: 100, status: 'completed' }), db);
        await AgriBlockAssignmentService.recordProgress(progress(records[1].id, { status: 'cancelled' }), db);
        expect(await save([{ id: blockId, name: 'DUMMY: edit', geometry: changed }])).toBe(2);
        expect(records.every(r => r.assignedGeometrySnapshot === JSON.stringify(geometry))).toBe(true);
    });

    it('rejects invalid progress, UUID reuse, and corrections to another assignment without changing cache/history', async () => {
        const records = await AgriBlockAssignmentService.assignWorkers(input, db);
        const other = await AgriBlockAssignmentService.recordProgress(progress(records[1].id), db);
        const raw = { ...records[0]._raw };
        for (const override of [
            { progressPercent: -1 }, { progressPercent: 101 }, { progressPercent: NaN }, { status: 'overdue' as any },
            { status: 'completed' as const, progressPercent: 99 }, { updateDate: NaN },
            { correctionOfId: other.id }, { correctionOfId: id() }, { submissionId: input.submissionId },
        ]) await expect(AgriBlockAssignmentService.recordProgress(progress(records[0].id, override), db)).rejects.toThrow();
        expect(records[0]._raw).toEqual(raw);
        expect(await AgriBlockAssignmentService.listProgress(records[0].id, db)).toHaveLength(0);
        const savedInput = progress(records[0].id);
        await AgriBlockAssignmentService.recordProgress(savedInput, db);
        await expect(AgriBlockAssignmentService.recordProgress({ ...savedInput, progressPercent: 80 }, db)).rejects.toThrow(/UUID|payload|reused/i);
    });

    it('fails closed on missing audits for both handlers and resolves supervisor outside the writer', async () => {
        const audit = jest.spyOn(ActionLogService.prototype, 'prepareLogActionsSync').mockReturnValue([]);
        await expect(AgriBlockAssignmentService.assignWorkers(input, db)).rejects.toThrow(/audit/i);
        expect(await db.get('agri_block_assignments').query().fetchCount()).toBe(0);
        audit.mockRestore();
        const [record] = await AgriBlockAssignmentService.assignWorkers(input, db);
        const raw = { ...record._raw };
        const prepare = jest.spyOn(record, 'prepareUpdate');
        const missing = jest.spyOn(ActionLogService.prototype, 'prepareLogActionsSync').mockImplementation(() => { throw new Error('DUMMY: audit unavailable'); });
        await expect(AgriBlockAssignmentService.recordProgress(progress(record.id), db)).rejects.toThrow(/audit/i);
        expect(prepare).not.toHaveBeenCalled();
        expect(record._raw).toEqual(raw);
        missing.mockRestore();
        let resolved = false;
        (AuthService.getCurrentUserId as jest.Mock).mockImplementation(async () => { resolved = true; return 'DUMMY: supervisor'; });
        const write = db.write.bind(db);
        jest.spyOn(db, 'write').mockImplementation((writer: any, description?: string) => {
            expect(resolved).toBe(true); return write(writer, description);
        });
        await AgriBlockAssignmentService.recordProgress(progress(record.id), db);
    });

    it.each(['completed', 'cancelled'] as const)('allows terminal %s after worker deactivation/cycle closure/block archival without erasing snapshots', async status => {
        const cycle = await db.write(() => db.get<AgriCropCycle>('agri_crop_cycles').create(c => { c.parcelId = parcelId; c.status = 'growing'; }));
        const [assignment] = await AgriBlockAssignmentService.assignWorkers({ ...input, workerIds: [workers[0].id], cropCycleId: cycle.id }, db);
        const snapshot = assignment.assignedGeometrySnapshot;
        await db.write(async () => {
            await workers[0].update(w => { w.status = 'inactive'; });
            await cycle.update(c => { c.status = 'closed'; });
            const block = await db.get<any>('agri_parcel_blocks').find(blockId);
            await block.update((b: any) => { b.status = 'archived'; b.deletedAt = new Date(); });
            const parcel = await db.get<any>('agri_parcels').find(parcelId);
            await parcel.update((p: any) => { p.status = 'inactive'; });
        });
        await AgriBlockAssignmentService.recordProgress(progress(assignment.id, { status, progressPercent: status === 'completed' ? 100 : 40 }), db);
        expect(assignment.status).toBe(status);
        expect(assignment.assignedGeometrySnapshot).toBe(snapshot);
        expect((await db.get<any>('agri_parcel_blocks').find(blockId)).status).toBe('archived');
    });

    it('allows linked terminal history corrections on archived blocks but forbids recreation of active work', async () => {
        const [assignment] = await AgriBlockAssignmentService.assignWorkers({ ...input, workerIds: [workers[0].id] }, db);
        const completed = await AgriBlockAssignmentService.recordProgress(progress(assignment.id, { status: 'completed', progressPercent: 100 }), db);
        await AgriBlockService.saveLayout({ parcelId, expectedRevision: 1, geometry, blocks: [], operationId: id() }, db);
        await db.write(() => workers[0].update(w => { w.status = 'inactive'; }));
        const correction = await AgriBlockAssignmentService.recordProgress(progress(assignment.id, {
            status: 'cancelled', progressPercent: 90, correctionOfId: completed.id }), db);
        expect(correction.correctionOfId).toBe(completed.id);
        const raw = { ...assignment._raw };
        await expect(AgriBlockAssignmentService.recordProgress(progress(assignment.id, { correctionOfId: correction.id }), db)).rejects.toThrow(/block|archived/i);
        expect(assignment._raw).toEqual(raw);
        expect(await AgriBlockAssignmentService.listProgress(assignment.id, db)).toHaveLength(2);
    });

    it.each(['geometry-and-revision', 'snapshot-only', 'revision-only'].flatMap(change =>
        ['assigned', 'in_progress'].map(status => ({ change, status: status as 'assigned' | 'in_progress' }))))(
        'rejects $status correction after stable block $change changed, preserving latest state/history/retries', async ({ change, status }) => {
            const [assignment] = await AgriBlockAssignmentService.assignWorkers({ ...input, workerIds: [workers[0].id] }, db);
            const completedInput = progress(assignment.id, { status: 'completed', progressPercent: 100 });
            const completed = await AgriBlockAssignmentService.recordProgress(completedInput, db);
            const changed = { ...geometry, outer: geometry.outer.map(point => ({ ...point, latitude: point.latitude * 0.9 })) };
            await AgriBlockService.saveLayout({ parcelId, expectedRevision: 1, geometry,
                blocks: [{ id: blockId, name: 'DUMMY: changed stable block', geometry: changed }], operationId: id() }, db);
            const block = await db.get<any>('agri_parcel_blocks').find(blockId);
            if (change === 'snapshot-only') {
                // DUMMY: inconsistent imported revision isolates the snapshot check from the revision check.
                await db.write(() => block.update((row: any) => { row.boundaryRevision = assignment.assignedBoundaryRevision; }));
            } else if (change === 'revision-only') {
                await AgriBlockService.saveLayout({ parcelId, expectedRevision: 2, geometry,
                    blocks: [{ id: blockId, name: 'DUMMY: restored geometry', geometry }], operationId: id() }, db);
                expect(block.geometryJson).toBe(assignment.assignedGeometrySnapshot);
            }
            const raw = { ...assignment._raw };
            const history = (await AgriBlockAssignmentService.listProgress(assignment.id, db)).map(row => ({ ...row._raw }));
            const count = await db.get('action_logs').query().fetchCount();
            const batch = jest.spyOn(db, 'batch');
            await expect(AgriBlockAssignmentService.recordProgress(progress(assignment.id, { status, correctionOfId: completed.id }), db))
                .rejects.toThrow(/snapshot|revision|new assignment/i);
            expect(batch).not.toHaveBeenCalled();
            expect(assignment._raw).toEqual(raw);
            expect((await AgriBlockAssignmentService.listProgress(assignment.id, db)).map(row => ({ ...row._raw }))).toEqual(history);
            expect(await db.get('action_logs').query().fetchCount()).toBe(count);
            expect((await AgriBlockAssignmentService.recordProgress(completedInput, db)).id).toBe(completed.id);
            const correctionInput = progress(assignment.id, { status: 'cancelled', correctionOfId: completed.id });
            const correction = await AgriBlockAssignmentService.recordProgress(correctionInput, db);
            expect((await AgriBlockAssignmentService.recordProgress(correctionInput, db)).id).toBe(correction.id);
            expect(completed.progressPercent).toBe(100);
            expect((await AgriBlockAssignmentService.listProgress(assignment.id, db)).map(row => row.id)).toEqual([completed.id, correction.id]);
            const [replacement] = await AgriBlockAssignmentService.assignWorkers({ ...input, workerIds: [workers[0].id], submissionId: id() }, db);
            expect(replacement.assignedGeometrySnapshot).toBe(block.geometryJson);
            expect(replacement.assignedBoundaryRevision).toBe(block.boundaryRevision);
            await AgriBlockAssignmentService.recordProgress(progress(replacement.id), db);
        });

    it('allows explicit active correction when the original snapshot/revision still matches despite a metadata-only block edit', async () => {
        const [assignment] = await AgriBlockAssignmentService.assignWorkers({ ...input, workerIds: [workers[0].id] }, db);
        const completed = await AgriBlockAssignmentService.recordProgress(progress(assignment.id, { status: 'completed', progressPercent: 100 }), db);
        await AgriBlockService.saveLayout({ parcelId, expectedRevision: 1, geometry,
            blocks: [{ id: blockId, name: 'DUMMY: renamed only', geometry }], operationId: id() }, db);
        const command = progress(assignment.id, { correctionOfId: completed.id });
        const corrected = await AgriBlockAssignmentService.recordProgress(command, db);
        expect(assignment.status).toBe('in_progress');
        expect((await AgriBlockAssignmentService.recordProgress(command, db)).id).toBe(corrected.id);
        expect((await AgriBlockAssignmentService.listProgress(assignment.id, db)).map(row => row.id)).toEqual([completed.id, corrected.id]);
    });

    it('separates active progress from new-worker/cycle eligibility but still validates identities and active topology', async () => {
        const cycle = await db.write(() => db.get<AgriCropCycle>('agri_crop_cycles').create(c => { c.parcelId = parcelId; c.status = 'growing'; }));
        const [assignment] = await AgriBlockAssignmentService.assignWorkers({ ...input, workerIds: [workers[0].id], cropCycleId: cycle.id }, db);
        const first = await AgriBlockAssignmentService.recordProgress(progress(assignment.id), db);
        await db.write(async () => {
            await workers[0].update(w => { w.status = 'inactive'; });
            await cycle.update(c => { c.status = 'closed'; });
        });
        await AgriBlockAssignmentService.recordProgress(progress(assignment.id, { correctionOfId: first.id, progressPercent: 20 }), db);
        expect(assignment.progressPercent).toBe(20);
        await db.write(() => cycle.update(c => { c.parcelId = id(); }));
        await expect(AgriBlockAssignmentService.recordProgress(progress(assignment.id, { status: 'cancelled' }), db)).rejects.toThrow(/cycle|parcel/i);
    });

    it.each(['assignment', 'progress'])('poisons rejected %s batches; reopened persisted cache/history/audits allow same-ID retry', async kind => {
        const assignment = kind === 'progress' ? (await AgriBlockAssignmentService.assignWorkers({ ...input, workerIds: [workers[0].id] }, db))[0] : undefined;
        const raw = assignment ? { ...assignment._raw } : undefined;
        const count = await db.get('action_logs').query().fetchCount();
        const command = assignment ? progress(assignment.id) : undefined;
        const submit = (database: Database) => command ? AgriBlockAssignmentService.recordProgress(command, database) : AgriBlockAssignmentService.assignWorkers(input, database);
        const adapter = jest.spyOn(db.adapter, 'batch').mockRejectedValueOnce(new Error('DUMMY: precommit adapter rejection'));
        await expect(submit(db)).rejects.toThrow(/reopen/i);
        if (assignment) {
            expect(assignment._raw).not.toEqual(raw); // unusable old cache; never silently restored on ambiguous I/O
            expect((assignment as any)._preparedState).toBeNull();
        }
        await expect(submit(db)).rejects.toThrow(/reopen/i);
        await expect(AgriBlockAssignmentService.listAssignments(blockId, db)).rejects.toThrow(/reopen/i);
        expect(adapter).toHaveBeenCalledTimes(1);
        adapter.mockRestore();
        const underlying = db.adapter.underlyingAdapter as any;
        await new Promise<void>((resolve, reject) => underlying._driver.loki.saveDatabase((error: Error) => error ? reject(error) : resolve()));
        const reopened = new Database({ adapter: await underlying.testClone(), modelClasses });
        if (assignment) expect((await reopened.get('agri_block_assignments').find(assignment.id))._raw).toEqual(raw);
        expect(await reopened.get('agri_block_progress').query().fetchCount()).toBe(0);
        expect(await reopened.get('agri_block_assignments').query().fetchCount()).toBe(assignment ? 1 : 0);
        expect(await reopened.get('action_logs').query().fetchCount()).toBe(count);
        const accepted = await submit(reopened);
        const retried = await submit(reopened);
        expect(Array.isArray(accepted) ? (retried as any[]).map(r => r.id) : (retried as any).id)
            .toEqual(Array.isArray(accepted) ? accepted.map(r => r.id) : accepted.id);
        expect(await reopened.get('action_logs').query().fetchCount()).toBe(count + 2);
    });

    // The payroll/wage tables (`payrolls`, `payroll_runs`, `payroll_lines`) were retired with the
    // payroll teardown, so the "nothing else was written" sweep now covers only SURVIVING money,
    // wage and movement tables. Assigning work and recording progress must not mint labour pay,
    // farm expenses, settlements, cash, journal or stock rows, and must not touch crop history.
    const SIDE_EFFECT_TABLES = [
        'agri_labor_logs', 'agri_farm_expenses', 'agri_weekly_settlements', 'agri_investor_ledgers',
        'expenses', 'cash_transactions', 'journal_entries', 'journal_entry_lines',
        'bank_transactions', 'stock_movements',
    ];

    it('does not create wages, cash, journal or modify crop history', async () => {
        expect(SIDE_EFFECT_TABLES.length).toBeGreaterThanOrEqual(8);
        const cycle = await db.write(() => db.get<AgriCropCycle>('agri_crop_cycles').create(c => { c.parcelId = parcelId; c.status = 'growing'; }));
        const raw = { ...cycle._raw };
        const records = await AgriBlockAssignmentService.assignWorkers({ ...input, cropCycleId: cycle.id }, db);
        await AgriBlockAssignmentService.recordProgress(progress(records[0].id), db);
        expect(cycle._raw).toEqual(raw);

        // Positive control: every swept table is a real surviving collection AND this very
        // operation did persist rows, so the zero counts below cannot be a vacuous pass.
        for (const table of SIDE_EFFECT_TABLES) {
            expect(db.get(table)).not.toBeNull();
        }
        expect(await db.get('agri_block_assignments').query().fetchCount()).toBe(2);
        expect(await db.get('agri_block_progress').query().fetchCount()).toBe(1);
        expect(await db.get('agri_crop_cycles').query().fetchCount()).toBe(1);

        const counts = await Promise.all(SIDE_EFFECT_TABLES.map(table => db.get(table).query().fetchCount()));
        expect(counts).toEqual(SIDE_EFFECT_TABLES.map(() => 0));
        expect(counts.reduce((sum, n) => sum + n, 0)).toBe(0);
        expect(workers.map(w => w.dailyRate)).toEqual([123, 123]);
    });
});
