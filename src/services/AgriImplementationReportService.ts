import { Database, Q } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import AgriCropCycle from '../database/models/AgriCropCycle';
import AgriFarmExpense from '../database/models/AgriFarmExpense';
import AgriParcel from '../database/models/AgriParcel';
import { escapeHtml, money } from './reportFormatters';

export const BACALSO_BENCHMARK_HA = 3.45;
export const BACALSO_TOTAL_PLANNED_COST = 199222;

export interface BacalsoActivityDefinition {
    id: string;
    code: string;
    name: string;
    shortName: string;
    plannedCost345Ha: number;
    colIndex: number;
    theoreticalMonth: string;
    theoreticalDayStr: string;
    description: string;
}

export const BACALSO_ACTIVITIES_LIST: BacalsoActivityDefinition[] = [
    {
        id: 'mouldboard',
        code: 'MB / DP',
        name: 'Mouldboard / Disc Plow',
        shortName: 'Mouldboard',
        plannedCost345Ha: 10765,
        colIndex: 0,
        theoreticalMonth: 'JUN',
        theoreticalDayStr: '1',
        description: 'Deep tractor moldboard plowing & initial ground break.',
    },
    {
        id: 'harrow_1',
        code: 'HARROW 1',
        name: 'Harrow 1',
        shortName: 'Harrow 1',
        plannedCost345Ha: 22695,
        colIndex: 1,
        theoreticalMonth: 'JUN',
        theoreticalDayStr: '10',
        description: 'First harrowing & clod pulverization (30L diesel, 55h labor).',
    },
    {
        id: 'harrow_2',
        code: 'HARROW 2',
        name: 'Harrow 2',
        shortName: 'Harrow 2',
        plannedCost345Ha: 19005,
        colIndex: 2,
        theoreticalMonth: 'JUL',
        theoreticalDayStr: '13',
        description: 'Second pass harrowing for fine seedbed tilth (30L diesel, 33h labor).',
    },
    {
        id: 'furrow',
        code: 'FURROW',
        name: 'Furrow',
        shortName: 'Furrow',
        plannedCost345Ha: 20235,
        colIndex: 3,
        theoreticalMonth: 'JUL',
        theoreticalDayStr: '14',
        description: 'Tractor ridge furrowing at 0.8m–1m spacing (30L diesel, 40.5h labor).',
    },
    {
        id: 'planting',
        code: 'PLANTING',
        name: 'Planting (Pre & Post)',
        shortName: 'Planting',
        plannedCost345Ha: 40997,
        colIndex: 4,
        theoreticalMonth: 'JUL',
        theoreticalDayStr: '15-18',
        description: '750 bundles stalks (₱18,750), pakyawan labor (₱17,250), fee (₱2,250), diesel (₱2,747).',
    },
    {
        id: 'fertilization_1',
        code: '1ST FERT',
        name: '1st Fertilization',
        shortName: 'Fert 1',
        plannedCost345Ha: 30300,
        colIndex: 5,
        theoreticalMonth: 'JUL',
        theoreticalDayStr: '19-20',
        description: 'Basal mix: 5 bags Urea, 4 bags DAP 18-46-0, 2 bags Potash 0-0-60 + labor (11 bags @ ₱200).',
    },
    {
        id: 'herbicides_1',
        code: 'HERB 1 / WEED 1',
        name: 'Herbicides 1 / Weeding 1',
        shortName: 'Herbicide 1',
        plannedCost345Ha: 11325,
        colIndex: 6,
        theoreticalMonth: 'JUL',
        theoreticalDayStr: '27',
        description: 'Interline (6 units), 2,4-D Amine (1.5 units), Hoestick (1.5 units) + 6 drums spraying labor.',
    },
    {
        id: 'fertilization_2',
        code: '2ND FERT',
        name: '2nd Fertilization',
        shortName: 'Fert 2',
        plannedCost345Ha: 25200,
        colIndex: 7,
        theoreticalMonth: 'AUG',
        theoreticalDayStr: '55',
        description: 'Side-dress: 6 bags DAP, 3 bags Potash 0-0-60 + labor (9 bags @ ₱200).',
    },
    {
        id: 'herbicides_2',
        code: 'HERB 2',
        name: '2nd Herbicide Application',
        shortName: 'Herbicide 2',
        plannedCost345Ha: 13300,
        colIndex: 8,
        theoreticalMonth: 'SEP',
        theoreticalDayStr: '70',
        description: 'Interline (6 units), 2,4-D Amine (2 units), Hoestick (2 units) + 8 drums labor.',
    },
    {
        id: 'fertilization_3',
        code: '3RD FERT / WEED 2',
        name: '3rd Fertilization',
        shortName: 'Fert 3',
        plannedCost345Ha: 5400,
        colIndex: 9,
        theoreticalMonth: 'OCT',
        theoreticalDayStr: '90',
        description: 'Bulking finish: 2 bags Potash 0-0-60 + application labor.',
    },
    {
        id: 'brushing',
        code: 'MONITORING',
        name: 'Pre-Harvest Assessment & Monitoring',
        shortName: 'Monitoring',
        plannedCost345Ha: 0,
        colIndex: 10,
        theoreticalMonth: 'JAN',
        theoreticalDayStr: '210',
        description: 'Starch test sampling, perimeter clearing, pre-harvest road clearance.',
    },
    {
        id: 'harvesting',
        code: 'HARVESTING',
        name: 'Harvesting & Hauling to Mill',
        shortName: 'Harvesting',
        plannedCost345Ha: 0,
        colIndex: 11,
        theoreticalMonth: 'MAY',
        theoreticalDayStr: '270+',
        description: 'Root uprooting, cutting, weighing, bagging, and 10-wheeler trucking to mill.',
    },
];

