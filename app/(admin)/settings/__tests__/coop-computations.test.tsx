import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import CooperativeComputationsScreen from '../coop-computations';
import { SettingsService } from '../../../../src/services/SettingsService';
import { safeBack } from '../../../../src/utils/navigation';
import { Alert, Platform } from 'react-native';

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
        user: { id: 'admin-id', email: 'admin@test.com' },
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

describe('CooperativeComputationsScreen', () => {
    const mockSettings: Record<string, number> = {
        'savings.interest_rate': 0.065,
        'savings.min_maintaining_balance': 150,
        'fund.net_surplus_allocation': 0.70,
        'fund.reserve_fund_allocation': 0.10,
        'fund.education_fund_allocation': 0.10,
        'fund.community_development_fund_allocation': 0.03,
        'fund.optional_fund_allocation': 0.07,
        'fund.isc_distribution': 0.75,
        'fund.pr_distribution': 0.25,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (SettingsService.getNumberSetting as jest.Mock).mockImplementation((key: string, fallback: number) => {
            return Promise.resolve(mockSettings[key] !== undefined ? mockSettings[key] : fallback);
        });
    });

    it('renders cooperative settings parameters correctly', async () => {
        render(<CooperativeComputationsScreen />);

        await waitFor(() => {
            expect(screen.getByText('CDA & Internal Rules Compliance')).toBeTruthy();
        });

        const inputs = screen.UNSAFE_getAllByType(require('react-native').TextInput);
        expect(inputs[0].props.value).toBe('6.5');
        expect(inputs[1].props.value).toBe('150');
        expect(inputs[2].props.value).toBe('70');
        expect(inputs[3].props.value).toBe('10');
        expect(inputs[4].props.value).toBe('10');
        expect(inputs[5].props.value).toBe('3');
        expect(inputs[6].props.value).toBe('7');
        expect(inputs[7].props.value).toBe('75');
        expect(inputs[8].props.value).toBe('25');
    });

    it('validates that statutory allocations sum up to exactly 100%', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        render(<CooperativeComputationsScreen />);
        await waitFor(() => {
            expect(screen.getByText('CDA & Internal Rules Compliance')).toBeTruthy();
        });

        const inputs = screen.UNSAFE_getAllByType(require('react-native').TextInput);
        fireEvent.changeText(inputs[3], '15');

        const saveBtn = screen.getByText('Save Parameters');
        fireEvent.press(saveBtn);

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith(
                'Invalid Allocation Sum',
                expect.stringContaining('must be exactly 100%. Currently, it is 105%.'),
                undefined
            );
        });
        expect(SettingsService.setAppSetting).not.toHaveBeenCalled();
    });

    it('validates that splits sum up to exactly 100%', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        render(<CooperativeComputationsScreen />);
        await waitFor(() => {
            expect(screen.getByText('CDA & Internal Rules Compliance')).toBeTruthy();
        });

        const inputs = screen.UNSAFE_getAllByType(require('react-native').TextInput);
        fireEvent.changeText(inputs[7], '80');

        const saveBtn = screen.getByText('Save Parameters');
        fireEvent.press(saveBtn);

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith(
                'Invalid Distribution Split Sum',
                expect.stringContaining('must be exactly 100%. Currently, it is 105%.'),
                undefined
            );
        });
        expect(SettingsService.setAppSetting).not.toHaveBeenCalled();
    });

    it('validates non-negative numeric inputs', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        render(<CooperativeComputationsScreen />);
        await waitFor(() => {
            expect(screen.getByText('CDA & Internal Rules Compliance')).toBeTruthy();
        });

        const inputs = screen.UNSAFE_getAllByType(require('react-native').TextInput);
        fireEvent.changeText(inputs[0], '-2');

        const saveBtn = screen.getByText('Save Parameters');
        fireEvent.press(saveBtn);

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith(
                'Invalid Savings Rules',
                'Interest rate and minimum balance must be valid non-negative numbers.',
                undefined
            );
        });
        expect(SettingsService.setAppSetting).not.toHaveBeenCalled();
    });

    it('saves parameters successfully when values are valid', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        (SettingsService.setAppSetting as jest.Mock).mockResolvedValue(undefined);
        render(<CooperativeComputationsScreen />);
        await waitFor(() => {
            expect(screen.getByText('CDA & Internal Rules Compliance')).toBeTruthy();
        });

        const saveBtn = screen.getByText('Save Parameters');
        fireEvent.press(saveBtn);

        await waitFor(() => {
            expect(SettingsService.setAppSetting).toHaveBeenNthCalledWith(1, 'savings.interest_rate', '0.065', 'admin-id');
            expect(SettingsService.setAppSetting).toHaveBeenNthCalledWith(2, 'savings.min_maintaining_balance', '150', 'admin-id');
            expect(SettingsService.setAppSetting).toHaveBeenNthCalledWith(3, 'fund.net_surplus_allocation', '0.7', 'admin-id');
            expect(SettingsService.setAppSetting).toHaveBeenNthCalledWith(4, 'fund.reserve_fund_allocation', '0.1', 'admin-id');
            expect(SettingsService.setAppSetting).toHaveBeenNthCalledWith(5, 'fund.education_fund_allocation', '0.1', 'admin-id');
            expect(SettingsService.setAppSetting).toHaveBeenNthCalledWith(6, 'fund.community_development_fund_allocation', '0.03', 'admin-id');
            expect(SettingsService.setAppSetting).toHaveBeenNthCalledWith(7, 'fund.optional_fund_allocation', '0.07', 'admin-id');
            expect(SettingsService.setAppSetting).toHaveBeenNthCalledWith(8, 'fund.isc_distribution', '0.75', 'admin-id');
            expect(SettingsService.setAppSetting).toHaveBeenNthCalledWith(9, 'fund.pr_distribution', '0.25', 'admin-id');
        });

        const alertCall = alertSpy.mock.calls.find(([title]) => title === 'Settings Saved');
        const confirmButton = alertCall?.[2]?.[0];
        confirmButton?.onPress?.();

        expect(safeBack).toHaveBeenCalledWith(expect.any(Object), '/(admin)/settings/business-rules');
    });

    it('uses global window alert when Platform.OS is web', async () => {
        Platform.OS = 'web';
        const globalAlertSpy = jest.fn();
        const originalAlert = global.alert;
        global.alert = globalAlertSpy as any;

        render(<CooperativeComputationsScreen />);
        await waitFor(() => {
            expect(screen.getByText('CDA & Internal Rules Compliance')).toBeTruthy();
        });

        const inputs = screen.UNSAFE_getAllByType(require('react-native').TextInput);
        fireEvent.changeText(inputs[0], '-2');

        const saveBtn = screen.getByText('Save Parameters');
        fireEvent.press(saveBtn);

        await waitFor(() => {
            expect(globalAlertSpy).toHaveBeenCalledWith(
                'Invalid Savings Rules: Interest rate and minimum balance must be valid non-negative numbers.'
            );
        });
        Platform.OS = 'ios';
        global.alert = originalAlert;
    });
});
