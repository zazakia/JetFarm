import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { DigitalPaymentModal } from '../DigitalPaymentModal';
import { Alert } from 'react-native';

jest.useFakeTimers();

describe('DigitalPaymentModal', () => {
    const mockOnClose = jest.fn();
    const mockOnSuccess = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders modal content with channel options when visible', () => {
        const { getByText, getByPlaceholderText } = render(
            <DigitalPaymentModal
                visible={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                defaultAmount={750}
                title="Collect Digital Payment"
            />
        );

        expect(getByText('Collect Digital Payment')).toBeTruthy();
        expect(getByText('GCash')).toBeTruthy();
        expect(getByText('Maya')).toBeTruthy();
        expect(getByText('QR-Ph')).toBeTruthy();
        expect(getByPlaceholderText('0.00')).toBeTruthy();
    });

    it('switches channel when channel button is pressed', () => {
        const { getByText } = render(
            <DigitalPaymentModal
                visible={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
            />
        );

        fireEvent.press(getByText('Maya'));
        expect(getByText('Maya')).toBeTruthy();

        fireEvent.press(getByText('QR-Ph'));
        expect(getByText('QR-Ph')).toBeTruthy();
    });

    it('shows alert for invalid payment amount', () => {
        const { getByText, getByPlaceholderText } = render(
            <DigitalPaymentModal
                visible={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                defaultAmount={0}
            />
        );

        fireEvent.changeText(getByPlaceholderText('0.00'), '-100');
        fireEvent.press(getByText(/Process Payment/i));

        expect(alertSpy).toHaveBeenCalledWith('Invalid Amount', expect.any(String));
        expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('submits payment successfully with valid amount and channel', () => {
        const { getByText, getByPlaceholderText } = render(
            <DigitalPaymentModal
                visible={true}
                onClose={mockOnClose}
                onSuccess={mockOnSuccess}
                defaultAmount={1200}
            />
        );

        fireEvent.changeText(getByPlaceholderText('0.00'), '1500');
        fireEvent.press(getByText(/Process Payment/i));

        act(() => {
            jest.advanceTimersByTime(1300);
        });

        expect(mockOnSuccess).toHaveBeenCalledWith({
            method: 'GCash',
            referenceNo: expect.stringMatching(/^REF-/),
            amount: 1500,
        });
        expect(mockOnClose).toHaveBeenCalled();
    });
});
