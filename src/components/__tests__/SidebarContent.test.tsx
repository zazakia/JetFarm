import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SidebarContent, CRISPY_KING_OPERATIONS } from '../SidebarContent';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
    usePathname: () => '/(admin)',
}));

jest.mock('../../store/AuthContext', () => ({
    useAuth: () => ({
        signOut: jest.fn(),
        role: 'admin',
    }),
}));

jest.mock('../../hooks/useSettingsConfig', () => ({
    useFeatureFlags: () => ({
        isEnabled: () => true,
    }),
    useRolePermissions: () => ({
        isAllowed: () => true,
    }),
}));

describe('SidebarContent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('contains Touch POS Terminal and POS Register & Till in CRISPY_KING_OPERATIONS', () => {
        const posItem = CRISPY_KING_OPERATIONS.find((item) => item.label === 'Touch POS Terminal');
        expect(posItem).toBeDefined();
        expect(posItem?.route).toBe('/(cashier)/pos');

        const hubItem = CRISPY_KING_OPERATIONS.find((item) => item.label === 'POS Register & Till');
        expect(hubItem).toBeDefined();
        expect(hubItem?.route).toBe('/(cashier)');
    });

    it('renders Crispy King operations items in the sidebar menu', () => {
        const { getByText } = render(<SidebarContent />);
        expect(getByText('Touch POS Terminal')).toBeTruthy();
        expect(getByText('POS Register & Till')).toBeTruthy();
        expect(getByText('Sales Returns & Refunds')).toBeTruthy();
    });

    it('navigates to POS terminal route when Touch POS Terminal is clicked', () => {
        const onCloseMock = jest.fn();
        const { getByText } = render(<SidebarContent onClose={onCloseMock} />);

        fireEvent.press(getByText('Touch POS Terminal'));
        expect(mockPush).toHaveBeenCalledWith('/(cashier)/pos');
        expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('filters POS menu items when searching for "POS"', () => {
        const { getByPlaceholderText, getByText, queryByText } = render(<SidebarContent />);
        const searchInput = getByPlaceholderText('Search menus & features...');

        fireEvent.changeText(searchInput, 'POS');
        expect(getByText('Touch POS Terminal')).toBeTruthy();
        expect(getByText('POS Register & Till')).toBeTruthy();
        expect(queryByText('Staff Payroll')).toBeNull();
    });
});
