import { MSRService, MonthlyStoreReport } from '../MSRService';
import { database } from '../../database';

jest.mock('../../database', () => ({
    database: {
        get: jest.fn(),
        write: jest.fn().mockImplementation((cb) => cb()),
        collections: {
            get: jest.fn(),
        },
    },
}));

describe('MSRService', () => {
    describe('generateMonthlyStoreReport', () => {
        it('accurately computes MSR financial rollup matching the Bagacay July 2026 benchmark', async () => {
            // Bagacay Benchmark ground-truth values:
            // Gross Sales: ₱512,383.00
            // COGS: ₱332,893.88 (64.97%)
            // OPEX: ₱160,446.22 (31.31%)
            // Net Income: ₱19,042.91 (3.72%)

            const mockSales = [
                {
                    totalAmount: 512383.0,
                    status: 'completed',
                    createdAt: new Date('2026-07-15').getTime(),
                    deletedAt: null,
                },
            ];

            const mockCogsMovements = [
                {
                    totalCost: 332893.88,
                    movementType: 'sale',
                    deletedAt: null,
                },
            ];

            const mockExpenses = [
                {
                    amount: 160446.22,
                    expenseDate: new Date('2026-07-20').getTime(),
                    deletedAt: null,
                },
            ];

            (database.get as jest.Mock).mockImplementation((table: string) => {
                if (table === 'stock_movements') {
                    return {
                        query: jest.fn().mockReturnValue({
                            fetch: jest.fn().mockResolvedValue(mockCogsMovements),
                        }),
                    };
                }
                if (table === 'expenses') {
                    return {
                        query: jest.fn().mockReturnValue({
                            fetch: jest.fn().mockResolvedValue(mockExpenses),
                        }),
                    };
                }
                return {
                    query: jest.fn().mockReturnValue({
                        fetch: jest.fn().mockResolvedValue(mockSales),
                    }),
                };
            });

            const report: MonthlyStoreReport = await MSRService.generateMonthlyStoreReport(
                'branch-bagacay',
                2026,
                7
            );

            expect(report.branchId).toBe('branch-bagacay');
            expect(report.year).toBe(2026);
            expect(report.month).toBe(7);
            expect(report.grossSales).toBe(512383.0);
            expect(report.cogs).toBe(332893.88);
            expect(report.cogsRatio).toBeCloseTo(64.97, 1);
            expect(report.grossProfit).toBeCloseTo(512383.0 - 332893.88, 2);
            expect(report.opex).toBe(160446.22);
            expect(report.netIncome).toBeCloseTo(19042.90, 1);
            expect(report.netMargin).toBeCloseTo(3.72, 1);
            expect(report.daysInMonth).toBe(31);
        });

        it('handles zero sales month gracefully without zero-division error', async () => {
            (database.get as jest.Mock).mockImplementation(() => ({
                query: jest.fn().mockReturnValue({
                    fetch: jest.fn().mockResolvedValue([]),
                }),
            }));

            const report = await MSRService.generateMonthlyStoreReport('branch-empty', 2026, 7);

            expect(report.grossSales).toBe(0);
            expect(report.cogs).toBe(0);
            expect(report.cogsRatio).toBe(0);
            expect(report.netIncome).toBe(0);
            expect(report.netMargin).toBe(0);
        });
    });

    describe('exportMSRToCSV', () => {
        it('generates well-formatted CSV with header, daily rows, and monthly rollup', async () => {
            (database.get as jest.Mock).mockImplementation(() => ({
                query: jest.fn().mockReturnValue({
                    fetch: jest.fn().mockResolvedValue([]),
                }),
            }));

            const csv = await MSRService.exportMSRToCSV('branch-bagacay', 2026, 7);

            expect(csv).toContain('Day,Date,Gross Sales,COGS,Gross Profit,OPEX,Net Income');
            expect(csv).toContain('MONTHLY TOTAL');
            expect(csv).toContain('2026-07-01');
            expect(csv).toContain('2026-07-31');
        });
    });
});
