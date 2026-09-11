import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CashDropScreen from '../cash-drop';
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

describe('CashDropScreen — Confirm Safe Transfer button', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Alert, 'alert');
    });

    it('renders the Cash Drop screen with the submit button', () => {
        const { getByText } = render(<CashDropScreen />);
        expect(getByText('Mid-Shift Cash Drop')).toBeTruthy();
        expect(getByText('Confirm Safe Transfer')).toBeTruthy();
    });

    it('pressing Confirm Safe Transfer calls recordCashDrop with correct amount and branch', async () => {
        const recordDropSpy = jest
            .spyOn(ShiftCashService.prototype, 'recordCashDrop')
            .mockResolvedValue('cash-drop-001');

        const { getByText, getByPlaceholderText } = render(<CashDropScreen />);
        // Enter amount via text input
        fireEvent.changeText(getByPlaceholderText('5000.00'), '3500');
        fireEvent.press(getByText('Confirm Safe Transfer'));

        await waitFor(() => {
            expect(recordDropSpy).toHaveBeenCalledWith(
                'branch-bagacay',
                'cashier-user-1',
                3500,
                expect.any(String)
            );
        });
    });

    it('preset buttons (₱2,000 / ₱5,000 / ₱10,000) set the amount correctly', async () => {
        const recordDropSpy = jest
            .spyOn(ShiftCashService.prototype, 'recordCashDrop')
            .mockResolvedValue('cash-drop-002');

        const { getByText } = render(<CashDropScreen />);
        // Tap the ₱5,000 preset
        fireEvent.press(getByText('₱5,000'));
        fireEvent.press(getByText('Confirm Safe Transfer'));

        await waitFor(() => {
            expect(recordDropSpy).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                5000,
                expect.any(String)
            );
        });
    });

    it('shows success Alert after cash drop is recorded', async () => {
        jest.spyOn(ShiftCashService.prototype, 'recordCashDrop').mockResolvedValue('cash-drop-003');

        const { getByText, getByPlaceholderText } = render(<CashDropScreen />);
        fireEvent.changeText(getByPlaceholderText('5000.00'), '2000');
        fireEvent.press(getByText('Confirm Safe Transfer'));

        await waitFor(() => {
            expect(Alert.alert).toHaveBeenCalledWith(
                'Cash Drop Recorded',
                expect.stringContaining('PHP 2,000.00'),
                expect.any(Array)
            );
        });
    });

    it('shows error Alert if recordCashDrop throws (detects silent failure)', async () => {
        jest.spyOn(ShiftCashService.prototype, 'recordCashDrop').mockRejectedValue(
            new Error('Database write failure: cash_transactions not writable')
        );

        const { getByText, getByPlaceholderText } = render(<CashDropScreen />);
        fireEvent.changeText(getByPlaceholderText('5000.00'), '5000');
        fireEvent.press(getByText('Confirm Safe Transfer'));

        await waitFor(() => {
            expect(Alert.alert).toHaveBeenCalledWith(
                'Error',
                expect.stringContaining('Database write failure')
            );
        });
    });

    it('validates zero/empty amount and shows Alert without calling service', async () => {
        const recordDropSpy = jest
            .spyOn(ShiftCashService.prototype, 'recordCashDrop')
            .mockResolvedValue('x');

        const { getByText } = render(<CashDropScreen />);
        // Amount field is empty by default (state = '')
        fireEvent.press(getByText('Confirm Safe Transfer'));

        await waitFor(() => {
            expect(Alert.alert).toHaveBeenCalledWith(
                'Invalid Amount',
                expect.stringContaining('valid cash drop amount')
            );
            expect(recordDropSpy).not.toHaveBeenCalled();
        });
    });
});
