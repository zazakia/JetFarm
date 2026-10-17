import { Database, Q } from '@nozbe/watermelondb';
import randomId from '@nozbe/watermelondb/utils/common/randomId';
import { database as globalDatabase } from '../database';
import AgriParcel from '../database/models/AgriParcel';
import AgriLandOwner from '../database/models/AgriLandOwner';
import AgriCropCycle from '../database/models/AgriCropCycle';
import AgriParcelBlock from '../database/models/AgriParcelBlock';
import { ActionLogService, LogParams } from './ActionLogService';
import { AuthService } from './AuthService';
import uuid from 'react-native-uuid';
import { AgriBlockService, prepareRequiredAudit, readParcelGeometry } from './AgriBlockService';
import { assertAgriDatabaseUsable, runAuditedAgriBatch, writeAgriDatabase } from './AgriWriteSafety';
import {
    GPSCoordinate,
    serializeGpsCoordinates,
    isValidCoordinate,
} from '../utils/coordinates';
import { measureParcelGeometry, validateParcelGeometry } from '../utils/parcelGeometry';

export type { GPSCoordinate };

/** Cycle statuses that still occupy a parcel and block its deletion. */
const OPEN_CYCLE_STATUS_VALUES = ['planning', 'land_prep', 'planted', 'growing', 'harvesting'];

export interface CreateParcelInput {
    name: string;
    code?: string;
    landOwnerId: string;
    areaHectares: number;
    locationAddress?: string;
    gpsCoordinates?: GPSCoordinate[] | null;
    soilType?: string;
    status?: string;
}

export class AgriParcelService {
    /** Legacy display/saved-hectares wrapper; shared geometry calculations remain unrounded. */
    static calculatePolygonAreaHectares(coords: GPSCoordinate[]): number {
        if (!coords || coords.length < 3) return 0;
        return Number(measureParcelGeometry({ outer: coords, holes: [] }).areaHectares.toFixed(4));
    }

    /** Null/empty and a valid legacy point are supported; every new boundary must be valid. */
    private static validateGpsWrite(coords: GPSCoordinate[] | null | undefined): void {
        if (coords == null) return;
        if (!Array.isArray(coords) || coords.some(p => !p || !isValidCoordinate(p.latitude, p.longitude))) {
            throw new Error('Invalid GPS coordinates');
        }
        if (coords.length === 0 || coords.length === 1) return;
        const errors = validateParcelGeometry({ outer: coords, holes: [] });
        if (errors.length) throw new Error(`Invalid GPS geometry: ${errors.join('; ')}`);
    }

    /**
     * Resolves the operator identity recorded on audit trail entries.
     */
    private static async resolveAuditUser(performedBy?: string): Promise<string> {
        return performedBy || (await AuthService.getCurrentUserId()) || 'system';
    }

    private static prepareParcelAudit(db: Database, params: LogParams[], user: string): any[] {
        const carriesMapping = params.some(param => [param.oldData, param.newData].some(data => data &&
            (data.gps_coordinates || data.gps_exclusions || data.layout_revision > 0 || data.boundary_revision > 0)));
        const logs = carriesMapping ? prepareRequiredAudit(db, params, user)
            : new ActionLogService(db).prepareLogActionsSync(params, user);
        // Unmapped registry edits also require audits, but keep their existing remote scope.
        if (!Array.isArray(logs) || logs.length !== params.length || logs.some(log => !log || log.table !== 'action_logs')) {
            throw new Error('Required audit records could not be prepared');
        }
        return logs;
    }