export interface BacalsoFarmActivityRow {
    id: string;
    code: string;
    name: string;
    shortName: string;
    theoreticalDaysLabel: string;
    plannedCost: number;
    actualCost: number;
    varianceAmount: number;
    variancePercent: number;
    status: 'under_budget' | 'on_track' | 'over_budget';
    actualDatesLabel: string;
    actualExpenseCount: number;
}

export interface BacalsoReportResourceSummary {
    tractorCost: number;
    dieselTotalLiters: number;
    dieselCost: number;
    laborTotalCost: number;
    seedStalkBundles: number;
    ureaBags: number;
    dapBags: number;
    potashBags: number;
    interlineUnits: number;
    amineUnits: number;
    hoestickUnits: number;
}

export interface BacalsoFarmReportData {
    farmName: string;
    location: string;
    areaHa: number;
    cropCycleName: string;
    cycleId?: string;
    cycleCode?: string;
    plantingDate?: Date;
    targetHarvestDate?: Date | null;

    activities: BacalsoFarmActivityRow[];
    totalPlannedCost: number;
    totalActualCost: number;
    netCostVariance: number;

    totalCassavaHarvestGross: number;
    netIncomePlanned: number;
    netIncomeActual: number;

    months: string[];
    theoreticalMatrix: Record<string, string[]>;
    actualMatrix: Record<string, string[]>;

    resources: BacalsoReportResourceSummary;
}

export class AgriImplementationReportService {
    /**
     * Standard 13-month crop progression (JUN to JUN) as modeled in Bacalso Farm Schedule.
     */
    static getImplementationMonths(): string[] {
        return ['JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN'];
    }

    /**
     * Scales benchmark activities proportionally to any parcel size.
     * When areaHa = 3.45 ha, exactly equals ₱199,222.00.
     */
    static getBenchmarkActivities(areaHa: number = BACALSO_BENCHMARK_HA): Array<BacalsoActivityDefinition & { plannedCost: number }> {
        const safeArea = Math.max(0.01, areaHa);
        const scale = safeArea / BACALSO_BENCHMARK_HA;

        return BACALSO_ACTIVITIES_LIST.map((act) => ({
            ...act,
            plannedCost: Math.round(act.plannedCost345Ha * scale),
        }));
    }

