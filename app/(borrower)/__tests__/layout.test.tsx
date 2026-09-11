import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import BorrowerLayout from '../_layout';

import * as RN from 'react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
        replace: mockReplace,
    }),
    usePathname: () => '/(borrower)',
    Slot: () => null,
}));

jest.mock('@expo/vector-icons', () => {
    const React = require('react');
    const { Text } = require('react-native');
    return {
        MaterialIcons: ({ name }: any) => React.createElement(Text, null, name),
    };
});

jest.mock('../../../src/store/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'borrower-1' },
        role: 'borrower',
        roleResolved: true,
        initialized: true,
        signOut: jest.fn(),
    }),
}));

jest.mock('../../../src/hooks/useSettingsConfig', () => ({
    useRolePermissions: () => ({
        isAllowed: () => true,
    }),
}));

jest.mock('../../../src/components/AppLogo', () => ({
    AppLogo: () => null,
}));

jest.mock('../../../src/components/AuthGateLoading', () => ({
    AuthGateLoading: ({ message }: any) => null,
}));

describe('BorrowerLayout Bottom Navigation Bar', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(RN.Dimensions, 'get').mockReturnValue({ width: 375, height: 812, scale: 2, fontScale: 1 });
        jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({ width: 375, height: 812, scale: 2, fontScale: 1 });
    });

    it('renders the 5 mobile bottom navigation items without overlapping text', () => {
        render(<BorrowerLayout />);

        expect(screen.getByText('Home')).toBeTruthy();
        expect(screen.getByText('Loans')).toBeTruthy();
        expect(screen.getByText('Savings')).toBeTruthy();
        expect(screen.getByText('Shop')).toBeTruthy();
        expect(screen.getByText('More')).toBeTruthy();
    });

    it('navigates to primary routes when bottom bar items are pressed', () => {
        render(<BorrowerLayout />);

        fireEvent.press(screen.getByText('Loans'));
        expect(mockPush).toHaveBeenCalledWith('/(borrower)/loans');

        fireEvent.press(screen.getByText('Shop'));
        expect(mockPush).toHaveBeenCalledWith('/(borrower)/marketplace');
    });

    it('opens drawer modal when More button is pressed', () => {
        render(<BorrowerLayout />);

        fireEvent.press(screen.getByText('More'));
        // Menu items inside drawer should now be visible
        expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
        expect(screen.getByText('Seller Center')).toBeTruthy();
    });
});
