import { Database, Q } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import AgriCropCycle from '../database/models/AgriCropCycle';
import AgriParcel from '../database/models/AgriParcel';
import AgriGrowthCheckin from '../database/models/AgriGrowthCheckin';
import AgriHarvestLog from '../database/models/AgriHarvestLog';
import AgriInvestor from '../database/models/AgriInvestor';
import AgriLandOwner from '../database/models/AgriLandOwner';
import AgriWeeklySettlement from '../database/models/AgriWeeklySettlement';
import { ActionLogService, LogParams } from './ActionLogService';
import { AuthService } from './AuthService';

export interface CreateCropCycleInput {
    parcelId: string;
    investorId?: string;
    cycleCode?: string;
    cropType?: string;
    variety?: string;
    plantingDate: Date;
    targetHarvestDate?: Date;
    areaPlantedHa: number;
    expectedYieldKg?: number;
    capitalAllocated?: number;
    landOwnerRatePerKg?: number;
    landOwnerGuaranteedMin?: number;
    offtakePricePerKg?: number;
    notes?: string;
}

export type UpdateCropCycleInput = Partial<CreateCropCycleInput> & {
    status?: string;
    actualHarvestDate?: Date;
};

export interface GrowthCheckinInput {
    cropCycleId: string;
    checkinDate?: Date;
    stage: string; // land_prep, germination, vegetative, root_bulking, maturity
    plantHeightCm?: number;
    healthStatus: string; // excellent, good, fair, pest_risk, diseased
    notes?: string;
    photoUri?: string;
}

export class AgriCropCycleService {
    /**
     * Standard Cassava growth duration is typically 270 days (9 months).
     */
    static calculateDefaultHarvestDate(plantingDate: Date, durationDays: number = 270): Date {
        const target = new Date(plantingDate.getTime());
        target.setDate(target.getDate() + durationDays);
        return target;
    }

    /**
     * Resolves the operator identity recorded on audit trail entries.
     */
    private static async resolveAuditUser(performedBy?: string): Promise<string> {
        return performedBy || (await AuthService.getCurrentUserId()) || 'system';
    }

    /**
     * Start a new crop cycle on a parcel
     */
    static async createCropCycle(
        input: CreateCropCycleInput,
        db: Database = globalDatabase,
        performedBy?: string
    ): Promise<AgriCropCycle> {
        const parcel = await db.get<AgriParcel>('agri_parcels').find(input.parcelId);
        let landOwner: AgriLandOwner | null = null;
        try {
            landOwner = await db.get<AgriLandOwner>('agri_land_owners').find(parcel.landOwnerId);
        } catch {
            landOwner = null;
        }

        let investor: AgriInvestor | null = null;
        if (input.investorId) {
            try {
                investor = await db.get<AgriInvestor>('agri_investors').find(input.investorId);
            } catch {
                investor = null;
            }
        }

        const plantingDate = input.plantingDate || new Date();
        const targetHarvestDate = input.targetHarvestDate || this.calculateDefaultHarvestDate(plantingDate);

        // Expected yield rule-of-thumb for Cassava in PH: ~25 metric tons (25,000 kg) per hectare
        const expectedYieldKg = input.expectedYieldKg || Number((input.areaPlantedHa * 25000).toFixed(2));
        const ratePerKg = input.landOwnerRatePerKg || (landOwner ? landOwner.defaultPerKiloRate : 1.0);
        const guaranteedMin = input.landOwnerGuaranteedMin || (landOwner ? landOwner.defaultGuaranteedMinimum : 25000.0);
        const offtakePrice = input.offtakePricePerKg || (investor ? investor.defaultOfftakePricePerKg : 4.0);

        const year = plantingDate.getFullYear();
        const cycleCode = input.cycleCode || `CYC-${year}-${(parcel.code || parcel.name).replace(/\s+/g, '').toUpperCase()}`;

        let cycle: AgriCropCycle | null = null;
        const auditUser = await this.resolveAuditUser(performedBy);

        await db.write(async () => {
            cycle = await db.get<AgriCropCycle>('agri_crop_cycles').create(record => {
                record.cycleCode = cycleCode;
                record.parcelId = parcel.id;
                record.investorId = input.investorId || null;
                record.cropType = input.cropType || 'Cassava';
                record.variety = input.variety || 'Golden Yellow';
                record.plantingDate = plantingDate;
                record.targetHarvestDate = targetHarvestDate;
                record.areaPlantedHa = input.areaPlantedHa;
                record.status = 'planted';
                record.expectedYieldKg = expectedYieldKg;
                record.totalActualYieldKg = 0;
                record.capitalAllocated = input.capitalAllocated || 0;
                record.landOwnerRatePerKg = ratePerKg;
                record.landOwnerGuaranteedMin = guaranteedMin;
                record.offtakePricePerKg = offtakePrice;
                record.notes = input.notes || null;
            });

            // Update parcel status to planted
            await parcel.update(p => {
                p.status = 'planted';
            });

            const logParams: LogParams[] = [{
                entityType: 'agri_crop_cycles',
                entityId: cycle.id,
                action: 'CREATE',
                newData: { ...cycle._raw },
            }];
            await db.batch(...new ActionLogService(db).prepareLogActionsSync(logParams, auditUser));
        });

        if (!cycle) {
            throw new Error('Failed to create crop cycle');
        }

        return cycle;
    }

