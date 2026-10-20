import type { Database, Model } from '@nozbe/watermelondb';
import type LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

const layoutTables = [
    'agri_parcel_blocks', 'agri_block_assignments',
    'agri_block_progress', 'agri_pending_layout_operations',
];
const addedParcelColumns = [
    'gps_exclusions', 'boundary_revision', 'layout_revision', 'boundary_saved_at',
];

// DUMMY: every identifier, timestamp, coordinate and amount below is a local fixture.
const timestamp = 1700000000000;
const geometry = JSON.stringify([[1, 1], [1, 2], [2, 2], [1, 1]]);
const legacyFixtures = [
    { table: 'agri_parcels', raw: {
        id: 'DUMMY:parcel', name: 'DUMMY:offline parcel', code: 'DUMMY:P48',
        land_owner_id: 'DUMMY:owner', area_hectares: 2.5, gps_coordinates: geometry,
        location_address: 'DUMMY:local fixture', soil_type: 'DUMMY:soil', status: 'planted',
        _status: 'updated', _changed: 'gps_coordinates,name', deleted_at: null,
    } },
    { table: 'agri_farm_workers', raw: {
        id: 'DUMMY:worker', name: 'DUMMY:offline worker', daily_rate: 600,
        specialization: 'DUMMY:planting', status: 'active', _status: 'created', _changed: '',
    } },
    { table: 'agri_crop_cycles', raw: {
        id: 'DUMMY:cycle', cycle_code: 'DUMMY:C48', parcel_id: 'DUMMY:parcel',
        crop_type: 'DUMMY:crop', planting_date: timestamp, area_planted_ha: 2.5,
        expected_yield_kg: 100, capital_allocated: 1000, status: 'growing',
        _status: 'synced', _changed: '',
    } },
    { table: 'agri_labor_logs', raw: {
        id: 'DUMMY:labor', worker_id: 'DUMMY:worker', crop_cycle_id: 'DUMMY:cycle',
        work_date: timestamp, task: 'DUMMY:planting', rate_type: 'daily',
        units_completed: 2, rate_per_unit: 600, total_pay: 1200, payment_status: 'pending',
        _status: 'created', _changed: '',
    } },
    { table: 'expenses', raw: {
        id: 'DUMMY:expense', category: 'DUMMY:farm input', description: 'DUMMY:offline expense',
        amount: 1200, expense_date: timestamp, payment_status: 'unpaid', status: 'draft',
        _status: 'updated', _changed: 'amount',
    } },
    { table: 'agri_parcels', raw: {
        id: 'DUMMY:deleted-parcel', name: 'DUMMY:retired parcel', land_owner_id: 'DUMMY:owner',
        area_hectares: 1, status: 'fallow', deleted_at: timestamp,
        _status: 'deleted', _changed: '',
    } },
];

