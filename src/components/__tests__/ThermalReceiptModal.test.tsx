import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThermalReceiptModal } from '../ThermalReceiptModal';
import { Alert } from 'react-native';

describe('ThermalReceiptModal', () => {
    const mockOnClose = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const dummyReceipt = {
        orNumber: 'OR-2026-9901',
        borrowerName: 'Maria Santos',
        loanCode: 'LN-2026-001',
        date: '2026-07-30',
        amountPaid: 1250,
        principalPaid: 1000,
        interestPaid: 200,
        penaltyPaid: 50,
        collectorName: 'Juan Dela Cruz',
        paymentMethod: 'GCash',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns null when receiptData is null', () => {
        const { queryByText } = render(
            <ThermalReceiptModal
                visible={true}
                onClose={mockOnClose}
                receiptData={null}
            />
        );

        expect(queryByText('Thermal Receipt Preview')).toBeNull();
    });

    it('renders thermal receipt preview details accurately', () => {
        const { getByText } = render(
            <ThermalReceiptModal
                visible={true}
                onClose={mockOnClose}
                receiptData={dummyReceipt}
            />
        );

        expect(getByText('Thermal Receipt Preview')).toBeTruthy();
        expect(getByText('POSCURSOR COOPERATIVE')).toBeTruthy();
        expect(getByText('OR #: OR-2026-9901')).toBeTruthy();
        expect(getByText('Maria Santos')).toBeTruthy();
        expect(getByText('LN-2026-001')).toBeTruthy();
        expect(getByText('GCash')).toBeTruthy();
        expect(getByText('Collector: Juan Dela Cruz')).toBeTruthy();
    });

    it('triggers thermal print alert when Print Thermal button is pressed', () => {
        const { getByText } = render(
            <ThermalReceiptModal
                visible={true}
                onClose={mockOnClose}
                receiptData={dummyReceipt}
            />
        );

        fireEvent.press(getByText('Print Thermal'));
        expect(alertSpy).toHaveBeenCalledWith(
            'Printing Receipt',
            expect.stringContaining('OR-2026-9901')
        );
    });

    it('calls onClose when Close button is pressed', () => {
        const { getByText } = render(
            <ThermalReceiptModal
                visible={true}
                onClose={mockOnClose}
                receiptData={dummyReceipt}
            />
        );

        fireEvent.press(getByText('Close'));
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
});
