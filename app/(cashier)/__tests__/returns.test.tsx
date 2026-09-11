import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CashierReturnsScreen from '../returns';
import { SalesReturnService, SalesReturnServiceClass } from '../../../src/services/SalesReturnService';
import { Alert } from 'react-native';

// --- Mocks -----------------------------------------------------------

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
    Ionicons: () => null,
}));

// Mock the SupervisorApprovalModal so we can programmatically trigger approval
let capturedOnApproved: ((payload: { supervisorName: string }) => void) | null = null;

jest.mock('../../../src/components/SupervisorApprovalModal', () => ({
    SupervisorApprovalModal: (props: any) => {
        capturedOnApproved = props.onApproved;
        return null; // don't render the modal UI in tests
    },
}));

// -----------------------------------------------------------------------

describe('CashierReturnsScreen — Sales Return workflow buttons', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Alert, 'alert');
        capturedOnApproved = null;
    });

    it('renders the returns screen with the approval button (initially disabled)', () => {
        const { getByText } = render(<CashierReturnsScreen />);
        expect(getByText('Sales Return Terminal')).toBeTruthy();
        expect(getByText('Request Supervisor Approval & Refund')).toBeTruthy();
    });

    it('the Request Approval button renders and is disabled (no-op) when return cart is empty', () => {
        // The Pressable uses disabled={returnItems.length === 0}
        // A disabled Pressable in React Native ignores onPress, so handleRequestApproval never fires
        const createDraftSpy = jest.spyOn(SalesReturnServiceClass.prototype, 'createReturnDraft');

        const { getByText } = render(<CashierReturnsScreen />);
        expect(getByText('Request Supervisor Approval & Refund')).toBeTruthy();

        // Pressing a disabled Pressable does NOT call onPress — service is never invoked
        fireEvent.press(getByText('Request Supervisor Approval & Refund'));
        expect(createDraftSpy).not.toHaveBeenCalled();
    });

    it('pressing Request Approval with items calls createReturnDraft', async () => {
        const createDraftSpy = jest
            .spyOn(SalesReturnServiceClass.prototype, 'createReturnDraft')
            .mockReturnValue({
                id: 'ret-test-001',
                returnNumber: 'RET-20260911-ABCDE',
                branchId: 'branch-bagacay',
                cashierId: 'cashier-user-1',
                items: [],
                totalRefundAmount: 50,
                refundMethod: 'cash',
                status: 'draft',
                createdAt: Date.now(),
                customerName: 'Walk-in Customer',
            });

        const { getByText } = render(<CashierReturnsScreen />);

        // Open the Add Item modal
        fireEvent.press(getByText('Add Item'));

        // Pick first menu product (Special Cut Fried Chicken)
        await waitFor(() => {
            expect(getByText('Special Cut Fried Chicken')).toBeTruthy();
        });
        fireEvent.press(getByText('Special Cut Fried Chicken'));

        // Confirm the item
        fireEvent.press(getByText('Confirm Item'));

        // Now press submit
        fireEvent.press(getByText('Request Supervisor Approval & Refund'));

        await waitFor(() => {
            expect(createDraftSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    branchId: 'branch-bagacay',
                    cashierId: 'cashier-user-1',
                    items: expect.arrayContaining([
                        expect.objectContaining({ productName: 'Special Cut Fried Chicken' }),
                    ]),
                })
            );
        });
    });

    it('full 3-step return flow: Draft → Supervisor Approve → Complete shows success receipt', async () => {
        const mockDraftId = 'ret-test-full-001';

        jest.spyOn(SalesReturnServiceClass.prototype, 'createReturnDraft').mockReturnValue({
            id: mockDraftId,
            returnNumber: 'RET-20260911-FULL1',
            branchId: 'branch-bagacay',
            cashierId: 'cashier-user-1',
            items: [
                {
                    productId: 'ck-scut',
                    productName: 'Special Cut Fried Chicken',
                    condition: 'good_resellable',
                    quantity: 1,
                    unitPrice: 50,
                    reason: 'Wrong order',
                },
            ],
            totalRefundAmount: 50,
            refundMethod: 'cash',
            status: 'draft',
            createdAt: Date.now(),
            customerName: 'Walk-in Customer',
        });

        jest.spyOn(SalesReturnServiceClass.prototype, 'approveReturn').mockReturnValue({
            id: mockDraftId,
            returnNumber: 'RET-20260911-FULL1',
            branchId: 'branch-bagacay',
            cashierId: 'cashier-user-1',
            items: [],
            totalRefundAmount: 50,
            refundMethod: 'cash',
            status: 'approved',
            approvedBy: 'Supervisor Mario',
            approvedAt: Date.now(),
            createdAt: Date.now(),
            customerName: 'Walk-in Customer',
        });

        jest.spyOn(SalesReturnServiceClass.prototype, 'completeReturn').mockResolvedValue({
            returnDraft: {
                id: mockDraftId,
                returnNumber: 'RET-20260911-FULL1',
                branchId: 'branch-bagacay',
                cashierId: 'cashier-user-1',
                items: [],
                totalRefundAmount: 50,
                refundMethod: 'cash',
                status: 'completed',
                createdAt: Date.now(),
                customerName: 'Walk-in Customer',
            },
            stockMovementIds: ['sm-1'],
            wasteLogIds: [],
            cashTransactionId: 'cash-1',
        });

        const { getByText } = render(<CashierReturnsScreen />);

        // Open Add Item modal and add an item
        fireEvent.press(getByText('Add Item'));
        await waitFor(() => expect(getByText('Special Cut Fried Chicken')).toBeTruthy());
        fireEvent.press(getByText('Special Cut Fried Chicken'));
        fireEvent.press(getByText('Confirm Item'));

        // Step 1 — Request Approval (creates draft)
        fireEvent.press(getByText('Request Supervisor Approval & Refund'));

        // Step 2 — Simulate supervisor approving via the modal callback
        await waitFor(() => expect(capturedOnApproved).not.toBeNull());
        capturedOnApproved!({ supervisorName: 'Supervisor Mario' });

        // Step 3 — Success receipt modal should appear
        await waitFor(() => {
            expect(getByText('Return Completed')).toBeTruthy();
            expect(getByText('RET-20260911-FULL1')).toBeTruthy();
        });
    });

    it('shows error Alert if createReturnDraft throws (detects silent failure)', async () => {
        // Re-establish Alert spy (beforeEach sets it, but we want to be explicit)
        jest.spyOn(Alert, 'alert');

        jest.spyOn(SalesReturnServiceClass.prototype, 'createReturnDraft').mockImplementation(() => {
            throw new Error('Database write failure during draft creation');
        });

        const { getByText } = render(<CashierReturnsScreen />);
        fireEvent.press(getByText('Add Item'));
        await waitFor(() => expect(getByText('Special Cut Fried Chicken')).toBeTruthy());
        fireEvent.press(getByText('Special Cut Fried Chicken'));
        fireEvent.press(getByText('Confirm Item'));

        fireEvent.press(getByText('Request Supervisor Approval & Refund'));

        await waitFor(() => {
            expect(Alert.alert).toHaveBeenCalledWith(
                'Error',
                expect.stringContaining('Database write failure during draft creation')
            );
        });
    });
});