describe('actual web database persistent identity across the v48 -> v50 upgrade', () => {
    let storage: any;
    let adapters: LokiJSAdapter[];
    let legacyRaws: { table: string; raw: Record<string, any> }[];
    let legacy: Database;

    const underlying = (db: Database): LokiJSAdapter => db.adapter.underlyingAdapter as LokiJSAdapter;

    async function saveAndClose(adapter: LokiJSAdapter) {
        // Explicit flush: index.web disables autosave in Jest. No database is deleted or renamed.
        const loki = (adapter as any)._driver.loki;
        await new Promise<void>((resolve, reject) => {
            loki.saveDatabase((error: Error | undefined) => error ? reject(error) : resolve());
        });
        loki.close();
    }

    function loadActualWebDatabase(): { database: Database; WEB_DATABASE_NAME: string } {
        // Only share the installed memory persistence backing store. The app module,
        // WatermelonDB, LokiJS adapter, models and migrations are all real.
        const web = require('../index.web');
        adapters.push(underlying(web.database));
        return web;
    }

    beforeEach(async () => {
        jest.resetModules();
        adapters = [];
        const Loki = require('lokijs');
        storage = new Loki.LokiMemoryAdapter();
        jest.spyOn(Loki, 'LokiMemoryAdapter').mockImplementation(() => storage);
        const { Database, Model, appSchema, tableSchema } = require('@nozbe/watermelondb');
        const Adapter = require('@nozbe/watermelondb/adapters/lokijs').default;
        const { mySchema } = require('../schema');

        // Reconstruct the immediately preceding schema by excluding only Task2's
        // four new tables and four parcel columns; keep every other v48 table.
        expect(mySchema.version).toBe(50);
        const tables = Object.values(mySchema.tables)
            .filter((table: any) => !layoutTables.includes(table.name))
            .map((table: any) => tableSchema({
                name: table.name,
                columns: table.columnArray.filter((column: any) =>
                    table.name !== 'agri_parcels' || !addedParcelColumns.includes(column.name)),
            }));
        const schema48 = appSchema({ version: 48, tables });
        const modelClasses = tables.map((table: any) => class LegacyModel extends Model {
            static table = table.name;
        });
        const adapter = new Adapter({
            dbName: 'poscursor-v48', schema: schema48,
            useWebWorker: false, useIncrementalIndexedDB: false,
            _testLokiAdapter: storage, extraLokiOptions: { autosave: false },
        });
        adapters.push(adapter);
        legacy = new Database({ adapter, modelClasses });
        await legacy.write(async () => {
            const records = legacyFixtures.map(({ table, raw }) => legacy.get(table)
                .prepareCreateFromDirtyRaw({ created_at: timestamp, updated_at: timestamp, ...raw }));
            await legacy.batch(records);
            legacyRaws = records.map((record: Model) => ({
                table: (record.constructor as typeof Model).table, raw: { ...record._raw },
            }));
        });
        await legacy.localStorage.set('DUMMY:sync-checkpoint', { lastPulledAt: timestamp });
        await saveAndClose(adapter);
        expect(Object.keys(storage.hashStore)).toEqual(['poscursor-v48']);
        expect(await legacy.adapter.getLocal('_loki_schema_version')).toBe('48');
        expect(legacyRaws[0].raw).not.toHaveProperty('boundary_revision');
        for (const table of layoutTables) expect(schema48.tables).not.toHaveProperty(table);
    });

    afterEach(() => {
        for (const adapter of adapters) (adapter as any)._driver?.loki?.close();
        jest.restoreAllMocks();
    });

    it('configures the actual exported web database with the v48 storage name, not schema.version', async () => {
        const web = loadActualWebDatabase();
        // Await setup before assertions/cleanup, including on the RED run.
        await web.database.get('agri_parcels').query().fetch();
        const adapter = underlying(web.database);
        expect(adapter.dbName).toBe('poscursor-v48');
        expect(web.WEB_DATABASE_NAME).toBe('poscursor-v48');
        expect((adapter as any)._options.dbName).toBe(web.WEB_DATABASE_NAME);
        expect(adapter.schema).toBe(require('../schema').mySchema);
        expect(adapter.migrations).toBe(require('../migrations').myMigrations);
        expect(adapter.schema.version).toBe(50);
    });

    it('reopens v48 offline history in place with the v50 agribusiness defaults and unchanged sync metadata', async () => {
        const { database } = loadActualWebDatabase();
        const parcels = await database.get('agri_parcels').query().fetch();
        expect(parcels.map(record => record.id)).toEqual(['DUMMY:parcel']);
        for (const { table, raw } of legacyRaws.filter(row => row.raw._status !== 'deleted')) {
            expect((await database.get(table).find(raw.id))._raw).toMatchObject(raw);
        }
        const parcel: any = await database.get('agri_parcels').find('DUMMY:parcel');
        expect(parcel._raw).toMatchObject({
            gps_exclusions: null, boundary_revision: 0, layout_revision: 0, boundary_saved_at: null,
        });
        expect([parcel.gpsExclusions, parcel.boundaryRevision, parcel.layoutRevision, parcel.boundarySavedAt])
            .toEqual([null, 0, 0, null]);
        expect(await database.adapter.getDeletedRecords('agri_parcels')).toEqual(['DUMMY:deleted-parcel']);
        const tombstone = (underlying(database) as any)._driver.loki
            .getCollection('agri_parcels').by('id', 'DUMMY:deleted-parcel');
        expect(tombstone).toMatchObject({
            ...legacyRaws.find(row => row.raw.id === 'DUMMY:deleted-parcel')!.raw,
            gps_exclusions: null, boundary_revision: 0, layout_revision: 0, boundary_saved_at: null,
        });
        expect(await database.localStorage.get('DUMMY:sync-checkpoint')).toEqual({ lastPulledAt: timestamp });
        expect(await database.adapter.getLocal('_loki_schema_version')).toBe('50');
        for (const table of layoutTables) expect(await database.get(table).query().fetch()).toEqual([]);
        await saveAndClose(underlying(database));
        expect(Object.keys(storage.hashStore)).toEqual(['poscursor-v48']);
    });

    it('persists migrated parcel fields and the four new block/outbox models on another reopen', async () => {
        const { database } = loadActualWebDatabase();
        const parcels = await database.get('agri_parcels').query().fetch();
        // Dynamic naming must fail here, not silently create a fresh v49 database.
        expect(parcels.map(record => record.id)).toEqual(['DUMMY:parcel']);
        const parcel: any = parcels[0];
        const payload = JSON.stringify({ operationId: 'DUMMY:operation', geometry });
        const newRaws = [
            { table: 'agri_parcel_blocks', raw: {
                id: 'DUMMY:block', parcel_id: 'DUMMY:parcel', name: 'DUMMY:block name',
                geometry_json: geometry, area_hectares: 1, status: 'active',
                boundary_revision: 1, layout_revision: 1,
            } },
            { table: 'agri_block_assignments', raw: {
                id: 'DUMMY:assignment', block_id: 'DUMMY:block', worker_id: 'DUMMY:worker',
                crop_cycle_id: 'DUMMY:cycle', task: 'DUMMY:planting', start_date: timestamp,
                status: 'assigned', progress_percent: 0, created_by: 'DUMMY:admin',
                assigned_geometry_snapshot: geometry, assigned_boundary_revision: 1,
                submission_id: 'DUMMY:assignment-submission', request_json: payload,
            } },
            { table: 'agri_block_progress', raw: {
                id: 'DUMMY:progress', assignment_id: 'DUMMY:assignment', update_date: timestamp,
                progress_percent: 25, status: 'in_progress', recorded_by: 'DUMMY:worker',
                submission_id: 'DUMMY:progress-submission', request_json: payload,
            } },
            { table: 'agri_pending_layout_operations', raw: {
                id: 'DUMMY:outbox', operation_id: 'DUMMY:operation', parcel_id: 'DUMMY:parcel',
                expected_revision: 0, payload_json: payload, created_by: 'DUMMY:admin', state: 'queued',
            } },
        ];
        // WatermelonDB intentionally touches updated_at on prepareUpdate.
        jest.spyOn(Date, 'now').mockReturnValue(timestamp + 1000);
        await database.write(async () => {
            const records = newRaws.map(({ table, raw }) => database.get(table)
                .prepareCreateFromDirtyRaw({
                    _status: 'created', _changed: '', created_at: timestamp, updated_at: timestamp, ...raw,
                }));
            await database.batch(parcel.prepareUpdate((record: any) => {
                record.gpsExclusions = '[]';
                record.boundaryRevision = 1;
                record.layoutRevision = 1;
                record.boundarySavedAt = new Date(timestamp);
            }), ...records);
        });
        await saveAndClose(underlying(database));
        const reopenedAdapter = await underlying(database).testClone();
        adapters.push(reopenedAdapter);
        const { Database } = require('@nozbe/watermelondb');
        const modelClasses = Object.values(database.collections.map).map((collection: any) => collection.modelClass);
        const reopened: Database = new Database({ adapter: reopenedAdapter, modelClasses });
        const reopenedParcel: any = await reopened.get('agri_parcels').find('DUMMY:parcel');
        expect(reopenedParcel._raw).toMatchObject({
            ...legacyRaws[0].raw, _changed: expect.any(String), updated_at: timestamp + 1000,
            gps_exclusions: '[]', boundary_revision: 1, layout_revision: 1, boundary_saved_at: timestamp,
        });
        for (const { table, raw } of newRaws) {
            const rows = await reopened.get(table).query().fetch();
            expect(rows).toHaveLength(1);
            expect(rows[0]._raw).toMatchObject({ ...raw, _status: 'created' });
        }
        for (const { table, raw } of legacyRaws.filter(row =>
            row.table !== 'agri_parcels' && row.raw._status !== 'deleted')) {
            expect((await reopened.get(table).find(raw.id))._raw).toMatchObject(raw);
        }
        const outbox: any = await reopened.get('agri_pending_layout_operations').find('DUMMY:outbox');
        expect([outbox.operationId, outbox.payloadJson, outbox.state])
            .toEqual(['DUMMY:operation', payload, 'queued']);
        expect(await reopened.adapter.getLocal('_loki_schema_version')).toBe('50');
        expect(Object.keys(storage.hashStore)).toEqual(['poscursor-v48']);
    });
});
