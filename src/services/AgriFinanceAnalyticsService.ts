import { Database, Q } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import AgriCropCycle from '../database/models/AgriCropCycle';
import AgriWeeklySettlement from '../database/models/AgriWeeklySettlement';
import AgriLaborLog from '../database/models/AgriLaborLog';
import AgriFarmExpense from '../database/models/AgriFarmExpense';
import JournalEntry from '../database/models/JournalEntry';
import JournalEntryLine from '../database/models/JournalEntryLine';

export interface CyclePnLResult {
    cropCycleId?: string;
    totalYieldKg: number;
    offtakePricePerKg: number;
    grossRevenue: number;
    landOwnerSettlementCost: number;
    laborCost: number;
    farmExpenses: number;
    totalExpenses: number;
    netMargin: number;
    profitMarginPercent: number;
    costPerHectare: number;
    costPerKilo: number;
    revenuePerHectare: number;
    yieldPerHectareTons: number;
}

export interface AgriGLSummaryResult {
    totalRevenue: number;
    landOwnerSettlementCost: number;
    laborCost: number;
    farmInputExpenses: number;
    totalExpenses: number;
    netSurplus: number;
    biologicalAssetsValue: number;
    produceInventoryValue: number;
    suppliesInventoryValue: number;
    landOwnerPayable: number;
    farmLaborPayable: number;
    investorPartnerEquity: number;
    journalEntryCount: number;
}

export interface YieldForecastResult {
    areaHectares: number;
    variety: string;
    healthCondition: string;
    expectedTonsPerHa: number;
    projectedYieldKg: number;
    projectedYieldRangeKg: { min: number; max: number };
    projectedGrossRevenue: number;
}

export class AgriFinanceAnalyticsService {
    /**
     * Pure calculation for Crop Cycle P&L and unit economics
     */
    static calculateCyclePnL(
        cycleYieldKg: number,
        offtakePricePerKg: number,
        landOwnerSettlementCost: number,
        laborCost: number,
        farmExpenses: number,
        areaHectares: number
    ): CyclePnLResult {
        const yieldKg = Math.max(0, cycleYieldKg || 0);
        const price = Math.max(0, offtakePricePerKg || 0);
        const area = Math.max(0.0001, areaHectares || 1);

        const grossRevenue = Number((yieldKg * price).toFixed(2));
        const totalExpenses = Number((landOwnerSettlementCost + laborCost + farmExpenses).toFixed(2));
        const netMargin = Number((grossRevenue - totalExpenses).toFixed(2));

        const profitMarginPercent = grossRevenue > 0
            ? Number(((netMargin / grossRevenue) * 100).toFixed(2))
            : 0;

        const costPerHectare = Number((totalExpenses / area).toFixed(2));
        const costPerKilo = yieldKg > 0 ? Number((totalExpenses / yieldKg).toFixed(2)) : 0;
        const revenuePerHectare = Number((grossRevenue / area).toFixed(2));
        const yieldPerHectareTons = Number(((yieldKg / 1000) / area).toFixed(2));

        return {
            totalYieldKg: yieldKg,
            offtakePricePerKg: price,
            grossRevenue,
            landOwnerSettlementCost: Number(landOwnerSettlementCost.toFixed(2)),
            laborCost: Number(laborCost.toFixed(2)),
            farmExpenses: Number(farmExpenses.toFixed(2)),
            totalExpenses,
            netMargin,
            profitMarginPercent,
            costPerHectare,
            costPerKilo,
            revenuePerHectare,
            yieldPerHectareTons,
        };
    }

    /**
     * Fetch actual data for a crop cycle from database and compute P&L
     */
    static async getCropCyclePnL(
        cropCycleId: string,
        db: Database = globalDatabase
    ): Promise<CyclePnLResult> {
        const cycle = await db.get<AgriCropCycle>('agri_crop_cycles').find(cropCycleId);

        // 1. Settlements
        const settlements = await db
            .get<AgriWeeklySettlement>('agri_weekly_settlements')
            .query(
                Q.where('crop_cycle_id', cropCycleId),
                Q.where('deleted_at', null)
            )
            .fetch();

        const landOwnerSettlementCost = settlements
            .filter(s => s.paymentStatus !== 'rejected')
            .reduce((acc, s) => acc + (s.netPayoutDueThisWeek || 0), 0);

        // 2. Labor
        const laborLogs = await db
            .get<AgriLaborLog>('agri_labor_logs')
            .query(
                Q.where('crop_cycle_id', cropCycleId),
                Q.where('deleted_at', null)
            )
            .fetch();

        const laborCost = laborLogs.reduce((acc, l) => acc + (l.totalPay || 0), 0);

        // 3. Expenses
        const expenses = await db
            .get<AgriFarmExpense>('agri_farm_expenses')
            .query(
                Q.where('crop_cycle_id', cropCycleId),
                Q.where('deleted_at', null)
            )
            .fetch();

        const farmExpenses = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);

        const result = this.calculateCyclePnL(
            cycle.totalActualYieldKg || 0,
            cycle.offtakePricePerKg || 4.0,
            landOwnerSettlementCost,
            laborCost,
            farmExpenses,
            cycle.areaPlantedHa || 1
        );

