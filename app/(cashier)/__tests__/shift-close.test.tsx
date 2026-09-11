import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ShiftCloseScreen from '../shift-close';
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

describe('ShiftCloseScreen — Lock Till & Submit Z-Reading button', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Alert, 'alert');
    });

    it('renders the Shift Close screen with the Z-Reading button', () => {
        const { getByText } = render(<ShiftCloseScreen />);
        expect(getByText('Lock Till & Submit Z-Reading')).toBeTruthy();
    });

    it('pressing Lock Till & Submit Z-Reading calls Alert with Z-Reading data', async () => {
        const { getByText } = render(<ShiftCloseScreen />);
        fireEvent.press(getByText('Lock Till & Submit Z-Reading'));

        await waitFor(() => {
            expect(Alert.alert).toHaveBeenCalledWith(
                'Z-Reading Shift Closure',
                expect.stringContaining('Expected Cash'),
                expect.arrayContaining([
                    expect.objectContaining({ text: 'Cancel' }),
                    expect.objectContaining({ text: 'Confirm & Lock Till' }),
                ])
            );
        });
    });

    it('computeZReading detects overage when cash count exceeds expected', () => {
        // Simulated shift: openingFloat 2000 + cashSales 14200 - drops 10000 = 6200 expected
        const overCount = {
            p1000: 6, // 6000
            p500: 0,
            p200: 1, // 200 — total 6200 + 100 overage = 6300
            p100: 1,
            p50: 0,
            p20: 0,
            coins: 0,
        };

        const input = {
            branchId: 'branch-bagacay',
            cashierId: 'cashier-user-1',
            openingFloat: 2000,
            grossSales: 16850,
            cashSales: 14200,
            nonCashSales: 2650,
            totalDrops: 10000,
            orderCount: 54,
        };

        const zReport = ShiftCashService.computeZReading(input, overCount);
        expect(zReport.expectedDrawerCash).toBe(6200); // 2000 + 14200 - 10000
        expect(zReport.actualCashCount).toBe(6300); // 6*1000 + 1*200 + 1*100
        expect(zReport.variance).toBe(100);
        expect(zReport.varianceStatus).toBe('over');
    });

    it('computeZReading detects shortage when cash count is below expected', () => {
        const shortCount = {
            p1000: 6, // 6000 only — 200 short
            p500: 0,
            p200: 0,
            p100: 0,
            p50: 0,
            p20: 0,
            coins: 0,
        };

        const input = {
            branchId: 'branch-bagacay',
            cashierId: 'cashier-user-1',
            openingFloat: 2000,
            grossSales: 16850,
            cashSales: 14200,
            nonCashSales: 2650,
            totalDrops: 10000,
            orderCount: 54,
        };

        const zReport = ShiftCashService.computeZReading(input, shortCount);
        expect(zReport.expectedDrawerCash).toBe(6200);
        expect(zReport.actualCashCount).toBe(6000);
        expect(zReport.variance).toBe(-200);
        expect(zReport.varianceStatus).toBe('short');
    });

    it('computeZReading shows balanced when cash is exact', () => {
        const exactCount = {
            p1000: 6,
            p500: 0,
            p200: 1,
            p100: 0,
            p50: 0,
            p20: 0,
            coins: 0,
        }; // 6200 exact

        const input = {
            branchId: 'branch-bagacay',
            cashierId: 'cashier-user-1',
            openingFloat: 2000,
            grossSales: 16850,
            cashSales: 14200,
            nonCashSales: 2650,
            totalDrops: 10000,
            orderCount: 54,
        };

        const zReport = ShiftCashService.computeZReading(input, exactCount);
        expect(zReport.variance).toBe(0);
        expect(zReport.varianceStatus).toBe('exact');
    });
});