    /**
     * Returns theoretical matrix of 13 month rows x 12 activity columns.
     */
    static getTheoreticalScheduleMatrix(): Record<string, string[]> {
        const months = this.getImplementationMonths();
        const matrix: Record<string, string[]> = {};

        for (const m of months) {
            matrix[m] = new Array(12).fill('');
        }

        // Exact plotted positions from the Bacalso Farm schedule
        matrix['JUN'][0] = '1';       // MB/DP Day 1
        matrix['JUN'][1] = '10';      // Harrow 1 Day 10
        matrix['JUL'][2] = '13';      // Harrow 2 Day 13
        matrix['JUL'][3] = '14';      // Furrow Day 14
        matrix['JUL'][4] = '15-18';   // Planting Day 15-18
        matrix['JUL'][5] = '19-20';   // 1st Fert Day 19-20
        matrix['JUL'][6] = '27';      // Herbicide 1 Day 27
        matrix['AUG'][7] = '55';      // 2nd Fert Day 55
        matrix['SEP'][8] = '70';      // Herbicide 2 Day 70
        matrix['OCT'][9] = '90';      // 3rd Fert Day 90
        matrix['JAN'][10] = '210';    // Monitoring Day 210
        matrix['MAY'][11] = '270+';   // Harvesting Day 270+

        return matrix;
    }

    /**
     * Map a raw farm expense to one of the 12 granular Bacalso Farm activities.
     */
    static mapExpenseToActivityId(expense: {
        category?: string;
        description?: string;
        expenseDate?: Date;
    }): string {
        const cat = (expense.category || '').toLowerCase();
        const desc = (expense.description || '').toLowerCase();

        // 1. Specific Keyword Matching
        if (desc.includes('mouldboard') || desc.includes('moldboard') || desc.includes('disc plow') || desc.includes('primary plow')) {
            return 'mouldboard';
        }
        if (desc.includes('harrow 2') || desc.includes('second harrow') || desc.includes('rotavat')) {
            return 'harrow_2';
        }
        if (desc.includes('harrow') || desc.includes('harrowing')) {
            return 'harrow_1';
        }
        if (desc.includes('furrow') || desc.includes('ridging')) {
            return 'furrow';
        }
        if (desc.includes('stalk') || desc.includes('seedling') || desc.includes('cutting') || desc.includes('pakyawan') || desc.includes('planting')) {
            return 'planting';
        }
        if (desc.includes('3rd fert') || desc.includes('potash') || desc.includes('0-0-60') || desc.includes('bulking')) {
            return 'fertilization_3';
        }
        if (desc.includes('2nd fert') || desc.includes('side dress') || desc.includes('side-dress')) {
            return 'fertilization_2';
        }
        if (desc.includes('1st fert') || desc.includes('basal') || desc.includes('14-14-14') || desc.includes('starter')) {
            return 'fertilization_1';
        }
        if (desc.includes('2nd herb') || desc.includes('herbicide 2') || desc.includes('post-emergence')) {
            return 'herbicides_2';
        }
        if (desc.includes('1st herb') || desc.includes('herbicide') || desc.includes('interline') || desc.includes('2,4-d') || desc.includes('hoestick')) {
            return 'herbicides_1';
        }
        if (desc.includes('brushing') || desc.includes('monitoring') || desc.includes('sample') || desc.includes('test')) {
            return 'brushing';
        }
        if (desc.includes('harvest') || desc.includes('trucking') || desc.includes('hauling') || desc.includes('mill') || desc.includes('sacks')) {
            return 'harvesting';
        }

        // 2. Category Fallbacks
        if (cat === 'tractor_equipment') return 'harrow_1';
        if (cat === 'seedlings') return 'planting';
        if (cat === 'fertilizer') return 'fertilization_1';
        if (cat === 'herbicide_pesticide') return 'herbicides_1';
        if (cat === 'transport') return 'harvesting';

        return 'harrow_1';
    }

