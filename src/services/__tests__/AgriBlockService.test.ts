import { Database, Query, appSchema, tableSchema } from '@nozbe/watermelondb';
import uuid from 'react-native-uuid';
import { createTestDatabase, createTestLokiAdapter, modelClasses } from '../../__tests__/test-utils';
import { mySchema } from '../../database/schema';
import { myMigrations } from '../../database/migrations';
import AgriParcel from '../../database/models/AgriParcel';
import { AgriParcelService } from '../AgriParcelService';
import { AgriBlockService, SaveLayoutInput } from '../AgriBlockService';
import { ActionLogService } from '../ActionLogService';
import { AgriBlockAssignmentService } from '../AgriBlockAssignmentService';
import { runAuditedAgriBatch } from '../AgriWriteSafety';
import { measureParcelGeometry, ParcelGeometry } from '../../utils/parcelGeometry';

jest.mock('../AuthService', () => ({ AuthService: { getCurrentUserId: jest.fn().mockResolvedValue('DUMMY: supervisor') } }));

// DUMMY: synthetic rectangles, not registered land coordinates.
const rectangle = (south: number, west: number, north: number, east: number): ParcelGeometry => ({
    outer: [{ latitude: south, longitude: west }, { latitude: north, longitude: west },
        { latitude: north, longitude: east }, { latitude: south, longitude: east }], holes: [],
});
const parent = rectangle(0, 0, 0.004, 0.004);
const block = rectangle(0, 0, 0.002, 0.002);

async function persistedClone(db: Database, options = {}) {
    const adapter = db.adapter.underlyingAdapter as any;
    // Test adapters disable autosave; persist explicitly before reopening with a fresh cache.
    await new Promise<void>((resolve, reject) => adapter._driver.loki.saveDatabase((error: Error) => error ? reject(error) : resolve()));
    return adapter.testClone(options);
}

