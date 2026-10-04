import { Database } from '@nozbe/watermelondb';
import { createTestDatabase } from '../../__tests__/test-utils';
import AgriParcel from '../../database/models/AgriParcel';
import { AgriParcelService, GPSCoordinate } from '../AgriParcelService';

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
    });
});
