import { Database, Q } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import AgriHarvestLog from '../database/models/AgriHarvestLog';
import AgriCropCycle from '../database/models/AgriCropCycle';
import AgriInvestorLedger from '../database/models/AgriInvestorLedger';
import { AutoPostingService } from './AutoPostingService';

export interface WeighInInput {
    cropCycleId: string;
    parcelId: string;
    harvestDate?: Date;
    batchNumber?: string;
    grossWeightKg: number;
    tareWeightKg: number;
    qualityGrade?: string;
    truckPlateNumber?: string;
    weighInSupervisor?: string;
    photoUri?: string;
    notes?: string;
}

export interface HarvestSummary {
    totalBatches: number;
    totalGrossKg: number;
    totalTareKg: number;
    totalNetKg: number;
    averageNetPerBatch: number;
    firstHarvestDate: Date | null;
    latestHarvestDate: Date | null;
}

export class AgriHarvestService {
    /**
     * Pure calculation for net weight from scale reading:
     * net = max(0, gross - tare)
     */
    static calculateNetWeight(grossWeightKg: number, tareWeightKg: number): number {
        const gross = Number(grossWeightKg) || 0;
        const tare = Number(tareWeightKg) || 0;
        return Number(Math.max(0, gross - tare).toFixed(2));
    }

    /**
     * Log a weigh-in batch, update cycle yield, and record investor off-take
     */
    static async logWeighIn(
        input: WeighInInput,
        db: Database = globalDatabase
    ): Promise<AgriHarvestLog> {
        const netWeightKg = this.calculateNetWeight(input.grossWeightKg, input.tareWeightKg);
        if (netWeightKg <= 0) {
            throw new Error('Net weight must be greater than 0 kg. Check gross and tare weights.');
        }

        const date = input.harvestDate || new Date();
        const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const batchNumber = input.batchNumber || `BATCH-${dateStr}-${randomSuffix}`;

        let harvestLog: AgriHarvestLog | null = null;

        await db.write(async () => {
            // 1. Create harvest log
            harvestLog = await db.get<AgriHarvestLog>('agri_harvest_logs').create(record => {
                record.cropCycleId = input.cropCycleId;
                record.parcelId = input.parcelId;
                record.harvestDate = date;
                record.batchNumber = batchNumber;
                record.grossWeightKg = Number(input.grossWeightKg.toFixed(2));
                record.tareWeightKg = Number(input.tareWeightKg.toFixed(2));
                record.netWeightKg = netWeightKg;
                record.qualityGrade = input.qualityGrade || 'Grade A';
                record.truckPlateNumber = input.truckPlateNumber || null;
                record.weighInSupervisor = input.weighInSupervisor || null;
                record.photoUri = input.photoUri || null;
                record.notes = input.notes || null;
            });

            // 2. Update crop cycle total actual yield
            const cycle = await db.get<AgriCropCycle>('agri_crop_cycles').find(input.cropCycleId);
            const currentTotal = cycle.totalActualYieldKg || 0;
            const newTotal = Number((currentTotal + netWeightKg).toFixed(2));

            await cycle.update(c => {
                c.totalActualYieldKg = newTotal;
                if (c.status === 'planted' || c.status === 'growing') {
                    c.status = 'harvesting';
                }
            });

            // 3. If cycle has an assigned investor, create an off-take ledger record
            if (cycle.investorId) {
                const offtakePrice = cycle.offtakePricePerKg || 4.0;
                const offtakeAmount = Number((netWeightKg * offtakePrice).toFixed(2));

                // Query last ledger entry to compute running balance
                const lastEntries = await db
                    .get<AgriInvestorLedger>('agri_investor_ledgers')
                    .query(
                        Q.where('investor_id', cycle.investorId),
                        Q.where('deleted_at', null),
                        Q.sortBy('transaction_date', Q.desc),
                        Q.take(1)
                    )
                    .fetch();

                const prevBalance = lastEntries.length > 0 ? (lastEntries[0].balanceRunning || 0) : 0;
                const newBalance = Number((prevBalance + offtakeAmount).toFixed(2));

                await db.get<AgriInvestorLedger>('agri_investor_ledgers').create(record => {
                    record.investorId = cycle.investorId!;
                    record.cropCycleId = cycle.id;
                    record.transactionDate = date;
                    record.type = 'harvest_offtake';
                    record.kilosReceived = netWeightKg;
                    record.pricePerKilo = offtakePrice;
                    record.amount = offtakeAmount;
                    record.balanceRunning = newBalance;
                    record.notes = `Weigh-in batch ${batchNumber} off-take delivery`;
                });
            }
        });

        if (!harvestLog) {
            throw new Error('Failed to record harvest weigh-in');
        }

        try {
            const cycle = await db.get<AgriCropCycle>('agri_crop_cycles').find(input.cropCycleId);
            const offtakePrice = cycle.offtakePricePerKg || 4.0;
            const grossRevenue = Number((netWeightKg * offtakePrice).toFixed(2));

            if (grossRevenue > 0) {
                await AutoPostingService.postAgriHarvestSale({
                    harvestLogId: (harvestLog as AgriHarvestLog).id,
                    cropCycleId: input.cropCycleId,
                    batchNumber,
                    netWeightKg,
                    pricePerKilo: offtakePrice,
                    grossRevenue,
                    harvestDate: date,
                    investorId: cycle.investorId,
                    postedBy: input.weighInSupervisor || 'system',
                });
            }
        } catch (postErr) {
            console.warn('[AgriHarvestService] Auto-post harvest sale warning:', postErr);
        }

        return harvestLog;
    }

