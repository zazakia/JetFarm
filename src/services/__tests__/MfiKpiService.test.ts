import { MfiKpiService } from '../MfiKpiService';
import { CashService } from '../CashService';
import { createTestDatabase } from '../../__tests__/test-utils';
import { Database, Q } from '@nozbe/watermelondb';

jest.mock('../CashService', () => ({
    CashService: {
        getCollectorBalance: jest.fn().mockResolvedValue(100),
        getCurrentBalance: jest.fn().mockResolvedValue(5000),
    }
}));

describe('MfiKpiService', () => {
    let database: Database;
    let service: MfiKpiService;
    const dayMs = 24 * 60 * 60 * 1000;

    beforeEach(async () => {
        database = createTestDatabase();
        service = new MfiKpiService(database);
        (MfiKpiService as any).defaultInstance = service;
        jest.clearAllMocks();
    });

    describe('getActiveLoansReportData — Aging Buckets', () => {
        it('hits all aging bucket branches (1-45, 46-60, 61-90, 91+)', async () => {
            const now = new Date();

            await database.write(async () => {
                const b = await database.get('borrowers').create((r: any) => {
                    r.fullName = 'Aging Borrower';
                });

                const loan = await database.get('loans').create((r: any) => {
                    r.borrowerId = b.id;
                    r.principalAmount = 10000;
                    r.totalAmount = 12000;
                    r.status = 'active';
                    r.releaseDate = now.getTime() - 200 * 24 * 60 * 60 * 1000;
                });

                // Schedule 1: 10 days overdue → day1_45 bucket
                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = loan.id;
                    s.scheduledAmount = 100;
                    s.status = 'pending';
                    s.dueDate = now.getTime() - 10 * 24 * 60 * 60 * 1000;
                });

                // Schedule 2: 50 days overdue → day46_60 bucket
                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = loan.id;
                    s.scheduledAmount = 200;
                    s.status = 'pending';
                    s.dueDate = now.getTime() - 50 * 24 * 60 * 60 * 1000;
                });

                // Schedule 3: 75 days overdue → day61_90 bucket
                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = loan.id;
                    s.scheduledAmount = 300;
                    s.status = 'pending';
                    s.dueDate = now.getTime() - 75 * 24 * 60 * 60 * 1000;
                });

                // Schedule 4: 100 days overdue → day91_180 bucket
                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = loan.id;
                    s.scheduledAmount = 400;
                    s.status = 'pending';
                    s.dueDate = now.getTime() - 100 * 24 * 60 * 60 * 1000;
                });
            });

            const report = await service.getActiveLoansReportData();
            expect(report.length).toBe(1);

            const entry = report[0];
            expect(entry.clientName).toBe('Aging Borrower');
            // Payments are distributed to oldest schedules first.
            // No payments made, so all balances remain.
            expect(entry.agings.day1_45).toBe(100);
            expect(entry.agings.day46_60).toBe(200);
            expect(entry.agings.day61_90).toBe(300);
            expect(entry.agings.day91_180).toBe(400);
        });

        it('handles notDue bucket for future schedules', async () => {
            const now = new Date();

            await database.write(async () => {
                const b = await database.get('borrowers').create((r: any) => {
                    r.fullName = 'Future Borrower';
                });

                const loan = await database.get('loans').create((r: any) => {
                    r.borrowerId = b.id;
                    r.principalAmount = 5000;
                    r.totalAmount = 6000;
                    r.status = 'active';
                    r.releaseDate = now.getTime();
                });

                // Future schedule → notDue
                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = loan.id;
                    s.scheduledAmount = 500;
                    s.status = 'pending';
                    s.dueDate = now.getTime() + 10 * 24 * 60 * 60 * 1000;
                });
            });

            const report = await service.getActiveLoansReportData();
            const entry = report.find((r: any) => r.clientName === 'Future Borrower');
            expect(entry?.agings.notDue).toBe(500);
        });
    });

    describe('Static Methods Delegation', () => {
        it('delegates all static methods to the instance', async () => {
            const spy = jest.spyOn(service, 'getKpiSummary').mockResolvedValue({} as any);
            await MfiKpiService.getKpiSummary();
            expect(spy).toHaveBeenCalled();

            const spy2 = jest.spyOn(service, 'getOverdueWatchlist').mockResolvedValue([]);
            await MfiKpiService.getOverdueWatchlist();
            expect(spy2).toHaveBeenCalled();

            const spy3 = jest.spyOn(service, 'getAgingClusters').mockResolvedValue([]);
            await MfiKpiService.getAgingClusters();
            expect(spy3).toHaveBeenCalled();

            const spy4 = jest.spyOn(service, 'getAgingBucketDetails').mockResolvedValue([]);
            await MfiKpiService.getAgingBucketDetails(1, 7);
            expect(spy4).toHaveBeenCalledWith(1, 7);

            const spy5 = jest.spyOn(service, 'getCollectorEfficiency').mockResolvedValue([]);
            await MfiKpiService.getCollectorEfficiency();
            expect(spy5).toHaveBeenCalled();

            const spy6 = jest.spyOn(service, 'getIncomeStatement').mockResolvedValue({} as any);
            await MfiKpiService.getIncomeStatement(0, 1);
            expect(spy6).toHaveBeenCalledWith(0, 1);

            const spy7 = jest.spyOn(service, 'getBalanceSheet').mockResolvedValue({} as any);
            await MfiKpiService.getBalanceSheet();
            expect(spy7).toHaveBeenCalled();

            const spy8 = jest.spyOn(service, 'getDisbursements').mockResolvedValue([]);
            await MfiKpiService.getDisbursements(0, 1);
            expect(spy8).toHaveBeenCalledWith(0, 1);

            const spy9 = jest.spyOn(service, 'getAdvancedKpis').mockResolvedValue({} as any);
            await MfiKpiService.getAdvancedKpis();
            expect(spy9).toHaveBeenCalled();

            const spy10 = jest.spyOn(service, 'getSavingsReportData').mockResolvedValue({} as any);
            await MfiKpiService.getSavingsReportData();
            expect(spy10).toHaveBeenCalled();

            const spy11 = jest.spyOn(service, 'getRenewalReportData').mockResolvedValue({} as any);
            await MfiKpiService.getRenewalReportData();
            expect(spy11).toHaveBeenCalled();

            const spy12 = jest.spyOn(service, 'getActiveLoansReportData').mockResolvedValue([]);
            await MfiKpiService.getActiveLoansReportData();
            expect(spy12).toHaveBeenCalled();
        });
    });

    describe('getKpiSummary', () => {
        it('returns zeroed summary when no data exists', async () => {
            const summary = await service.getKpiSummary();
            expect(summary.totalActiveLoans).toBe(0);
        });

        it('handles errors in getKpiSummary', async () => {
            jest.spyOn(database.collections, 'get').mockImplementation(() => { throw new Error('Fail'); });
            const summary = await service.getKpiSummary();
            expect(summary.totalActiveLoans).toBe(0);
        });
    });

    describe('getOverdueWatchlist', () => {
        it('returns empty if no schedules', async () => {
            expect(await service.getOverdueWatchlist()).toEqual([]);
        });

        it('returns the ten most overdue schedules with borrower and balance details', async () => {
            const now = Date.now();

            await database.write(async () => {
                const borrower = await database.get('borrowers').create((b: any) => {
                    b.fullName = 'Overdue Borrower';
                    b.phone = '';
                });

                const loan = await database.get('loans').create((l: any) => {
                    l.borrowerId = borrower.id;
                    l.loanNumber = 'LN-OD';
                    l.principalAmount = 1000;
                    l.totalAmount = 1200;
                    l.status = 'active';
                    l.releaseDate = now - 90 * dayMs;
                });

                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = loan.id;
                    s.scheduledAmount = 300;
                    s.status = 'pending';
                    s.dueDate = now - 40 * dayMs;
                });

                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = loan.id;
                    s.scheduledAmount = 250;
                    s.status = 'late';
                    s.dueDate = now - 10 * dayMs;
                });

                await database.get('payments').create((p: any) => {
                    p.loanId = loan.id;
                    p.borrowerId = borrower.id;
                    p.amount = 200;
                    p.paymentDate = now - 5 * dayMs;
                });

                await database.get('loan_penalties').create((p: any) => {
                    p.loanId = loan.id;
                    p.amount = 50;
                    p.reason = 'late';
                    p.status = 'unpaid';
                    p.penaltyDate = now - 5 * dayMs;
                });
            });

            const watchlist = await service.getOverdueWatchlist();

            expect(watchlist).toHaveLength(2);
            expect(watchlist[0]).toMatchObject({
                borrowerName: 'Overdue Borrower',
                amountDue: 300,
                loanBalance: 1050,
            });
            expect(watchlist[0].overdueDays).toBeGreaterThan(watchlist[1].overdueDays);
        });

        it('handles errors in getOverdueWatchlist', async () => {
            jest.spyOn(database.collections, 'get').mockImplementation(() => { throw new Error('Fail'); });
            expect(await service.getOverdueWatchlist()).toEqual([]);
        });
    });

    describe('getAgingClusters', () => {
        it('returns default buckets when no overdue data exists', async () => {
            const clusters = await service.getAgingClusters();
            expect(clusters.length).toBe(4);
            expect(clusters[0].label).toBe('1-7 Days');
        });

        it('aggregates outstanding schedule and penalty balances into aging buckets', async () => {
            const now = Date.now();

            await database.write(async () => {
                const borrower = await database.get('borrowers').create((b: any) => {
                    b.fullName = 'Bucket Borrower';
                });

                const loan = await database.get('loans').create((l: any) => {
                    l.borrowerId = borrower.id;
                    l.principalAmount = 1000;
                    l.totalAmount = 1000;
                    l.status = 'active';
                    l.releaseDate = now - 80 * dayMs;
                });

                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = loan.id;
                    s.scheduledAmount = 400;
                    s.status = 'pending';
                    s.dueDate = now - 5 * dayMs;
                });

                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = loan.id;
                    s.scheduledAmount = 600;
                    s.status = 'pending';
                    s.dueDate = now - 45 * dayMs;
                });

                await database.get('payments').create((p: any) => {
                    p.loanId = loan.id;
                    p.borrowerId = borrower.id;
                    p.amount = 250;
                    p.paymentDate = now - dayMs;
                });

                await database.get('loan_penalties').create((p: any) => {
                    p.loanId = loan.id;
                    p.amount = 100;
                    p.status = 'unpaid';
                    p.penaltyDate = now - dayMs;
                });
            });

            const clusters = await service.getAgingClusters();

            expect(clusters.find((bucket: any) => bucket.label === '1-7 Days')).toMatchObject({
                amount: 400,
                count: 1,
            });
            expect(clusters.find((bucket: any) => bucket.label === '31-60 Days')).toMatchObject({
                amount: 450,
                count: 1,
            });
        });

        it('handles errors in getAgingClusters', async () => {
            jest.spyOn(database.collections, 'get').mockImplementation(() => { throw new Error('Fail'); });
            expect(await service.getAgingClusters()).toEqual([]);
        });
    });

    describe('getAgingBucketDetails', () => {
        it('returns borrower drill-down rows for the requested overdue range', async () => {
            const now = Date.now();

            await database.write(async () => {
                const borrower = await database.get('borrowers').create((b: any) => {
                    b.fullName = 'Drill Borrower';
                    b.phone = '';
                });

                const loan = await database.get('loans').create((l: any) => {
                    l.borrowerId = borrower.id;
                    l.loanNumber = 'LN-DRILL';
                    l.principalAmount = 2000;
                    l.totalAmount = 2400;
                    l.status = 'active';
                    l.releaseDate = now - 70 * dayMs;
                });

                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = loan.id;
                    s.scheduledAmount = 300;
                    s.status = 'pending';
                    s.dueDate = now - 12 * dayMs;
                });

                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = loan.id;
                    s.scheduledAmount = 500;
                    s.status = 'pending';
                    s.dueDate = now - 55 * dayMs;
                });
            });

            const details = await service.getAgingBucketDetails(8, 30);

            expect(details).toHaveLength(1);
            expect(details[0]).toMatchObject({
                borrowerName: 'Drill Borrower',
                loanNumber: 'LN-DRILL',
                amountDue: 300,
                loanBalance: 300,
            });
            expect(details[0].overdueDays).toBeGreaterThanOrEqual(8);
            expect(details[0].overdueDays).toBeLessThanOrEqual(30);
        });

        it('handles errors in getAgingBucketDetails', async () => {
            jest.spyOn(database.collections, 'get').mockImplementation(() => { throw new Error('Fail'); });
            expect(await service.getAgingBucketDetails(1, 7)).toEqual([]);
        });
    });

    describe('getBalanceSheet', () => {
        it('handles empty data', async () => {
            const sheet = await service.getBalanceSheet();
            expect(sheet?.assets.loanPortfolio).toBe(0);
        });

        it('uses latest snapshot values and savings deposits in liabilities', async () => {
            const now = Date.now();
            (CashService.getCurrentBalance as jest.Mock).mockResolvedValue(300);
            (CashService.getCollectorBalance as jest.Mock)
                .mockResolvedValueOnce(40)
                .mockResolvedValueOnce(60);

            await database.write(async () => {
                await database.get('collectors').create((c: any) => {
                    c.fullName = 'Collector A';
                    c.isActive = true;
                });
                await database.get('collectors').create((c: any) => {
                    c.fullName = 'Collector B';
                    c.isActive = true;
                });

                const borrower = await database.get('borrowers').create((b: any) => {
                    b.fullName = 'Balance Borrower';
                });
                const loan = await database.get('loans').create((l: any) => {
                    l.borrowerId = borrower.id;
                    l.principalAmount = 1000;
                    l.totalAmount = 1200;
                    l.status = 'active';
                    l.releaseDate = now - 30 * dayMs;
                });
                await database.get('payments').create((p: any) => {
                    p.loanId = loan.id;
                    p.borrowerId = borrower.id;
                    p.amount = 200;
                    p.paymentDate = now - dayMs;
                });

                await database.get('financial_snapshots').create((s: any) => {
                    s.snapshotDate = now - dayMs;
                    s.totalAssets = 2000;
                    s.totalLiabilities = 500;
                    s.totalEquity = 1500;
                    s.riskWeightedAssets = 900;
                });
                await database.get('financial_snapshots').create((s: any) => {
                    s.snapshotDate = now - 10 * dayMs;
                    s.totalAssets = 100;
                    s.totalLiabilities = 50;
                    s.totalEquity = 50;
                });

                await database.get('savings_transactions').create((tx: any) => {
                    tx.borrowerId = borrower.id;
                    tx.type = 'deposit';
                    tx.amount = 400;
                    tx.date = now;
                });
                await database.get('savings_transactions').create((tx: any) => {
                    tx.borrowerId = borrower.id;
                    tx.type = 'withdraw_cash';
                    tx.amount = 125;
                    tx.date = now;
                });
            });

            const sheet = await service.getBalanceSheet();

            expect(sheet?.assets).toMatchObject({
                loanPortfolio: 1000,
                cashOnHand: 300,
                cashInTransit: 100,
                otherAssets: 600,
                totalAssets: 2000,
            });
            expect(sheet?.liabilities).toMatchObject({
                borrowings: 500,
                savingsDeposits: 275,
                totalLiabilities: 775,
            });
            expect(sheet?.equity.totalEquity).toBe(1500);
        });

        it('handles errors in getBalanceSheet', async () => {
            jest.spyOn(database.collections, 'get').mockImplementation(() => { throw new Error('Fail'); });
            expect(await service.getBalanceSheet()).toBeNull();
        });
    });

    describe('getIncomeStatement', () => {
        it('aggregates revenue, expenses, remittances, savings interest, and provisions', async () => {
            const start = Date.UTC(2026, 0, 1);
            const end = Date.UTC(2026, 0, 31);

            await database.write(async () => {
                const borrower = await database.get('borrowers').create((b: any) => {
                    b.fullName = 'Income Borrower';
                });
                const loan = await database.get('loans').create((l: any) => {
                    l.borrowerId = borrower.id;
                    l.principalAmount = 1000;
                    l.interestAmount = 200;
                    l.totalAmount = 1200;
                    l.status = 'active';
                    l.releaseDate = start;
                });
                await database.get('payments').create((p: any) => {
                    p.loanId = loan.id;
                    p.borrowerId = borrower.id;
                    p.amount = 600;
                    p.paymentDate = start + dayMs;
                });
                await database.get('expenses').create((e: any) => {
                    e.category = 'Rent';
                    e.amount = 100;
                    e.expenseDate = start + dayMs;
                });
                await database.get('expenses').create((e: any) => {
                    e.category = '';
                    e.amount = 50;
                    e.expenseDate = start + 2 * dayMs;
                });
                await database.get('remittances').create((r: any) => {
                    r.amount = 80;
                    r.status = 'approved';
                    r.remittanceDate = start + dayMs;
                });
                await database.get('remittances').create((r: any) => {
                    r.amount = 999;
                    r.status = 'pending';
                    r.remittanceDate = start + dayMs;
                });
                await database.get('savings_transactions').create((tx: any) => {
                    tx.borrowerId = borrower.id;
                    tx.type = 'interest';
                    tx.amount = 25;
                    tx.date = start + dayMs;
                });
                await database.get('financial_snapshots').create((s: any) => {
                    s.snapshotDate = start + dayMs;
                    s.financialCosts = 30;
                    s.loanLossReserve = 40;
                });
            });

            const statement = await service.getIncomeStatement(start, end);

            expect(statement).toMatchObject({
                operatingRevenue: 100,
                remittedRevenue: 80,
                operatingExpenses: 150,
                opExBreakdown: { Rent: 100, Other: 50 },
                financialCosts: 55,
                loanLossProvisions: 40,
                netIncome: -145,
                savingsInterestExpense: 25,
            });
        });

        it('handles errors in getIncomeStatement', async () => {
            jest.spyOn(database.collections, 'get').mockImplementation(() => { throw new Error('Fail'); });
            expect(await service.getIncomeStatement(0, 1)).toBeNull();
        });
    });

    describe('getDisbursements', () => {
        it('returns disbursements with borrower names sorted by release date descending', async () => {
            const start = Date.UTC(2026, 1, 1);
            const end = Date.UTC(2026, 1, 28);

            await database.write(async () => {
                const olderBorrower = await database.get('borrowers').create((b: any) => {
                    b.fullName = 'Older Borrower';
                });
                const newerBorrower = await database.get('borrowers').create((b: any) => {
                    b.fullName = 'Newer Borrower';
                });

                await database.get('loans').create((l: any) => {
                    l.borrowerId = olderBorrower.id;
                    l.loanNumber = 'LN-OLD';
                    l.principalAmount = 1000;
                    l.insuranceAmount = 10;
                    l.releaseDate = start + dayMs;
                    l.status = 'paid';
                });
                await database.get('loans').create((l: any) => {
                    l.borrowerId = newerBorrower.id;
                    l.loanNumber = 'LN-NEW';
                    l.principalAmount = 2000;
                    l.insuranceAmount = 20;
                    l.releaseDate = start + 10 * dayMs;
                    l.status = 'active';
                });
                await database.get('loans').create((l: any) => {
                    l.borrowerId = newerBorrower.id;
                    l.loanNumber = 'LN-VOID';
                    l.principalAmount = 3000;
                    l.releaseDate = start + 11 * dayMs;
                    l.status = 'pending';
                });
            });

            const disbursements = await service.getDisbursements(start, end);

            expect(disbursements.map((row: any) => row.loanNumber)).toEqual(['LN-NEW', 'LN-OLD']);
            expect(disbursements[0]).toMatchObject({
                borrowerName: 'Newer Borrower',
                principalAmount: 2000,
                insuranceAmount: 20,
            });
        });

        it('handles errors in getDisbursements', async () => {
            jest.spyOn(database.collections, 'get').mockImplementation(() => { throw new Error('Fail'); });
            expect(await service.getDisbursements(0, 1)).toEqual([]);
        });
    });

    describe('getAdvancedKpis', () => {
        it('calculates advanced KPI ratios from latest snapshot and active borrowers', async () => {
            const now = Date.now();

            await database.write(async () => {
                const femaleBorrower = await database.get('borrowers').create((b: any) => {
                    b.fullName = 'Female Borrower';
                    b.gender = 'female';
                });
                const maleBorrower = await database.get('borrowers').create((b: any) => {
                    b.fullName = 'Male Borrower';
                    b.gender = 'male';
                });

                await database.get('collectors').create((c: any) => {
                    c.fullName = 'Officer 1';
                    c.isActive = true;
                });
                await database.get('collectors').create((c: any) => {
                    c.fullName = 'Officer 2';
                    c.isActive = true;
                });

                const loan = await database.get('loans').create((l: any) => {
                    l.borrowerId = femaleBorrower.id;
                    l.principalAmount = 1000;
                    l.interestAmount = 200;
                    l.totalAmount = 1200;
                    l.status = 'active';
                    l.releaseDate = now - 10 * dayMs;
                });
                await database.get('loans').create((l: any) => {
                    l.borrowerId = maleBorrower.id;
                    l.principalAmount = 500;
                    l.totalAmount = 600;
                    l.status = 'paid';
                    l.releaseDate = now - 10 * dayMs;
                });
                await database.get('payments').create((p: any) => {
                    p.loanId = loan.id;
                    p.borrowerId = femaleBorrower.id;
                    p.amount = 600;
                    p.paymentDate = now - dayMs;
                });
                await database.get('expenses').create((e: any) => {
                    e.category = 'Ops';
                    e.amount = 25;
                    e.expenseDate = now - dayMs;
                });
                await database.get('financial_snapshots').create((s: any) => {
                    s.snapshotDate = now - dayMs;
                    s.totalAssets = 2000;
                    s.totalLiabilities = 500;
                    s.totalEquity = 1500;
                    s.riskWeightedAssets = 1000;
                    s.financialCosts = 5;
                    s.loanLossReserve = 10;
                });
            });

            const kpis = await service.getAdvancedKpis();

            expect(kpis).toMatchObject({
                roa: 3,
                roe: 4,
                debtToEquity: 1 / 3,
                car: 150,
                womenRatio: 50,
                borrowersPerLo: 0.5,
                avgLoanSize: 1000,
            });
        });

        it('handles errors in getAdvancedKpis', async () => {
            jest.spyOn(database.collections, 'get').mockImplementation(() => { throw new Error('Fail'); });
            const kpis = await service.getAdvancedKpis();
            expect(kpis.roa).toBe(0);
        });
    });

    describe('getCollectorEfficiency', () => {
        it('calculates current-month collection efficiency and sorts highest first', async () => {
            const now = Date.now();
            (CashService.getCollectorBalance as jest.Mock)
                .mockResolvedValueOnce(20)
                .mockResolvedValueOnce(10);

            await database.write(async () => {
                const collectorA = await database.get('collectors').create((c: any) => {
                    c.fullName = 'Collector A';
                    c.isActive = true;
                });
                const collectorB = await database.get('collectors').create((c: any) => {
                    c.fullName = 'Collector B';
                    c.isActive = true;
                });
                const borrower = await database.get('borrowers').create((b: any) => {
                    b.fullName = 'Efficiency Borrower';
                });
                const loanA = await database.get('loans').create((l: any) => {
                    l.borrowerId = borrower.id;
                    l.collectorId = collectorA.id;
                    l.principalAmount = 1000;
                    l.totalAmount = 1200;
                    l.status = 'active';
                });
                const loanB = await database.get('loans').create((l: any) => {
                    l.borrowerId = borrower.id;
                    l.collectorId = collectorB.id;
                    l.principalAmount = 1000;
                    l.totalAmount = 1200;
                    l.status = 'active';
                });

                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = loanA.id;
                    s.scheduledAmount = 100;
                    s.dueDate = now;
                    s.status = 'pending';
                });
                await database.get('payment_schedules').create((s: any) => {
                    s.loanId = loanB.id;
                    s.scheduledAmount = 100;
                    s.dueDate = now;
                    s.status = 'pending';
                });
                await database.get('payments').create((p: any) => {
                    p.loanId = loanA.id;
                    p.borrowerId = borrower.id;
                    p.collectorId = collectorA.id;
                    p.amount = 40;
                    p.paymentDate = now;
                });
                await database.get('payments').create((p: any) => {
                    p.loanId = loanB.id;
                    p.borrowerId = borrower.id;
                    p.collectorId = collectorB.id;
                    p.amount = 80;
                    p.paymentDate = now;
                });
            });

            const efficiencies = await service.getCollectorEfficiency();

            expect(efficiencies.map((row: any) => row.name)).toEqual(['Collector B', 'Collector A']);
            expect(efficiencies[0]).toMatchObject({
                collected: 80,
                target: 100,
                cashHeld: 10,
                efficiency: 80,
            });
            expect(efficiencies[1]).toMatchObject({
                collected: 40,
                target: 100,
                cashHeld: 20,
                efficiency: 40,
            });
        });

        it('handles errors in getCollectorEfficiency', async () => {
            jest.spyOn(database.collections, 'get').mockImplementation(() => { throw new Error('Fail'); });
            expect(await service.getCollectorEfficiency()).toEqual([]);
        });
    });

    describe('getSavingsReportData', () => {
        it('summarizes savings balances, recent activity, and top savers', async () => {
            const now = Date.now();

            await database.write(async () => {
                const borrowerA = await database.get('borrowers').create((b: any) => {
                    b.fullName = 'Saver A';
                });
                const borrowerB = await database.get('borrowers').create((b: any) => {
                    b.fullName = 'Saver B';
                });

                await database.get('savings_transactions').create((tx: any) => {
                    tx.borrowerId = borrowerA.id;
                    tx.type = 'deposit';
                    tx.amount = 500;
                    tx.date = now - dayMs;
                    tx.notes = 'initial';
                });
                await database.get('savings_transactions').create((tx: any) => {
                    tx.borrowerId = borrowerA.id;
                    tx.type = 'interest';
                    tx.amount = 20;
                    tx.date = now - dayMs;
                });
                await database.get('savings_transactions').create((tx: any) => {
                    tx.borrowerId = borrowerA.id;
                    tx.type = 'withdraw_cash';
                    tx.amount = 100;
                    tx.date = now - dayMs;
                });
                await database.get('savings_transactions').create((tx: any) => {
                    tx.borrowerId = borrowerB.id;
                    tx.type = 'deposit';
                    tx.amount = 300;
                    tx.date = now - 40 * dayMs;
                });
                await database.get('savings_transactions').create((tx: any) => {
                    tx.borrowerId = borrowerB.id;
                    tx.type = 'withdraw_loan';
                    tx.amount = 50;
                    tx.date = now - 2 * dayMs;
                });
            });

            const report = await service.getSavingsReportData();

            expect(report?.summary).toMatchObject({
                currentBalance: 670,
                totalDeposits: 800,
                totalWithdrawals: 150,
                totalInterest: 20,
                recentVelocity: 370,
                typeBreakdown: {
                    deposit: 800,
                    withdraw_cash: 100,
                    withdraw_loan: 50,
                    interest: 20,
                },
            });
            expect(report?.activity.map((row: any) => row.borrowerName)).toEqual(['Saver A', 'Saver A', 'Saver A', 'Saver B']);
            expect(report?.topSavers).toEqual([
                expect.objectContaining({ name: 'Saver A', balance: 420 }),
                expect.objectContaining({ name: 'Saver B', balance: 250 }),
            ]);
        });

        it('handles errors in getSavingsReportData', async () => {
            jest.spyOn(database.collections, 'get').mockImplementation(() => { throw new Error('Fail'); });
            expect(await service.getSavingsReportData()).toBeNull();
        });
    });

    describe('getRenewalReportData', () => {
        it('calculates renewal counts, volumes, rates, and six-month trend', async () => {
            await database.write(async () => {
                const borrower = await database.get('borrowers').create((b: any) => {
                    b.fullName = 'Renewal Borrower';
                });

                for (let month = 0; month < 7; month++) {
                    await database.get('loans').create((l: any) => {
                        l.borrowerId = borrower.id;
                        l.principalAmount = 100 * (month + 1);
                        l.totalAmount = 120 * (month + 1);
                        l.status = 'active';
                        l.isReloan = month % 2 === 0;
                        l.releaseDate = Date.UTC(2026, month, 5);
                    });
                }
            });

            const report = await service.getRenewalReportData();

            expect(report?.count).toMatchObject({
                total: 7,
                renewed: 4,
                new: 3,
                rate: (4 / 7) * 100,
            });
            expect(report?.volume).toMatchObject({
                renewed: 1600,
                new: 1200,
            });
            expect(report?.trend).toHaveLength(6);
            expect(report?.trend[0].month).toBe('2026-02');
            expect(report?.trend[5]).toMatchObject({
                month: '2026-07',
                renewed: 700,
                new: 0,
                total: 700,
            });
        });

        it('handles errors in getRenewalReportData', async () => {
            jest.spyOn(database.collections, 'get').mockImplementation(() => { throw new Error('Fail'); });
            expect(await service.getRenewalReportData()).toBeNull();
        });
    });

    describe('getActiveLoansReportData — error', () => {
        it('handles errors in getActiveLoansReportData', async () => {
            jest.spyOn(database.collections, 'get').mockImplementation(() => { throw new Error('Fail'); });
            expect(await service.getActiveLoansReportData()).toEqual([]);
        });
    });

});
