import { Database, Q } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import AgriParcel from '../database/models/AgriParcel';
import AgriLandOwner from '../database/models/AgriLandOwner';
import AgriCropCycle from '../database/models/AgriCropCycle';
import {
    GPSCoordinate,
    serializeGpsCoordinates,
} from '../utils/coordinates';

export type { GPSCoordinate };

export interface CreateParcelInput {
    name: string;
    code?: string;
    landOwnerId: string;
    areaHectares: number;
    locationAddress?: string;
    gpsCoordinates?: GPSCoordinate[];
    soilType?: string;
    status?: string;
}

export class AgriParcelService {
    /**
     * Calculates area of a closed GPS polygon in hectares using projected planar Shoelace formula.
     * 1 hectare = 10,000 square meters.
     */
    static calculatePolygonAreaHectares(coords: GPSCoordinate[]): number {
        if (!coords || coords.length < 3) return 0;

        const R = 6378137; // Earth radius in meters
        const rad = Math.PI / 180;

        // Calculate average latitude for projection
        const avgLat = coords.reduce((sum, c) => sum + c.latitude, 0) / coords.length;
        const avgLatRad = avgLat * rad;
        const cosAvgLat = Math.cos(avgLatRad);

        // Convert coordinates to planar meters
        const points = coords.map(c => ({
            x: R * c.longitude * rad * cosAvgLat,
            y: R * c.latitude * rad,
        }));

        // Shoelace formula
        let area = 0;
        const n = points.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }

        const areaSqMeters = Math.abs(area) / 2;
        const areaHectares = areaSqMeters / 10000;

        return Number(areaHectares.toFixed(4));
    }

    /**
     * Create a new parcel
     */
    static async createParcel(
        input: CreateParcelInput,
        db: Database = globalDatabase
    ): Promise<AgriParcel> {
        let parcel: AgriParcel | null = null;

        await db.write(async () => {
            parcel = await db.get<AgriParcel>('agri_parcels').create(record => {
                record.name = input.name;
                record.code = input.code || `PCL-${Date.now().toString().slice(-4)}`;
                record.landOwnerId = input.landOwnerId;
                record.areaHectares = input.areaHectares;
                record.locationAddress = input.locationAddress || null;
                record.gpsCoordinates = serializeGpsCoordinates(input.gpsCoordinates);
                record.soilType = input.soilType || 'Loam';
                record.status = input.status || 'available';
            });
        });

        if (!parcel) {
            throw new Error('Failed to create parcel');
        }

        return parcel;
    }

    /**
     * Update an existing parcel
     */
    static async updateParcel(
        parcelId: string,
        updates: Partial<CreateParcelInput>,
        db: Database = globalDatabase
    ): Promise<AgriParcel> {
        const parcel = await db.get<AgriParcel>('agri_parcels').find(parcelId);

        await db.write(async () => {
            await parcel.update(record => {
                if (updates.name !== undefined) record.name = updates.name;
                if (updates.code !== undefined) record.code = updates.code;
                if (updates.landOwnerId !== undefined) record.landOwnerId = updates.landOwnerId;
                if (updates.areaHectares !== undefined) record.areaHectares = updates.areaHectares;
                if (updates.locationAddress !== undefined) record.locationAddress = updates.locationAddress;
                if (updates.gpsCoordinates !== undefined) {
                    record.gpsCoordinates = serializeGpsCoordinates(updates.gpsCoordinates);
                }
                if (updates.soilType !== undefined) record.soilType = updates.soilType;
                if (updates.status !== undefined) record.status = updates.status;
            });
        });

        return parcel;
    }

    /**
     * List all parcels with landowner information
     */
    static async listParcels(
        statusFilter?: string,
        db: Database = globalDatabase
    ): Promise<Array<{ parcel: AgriParcel; landOwner: AgriLandOwner | null; activeCycle: AgriCropCycle | null }>> {
        const clauses: any[] = [Q.where('deleted_at', null)];
        if (statusFilter && statusFilter !== 'all') {
            clauses.push(Q.where('status', statusFilter));
        }

        const parcels = await db.get<AgriParcel>('agri_parcels').query(...clauses).fetch();
        const results = [];

        for (const parcel of parcels) {
            let landOwner: AgriLandOwner | null = null;
            try {
                landOwner = await db.get<AgriLandOwner>('agri_land_owners').find(parcel.landOwnerId);
            } catch {
                landOwner = null;
            }

            const activeCycles = await db
                .get<AgriCropCycle>('agri_crop_cycles')
                .query(
                    Q.where('parcel_id', parcel.id),
                    Q.where('deleted_at', null),
                    Q.where('status', Q.notIn(['completed', 'closed']))
                )
                .fetch();

            results.push({
                parcel,
                landOwner,
                activeCycle: activeCycles.length > 0 ? activeCycles[0] : null,
            });
        }

        return results;
    }
}
export default AgriParcelService;
