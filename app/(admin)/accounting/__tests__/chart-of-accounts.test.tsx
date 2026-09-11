import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ChartOfAccountsScreen from '../chart-of-accounts';
import { ChartOfAccountsService } from '../../../../src/services/ChartOfAccountsService';

jest.mock('../../../../src/services/ChartOfAccountsService', () => ({
    ChartOfAccountsService: {
        getTree: jest.fn(),
        create: jest.fn(),
        softDelete: jest.fn(),
        setActive: jest.fn(),
        update: jest.fn(),
    },
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
    useFocusEffect: (cb: any) => { require('react').useEffect(cb, []); },
}));

const mockTree = {
    assets: [{ id: 'a1', code: '1010', name: 'Cash on Hand', accountType: 'asset', normalBalance: 'debit', isActive: true, isHeader: false, children: [] }],
    liabilities: [{ id: 'l1', code: '2010', name: 'Savings Payable', accountType: 'liability', normalBalance: 'credit', isActive: true, isHeader: false, children: [] }],
    equity: [],
    income: [],
    expenses: [],
};

describe('ChartOfAccountsScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (ChartOfAccountsService.getTree as jest.Mock).mockResolvedValue(mockTree);
    });

    it('renders account sections and account names', async () => {
        render(<ChartOfAccountsScreen />);
        await waitFor(() => {
            expect(screen.getByText(/Cash on Hand/)).toBeTruthy();
            expect(screen.getByText(/Savings Payable/)).toBeTruthy();
        });
    });

    it('opens add account modal and creates account on submit', async () => {
        (ChartOfAccountsService.create as jest.Mock).mockResolvedValue({ id: 'new-acc', code: '9999', name: 'Test Account' });
        render(<ChartOfAccountsScreen />);
        
        // Wait for screen to render then open modal
        const addBtn = await screen.findByTestId('add-account-btn');
        fireEvent.press(addBtn);

        await waitFor(() => {
            expect(screen.getByText(/Add New Account/i)).toBeTruthy();
        });

        // Fill fields and submit
        fireEvent.changeText(screen.getByPlaceholderText(/1011/i), '9999');
        fireEvent.changeText(screen.getByPlaceholderText(/Cash in Box/i), 'Test Account');
        fireEvent.press(screen.getByText('Create Account'));

        await waitFor(() => {
            expect(ChartOfAccountsService.create).toHaveBeenCalledWith(
                expect.objectContaining({ code: '9999', name: 'Test Account' }),
                expect.any(String)
            );
        });
    });

    it('shows delete confirmation and soft-deletes account', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        (ChartOfAccountsService.softDelete as jest.Mock).mockResolvedValue(undefined);
        render(<ChartOfAccountsScreen />);

        const deleteBtn = await screen.findByTestId('delete-1010');
        fireEvent.press(deleteBtn);

        expect(alertSpy).toHaveBeenCalledWith(
            'Confirm Delete',
            expect.stringContaining('Cash on Hand'),
            expect.any(Array)
        );

        const alertCall = alertSpy.mock.calls.find(([title]) => title === 'Confirm Delete');
        const buttons = alertCall?.[2] as { text?: string; onPress?: () => void }[];
        const confirmBtn = buttons?.find(b => b.text === 'Delete');
        await confirmBtn?.onPress?.();

        await waitFor(() => {
            expect(ChartOfAccountsService.softDelete).toHaveBeenCalledWith('a1', expect.any(String));
        });
    });
});