    /**
     * Update an existing crop cycle (agronomy, contract terms, status, or parcel assignment)
     */
    static async updateCropCycle(
        cycleId: string,
        updates: UpdateCropCycleInput,
        db: Database = globalDatabase,
        performedBy?: string
    ): Promise<AgriCropCycle> {
        const cycle = await db.get<AgriCropCycle>('agri_crop_cycles').find(cycleId);

        let targetParcel: AgriParcel | null = null;
        if (updates.parcelId && updates.parcelId !== cycle.parcelId) {
            targetParcel = await db.get<AgriParcel>('agri_parcels').find(updates.parcelId);
        }

        const oldData = { ...cycle._raw };
        const auditUser = await this.resolveAuditUser(performedBy);

        await db.write(async () => {
            await cycle.update(record => {
                if (updates.parcelId !== undefined) record.parcelId = updates.parcelId;
                if (updates.cycleCode !== undefined) record.cycleCode = updates.cycleCode;
                if (updates.cropType !== undefined) record.cropType = updates.cropType;
                if (updates.variety !== undefined) record.variety = updates.variety;
                if (updates.plantingDate !== undefined) record.plantingDate = updates.plantingDate;
                if (updates.targetHarvestDate !== undefined) record.targetHarvestDate = updates.targetHarvestDate;
                if (updates.actualHarvestDate !== undefined) record.actualHarvestDate = updates.actualHarvestDate;
                if (updates.areaPlantedHa !== undefined) record.areaPlantedHa = updates.areaPlantedHa;
                if (updates.status !== undefined) record.status = updates.status;
                if (updates.expectedYieldKg !== undefined) record.expectedYieldKg = updates.expectedYieldKg;
                if (updates.capitalAllocated !== undefined) record.capitalAllocated = updates.capitalAllocated;
                if (updates.landOwnerRatePerKg !== undefined) record.landOwnerRatePerKg = updates.landOwnerRatePerKg;
                if (updates.landOwnerGuaranteedMin !== undefined) record.landOwnerGuaranteedMin = updates.landOwnerGuaranteedMin;
                if (updates.offtakePricePerKg !== undefined) record.offtakePricePerKg = updates.offtakePricePerKg;
                if (updates.investorId !== undefined) record.investorId = updates.investorId || null;
                if (updates.notes !== undefined) record.notes = updates.notes || null;
            });

            if (targetParcel) {
                await targetParcel.update(p => {
                    p.status = 'planted';
                });
            }

            const logParams: LogParams[] = [{
                entityType: 'agri_crop_cycles',
                entityId: cycleId,
                action: 'UPDATE',
                oldData,
                newData: { ...cycle._raw },
            }];
            await db.batch(...new ActionLogService(db).prepareLogActionsSync(logParams, auditUser));
        });

        return cycle;
    }

