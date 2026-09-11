import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import JournalEntriesScreen from '../journal-entries';
import { JournalEntryService } from '../../../../src/services/JournalEntryService';
import { ChartOfAccountsService } from '../../../../src/services/ChartOfAccountsService';

jest.mock('../../../../src/services/JournalEntryService', () => ({
    JournalEntryService: {
        getEntries: jest.fn(),
        getEntryById: jest.fn(),
        createEntry: jest.fn(),
        reverseEntry: jest.fn(),
    },
}));

jest.mock('../../../../src/services/ChartOfAccountsService', () => ({
    ChartOfAccountsService: {
        getActivePostableAccounts: jest.fn(),
    },
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
    useFocusEffect: (cb: any) => { require('react').useEffect(cb, []); },
    useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));

const mockEntry = {
    id: 'je-1',
    referenceNumber: 'JE-2026-000001',
    description: 'Loan Payment Received',
    entryDate: new Date(2026, 6, 1).getTime(),
    entryType: 'auto',
    totalDebit: 5000,
    totalCredit: 5000,
    isPosted: true,
};

const mockLines = [
    { id: 'l1', accountCode: '1010', accountName: 'Cash', debitAmount: 5000, creditAmount: 0 },
    { id: 'l2', accountCode: '1100', accountName: 'Loans Receivable', debitAmount: 0, creditAmount: 4000 },
    { id: 'l3', accountCode: '4010', accountName: 'Interest Income', debitAmount: 0, creditAmount: 1000 },
];

describe('JournalEntriesScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (JournalEntryService.getEntries as jest.Mock).mockResolvedValue([mockEntry]);
        (JournalEntryService.getEntryById as jest.Mock).mockResolvedValue({ entry: mockEntry, lines: mockLines });
        (ChartOfAccountsService.getActivePostableAccounts as jest.Mock).mockResolvedValue([]);
    });

    it('renders list of journal entries', async () => {
        render(<JournalEntriesScreen />);
        await waitFor(() => {
            expect(screen.getByText(/Loan Payment Received/i)).toBeTruthy();
            expect(screen.getByText(/JE-2026-000001/i)).toBeTruthy();
        });
    });

    it('shows entry detail modal when an entry is pressed', async () => {
        render(<JournalEntriesScreen />);

        const entry = await screen.findByText('Loan Payment Received');
        fireEvent.press(entry);

        await waitFor(() => {
            expect(JournalEntryService.getEntryById).toHaveBeenCalledWith('je-1');
            expect(screen.getByText(/Cash/i)).toBeTruthy();
            expect(screen.getByText(/Loans Receivable/i)).toBeTruthy();
        });
    });

    it('calls reverseEntry when Reverse Entry button is pressed', async () => {
        (JournalEntryService.reverseEntry as jest.Mock).mockResolvedValue({
            ...mockEntry,
            id: 'je-rev-1',
            entryType: 'reversing',
        });
        const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');

        render(<JournalEntriesScreen />);
        const entry = await screen.findByText(/Loan Payment Received/i);
        fireEvent.press(entry);

        const reverseBtn = await screen.findByText(/Reverse Entry/i);
        fireEvent.press(reverseBtn);

        const confirmBtn = (alertSpy.mock.calls[0][2] as any[]).find((b: any) => b.text === 'Confirm');
        confirmBtn.onPress();

        await waitFor(() => {
            expect(JournalEntryService.reverseEntry).toHaveBeenCalledWith('je-1', expect.any(String));
        });
    });
});
