import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import StatutoryAllocationsScreen from '../statutory-allocations';
import { SettingsService } from '../../../../src/services/SettingsService';
import { safeBack } from '../../../../src/utils/navigation';
import { Alert, Platform, TextInput } from 'react-native';

// Mock expo router
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
        back: mockBack,
    }),
}));

// Mock safeBack
jest.mock('../../../../src/utils/navigation', () => ({
    safeBack: jest.fn(),
}));

// Mock AuthContext
jest.mock('../../../../src/store/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'admin-id', email: 'admin@agri-one.com' },
    }),
}));

// Mock SettingsService
jest.mock('../../../../src/services/SettingsService', () => ({
    SettingsService: {
        getNumberSetting: jest.fn(),
        setAppSetting: jest.fn(),
    },
}));

// Mock MaterialIcons
jest.mock('@expo/vector-icons', () => {
    const React = require('react');
    const { Text } = require('react-native');
    return {
        __esModule: true,
        MaterialIcons: ({ name }: any) => React.createElement(Text, {}, name),
    };
});

/**
 * The screen that used to live here was the cooperative business rules editor: savings interest
 * rate, minimum maintaining balance, the net-surplus split and the ISC / patronage refund shares.
 * All four configure the lending domain, which is deleted on this variant - the keys are written
 * here and read nowhere. What survives is the one thing the Agri-One statements actually consume:
 * the four statutory fund percentages rendered by app/(admin)/reports/statutory-reserves.tsx.
 */
describe('StatutoryAllocationsScreen', () => {
    const mockSettings: Record<string, number> = {
        'fund.reserve_fund_allocation': 0.10,
        'fund.education_fund_allocation': 0.10,
        'fund.community_development_fund_allocation': 0.03,
        'fund.optional_fund_allocation': 0.07,
        // retired cooperative keys still present in a remote row must not appear on screen
        'savings.interest_rate': 0.065,
        'fund.isc_distribution': 0.75,
        'fund.net_surplus_allocation': 0.70,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (SettingsService.getNumberSetting as jest.Mock).mockImplementation((key: string, fallback: number) => {
            return Promise.resolve(mockSettings[key] !== undefined ? mockSettings[key] : fallback);
        });
    });

    it('edits only the four statutory fund percentages', async () => {
        render(<StatutoryAllocationsScreen />);

        await waitFor(() => {
            expect(screen.getByText('Statutory Reserve Allocations')).toBeTruthy();
        });

        const inputs = screen.UNSAFE_getAllByType(TextInput);
        expect(inputs).toHaveLength(4);
        expect(inputs.map(i => i.props.value)).toEqual(['10', '10', '3', '7']);

        expect(screen.queryByText(/Savings Settings/i)).toBeNull();
        expect(screen.queryByText(/Interest Rate/i)).toBeNull();
        expect(screen.queryByText(/Patronage/i)).toBeNull();
        expect(screen.queryByText(/Net Surplus Allocation/i)).toBeNull();
    });

    it('does not force the statutory percentages to sum to 100', async () => {
        // 10 + 10 + 3 + 7 = 30% is the statutory appropriation; the remainder is retained surplus
        // that the statements themselves compute, so the old "must equal 100%" rule belonged to the
        // cooperative distribution model and must not come back.
        const alertSpy = jest.spyOn(Alert, 'alert');
        (SettingsService.setAppSetting as jest.Mock).mockResolvedValue(undefined);

        render(<StatutoryAllocationsScreen />);
        await waitFor(() => expect(screen.getByText('Statutory Reserve Allocations')).toBeTruthy());

        fireEvent.press(screen.getByText('Save Parameters'));

        await waitFor(() => {
            expect(SettingsService.setAppSetting).toHaveBeenCalledTimes(4);
        });
        expect(alertSpy).not.toHaveBeenCalledWith(
            'Invalid Allocation Sum',
            expect.any(String),
            expect.anything()
        );
    });

    it('rejects a non-numeric or negative percentage and writes nothing', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        render(<StatutoryAllocationsScreen />);
        await waitFor(() => expect(screen.getByText('Statutory Reserve Allocations')).toBeTruthy());

        const inputs = screen.UNSAFE_getAllByType(TextInput);
        fireEvent.changeText(inputs[1], '-5');
        fireEvent.press(screen.getByText('Save Parameters'));

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith(
                'Invalid Allocation',
                expect.stringContaining('non-negative numbers not exceeding 100'),
                undefined
            );
        });
        expect(SettingsService.setAppSetting).not.toHaveBeenCalled();
    });

    it('writes exactly the four statutory keys, in order, as fractions', async () => {
        (SettingsService.setAppSetting as jest.Mock).mockResolvedValue(undefined);
        render(<StatutoryAllocationsScreen />);
        await waitFor(() => expect(screen.getByText('Statutory Reserve Allocations')).toBeTruthy());

        const inputs = screen.UNSAFE_getAllByType(TextInput);
        fireEvent.changeText(inputs[2], '5');

        fireEvent.press(screen.getByText('Save Parameters'));

        await waitFor(() => {
            expect((SettingsService.setAppSetting as jest.Mock).mock.calls.map(c => c[0])).toEqual([
                'fund.reserve_fund_allocation',
                'fund.education_fund_allocation',
                'fund.community_development_fund_allocation',
                'fund.optional_fund_allocation',
            ]);
        });
        expect(SettingsService.setAppSetting).toHaveBeenNthCalledWith(1, 'fund.reserve_fund_allocation', '0.1', 'admin-id');
        expect(SettingsService.setAppSetting).toHaveBeenNthCalledWith(3, 'fund.community_development_fund_allocation', '0.05', 'admin-id');
        expect(SettingsService.setAppSetting).toHaveBeenNthCalledWith(4, 'fund.optional_fund_allocation', '0.07', 'admin-id');

        const alertCall = (Alert.alert as jest.Mock).mock.calls.find(([title]) => title === 'Settings Saved');
        alertCall?.[2]?.[0]?.onPress?.();
        expect(safeBack).toHaveBeenCalledWith(expect.any(Object), '/(admin)/settings/business-rules');
    });

    it('explains where the rest of the surplus goes', async () => {
        render(<StatutoryAllocationsScreen />);
        await waitFor(() => {
            expect(screen.getByText(/not appropriated here stays in retained surplus/i)).toBeTruthy();
        });
    });

    it('uses global window alert when Platform.OS is web', async () => {
        Platform.OS = 'web';
        const globalAlertSpy = jest.fn();
        const originalAlert = global.alert;
        global.alert = globalAlertSpy as any;

        render(<StatutoryAllocationsScreen />);
        await waitFor(() => expect(screen.getByText('Statutory Reserve Allocations')).toBeTruthy());

        const inputs = screen.UNSAFE_getAllByType(TextInput);
        fireEvent.changeText(inputs[0], '-2');
        fireEvent.press(screen.getByText('Save Parameters'));

        await waitFor(() => {
            expect(globalAlertSpy).toHaveBeenCalledWith(
                expect.stringContaining('Invalid Allocation:')
            );
        });

        Platform.OS = 'ios';
        global.alert = originalAlert;
    });
});