    /**
     * Builds report data object aggregating expenses, variance, and Gantt actuals.
     */
    static buildReportData(options: {
        farmName?: string;
        location?: string;
        areaHa?: number;
        cropCycleName?: string;
        cycleId?: string;
        cycleCode?: string;
        plantingDate?: Date;
        targetHarvestDate?: Date | null;
        grossHarvest?: number;
        expenses: Array<{
            category?: string;
            description?: string;
            amount: number;
            expenseDate?: Date;
        }>;
    }): BacalsoFarmReportData {
        const areaHa = options.areaHa && options.areaHa > 0 ? options.areaHa : BACALSO_BENCHMARK_HA;
        const benchmarkActs = this.getBenchmarkActivities(areaHa);

        // Group actual expenses by activityId
        const actualMap: Record<string, { total: number; count: number; dates: string[] }> = {};
        for (const act of benchmarkActs) {
            actualMap[act.id] = { total: 0, count: 0, dates: [] };
        }

        for (const exp of options.expenses) {
            const actId = this.mapExpenseToActivityId(exp);
            if (!actualMap[actId]) {
                actualMap[actId] = { total: 0, count: 0, dates: [] };
            }
            actualMap[actId].total += exp.amount || 0;
            actualMap[actId].count += 1;
            if (exp.expenseDate) {
                const day = exp.expenseDate.getDate();
                const mo = exp.expenseDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                actualMap[actId].dates.push(`${mo} ${day}`);
            }
        }

        // Build activity rows with variance
        const activities: BacalsoFarmActivityRow[] = benchmarkActs.map((act) => {
            const actual = actualMap[act.id] || { total: 0, count: 0, dates: [] };
            const varianceAmount = actual.total - act.plannedCost;
            let variancePercent = 0;
            if (act.plannedCost > 0) {
                variancePercent = Number(((varianceAmount / act.plannedCost) * 100).toFixed(2));
            } else if (actual.total > 0) {
                variancePercent = 100;
            }

            let status: 'under_budget' | 'on_track' | 'over_budget' = 'on_track';
            if (varianceAmount > 100) status = 'over_budget';
            else if (varianceAmount < -100) status = 'under_budget';

            return {
                id: act.id,
                code: act.code,
                name: act.name,
                shortName: act.shortName,
                theoreticalDaysLabel: act.theoreticalDayStr,
                plannedCost: act.plannedCost,
                actualCost: actual.total,
                varianceAmount,
                variancePercent,
                status,
                actualDatesLabel: actual.dates.slice(0, 2).join(', '),
                actualExpenseCount: actual.count,
            };
        });

        const totalPlannedCost = activities.reduce((sum, a) => sum + a.plannedCost, 0);
        const totalActualCost = activities.reduce((sum, a) => sum + a.actualCost, 0);
        const netCostVariance = totalActualCost - totalPlannedCost;

        // Gross harvest benchmark: scaled ₱550,000 for 3.45 ha (approx ₱159,420 / ha)
        const totalCassavaHarvestGross = options.grossHarvest !== undefined
            ? options.grossHarvest
            : Math.round(550000 * (areaHa / BACALSO_BENCHMARK_HA));

        const netIncomePlanned = totalCassavaHarvestGross - totalPlannedCost;
        const netIncomeActual = totalCassavaHarvestGross - totalActualCost;

        const months = this.getImplementationMonths();
        const theoreticalMatrix = this.getTheoreticalScheduleMatrix();

        // Actual schedule matrix: maps actual expense dates to month rows
        const actualMatrix: Record<string, string[]> = {};
        for (const m of months) {
            actualMatrix[m] = new Array(12).fill('');
        }

        for (const exp of options.expenses) {
            if (exp.expenseDate) {
                const mo = exp.expenseDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
                const day = exp.expenseDate.getDate();
                const actId = this.mapExpenseToActivityId(exp);
                const act = benchmarkActs.find((a) => a.id === actId);
                if (act && actualMatrix[mo]) {
                    const existing = actualMatrix[mo][act.colIndex];
                    actualMatrix[mo][act.colIndex] = existing ? `${existing}, ${day}` : `${day}`;
                }
            }
        }

        // Scale resource usage
        const scale = areaHa / BACALSO_BENCHMARK_HA;
        const resources: BacalsoReportResourceSummary = {
            tractorCost: Math.round((10765 + 12075 * 3) * scale),
            dieselTotalLiters: Math.round((30 + 30 + 30 + 41) * scale),
            dieselCost: Math.round((2010 * 3 + 2747) * scale),
            laborTotalCost: Math.round((8610 + 4920 + 6150 + 19500 + 2200 + 1800 + 2200 + 4800 + 6400) * scale),
            seedStalkBundles: Math.round(750 * scale),
            ureaBags: Math.round(5 * scale),
            dapBags: Math.round(10 * scale),
            potashBags: Math.round(7 * scale),
            interlineUnits: Math.round(12 * scale),
            amineUnits: Math.round(3.5 * scale),
            hoestickUnits: Math.round(3.5 * scale),
        };

        return {
            farmName: options.farmName || 'BACALSO FARM',
            location: options.location || 'ALAE, BUKIDNON',
            areaHa,
            cropCycleName: options.cropCycleName || '1ST CROP',
            cycleId: options.cycleId,
            cycleCode: options.cycleCode,
            plantingDate: options.plantingDate,
            targetHarvestDate: options.targetHarvestDate,
            activities,
            totalPlannedCost,
            totalActualCost,
            netCostVariance,
            totalCassavaHarvestGross,
            netIncomePlanned,
            netIncomeActual,
            months,
            theoreticalMatrix,
            actualMatrix,
            resources,
        };
    }