describe('AgriBlockService LOCAL persistence', () => {
    let db: Database;
    let parcel: AgriParcel;
    let input: SaveLayoutInput;
    beforeEach(async () => {
        db = createTestDatabase();
        parcel = await AgriParcelService.createParcel({ name: 'DUMMY: parcel', landOwnerId: 'DUMMY: owner',
            areaHectares: 99, gpsCoordinates: parent.outer }, db);
        input = { parcelId: parcel.id, expectedRevision: 0, geometry: parent,
            blocks: [{ id: uuid.v4() as string, name: 'DUMMY: block', geometry: block }], operationId: uuid.v4() as string };
    });
    afterEach(() => jest.restoreAllMocks());

    it('marks every layout audit as local mapping data while preserving the audited payload', async () => {
        const before = new Set((await db.get('action_logs').query().fetch()).map(log => log.id));
        await AgriBlockService.saveLayout(input, db);
        const logs = (await db.get<any>('action_logs').query().fetch()).filter(log => !before.has(log.id));
        expect(logs).toHaveLength(3);
        for (const log of logs) {
            expect(JSON.parse(log.newData).sync_scope).toBe('agri_mapping_local');
            if (log.oldData) expect(JSON.parse(log.oldData).sync_scope).toBe('agri_mapping_local');
        }
        const parcelAudit = logs.find(log => log.entityType === 'agri_parcels');
        expect(JSON.parse(parcelAudit.newData).geometry).toEqual(parent);
        expect(JSON.parse(parcelAudit.newData).operationId).toBe(input.operationId);
    });

    it.each(['blocks', 'assignments', 'progress'])('rejects cached %s returned after the database becomes quarantined', async kind => {
        await AgriBlockService.saveLayout(input, db);
        let release!: () => void;
        const gate = new Promise<void>(done => { release = done; });
        let started!: () => void;
        const entered = new Promise<void>(done => { started = done; });
        const originalFetch = Query.prototype.fetch;
        jest.spyOn(Query.prototype, 'fetch').mockImplementationOnce(async function (this: Query<any>) {
            const rows = await originalFetch.call(this);
            started();
            await gate;
            return rows;
        });
        const read = kind === 'blocks' ? AgriBlockService.listBlocks(parcel.id, db)
            : kind === 'assignments' ? AgriBlockAssignmentService.listAssignments(input.blocks[0].id, db)
            : AgriBlockAssignmentService.listProgress('synthetic-assignment', db);
        const result = read.then(rows => ({ rows, error: null }), error => ({ rows: null, error }));
        await entered;
        jest.spyOn(db, 'batch').mockRejectedValueOnce(new Error('Synthetic uncertain storage result'));
        await expect(db.write(() => runAuditedAgriBatch(db, () => []))).rejects.toThrow(/reopen/i);
        release();
        expect((await result).error).toMatchObject({ code: 'AGRI_DATABASE_REOPEN_REQUIRED' });
    });

    it('upgrades persisted v48 rows to v49 additively without erasing parcel/crop history', async () => {
        const addedTables = new Set(['agri_parcel_blocks', 'agri_block_assignments', 'agri_block_progress', 'agri_pending_layout_operations']);
        const addedColumns = new Set(['gps_exclusions', 'boundary_revision', 'layout_revision', 'boundary_saved_at']);
        const schema48 = appSchema({ version: 48, tables: Object.values(mySchema.tables)
            .filter(table => !addedTables.has(table.name)).map(table => tableSchema({ ...table,
                columns: Object.values(table.columns).filter(column => table.name !== 'agri_parcels' || !addedColumns.has(column.name)),
            })) });
        const legacy = new Database({ adapter: createTestLokiAdapter(schema48), modelClasses: modelClasses.filter(model => !addedTables.has(model.table)) });
        const old = await AgriParcelService.createParcel({ name: 'DUMMY: legacy parcel', landOwnerId: 'DUMMY: owner',
            areaHectares: 99, gpsCoordinates: parent.outer }, legacy);
        const cycle = await legacy.write(() => legacy.get<any>('agri_crop_cycles').create((record: any) => {
            record.parcelId = old.id; record.status = 'closed'; record.notes = 'DUMMY: preserved history';
        }));
        const upgraded = new Database({ adapter: await persistedClone(legacy, { schema: mySchema, migrations: myMigrations }), modelClasses });
        const saved = await upgraded.get<AgriParcel>('agri_parcels').find(old.id);
        expect(saved.name).toBe(old.name);
        expect(saved.gpsCoordinates).toBe(old.gpsCoordinates);
        expect(saved.areaHectares).toBe(99);
        expect(saved.boundaryRevision).toBe(0);
        expect(saved.layoutRevision).toBe(0);
        expect(saved.gpsExclusions).toBeNull();
        expect(saved.boundarySavedAt).toBeNull();
        expect((await upgraded.get('agri_crop_cycles').find(cycle.id))._raw).toEqual(cycle._raw);
        expect(await AgriBlockService.saveLayout({ ...input, parcelId: saved.id, blocks: [] }, upgraded)).toBe(1);
    });

    it('persists net geometry, stable blocks, frozen complete outbox and audit in ONE batch; reopens from adapter', async () => {
        const geometry = { ...parent, holes: [rectangle(0.003, 0.003, 0.0035, 0.0035).outer] };
        input.geometry = geometry;
        const batch = jest.spyOn(db, 'batch');
        expect(await AgriBlockService.saveLayout(input, db)).toBe(1);
        expect(batch).toHaveBeenCalledTimes(1);
        expect(parcel.layoutRevision).toBe(1);
        expect(parcel.boundaryRevision).toBe(1);
        expect(parcel.boundarySavedAt).toBeInstanceOf(Date);
        expect(parcel.areaHectares).toBeCloseTo(measureParcelGeometry(geometry).areaHectares, 10);
        expect(JSON.parse(parcel.gpsExclusions!)).toEqual(geometry.holes);
        const blocks = await AgriBlockService.listBlocks(parcel.id, db);
        expect(blocks.map(b => b.id)).toEqual([input.blocks[0].id]);
        const outbox = (await db.get('agri_pending_layout_operations').query().fetch())[0] as any;
        const payload = JSON.parse(outbox.payloadJson);
        expect(payload).toMatchObject({ operationId: input.operationId, parcelId: parcel.id, expectedRevision: 0,
            targetRevision: 1, performedBy: 'DUMMY: supervisor', geometry, netAreaHectares: parcel.areaHectares, archivedIds: [] });
        expect(payload.blocks[0]).toMatchObject({ id: blocks[0].id, geometry: block, areaHectares: blocks[0].areaHectares });
        expect(outbox.state).toBe('queued');
        const reopened = new Database({ adapter: await persistedClone(db), modelClasses });
        expect((await AgriBlockService.listBlocks(parcel.id, reopened))[0].id).toBe(blocks[0].id);
        expect((await reopened.get('agri_pending_layout_operations').find(outbox.id))._raw).toEqual(outbox._raw);
        db = reopened;
        const original = outbox.payloadJson;
        await AgriBlockService.saveLayout({ ...input, operationId: uuid.v4() as string, expectedRevision: 1,
            blocks: [] }, db);
        expect((await db.get<any>('agri_pending_layout_operations').find(outbox.id)).payloadJson).toBe(original);
        expect(await AgriBlockService.listBlocks(parcel.id, db)).toHaveLength(0);
        expect((await db.get<any>('agri_parcel_blocks').find(blocks[0].id)).geometryJson).toBe(blocks[0].geometryJson);
        expect((await db.get<any>('agri_parcel_blocks').find(blocks[0].id)).status).toBe('archived');
        const newest = (await db.get<any>('agri_pending_layout_operations').query().fetch())[1];
        expect(JSON.parse(newest.payloadJson).archivedIds).toEqual([blocks[0].id]);
    });

    it('replays the operation after later revisions without new writes and rejects UUID payload reuse', async () => {
        await AgriBlockService.saveLayout(input, db);
        await AgriBlockService.saveLayout({ ...input, expectedRevision: 1, operationId: uuid.v4() as string }, db);
        const batch = jest.spyOn(db, 'batch');
        expect(await AgriBlockService.saveLayout(input, db)).toBe(1);
        expect(batch).not.toHaveBeenCalled();
        await expect(AgriBlockService.saveLayout({ ...input, blocks: [] }, db)).rejects.toThrow(/UUID|payload|reused/i);
        expect(parcel.layoutRevision).toBe(2);
    });

    it('checks CAS inside the writer so only one competing save is accepted', async () => {
        const results = await Promise.allSettled([AgriBlockService.saveLayout(input, db),
            AgriBlockService.saveLayout({ ...input, operationId: uuid.v4() as string }, db)]);
        expect(results.map(r => r.status).sort()).toEqual(['fulfilled', 'rejected']);
        expect(parcel.layoutRevision).toBe(1);
        expect(await db.get('agri_pending_layout_operations').query().fetchCount()).toBe(1);
    });

    it.each(['empty', 'outside', 'overlap', 'duplicate', 'uuid', 'name', 'revision'])('rejects invalid layout %s without preparing mutations', async kind => {
        if (kind === 'empty') input.geometry = { outer: [], holes: [] };
        if (kind === 'outside') input.blocks[0].geometry = rectangle(1, 1, 1.001, 1.001);
        if (kind === 'overlap') input.blocks.push({ ...input.blocks[0], id: uuid.v4() as string });
        if (kind === 'duplicate') input.blocks.push({ ...input.blocks[0] });
        if (kind === 'uuid') input.operationId = 'DUMMY: invalid UUID';
        if (kind === 'name') input.blocks[0].name = ' ';
        if (kind === 'revision') input.expectedRevision = -1;
        const raw = { ...parcel._raw };
        const prepare = jest.spyOn(parcel, 'prepareUpdate');
        await expect(AgriBlockService.saveLayout(input, db)).rejects.toThrow();
        expect(prepare).not.toHaveBeenCalled();
        expect(parcel._raw).toEqual(raw);
        expect(await db.get('agri_pending_layout_operations').query().fetchCount()).toBe(0);
    });

    it('fails before preparing cached changes when audit is missing, and a subsequent save still works', async () => {
        const raw = { ...parcel._raw };
        const prepare = jest.spyOn(parcel, 'prepareUpdate');
        const audit = jest.spyOn(ActionLogService.prototype, 'prepareLogActionsSync').mockReturnValue([]);
        await expect(AgriBlockService.saveLayout(input, db)).rejects.toThrow(/audit/i);
        expect(prepare).not.toHaveBeenCalled();
        expect(parcel._raw).toEqual(raw);
        expect(await db.get('agri_parcel_blocks').query().fetchCount()).toBe(0);
        audit.mockRestore();
        expect(await AgriBlockService.saveLayout(input, db)).toBe(1);
    });

    it('guards explicit GPS clearing, parent orphaning and parcel deletion; metadata remains editable', async () => {
        await AgriBlockService.saveLayout(input, db);
        await AgriParcelService.updateParcel(parcel.id, { name: 'DUMMY: renamed' }, db);
        const raw = { ...parcel._raw };
        await expect(AgriParcelService.updateParcel(parcel.id, { gpsCoordinates: null }, db)).rejects.toThrow(/block/i);
        await expect(AgriBlockService.clearBoundary({ parcelId: parcel.id, expectedRevision: 1, operationId: uuid.v4() as string }, db)).rejects.toThrow(/block/i);
        await expect(AgriParcelService.updateParcel(parcel.id, { gpsCoordinates: [parent.outer[0]] }, db)).rejects.toThrow(/block/i);
        await expect(AgriParcelService.updateParcel(parcel.id, { gpsCoordinates: rectangle(1, 1, 1.002, 1.002).outer }, db)).rejects.toThrow(/block|orphan/i);
        await expect(AgriParcelService.deleteParcel(parcel.id, undefined, db)).rejects.toThrow(/block/i);
        expect(parcel._raw).toEqual(raw);
        await AgriBlockService.saveLayout({ ...input, expectedRevision: 1, blocks: [], operationId: uuid.v4() as string }, db);
        const area = parcel.areaHectares;
        await AgriParcelService.updateParcel(parcel.id, { gpsCoordinates: [] }, db);
        expect(parcel.areaHectares).toBe(area);
        expect(parcel.gpsCoordinates).toBeNull();
        expect(parcel.gpsExclusions).toBeNull();
    });

    it('publishes explicit clear and legacy point commands preserving historical area with CAS and replay', async () => {
        const clear = { parcelId: parcel.id, expectedRevision: 0, operationId: uuid.v4() as string };
        const batch = jest.spyOn(db, 'batch');
        expect(await AgriBlockService.clearBoundary(clear, db)).toBe(1);
        expect(batch).toHaveBeenCalledTimes(1);
        expect(parcel.areaHectares).toBe(99);
        expect(parcel.boundaryRevision).toBe(1);
        expect(parcel.gpsCoordinates).toBeNull();
        const point = { ...clear, expectedRevision: 1, operationId: uuid.v4() as string,
            geometry: { outer: [parent.outer[0]], holes: [] } };
        expect(await AgriBlockService.saveBoundary(point, db)).toBe(2);
        expect(parcel.areaHectares).toBe(99);
        expect(parcel.boundaryRevision).toBe(2);
        const payloads = (await db.get<any>('agri_pending_layout_operations').query().fetch()).map(r => JSON.parse(r.payloadJson));
        expect(payloads.map(p => p.kind)).toEqual(['clear', 'legacy_point']);
        expect(payloads[0].geometry).toEqual({ outer: [], holes: [] });
        expect(payloads[1].geometry).toEqual(point.geometry);
        expect(await AgriBlockService.clearBoundary(clear, db)).toBe(1);
        await expect(AgriBlockService.saveLayout(input, db)).rejects.toThrow(/revision conflict/i);
        expect(parcel.layoutRevision).toBe(2);
    });

    it('requires clear-first for corrupt storage, including exclusions and invalid stored topology', async () => {
        for (const corrupt of [
            { outer: 'DUMMY: corrupt', holes: null },
            { outer: JSON.stringify(parent.outer), holes: 'DUMMY: corrupt' },
            { outer: JSON.stringify(parent.outer.slice(0, 2)), holes: null },
            { outer: JSON.stringify([parent.outer[0], parent.outer[2], parent.outer[1], parent.outer[3]]), holes: null },
        ]) {
            await db.write(() => parcel.update(p => { p.gpsCoordinates = corrupt.outer; p.gpsExclusions = corrupt.holes; }));
            const command = { ...input, expectedRevision: parcel.layoutRevision, blocks: [], operationId: uuid.v4() as string };
            await expect(AgriBlockService.saveLayout(command, db)).rejects.toThrow(/corrupt|clear/i);
            await expect(AgriParcelService.updateParcel(parcel.id, { gpsCoordinates: [parent.outer[0]] }, db)).rejects.toThrow(/corrupt|clear/i);
            const revision = await AgriBlockService.clearBoundary({ parcelId: parcel.id,
                expectedRevision: parcel.layoutRevision, operationId: uuid.v4() as string }, db);
            expect(parcel.layoutRevision).toBe(revision);
            expect(parcel.gpsCoordinates).toBeNull();
            expect(parcel.gpsExclusions).toBeNull();
        }
    });

    it.each(['before', 'after'])('poisons failed %s-commit batches instead of unsafe rollback; same operation retries after reopening', async timing => {
        const raw = { ...parcel._raw };
        const count = await db.get('action_logs').query().fetchCount();
        const commit = db.adapter.batch.bind(db.adapter);
        const adapter = jest.spyOn(db.adapter, 'batch').mockImplementationOnce(async operations => {
            if (timing === 'after') await commit(operations);
            throw new Error('DUMMY: adapter I/O rejection');
        });
        await expect(AgriBlockService.saveLayout(input, db)).rejects.toThrow(/reopen/i);
        // Watermelon has no supported restoration API: this cached object is explicitly unusable.
        expect(parcel._raw).not.toEqual(raw);
        expect((parcel as any)._preparedState).toBeNull();
        await expect(AgriBlockService.saveLayout(input, db)).rejects.toThrow(/reopen/i);
        await expect(AgriBlockService.listBlocks(parcel.id, db)).rejects.toThrow(/reopen/i);
        await expect(AgriParcelService.updateParcel(parcel.id, { name: 'DUMMY: unsafe cached edit' }, db)).rejects.toThrow(/reopen/i);
        expect(adapter).toHaveBeenCalledTimes(1);
        adapter.mockRestore();
        const reopened = new Database({ adapter: await persistedClone(db), modelClasses });
        const saved = await reopened.get<AgriParcel>('agri_parcels').find(parcel.id);
        expect(saved.layoutRevision).toBe(timing === 'before' ? 0 : 1);
        if (timing === 'before') expect(saved._raw).toEqual(raw);
        expect(await reopened.get('agri_pending_layout_operations').query().fetchCount()).toBe(timing === 'before' ? 0 : 1);
        expect(await reopened.get('action_logs').query().fetchCount()).toBe(timing === 'before' ? count : count + 3);
        expect(await AgriBlockService.saveLayout(input, reopened)).toBe(1);
        expect(await reopened.get('agri_pending_layout_operations').query().fetchCount()).toBe(1);
        expect(await reopened.get('action_logs').query().fetchCount()).toBe(count + 3);
    });

    it('quarantines rejected archival preparations and reopens both parcel and block caches before the same-ID retry', async () => {
        await AgriBlockService.saveLayout(input, db);
        const [retained] = await AgriBlockService.listBlocks(parcel.id, db);
        const parcelRaw = { ...parcel._raw };
        const blockRaw = { ...retained._raw };
        const audits = await db.get('action_logs').query().fetchCount();
        const command = { ...input, expectedRevision: 1, blocks: [], operationId: uuid.v4() as string };
        const adapter = jest.spyOn(db.adapter, 'batch').mockRejectedValueOnce(new Error('DUMMY: precommit archival rejection'));
        await expect(AgriBlockService.saveLayout(command, db)).rejects.toThrow(/reopen/i);
        expect(retained.status).toBe('archived'); // explicitly unusable, not a persisted/accepted result
        expect((retained as any)._preparedState).toBeNull();
        await expect(AgriBlockService.listBlocks(parcel.id, db)).rejects.toThrow(/reopen/i);
        adapter.mockRestore();
        const reopened = new Database({ adapter: await persistedClone(db), modelClasses });
        expect((await reopened.get('agri_parcels').find(parcel.id))._raw).toEqual(parcelRaw);
        expect((await reopened.get('agri_parcel_blocks').find(retained.id))._raw).toEqual(blockRaw);
        expect(await reopened.get('action_logs').query().fetchCount()).toBe(audits);
        expect(await reopened.get('agri_pending_layout_operations').query().fetchCount()).toBe(1);
        expect(await AgriBlockService.saveLayout(command, reopened)).toBe(2);
        expect(await AgriBlockService.saveLayout(command, reopened)).toBe(2);
        expect(await AgriBlockService.listBlocks(parcel.id, reopened)).toHaveLength(0);
        expect(await reopened.get('agri_pending_layout_operations').query().fetchCount()).toBe(2);
    });

    it('cannot shrink a parent around retained blocks even while archiving them', async () => {
        await AgriBlockService.saveLayout(input, db);
        await expect(AgriBlockService.saveLayout({ ...input, expectedRevision: 1,
            geometry: rectangle(1, 1, 1.002, 1.002), blocks: [], operationId: uuid.v4() as string }, db)).rejects.toThrow(/orphan|retained|block/i);
        expect(parcel.layoutRevision).toBe(1);
    });

    it('rejects deleted/inactive parents and blocks belonging to another parcel', async () => {
        await db.write(() => parcel.update(p => { p.status = 'inactive'; }));
        await expect(AgriBlockService.saveLayout(input, db)).rejects.toThrow(/parcel/i);
        await db.write(() => parcel.update(p => { p.status = 'available'; }));
        await AgriBlockService.saveLayout(input, db);
        const other = await AgriParcelService.createParcel({ name: 'DUMMY: other', landOwnerId: 'DUMMY: owner', areaHectares: 1 }, db);
        await expect(AgriBlockService.saveLayout({ ...input, parcelId: other.id, operationId: uuid.v4() as string }, db)).rejects.toThrow(/belong|parcel/i);
        await db.write(() => other.update(p => { p.deletedAt = new Date(); }));
        await expect(AgriBlockService.saveLayout({ ...input, parcelId: other.id, blocks: [], operationId: uuid.v4() as string }, db)).rejects.toThrow(/parcel/i);
    });
});
