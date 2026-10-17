import { Database, Q } from '@nozbe/watermelondb';
import { synchronize } from '@nozbe/watermelondb/sync';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import ActionLog from '../../database/models/ActionLog';
import AgriCropCycle from '../../database/models/AgriCropCycle';
import AgriHarvestLog from '../../database/models/AgriHarvestLog';
import AgriWeeklySettlement from '../../database/models/AgriWeeklySettlement';
import { AgriParcelService } from '../AgriParcelService';
import { AgriCropCycleService } from '../AgriCropCycleService';
import AgriParcel from '../../database/models/AgriParcel';
import { ActionLogService } from '../ActionLogService';
import { assertAgriDatabaseUsable, runAuditedAgriBatch, withAgriDatabaseOperation } from '../AgriWriteSafety';
import { modelClasses } from '../../__tests__/test-utils';

jest.mock('../../database', () => ({ database: {} }));
jest.mock('../AuthService', () => ({ AuthService: { getCurrentUserId: jest.fn().mockResolvedValue('DUMMY: registry operator') } }));

/**
 * Edit/Delete + audit-trail guarantees for the Land Parcels Registry and
 * Cassava Crop Cycles registries (client request 2026-10-16):
 * every mutation must be registered in action_logs and destructive actions
 * must be blocked while linked financial data exists.
 */
