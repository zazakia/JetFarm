import { Database, Q } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import AgriWeeklySettlement from '../database/models/AgriWeeklySettlement';
import AgriCropCycle from '../database/models/AgriCropCycle';
import AgriParcel from '../database/models/AgriParcel';
import AgriLandOwner from '../database/models/AgriLandOwner';
import AgriHarvestLog from '../database/models/AgriHarvestLog';
import { formatPHP } from '../utils/currency';

export interface SettlementCalculationResult {
    cumulativeKilos: number;
    ratePerKilo: number;
    rawKiloEarnings: number;
    guaranteedMinimum: number;
    targetCumulativePayout: number;
    previousCumulativePayout: number;
    netPayoutDueThisWeek: number;
    isMinimumApplied: boolean;
    excessKilosOverGuarantee: number;
}

export interface SettlementSlipData {
    settlementId: string;
    cropCycleCode: string;
    landOwnerName: string;
    parcelName: string;
    weekNumber: number;
    weekStartDate: Date;
    weekEndDate: Date;
    cumulativeKilos: number;
    ratePerKilo: number;
    rawKiloEarnings: number;
    guaranteedMinimum: number;
    targetCumulativePayout: number;
    previousCumulativePayout: number;
    netPayoutDueThisWeek: number;
    paymentStatus: string;
    disbursementDate: Date | null;
    receiptReference: string | null;
}

export class LandSettlementEngine {
    /**
     * Pure mathematical calculation for guarantee-aware Land Owner settlement.
     * Formula:
     *   cumulativeKilos = sum of all net weigh-in kilos to date
     *   rawKiloEarnings = cumulativeKilos * ratePerKilo (default ₱1.00/kg)
     *   targetCumulativePayout = max(rawKiloEarnings, guaranteedMinimum (₱25,000.00))
     *   netPayoutDueThisWeek = max(0, targetCumulativePayout - previousCumulativePayout)
     */
    static calculateSettlement(
        cumulativeKilos: number,
        ratePerKilo: number = 1.0,
        guaranteedMinimum: number = 25000.0,
        previousCumulativePayout: number = 0
    ): SettlementCalculationResult {
        const safeKilos = Math.max(0, cumulativeKilos);
        const safeRate = Math.max(0, ratePerKilo);
        const safeMin = Math.max(0, guaranteedMinimum);
        const safePrev = Math.max(0, previousCumulativePayout);

        const rawKiloEarnings = Number((safeKilos * safeRate).toFixed(2));
        const targetCumulativePayout = Number(Math.max(rawKiloEarnings, safeMin).toFixed(2));
        const netPayoutDueThisWeek = Number(Math.max(0, targetCumulativePayout - safePrev).toFixed(2));
        const isMinimumApplied = targetCumulativePayout > rawKiloEarnings;

        const kilosNeededForGuarantee = safeRate > 0 ? safeMin / safeRate : 0;
        const excessKilosOverGuarantee = Math.max(0, safeKilos - kilosNeededForGuarantee);

        return {
            cumulativeKilos: safeKilos,
            ratePerKilo: safeRate,
            rawKiloEarnings,
            guaranteedMinimum: safeMin,
            targetCumulativePayout,
            previousCumulativePayout: safePrev,
            netPayoutDueThisWeek,
            isMinimumApplied,
            excessKilosOverGuarantee,
        };
    }

