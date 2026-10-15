import { Database, Q } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import AgriCropCycle from '../database/models/AgriCropCycle';
import AgriFarmExpense from '../database/models/AgriFarmExpense';
import AgriGrowthCheckin from '../database/models/AgriGrowthCheckin';
import AgriParcel from '../database/models/AgriParcel';

export interface FarmingStepDefinition {
    id: string;
    stepNumber: number;
    name: string;
    shortName: string;
    timelineDays: string;
    startDay: number;
    endDay: number;
    plannedBudgetPerHa: number;
    totalPlannedBudget: number;
    targetStage: string;
    description: string;
    relevantCategories: string[];
    typicalActivities: string[];
}

export type StepStatus = 'upcoming' | 'in_progress' | 'completed' | 'overdue';
export type BudgetStatus = 'under_budget' | 'on_track' | 'over_budget';

export interface StepVarianceResult {
    varianceAmount: number;
    variancePercent: number;
    budgetStatus: BudgetStatus;
}

export interface FarmingStepComparison {
    stepNumber: number;
    id: string;
    name: string;
    timelineDays: string;
    targetStage: string;
    plannedBudget: number;
    actualExpenses: number;
    varianceAmount: number;
    variancePercent: number;
    budgetStatus: BudgetStatus;
    stepStatus: StepStatus;
    expenseCount: number;
    matchingExpenses?: AgriFarmExpense[];
}

export interface CycleStepsSummary {
    cycleId?: string;
    cycleCode?: string;
    cropType?: string;
    areaPlantedHa: number;
    totalPlannedBudget: number;
    totalActualExpenses: number;
    netVariance: number;
    budgetBurnRatePercent: number;
    currentStepNumber: number;
    currentStepName: string;
    daysElapsed: number;
    daysRemaining: number;
    completedStepsCount: number;
    activeStepsCount: number;
    upcomingStepsCount: number;
    steps: FarmingStepComparison[];
}

/**
 * Benchmark Cassava farming steps in the Philippines (Mindanao/Visayas commercial standard).
 * Total standard planned budget: ₱80,000 / hectare across 270-day growth cycle.
 */