describe('Agribusiness registries: edit, delete and audit trail', () => {
    let database: Database;

    beforeEach(async () => {
        database = createTestDatabase();
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    async function fetchLogs(entityType: string) {
        const logs = await database.get<ActionLog>('action_logs').query(
            Q.where('entity_type', entityType)
        ).fetch();
        return logs as unknown as any[];
    }

    async function seedParcel(name = 'Parcel Alpha') {
        return AgriParcelService.createParcel(
            { name, landOwnerId: 'owner-1', areaHectares: 2.5 },
            database
        );
    }

    async function seedCycle(parcelId: string, status?: string) {
        const cycle = await AgriCropCycleService.createCropCycle({
            parcelId,
            plantingDate: new Date('2026-01-10'),
            areaPlantedHa: 1.5,
        }, database);
        if (status) {
            await database.write(async () => {
                await cycle.update(c => { c.status = status; });
            });
        }
        return cycle;
    }

    async function seedHarvestLog(cropCycleId: string, parcelId: string) {
        await database.write(async () => {
            await database.get<AgriHarvestLog>('agri_harvest_logs').create(r => {
                r.cropCycleId = cropCycleId;
                r.parcelId = parcelId;
                r.harvestDate = new Date('2026-09-01');
                r.batchNumber = 'HVL-001';
                r.grossWeightKg = 1200;
                r.tareWeightKg = 200;
                r.netWeightKg = 1000;
            });
        });
    }

    async function seedSettlement(cropCycleId: string) {
        await database.write(async () => {
            await database.get<AgriWeeklySettlement>('agri_weekly_settlements').create(r => {
                r.cropCycleId = cropCycleId;
                r.landOwnerId = 'owner-1';
                r.weekNumber = 1;
                r.weekStartDate = new Date('2026-09-01');
                r.weekEndDate = new Date('2026-09-07');
                r.cumulativeKilos = 1000;
                r.ratePerKilo = 1;
                r.rawKiloEarnings = 1000;
                r.guaranteedMinimum = 25000;
                r.targetCumulativePayout = 25000;
                r.previousCumulativePayout = 0;
                r.netPayoutDueThisWeek = 25000;
                r.paymentStatus = 'draft';
            });
        });
    }

    describe('audit trail', () => {
        it('logs a CREATE action when a parcel is registered', async () => {
            const parcel = await seedParcel();

            const logs = await fetchLogs('agri_parcels');
            expect(logs).toHaveLength(1);
            expect(logs[0].action).toBe('CREATE');
            expect(logs[0].entityId).toBe(parcel.id);
        });

        it('logs CREATE, UPDATE and DELETE actions across a parcel lifecycle', async () => {
            const parcel = await seedParcel();
            await AgriParcelService.updateParcel(parcel.id, { areaHectares: 3.1 }, database);
            await AgriParcelService.deleteParcel(parcel.id, undefined, database);

            const logs = await fetchLogs('agri_parcels');
            expect(logs.map(l => l.action).sort()).toEqual(['CREATE', 'DELETE', 'UPDATE']);
        });

        it('stores before and after snapshots on the parcel UPDATE log', async () => {
            const parcel = await seedParcel('Old Name');
            await AgriParcelService.updateParcel(parcel.id, { name: 'New Name' }, database);

            const logs = await fetchLogs('agri_parcels');
            const updateLog = logs.find(l => l.action === 'UPDATE');
            expect(JSON.parse(updateLog.oldData).name).toBe('Old Name');
            expect(JSON.parse(updateLog.newData).name).toBe('New Name');
        });

        it('records the operator on the log when performedBy is provided', async () => {
            const parcel = await seedParcel();
            await AgriParcelService.deleteParcel(parcel.id, 'admin-user', database);

            const logs = await fetchLogs('agri_parcels');
            const deleteLog = logs.find(l => l.action === 'DELETE');
            expect(deleteLog.performedBy).toBe('admin-user');
        });

        it('logs CREATE, UPDATE and DELETE actions across a crop cycle lifecycle', async () => {
            const parcel = await seedParcel();
            const cycle = await seedCycle(parcel.id);
            await AgriCropCycleService.updateCropCycle(cycle.id, { variety: 'Blue Bayong' }, database);
            await AgriCropCycleService.deleteCropCycle(cycle.id, undefined, database);

            const logs = await fetchLogs('agri_crop_cycles');
            expect(logs.map(l => l.action).sort()).toEqual(['CREATE', 'DELETE', 'UPDATE']);
        });
    });

    describe('verified parcel persistence review', () => {
        const actions = ['CREATE', 'UPDATE', 'DELETE'] as const;
        type Action = typeof actions[number];
        const operator = 'DUMMY: persistence reviewer';
        const input = { name: 'DUMMY: registry parcel', code: 'DUMMY: parcel code', landOwnerId: 'DUMMY: owner', areaHectares: 2.5 };
        const geometry = [{ latitude: 0, longitude: 0 }, { latitude: 0.001, longitude: 0 },
            { latitude: 0.001, longitude: 0.001 }, { latitude: 0, longitude: 0.001 }];
        const outcome = <T,>(promise: Promise<T>) => promise.then(value => ({ value, error: null }), error => ({ value: null, error }));
        const barrier = () => {
            let resolve!: () => void;
            return { promise: new Promise<void>(done => { resolve = done; }), resolve: () => resolve() };
        };
        const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
        async function fixture(action: Action, mapped = false) {
            const command = { ...input, ...(mapped ? { gpsCoordinates: geometry } : {}) };
            const parcel = action === 'CREATE' ? null : await AgriParcelService.createParcel(command, database, operator);
            const submit = (db = database) => action === 'CREATE' ? AgriParcelService.createParcel(command, db, operator)
                : action === 'UPDATE' ? AgriParcelService.updateParcel(parcel!.id, { name: 'DUMMY: renamed', areaHectares: 3.1 }, db, operator)
                    : AgriParcelService.deleteParcel(parcel!.id, operator, db);
            return { parcel, submit };
        }
        afterEach(() => jest.restoreAllMocks());

        it.each(actions)('%s commits mutation and audit in exactly one real Loki batch', async action => {
            const { parcel, submit } = await fixture(action);
            const oldData = parcel ? { ...parcel._raw } : null;
            const batch = jest.spyOn(database, 'batch');
            const adapter = jest.spyOn(database.adapter, 'batch');
            const result = await submit();
            expect(batch).toHaveBeenCalledTimes(1);
            expect(adapter).toHaveBeenCalledTimes(1);
            expect(batch.mock.calls[0].map((row: any) => row.table)).toEqual(['agri_parcels', 'action_logs']);
            const logs = (await fetchLogs('agri_parcels')).filter(log => log.action === action);
            expect(logs).toHaveLength(1);
            expect(logs[0].entityId).toBe(result.id);
            expect(logs[0].performedBy).toBe(operator);
            if (action !== 'CREATE') expect(JSON.parse(logs[0].oldData)).toEqual(oldData);
            if (action !== 'DELETE') expect(JSON.parse(logs[0].newData)).toMatchObject({
                id: result.id, name: result.name, area_hectares: result.areaHectares,
                updated_at: result.updatedAt.getTime(), created_at: result.createdAt.getTime(),
            });
            else {
                expect(JSON.parse(logs[0].oldData).deleted_at).toBeNull();
                expect(result.deletedAt).not.toBeNull();
            }
        });

        it('DELETE oldData is the true pre-delete snapshot, including its previous update timestamp', async () => {
            const { parcel, submit } = await fixture('DELETE');
            const raw = { ...parcel!._raw };
            await submit();
            const log = (await fetchLogs('agri_parcels')).find(row => row.action === 'DELETE');
            expect(JSON.parse(log.oldData)).toEqual(raw);
        });

        it.each(actions.flatMap(action => [false, true].flatMap(mapped =>
            ['throw', 'missing', 'null', 'wrong-table'].map(failure => ({ action, mapped, failure })))))(
            '$action mapped=$mapped audit $failure fails before mutation preparation, without quarantine', async ({ action, mapped, failure }) => {
                const { parcel, submit } = await fixture(action, mapped);
                const oldData = parcel ? { ...parcel._raw } : null;
                const count = await database.get('action_logs').query().fetchCount();
                const prepare = parcel ? jest.spyOn(parcel, 'prepareUpdate') : jest.spyOn(database.get('agri_parcels'), 'prepareCreate');
                const batch = jest.spyOn(database, 'batch');
                const audit = jest.spyOn(ActionLogService.prototype, 'prepareLogActionsSync').mockImplementation(() => {
                    if (failure === 'throw') throw new Error('DUMMY: audit preparation unavailable');
                    return failure === 'missing' ? [] : failure === 'null' ? null as any : [{ table: 'agri_parcels' }];
                });
                await expect(submit()).rejects.toThrow(/audit/i);
                expect(prepare).not.toHaveBeenCalled();
                expect(batch).not.toHaveBeenCalled();
                if (parcel) expect(parcel._raw).toEqual(oldData);
                expect(await database.get('agri_parcels').query().fetchCount()).toBe(parcel ? 1 : 0);
                expect(await database.get('action_logs').query().fetchCount()).toBe(count);
                expect(() => assertAgriDatabaseUsable(database)).not.toThrow();
                audit.mockRestore();
                await expect(submit()).resolves.toBeDefined();
            });

        it.each(actions.flatMap(action => [false, true].map(committed => ({ action, committed })) ))(
            '$action uncertain batch committed=$committed quarantines; only reopened persisted storage is usable', async ({ action, committed }) => {
                const { parcel, submit } = await fixture(action);
                const oldData = parcel ? { ...parcel._raw } : null;
                const count = await database.get('action_logs').query().fetchCount();
                const originalBatch = database.adapter.batch.bind(database.adapter);
                const adapter = jest.spyOn(database.adapter, 'batch').mockImplementationOnce(async operations => {
                    if (committed) await originalBatch(operations);
                    throw new Error('DUMMY: uncertain adapter batch outcome');
                });
                const failed = await outcome(submit());
                expect(failed.error).toMatchObject({ code: 'AGRI_DATABASE_REOPEN_REQUIRED' });
                expect((await outcome(submit())).error).toBe(failed.error);
                expect((await outcome(AgriParcelService.listParcels(undefined, database))).error).toBe(failed.error);
                expect((await outcome(withAgriDatabaseOperation(database, async () => 42))).error).toBe(failed.error);
                expect(adapter).toHaveBeenCalledTimes(1);
                adapter.mockRestore();
                const underlying = database.adapter.underlyingAdapter as any;
                await new Promise<void>((resolve, reject) => underlying._driver.loki.saveDatabase((error: Error) => error ? reject(error) : resolve()));
                const reopened = new Database({ adapter: await underlying.testClone(), modelClasses });
                try {
                    expect(await reopened.get('action_logs').query().fetchCount()).toBe(count + (committed ? 1 : 0));
                    expect(await reopened.get('agri_parcels').query().fetchCount()).toBe(parcel || committed ? 1 : 0);
                    if (parcel) {
                        const stored = await reopened.get<AgriParcel>('agri_parcels').find(parcel.id);
                        if (!committed) expect(stored._raw).toEqual(oldData);
                        else if (action === 'UPDATE') expect(stored.name).toBe('DUMMY: renamed');
                        else expect(stored.deletedAt).not.toBeNull();
                    }
                    if (!committed) await expect(submit(reopened)).resolves.toBeDefined();
                    expect(() => assertAgriDatabaseUsable(reopened)).not.toThrow();
                } finally { await closeTestDatabase(reopened); }
            });

        it.each(actions.flatMap(action => [false, true].map(quarantine => ({ action, quarantine })) ))(
            '$action waits outside db.write for FIFO holder; rejection quarantine=$quarantine propagates correctly', async ({ action, quarantine }) => {
                const { parcel, submit } = await fixture(action);
                const raw = parcel ? { ...parcel._raw } : null;
                const entered = barrier(); const release = barrier();
                const ordinary = new Error('DUMMY: ordinary operation failure');
                const holding = outcome(withAgriDatabaseOperation(database, async () => {
                    entered.resolve(); await release.promise;
                    if (quarantine) {
                        jest.spyOn(database, 'batch').mockRejectedValueOnce(new Error('DUMMY: uncertain holder'));
                        return database.write(() => runAuditedAgriBatch(database, () => []));
                    }
                    throw ordinary;
                }));
                await entered.promise;
                const write = jest.spyOn(database, 'write');
                const waiting = outcome(submit());
                try {
                    await flush();
                    expect(write).not.toHaveBeenCalled();
                    if (parcel) expect(parcel._raw).toEqual(raw);
                } finally { release.resolve(); await Promise.all([holding, waiting]); }
                const failure = (await holding).error;
                if (quarantine) {
                    expect(failure).toMatchObject({ code: 'AGRI_DATABASE_REOPEN_REQUIRED' });
                    expect((await waiting).error).toBe(failure);
                    expect(write).toHaveBeenCalledTimes(1); // holder only, never the quarantined waiter
                } else {
                    expect(failure).toBe(ordinary);
                    expect((await waiting).error).toBeNull();
                    expect(write).toHaveBeenCalledTimes(1);
                }
            });

        it.each(['UPDATE', 'DELETE'].flatMap(action => ['remote-delete', 'soft-delete'].map(removal => ({ action, removal }))))(
            '$action rejects a preceding $removal normally without quarantining the Database', async ({ action, removal }) => {
                const { parcel, submit } = await fixture(action as Action);
                const logCount = await database.get('action_logs').query().fetchCount();
                const entered = barrier(); const release = barrier();
                const holding = outcome(withAgriDatabaseOperation(database, async () => {
                    entered.resolve(); await release.promise;
                    if (removal === 'remote-delete') {
                        await synchronize({ database, pullChanges: async () => ({
                            changes: { agri_parcels: { created: [], updated: [], deleted: [parcel!.id] } },
                            timestamp: 1,
                        }), pushChanges: async () => ({}) });
                    } else {
                        await database.write(() => parcel!.update(record => { record.deletedAt = new Date(1); }));
                    }
                }));
                await entered.promise;
                const waiting = outcome(submit());
                try { await flush(); expect(parcel!.deletedAt).toBeNull(); }
                finally { release.resolve(); await Promise.all([holding, waiting]); }
                expect((await holding).error).toBeNull();
                const failure = (await waiting).error;
                expect(failure).toBeInstanceOf(Error);
                expect(failure.code).not.toBe('AGRI_DATABASE_REOPEN_REQUIRED');
                expect(() => assertAgriDatabaseUsable(database)).not.toThrow();
                expect(await database.get('action_logs').query().fetchCount()).toBe(logCount);
                if (removal === 'remote-delete') await expect(database.get('agri_parcels').find(parcel!.id)).rejects.toThrow();
                else expect(parcel!.deletedAt!.getTime()).toBe(1);
                await expect(AgriParcelService.createParcel({ ...input, name: 'DUMMY: after deletion' }, database, operator))
                    .resolves.toBeDefined();
            });

        it('FIFO metadata snapshots reflect the preceding accepted update, not an earlier cached snapshot', async () => {
            const parcel = await AgriParcelService.createParcel(input, database, operator);
            const entered = barrier(); const release = barrier();
            const holding = withAgriDatabaseOperation(database, async () => { entered.resolve(); await release.promise; });
            await entered.promise;
            const first = outcome(AgriParcelService.updateParcel(parcel.id, { name: 'DUMMY: first' }, database, operator));
            const second = outcome(AgriParcelService.updateParcel(parcel.id, { name: 'DUMMY: second' }, database, operator));
            try { await flush(); expect(parcel.name).toBe(input.name); }
            finally { release.resolve(); await Promise.all([holding, first, second]); }
            expect((await first).error).toBeNull(); expect((await second).error).toBeNull();
            const logs = (await fetchLogs('agri_parcels')).filter(log => log.action === 'UPDATE');
            expect(logs).toHaveLength(2);
            const firstLog = logs.find(log => JSON.parse(log.newData).name === 'DUMMY: first');
            const secondLog = logs.find(log => JSON.parse(log.newData).name === 'DUMMY: second');
            expect(JSON.parse(firstLog.oldData).name).toBe(input.name);
            expect(JSON.parse(secondLog.oldData).name).toBe('DUMMY: first');
            expect(parcel.name).toBe('DUMMY: second');
        });
    });

    describe('parcel update', () => {
        it('edits parcel registration fields', async () => {
            const parcel = await seedParcel();
            const updated = await AgriParcelService.updateParcel(parcel.id, {
                name: 'Parcel Beta',
                areaHectares: 4.2,
                soilType: 'Clay Loam',
                locationAddress: 'Brgy. Poblacion',
                status: 'fallow',
            }, database);

            expect(updated.name).toBe('Parcel Beta');
            expect(updated.areaHectares).toBe(4.2);
            expect(updated.soilType).toBe('Clay Loam');
            expect(updated.locationAddress).toBe('Brgy. Poblacion');
            expect(updated.status).toBe('fallow');
        });
    });

    describe('parcel delete', () => {
        it('soft-deletes a parcel with no crop cycles', async () => {
            const parcel = await seedParcel();
            await AgriParcelService.deleteParcel(parcel.id, undefined, database);

            const stored = await database.get('agri_parcels').find(parcel.id) as any;
            expect(stored.deletedAt).not.toBeNull();
        });

        it('hides deleted parcels from the registry list', async () => {
            const kept = await seedParcel('Keep Me');
            const removed = await seedParcel('Delete Me');
            await AgriParcelService.deleteParcel(removed.id, undefined, database);

            const list = await AgriParcelService.listParcels(undefined, database);
            expect(list.map(e => e.parcel.id)).toEqual([kept.id]);
        });

        it('blocks deleting a parcel that still has an active cycle', async () => {
            const parcel = await seedParcel();
            await seedCycle(parcel.id);

            await expect(AgriParcelService.deleteParcel(parcel.id, undefined, database))
                .rejects.toThrow(/active crop cycle/i);

            const stored = await database.get('agri_parcels').find(parcel.id) as any;
            expect(stored.deletedAt).toBeNull();
        });

        it('allows deleting a parcel once all its cycles are completed', async () => {
            const parcel = await seedParcel();
            await seedCycle(parcel.id, 'completed');

            await AgriParcelService.deleteParcel(parcel.id, undefined, database);

            const stored = await database.get('agri_parcels').find(parcel.id) as any;
            expect(stored.deletedAt).not.toBeNull();
        });
    });

    describe('crop cycle update', () => {
        it('edits cycle agronomy and contract fields', async () => {
            const parcel = await seedParcel();
            const cycle = await seedCycle(parcel.id);

            const updated = await AgriCropCycleService.updateCropCycle(cycle.id, {
                variety: 'Blue Bayong',
                areaPlantedHa: 2.2,
                expectedYieldKg: 55000,
                capitalAllocated: 80000,
                notes: 'Replanted after typhoon',
            }, database);

            expect(updated.variety).toBe('Blue Bayong');
            expect(updated.areaPlantedHa).toBe(2.2);
            expect(updated.expectedYieldKg).toBe(55000);
            expect(updated.capitalAllocated).toBe(80000);
            expect(updated.notes).toBe('Replanted after typhoon');
        });

        it('moves a cycle to another parcel and re-points the cycle', async () => {
            const original = await seedParcel('Original');
            const target = await seedParcel('Target');
            const cycle = await seedCycle(original.id);

            const updated = await AgriCropCycleService.updateCropCycle(
                cycle.id,
                { parcelId: target.id },
                database
            );
            expect(updated.parcelId).toBe(target.id);
        });
    });

    describe('crop cycle delete', () => {
        it('soft-deletes a cycle that has no harvest or settlement data', async () => {
            const parcel = await seedParcel();
            const cycle = await seedCycle(parcel.id);

            await AgriCropCycleService.deleteCropCycle(cycle.id, undefined, database);

            const stored = await database.get('agri_crop_cycles').find(cycle.id) as any;
            expect(stored.deletedAt).not.toBeNull();
        });

        it('hides deleted cycles from the cycle list', async () => {
            const parcel = await seedParcel();
            const kept = await seedCycle(parcel.id);
            const removed = await seedCycle(parcel.id);
            await AgriCropCycleService.deleteCropCycle(removed.id, undefined, database);

            const list = await AgriCropCycleService.listCycles(undefined, database);
            expect(list.map(e => e.cycle.id)).toEqual([kept.id]);
        });

        it('blocks deleting a cycle that already has harvest weigh-ins', async () => {
            const parcel = await seedParcel();
            const cycle = await seedCycle(parcel.id);
            await seedHarvestLog(cycle.id, parcel.id);

            await expect(AgriCropCycleService.deleteCropCycle(cycle.id, undefined, database))
                .rejects.toThrow(/harvest/i);

            const stored = await database.get('agri_crop_cycles').find(cycle.id) as any;
            expect(stored.deletedAt).toBeNull();
        });

        it('blocks deleting a cycle that already has weekly settlements', async () => {
            const parcel = await seedParcel();
            const cycle = await seedCycle(parcel.id);
            await seedSettlement(cycle.id);

            await expect(AgriCropCycleService.deleteCropCycle(cycle.id, undefined, database))
                .rejects.toThrow(/settlement/i);

            const stored = await database.get('agri_crop_cycles').find(cycle.id) as any;
            expect(stored.deletedAt).toBeNull();
        });
    });
});
