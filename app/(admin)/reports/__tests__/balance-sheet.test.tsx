import React from 'react';
import { render, waitFor, screen } from '@testing-library/react-native';
import BalanceSheetScreen from '../balance-sheet';
import { CoopFinancialReportService } from '../../../../src/services/CoopFinancialReportService';

jest.mock('../../../../src/services/CoopFinancialReportService', () => ({
    CoopFinancialReportService: {
        getStatementOfFinancialCondition: jest.fn(),
    },
}));

jest.mock('../../../../src/services/BusinessUnitService', () => ({
    BusinessUnitService: {
        getAll: jest.fn().mockResolvedValue([{ id: 'bu1', name: 'Coop Main', isActive: true }]),
    },
}));

jest.mock('expo-router', () => ({
    useFocusEffect: (cb: any) => { require('react').useEffect(cb, []); },
    useRouter: () => ({
        push: jest.fn(),
        back: jest.fn(),
    }),
}));

const mockReportData = {
    year: 2025,
    priorYear: 2024,
    asOf: new Date(2025, 11, 31),
    // Self-consistent agribusiness figures: current 392,000 assets = 82,700 liabilities
    // + 309,300 equity; prior 362,000 = 77,250 + 284,750.
    assets: {
        cashOnHand: { current: 15000, prior: 10000, variance: 5000 },
        cashInBank: { current: 45000, prior: 40000, variance: 5000 },
        farmAssets: { current: 180000, prior: 170000, variance: 10000 },
        otherReceivables: { current: 32000, prior: 32000, variance: 0 },
        totalCurrentAssets: { current: 272000, prior: 252000, variance: 20000 },
        sundryAssets: { current: 120000, prior: 110000, variance: 10000 },
        totalNonCurrentAssets: { current: 120000, prior: 110000, variance: 10000 },
        totalAssets: { current: 392000, prior: 362000, variance: 30000 },
    },
    liabilities: {
        settlementsPayable: { current: 80000, prior: 75000, variance: 5000 },
        laborPayable: { current: 1200, prior: 1000, variance: 200 },
        accountsPayable: { current: 1200, prior: 1000, variance: 200 },
        otherPayables: { current: 300, prior: 250, variance: 50 },
        totalCurrentLiabilities: { current: 82700, prior: 77250, variance: 5450 },
        totalLiabilities: { current: 82700, prior: 77250, variance: 5450 },
    },
    equity: {
        authorizedCapital: 280000,
        priorAuthorizedCapital: 280000,
        subscribedCapital: { current: 250000, prior: 250000, variance: 0 },
        subscriptionReceivable: { current: 18092.73, prior: 18092.73, variance: 0 },
        paidUpCapital: { current: 231907.27, prior: 231907.27, variance: 0 },
        projectEquity: { current: 10000, prior: 10000, variance: 0 },
        reserveFund: { current: 20000, prior: 15000, variance: 5000 },
        educationFund: { current: 2000, prior: 1500, variance: 500 },
        communityDevFund: { current: 1000, prior: 800, variance: 200 },
        optionalFund: { current: 3000, prior: 2500, variance: 500 },
        totalStatutoryFunds: { current: 26000, prior: 19800, variance: 6200 },
        retainedSurplus: { current: 41392.73, prior: 23042.73, variance: 18350 },
        totalEquity: { current: 309300, prior: 284750, variance: 24550 },
    },
    totalLiabilitiesAndEquity: { current: 392000, prior: 362000, variance: 30000 },
};

describe('BalanceSheetScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (CoopFinancialReportService.getStatementOfFinancialCondition as jest.Mock).mockResolvedValue(mockReportData);
    });

    it('renders official audited balance sheet layout correctly', async () => {
        render(<BalanceSheetScreen />);
        await waitFor(() => {
            expect(screen.getAllByText(/Statement of Financial Condition/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/TOTAL ASSETS/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/TOTAL LIABILITIES/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/TOTAL EQUITY/i).length).toBeGreaterThan(0);
        });
    });

    it('presents the agribusiness ledger lines rather than the retired lending book', async () => {
        render(<BalanceSheetScreen />);
        await waitFor(() => {
            expect(screen.getAllByText('Standing Crops, Produce & Farm Inputs').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Other Receivables').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Land-Owner Settlements Payable').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Field Labor Payable').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Accounts Payable').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Project & Partner Equity').length).toBeGreaterThan(0);
        });

        expect(screen.queryAllByText(/loan|savings|patronage|due to union|share capital payable/i)).toHaveLength(0);
    });
});
