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

    describe('getAgriGeneralLedgerSummary and getCropCycleJournalEntries', () => {
        let database: any;

        beforeEach(async () => {
            const { createTestDatabase } = require('../../__tests__/test-utils');
            database = createTestDatabase();
        });

        afterEach(async () => {
            const { closeTestDatabase } = require('../../__tests__/test-utils');
            await closeTestDatabase(database);
        });

        it('computes Agri GL summary accurately from double-entry lines', async () => {
            await database.write(async () => {
                // Create a journal entry for harvest sale
                const entry1 = await database.get('journal_entries').create((e: any) => {
                    e._raw.id = 'entry-sale-1';
                    e.referenceNumber = 'JE-AGRI-001';
                    e.description = 'Harvest Sale';
                    e.entryType = 'auto';
                    e.isPosted = true;
                    e.totalDebit = 100000;
                    e.totalCredit = 100000;
                    e.entryDate = new Date();
                });

                await database.get('journal_entry_lines').create((l: any) => {
                    l.journalEntryId = entry1.id;
                    l.accountCode = '1010';
                    l.debitAmount = 100000;
                    l.creditAmount = 0;
                    l.businessUnitId = 'agribusiness';
                    l.moduleSourceId = 'cycle-101';
                });
                await database.get('journal_entry_lines').create((l: any) => {
                    l.journalEntryId = entry1.id;
                    l.accountCode = '4140'; // Crop Harvest Sales
                    l.debitAmount = 0;
                    l.creditAmount = 100000;
                    l.businessUnitId = 'agribusiness';
                    l.moduleSourceId = 'cycle-101';
                });

                // Create a journal entry for land settlement
                const entry2 = await database.get('journal_entries').create((e: any) => {
                    e._raw.id = 'entry-settle-1';
                    e.referenceNumber = 'JE-AGRI-002';
                    e.description = 'Land Owner Settlement';
                    e.entryType = 'auto';
                    e.isPosted = true;
                    e.totalDebit = 25000;
                    e.totalCredit = 25000;
                    e.entryDate = new Date();
                });

                await database.get('journal_entry_lines').create((l: any) => {
                    l.journalEntryId = entry2.id;
                    l.accountCode = '5160'; // Settlement expense
                    l.debitAmount = 25000;
                    l.creditAmount = 0;
                    l.businessUnitId = 'agribusiness';
                    l.moduleSourceId = 'cycle-101';
                });
                await database.get('journal_entry_lines').create((l: any) => {
                    l.journalEntryId = entry2.id;
                    l.accountCode = '1010';
                    l.debitAmount = 0;
                    l.creditAmount = 25000;
                    l.businessUnitId = 'agribusiness';
                    l.moduleSourceId = 'cycle-101';
                });

                // Create a journal entry for fertilizer
                const entry3 = await database.get('journal_entries').create((e: any) => {
                    e._raw.id = 'entry-fert-1';
                    e.referenceNumber = 'JE-AGRI-003';
                    e.description = 'Fertilizer input';
                    e.entryType = 'auto';
                    e.isPosted = true;
                    e.totalDebit = 15000;
                    e.totalCredit = 15000;
                    e.entryDate = new Date();
                });

                await database.get('journal_entry_lines').create((l: any) => {
                    l.journalEntryId = entry3.id;
                    l.accountCode = '5162'; // Fertilizer expense
                    l.debitAmount = 15000;
                    l.creditAmount = 0;
                    l.businessUnitId = 'agribusiness';
                    l.moduleSourceId = 'cycle-101';
                });
                await database.get('journal_entry_lines').create((l: any) => {
                    l.journalEntryId = entry3.id;
                    l.accountCode = '1010';
                    l.debitAmount = 0;
                    l.creditAmount = 15000;
                    l.businessUnitId = 'agribusiness';
                    l.moduleSourceId = 'cycle-101';
                });
            });

            const summary = await AgriFinanceAnalyticsService.getAgriGeneralLedgerSummary(database);
            expect(summary.totalRevenue).toBe(100000);
            expect(summary.landOwnerSettlementCost).toBe(25000);
            expect(summary.farmInputExpenses).toBe(15000);
            expect(summary.totalExpenses).toBe(40000); // 25k + 15k
            expect(summary.netSurplus).toBe(60000); // 100k - 40k
            expect(summary.journalEntryCount).toBe(3);

            const cycleEntries = await AgriFinanceAnalyticsService.getCropCycleJournalEntries('cycle-101', database);
            expect(cycleEntries.length).toBe(3);
        });
    });
});
