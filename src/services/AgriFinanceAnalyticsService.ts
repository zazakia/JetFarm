import { Database, Q } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import AgriCropCycle from '../database/models/AgriCropCycle';
import AgriWeeklySettlement from '../database/models/AgriWeeklySettlement';
import AgriLaborLog from '../database/models/AgriLaborLog';
import AgriFarmExpense from '../database/models/AgriFarmExpense';

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
}
export default AgriFinanceAnalyticsService;