const BASE_FARMING_STEPS: Omit<FarmingStepDefinition, 'totalPlannedBudget'>[] = [
    {
        id: 'land_prep',
        stepNumber: 1,
        name: 'Land Preparation & Tillage',
        shortName: 'Land Prep',
        timelineDays: 'Days -20 to 0',
        startDay: -20,
        endDay: 0,
        plannedBudgetPerHa: 15000,
        targetStage: 'land_prep',
        description: 'Tractor plowing (2 passes), rotavation, harrowing, and furrows ridging.',
        relevantCategories: ['tractor_equipment', 'fuel_oil', 'labor'],
        typicalActivities: ['Primary plowing', 'Rotary tilling', 'Ridging/furrowing', 'Perimeter drainage ditching'],
    },
    {
        id: 'planting_staking',
        stepNumber: 2,
        name: 'Seed Stalk Sourcing & Staking',
        shortName: 'Planting',
        timelineDays: 'Days 0 to 15',
        startDay: 0,
        endDay: 15,
        plannedBudgetPerHa: 10000,
        targetStage: 'germination',
        description: 'Quality stalk sourcing (Golden Yellow/KU50), 20cm cutting, stem treatment, and field planting.',
        relevantCategories: ['seedlings', 'tools', 'labor'],
        typicalActivities: ['Seed stem bundling', 'Stake cutting & disinfection', 'Field planting (1m x 0.8m)'],
    },
    {
        id: 'basal_weed_control',
        stepNumber: 3,
        name: 'Basal Fertilization & Weed Control',
        shortName: 'Basal & Weed',
        timelineDays: 'Days 15 to 45',
        startDay: 15,
        endDay: 45,
        plannedBudgetPerHa: 14000,
        targetStage: 'germination',
        description: 'Complete fertilizer (14-14-14) application and early pre/post-emergence weed suppression.',
        relevantCategories: ['fertilizer', 'herbicide_pesticide', 'labor'],
        typicalActivities: ['Pre-emergence herbicide spraying', 'Basal granular fertilizer placement', 'Spot hand weeding'],
    },
    {
        id: 'vegetative_side_dress',
        stepNumber: 4,
        name: 'Vegetative Care & Side-Dress',
        shortName: 'Vegetative Care',
        timelineDays: 'Days 45 to 90',
        startDay: 45,
        endDay: 90,
        plannedBudgetPerHa: 11000,
        targetStage: 'vegetative',
        description: 'Urea (46-0-0) side-dress fertilization, inter-row cultivating, and canopy management.',
        relevantCategories: ['fertilizer', 'herbicide_pesticide', 'labor'],
        typicalActivities: ['Side-dress nitrogen application', 'Inter-row cultivation', 'Pest & mite scouting'],
    },
    {
        id: 'root_bulking',
        stepNumber: 5,
        name: 'Root Bulking & Tuber Development',
        shortName: 'Root Bulking',
        timelineDays: 'Days 90 to 180',
        startDay: 90,
        endDay: 180,
        plannedBudgetPerHa: 8000,
        targetStage: 'root_bulking',
        description: 'Muriate of Potash (0-0-60) for starch bulking and rainy season drainage maintenance.',
        relevantCategories: ['fertilizer', 'labor', 'miscellaneous'],
        typicalActivities: ['Potash fertilizer application', 'Erosion checking', 'Selective weed rogueing'],
    },
    {
        id: 'pre_harvest',
        stepNumber: 6,
        name: 'Pre-Harvest Assessment & Field Prep',
        shortName: 'Pre-Harvest',
        timelineDays: 'Days 180 to 270',
        startDay: 180,
        endDay: 270,
        plannedBudgetPerHa: 4000,
        targetStage: 'maturity',
        description: 'Root sampling for starch density, access road clearance, and harvesting labor staging.',
        relevantCategories: ['tools', 'transport', 'miscellaneous'],
        typicalActivities: ['Starch content test digging', 'Field perimeter clearing', 'Hauler & buyer booking'],
    },
    {
        id: 'harvest_hauling',
        stepNumber: 7,
        name: 'Harvesting, Cleaning & Hauling to Mill',
        shortName: 'Harvest & Haul',
        timelineDays: 'Days 270+',
        startDay: 270,
        endDay: 360,
        plannedBudgetPerHa: 18000,
        targetStage: 'maturity',
        description: 'Manual/mechanical tuber uprooting, cutting, weighing, bagging, and 10-wheeler trucking.',
        relevantCategories: ['transport', 'labor', 'miscellaneous'],
        typicalActivities: ['Stalk topping & saving for seed', 'Root uprooting', 'De-rooting and sorting', 'Truck loading & mill delivery'],
    },
];

export class AgriFarmingStepsService {
    /**
     * Get benchmark farming step definitions scaled to planted area.
     */
    static getStandardFarmingSteps(areaHa: number = 1.0): FarmingStepDefinition[] {
        const safeArea = Math.max(0.01, areaHa);
        return BASE_FARMING_STEPS.map((step) => ({
            ...step,
            totalPlannedBudget: Math.round(step.plannedBudgetPerHa * safeArea),
        }));
    }

    /**
     * Determine active step based on days elapsed from planting date.
     */
    static determineCycleCurrentStep(plantingDate: Date, currentDate: Date = new Date()): number {
        const diffMs = currentDate.getTime() - plantingDate.getTime();
        const daysElapsed = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (daysElapsed < 0) return 1;
        if (daysElapsed <= 15) return 2;
        if (daysElapsed <= 45) return 3;
        if (daysElapsed <= 90) return 4;
        if (daysElapsed <= 180) return 5;
        if (daysElapsed <= 270) return 6;
        return 7;
    }

