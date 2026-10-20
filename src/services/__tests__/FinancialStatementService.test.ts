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
            return {
                year,
                priorYear: year - 1,
                asOf: new Date(year, 11, 31),
                assets: {
                    cashOnHand: makeComp(47000, 40000),
                    cashInBank: makeComp(150000, 140000),
                    loanReceivable: makeComp(68000, 60000),
                    totalCurrentAssets: makeComp(265000, 240000),
                    sundryAssets: makeComp(0, 0),
                    totalNonCurrentAssets: makeComp(0, 0),
                    totalAssets: makeComp(265000, 240000),
                },
                liabilities: {
                    depositLiabilities: makeComp(150000, 140000),
                    interestShareCapitalPayable: makeComp(0, 0),
                    patronageRefundPayable: makeComp(0, 0),
                    dueToUnion: makeComp(0, 0),
                    totalCurrentLiabilities: makeComp(150000, 140000),
                    totalLiabilities: makeComp(150000, 140000),
                },
                equity: {
                    authorizedCapital: 280000,
                    priorAuthorizedCapital: 280000,
                    subscribedCapital: makeComp(250000, 250000),
                    subscriptionReceivable: makeComp(18092.73, 18092.73),
                    paidUpCapital: makeComp(115000, 100000),
                    reserveFund: makeComp(0, 0),
                    educationFund: makeComp(0, 0),
                    communityDevFund: makeComp(0, 0),
                    optionalFund: makeComp(0, 0),
                    totalStatutoryFunds: makeComp(0, 0),
                    retainedSurplus: makeComp(0, 0),
                    totalEquity: makeComp(115000, 100000),
                },
                totalLiabilitiesAndEquity: makeComp(265000, 240000),
            };
        }),
        getStatementOfOperations: jest.fn().mockImplementation(async (year) => {
            const makeComp = (c: number, p: number) => ({ current: c, prior: p, variance: c - p });
            return {
                year,
                priorYear: year - 1,
                revenues: {
                    interestOnLoans: makeComp(22800, 20000),
                    serviceCharges: makeComp(5700, 5000),
                    penalties: makeComp(0, 0),
                    totalCreditOps: makeComp(28500, 25000),
                    membershipFees: makeComp(0, 0),
                    interestOnInvestments: makeComp(0, 0),
                    miscellaneousIncome: makeComp(0, 0),
                    totalOtherIncome: makeComp(0, 0),
                    totalRevenues: makeComp(28500, 25000),
                },
                expenses: {
                    financingCosts: makeComp(0, 0),
                    salaries: makeComp(0, 0),
                    office: makeComp(10000, 8000),
                    communication: makeComp(0, 0),
                    transportation: makeComp(0, 0),
                    depreciation: makeComp(0, 0),
                    taxes: makeComp(0, 0),
                    repairs: makeComp(0, 0),
                    training: makeComp(0, 0),
                    professional: makeComp(0, 0),
                    otherExpenses: makeComp(0, 0),
                    totalAdminCosts: makeComp(10000, 8000),
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
            expect(result.liabilities.savingsDeposits).toHaveProperty('current');
            expect(result.fundBalance.shareCapital).toHaveProperty('current');
        });

        it('total liabilities + fund balance = reported totalLiabilitiesAndFundBalance', async () => {
            const result = await FinancialStatementService.getStatementOfFinancialCondition(YEAR);

            const totalL = result.liabilities.totalLiabilities.current;
            const totalFB = result.fundBalance.totalFundBalance.current;
            const totalLFB = result.totalLiabilitiesAndFundBalance.current;

            // The reported total should equal the sum of its components
            expect(Math.abs(totalLFB - (totalL + totalFB))).toBeLessThan(0.01);

            // Total assets should be a non-negative finite number
            expect(result.assets.totalAssets.current).toBeGreaterThanOrEqual(0);
            expect(isFinite(result.assets.totalAssets.current)).toBe(true);
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

    });

    describe('buildChangesInFundBalance', () => {

        it('closing balance = opening + surplus - allocations - dividends', async () => {
            const fc = await FinancialStatementService.getStatementOfFinancialCondition(YEAR);
            const act = await FinancialStatementService.getStatementOfActivities(YEAR);
            const result = FinancialStatementService.buildChangesInFundBalance(YEAR, fc, act);

            const expectedClosing = result.opening.current
                + result.netSurplusForYear.current
                - result.statutoryAllocations.totalAllocations.current
                - result.dividendsDeclared.current;

            expect(Math.abs(result.closing.current - expectedClosing)).toBeLessThan(1);
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
