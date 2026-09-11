import React from 'react';
import { render, waitFor, screen } from '@testing-library/react-native';
import GeneralLedgerScreen from '../general-ledger';
import { ChartOfAccountsService } from '../../../../src/services/ChartOfAccountsService';
import { JournalEntryService } from '../../../../src/services/JournalEntryService';

jest.mock('../../../../src/services/ChartOfAccountsService', () => ({
    ChartOfAccountsService: {
        getActivePostableAccounts: jest.fn(),
    },
}));

jest.mock('../../../../src/services/JournalEntryService', () => ({
    JournalEntryService: {
        getLedger: jest.fn(),
    },
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
    useFocusEffect: (cb: any) => { require('react').useEffect(cb, []); },
    useLocalSearchParams: () => ({}),
}));

const mockAccounts = [
    { id: 'a1', code: '1010', name: 'Cash on Hand', accountType: 'asset', isActive: true },
    { id: 'a2', code: '4010', name: 'Interest Income', accountType: 'income', isActive: true },
];

const mockLedger = [
    {
        date: new Date(2026, 0, 1).getTime(),
        description: 'Loan disbursed',
        referenceNumber: 'JE-2026-000001',
        debit: 5000,
        credit: 0,
        balance: 5000,
    },
    {
        date: new Date(2026, 0, 5).getTime(),
        description: 'Interest earned',
        referenceNumber: 'JE-2026-000002',
        debit: 0,
        credit: 1000,
        balance: 4000,
    },
];

describe('GeneralLedgerScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (ChartOfAccountsService.getActivePostableAccounts as jest.Mock).mockResolvedValue(mockAccounts);
        (JournalEntryService.getLedger as jest.Mock).mockResolvedValue(mockLedger);
    });

    it('renders account list selector', async () => {
        render(<GeneralLedgerScreen />);
        await waitFor(() => {
            expect(screen.getByText(/Cash on Hand/i)).toBeTruthy();
            expect(screen.getByText(/Interest Income/i)).toBeTruthy();
        });
    });

    it('renders ledger rows with debit, credit and balance columns', async () => {
        render(<GeneralLedgerScreen />);
        await waitFor(() => {
            expect(screen.getByText('Loan disbursed')).toBeTruthy();
            expect(screen.getByText('JE-2026-000001')).toBeTruthy();
            expect(screen.getAllByText('PHP 5,000.00').length).toBeGreaterThan(0);
        });
    });
});