    /**
     * Soft-delete a crop cycle. Blocked once the cycle carries financial history
     * (harvest weigh-ins or weekly settlements) so payouts stay traceable.
     */
    static async deleteCropCycle(
        cycleId: string,
        performedBy?: string,
        db: Database = globalDatabase
    ): Promise<AgriCropCycle> {
        const cycle = await db.get<AgriCropCycle>('agri_crop_cycles').find(cycleId);

        const [harvestLogs, settlements] = await Promise.all([
            db.get<AgriHarvestLog>('agri_harvest_logs').query(
                Q.where('crop_cycle_id', cycleId),
                Q.where('deleted_at', null)
            ).fetch(),
            db.get<AgriWeeklySettlement>('agri_weekly_settlements').query(
                Q.where('crop_cycle_id', cycleId),
                Q.where('deleted_at', null)
            ).fetch(),
        ]);

        if (harvestLogs.length > 0 || settlements.length > 0) {
            throw new Error(
                `Cannot delete cycle ${cycle.cycleCode}: it already has ${harvestLogs.length} harvest weigh-in(s) and ${settlements.length} weekly settlement(s). Correct those records first.`
            );
        }

        const auditUser = await this.resolveAuditUser(performedBy);

        await db.write(async () => {
            await cycle.update(record => {
                record.deletedAt = new Date();
            });

            const logParams: LogParams[] = [{
                entityType: 'agri_crop_cycles',
                entityId: cycleId,
                action: 'DELETE',
                oldData: { ...cycle._raw },
            }];
            await db.batch(...new ActionLogService(db).prepareLogActionsSync(logParams, auditUser));
        });

        return cycle;
    }

    /**
     * Add a growth stage checkin
     */
    static async addGrowthCheckin(
        input: GrowthCheckinInput,
        db: Database = globalDatabase
    ): Promise<AgriGrowthCheckin> {
        let checkin: AgriGrowthCheckin | null = null;

        await db.write(async () => {
            checkin = await db.get<AgriGrowthCheckin>('agri_growth_checkins').create(record => {
                record.cropCycleId = input.cropCycleId;
                record.checkinDate = input.checkinDate || new Date();
                record.stage = input.stage;
                record.plantHeightCm = input.plantHeightCm || null;
                record.healthStatus = input.healthStatus;
                record.notes = input.notes || null;
                record.photoUri = input.photoUri || null;
            });

            // If checkin stage indicates progress, adjust cycle status if appropriate
            const cycle = await db.get<AgriCropCycle>('agri_crop_cycles').find(input.cropCycleId);
            if (input.stage === 'maturity' && cycle.status !== 'harvesting') {
                await cycle.update(c => {
                    c.status = 'growing';
                });
            }
        });

        if (!checkin) {
            throw new Error('Failed to create growth checkin');
        }

        return checkin;
    }

    /**
     * List all cycles with parcel and investor names
     */
    static async listCycles(
        statusFilter?: string,
        db: Database = globalDatabase
    ): Promise<Array<{ cycle: AgriCropCycle; parcel: AgriParcel | null; investor: AgriInvestor | null }>> {
        const clauses: any[] = [Q.where('deleted_at', null)];
        if (statusFilter && statusFilter !== 'all') {
            clauses.push(Q.where('status', statusFilter));
        }

        const cycles = await db.get<AgriCropCycle>('agri_crop_cycles').query(...clauses).fetch();
        const results = [];

        for (const cycle of cycles) {
            let parcel: AgriParcel | null = null;
            try {
                parcel = await db.get<AgriParcel>('agri_parcels').find(cycle.parcelId);
            } catch {
                parcel = null;
            }

            let investor: AgriInvestor | null = null;
            if (cycle.investorId) {
                try {
                    investor = await db.get<AgriInvestor>('agri_investors').find(cycle.investorId);
                } catch {
                    investor = null;
                }
            }

            results.push({ cycle, parcel, investor });
        }

        return results;
    }
}
export default AgriCropCycleService;