    /**
     * Create a new parcel
     */
    static async createParcel(
        input: CreateParcelInput,
        db: Database = globalDatabase,
        performedBy?: string
    ): Promise<AgriParcel> {
        assertAgriDatabaseUsable(db);
        this.validateGpsWrite(input.gpsCoordinates);
        // Snapshot caller-owned fields before identity resolution or FIFO scheduling.
        const command = { ...input, gpsCoordinates: serializeGpsCoordinates(input.gpsCoordinates) };
        const auditUser = await this.resolveAuditUser(performedBy);

        return writeAgriDatabase(db, async () => {
            const now = Date.now();
            const values = {
                id: randomId(), name: command.name, code: command.code || `PCL-${now.toString().slice(-4)}`,
                land_owner_id: command.landOwnerId, area_hectares: command.areaHectares,
                location_address: command.locationAddress || null, gps_coordinates: command.gpsCoordinates,
                gps_exclusions: null, boundary_revision: 0, layout_revision: 0, boundary_saved_at: null,
                soil_type: command.soilType || 'Loam', status: command.status || 'available',
                created_at: now, updated_at: now, deleted_at: null,
            };
            const collection = db.get<AgriParcel>('agri_parcels');
            // Legacy-schema migration fixtures have no mapping columns yet; audit only persisted fields.
            const snapshot = Object.fromEntries(Object.entries(values).filter(([column]) => column === 'id' || collection.schema.columns[column]));
            const audits = this.prepareParcelAudit(db, [{ entityType: 'agri_parcels', entityId: values.id,
                action: 'CREATE', newData: { ...snapshot, _status: 'created', _changed: '' } }], auditUser);
            let parcel!: AgriParcel;
            await runAuditedAgriBatch(db, () => {
                parcel = collection.prepareCreate(record => {
                    record._raw.id = values.id;
                    for (const [column, value] of Object.entries(snapshot)) {
                        if (column !== 'id') record._setRaw(column, value);
                    }
                });
                return [parcel, ...audits];
            });
            return parcel;
        });
    }

    /**
     * Update an existing parcel
     */
    static async updateParcel(
        parcelId: string,
        updates: Partial<CreateParcelInput>,
        db: Database = globalDatabase,
        performedBy?: string
    ): Promise<AgriParcel> {
        assertAgriDatabaseUsable(db);
        this.validateGpsWrite(updates.gpsCoordinates);
        const command = { ...updates, ...(updates.gpsCoordinates === undefined ? {} : {
            gpsCoordinates: updates.gpsCoordinates?.map(point => ({ ...point })) ?? null,
        }) };
        let parcel = await db.get<AgriParcel>('agri_parcels').find(parcelId);
        // Capture before awaiting identity/writer scheduling; never use the later cached revision.
        const expectedRevision = parcel.layoutRevision;
        const operationId = command.gpsCoordinates !== undefined ? uuid.v4() as string : undefined;
        const auditUser = await this.resolveAuditUser(performedBy);
        const hasGps = command.gpsCoordinates !== undefined;
        if (hasGps) {
            if (!command.gpsCoordinates?.length) {
                await AgriBlockService.clearBoundary({ parcelId, expectedRevision, operationId: operationId! }, db, auditUser);
            } else {
                const oldGeometry = readParcelGeometry(parcel);
                await AgriBlockService.saveBoundary({ parcelId, expectedRevision, operationId: operationId!,
                    geometry: { outer: command.gpsCoordinates,
                        holes: command.gpsCoordinates.length === 1 ? [] : oldGeometry.holes } }, db, auditUser);
            }
        }
        const hasMetadata = Object.entries(command).some(([key, value]) => value !== undefined
            && key !== 'gpsCoordinates' && !(hasGps && key === 'areaHectares'));
        // GPS delegates own their FIFO/writer. Metadata enters separately, never nests that gate.
        if (hasMetadata) await writeAgriDatabase(db, async () => {
            // A preceding sync can remove the model while this command awaits the FIFO.
            // Missing/soft-deleted targets are ordinary validation errors, before preparation.
            parcel = await db.get<AgriParcel>('agri_parcels').find(parcelId);
            if (parcel.deletedAt) throw new Error('Cannot update a deleted parcel');
            const oldData = { ...parcel._raw };
            const values = {
                ...(command.name === undefined ? {} : { name: command.name }),
                ...(command.code === undefined ? {} : { code: command.code }),
                ...(command.landOwnerId === undefined ? {} : { land_owner_id: command.landOwnerId }),
                // A GPS command owns measured (polygon) or registered (clear/point) hectares.
                ...(hasGps || command.areaHectares === undefined ? {} : { area_hectares: command.areaHectares }),
                ...(command.locationAddress === undefined ? {} : { location_address: command.locationAddress }),
                ...(command.soilType === undefined ? {} : { soil_type: command.soilType }),
                ...(command.status === undefined ? {} : { status: command.status }),
                updated_at: Date.now(),
            };
            const audits = this.prepareParcelAudit(db, [{ entityType: 'agri_parcels', entityId: parcelId,
                action: 'UPDATE', oldData, newData: { ...oldData, ...values } }], auditUser);
            await runAuditedAgriBatch(db, () => [parcel.prepareUpdate(record => {
                for (const [column, value] of Object.entries(values)) record._setRaw(column, value);
            }), ...audits]);
        });
        return parcel;
    }

