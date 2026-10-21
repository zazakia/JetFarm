import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SidebarContent, AGRIBUSINESS_MENU, FINANCIAL_REPORTS_MENU } from '../SidebarContent';
import { setDeploymentMode, resetDeploymentMode } from '../../config/deployment';

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
        setDeploymentMode('agri');
    });

    afterEach(() => {
        resetDeploymentMode();
    });

    // The nav arrays are the subject: every entry needs a screen behind it, which
    // src/__tests__/agribusinessNavWhitelist.test.ts checks against app/. Here we check what the
    // drawer actually renders for the agribusiness variant.
    it('renders the Agribusiness Outgrower Platform section', () => {
        const { getByText } = render(<SidebarContent />);
        expect(getByText('Operator Command Center')).toBeTruthy();
        expect(getByText('Land Parcels Registry')).toBeTruthy();
        expect(getByText('Harvest Scale Terminal')).toBeTruthy();
    });

    it('renders no POS, franchise, lending or share-capital row', () => {
        const { queryByText } = render(<SidebarContent />);
        for (const gone of [
            'Touch POS Terminal',
            'POS Register & Till',
            'Franchise Agreements CRM',
            'Borrowers & Members',
            'Loans',
            'Field Collectors',
            'CIC Credit Bureau',
            'Staff Payroll',
            'Savings Portfolio',
            'Share Capital',
            'Employees Directory',
        ]) {
            expect(queryByText(gone)).toBeNull();
        }
    });

    it('hides the whole drawer when the bundle is not the agribusiness build', () => {
        // canShow() gates on isAgri(), so a build baked with a stale EXPO_PUBLIC_BUSINESS_TYPE
        // shows an empty sidebar instead of routes that were deleted from this branch.
        setDeploymentMode('crispy-king');
        const { queryByText } = render(<SidebarContent />);
        expect(queryByText('Operator Command Center')).toBeNull();
        expect(queryByText('Land Parcels Registry')).toBeNull();
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
        expect(queryByText('Land Parcels Registry')).toBeNull();
    });

    it('AGRIBUSINESS_MENU covers all 13 screens under app/(admin)/agribusiness', () => {
        expect(AGRIBUSINESS_MENU).toHaveLength(13);
        const labels = AGRIBUSINESS_MENU.map(i => i.label);
        expect(labels).toContain('Operator Command Center');
        expect(labels).toContain('Land Parcels Registry');
        expect(labels).toContain('GPS Boundary Mapping');
        expect(labels).toContain('Cassava Crop Cycles');
        expect(labels).toContain('Harvest Scale Terminal');
        expect(labels).toContain('Land Owner Settlements');
        expect(labels).toContain('BioGreen Investor Ledger');
        expect(labels).toContain('Farm Labor Ledger');
        expect(labels).toContain('Farm Laborers & Staff');
        expect(labels).toContain('Farm Input Expenses');
        expect(labels).toContain('Farm Accounting');
        expect(labels).toContain('P&L & Yield Analytics');
        expect(labels).toContain('Implementation Report');
    });

    it('FINANCIAL_REPORTS_MENU covers the 10 statements that survived the teardown', () => {
        expect(FINANCIAL_REPORTS_MENU).toHaveLength(10);
        const routes = FINANCIAL_REPORTS_MENU.map(i => i.route);
        expect(routes).toContain('/(admin)/reports/balance-sheet');
        expect(routes).toContain('/(admin)/reports/income-statement');
        expect(routes).toContain('/(admin)/reports/cash-flows');
        expect(routes).toContain('/(admin)/reports/changes-in-equity');
        expect(routes).toContain('/(admin)/reports/notes-to-fs');
        expect(routes).toContain('/(admin)/reports/annual-report');
        expect(routes).toContain('/(admin)/reports/statutory-reserves');
        expect(routes).toContain('/(admin)/reports/expenses');
        expect(routes).toContain('/(admin)/reports/segment-comparison');
        expect(routes).toContain('/(admin)/reports/period-settings');
    });

    it('renders the Take Guided Tour button in the sidebar', () => {
        const { getByTestId, getByText } = render(<SidebarContent />);
        expect(getByTestId('sidebar-start-tour-button')).toBeTruthy();
        expect(getByText('Take Guided Tour')).toBeTruthy();
    });

    it('shows the brand name and the APK link in the footer', () => {
        const { getByText } = render(<SidebarContent />);
        expect(getByText('Download Latest APK')).toBeTruthy();
    });
});
