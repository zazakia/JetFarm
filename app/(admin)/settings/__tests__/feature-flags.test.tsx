import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import FeatureFlagsSettingsScreen from '../feature-flags';
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
        getFeatureFlags: jest.fn(),
        setFeatureEnabled: jest.fn(),
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

describe('FeatureFlagsSettingsScreen', () => {
    const mockFlags = [
        {
            id: 'feature-1',
            key: 'module.borrowers',
            label: 'Borrowers',
            description: 'Borrower management description',
            enabled: true,
        },
        {
            id: 'feature-2',
            key: 'module.loans',
            label: 'Loans',
            description: 'Loan management description',
            enabled: false,
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        (SettingsService.getFeatureFlags as jest.Mock).mockResolvedValue(mockFlags);
    });

    it('shows loading indicator initially, then renders feature flags list', async () => {
        render(<FeatureFlagsSettingsScreen />);

        await waitFor(() => {
            expect(screen.getByText('Borrowers')).toBeTruthy();
            expect(screen.getByText('Borrower management description')).toBeTruthy();
            expect(screen.getByText('Loans')).toBeTruthy();
            expect(screen.getByText('Loan management description')).toBeTruthy();
        });
    });

    it('calls safeBack on back button press', async () => {
        render(<FeatureFlagsSettingsScreen />);
        await waitFor(() => {
            expect(screen.getByText('Borrowers')).toBeTruthy();
        });

        const backBtn = screen.getByText('arrow-back');
        fireEvent.press(backBtn);
        expect(safeBack).toHaveBeenCalledWith(expect.any(Object), '/(admin)/settings/business-rules');
    });

    it('toggles a feature flag successfully', async () => {
        (SettingsService.setFeatureEnabled as jest.Mock).mockResolvedValue(undefined);
        render(<FeatureFlagsSettingsScreen />);

        await waitFor(() => {
            expect(screen.getByText('Borrowers')).toBeTruthy();
        });

        const switches = screen.UNSAFE_getAllByType(require('react-native').Switch);
        expect(switches.length).toBe(2);

        fireEvent(switches[0], 'valueChange', false);

        expect(SettingsService.setFeatureEnabled).toHaveBeenCalledWith(
            mockFlags[0],
            false,
            'admin-id'
        );

        await waitFor(() => {
            expect(SettingsService.getFeatureFlags).toHaveBeenCalledTimes(2);
        });
    });

    it('shows Alert when loading feature flags fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const alertSpy = jest.spyOn(Alert, 'alert');
        (SettingsService.getFeatureFlags as jest.Mock).mockRejectedValue(new Error('Load failed'));

        render(<FeatureFlagsSettingsScreen />);

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith('Settings Error', 'Unable to load feature flags.');
        });
        consoleSpy.mockRestore();
    });

    it('shows Alert when toggling feature flag fails', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        (SettingsService.setFeatureEnabled as jest.Mock).mockRejectedValue(new Error('Save failed'));
        
        render(<FeatureFlagsSettingsScreen />);
        await waitFor(() => {
            expect(screen.getByText('Borrowers')).toBeTruthy();
        });

        const switches = screen.UNSAFE_getAllByType(require('react-native').Switch);
        fireEvent(switches[0], 'valueChange', false);

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith('Save Failed', 'Save failed');
        });
    });
});