    /**
     * Soft-delete a parcel. Blocked while the parcel still carries an open crop
     * cycle so harvest and settlement history never becomes orphaned.
     */
    static async deleteParcel(
        parcelId: string,
        performedBy?: string,
        db: Database = globalDatabase
    ): Promise<AgriParcel> {
        assertAgriDatabaseUsable(db);
        let parcel = await db.get<AgriParcel>('agri_parcels').find(parcelId);

        const openCycles = await db.get<AgriCropCycle>('agri_crop_cycles').query(
            Q.where('parcel_id', parcelId),
            Q.where('deleted_at', null),
            Q.where('status', Q.oneOf(OPEN_CYCLE_STATUS_VALUES))
        ).fetch();

        if (openCycles.length > 0) {
            const codes = openCycles.map(c => c.cycleCode).join(', ');
            throw new Error(
                `Cannot delete this parcel: it still has an active crop cycle (${codes}). Complete or delete those cycles first.`
            );
        }

        const auditUser = await this.resolveAuditUser(performedBy);

        await writeAgriDatabase(db, async () => {
            parcel = await db.get<AgriParcel>('agri_parcels').find(parcelId);
            if (parcel.deletedAt) throw new Error('Cannot delete an already deleted parcel');
            const blocks = await db.get<AgriParcelBlock>('agri_parcel_blocks').query(
                Q.where('parcel_id', parcelId), Q.where('deleted_at', null), Q.where('status', 'active')
            ).fetchCount();
            if (blocks) throw new Error('Cannot delete parcel with retained blocks; archive them first');
            // Recheck inside the writer so an intervening crop creation cannot be orphaned.
            if (await db.get<AgriCropCycle>('agri_crop_cycles').query(
                Q.where('parcel_id', parcelId), Q.where('deleted_at', null),
                Q.where('status', Q.oneOf(OPEN_CYCLE_STATUS_VALUES))
            ).fetchCount()) throw new Error('Cannot delete parcel with an active crop cycle');
            const oldData = { ...parcel._raw };
            const now = Date.now();
            const audits = this.prepareParcelAudit(db, [{ entityType: 'agri_parcels', entityId: parcelId,
                action: 'DELETE', oldData }], auditUser);
            await runAuditedAgriBatch(db, () => [parcel.prepareUpdate(record => {
                record.deletedAt = new Date(now);
                record.updatedAt = new Date(now);
            }), ...audits]);
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
        assertAgriDatabaseUsable(db);
        const clauses: any[] = [Q.where('deleted_at', null)];
        if (statusFilter && statusFilter !== 'all') {
            clauses.push(Q.where('status', statusFilter));
        }

        const parcels = await db.get<AgriParcel>('agri_parcels').query(...clauses).fetch();
        assertAgriDatabaseUsable(db);
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

        assertAgriDatabaseUsable(db);
        return results;
    }
}
export default AgriParcelService;
