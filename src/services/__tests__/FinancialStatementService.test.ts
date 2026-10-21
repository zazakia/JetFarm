/**
 * Tests for FinancialStatementService
 *
 * Validates:
 *  - Balance sheet equation: Assets = Liabilities + Fund Balance
 *  - Net surplus calculation: Revenue - Expenses = Net Surplus
 *  - Fund balance movement: Opening + Surplus = Closing (before allocations)
 *  - Cash flow net change computation
 *  - Prior-year comparative data structure
 *  - Notes quantitative disclosures
 */

import { FinancialStatementService } from '../FinancialStatementService';
import { COMPANY_NAME_FULL } from '../../constants/brand';

import { database } from '../../database';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../database', () => ({
    database: {
        get: jest.fn(),
        collections: {
            get: jest.fn(),
        },
    },
}));

jest.mock('../CoopFinancialReportService', () => ({
    CoopFinancialReportService: {
        getStatementOfFinancialCondition: jest.fn().mockImplementation(async (year) => {
            const makeComp = (c: number, p: number) => ({ current: c, prior: p, variance: c - p });
            // Internally consistent agribusiness figures: every subtotal is the sum of its own
            // components and A = L + E, so a mapping that reads the wrong key cannot pass by luck.
            //   current: 260000 assets = 110000 liabilities + 150000 equity
            //   prior:   240000 assets =  97000 liabilities + 143000 equity
            return {
                year,
                priorYear: year - 1,
                asOf: new Date(year, 11, 31),
                assets: {
                    cashOnHand: makeComp(10000, 8000),
                    cashInBank: makeComp(150000, 140000),
                    farmAssets: makeComp(68000, 60000),
                    otherReceivables: makeComp(32000, 32000),
                    totalCurrentAssets: makeComp(260000, 240000),
                    sundryAssets: makeComp(0, 0),
                    totalNonCurrentAssets: makeComp(0, 0),
                    totalAssets: makeComp(260000, 240000),
                },
                liabilities: {
                    settlementsPayable: makeComp(100000, 90000),
                    laborPayable: makeComp(5000, 4000),
                    accountsPayable: makeComp(3000, 2000),
                    otherPayables: makeComp(2000, 1000),
                    totalCurrentLiabilities: makeComp(110000, 97000),
                    totalLiabilities: makeComp(110000, 97000),
                },
                equity: {
                    authorizedCapital: 280000,
                    priorAuthorizedCapital: 280000,
                    subscribedCapital: makeComp(250000, 250000),
                    subscriptionReceivable: makeComp(150000, 155000),
                    paidUpCapital: makeComp(100000, 95000),
                    projectEquity: makeComp(40000, 35000),
                    reserveFund: makeComp(0, 0),
                    educationFund: makeComp(0, 0),
                    communityDevFund: makeComp(0, 0),
                    optionalFund: makeComp(0, 0),
                    totalStatutoryFunds: makeComp(0, 0),
                    retainedSurplus: makeComp(10000, 13000),
                    totalEquity: makeComp(150000, 143000),
                },
                totalLiabilitiesAndEquity: makeComp(260000, 240000),
            };
        }),
        getStatementOfOperations: jest.fn().mockImplementation(async (year) => {
            const makeComp = (c: number, p: number) => ({ current: c, prior: p, variance: c - p });
            // 28500 - 10000 = 18500; 25000 - 8000 = 17000, and the farm cost components add up.
            return {
                year,
                priorYear: year - 1,
                revenues: {
                    offtakeRevenue: makeComp(22800, 20000),
                    byproductRevenue: makeComp(5700, 5000),
                    otherRevenue: makeComp(0, 0),
                    totalRevenues: makeComp(28500, 25000),
                },
                expenses: {
                    farmProductionCosts: makeComp(10000, 8000),
                    landOwnerSettlements: makeComp(6000, 5000),
                    farmLabor: makeComp(2000, 1500),
                    farmInputs: makeComp(1500, 1000),
                    machineryAndLogistics: makeComp(400, 300),
                    otherFarmCosts: makeComp(100, 200),
                    salaries: makeComp(0, 0),
                    office: makeComp(0, 0),
                    communication: makeComp(0, 0),
                    transportation: makeComp(0, 0),
                    depreciation: makeComp(0, 0),
                    taxes: makeComp(0, 0),
                    repairs: makeComp(0, 0),
                    training: makeComp(0, 0),
                    professional: makeComp(0, 0),
                    otherExpenses: makeComp(0, 0),
                    totalAdminCosts: makeComp(0, 0),
                    totalExpenses: makeComp(10000, 8000),
                },
                netSurplus: makeComp(18500, 17000),
                allocations: [],
            };
        }),
    },
}));

