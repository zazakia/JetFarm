import { buildAnnualReportHtml } from '../annualReportHtml';
import { AnnualReportData } from '../FinancialStatementService';
import { COMPANY_NAME_FULL } from '../../constants/brand';

const mockData: AnnualReportData = {
    year: 2026,
    priorYear: 2025,
    generatedAt: new Date('2026-07-04T12:00:00Z'),
    financialCondition: {
        year: 2026,
        priorYear: 2025,
        asOf: new Date('2026-12-31T00:00:00Z'),
        assets: {
            cashOnHand: { current: 50000, prior: 40000 },
            cashInBank: { current: 150000, prior: 100000 },
            loanReceivable: { current: 500000, prior: 450000 },
            savingsLoansReceivable: { current: 10000, prior: 5000 },
            otherReceivables: { current: 5000, prior: 2000 },
            sundryAssets: { current: 10000, prior: 10000 },
            totalCurrentAssets: { current: 715000, prior: 597000 },
            totalAssets: { current: 715000, prior: 597000 },
        },
        liabilities: {
            savingsDeposits: { current: 20000, prior: 15000 },
            shareCapitalPayable: { current: 0, prior: 0 },
            otherPayables: { current: 1000, prior: 500 },
            totalLiabilities: { current: 21000, prior: 15500 },
        },
        fundBalance: {
            shareCapital: { current: 30000, prior: 25000 },
            reserveFund: { current: 1000, prior: 500 },
            educationFund: { current: 1000, prior: 500 },
            communityDevFund: { current: 500, prior: 200 },
            optionalFund: { current: 500, prior: 200 },
            retainedSurplus: { current: 7000, prior: 3900 },
            totalFundBalance: { current: 40000, prior: 30300 },
        },
        totalLiabilitiesAndFundBalance: { current: 61000, prior: 45800 },
    },
    activities: {
        year: 2026,
        priorYear: 2025,
        revenues: {
            interestOnLoans: { current: 15000, prior: 12000 },
            serviceCharges: { current: 2000, prior: 1500 },
            membershipFees: { current: 100, prior: 50 },
            otherIncome: { current: 500, prior: 300 },
            totalRevenues: { current: 17600, prior: 13850 },
        },
        expenses: {
            salariesAndWages: { current: 5000, prior: 4000 },
            officeExpenses: { current: 2000, prior: 1500 },
            depreciationAndAmortization: { current: 1000, prior: 1000 },
            otherExpenses: { current: 1700, prior: 1500 },
            totalExpenses: { current: 9700, prior: 8000 },
        },
        netSurplus: { current: 7900, prior: 5850 },
    },
    changesInFundBalance: {
        year: 2026,
        priorYear: 2025,
        opening: { current: 30300, prior: 20000 },
        netSurplusForYear: { current: 7900, prior: 5850 },
        statutoryAllocations: {
            reserveFund: { current: 790, prior: 500 },
            educationFund: { current: 395, prior: 300 },
            communityDevFund: { current: 237, prior: 300 },
            optionalFund: { current: 553, prior: 1000 },
            totalAllocations: { current: 1975, prior: 2100 },
        },
        dividendsDeclared: { current: 3000, prior: 1350 },
        closing: { current: 40000, prior: 30300 },
    },
    cashFlows: {
        year: 2026,
        priorYear: 2025,
        operating: {
            items: [
                { label: 'Net Surplus', current: 7900, prior: 5850, inflow: true },
                { label: 'Increase in Savings', current: 5000, prior: 2000, inflow: true },
            ],
            netOperating: { current: 12900, prior: 7850 },
        },
        investing: {
            items: [],
            netInvesting: { current: 0, prior: 0 },
        },
        financing: {
            items: [
                { label: 'Increase in Share Capital', current: 5000, prior: 5000, inflow: true },
            ],
            netFinancing: { current: 5000, prior: 5000 },
        },
        netChange: { current: 17900, prior: 12850 },
        beginningCash: { current: 5000, prior: 1000 },
        endingCash: { current: 22900, prior: 13850 },
    },
    notes: {
        year: 2026,
        organization: {
            name: COMPANY_NAME_FULL,
            address: "P-2, Barangay Linao, Ormoc City, Leyte",
            registrationNumber: "9520-101400030514",
            dateRegistered: "2010-01-01",
            primaryPurpose: "Savings and Credit",
        },
        accountingPolicies: ["Accrual basis"],
        farmOperations: {
            numberOfParcels: 12,
            totalHectares: 34.5,
            activeCropCycles: 4,
            totalPlantedHectares: 28.25,
            expectedYieldKg: 90000,
            actualYieldKg: 76500,
        },
        productionCosts: {
            farmExpenses: 50000,
            laborPaid: 30000,
            landOwnerSettlements: 20000,
            totalProductionCost: 100000,
        },
        investorParticipation: {
            numberOfInvestors: 8,
            capitalInjected: 200000,
            offtakeDeductions: 120000,
            payoutsRefunded: 45000,
            netInvestorBalance: 35000,
        },
        statutoryFunds: {
            reserveFund: 1000,
            educationFund: 1000,
            communityDevFund: 500,
            optionalFund: 500,
        },
        relatedPartyNote: "None",
        eventsAfterReportingPeriod: "None",
    }
};

describe('annualReportHtml', () => {
    it('generates a valid HTML string for the annual report', () => {
        const html = buildAnnualReportHtml(mockData);
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain(COMPANY_NAME_FULL);
        expect(html).toContain('2026');
        expect(html).toContain('2025');
        
        // Check for specific statements
        expect(html).toContain('Statement of Financial Condition');
        expect(html).toContain('Statement of Activities');
        expect(html).toContain('Statement of Changes in Fund Balance');
        expect(html).toContain('Statement of Cash Flows');
        expect(html).toContain('Notes to Financial Statements');
        
        // Check for a specific numeric value (e.g., total assets current = 61,000)
        expect(html).toContain('61,000.00');
    });

    it('handles zero or missing values gracefully', () => {
        // Clone and zero out some data
        const zeroData = JSON.parse(JSON.stringify(mockData));
        // Need to fix Dates since JSON.parse(JSON.stringify()) converts Dates to strings
        zeroData.generatedAt = new Date(zeroData.generatedAt);
        zeroData.financialCondition.asOf = new Date(zeroData.financialCondition.asOf);

        zeroData.financialCondition.assets.cashOnHand.current = 0;
        
        const html = buildAnnualReportHtml(zeroData as AnnualReportData);
        // The php() formatter outputs '–' for 0
        expect(html).toContain('–');
    });
});
