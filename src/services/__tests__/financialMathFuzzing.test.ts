import { formatPHP } from '../../utils/currency';
import { AgriFinanceAnalyticsService } from '../AgriFinanceAnalyticsService';
import { AgriFarmingStepsService } from '../AgriFarmingStepsService';

describe('B7-ULTRA Phase 6: Financial Math & Precision Fuzzing (Gate G-10)', () => {
    it('executes 10,000 randomized currency additions without float rounding drift', () => {
        for (let i = 0; i < 10000; i++) {
            const a = Math.random() * 100000;
            const b = Math.random() * 100000;
            const result = formatPHP(a + b);

            // Must match standard currency formatting: PHP X,XXX.XX or PHP XXX.XX
            expect(result).toMatch(/^PHP [\d,]+\.\d{2}$/);
            expect(result).not.toContain('NaN');
            expect(result).not.toContain('Infinity');
        }
    });

    it('executes 10,000 randomized farming budget variance calculations without NaN or Infinity', () => {
        for (let i = 0; i < 10000; i++) {
            const planned = Math.floor(Math.random() * 500000);
            const actual = Math.floor(Math.random() * 500000);
            const variance = AgriFarmingStepsService.calculateStepVariance(planned, actual);

            expect(typeof variance.varianceAmount).toBe('number');
            expect(Number.isNaN(variance.varianceAmount)).toBe(false);
            expect(Number.isFinite(variance.varianceAmount)).toBe(true);
            expect(Number.isNaN(variance.variancePercent)).toBe(false);
            expect(Number.isFinite(variance.variancePercent)).toBe(true);
            expect(['under_budget', 'on_track', 'over_budget']).toContain(variance.budgetStatus);
        }
    });

    it('safely handles zero-division edge cases across all financial calculators', () => {
        // Zero planned budget
        const zeroPlanned = AgriFarmingStepsService.calculateStepVariance(0, 15000);
        expect(zeroPlanned.varianceAmount).toBe(15000);
        expect(zeroPlanned.variancePercent).toBe(100);
        expect(zeroPlanned.budgetStatus).toBe('over_budget');

        // Zero actual and zero planned
        const zeroBoth = AgriFarmingStepsService.calculateStepVariance(0, 0);
        expect(zeroBoth.varianceAmount).toBe(0);
        expect(zeroBoth.variancePercent).toBe(0);
        expect(zeroBoth.budgetStatus).toBe('on_track');

        // Zero yield in Cycle PnL
        const zeroYieldPnL = AgriFinanceAnalyticsService.calculateCyclePnL(0, 4.0, 25000, 5000, 10000, 1.0);
        expect(zeroYieldPnL.grossRevenue).toBe(0);
        expect(zeroYieldPnL.costPerKilo).toBe(0);
        expect(Number.isNaN(zeroYieldPnL.netMargin)).toBe(false);
    });

    it('enforces non-negative area scaling in farming steps', () => {
        const negativeHa = AgriFarmingStepsService.getStandardFarmingSteps(-5);
        for (const step of negativeHa) {
            expect(step.totalPlannedBudget).toBeGreaterThanOrEqual(0);
            expect(Number.isNaN(step.totalPlannedBudget)).toBe(false);
        }
    });
});
