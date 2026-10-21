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
        getAll: jest.fn().mockResolvedValue([{ id: 'bu1', name: 'Agri-One Main', isActive: true }]),
    },
    default: {
        getAll: jest.fn().mockResolvedValue([{ id: 'bu1', name: 'Agri-One Main', isActive: true }]),
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

// Self-consistent so a mis-mapped key shows up as an arithmetic failure rather than a blank row:
// revenues 30,000 - expenses 20,800 = surplus 9,200; the four statutory funds take 30% (2,760)
// and the screen is expected to disclose the remaining 6,440 itself.
const amount = (current: number, prior: number) => ({ current, prior, variance: current - prior });

const mockReportData = {
    year: 2025,
    priorYear: 2024,
    revenues: {
        offtakeRevenue: amount(22800, 20000),
        byproductRevenue: amount(5700, 5000),
        otherRevenue: amount(1500, 1100),
        totalRevenues: amount(30000, 26100),
    },
    expenses: {
        farmProductionCosts: amount(10000, 8500),
        landOwnerSettlements: amount(4200, 3600),
        farmLabor: amount(3100, 2700),
        farmInputs: amount(1800, 1500),
        machineryAndLogistics: amount(600, 500),
        otherFarmCosts: amount(300, 200),
        salaries: amount(5000, 4500),
        office: amount(1200, 1000),
        communication: amount(300, 250),
        transportation: amount(800, 700),
        depreciation: amount(1500, 1500),
        taxes: amount(200, 150),
        repairs: amount(300, 200),
        training: amount(500, 400),
        professional: amount(600, 500),
        otherExpenses: amount(400, 300),
        totalAdminCosts: amount(10800, 9500),
        totalExpenses: amount(20800, 18000),
    },
    netSurplus: amount(9200, 8100),
    allocations: [
        { fundType: 'Reserve Fund', percentage: 10, amount: 920, priorAmount: 810 },
        { fundType: 'Education and Training Fund', percentage: 10, amount: 920, priorAmount: 810 },
        { fundType: 'Community Development Fund', percentage: 3, amount: 276, priorAmount: 243 },
        { fundType: 'Optional Fund', percentage: 7, amount: 644, priorAmount: 567 },
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

    it('presents the farm revenue and cost lines the crop cycle actually posts', async () => {
        render(<IncomeStatementScreen />);
        await waitFor(() => {
            expect(screen.getAllByText('Harvest Revenue').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Off-take delivered to buyer').length).toBeGreaterThan(0);
            expect(screen.getAllByText('By-product & residue sales').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Farm Production Costs').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Land-owner settlements').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Field labor').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Machinery & logistics').length).toBeGreaterThan(0);
        });
    });

    it('discloses the surplus the statutory funds leave behind instead of implying it', async () => {
        render(<IncomeStatementScreen />);
        await waitFor(() => {
            expect(screen.getAllByText('Retained — not appropriated').length).toBeGreaterThan(0);
        });
        // 9,200 surplus - 2,760 appropriated.
        expect(screen.getAllByText('6,440.00').length).toBeGreaterThan(0);
        expect(screen.getAllByText('NET SURPLUS (LOSS) FOR THE YEAR').length).toBeGreaterThan(0);
        expect(screen.getAllByText('9,200.00').length).toBeGreaterThan(0);
    });

    it('shows no lending or share-capital distribution line', async () => {
        render(<IncomeStatementScreen />);
        await waitFor(() => {
            expect(screen.getAllByText(/TOTAL REVENUES/i).length).toBeGreaterThan(0);
        });
        expect(screen.queryAllByText(/interest on loans|service charges|penalt|membership fee|patronage|share capital|due to union|financing cost/i)).toHaveLength(0);
    });
});