    /**
     * Compute summary metrics for a crop cycle's harvest
     */
    static async getCycleHarvestSummary(
        cropCycleId: string,
        db: Database = globalDatabase
    ): Promise<HarvestSummary> {
        const logs = await db
            .get<AgriHarvestLog>('agri_harvest_logs')
            .query(
                Q.where('crop_cycle_id', cropCycleId),
                Q.where('deleted_at', null),
                Q.sortBy('harvest_date', Q.asc)
            )
            .fetch();

        if (logs.length === 0) {
            return {
                totalBatches: 0,
                totalGrossKg: 0,
                totalTareKg: 0,
                totalNetKg: 0,
                averageNetPerBatch: 0,
                firstHarvestDate: null,
                latestHarvestDate: null,
            };
        }

        const totalBatches = logs.length;
        const totalGrossKg = Number(logs.reduce((sum, l) => sum + (l.grossWeightKg || 0), 0).toFixed(2));
        const totalTareKg = Number(logs.reduce((sum, l) => sum + (l.tareWeightKg || 0), 0).toFixed(2));
        const totalNetKg = Number(logs.reduce((sum, l) => sum + (l.netWeightKg || 0), 0).toFixed(2));
        const averageNetPerBatch = Number((totalNetKg / totalBatches).toFixed(2));

        return {
            totalBatches,
            totalGrossKg,
            totalTareKg,
            totalNetKg,
            averageNetPerBatch,
            firstHarvestDate: logs[0].harvestDate,
            latestHarvestDate: logs[logs.length - 1].harvestDate,
        };
    }

    /**
     * Update an existing harvest weigh-in record
     */
    static async updateHarvestLog(
        log: AgriHarvestLog,
        data: {
            grossWeightKg?: number;
            tareWeightKg?: number;
            qualityGrade?: string;
            truckPlateNumber?: string | null;
            weighInSupervisor?: string | null;
            notes?: string | null;
        },
        db: Database = globalDatabase
    ): Promise<void> {
        const gross = data.grossWeightKg !== undefined ? data.grossWeightKg : log.grossWeightKg;
        const tare = data.tareWeightKg !== undefined ? data.tareWeightKg : log.tareWeightKg;
        const netWeightKg = this.calculateNetWeight(gross, tare);

        await db.write(async () => {
            await log.update(record => {
                if (data.grossWeightKg !== undefined) record.grossWeightKg = data.grossWeightKg;
                if (data.tareWeightKg !== undefined) record.tareWeightKg = data.tareWeightKg;
                record.netWeightKg = netWeightKg;
                if (data.qualityGrade !== undefined) record.qualityGrade = data.qualityGrade;
                if (data.truckPlateNumber !== undefined) record.truckPlateNumber = data.truckPlateNumber;
                if (data.weighInSupervisor !== undefined) record.weighInSupervisor = data.weighInSupervisor;
                if (data.notes !== undefined) record.notes = data.notes;
            });
        });
    }

    /**
     * Soft-delete a harvest weigh-in record
     */
    static async deleteHarvestLog(
        log: AgriHarvestLog,
        db: Database = globalDatabase
    ): Promise<void> {
        await db.write(async () => {
            await log.update(record => {
                record.deletedAt = new Date();
            });
        });
    }
}
export default AgriHarvestService;
