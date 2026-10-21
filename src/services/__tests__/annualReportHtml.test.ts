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
        // Self-consistent agribusiness figures: current 715,000 assets = 26,000 liabilities
        // + 689,000 fund balance; prior 602,000 = 19,000 + 583,000.
        assets: {
            cashOnHand: { current: 50000, prior: 40000 },
            cashInBank: { current: 150000, prior: 100000 },
            farmAssets: { current: 500000, prior: 450000 },
            otherReceivables: { current: 5000, prior: 2000 },
            sundryAssets: { current: 10000, prior: 10000 },
            totalCurrentAssets: { current: 705000, prior: 592000 },
            totalAssets: { current: 715000, prior: 602000 },
        },
        liabilities: {
            settlementsPayable: { current: 20000, prior: 15000 },
            laborPayable: { current: 4000, prior: 3000 },
            accountsPayable: { current: 1000, prior: 500 },
            otherPayables: { current: 1000, prior: 500 },
            totalLiabilities: { current: 26000, prior: 19000 },
        },
        fundBalance: {
            shareCapital: { current: 30000, prior: 25000 },
            projectEquity: { current: 600000, prior: 500000 },
            reserveFund: { current: 1000, prior: 500 },
            educationFund: { current: 1000, prior: 500 },
            communityDevFund: { current: 500, prior: 200 },
            optionalFund: { current: 500, prior: 200 },
            retainedSurplus: { current: 56000, prior: 56600 },
            totalFundBalance: { current: 689000, prior: 583000 },
        },
        totalLiabilitiesAndFundBalance: { current: 715000, prior: 602000 },
    },
    activities: {
        year: 2026,
        priorYear: 2025,
        revenues: {
            offtakeRevenue: { current: 15000, prior: 12000 },
            byproductRevenue: { current: 2000, prior: 1500 },
            otherIncome: { current: 600, prior: 350 },
            totalRevenues: { current: 17600, prior: 13850 },
        },
        expenses: {
            farmProductionCosts: { current: 7000, prior: 6000 },
            salariesAndWages: { current: 2000, prior: 1500 },
            officeExpenses: { current: 300, prior: 200 },
            depreciationAndAmortization: { current: 200, prior: 100 },
            otherExpenses: { current: 100, prior: 100 },
            totalExpenses: { current: 9600, prior: 7900 },
        },
        netSurplus: { current: 8000, prior: 5950 },
    },
    changesInFundBalance: {
        year: 2026,
        priorYear: 2025,
        opening: { current: 30300, prior: 20000 },
        netSurplusForYear: { current: 8000, prior: 5950 },
        statutoryAllocations: {
            reserveFund: { current: 800, prior: 600 },
            educationFund: { current: 800, prior: 600 },
            communityDevFund: { current: 240, prior: 175 },
            optionalFund: { current: 560, prior: 375 },
            totalAllocations: { current: 2400, prior: 1750 },
        },
        unallocatedSurplus: { current: 5600, prior: 4200 },
        closing: { current: 35900, prior: 24200 },
    },
    cashFlows: {
        year: 2026,
        priorYear: 2025,
        operating: {
            items: [
                { label: 'Net Surplus', current: 8000, prior: 5950, inflow: true },
                { label: 'Harvest Receipts Collected', current: 4900, prior: 1900, inflow: true },
            ],
            netOperating: { current: 12900, prior: 7850 },
        },
        investing: {
            items: [],
            netInvesting: { current: 0, prior: 0 },
        },
        financing: {
            items: [
                { label: 'Investor Capital Injected', current: 5000, prior: 5000, inflow: true },
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
            primaryPurpose: "Developing agricultural land into crop production cycles shared with land owners and investors",
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
        
        // Check for a specific numeric value (total assets current = 715,000)
        expect(html).toContain('715,000.00');
    });

    it('renders the agribusiness statement lines', () => {
        const html = buildAnnualReportHtml(mockData);

        expect(html).toContain('Standing Crops, Produce & Farm Inputs');
        expect(html).toContain('Land-Owner Settlements Payable');
        expect(html).toContain('Field Labor Payable');
        expect(html).toContain('Project & Partner Equity');
        expect(html).toContain('Harvest Off-take Revenue');
        expect(html).toContain('Farm Production Costs');
        expect(html).toContain('Surplus Not Appropriated (Retained)');
    });

    it('carries no lending or member-benefit wording anywhere in the report', () => {
        const html = buildAnnualReportHtml(mockData);

        for (const retired of [
            'Loan Receivables', 'Member Savings Deposits', 'Share Capital Payable',
            'Interest Income on Loans', 'Service Charges and Fees', 'Membership Fees',
            'Dividends Declared', 'Loan Operations', 'savings and credit',
        ]) {
            expect(html).not.toContain(retired);
        }
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
