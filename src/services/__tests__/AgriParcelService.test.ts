import { Database, Query } from '@nozbe/watermelondb';
import { createTestDatabase } from '../../__tests__/test-utils';
import { runAuditedAgriBatch } from '../AgriWriteSafety';
import AgriParcel from '../../database/models/AgriParcel';
import { AgriParcelService, GPSCoordinate } from '../AgriParcelService';
import { parseGpsCoordinates } from '../../utils/coordinates';
import uuid from 'react-native-uuid';
import { AgriBlockService } from '../AgriBlockService';
import { AuthService } from '../AuthService';
import { measureParcelGeometry } from '../../utils/parcelGeometry';

jest.mock('../AuthService', () => ({
    AuthService: { getCurrentUserId: jest.fn().mockResolvedValue('DUMMY: geometry-test-operator') },
}));

describe('AgriParcelService', () => {
    describe('calculatePolygonAreaHectares', () => {
        it('calculates area for a rectangular GPS parcel in hectares', () => {
            // ~100m x ~100m square near equator (~1 hectare = 10,000 m2)
            // 1 degree latitude ~ 111,320m -> 0.001 deg ~ 111.32m
            // 0.001 deg lon at lat 8 deg ~ 111.32m * cos(8) ~ 110.2m
            // Area ~ 111.32 * 110.2 ~ 12,267 m2 ~ 1.2267 ha
            const coords = [
                { latitude: 8.000, longitude: 125.000 },
                { latitude: 8.001, longitude: 125.000 },
                { latitude: 8.001, longitude: 125.001 },
                { latitude: 8.000, longitude: 125.001 },
            ];

            const ha = AgriParcelService.calculatePolygonAreaHectares(coords);
            expect(ha).toBeGreaterThan(1.1);
            expect(ha).toBeLessThan(1.3);
        });

        it('returns 0 if fewer than 3 coordinates provided', () => {
            expect(AgriParcelService.calculatePolygonAreaHectares([])).toBe(0);
            expect(AgriParcelService.calculatePolygonAreaHectares([{ latitude: 8, longitude: 125 }])).toBe(0);
        });

        it('rejects an invalid polygon instead of reporting a plausible area', () => {
            // DUMMY: synthetic bow-tie.
            expect(() => AgriParcelService.calculatePolygonAreaHectares([
                { latitude: 8, longitude: 125 }, { latitude: 8.001, longitude: 125.001 },
                { latitude: 8.001, longitude: 125 }, { latitude: 8, longitude: 125.001 },
            ])).toThrow(/geometry|intersect/i);
        });
    });

    describe('GPS persistence', () => {
        let database: Database;

        beforeEach(async () => {
            database = createTestDatabase();
            const existing = await database.get<AgriParcel>('agri_parcels').query().fetch();
            await database.write(async () => {
                for (const row of existing) await row.destroyPermanently();
            });
        });

        const SQUARE: GPSCoordinate[] = [
            { latitude: 8.0, longitude: 125.0 },
            { latitude: 8.001, longitude: 125.0 },
            { latitude: 8.001, longitude: 125.001 },
            { latitude: 8.0, longitude: 125.001 },
        ];

        it('does not return parcel registry snapshots after storage becomes quarantined during a read', async () => {
            await AgriParcelService.createParcel({ name: 'DUMMY: registry', landOwnerId: 'DUMMY: owner', areaHectares: 1.2 }, database);
            let entered!: () => void, release!: () => void;
            const started = new Promise<void>(resolve => { entered = resolve; });
            const barrier = new Promise<void>(resolve => { release = resolve; });
            const originalFetch = Query.prototype.fetch;
            const fetch = jest.spyOn(Query.prototype, 'fetch').mockImplementationOnce(async function (this: Query<any>) {
                const rows = await originalFetch.call(this);
                entered();
                await barrier;
                return rows;
            });
            const result = AgriParcelService.listParcels(undefined, database).then(rows => ({ rows, error: null }), error => ({ rows: null, error }));
            await started;
            const batch = jest.spyOn(database, 'batch').mockRejectedValueOnce(new Error('DUMMY: uncertain registry storage result'));
            try {
                await expect(database.write(() => runAuditedAgriBatch(database, () => []))).rejects.toHaveProperty('code', 'AGRI_DATABASE_REOPEN_REQUIRED');
                release();
                expect((await result).error).toMatchObject({ code: 'AGRI_DATABASE_REOPEN_REQUIRED' });
            } finally { release(); fetch.mockRestore(); batch.mockRestore(); }
        });

        it.each(['create', 'rename', 'delete', 'rename-after-clear'])('keeps GPS-bearing parcel %s audits scoped locally', async action => {
            const parcel = await AgriParcelService.createParcel({ name: 'DUMMY: mapped parcel', landOwnerId: 'DUMMY: owner', areaHectares: 1.2, gpsCoordinates: SQUARE }, database);
            if (action === 'rename') await AgriParcelService.updateParcel(parcel.id, { name: 'DUMMY: new name' }, database);
            if (action === 'delete') await AgriParcelService.deleteParcel(parcel.id, undefined, database);
            if (action === 'rename-after-clear') {
                await AgriParcelService.updateParcel(parcel.id, { gpsCoordinates: null }, database);
                await AgriParcelService.updateParcel(parcel.id, { name: 'DUMMY: cleared parcel' }, database);
            }
            const logs = (await database.get<any>('action_logs').query().fetch()).filter(log => log.entityId === parcel.id);
            expect(logs.length).toBeGreaterThan(0);
            for (const log of logs) {
                for (const raw of [log.oldData, log.newData].filter(Boolean)) {
                    expect(JSON.parse(raw).sync_scope).toBe('agri_mapping_local');
                }
            }
        });

        it('does not defer unrelated unmeasured parcel metadata audits', async () => {
            const parcel = await AgriParcelService.createParcel({ name: 'DUMMY: unmeasured parcel', landOwnerId: 'DUMMY: owner', areaHectares: 1.2 }, database);
            await AgriParcelService.updateParcel(parcel.id, { name: 'DUMMY: rename' }, database);
            const logs = (await database.get<any>('action_logs').query().fetch()).filter(log => log.entityId === parcel.id);
            expect(logs).toHaveLength(2);
            expect(logs.every(log => !JSON.parse(log.newData).sync_scope)).toBe(true);
        });

        it('stores coordinates as canonical JSON on create', async () => {
            const parcel = await AgriParcelService.createParcel(
                { name: 'P1', landOwnerId: 'owner-1', areaHectares: 1.2, gpsCoordinates: SQUARE },
                database
            );
            const parsed = JSON.parse(parcel.gpsCoordinates as string);
            expect(parsed).toEqual(SQUARE);
        });

        it('stores NULL (not "[]") when coordinates are cleared via update', async () => {
            const parcel = await AgriParcelService.createParcel(
                { name: 'P1', landOwnerId: 'owner-1', areaHectares: 1.2, gpsCoordinates: SQUARE },
                database
            );
            const updated = await AgriParcelService.updateParcel(
                parcel.id,
                { gpsCoordinates: [] },
                database
            );
            expect(updated.gpsCoordinates).toBeNull();
        });

        it('stores NULL when created without coordinates', async () => {
            const parcel = await AgriParcelService.createParcel(
                { name: 'P1', landOwnerId: 'owner-1', areaHectares: 1.2 },
                database
            );
            expect(parcel.gpsCoordinates).toBeNull();
        });

        it.each([
            [SQUARE[0], SQUARE[2], SQUARE[1], SQUARE[3]],
            SQUARE.slice(0, 2),
            [{ latitude: NaN, longitude: 125 }],
            [{ latitude: '8junk', longitude: 125 }],
        ].map(coordinates => [coordinates]))('rejects invalid new GPS writes without creating a row %#', async coordinates => {
            await expect(AgriParcelService.createParcel({
                name: 'DUMMY: invalid', landOwnerId: 'DUMMY: owner', areaHectares: 1.2,
                gpsCoordinates: coordinates as GPSCoordinate[],
            }, database)).rejects.toThrow(/GPS|geometry/i);
            expect(await database.get<AgriParcel>('agri_parcels').query().fetchCount()).toBe(0);
        });

        it('rejects invalid updates without changing boundary, area or audit history', async () => {
            const parcel = await AgriParcelService.createParcel({
                name: 'DUMMY: valid', landOwnerId: 'DUMMY: owner', areaHectares: 1.2, gpsCoordinates: SQUARE,
            }, database);
            const raw = { ...parcel._raw };
            const logs = await database.get('action_logs').query().fetchCount();
            await expect(AgriParcelService.updateParcel(parcel.id, {
                areaHectares: 99, gpsCoordinates: [SQUARE[0], SQUARE[2], SQUARE[1], SQUARE[3]],
            }, database)).rejects.toThrow();
            expect(parcel._raw).toEqual(raw);
            expect(await database.get('action_logs').query().fetchCount()).toBe(logs);
        });

        it('preserves legacy points, null clearing and historical hectares', async () => {
            const parcel = await AgriParcelService.createParcel({
                name: 'DUMMY: point', landOwnerId: 'DUMMY: owner', areaHectares: 1.2, gpsCoordinates: [SQUARE[0]],
            }, database);
            expect(parseGpsCoordinates(parcel.gpsCoordinates)).toEqual([SQUARE[0]]);
            await AgriParcelService.updateParcel(parcel.id, { gpsCoordinates: null } as any, database);
            expect(parcel.gpsCoordinates).toBeNull();
            expect(parcel.areaHectares).toBe(1.2);
        });

        it('routes legacy GPS updates through a single audited revision/outbox batch, without metadata overwriting measured or historical area', async () => {
            const parcel = await AgriParcelService.createParcel({ name: 'DUMMY: wrapper', landOwnerId: 'DUMMY: owner', areaHectares: 99 }, database);
            const cycle = await database.write(() => database.get<any>('agri_crop_cycles').create(record => {
                record.parcelId = parcel.id; record.status = 'growing'; record.areaPlantedHa = 99;
            }));
            const historicalCycle = { ...cycle._raw };
            const batch = jest.spyOn(database, 'batch');
            await AgriParcelService.updateParcel(parcel.id, { gpsCoordinates: SQUARE, areaHectares: 777, name: 'DUMMY: measured' }, database);
            expect(batch).toHaveBeenCalledTimes(2); // delegated GPS command plus atomic metadata/audit
            expect(parcel.layoutRevision).toBe(1);
            expect(parcel.boundaryRevision).toBe(1);
            const measured = measureParcelGeometry({ outer: SQUARE, holes: [] }).areaHectares;
            expect(parcel.areaHectares).toBe(measured);
            expect(parcel.name).toBe('DUMMY: measured');
            // Geometry and its required audit/outbox are inseparable; metadata is a separate write.
            expect(batch.mock.calls[0].map((r: any) => r.table)).toEqual(expect.arrayContaining(['agri_parcels', 'action_logs', 'agri_pending_layout_operations']));
            await AgriParcelService.updateParcel(parcel.id, { gpsCoordinates: [SQUARE[0]], areaHectares: 888 }, database);
            await AgriParcelService.updateParcel(parcel.id, { gpsCoordinates: [], areaHectares: 999 }, database);
            expect(parcel.layoutRevision).toBe(3);
            expect(parcel.boundaryRevision).toBe(3);
            expect(parcel.areaHectares).toBe(measured);
            const payloads = (await database.get<any>('agri_pending_layout_operations').query().fetch()).map(r => JSON.parse(r.payloadJson));
            expect(payloads.map(p => p.kind)).toEqual(['layout', 'legacy_point', 'clear']);
            expect(payloads[0].geometry.outer).toEqual(SQUARE);
            expect(payloads.every(p => p.netAreaHectares === measured)).toBe(true);
            expect(batch).toHaveBeenCalledTimes(4); // no nested writer/gate; point and clear own one batch each
            expect(cycle._raw).toEqual(historicalCycle);
            batch.mockRestore();
        });

        it('rejects stale saveLayout after a newer legacy wrapper update', async () => {
            const parcel = await AgriParcelService.createParcel({ name: 'DUMMY: CAS', landOwnerId: 'DUMMY: owner', areaHectares: 99 }, database);
            await AgriParcelService.updateParcel(parcel.id, { gpsCoordinates: [SQUARE[0]] }, database);
            await expect(AgriBlockService.saveLayout({ parcelId: parcel.id, expectedRevision: 0,
                geometry: { outer: SQUARE, holes: [] }, blocks: [], operationId: uuid.v4() as string }, database)).rejects.toThrow(/revision conflict/i);
            expect(parseGpsCoordinates(parcel.gpsCoordinates)).toEqual([SQUARE[0]]);
        });

        it('captures wrapper expectedRevision before awaiting identity, rejecting an intervening save without metadata writes', async () => {
            const parcel = await AgriParcelService.createParcel({ name: 'DUMMY: CAS', landOwnerId: 'DUMMY: owner', areaHectares: 99 }, database);
            let release!: (value: string) => void;
            let entered!: () => void;
            const identityEntered = new Promise<void>(resolve => { entered = resolve; });
            (AuthService.getCurrentUserId as jest.Mock).mockImplementationOnce(() => {
                entered(); return new Promise<string>(resolve => { release = resolve; });
            });
            const pending = AgriParcelService.updateParcel(parcel.id, { gpsCoordinates: [SQUARE[0]], name: 'DUMMY: stale' }, database);
            await identityEntered;
            await AgriBlockService.saveLayout({ parcelId: parcel.id, expectedRevision: 0,
                geometry: { outer: SQUARE, holes: [] }, blocks: [], operationId: uuid.v4() as string }, database, 'DUMMY: supervisor');
            release('DUMMY: wrapper supervisor');
            await expect(pending).rejects.toThrow(/revision conflict/i);
            expect(parcel.layoutRevision).toBe(1);
            expect(parcel.name).toBe('DUMMY: CAS');
            expect(parseGpsCoordinates(parcel.gpsCoordinates)).toEqual(SQUARE);
        });

        it('does not silently resave filtered corrupt legacy vertices; metadata remains editable', async () => {
            const corrupt = JSON.stringify([...SQUARE, { latitude: '8junk', longitude: 125 }]);
            const parcel = await database.write(() => database.get<AgriParcel>('agri_parcels').create(record => {
                record.name = 'DUMMY: corrupt legacy'; record.landOwnerId = 'DUMMY: owner';
                record.areaHectares = 1.2; record.gpsCoordinates = corrupt;
            }));
            await AgriParcelService.updateParcel(parcel.id, { name: 'DUMMY: renamed' }, database);
            expect(parcel.gpsCoordinates).toBe(corrupt);
            await expect(AgriParcelService.updateParcel(parcel.id, {
                gpsCoordinates: parseGpsCoordinates(corrupt),
            }, database)).rejects.toThrow(/corrupt|clear/i);
            expect(parcel.gpsCoordinates).toBe(corrupt);
            await AgriParcelService.updateParcel(parcel.id, { gpsCoordinates: [] }, database);
            expect(parcel.gpsCoordinates).toBeNull();
            expect(parcel.areaHectares).toBe(1.2);
        });
    });
});