    /**
     * Live database analysis for an active crop cycle record.
     */
    static async generateReportForCycle(
        cycleId: string,
        db: Database = globalDatabase
    ): Promise<BacalsoFarmReportData> {
        const cycle = await db.get<AgriCropCycle>('agri_crop_cycles').find(cycleId);
        let parcelName = 'Bacalso Parcel';
        let location = 'Alae, Bukidnon';

        if (cycle.parcelId) {
            try {
                const parcel = await db.get<AgriParcel>('agri_parcels').find(cycle.parcelId);
                parcelName = parcel.name || parcelName;
                location = parcel.locationAddress || location;
            } catch {
                // keep defaults
            }
        }

        const expenses = await db
            .get<AgriFarmExpense>('agri_farm_expenses')
            .query(
                Q.where('crop_cycle_id', cycleId),
                Q.where('deleted_at', null)
            )
            .fetch();

        const plantingDate = cycle.plantingDate ? new Date(cycle.plantingDate) : new Date();
        const targetHarvestDate = cycle.targetHarvestDate ? new Date(cycle.targetHarvestDate) : null;
        const areaHa = cycle.areaPlantedHa || BACALSO_BENCHMARK_HA;

        return this.buildReportData({
            farmName: parcelName.toUpperCase(),
            location: location.toUpperCase(),
            areaHa,
            cropCycleName: (cycle.cycleCode || '1st Crop').toUpperCase(),
            cycleId: cycle.id,
            cycleCode: cycle.cycleCode,
            plantingDate,
            targetHarvestDate,
            expenses: expenses.map((e) => ({
                category: e.category,
                description: e.description,
                amount: e.amount || 0,
                expenseDate: e.expenseDate ? new Date(e.expenseDate) : undefined,
            })),
        });
    }

