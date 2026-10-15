import {
    AgriFarmingStepsService,
    FarmingStepDefinition,
    FarmingStepComparison,
} from '../AgriFarmingStepsService';

describe('AgriFarmingStepsService', () => {
    describe('getStandardFarmingSteps', () => {
        it('returns standard 7-step Cassava implementation sequence for 1 hectare', () => {
            const steps = AgriFarmingStepsService.getStandardFarmingSteps(1.0);
            expect(steps).toHaveLength(7);

            // Step 1: Land Prep
            expect(steps[0].stepNumber).toBe(1);
            expect(steps[0].id).toBe('land_prep');
            expect(steps[0].plannedBudgetPerHa).toBe(15000);
            expect(steps[0].totalPlannedBudget).toBe(15000);
            expect(steps[0].targetStage).toBe('land_prep');

            // Step 2: Planting & Staking
            expect(steps[1].stepNumber).toBe(2);
            expect(steps[1].id).toBe('planting_staking');
            expect(steps[1].plannedBudgetPerHa).toBe(10000);

            // Step 3: Basal & Pre-emergence
            expect(steps[2].stepNumber).toBe(3);
            expect(steps[2].id).toBe('basal_weed_control');
            expect(steps[2].plannedBudgetPerHa).toBe(14000);

            // Step 4: Vegetative Care & Side-dress
            expect(steps[3].stepNumber).toBe(4);
            expect(steps[3].id).toBe('vegetative_side_dress');
            expect(steps[3].plannedBudgetPerHa).toBe(11000);

            // Step 5: Root Bulking & Maintenance
            expect(steps[4].stepNumber).toBe(5);
            expect(steps[4].id).toBe('root_bulking');
            expect(steps[4].plannedBudgetPerHa).toBe(8000);

            // Step 6: Pre-Harvest Assessment
            expect(steps[5].stepNumber).toBe(6);
            expect(steps[5].id).toBe('pre_harvest');
            expect(steps[5].plannedBudgetPerHa).toBe(4000);

            // Step 7: Harvesting & Hauling
            expect(steps[6].stepNumber).toBe(7);
            expect(steps[6].id).toBe('harvest_hauling');
            expect(steps[6].plannedBudgetPerHa).toBe(18000);

            // Total benchmark budget per hectare in PH: ₱80,000
            const totalPlanned = steps.reduce((sum, s) => sum + s.totalPlannedBudget, 0);
            expect(totalPlanned).toBe(80000);
        });

        it('scales total planned budget proportionally by parcel area', () => {
            const areaHa = 3.5;
            const steps = AgriFarmingStepsService.getStandardFarmingSteps(areaHa);
            const totalPlanned = steps.reduce((sum, s) => sum + s.totalPlannedBudget, 0);
            expect(totalPlanned).toBe(80000 * 3.5); // ₱280,000
            expect(steps[0].totalPlannedBudget).toBe(15000 * 3.5); // ₱52,500
        });
    });

    describe('determineCycleCurrentStep', () => {
        const plantingDate = new Date('2026-01-01T00:00:00.000Z');

        it('identifies Step 1 before planting (Day -10)', () => {
            const checkDate = new Date('2025-12-22T00:00:00.000Z');
            const stepNum = AgriFarmingStepsService.determineCycleCurrentStep(plantingDate, checkDate);
            expect(stepNum).toBe(1);
        });

        it('identifies Step 2 during early planting (Day 7)', () => {
            const checkDate = new Date('2026-01-08T00:00:00.000Z');
            const stepNum = AgriFarmingStepsService.determineCycleCurrentStep(plantingDate, checkDate);
            expect(stepNum).toBe(2);
        });

        it('identifies Step 3 during germination/basal stage (Day 30)', () => {
            const checkDate = new Date('2026-01-31T00:00:00.000Z');
            const stepNum = AgriFarmingStepsService.determineCycleCurrentStep(plantingDate, checkDate);
            expect(stepNum).toBe(3);
        });

        it('identifies Step 4 during vegetative growth (Day 70)', () => {
            const checkDate = new Date('2026-03-12T00:00:00.000Z');
            const stepNum = AgriFarmingStepsService.determineCycleCurrentStep(plantingDate, checkDate);
            expect(stepNum).toBe(4);
        });

        it('identifies Step 5 during root bulking (Day 140)', () => {
            const checkDate = new Date('2026-05-21T00:00:00.000Z');
            const stepNum = AgriFarmingStepsService.determineCycleCurrentStep(plantingDate, checkDate);
            expect(stepNum).toBe(5);
        });

        it('identifies Step 6 during pre-harvest assessment (Day 220)', () => {
            const checkDate = new Date('2026-08-09T00:00:00.000Z');
            const stepNum = AgriFarmingStepsService.determineCycleCurrentStep(plantingDate, checkDate);
            expect(stepNum).toBe(6);
        });

        it('identifies Step 7 during harvesting window (Day 280+)', () => {
            const checkDate = new Date('2026-10-08T00:00:00.000Z');
            const stepNum = AgriFarmingStepsService.determineCycleCurrentStep(plantingDate, checkDate);
            expect(stepNum).toBe(7);
        });
    });

    describe('calculateStepVariance', () => {
        it('calculates under-budget variance correctly', () => {
            const result = AgriFarmingStepsService.calculateStepVariance(15000, 12000);
            expect(result.varianceAmount).toBe(-3000);
            expect(result.variancePercent).toBe(-20);
            expect(result.budgetStatus).toBe('under_budget');
        });

        it('calculates on-track budget variance when actual equals planned', () => {
            const result = AgriFarmingStepsService.calculateStepVariance(10000, 10000);
            expect(result.varianceAmount).toBe(0);
            expect(result.variancePercent).toBe(0);
            expect(result.budgetStatus).toBe('on_track');
        });

        it('calculates over-budget overrun correctly', () => {
            const result = AgriFarmingStepsService.calculateStepVariance(10000, 13500);
            expect(result.varianceAmount).toBe(3500);
            expect(result.variancePercent).toBe(35);
            expect(result.budgetStatus).toBe('over_budget');
        });

        it('handles zero planned budget without NaN', () => {
            const result = AgriFarmingStepsService.calculateStepVariance(0, 5000);
            expect(result.varianceAmount).toBe(5000);
            expect(result.variancePercent).toBe(100);
            expect(result.budgetStatus).toBe('over_budget');
        });
    });

    describe('mapExpenseToFarmingStep', () => {
        const planting = new Date('2026-01-01T00:00:00.000Z');

        it('maps tractor preparation expense before planting to Step 1', () => {
            const step = AgriFarmingStepsService.mapExpenseToFarmingStep({
                category: 'tractor_equipment',
                description: 'Tractor plowing and rotavation 2 passes',
                expenseDate: new Date('2025-12-20T00:00:00.000Z'),
                plantingDate: planting,
            });
            expect(step).toBe(1);
        });

        it('maps seedlings purchase to Step 2', () => {
            const step = AgriFarmingStepsService.mapExpenseToFarmingStep({
                category: 'seedlings',
                description: 'Cassava stalks 20 bundles Golden Yellow',
                expenseDate: new Date('2026-01-02T00:00:00.000Z'),
                plantingDate: planting,
            });
            expect(step).toBe(2);
        });

        it('maps herbicide to Step 3 during early emergence', () => {
            const step = AgriFarmingStepsService.mapExpenseToFarmingStep({
                category: 'herbicide_pesticide',
                description: 'Pre-emergence herbicide spraying',
                expenseDate: new Date('2026-01-20T00:00:00.000Z'),
                plantingDate: planting,
            });
            expect(step).toBe(3);
        });

        it('maps hauling trucking to Step 7', () => {
            const step = AgriFarmingStepsService.mapExpenseToFarmingStep({
                category: 'transport',
                description: '10-wheeler trucking hauling cassava roots to starch factory',
                expenseDate: new Date('2026-10-05T00:00:00.000Z'),
                plantingDate: planting,
            });
            expect(step).toBe(7);
        });
    });

    describe('calculateCyclePlannedVsActualSummary', () => {
        it('aggregates total planned, actual, net variance, and burn rate across all steps', () => {
            const mockComparisons: FarmingStepComparison[] = [
                {
                    stepNumber: 1,
                    id: 'land_prep',
                    name: 'Land Preparation',
                    timelineDays: 'Days -20 to 0',
                    targetStage: 'land_prep',
                    plannedBudget: 30000,
                    actualExpenses: 28000,
                    varianceAmount: -2000,
                    variancePercent: -6.67,
                    budgetStatus: 'under_budget',
                    stepStatus: 'completed',
                    expenseCount: 2,
                },
                {
                    stepNumber: 2,
                    id: 'planting_staking',
                    name: 'Planting & Staking',
                    timelineDays: 'Days 0 to 15',
                    targetStage: 'germination',
                    plannedBudget: 20000,
                    actualExpenses: 22500,
                    varianceAmount: 2500,
                    variancePercent: 12.5,
                    budgetStatus: 'over_budget',
                    stepStatus: 'completed',
                    expenseCount: 1,
                },
                {
                    stepNumber: 3,
                    id: 'basal_weed_control',
                    name: 'Basal Weed & Fertilization',
                    timelineDays: 'Days 15 to 45',
                    targetStage: 'germination',
                    plannedBudget: 28000,
                    actualExpenses: 14000,
                    varianceAmount: -14000,
                    variancePercent: -50,
                    budgetStatus: 'under_budget',
                    stepStatus: 'in_progress',
                    expenseCount: 1,
                },
                {
                    stepNumber: 4,
                    id: 'vegetative_side_dress',
                    name: 'Vegetative Care',
                    timelineDays: 'Days 45 to 90',
                    targetStage: 'vegetative',
                    plannedBudget: 22000,
                    actualExpenses: 0,
                    varianceAmount: -22000,
                    variancePercent: -100,
                    budgetStatus: 'under_budget',
                    stepStatus: 'upcoming',
                    expenseCount: 0,
                },
                {
                    stepNumber: 5,
                    id: 'root_bulking',
                    name: 'Root Bulking',
                    timelineDays: 'Days 90 to 180',
                    targetStage: 'root_bulking',
                    plannedBudget: 16000,
                    actualExpenses: 0,
                    varianceAmount: -16000,
                    variancePercent: -100,
                    budgetStatus: 'under_budget',
                    stepStatus: 'upcoming',
                    expenseCount: 0,
                },
                {
                    stepNumber: 6,
                    id: 'pre_harvest',
                    name: 'Pre-Harvest Assessment',
                    timelineDays: 'Days 180 to 270',
                    targetStage: 'maturity',
                    plannedBudget: 8000,
                    actualExpenses: 0,
                    varianceAmount: -8000,
                    variancePercent: -100,
                    budgetStatus: 'under_budget',
                    stepStatus: 'upcoming',
                    expenseCount: 0,
                },
                {
                    stepNumber: 7,
                    id: 'harvest_hauling',
                    name: 'Harvesting & Hauling',
                    timelineDays: 'Days 270+',
                    targetStage: 'maturity',
                    plannedBudget: 36000,
                    actualExpenses: 0,
                    varianceAmount: -36000,
                    variancePercent: -100,
                    budgetStatus: 'under_budget',
                    stepStatus: 'upcoming',
                    expenseCount: 0,
                },
            ];

            const summary = AgriFarmingStepsService.calculateCyclePlannedVsActualSummary(
                mockComparisons,
                2.0, // 2 hectares
                new Date('2026-01-01'),
                new Date('2026-02-01') // 31 days elapsed -> Step 3
            );

            expect(summary.totalPlannedBudget).toBe(160000); // ₱80k * 2 ha
            expect(summary.totalActualExpenses).toBe(64500); // 28k + 22.5k + 14k
            expect(summary.netVariance).toBe(-95500); // 64,500 - 160,000
            expect(summary.budgetBurnRatePercent).toBe(40.31); // (64.5k / 160k) * 100
            expect(summary.currentStepNumber).toBe(3);
            expect(summary.completedStepsCount).toBe(2);
            expect(summary.activeStepsCount).toBe(1);
            expect(summary.upcomingStepsCount).toBe(4);
        });
    });
});
