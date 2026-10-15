import { AgriImplementationReportService, BACALSO_BENCHMARK_HA, BACALSO_TOTAL_PLANNED_COST } from '../AgriImplementationReportService';

describe('AgriImplementationReportService', () => {
    describe('getBenchmarkActivities', () => {
        it('returns all 12 operational activities with exact Bacalso Farm benchmark values', () => {
            const activities = AgriImplementationReportService.getBenchmarkActivities(BACALSO_BENCHMARK_HA);
            expect(activities).toHaveLength(12);

            const total = activities.reduce((sum, a) => sum + a.plannedCost, 0);
            expect(total).toBe(BACALSO_TOTAL_PLANNED_COST); // Exactly 199,222.00
            expect(total).toBe(199222);

            // Verify specific line items from the attachment
            const harrow1 = activities.find(a => a.id === 'harrow_1');
            expect(harrow1?.plannedCost).toBe(22695);

            const harrow2 = activities.find(a => a.id === 'harrow_2');
            expect(harrow2?.plannedCost).toBe(19005);

            const furrow = activities.find(a => a.id === 'furrow');
            expect(furrow?.plannedCost).toBe(20235);

            const planting = activities.find(a => a.id === 'planting');
            expect(planting?.plannedCost).toBe(40997);

            const fert1 = activities.find(a => a.id === 'fertilization_1');
            expect(fert1?.plannedCost).toBe(30300);

            const fert2 = activities.find(a => a.id === 'fertilization_2');
            expect(fert2?.plannedCost).toBe(25200);

            const fert3 = activities.find(a => a.id === 'fertilization_3');
            expect(fert3?.plannedCost).toBe(5400);

            const herb1 = activities.find(a => a.id === 'herbicides_1');
            expect(herb1?.plannedCost).toBe(11325);

            const herb2 = activities.find(a => a.id === 'herbicides_2');
            expect(herb2?.plannedCost).toBe(13300);
        });

        it('scales planned budget proportionally when parcel area changes', () => {
            const activitiesHalf = AgriImplementationReportService.getBenchmarkActivities(BACALSO_BENCHMARK_HA / 2);
            const totalHalf = activitiesHalf.reduce((sum, a) => sum + a.plannedCost, 0);
            expect(Math.abs(totalHalf - (BACALSO_TOTAL_PLANNED_COST / 2))).toBeLessThanOrEqual(5);
        });

        it('handles zero or negative area safely with minimum 0.01 ha guard', () => {
            const activitiesZero = AgriImplementationReportService.getBenchmarkActivities(0);
            expect(activitiesZero[0].plannedCost).toBeGreaterThan(0);
        });
    });

    describe('Financial P&L and Net Income calculation', () => {
        it('calculates net income correctly (Gross Harvest - Total Cost)', () => {
            const summary = AgriImplementationReportService.buildReportData({
                farmName: 'BACALSO FARM',
                location: 'ALAE, BUKIDNON',
                areaHa: 3.45,
                cropCycleName: '1ST CROP',
                grossHarvest: 550000,
                expenses: [],
            });

            expect(summary.totalPlannedCost).toBe(199222);
            expect(summary.totalCassavaHarvestGross).toBe(550000);
            expect(summary.netIncomePlanned).toBe(350778); // 550,000 - 199,222
        });

        it('aggregates actual expenses into corresponding 12 activities', () => {
            const mockExpenses: any[] = [
                { category: 'tractor_equipment', description: 'Tractor plowing Harrow 1', amount: 20000, expenseDate: new Date('2026-07-02') },
                { category: 'seedlings', description: 'Cassava Seed Stalks 750 bundles', amount: 18750, expenseDate: new Date('2026-07-15') },
                { category: 'fertilizer', description: 'Urea and DAP 1st fert', amount: 28000, expenseDate: new Date('2026-07-20') },
            ];

            const summary = AgriImplementationReportService.buildReportData({
                farmName: 'BACALSO FARM',
                location: 'ALAE, BUKIDNON',
                areaHa: 3.45,
                cropCycleName: '1ST CROP',
                grossHarvest: 550000,
                expenses: mockExpenses,
            });

            expect(summary.totalActualCost).toBe(66750);
            expect(summary.netIncomeActual).toBe(550000 - 66750);
            expect(summary.activities.find(a => a.id === 'harrow_1')?.actualCost).toBe(20000);
            expect(summary.activities.find(a => a.id === 'planting')?.actualCost).toBe(18750);
        });
    });

    describe('Schedule Matrix and Month Generation', () => {
        it('provides 13 crop cycle months from JUN to JUN', () => {
            const months = AgriImplementationReportService.getImplementationMonths();
            expect(months).toHaveLength(13);
            expect(months[0]).toBe('JUN');
            expect(months[1]).toBe('JUL');
            expect(months[12]).toBe('JUN');
        });

        it('maps theoretical days to proper activity columns', () => {
            const matrix = AgriImplementationReportService.getTheoreticalScheduleMatrix();
            expect(matrix['JUN'][0]).toBe('1'); // MB/DP Day 1
            expect(matrix['JUN'][1]).toBe('10'); // Harrow 1 Day 10
            expect(matrix['JUL'][2]).toBe('13'); // Harrow 2 Day 13
            expect(matrix['JUL'][3]).toBe('14'); // Furrow Day 14
            expect(matrix['JUL'][4]).toBe('15-18'); // Planting Day 15-18
            expect(matrix['JUL'][5]).toBe('19-20'); // Planting/1st Fert Day 19-20
        });
    });

    describe('generateBacalsoFarmReportHtml', () => {
        it('generates complete, printable HTML with all headers and summary figures', () => {
            const summary = AgriImplementationReportService.buildReportData({
                farmName: 'BACALSO FARM',
                location: 'ALAE, BUKIDNON',
                areaHa: 3.45,
                cropCycleName: '1ST CROP',
                grossHarvest: 550000,
                expenses: [],
            });

            const html = AgriImplementationReportService.generateBacalsoFarmReportHtml(summary);
            expect(html).toContain('BACALSO FARM');
            expect(html).toContain('3.45 HA IN ALAE, BUKIDNON');
            expect(html).toContain('1ST CROP');
            expect(html).toContain('SUMMARY');
            expect(html).toContain('199,222.00');
            expect(html).toContain('550,000.00');
            expect(html).toContain('350,778.00');
            expect(html).toContain('THEORETICAL');
            expect(html).toContain('ACTUAL');
            expect(html).toContain('@page { size: landscape');
        });
    });
});