    /**
     * Compute and create a weekly settlement record in WatermelonDB
     */
    static async computeWeeklySettlement(
        cropCycleId: string,
        weekNumber: number,
        weekStartDate: Date,
        weekEndDate: Date,
        db: Database = globalDatabase
    ): Promise<AgriWeeklySettlement> {
        const cycle = await db.get<AgriCropCycle>('agri_crop_cycles').find(cropCycleId);
        const parcel = await db.get<AgriParcel>('agri_parcels').find(cycle.parcelId);
        const landOwner = await db.get<AgriLandOwner>('agri_land_owners').find(parcel.landOwnerId);

        // 1. Calculate cumulative kilos harvested up to weekEndDate
        const harvestLogs = await db
            .get<AgriHarvestLog>('agri_harvest_logs')
            .query(
                Q.where('crop_cycle_id', cropCycleId),
                Q.where('deleted_at', null)
            )
            .fetch();

        const weekEndTimestamp = weekEndDate.getTime();
        const eligibleHarvests = harvestLogs.filter(
            log => new Date(log.harvestDate).getTime() <= weekEndTimestamp
        );

        const cumulativeKilos = eligibleHarvests.reduce(
            (acc, log) => acc + (log.netWeightKg || 0),
            0
        );

        // 2. Query previous settlements for this cycle (excluding draft, but including approved or paid)
        const previousSettlements = await db
            .get<AgriWeeklySettlement>('agri_weekly_settlements')
            .query(
                Q.where('crop_cycle_id', cropCycleId),
                Q.where('deleted_at', null)
            )
            .fetch();

        const previousCumulativePayout = previousSettlements
            .filter(s => s.weekNumber < weekNumber && s.paymentStatus !== 'rejected')
            .reduce((acc, s) => acc + (s.netPayoutDueThisWeek || 0), 0);

        const ratePerKilo = cycle.landOwnerRatePerKg || landOwner.defaultPerKiloRate || 1.0;
        const guaranteedMin = cycle.landOwnerGuaranteedMin || landOwner.defaultGuaranteedMinimum || 25000.0;

        const calc = this.calculateSettlement(
            cumulativeKilos,
            ratePerKilo,
            guaranteedMin,
            previousCumulativePayout
        );

        const breakdownJson = JSON.stringify({
            ...calc,
            computedAt: new Date().toISOString(),
            harvestBatchCount: eligibleHarvests.length,
            cropCycleCode: cycle.cycleCode,
            landOwnerName: landOwner.name,
            parcelCode: parcel.code || parcel.name,
        });

        let settlement: AgriWeeklySettlement | null = null;

        await db.write(async () => {
            settlement = await db.get<AgriWeeklySettlement>('agri_weekly_settlements').create(record => {
                record.cropCycleId = cropCycleId;
                record.landOwnerId = landOwner.id;
                record.weekNumber = weekNumber;
                record.weekStartDate = weekStartDate;
                record.weekEndDate = weekEndDate;
                record.cumulativeKilos = calc.cumulativeKilos;
                record.ratePerKilo = calc.ratePerKilo;
                record.rawKiloEarnings = calc.rawKiloEarnings;
                record.guaranteedMinimum = calc.guaranteedMinimum;
                record.targetCumulativePayout = calc.targetCumulativePayout;
                record.previousCumulativePayout = calc.previousCumulativePayout;
                record.netPayoutDueThisWeek = calc.netPayoutDueThisWeek;
                record.paymentStatus = 'draft';
                record.calculationBreakdownJson = breakdownJson;
            });
        });

        if (!settlement) {
            throw new Error('Failed to create weekly settlement record');
        }

        return settlement;
    }

    /**
     * Approve and mark a settlement as approved or paid
     */
    static async approveSettlement(
        settlementId: string,
        markAsPaid: boolean = false,
        disbursementDate: Date = new Date(),
        receiptReference?: string,
        db: Database = globalDatabase
    ): Promise<AgriWeeklySettlement> {
        const record = await db.get<AgriWeeklySettlement>('agri_weekly_settlements').find(settlementId);

        await db.write(async () => {
            await record.update(r => {
                r.paymentStatus = markAsPaid ? 'paid' : 'approved';
                if (markAsPaid) {
                    r.disbursementDate = disbursementDate;
                    if (receiptReference) {
                        r.receiptReference = receiptReference;
                    }
                }
            });
        });

        return record;
    }

    /**
     * Generate printable / readable text slip for a settlement
     */
    static generateSettlementSlip(data: SettlementSlipData): string {
        const lines: string[] = [
            '==================================================',
            '             JETFARM AGRIBUSINESS PLATFORM        ',
            '            WEEKLY LAND OWNER SETTLEMENT SLIP     ',
            '==================================================',
            `Cycle Code   : ${data.cropCycleCode}`,
            `Parcel       : ${data.parcelName}`,
            `Land Owner   : ${data.landOwnerName}`,
            `Period       : Week ${data.weekNumber} (${data.weekStartDate.toISOString().split('T')[0]} to ${data.weekEndDate.toISOString().split('T')[0]})`,
            `Status       : ${data.paymentStatus.toUpperCase()}`,
            '--------------------------------------------------',
            `Cumulative Harvest   : ${data.cumulativeKilos.toLocaleString()} kg`,
            `Rate per Kilo        : ${formatPHP(data.ratePerKilo)} / kg`,
            `Raw Kilo Earnings    : ${formatPHP(data.rawKiloEarnings)}`,
            `Cycle Guaranteed Min : ${formatPHP(data.guaranteedMinimum)}`,
            `Target Cumulative    : ${formatPHP(data.targetCumulativePayout)}`,
            `Previously Paid      : ${formatPHP(data.previousCumulativePayout)}`,
            '--------------------------------------------------',
            `NET PAYOUT DUE THIS WEEK : ${formatPHP(data.netPayoutDueThisWeek)}`,
            '==================================================',
        ];

        if (data.disbursementDate) {
            lines.push(`Disbursement Date : ${data.disbursementDate.toISOString().split('T')[0]}`);
        }
        if (data.receiptReference) {
            lines.push(`Reference / Receipt: ${data.receiptReference}`);
        }
        lines.push('Audited & Guarantee-Protected by JetFarm Settlement Engine');

        return lines.join('\n');
    }
}
export default LandSettlementEngine;
