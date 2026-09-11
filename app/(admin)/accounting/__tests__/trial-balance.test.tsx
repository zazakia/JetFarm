import React from 'react';
import { render, waitFor, screen } from '@testing-library/react-native';
import TrialBalanceScreen from '../trial-balance';
import { JournalEntryService } from '../../../../src/services/JournalEntryService';

jest.mock('../../../../src/services/JournalEntryService', () => ({
    JournalEntryService: {
        getTrialBalance: jest.fn(),
    },
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
    useFocusEffect: (cb: any) => { require('react').useEffect(cb, []); },
}));

const mockTrialBalance = {
    isBalanced: true,
    totalDebits: 15000,
    totalCredits: 15000,
    rows: [
        { code: '1010', name: 'Cash on Hand', accountType: 'asset', totalDebit: 15000, totalCredit: 5000, netBalance: 10000 },
        { code: '4010', name: 'Interest Income', accountType: 'income', totalDebit: 0, totalCredit: 3000, netBalance: 3000 },
        { code: '1100', name: 'Loans Receivable', accountType: 'asset', totalDebit: 0, totalCredit: 5000, netBalance: -5000 },
        { code: '5010', name: 'Salaries', accountType: 'expense', totalDebit: 2000, totalCredit: 0, netBalance: 2000 },
    ],
};

describe('TrialBalanceScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (JournalEntryService.getTrialBalance as jest.Mock).mockResolvedValue(mockTrialBalance);
    });

    it('renders the trial balance table with account rows', async () => {
        render(<TrialBalanceScreen />);
        await waitFor(() => {
            expect(screen.getByText('Cash on Hand')).toBeTruthy();
            expect(screen.getByText('Interest Income')).toBeTruthy();
            expect(screen.getByText('Loans Receivable')).toBeTruthy();
            expect(screen.getByText('Salaries')).toBeTruthy();
        });
    });

    it('shows Balanced badge when debits equal credits', async () => {
        render(<TrialBalanceScreen />);
        await waitFor(() => {
            expect(screen.getByText(/Balanced/i)).toBeTruthy();
        });
    });

    it('shows totals for debits and credits', async () => {
        render(<TrialBalanceScreen />);
        await waitFor(() => {
            // At minimum, total amounts should appear
            expect(screen.getAllByText('PHP 15,000.00').length).toBeGreaterThan(0);
        });
    });

    it('shows Out of Balance badge when debits do not equal credits', async () => {
        (JournalEntryService.getTrialBalance as jest.Mock).mockResolvedValue({
            ...mockTrialBalance,
            isBalanced: false,
            totalDebits: 15000,
            totalCredits: 14000,
        });

        render(<TrialBalanceScreen />);
        await waitFor(() => {
            expect(screen.getByText(/Out of Balance/i)).toBeTruthy();
        });
    });
});