    /**
     * Generates print-ready HTML matching the paper report layout with full CSS.
     */
    static generateBacalsoFarmReportHtml(data: BacalsoFarmReportData): string {
        const titleBanner = `${escapeHtml(data.farmName)}<br/>${data.areaHa.toFixed(2)} HA IN ${escapeHtml(data.location)}<br/>${escapeHtml(data.cropCycleName)}`;

        // Build Summary Table Rows (Top Left)
        const summaryRowsHtml = data.activities.map((act) => `
            <tr>
                <td style="font-weight: 600; text-transform: uppercase;">${escapeHtml(act.name)}</td>
                <td style="text-align: right; font-family: monospace;">${money(act.plannedCost)}</td>
                <td style="text-align: right; font-family: monospace;">${money(act.actualCost)}</td>
            </tr>
        `).join('');

        // Build Header Columns for the Gantt Grid
        const colHeadersHtml = data.activities.map((act) => `
            <th style="font-size: 8px; text-align: center; border: 1px solid #94a3b8; padding: 4px;">
                ${escapeHtml(act.code)}<br/><span style="color: #64748b; font-weight: normal;">Day ${escapeHtml(act.theoreticalDaysLabel)}</span>
            </th>
        `).join('');

        // Section A: Theoretical Month Rows
        const theorRowsHtml = data.months.map((m) => {
            const cells = data.theoreticalMatrix[m] || new Array(12).fill('');
            const cellsHtml = cells.map((c) => `
                <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1; padding: 2px 4px; font-size: 9px; ${c ? 'background: #f1f5f9; color: #047857;' : ''}">
                    ${escapeHtml(c)}
                </td>
            `).join('');

            return `
                <tr>
                    <td style="font-weight: bold; text-align: center; border: 1px solid #cbd5e1; font-size: 8px; background: #f8fafc;">${m}</td>
                    ${cellsHtml}
                </tr>
            `;
        }).join('');

        // Section B: Actual Month Rows
        const actualRowsHtml = data.months.map((m) => {
            const cells = data.actualMatrix[m] || new Array(12).fill('');
            const cellsHtml = cells.map((c) => `
                <td style="text-align: center; font-weight: bold; border: 1px solid #cbd5e1; padding: 2px 4px; font-size: 9px; ${c ? 'background: #ecfdf5; color: #065f46;' : ''}">
                    ${escapeHtml(c)}
                </td>
            `).join('');

            return `
                <tr>
                    <td style="font-weight: bold; text-align: center; border: 1px solid #cbd5e1; font-size: 8px; background: #f8fafc;">${m}</td>
                    ${cellsHtml}
                </tr>
            `;
        }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>${escapeHtml(data.farmName)} - Implementation Schedule & Financial Report</title>
    <style>
        @page { size: landscape; margin: 8mm; }
        * { box-sizing: border-box; }
        body {
            font-family: Arial, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 9px;
            color: #0f172a;
            margin: 0;
            padding: 10px;
            background: #ffffff;
        }
        .banner-container {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 12px;
        }
        .banner {
            background-color: #84cc16;
            color: #14532d;
            font-weight: 800;
            text-align: center;
            padding: 8px 30px;
            border-radius: 4px;
            font-size: 13px;
            line-height: 1.3;
            letter-spacing: 0.5px;
        }
        .top-section {
            display: flex;
            gap: 16px;
            margin-bottom: 14px;
        }
        .summary-card {
            flex: 0 0 380px;
            border: 1px solid #94a3b8;
            border-radius: 4px;
            overflow: hidden;
        }
        .summary-header {
            background: #fed7aa;
            font-weight: 800;
            text-align: center;
            padding: 5px;
            font-size: 11px;
            border-bottom: 1px solid #f97316;
            letter-spacing: 0.5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            border: 1px solid #cbd5e1;
            padding: 4px 6px;
            font-size: 8.5px;
        }
        .highlight-yellow {
            background-color: #fef08a !important;
            font-weight: 800 !important;
        }
        .highlight-green {
            background-color: #bbf7d0 !important;
            font-weight: 800 !important;
        }
        .schedule-table-card {
            flex: 1;
            border: 1px solid #94a3b8;
            border-radius: 4px;
            overflow: hidden;
        }
        .section-header {
            background: #e2e8f0;
            font-weight: 800;
            padding: 4px 8px;
            font-size: 9px;
            letter-spacing: 0.5px;
        }
        .resource-card {
            margin-top: 10px;
            border: 1px solid #94a3b8;
            border-radius: 4px;
            padding: 8px;
            background: #f8fafc;
        }
        .resource-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 8px;
        }
        .resource-item {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 6px;
        }
        .resource-label {
            font-size: 7.5px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: bold;
        }
        .resource-val {
            font-size: 11px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 2px;
        }
        @media print {
            body { padding: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="banner-container">
        <div class="banner">
            ${titleBanner}
        </div>
    </div>

    <div class="top-section">
        <!-- Top Left: Financial Summary Box (Exact paper replica) -->
        <div class="summary-card">
            <div class="summary-header">SUMMARY OF EXPENSES & P&amp;L</div>
            <table>
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th>Operational Stage</th>
                        <th style="text-align: right;">Planned (₱)</th>
                        <th style="text-align: right;">Actual (₱)</th>
                    </tr>
                </thead>
                <tbody>
                    ${summaryRowsHtml}
                    <tr class="highlight-yellow">
                        <td>TOTAL COST</td>
                        <td style="text-align: right;">${money(data.totalPlannedCost)}</td>
                        <td style="text-align: right;">${money(data.totalActualCost)}</td>
                    </tr>
                    <tr>
                        <td colspan="3" style="height: 6px; background: #f8fafc; border: none;"></td>
                    </tr>
                    <tr style="background: #f8fafc;">
                        <td><strong>TOTAL CASSAVA HARVEST (GROSS)</strong></td>
                        <td style="text-align: right; font-weight: bold;">${money(data.totalCassavaHarvestGross)}</td>
                        <td style="text-align: right; font-weight: bold;">${money(data.totalCassavaHarvestGross)}</td>
                    </tr>
                    <tr>
                        <td>Less Total Cost</td>
                        <td style="text-align: right;">-${money(data.totalPlannedCost)}</td>
                        <td style="text-align: right;">-${money(data.totalActualCost)}</td>
                    </tr>
                    <tr class="highlight-green">
                        <td><strong>NET INCOME</strong></td>
                        <td style="text-align: right; color: #14532d;">${money(data.netIncomePlanned)}</td>
                        <td style="text-align: right; color: #14532d;">${money(data.netIncomeActual)}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Right: Matrix Schedule (A. Theoretical & B. Actual across 13 months) -->
        <div class="schedule-table-card">
            <div class="section-header">SCHEDULE OF IMPLEMENTATION (THEORETICAL OR PLANNED VS ACTUAL)</div>
            <table>
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="width: 45px; text-align: center;">Month</th>
                        ${colHeadersHtml}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colspan="13" class="section-header" style="background: #e0f2fe; color: #0369a1;">
                            A. THEORETICAL SCHEDULE (TARGET TIMELINE DAYS)
                        </td>
                    </tr>
                    ${theorRowsHtml}
                    <tr>
                        <td colspan="13" class="section-header" style="background: #ecfdf5; color: #047857;">
                            B. ACTUAL SCHEDULE (RECORDED FIELD EXECUTION DATES)
                        </td>
                    </tr>
                    ${actualRowsHtml}
                </tbody>
            </table>
        </div>
    </div>

    <!-- Bottom: Resource Usage Quantities -->
    <div class="resource-card">
        <div style="font-weight: 800; font-size: 9px; text-transform: uppercase; margin-bottom: 6px; color: #334155;">
            Resource Inputs &amp; Quantities Matrix (${data.areaHa.toFixed(2)} Ha Benchmark)
        </div>
        <div class="resource-grid">
            <div class="resource-item">
                <div class="resource-label">Diesel Total</div>
                <div class="resource-val">${data.resources.dieselTotalLiters.toLocaleString()} Liters</div>
                <div style="font-size: 7.5px; color: #64748b;">${money(data.resources.dieselCost)}</div>
            </div>
            <div class="resource-item">
                <div class="resource-label">Seed Stalks</div>
                <div class="resource-val">${data.resources.seedStalkBundles.toLocaleString()} Bundles</div>
                <div style="font-size: 7.5px; color: #64748b;">₱25.00 / bundle</div>
            </div>
            <div class="resource-item">
                <div class="resource-label">Urea (46-0-0)</div>
                <div class="resource-val">${data.resources.ureaBags} Bags</div>
                <div style="font-size: 7.5px; color: #64748b;">₱2,500 / bag</div>
            </div>
            <div class="resource-item">
                <div class="resource-label">DAP (18-46-0)</div>
                <div class="resource-val">${data.resources.dapBags} Bags</div>
                <div style="font-size: 7.5px; color: #64748b;">₱3,100 / bag</div>
            </div>
            <div class="resource-item">
                <div class="resource-label">Potash (0-0-60)</div>
                <div class="resource-val">${data.resources.potashBags} Bags</div>
                <div style="font-size: 7.5px; color: #64748b;">₱1,600 / bag</div>
            </div>
            <div class="resource-item">
                <div class="resource-label">Herbicides</div>
                <div class="resource-val">${data.resources.interlineUnits} Interline</div>
                <div style="font-size: 7.5px; color: #64748b;">+ ${data.resources.amineUnits} 2,4-D + ${data.resources.hoestickUnits} Hoestick</div>
            </div>
        </div>
    </div>
</body>
</html>`;
    }
}