jest.mock('../CashService', () => ({
    CashService: {
        getCurrentBalance: jest.fn().mockResolvedValue(50000),
    },
}));

const mockDb = database as jest.Mocked<typeof database>;

// ─── Sample WatermelonDB-like records ─────────────────────────────────────────

function makeCashIns(amounts: number[], year: number) {
    return amounts.map((amount, i) => ({
        amount,
        type: 'in',
        particulars: `Harvest cash receipt ${i + 1}`,
        transactionDate: new Date(year, i % 12, 1).getTime(),
    }));
}

function makeExpenses(amounts: number[], year: number) {
    return amounts.map((amount, i) => ({
        amount,
        expenseDate: new Date(year, i % 12, 5).getTime(),
        category: 'Office',
    }));
}

function makeParcels() {
    return [
        { id: 'p1', name: 'Linao 1', areaHectares: 2.5, status: 'planted' },
        { id: 'p2', name: 'Linao 2', areaHectares: 3, status: 'planted' },
        { id: 'p3', name: 'Linao 3', areaHectares: 1, status: 'fallow' },
    ];
}

function makeCropCycles(year: number) {
    return [
        {
            parcelId: 'p1', status: 'growing', areaPlantedHa: 2.5,
            expectedYieldKg: 4000, totalActualYieldKg: 3600,
            plantingDate: new Date(year, 1, 10).getTime(),
        },
        {
            parcelId: 'p2', status: 'completed', areaPlantedHa: 3,
            expectedYieldKg: 6000, totalActualYieldKg: 6450,
            plantingDate: new Date(year, 3, 2).getTime(),
        },
    ];
}

function makeFarmExpenses(year: number) {
    return [
        { amount: 4000, expenseDate: new Date(year, 0, 20).getTime() },
        { amount: 2500, expenseDate: new Date(year, 5, 4).getTime() },
    ];
}

function makeLaborLogs() {
    return [
        { totalPay: 1800, paymentStatus: 'paid' },
        { totalPay: 700, paymentStatus: 'pending' },
    ];
}

function makeSettlements() {
    return [
        { netPayoutDueThisWeek: 3200, paymentStatus: 'paid' },
    ];
}

function makeInvestorLedgers() {
    return [
        { type: 'capital_injection', amount: 50000 },
        { type: 'harvest_offtake', amount: 20000 },
        { type: 'payout_refund', amount: 5000 },
    ];
}

function makeInvestors() {
    return [
        { id: 'inv-1', name: 'Investor One' },
        { id: 'inv-2', name: 'Investor Two' },
    ];
}

