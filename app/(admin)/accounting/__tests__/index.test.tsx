import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import AccountingDashboard from '../index';
import { ChartOfAccountsService } from '../../../../src/services/ChartOfAccountsService';
import { JournalEntryService } from '../../../../src/services/JournalEntryService';

// Mock dependencies
jest.mock('../../../../src/services/ChartOfAccountsService', () => ({
    ChartOfAccountsService: {
        isSeeded: jest.fn(),
        seed: jest.fn(),
    },
}));

jest.mock('../../../../src/services/AutoPostingService', () => ({
    AutoPostingService: {
        backfillUnpostedTransactions: jest.fn().mockResolvedValue({ postedCount: 0, errors: [] }),
    },
}));

jest.mock('../../../../src/services/JournalEntryService', () => ({
    JournalEntryService: {
        getTypeBalance: jest.fn(),
        getEntries: jest.fn(),
    },
    JournalEntryServiceClass: jest.fn().mockImplementation(() => ({
        getTypeBalance: jest.fn(),
        getEntries: jest.fn(),
    })),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
    useFocusEffect: (cb: any) => { require('react').useEffect(cb, []); },
}));

describe('AccountingDashboard Screen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (ChartOfAccountsService.isSeeded as jest.Mock).mockResolvedValue(true);
        (JournalEntryService.getTypeBalance as jest.Mock).mockResolvedValue(0);
        (JournalEntryService.getEntries as jest.Mock).mockResolvedValue([]);
    });

    it('renders setup screen when Chart of Accounts is not seeded', async () => {
        (ChartOfAccountsService.isSeeded as jest.Mock).mockResolvedValue(false);
        render(<AccountingDashboard />);

        await waitFor(() => {
            expect(screen.getByText('Accounting System Setup')).toBeTruthy();
            expect(screen.getByText(/Initialize Chart of Accounts/i)).toBeTruthy();
        });
    });

    it('seeds CoA and reloads dashboard when seed button is pressed', async () => {
        (ChartOfAccountsService.isSeeded as jest.Mock).mockResolvedValueOnce(false).mockResolvedValue(true);
        (ChartOfAccountsService.seed as jest.Mock).mockResolvedValue(35);
        render(<AccountingDashboard />);

        const seedBtn = await screen.findByText(/Initialize Chart of Accounts/i);
        fireEvent.press(seedBtn);

        await waitFor(() => {
            expect(ChartOfAccountsService.seed).toHaveBeenCalledWith('System');
            expect(ChartOfAccountsService.isSeeded).toHaveBeenCalled();
        });
    });

    it('renders overview balances when seeded', async () => {
        (JournalEntryService.getTypeBalance as jest.Mock).mockImplementation((type) => {
            if (type === 'asset') return Promise.resolve(100000);
            if (type === 'liability') return Promise.resolve(40000);
            if (type === 'equity') return Promise.resolve(60000);
            if (type === 'income') return Promise.resolve(15000);
            if (type === 'expense') return Promise.resolve(5000);
            return Promise.resolve(0);
        });

        render(<AccountingDashboard />);

        await waitFor(() => {
            expect(screen.getByText('Accounting Overview')).toBeTruthy();
            // Assets: 100,000 php formatted
            expect(screen.getByText('PHP 100,000.00')).toBeTruthy();
            // Liabilities: 40,000 php formatted
            expect(screen.getByText('PHP 40,000.00')).toBeTruthy();
            // Equity: 60,000 php formatted
            expect(screen.getByText('PHP 60,000.00')).toBeTruthy();
            // Net Surplus: 15,000 - 5,000 = 10,000 php formatted
            expect(screen.getByText('PHP 10,000.00')).toBeTruthy();
        });
    });

    it('renders recent transactions and navigates to details', async () => {
        const mockEntry = {
            id: 'je-1',
            description: 'Salaries Paid',
            referenceNumber: 'JE-2026-000001',
            entryDate: new Date('2026-07-01').getTime(),
            totalDebit: 15000,
            entryType: 'manual',
        };

        (JournalEntryService.getEntries as jest.Mock).mockResolvedValue([mockEntry]);
        render(<AccountingDashboard />);

        await waitFor(() => {
            expect(screen.getByText('Salaries Paid')).toBeTruthy();
            expect(screen.getByText(/JE-2026-000001/)).toBeTruthy();
        });

        fireEvent.press(screen.getByText('Salaries Paid'));
        expect(mockPush).toHaveBeenCalledWith('/(admin)/accounting/journal-entries?id=je-1');
    });

    it('navigates to journal entries list when View All is pressed', async () => {
        render(<AccountingDashboard />);
        
        await waitFor(() => {
            expect(screen.getByText('View All')).toBeTruthy();
        });

        fireEvent.press(screen.getByText('View All'));
        expect(mockPush).toHaveBeenCalledWith('/(admin)/accounting/journal-entries');
    });

    it('navigates to books of accounts screens from the dashboard grid', async () => {
        render(<AccountingDashboard />);

        await waitFor(() => {
            expect(screen.getByText('Books of Accounts')).toBeTruthy();
        });

        fireEvent.press(screen.getByText('Cash Receipts'));
        expect(mockPush).toHaveBeenCalledWith('/(admin)/accounting/crj');
    });
});
