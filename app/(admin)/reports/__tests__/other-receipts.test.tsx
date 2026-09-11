import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import OtherReceiptsReportScreen from '../other-receipts';
import { OtherReceiptService } from '../../../../src/services/OtherReceiptService';

jest.mock('../../../../src/database', () => {
    return require('../../../../src/database/__mocks__');
});

jest.mock('expo-router', () => {
    const React = require('react');
    return {
        useRouter: () => ({
            push: jest.fn(),
            back: jest.fn(),
        }),
        Stack: {
            Screen: () => null,
        },
        useFocusEffect: (cb: any) => React.useEffect(() => {
            cb();
            return undefined;
        }, []),
    };
});

jest.mock('../../../../src/services/OtherReceiptService', () => {
    return {
        OtherReceiptService: {
            getReceiptSummary: jest.fn().mockResolvedValue({
                totalAmount: 1500,
                receiptCount: 3,
                averageAmount: 500,
                categoryBreakdown: [
                    {
                        category: 'service_charge',
                        label: 'Service Charge',
                        amount: 1000,
                        count: 2,
                        percentage: 66.7,
                        color: '#2563EB',
                        icon: 'design-services',
                    },
                    {
                        category: 'membership_fee',
                        label: 'Membership Fee',
                        amount: 500,
                        count: 1,
                        percentage: 33.3,
                        color: '#16A34A',
                        icon: 'card-membership',
                    },
                ],
                paymentMethodBreakdown: {
                    cash: 1000,
                    bank: 500,
                },
                receipts: [
                    {
                        id: 'r-1',
                        receiptNumber: 'OR-001',
                        payorName: 'Juan Dela Cruz',
                        category: 'service_charge',
                        categoryLabel: 'Service Charge',
                        amount: 500,
                        paymentMethod: 'cash',
                        transactionDate: Date.now(),
                        createdAt: Date.now(),
                    },
                    {
                        id: 'r-2',
                        receiptNumber: 'OR-002',
                        payorName: 'Maria Santos',
                        category: 'service_charge',
                        categoryLabel: 'Service Charge',
                        amount: 500,
                        paymentMethod: 'bank',
                        transactionDate: Date.now(),
                        createdAt: Date.now(),
                    },
                ],
            }),
        },
        OTHER_RECEIPT_CATEGORIES: {
            service_charge: { label: 'Service Charge', color: '#2563EB', icon: 'design-services' },
            membership_fee: { label: 'Membership Fee', color: '#16A34A', icon: 'card-membership' },
        },
    };
});

describe('OtherReceiptsReportScreen', () => {
    it('renders header, KPI metrics, category breakdown, and itemized receipts', async () => {
        const { getByText, getAllByText } = render(<OtherReceiptsReportScreen />);

        await waitFor(() => {
            expect(getByText('Other Receipts Summary')).toBeTruthy();
            expect(getByText('Total Collected')).toBeTruthy();
            expect(getByText('Total ORs')).toBeTruthy();
            expect(getByText('Juan Dela Cruz')).toBeTruthy();
            expect(getByText('OR-001')).toBeTruthy();
        });
    });

    it('switches between daily, monthly, and yearly period tabs', async () => {
        const { getByText } = render(<OtherReceiptsReportScreen />);

        await waitFor(() => {
            expect(getByText('Other Receipts Summary')).toBeTruthy();
        });

        fireEvent.press(getByText(/monthly/i));
        await waitFor(() => {
            expect(OtherReceiptService.getReceiptSummary).toHaveBeenCalledWith(
                expect.objectContaining({ period: 'monthly' })
            );
        });

        fireEvent.press(getByText(/yearly/i));
        await waitFor(() => {
            expect(OtherReceiptService.getReceiptSummary).toHaveBeenCalledWith(
                expect.objectContaining({ period: 'yearly' })
            );
        });
    });
});