        result.cropCycleId = cropCycleId;
        return result;
    }

    /**
     * Forecast cassava yield and revenue based on acreage and health stage
     */
    static forecastYield(
        areaHectares: number,
        healthCondition: string = 'good',
        offtakePricePerKg: number = 4.0,
        variety: string = 'Golden Yellow'
    ): YieldForecastResult {
        const safeArea = Math.max(0, areaHectares || 0);

        let tonsPerHa = 25; // default good
        let rangeTons = { min: 22, max: 28 };

        switch (healthCondition) {
            case 'excellent':
                tonsPerHa = 30;
                rangeTons = { min: 28, max: 35 };
                break;
            case 'good':
                tonsPerHa = 25;
                rangeTons = { min: 22, max: 28 };
                break;
            case 'fair':
                tonsPerHa = 18;
                rangeTons = { min: 15, max: 21 };
                break;
            case 'pest_risk':
            case 'diseased':
                tonsPerHa = 12;
                rangeTons = { min: 8, max: 15 };
                break;
        }

        const projectedYieldKg = Number((safeArea * tonsPerHa * 1000).toFixed(2));
        const projectedYieldRangeKg = {
            min: Number((safeArea * rangeTons.min * 1000).toFixed(2)),
            max: Number((safeArea * rangeTons.max * 1000).toFixed(2)),
        };
        const projectedGrossRevenue = Number((projectedYieldKg * offtakePricePerKg).toFixed(2));

        return {
            areaHectares: safeArea,
            variety,
            healthCondition,
            expectedTonsPerHa: tonsPerHa,
            projectedYieldKg,
            projectedYieldRangeKg,
            projectedGrossRevenue,
        };
    }

    /**
     * Compute real-time General Ledger balance summary for the Agribusiness Domain
     */
    static async getAgriGeneralLedgerSummary(
        db: Database = globalDatabase
    ): Promise<AgriGLSummaryResult> {
        const lines = await db
            .get<JournalEntryLine>('journal_entry_lines')
            .query(Q.where('deleted_at', null))
            .fetch();

        let totalRevenue = 0;
        let landOwnerSettlementCost = 0;
        let laborCost = 0;
        let farmInputExpenses = 0;
        let biologicalAssetsValue = 0;
        let produceInventoryValue = 0;
        let suppliesInventoryValue = 0;
        let landOwnerPayable = 0;
        let farmLaborPayable = 0;
        let investorPartnerEquity = 0;
        const entryIdSet = new Set<string>();

        for (const line of lines) {
            const code = line.accountCode;
            const isAgriUnit = line.businessUnitId === 'agribusiness';
            const isAgriCode = [
                '1240', '1245', '1246',
                '2035', '2036',
                '3015',
                '4140', '4145',
                '5160', '5161', '5162', '5163', '5164', '5165', '5166', '5167', '5168', '5169'
            ].includes(code);

            if (isAgriUnit || isAgriCode) {
                entryIdSet.add(line.journalEntryId);

                const dr = line.debitAmount || 0;
                const cr = line.creditAmount || 0;

                if (code === '4140' || code === '4145') {
                    totalRevenue += (cr - dr);
                } else if (code === '5160') {
                    landOwnerSettlementCost += (dr - cr);
                } else if (code === '5161') {
                    laborCost += (dr - cr);
                } else if (code.startsWith('516') || (isAgriUnit && code.startsWith('5'))) {
                    farmInputExpenses += (dr - cr);
                } else if (code === '1240') {
                    biologicalAssetsValue += (dr - cr);
                } else if (code === '1245') {
                    produceInventoryValue += (dr - cr);
                } else if (code === '1246') {
                    suppliesInventoryValue += (dr - cr);
                } else if (code === '2035') {
                    landOwnerPayable += (cr - dr);
                } else if (code === '2036') {
                    farmLaborPayable += (cr - dr);
                } else if (code === '3015') {
                    investorPartnerEquity += (cr - dr);
                }
            }
        }

        const totalExpenses = Number((landOwnerSettlementCost + laborCost + farmInputExpenses).toFixed(2));
        const netSurplus = Number((totalRevenue - totalExpenses).toFixed(2));

        return {
            totalRevenue: Number(totalRevenue.toFixed(2)),
            landOwnerSettlementCost: Number(landOwnerSettlementCost.toFixed(2)),
            laborCost: Number(laborCost.toFixed(2)),
            farmInputExpenses: Number(farmInputExpenses.toFixed(2)),
            totalExpenses,
            netSurplus,
            biologicalAssetsValue: Number(biologicalAssetsValue.toFixed(2)),
            produceInventoryValue: Number(produceInventoryValue.toFixed(2)),
            suppliesInventoryValue: Number(suppliesInventoryValue.toFixed(2)),
            landOwnerPayable: Number(landOwnerPayable.toFixed(2)),
            farmLaborPayable: Number(farmLaborPayable.toFixed(2)),
            investorPartnerEquity: Number(investorPartnerEquity.toFixed(2)),
            journalEntryCount: entryIdSet.size,
        };
    }

    /**
     * Fetch all Journal Entries and line items tied to a specific Crop Cycle
     */
    static async getCropCycleJournalEntries(
        cropCycleId: string,
        db: Database = globalDatabase
    ): Promise<Array<{ entry: JournalEntry; lines: JournalEntryLine[] }>> {
        const matchingLines = await db
            .get<JournalEntryLine>('journal_entry_lines')
            .query(
                Q.where('deleted_at', null),
                Q.where('module_source_id', cropCycleId)
            )
            .fetch();

        const entryIdSet = new Set<string>(matchingLines.map(l => l.journalEntryId));
        const results: Array<{ entry: JournalEntry; lines: JournalEntryLine[] }> = [];

        for (const entryId of entryIdSet) {
            try {
                const entry = await db.get<JournalEntry>('journal_entries').find(entryId);
                const lines = await db
                    .get<JournalEntryLine>('journal_entry_lines')
                    .query(
                        Q.where('deleted_at', null),
                        Q.where('journal_entry_id', entryId)
                    )
                    .fetch();
                results.push({ entry, lines });
            } catch {
                // Ignore missing entry
            }
        }

        return results;
    }
}
export default AgriFinanceAnalyticsService;