    /**
     * Calculate variance between planned and actual budget for a step.
     */
    static calculateStepVariance(plannedAmount: number, actualAmount: number): StepVarianceResult {
        const varianceAmount = actualAmount - plannedAmount;
        let variancePercent = 0;

        if (plannedAmount > 0) {
            variancePercent = Number(((varianceAmount / plannedAmount) * 100).toFixed(2));
        } else if (actualAmount > 0) {
            variancePercent = 100;
        }

        let budgetStatus: BudgetStatus = 'on_track';
        if (varianceAmount > 100) {
            budgetStatus = 'over_budget';
        } else if (varianceAmount < -100) {
            budgetStatus = 'under_budget';
        }

        return {
            varianceAmount,
            variancePercent,
            budgetStatus,
        };
    }

    /**
     * Map a single farm expense to its corresponding farming step (1 to 7).
     */
    static mapExpenseToFarmingStep(expense: {
        category: string;
        description: string;
        expenseDate?: Date;
        plantingDate?: Date;
    }): number {
        const cat = (expense.category || '').toLowerCase();
        const desc = (expense.description || '').toLowerCase();

        // 1. Keyword-based precision matching
        if (
            cat === 'tractor_equipment' ||
            desc.includes('plow') ||
            desc.includes('rotavat') ||
            desc.includes('land prep') ||
            desc.includes('furrow') ||
            desc.includes('tillage')
        ) {
            return 1;
        }

        if (
            cat === 'seedlings' ||
            desc.includes('seed') ||
            desc.includes('stalk') ||
            desc.includes('cuttings') ||
            desc.includes('staking') ||
            desc.includes('planting labor')
        ) {
            return 2;
        }

        if (
            desc.includes('trucking') ||
            desc.includes('hauling') ||
            desc.includes('mill') ||
            desc.includes('harvest') ||
            desc.includes('uproot') ||
            desc.includes('sacks')
        ) {
            return 7;
        }

        if (desc.includes('pre-harvest') || desc.includes('sample') || desc.includes('road clear')) {
            return 6;
        }

        if (desc.includes('potash') || desc.includes('0-0-60') || desc.includes('bulking')) {
            return 5;
        }

        if (desc.includes('urea') || desc.includes('46-0-0') || desc.includes('side-dress') || desc.includes('vegetative')) {
            return 4;
        }

        if (desc.includes('basal') || desc.includes('14-14-14') || desc.includes('pre-emergence')) {
            return 3;
        }

        // 2. Date-based fallback if plantingDate is known
        if (expense.expenseDate && expense.plantingDate) {
            return this.determineCycleCurrentStep(expense.plantingDate, expense.expenseDate);
        }

        // 3. Category fallbacks
        if (cat === 'herbicide_pesticide') return 3;
        if (cat === 'fertilizer') return 4;
        if (cat === 'transport') return 7;
        if (cat === 'fuel_oil') return 1;

        return 3; // General mid-cycle default
    }

    /**
     * Calculate summary of all planned vs actual farming steps for a crop cycle.
     */
    static calculateCyclePlannedVsActualSummary(
        steps: FarmingStepComparison[],
        areaPlantedHa: number,
        plantingDate: Date,
        asOfDate: Date = new Date(),
        targetHarvestDate?: Date | null
    ): CycleStepsSummary {
        const totalPlannedBudget = steps.reduce((sum, s) => sum + s.plannedBudget, 0);
        const totalActualExpenses = steps.reduce((sum, s) => sum + s.actualExpenses, 0);
        const netVariance = totalActualExpenses - totalPlannedBudget;
        const budgetBurnRatePercent = totalPlannedBudget > 0
            ? Number(((totalActualExpenses / totalPlannedBudget) * 100).toFixed(2))
            : 0;

        const currentStepNumber = this.determineCycleCurrentStep(plantingDate, asOfDate);
        const currentStepObj = steps.find((s) => s.stepNumber === currentStepNumber);
        const currentStepName = currentStepObj ? currentStepObj.name : 'Active Cycle';

        const diffMs = asOfDate.getTime() - plantingDate.getTime();
        const daysElapsed = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

        let daysRemaining = 270 - daysElapsed;
        if (targetHarvestDate) {
            const harvestMs = targetHarvestDate.getTime() - asOfDate.getTime();
            daysRemaining = Math.max(0, Math.floor(harvestMs / (1000 * 60 * 60 * 24)));
        }

        const completedStepsCount = steps.filter((s) => s.stepStatus === 'completed').length;
        const activeStepsCount = steps.filter((s) => s.stepStatus === 'in_progress').length;
        const upcomingStepsCount = steps.filter((s) => s.stepStatus === 'upcoming').length;

        return {
            areaPlantedHa,
            totalPlannedBudget,
            totalActualExpenses,
            netVariance,
            budgetBurnRatePercent,
            currentStepNumber,
            currentStepName,
            daysElapsed,
            daysRemaining,
            completedStepsCount,
            activeStepsCount,
            upcomingStepsCount,
            steps,
        };
    }

