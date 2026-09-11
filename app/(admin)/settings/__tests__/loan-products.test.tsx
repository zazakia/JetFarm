import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import LoanProductsSettingsScreen from '../loan-products';
import { SettingsService } from '../../../../src/services/SettingsService';
import { safeBack } from '../../../../src/utils/navigation';
import { Alert } from 'react-native';

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
        getLoanProducts: jest.fn(),
        updateLoanProduct: jest.fn(),
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

describe('LoanProductsSettingsScreen', () => {
    const mockProducts = [
        {
            id: 'prod-1',
            productType: 'standard',
            label: 'Standard Loan',
            description: 'Standard interest rate loan',
            defaultRatePercent: 20,
            defaultTerm: 3,
            defaultTermUnit: 'months',
            defaultFrequency: 'monthly',
            defaultProcessingFeeRate: 2,
            defaultProcessingFeeFlat: 150,
            defaultNotarialFee: 100,
            defaultSavingsPerPayment: 50,
            defaultPrincipal: 5000,
            maxPrincipal: 10000,
            minTermMonths: 1,
            maxTermMonths: 6,
            isActive: true,
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        (SettingsService.getLoanProducts as jest.Mock).mockResolvedValue(mockProducts);
    });

    it('renders loan products list and fields', async () => {
        render(<LoanProductsSettingsScreen />);

        await waitFor(() => {
            expect(screen.getByText('Editable defaults for new loans')).toBeTruthy();
        });

        const inputs = screen.UNSAFE_getAllByType(require('react-native').TextInput);
        expect(inputs[0].props.value).toBe('Standard Loan');
        expect(inputs[1].props.value).toBe('Standard interest rate loan');
        expect(inputs[2].props.value).toBe('20');
        expect(inputs[3].props.value).toBe('3');
    });

    it('calls safeBack on arrow-back press', async () => {
        render(<LoanProductsSettingsScreen />);
        await waitFor(() => {
            expect(screen.getByText('Editable defaults for new loans')).toBeTruthy();
        });

        const backBtn = screen.getByText('arrow-back');
        fireEvent.press(backBtn);
        expect(safeBack).toHaveBeenCalledWith(expect.any(Object), '/(admin)/settings/business-rules');
    });

    it('toggles product active state successfully', async () => {
        (SettingsService.updateLoanProduct as jest.Mock).mockResolvedValue(undefined);
        render(<LoanProductsSettingsScreen />);
        await waitFor(() => {
            expect(screen.getByText('Editable defaults for new loans')).toBeTruthy();
        });

        const switches = screen.UNSAFE_getAllByType(require('react-native').Switch);
        expect(switches.length).toBe(1);

        fireEvent(switches[0], 'valueChange', false);

        expect(SettingsService.updateLoanProduct).toHaveBeenCalledWith(
            mockProducts[0],
            { isActive: false },
            'admin-id'
        );

        await waitFor(() => {
            expect(SettingsService.getLoanProducts).toHaveBeenCalledTimes(2);
        });
    });

    it('validates empty label on save', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        render(<LoanProductsSettingsScreen />);
        await waitFor(() => {
            expect(screen.getByText('Editable defaults for new loans')).toBeTruthy();
        });

        const inputs = screen.UNSAFE_getAllByType(require('react-native').TextInput);
        fireEvent.changeText(inputs[0], '');

        const saveBtn = screen.getByText('Save Product');
        fireEvent.press(saveBtn);

        expect(alertSpy).toHaveBeenCalledWith('Validation', 'Product label is required.');
        expect(SettingsService.updateLoanProduct).not.toHaveBeenCalled();
    });

    it('validates default term greater than zero on save', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        render(<LoanProductsSettingsScreen />);
        await waitFor(() => {
            expect(screen.getByText('Editable defaults for new loans')).toBeTruthy();
        });

        const inputs = screen.UNSAFE_getAllByType(require('react-native').TextInput);
        fireEvent.changeText(inputs[3], '0');

        const saveBtn = screen.getByText('Save Product');
        fireEvent.press(saveBtn);

        expect(alertSpy).toHaveBeenCalledWith('Validation', 'Default term must be greater than zero.');
        expect(SettingsService.updateLoanProduct).not.toHaveBeenCalled();
    });

    it('saves edited loan product successfully', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        (SettingsService.updateLoanProduct as jest.Mock).mockResolvedValue(undefined);
        render(<LoanProductsSettingsScreen />);
        await waitFor(() => {
            expect(screen.getByText('Editable defaults for new loans')).toBeTruthy();
        });

        const inputs = screen.UNSAFE_getAllByType(require('react-native').TextInput);
        fireEvent.changeText(inputs[0], 'Updated Loan');
        fireEvent.changeText(inputs[2], '18');

        const daysButton = screen.getByText('days');
        fireEvent.press(daysButton);

        const weeklyButton = screen.getByText('weekly');
        fireEvent.press(weeklyButton);

        const saveBtn = screen.getByText('Save Product');
        fireEvent.press(saveBtn);

        await waitFor(() => {
            expect(SettingsService.updateLoanProduct).toHaveBeenCalledWith(
                mockProducts[0],
                {
                    label: 'Updated Loan',
                    description: 'Standard interest rate loan',
                    defaultRatePercent: 18,
                    defaultTerm: 3,
                    defaultTermUnit: 'days',
                    defaultFrequency: 'weekly',
                    defaultProcessingFeeRate: 2,
                    defaultProcessingFeeFlat: 150,
                    defaultNotarialFee: 100,
                    defaultSavingsPerPayment: 50,
                    defaultPrincipal: 5000,
                    maxPrincipal: 10000,
                    minTermMonths: 1,
                    maxTermMonths: 6,
                },
                'admin-id'
            );
        });

        expect(alertSpy).toHaveBeenCalledWith('Saved', 'Loan product settings updated.');
    });

    it('handles save error gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const alertSpy = jest.spyOn(Alert, 'alert');
        (SettingsService.updateLoanProduct as jest.Mock).mockRejectedValue(new Error('Update failed'));

        render(<LoanProductsSettingsScreen />);
        await waitFor(() => {
            expect(screen.getByText('Editable defaults for new loans')).toBeTruthy();
        });

        const saveBtn = screen.getByText('Save Product');
        fireEvent.press(saveBtn);

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith('Save Failed', 'Update failed');
        });
        consoleSpy.mockRestore();
    });

    it('handles load error gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const alertSpy = jest.spyOn(Alert, 'alert');
        (SettingsService.getLoanProducts as jest.Mock).mockRejectedValue(new Error('Load failed'));

        render(<LoanProductsSettingsScreen />);

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith('Settings Error', 'Unable to load loan products.');
        });
        consoleSpy.mockRestore();
    });
});
