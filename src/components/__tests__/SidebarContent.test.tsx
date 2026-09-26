import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SidebarContent, CRISPY_KING_OPERATIONS, AGRIBUSINESS_MENU } from '../SidebarContent';

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

    // CRISPY_KING_OPERATIONS data integrity — menu items still exist in the data array
    it('contains Touch POS Terminal and POS Register & Till in CRISPY_KING_OPERATIONS', () => {
        const posItem = CRISPY_KING_OPERATIONS.find((item) => item.label === 'Touch POS Terminal');
        expect(posItem).toBeDefined();
        expect(posItem?.route).toBe('/(cashier)/pos');

        const hubItem = CRISPY_KING_OPERATIONS.find((item) => item.label === 'POS Register & Till');
        expect(hubItem).toBeDefined();
        expect(hubItem?.route).toBe('/(cashier)');
    });

    // Sidebar now shows only agribusiness sections — Crispy King items are hidden
    it('renders Agribusiness Outgrower Platform items in the sidebar', () => {
        const { getByText } = render(<SidebarContent />);
        expect(getByText('Operator Command Center')).toBeTruthy();
        expect(getByText('Land Parcels Registry')).toBeTruthy();
        expect(getByText('Harvest Scale Terminal')).toBeTruthy();
    });

    it('does NOT render Crispy King operations in the sidebar (hidden for agribusiness mode)', () => {
        const { queryByText } = render(<SidebarContent />);
        expect(queryByText('Touch POS Terminal')).toBeNull();
        expect(queryByText('POS Register & Till')).toBeNull();
        expect(queryByText('Sales Returns & Refunds')).toBeNull();
    });

    it('navigates to Agribusiness Command Center when pressed', () => {
        const onCloseMock = jest.fn();
        const { getByText } = render(<SidebarContent onClose={onCloseMock} />);

        fireEvent.press(getByText('Operator Command Center'));
        expect(mockPush).toHaveBeenCalledWith('/(admin)/agribusiness');
        expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('filters agribusiness menu items when searching for "harvest"', () => {
        const { getByPlaceholderText, getByText, queryByText } = render(<SidebarContent />);
        const searchInput = getByPlaceholderText('Search menus & features...');

        fireEvent.changeText(searchInput, 'harvest');
        expect(getByText('Harvest Scale Terminal')).toBeTruthy();
        expect(queryByText('Staff Payroll')).toBeNull();
    });

    it('AGRIBUSINESS_MENU has all 10 expected items', () => {
        expect(AGRIBUSINESS_MENU).toHaveLength(10);
        const labels = AGRIBUSINESS_MENU.map(i => i.label);
        expect(labels).toContain('Operator Command Center');
        expect(labels).toContain('Land Parcels Registry');
        expect(labels).toContain('GPS Boundary Mapping');
        expect(labels).toContain('Cassava Crop Cycles');
        expect(labels).toContain('Harvest Scale Terminal');
        expect(labels).toContain('Land Owner Settlements');
        expect(labels).toContain('BioGreen Investor Ledger');
        expect(labels).toContain('Farm Labor & Payroll');
        expect(labels).toContain('Farm Input Expenses');
        expect(labels).toContain('P&L & Yield Analytics');
    });
});