    /**
     * Full database analysis: fetches cycle, all farm expenses, calculates planned vs actual for each step.
     */
    static async analyzeCycleFarmingSteps(
        cycleId: string,
        db: Database = globalDatabase
    ): Promise<CycleStepsSummary> {
        const cycle = await db.get<AgriCropCycle>('agri_crop_cycles').find(cycleId);
        const plantingDate = cycle.plantingDate ? new Date(cycle.plantingDate) : new Date();
        const targetHarvestDate = cycle.targetHarvestDate ? new Date(cycle.targetHarvestDate) : null;
        const areaHa = cycle.areaPlantedHa || 1.0;

        const standardSteps = this.getStandardFarmingSteps(areaHa);
        const currentStepNumber = this.determineCycleCurrentStep(plantingDate);

        // Fetch all non-deleted expenses for this cycle
        const expenses = await db
            .get<AgriFarmExpense>('agri_farm_expenses')
            .query(
                Q.where('crop_cycle_id', cycleId),
                Q.where('deleted_at', null)
            )
            .fetch();

        // Group expenses by step number
        const expensesByStep: Record<number, AgriFarmExpense[]> = {
            1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [],
        };

        for (const exp of expenses) {
            const stepNum = this.mapExpenseToFarmingStep({
                category: exp.category,
                description: exp.description,
                expenseDate: exp.expenseDate ? new Date(exp.expenseDate) : undefined,
                plantingDate,
            });
            if (expensesByStep[stepNum]) {
                expensesByStep[stepNum].push(exp);
            } else {
                expensesByStep[3].push(exp);
            }
        }

        // Build step comparisons
        const comparisons: FarmingStepComparison[] = standardSteps.map((def) => {
            const matchingExps = expensesByStep[def.stepNumber] || [];
            const actualTotal = matchingExps.reduce((sum, e) => sum + (e.amount || 0), 0);
            const { varianceAmount, variancePercent, budgetStatus } = this.calculateStepVariance(
                def.totalPlannedBudget,
                actualTotal
            );

            let stepStatus: StepStatus = 'upcoming';
            if (def.stepNumber < currentStepNumber) {
                stepStatus = 'completed';
            } else if (def.stepNumber === currentStepNumber) {
                stepStatus = 'in_progress';
            } else {
                stepStatus = 'upcoming';
            }

            return {
                stepNumber: def.stepNumber,
                id: def.id,
                name: def.name,
                timelineDays: def.timelineDays,
                targetStage: def.targetStage,
                plannedBudget: def.totalPlannedBudget,
                actualExpenses: actualTotal,
                varianceAmount,
                variancePercent,
                budgetStatus,
                stepStatus,
                expenseCount: matchingExps.length,
                matchingExpenses: matchingExps,
            };
        });

        const summary = this.calculateCyclePlannedVsActualSummary(
            comparisons,
            areaHa,
            plantingDate,
            new Date(),
            targetHarvestDate
        );

        summary.cycleId = cycle.id;
        summary.cycleCode = cycle.cycleCode;
        summary.cropType = cycle.cropType;

        return summary;
    }
}
