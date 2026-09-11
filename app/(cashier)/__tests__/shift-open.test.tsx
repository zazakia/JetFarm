import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ShiftOpenScreen from '../shift-open';
import { ShiftCashService } from '../../../src/services/ShiftCashService';
import { Alert } from 'react-native';

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

jest.mock('../../../src/store/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'cashier-user-1', email: 'cashier@poscursor.com' },
        branchId: 'branch-bagacay',
    }),
}));

jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

describe('ShiftOpenScreen — Open Shift button', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Alert, 'alert');
    });

    it('renders the Open Shift screen with the submit button', () => {
        const { getByText } = render(<ShiftOpenScreen />);
        expect(getByText('Open Shift Register')).toBeTruthy();
        expect(getByText('Confirm & Open Register')).toBeTruthy();
    });

    it('pressing Confirm & Open Register calls ShiftCashService.openShift with correct args', async () => {
        const openShiftSpy = jest
            .spyOn(ShiftCashService.prototype, 'openShift')
            .mockResolvedValue('shift-txn-001');

        const { getByText } = render(<ShiftOpenScreen />);
        fireEvent.press(getByText('Confirm & Open Register'));

        await waitFor(() => {
            expect(openShiftSpy).toHaveBeenCalledWith(
                'branch-bagacay',
                'cashier-user-1',
                2000,
                expect.any(String)
            );
        });
    });

    it('shows success Alert after shift opens successfully', async () => {
        jest.spyOn(ShiftCashService.prototype, 'openShift').mockResolvedValue('shift-txn-002');

        const { getByText } = render(<ShiftOpenScreen />);
        fireEvent.press(getByText('Confirm & Open Register'));

        await waitFor(() => {
            expect(Alert.alert).toHaveBeenCalledWith(
                'Till Opened',
                expect.stringContaining('PHP 2,000.00'),
                expect.any(Array)
            );
        });
    });

    it('shows error Alert if openShift throws (detects silent failure)', async () => {
        jest.spyOn(ShiftCashService.prototype, 'openShift').mockRejectedValue(
            new Error('Database write failure: cash_transactions not writable')
        );

        const { getByText } = render(<ShiftOpenScreen />);
        fireEvent.press(getByText('Confirm & Open Register'));

        await waitFor(() => {
            expect(Alert.alert).toHaveBeenCalledWith(
                'Error',
                expect.stringContaining('Database write failure')
            );
        });
    });

    it('validates invalid opening float and shows Alert without calling service', async () => {
        const openShiftSpy = jest.spyOn(ShiftCashService.prototype, 'openShift').mockResolvedValue('x');

        const { getByText, getByPlaceholderText } = render(<ShiftOpenScreen />);
        // Clear the default value and type NaN
        fireEvent.changeText(getByPlaceholderText('2000.00'), 'abc');
        fireEvent.press(getByText('Confirm & Open Register'));

        await waitFor(() => {
            expect(Alert.alert).toHaveBeenCalledWith(
                'Invalid Amount',
                expect.stringContaining('valid opening float amount')
            );
            expect(openShiftSpy).not.toHaveBeenCalled();
        });
    });
});
