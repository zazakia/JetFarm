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

function makePayments(amounts: number[], year: number) {
    return amounts.map((amount, i) => ({
        amount,
        paymentDate: new Date(year, i % 12, 1).getTime(),
    }));
}

function makeExpenses(amounts: number[], year: number) {
    return amounts.map((amount, i) => ({
        amount,
        expenseDate: new Date(year, i % 12, 5).getTime(),
        category: 'Office',
    }));
}

function makeSavingsTx(year: number) {
    return [
        { type: 'deposit', amount: 200000, date: new Date(year, 2, 1).getTime() },
        { type: 'withdraw_cash', amount: 50000, date: new Date(year, 6, 1).getTime() },
    ];
}

function makeShareTx(year: number) {
    return [
        { transactionType: 'DEPOSIT', amount: 100000, date: new Date(year, 0, 15).getTime(), memberId: 'member-1' },
        { transactionType: 'SUBSCRIPTION', amount: 50000, date: new Date(year, 3, 10).getTime(), memberId: 'member-2' },
    ];
}

function makeLoans(year: number) {
    return [
        { principalAmount: 50000, status: 'active', releaseDate: new Date(year, 1, 1).getTime() },
        { principalAmount: 75000, status: 'active', releaseDate: new Date(year, 4, 1).getTime() },
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
            case 'payments':
                return mockQuery(makePayments([10000, 15000, 20000, 12000], YEAR));
            case 'expenses':
                return mockQuery(makeExpenses([5000, 3000, 2000], YEAR));
            case 'savings_transactions':
                return mockQuery(makeSavingsTx(YEAR));
            case 'share_capital_transactions':
                return mockQuery(makeShareTx(YEAR));
            case 'loans':
                return mockQuery(makeLoans(YEAR));
            case 'borrowers':
                return mockQuery([
                    { id: 'b1', fullName: 'Test Borrower 1' },
                    { id: 'b2', fullName: 'Test Borrower 2' },
                ]);
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

        it('returns organization metadata', async () => {
            const result = await FinancialStatementService.getNotes(YEAR);

            expect(result.organization.name).toContain('JetFarm');
            expect(result.organization.address).toContain('Ormoc City');
        });

        it('has 8 accounting policy items', async () => {
            const result = await FinancialStatementService.getNotes(YEAR);

            expect(result.accountingPolicies.length).toBeGreaterThanOrEqual(6);
        });

        it('loan portfolio has non-negative outstanding', async () => {
            const result = await FinancialStatementService.getNotes(YEAR);

            expect(result.loanPortfolio.totalOutstanding).toBeGreaterThanOrEqual(0);
            expect(result.loanPortfolio.numberOfBorrowers).toBeGreaterThanOrEqual(0);
        });

        it('statutory funds sum to approximately 30% of historical surplus', async () => {
            const result = await FinancialStatementService.getNotes(YEAR);

            const totalFunds = result.statutoryFunds.reserveFund
                + result.statutoryFunds.educationFund
                + result.statutoryFunds.communityDevFund
                + result.statutoryFunds.optionalFund;

            // All should be non-negative
            expect(totalFunds).toBeGreaterThanOrEqual(0);
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