function makeQueryChain(records: any[]) {
    return { fetch: jest.fn().mockResolvedValue(records) };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

const YEAR = 2025;
const PRIOR_YEAR = 2024;

beforeEach(() => {
    jest.clearAllMocks();

    const mockGet = (table: string) => {
        const mockQuery = (records: any[]) => ({ query: jest.fn(() => makeQueryChain(records)) });

        switch (table) {
            case 'cash_transactions':
                return mockQuery(makeCashIns([10000, 15000, 20000, 12000], YEAR));
            case 'expenses':
                return mockQuery(makeExpenses([5000, 3000, 2000], YEAR));
            case 'agri_parcels':
                return mockQuery(makeParcels());
            case 'agri_crop_cycles':
                return mockQuery(makeCropCycles(YEAR));
            case 'agri_farm_expenses':
                return mockQuery(makeFarmExpenses(YEAR));
            case 'agri_labor_logs':
                return mockQuery(makeLaborLogs());
            case 'agri_weekly_settlements':
                return mockQuery(makeSettlements());
            case 'agri_investor_ledgers':
                return mockQuery(makeInvestorLedgers());
            case 'agri_investors':
                return mockQuery(makeInvestors());
            default:
                return mockQuery([]);
        }
    };

    (mockDb.get as jest.Mock).mockImplementation(mockGet);
    (mockDb.collections.get as jest.Mock).mockImplementation(mockGet);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FinancialStatementService', () => {

    describe('getStatementOfFinancialCondition', () => {

        it('returns both current and prior year data', async () => {
            const result = await FinancialStatementService.getStatementOfFinancialCondition(YEAR);

            expect(result.year).toBe(YEAR);
            expect(result.priorYear).toBe(PRIOR_YEAR);
        });

        it('provides ComparativeAmount shape on all fields', async () => {
            const result = await FinancialStatementService.getStatementOfFinancialCondition(YEAR);

            expect(result.assets.cashOnHand).toHaveProperty('current');
            expect(result.assets.cashOnHand).toHaveProperty('prior');
            expect(result.liabilities.settlementsPayable).toHaveProperty('current');
            expect(result.fundBalance.shareCapital).toHaveProperty('current');
        });

        it('maps the agribusiness ledger lines through to the reported fields', async () => {
            const result = await FinancialStatementService.getStatementOfFinancialCondition(YEAR);

            expect(result.assets.farmAssets).toEqual({ current: 68000, prior: 60000 });
            expect(result.liabilities.settlementsPayable).toEqual({ current: 100000, prior: 90000 });
            expect(result.liabilities.laborPayable).toEqual({ current: 5000, prior: 4000 });
            expect(result.liabilities.accountsPayable).toEqual({ current: 3000, prior: 2000 });
            expect(result.liabilities.otherPayables).toEqual({ current: 2000, prior: 1000 });
            expect(result.fundBalance.projectEquity).toEqual({ current: 40000, prior: 35000 });
        });

        it('carries no lending or member-benefit line', async () => {
            const result = await FinancialStatementService.getStatementOfFinancialCondition(YEAR);

            for (const retired of ['loanReceivable', 'savingsLoansReceivable', 'savingsDeposits', 'shareCapitalPayable']) {
                expect(result.assets).not.toHaveProperty(retired);
                expect(result.liabilities).not.toHaveProperty(retired);
            }
            expect(result.fundBalance).not.toHaveProperty('dividendsPayable');
        });

        it('total liabilities + fund balance = reported totalLiabilitiesAndFundBalance', async () => {
            const result = await FinancialStatementService.getStatementOfFinancialCondition(YEAR);

            const totalL = result.liabilities.totalLiabilities.current;
            const totalFB = result.fundBalance.totalFundBalance.current;
            const totalLFB = result.totalLiabilitiesAndFundBalance.current;

            // The reported total should equal the sum of its components
            expect(Math.abs(totalLFB - (totalL + totalFB))).toBeLessThan(0.01);
            expect(totalL + totalFB).toBe(result.assets.totalAssets.current);

            // Total assets should be a non-negative finite number
            expect(result.assets.totalAssets.current).toBeGreaterThanOrEqual(0);
            expect(isFinite(result.assets.totalAssets.current)).toBe(true);
        });

        it('fund balance components add up to the reported total fund balance', async () => {
            const result = await FinancialStatementService.getStatementOfFinancialCondition(YEAR);
            const fb = result.fundBalance;

            const parts = fb.shareCapital.current + fb.projectEquity.current
                + fb.reserveFund.current + fb.educationFund.current
                + fb.communityDevFund.current + fb.optionalFund.current + fb.retainedSurplus.current;

            expect(Math.abs(fb.totalFundBalance.current - parts)).toBeLessThan(0.01);
        });

        it('does not return NaN in any numeric fields', async () => {
            const result = await FinancialStatementService.getStatementOfFinancialCondition(YEAR);

            expect(isNaN(result.assets.totalAssets.current)).toBe(false);
            expect(isNaN(result.liabilities.totalLiabilities.current)).toBe(false);
            expect(isNaN(result.fundBalance.totalFundBalance.current)).toBe(false);
        });

    });

    describe('getStatementOfActivities', () => {

        it('net surplus = total revenues minus total expenses', async () => {
            const result = await FinancialStatementService.getStatementOfActivities(YEAR);

            const expectedSurplus = result.revenues.totalRevenues.current - result.expenses.totalExpenses.current;
            expect(Math.abs(result.netSurplus.current - expectedSurplus)).toBeLessThan(0.01);
        });

        it('returns comparative year data', async () => {
            const result = await FinancialStatementService.getStatementOfActivities(YEAR);

            expect(result.year).toBe(YEAR);
            expect(result.priorYear).toBe(PRIOR_YEAR);
            expect(result.netSurplus).toHaveProperty('prior');
        });

        it('total expenses is non-negative', async () => {
            const result = await FinancialStatementService.getStatementOfActivities(YEAR);

            expect(result.expenses.totalExpenses.current).toBeGreaterThanOrEqual(0);
        });

        it('presents the harvest revenue and farm cost lines', async () => {
            const result = await FinancialStatementService.getStatementOfActivities(YEAR);

            expect(result.revenues.offtakeRevenue).toEqual({ current: 22800, prior: 20000 });
            expect(result.revenues.byproductRevenue).toEqual({ current: 5700, prior: 5000 });
            expect(result.revenues.otherIncome).toEqual({ current: 0, prior: 0 });
            expect(result.expenses.farmProductionCosts).toEqual({ current: 10000, prior: 8000 });

            // the farm cost components are what the group line reports
            const parts = 6000 + 2000 + 1500 + 400 + 100;
            expect(result.expenses.farmProductionCosts.current).toBe(parts);
        });

        it('carries no credit-operations revenue line', async () => {
            const result = await FinancialStatementService.getStatementOfActivities(YEAR);

            for (const retired of ['interestOnLoans', 'serviceCharges', 'membershipFees']) {
                expect(result.revenues).not.toHaveProperty(retired);
            }
        });

    });

    describe('buildChangesInFundBalance', () => {

        it('closing balance = opening + surplus - allocations', async () => {
            const fc = await FinancialStatementService.getStatementOfFinancialCondition(YEAR);
            const act = await FinancialStatementService.getStatementOfActivities(YEAR);
            const result = FinancialStatementService.buildChangesInFundBalance(YEAR, fc, act);

            const expectedClosing = result.opening.current
                + result.netSurplusForYear.current
                - result.statutoryAllocations.totalAllocations.current;

            expect(Math.abs(result.closing.current - expectedClosing)).toBeLessThan(1);
        });

        it('unallocated surplus is what the statutory appropriations leave behind', async () => {
            const fc = await FinancialStatementService.getStatementOfFinancialCondition(YEAR);
            const act = await FinancialStatementService.getStatementOfActivities(YEAR);
            const result = FinancialStatementService.buildChangesInFundBalance(YEAR, fc, act);

            const expected = act.netSurplus.current - result.statutoryAllocations.totalAllocations.current;
            expect(Math.abs(result.unallocatedSurplus.current - expected)).toBeLessThan(0.01);
        });

        it('statutory allocations sum to 30% of net surplus', async () => {
            const fc = await FinancialStatementService.getStatementOfFinancialCondition(YEAR);
            const act = await FinancialStatementService.getStatementOfActivities(YEAR);
            const result = FinancialStatementService.buildChangesInFundBalance(YEAR, fc, act);

            const expectedTotal = Math.round(act.netSurplus.current * 0.30 * 100) / 100;
            expect(Math.abs(result.statutoryAllocations.totalAllocations.current - expectedTotal)).toBeLessThan(0.05);
        });

    });

    describe('getStatementOfCashFlows', () => {

        it('net change = net operating + investing + financing', async () => {
            const result = await FinancialStatementService.getStatementOfCashFlows(YEAR);

            const expectedChange = result.operating.netOperating.current
                + result.investing.netInvesting.current
                + result.financing.netFinancing.current;

            expect(Math.abs(result.netChange.current - expectedChange)).toBeLessThan(0.01);
        });

        it('ending cash = beginning cash + net change', async () => {
            const result = await FinancialStatementService.getStatementOfCashFlows(YEAR);

            const expectedEnding = result.beginningCash.current + result.netChange.current;
            expect(Math.abs(result.endingCash.current - expectedEnding)).toBeLessThan(0.01);
        });

        it('has the correct comparative year fields', async () => {
            const result = await FinancialStatementService.getStatementOfCashFlows(YEAR);

            expect(result.year).toBe(YEAR);
            expect(result.priorYear).toBe(PRIOR_YEAR);
            expect(result.netChange).toHaveProperty('current');
            expect(result.netChange).toHaveProperty('prior');
        });

    });

    describe('getNotes', () => {

        it('returns organization metadata from the brand constant', async () => {
            const result = await FinancialStatementService.getNotes(YEAR);

            expect(result.organization.name).toBe(COMPANY_NAME_FULL);
            expect(result.organization.address).toContain('Ormoc City');
            expect(result.organization.primaryPurpose).toContain('crop production');
        });

        it('has at least six accounting policy items', async () => {
            const result = await FinancialStatementService.getNotes(YEAR);

            expect(result.accountingPolicies.length).toBeGreaterThanOrEqual(6);
        });

        it('farm operations note aggregates the parcel and crop-cycle feeds', async () => {
            const result = await FinancialStatementService.getNotes(YEAR);

            // 3 parcels; only the 'growing' cycle counts as active.
            expect(result.farmOperations.numberOfParcels).toBe(3);
            expect(result.farmOperations.totalHectares).toBeCloseTo(6.5, 2);
            expect(result.farmOperations.activeCropCycles).toBe(1);
            expect(result.farmOperations.totalPlantedHectares).toBeCloseTo(5.5, 2);
            expect(result.farmOperations.expectedYieldKg).toBe(10000);
            expect(result.farmOperations.actualYieldKg).toBe(10050);
        });

        it('investor participation note nets off-take and refunds against injected capital', async () => {
            const result = await FinancialStatementService.getNotes(YEAR);

            expect(result.investorParticipation.numberOfInvestors).toBe(2);
            expect(result.investorParticipation.capitalInjected).toBe(50000);
            expect(result.investorParticipation.offtakeDeductions).toBe(20000);
            expect(result.investorParticipation.payoutsRefunded).toBe(5000);
            expect(result.investorParticipation.netInvestorBalance).toBe(25000);
        });

        it('statutory funds sum to 30% of the historical surplus base', async () => {
            const result = await FinancialStatementService.getNotes(YEAR);

            // Cash in 57,000 − expenses 10,000 − farm inputs 6,500
            // − labour 2,500 − settlements 3,200 = 34,800 base.
            const base = 34800;
            expect(result.statutoryFunds.reserveFund).toBeCloseTo(base * 0.10, 2);
            expect(result.statutoryFunds.educationFund).toBeCloseTo(base * 0.10, 2);
            expect(result.statutoryFunds.communityDevFund).toBeCloseTo(base * 0.03, 2);
            expect(result.statutoryFunds.optionalFund).toBeCloseTo(base * 0.07, 2);

            const totalFunds = result.statutoryFunds.reserveFund
                + result.statutoryFunds.educationFund
                + result.statutoryFunds.communityDevFund
                + result.statutoryFunds.optionalFund;
            expect(totalFunds).toBeGreaterThanOrEqual(0);
            expect(totalFunds).toBeCloseTo(base * 0.30, 1);
        });

        it('floors every statutory fund at zero in a loss year', async () => {
            // A crop year that costs more than the receipts it produced carries
            // no distribable surplus, so it must not disclose negative reserves.
            (mockDb.get as jest.Mock).mockImplementation((table: string) => {
                const chain = (records: any[]) => ({ query: jest.fn(() => makeQueryChain(records)) });
                if (table === 'cash_transactions') return chain([{ amount: 1000, type: 'in' }]);
                if (table === 'expenses') return chain([{ amount: 9000, expenseDate: new Date(YEAR, 0, 1).getTime() }]);
                return chain([]);
            });

            const result = await FinancialStatementService.getNotes(YEAR);

            expect(result.statutoryFunds.reserveFund).toBe(0);
            expect(result.statutoryFunds.educationFund).toBe(0);
            expect(result.statutoryFunds.communityDevFund).toBe(0);
            expect(result.statutoryFunds.optionalFund).toBe(0);
        });

    });

    describe('getAnnualReportData', () => {

        it('assembles all five statements in one call', async () => {
            const result = await FinancialStatementService.getAnnualReportData(YEAR);

            expect(result).toHaveProperty('financialCondition');
            expect(result).toHaveProperty('activities');
            expect(result).toHaveProperty('changesInFundBalance');
            expect(result).toHaveProperty('cashFlows');
            expect(result).toHaveProperty('notes');
        });

        it('sets generatedAt to a recent date', async () => {
            const before = Date.now();
            const result = await FinancialStatementService.getAnnualReportData(YEAR);
            const after = Date.now();

            const ts = result.generatedAt.getTime();
            expect(ts).toBeGreaterThanOrEqual(before);
            expect(ts).toBeLessThanOrEqual(after);
        });

        it('year and priorYear are correctly set', async () => {
            const result = await FinancialStatementService.getAnnualReportData(YEAR);

            expect(result.year).toBe(YEAR);
            expect(result.priorYear).toBe(YEAR - 1);
        });

    });

});
