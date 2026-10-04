import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import BusinessRulesScreen from '../business-rules';
import { safeBack } from '../../../../src/utils/navigation';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
        back: mockBack,
    }),
}));

jest.mock('../../../../src/utils/navigation', () => ({
    safeBack: jest.fn(),
}));

// Mock MaterialIcons to render a text containing the icon name
jest.mock('@expo/vector-icons', () => {
    const React = require('react');
    const { Text } = require('react-native');
    return {
        __esModule: true,
        MaterialIcons: ({ name }: any) => React.createElement(Text, {}, name),
    };
});

// system.lending ships disabled by default (2026-10-04); lendingOnly cards
// must be asserted as unreachable unless the flag is explicitly enabled.
const mockLendingFlag = { enabled: false };
jest.mock('../../../../src/hooks/useSettingsConfig', () => ({
    useFeatureFlags: () => ({
        isEnabled: (_key: string) => mockLendingFlag.enabled,
    }),
}));

describe('BusinessRulesScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLendingFlag.enabled = true;
    });

    it('renders header and all settings cards', () => {
        render(<BusinessRulesScreen />);

        expect(screen.getByText('Business Rules')).toBeTruthy();
        expect(screen.getByText('Settings-driven app behavior')).toBeTruthy();
        
        expect(screen.getByText('Loan Products')).toBeTruthy();
        expect(screen.getByText('Cooperative Computations')).toBeTruthy();
        expect(screen.getByText('Feature Flags')).toBeTruthy();
        expect(screen.getByText('Role Access')).toBeTruthy();
        expect(screen.getByText('Expense Categories')).toBeTruthy();
    });

    it('navigates to corresponding routes on card press', () => {
        render(<BusinessRulesScreen />);

        fireEvent.press(screen.getByText('Loan Products'));
        expect(mockPush).toHaveBeenCalledWith('/(admin)/settings/loan-products');

        fireEvent.press(screen.getByText('Cooperative Computations'));
        expect(mockPush).toHaveBeenCalledWith('/(admin)/settings/coop-computations');

        fireEvent.press(screen.getByText('Feature Flags'));
        expect(mockPush).toHaveBeenCalledWith('/(admin)/settings/feature-flags');

        fireEvent.press(screen.getByText('Role Access'));
        expect(mockPush).toHaveBeenCalledWith('/(admin)/settings/role-access');

        fireEvent.press(screen.getByText('Expense Categories'));
        expect(mockPush).toHaveBeenCalledWith('/(admin)/settings/expense-categories');
    });

    it('calls safeBack on back button press', () => {
        render(<BusinessRulesScreen />);
        
        const backBtn = screen.getByText('arrow-back');
        fireEvent.press(backBtn);
        expect(safeBack).toHaveBeenCalledWith(expect.any(Object), '/(admin)/settings');
    });

    it('hides lending-only cards when system.lending is disabled', () => {
        mockLendingFlag.enabled = false;
        render(<BusinessRulesScreen />);

        expect(screen.queryByText('Loan Products')).toBeNull();
        expect(screen.getByText('Cooperative Computations')).toBeTruthy();
        expect(screen.getByText('Feature Flags')).toBeTruthy();
        expect(screen.getByText('Role Access')).toBeTruthy();
        expect(screen.getByText('Expense Categories')).toBeTruthy();
    });
});
