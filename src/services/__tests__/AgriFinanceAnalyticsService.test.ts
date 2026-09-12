import { AgriFinanceAnalyticsService } from '../AgriFinanceAnalyticsService';

describe('AgriFinanceAnalyticsService', () => {
    describe('calculateCyclePnL', () => {
        it('computes cycle revenue, expenses, net margin, and unit economics', () => {
            // Harvest: 30,000 kg sold to BioGreen @ ₱4.00/kg = ₱120,000 gross revenue
            // Land Owner Settlement: ₱30,000 (30,000 kg @ ₱1/kg)
            // Labor Cost: ₱25,000
            // Farm Expenses (fertilizer/tractor): ₱20,000
            // Area: 2.5 hectares
            const pnl = AgriFinanceAnalyticsService.calculateCyclePnL(
                30000,
                4.0,
                30000,
                25000,
                20000,
                2.5
            );

            expect(pnl.grossRevenue).toBe(120000);
            expect(pnl.totalExpenses).toBe(75000); // 30k + 25k + 20k
            expect(pnl.netMargin).toBe(45000); // 120k - 75k
            expect(pnl.profitMarginPercent).toBe(37.5); // (45k / 120k) * 100
            expect(pnl.costPerHectare).toBe(30000); // 75k / 2.5 ha
            expect(pnl.costPerKilo).toBe(2.5); // 75k / 30k kg
            expect(pnl.revenuePerHectare).toBe(48000); // 120k / 2.5 ha
            expect(pnl.yieldPerHectareTons).toBe(12); // (30 tons / 2.5 ha)
        });

        it('handles zero yield gracefully without dividing by zero', () => {
            const pnl = AgriFinanceAnalyticsService.calculateCyclePnL(0, 4.0, 25000, 5000, 10000, 1.0);

            expect(pnl.grossRevenue).toBe(0);
            expect(pnl.totalExpenses).toBe(40000);
            expect(pnl.netMargin).toBe(-40000);
            expect(pnl.costPerKilo).toBe(0);
            expect(pnl.profitMarginPercent).toBe(0);
        });
    });

    describe('forecastYield', () => {
        it('forecasts cassava yield for good condition parcel (25 tons/ha)', () => {
            const forecast = AgriFinanceAnalyticsService.forecastYield(2.0, 'good', 4.0);

            expect(forecast.areaHectares).toBe(2.0);
            expect(forecast.expectedTonsPerHa).toBe(25);
            expect(forecast.projectedYieldKg).toBe(50000); // 2 ha * 25 tons * 1000 kg
            expect(forecast.projectedGrossRevenue).toBe(200000); // 50,000 kg * ₱4.00
        });

        it('forecasts higher yield for excellent condition (30 tons/ha)', () => {
            const forecast = AgriFinanceAnalyticsService.forecastYield(3.0, 'excellent', 4.5);

            expect(forecast.expectedTonsPerHa).toBe(30);
            expect(forecast.projectedYieldKg).toBe(90000); // 3 * 30 * 1000
            expect(forecast.projectedGrossRevenue).toBe(405000); // 90,000 * ₱4.50
        });
    });
});
