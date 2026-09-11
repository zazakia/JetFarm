import React from 'react';
import { render, waitFor, screen } from '@testing-library/react-native';
import IncomeStatementScreen from '../income-statement';
import { CoopFinancialReportService } from '../../../../src/services/CoopFinancialReportService';

jest.mock('../../../../src/services/CoopFinancialReportService', () => ({
    CoopFinancialReportService: {
        getStatementOfOperations: jest.fn(),
    },
}));

jest.mock('../../../../src/services/BusinessUnitService', () => ({
    __esModule: true,
    BusinessUnitService: {
        getAll: jest.fn().mockResolvedValue([{ id: 'bu1', name: 'Coop Main', isActive: true }]),
    },
    default: {
        getAll: jest.fn().mockResolvedValue([{ id: 'bu1', name: 'Coop Main', isActive: true }]),
    },
}));

jest.mock('expo-router', () => ({
    useFocusEffect: (cb: any) => {
        require('react').useEffect(() => {
            cb();
        }, [cb]);
    },
    useRouter: () => ({
        push: jest.fn(),
        back: jest.fn(),
    }),
}));

const mockReportData = {
    year: 2025,
    priorYear: 2024,
    revenues: {
        interestOnLoans: { current: 15000, prior: 12000, variance: 3000 },
        serviceCharges: { current: 2000, prior: 1500, variance: 500 },
        penalties: { current: 500, prior: 300, variance: 200 },
        totalCreditOps: { current: 17500, prior: 13800, variance: 3700 },
        membershipFees: { current: 1000, prior: 800, variance: 200 },
        interestOnInvestments: { current: 300, prior: 200, variance: 100 },
        miscellaneousIncome: { current: 200, prior: 100, variance: 100 },
        totalOtherIncome: { current: 1500, prior: 1100, variance: 400 },
        totalRevenues: { current: 19000, prior: 14900, variance: 4100 },
    },
    expenses: {
        financingCosts: { current: 1000, prior: 800, variance: 200 },
        salaries: { current: 5000, prior: 4500, variance: 500 },
        office: { current: 1200, prior: 1000, variance: 200 },
        communication: { current: 300, prior: 250, variance: 50 },
        transportation: { current: 800, prior: 700, variance: 100 },
        depreciation: { current: 1500, prior: 1500, variance: 0 },
        taxes: { current: 200, prior: 150, variance: 50 },
        repairs: { current: 300, prior: 200, variance: 100 },
        training: { current: 500, prior: 400, variance: 100 },
        professional: { current: 600, prior: 500, variance: 100 },
        otherExpenses: { current: 400, prior: 300, variance: 100 },
        totalAdminCosts: { current: 10800, prior: 9500, variance: 1300 },
        totalExpenses: { current: 11800, prior: 10300, variance: 1500 },
    },
    netSurplus: { current: 7200, prior: 4600, variance: 2600 },
    allocations: [
        { fundType: 'Reserve Fund', percentage: 50, amount: 3600, priorAmount: 2300 },
        { fundType: 'Education and Training Fund-local', percentage: 5, amount: 360, priorAmount: 230 },
        { fundType: 'Due to Union/Federation', percentage: 5, amount: 360, priorAmount: 230 },
        { fundType: 'Community Development Fund', percentage: 3, amount: 216, priorAmount: 138 },
        { fundType: 'Optional Fund', percentage: 7, amount: 504, priorAmount: 322 },
        { fundType: 'Interest on share capital payable', percentage: 15, amount: 1080, priorAmount: 690 },
        { fundType: 'Patronage Refund Payable', percentage: 15, amount: 1080, priorAmount: 690 },
    ],
};

describe('IncomeStatementScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (CoopFinancialReportService.getStatementOfOperations as jest.Mock).mockResolvedValue(mockReportData);
    });

    it('renders official audited Statement of Operations layout correctly', async () => {
        render(<IncomeStatementScreen />);
        await waitFor(() => {
            expect(screen.getAllByText(/Statement of Operations/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/TOTAL REVENUES/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/TOTAL EXPENSES/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/Reserve Fund/i).length).toBeGreaterThan(0);
        });
    });
});
