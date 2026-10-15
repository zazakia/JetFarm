import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import DataMaintenanceScreen from '../data-maintenance';
import { LookupDataService } from '../../../../src/services/LookupDataService';
import { MasterDataService } from '../../../../src/services/MasterDataService';
import { safeBack } from '../../../../src/utils/navigation';

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

// Mock LookupDataService
jest.mock('../../../../src/services/LookupDataService', () => ({
    LookupDataService: {
        getLookupItems: jest.fn(),
        saveLookupItem: jest.fn(),
        toggleLookupItemStatus: jest.fn(),
        deleteLookupItem: jest.fn(),
        resetCategoryToDefaults: jest.fn(),
    },
    LOOKUP_CATEGORIES_CATALOG: [
        { key: 'uom', label: 'Units of Measure (UOM)', description: 'Base and packaged quantities', icon: 'straighten' },
        { key: 'payment_method', label: 'Payment Methods', description: 'Tender types accepted', icon: 'payments' },
        { key: 'return_reason', label: 'Sales Return Reasons', description: 'Customer refund reasons', icon: 'assignment-return' },
    ],
}));

// Mock MasterDataService
jest.mock('../../../../src/services/MasterDataService', () => ({
    MasterDataService: {
        getBranches: jest.fn(),
        getWarehouses: jest.fn(),
        getCategories: jest.fn(),
        getSuppliers: jest.fn(),
        getStatutoryRates: jest.fn(),
        createBranch: jest.fn(),
        createWarehouse: jest.fn(),
        createCategory: jest.fn(),
        createSupplier: jest.fn(),
        createStatutoryRate: jest.fn(),
        toggleBranchActive: jest.fn(),
        toggleWarehouseActive: jest.fn(),
        toggleCategoryActive: jest.fn(),
        toggleSupplierActive: jest.fn(),
        deleteStatutoryRate: jest.fn(),
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

describe('DataMaintenanceScreen', () => {
    const mockUoms = [
        { id: 'uom-kg', name: 'Kilogram (kg)', code: 'kg', description: 'Standard metric weight', isActive: true, isSystemDefault: true },
        { id: 'uom-box', name: 'Box', code: 'box', description: 'Packaging box container', isActive: true, isSystemDefault: true },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        (LookupDataService.getLookupItems as jest.Mock).mockResolvedValue(mockUoms);
        (MasterDataService.getBranches as jest.Mock).mockResolvedValue([
            { id: 'b1', name: 'Tagbilaran Main', code: 'TAG-01', isHq: true, isActive: true },
        ]);
        (MasterDataService.getWarehouses as jest.Mock).mockResolvedValue([
            { id: 'w1', branchId: 'b1', name: 'Store Floor', type: 'store', isActive: true },
        ]);
        (MasterDataService.getCategories as jest.Mock).mockResolvedValue([
            { id: 'c1', name: 'Fried Chicken', slug: 'fried-chicken', icon: 'restaurant', isActive: true },
        ]);
        (MasterDataService.getSuppliers as jest.Mock).mockResolvedValue([
            { id: 's1', name: 'San Miguel Depot', contactPerson: 'Juan', phone: '09171234567', paymentTermsDays: 30, isActive: true },
        ]);
        (MasterDataService.getStatutoryRates as jest.Mock).mockResolvedValue([
            { id: 'r1', rateType: 'sss', bracketMin: 5000, bracketMax: 10000, employeeShare: 225, employerShare: 475 },
        ]);
    });

    it('renders header, navigation tabs, and loads default UOM lookup items', async () => {
        const { getByText } = render(<DataMaintenanceScreen />);

        expect(getByText('Data Maintenance')).toBeTruthy();
        expect(getByText('Dropdown Lookups')).toBeTruthy();
        expect(getByText('Branches & Locations')).toBeTruthy();
        expect(getByText('Product Categories')).toBeTruthy();
        expect(getByText('Suppliers')).toBeTruthy();
        expect(getByText('Statutory Rates')).toBeTruthy();
        expect(getByText('Directories')).toBeTruthy();

        await waitFor(() => {
            expect(getByText('Kilogram (kg)')).toBeTruthy();
            expect(getByText('Box')).toBeTruthy();
        });
    });

    it('navigates back to settings when back button is pressed', () => {
        const { getByTestId } = render(<DataMaintenanceScreen />);
        fireEvent.press(getByTestId('data-maintenance-back-btn'));
        expect(safeBack).toHaveBeenCalled();
    });

    it('opens add lookup modal and saves a new option', async () => {
        (LookupDataService.saveLookupItem as jest.Mock).mockResolvedValue({
            id: 'uom-crate',
            name: 'Plastic Crate',
            code: 'crate',
            isActive: true,
        });

        const { getByTestId, getByText } = render(<DataMaintenanceScreen />);

        await waitFor(() => {
            expect(getByText('Kilogram (kg)')).toBeTruthy();
        });

        fireEvent.press(getByTestId('add-lookup-item-btn'));

        expect(getByText('Add New Option')).toBeTruthy();

        fireEvent.changeText(getByTestId('lookup-name-input'), 'Plastic Crate');
        fireEvent.changeText(getByTestId('lookup-code-input'), 'crate');

        fireEvent.press(getByTestId('save-lookup-button'));

        await waitFor(() => {
            expect(LookupDataService.saveLookupItem).toHaveBeenCalledWith(
                'uom',
                expect.objectContaining({
                    name: 'Plastic Crate',
                    code: 'crate',
                })
            );
        });
    });

    it('switches to branches and locations tab and renders branch list', async () => {
        const { getByText } = render(<DataMaintenanceScreen />);

        fireEvent.press(getByText('Branches & Locations'));

        await waitFor(() => {
            expect(getByText('Operational Branches (1)')).toBeTruthy();
            expect(getByText('Tagbilaran Main')).toBeTruthy();
        });
    });

    it('switches to directories tab and renders master directory cards', async () => {
        const { getByText } = render(<DataMaintenanceScreen />);

        fireEvent.press(getByText('Directories'));

        expect(getByText('Connected Master Directories')).toBeTruthy();
        expect(getByText('Expense Categories')).toBeTruthy();
        expect(getByText('Chart of Accounts')).toBeTruthy();
        expect(getByText('Company Bank Accounts')).toBeTruthy();
        expect(getByText('Loan Products & Plans')).toBeTruthy();

        fireEvent.press(getByText('Expense Categories'));
        expect(mockPush).toHaveBeenCalledWith('/(admin)/settings/expense-categories');
    });
});
