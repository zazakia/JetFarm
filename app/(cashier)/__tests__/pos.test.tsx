import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CashierPosScreen from '../pos';
import { QSRPosService } from '../../../src/services/QSRPosService';
import { Alert } from 'react-native';

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

jest.mock('../../../src/store/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'cashier-user-1', email: 'cashier@poscursor.com' },
        branchId: 'branch-bagacay',
    }),
}));

describe('CashierPosScreen checkout button and workflow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Alert, 'alert');
    });

    it('renders menu, adds items to cart, opens payment checkout modal, and clicks Complete Transaction', async () => {
        const processOrderSpy = jest.spyOn(QSRPosService.prototype, 'processOrder').mockResolvedValue({
            orderNumber: 'CK-20260911-ABCDE',
            totals: {
                grossTotal: 65,
                discountType: 'none',
                discountAmount: 0,
                vatableSales: 58.04,
                vatAmount: 6.96,
                vatExemptSales: 0,
                netPayable: 65,
            },
            paymentResult: {
                isValid: true,
                totalTendered: 65,
                totalPaid: 65,
                change: 0,
            },
        });

        const { getByText, queryByText } = render(<CashierPosScreen />);

        // Add 1 Special Cut Fried Chicken (50) and 1 Cooked Rice (15)
        fireEvent.press(getByText('Special Cut Fried Chicken'));
        fireEvent.press(getByText('Cooked Rice'));

        // Charge button should show ₱65.00
        const chargeBtn = getByText(/Charge/i);
        expect(chargeBtn).toBeTruthy();

        // Click charge to open Payment Checkout modal
        fireEvent.press(chargeBtn);

        // Checkout modal should now be open with "Payment Checkout"
        expect(getByText('Payment Checkout')).toBeTruthy();
        expect(getByText('Change to Customer')).toBeTruthy();

        // Find "Complete Transaction" button
        const completeBtn = getByText('Complete Transaction');
        expect(completeBtn).toBeTruthy();

        // Click "Complete Transaction"
        fireEvent.press(completeBtn);

        await waitFor(() => {
            expect(processOrderSpy).toHaveBeenCalledWith(expect.objectContaining({
                branchId: 'branch-bagacay',
                cashierId: 'cashier-user-1',
                items: expect.arrayContaining([
                    expect.objectContaining({ name: 'Special Cut Fried Chicken', quantity: 1, price: 50 }),
                    expect.objectContaining({ name: 'Cooked Rice', quantity: 1, price: 15 }),
                ]),
                tenders: [{ method: 'cash', amount: 65 }],
            }));
        });

        // Receipt modal should be shown
        await waitFor(() => {
            expect(getByText('Receipt #CK-20260911-ABCDE')).toBeTruthy();
            expect(getByText('CRISPY KING')).toBeTruthy();
        });
    });

    it('detects and fails if processOrder throws an unhandled error', async () => {
        jest.spyOn(QSRPosService.prototype, 'processOrder').mockRejectedValue(
            new Error('Database write failure: Collection cash_transactions not writable')
        );

        const { getByText } = render(<CashierPosScreen />);

        fireEvent.press(getByText('Special Cut Fried Chicken'));
        fireEvent.press(getByText('Cooked Rice'));

        fireEvent.press(getByText(/Charge/i));
        fireEvent.press(getByText('Complete Transaction'));

        await waitFor(() => {
            expect(Alert.alert).toHaveBeenCalledWith(
                'Error',
                expect.stringContaining('Database write failure: Collection cash_transactions not writable')
            );
        });
    });
});
