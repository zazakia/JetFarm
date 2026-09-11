import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import RoleAccessSettingsScreen from '../role-access';
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
        getRolePermissions: jest.fn(),
        setRolePermissionEnabled: jest.fn(),
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

describe('RoleAccessSettingsScreen', () => {
    const mockPermissions = [
        {
            id: 'perm-1',
            role: 'admin',
            permissionKey: 'route.(admin)',
            label: 'Admin dashboard',
            category: 'Route groups',
            enabled: true,
        },
        {
            id: 'perm-2',
            role: 'admin',
            permissionKey: 'module.loans',
            label: 'Loans module',
            category: 'Modules',
            enabled: true,
        },
        {
            id: 'perm-3',
            role: 'collector',
            permissionKey: 'route.(collector)',
            label: 'Collector dashboard',
            category: 'Route groups',
            enabled: true,
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        (SettingsService.getRolePermissions as jest.Mock).mockResolvedValue(mockPermissions);
    });

    it('shows loading spinner initially, then renders role access settings list', async () => {
        render(<RoleAccessSettingsScreen />);

        await waitFor(() => {
            expect(screen.getByText('Admin dashboard')).toBeTruthy();
            expect(screen.getByText('Loans module')).toBeTruthy();
            expect(screen.queryByText('Collector dashboard')).toBeNull();
        });
    });

    it('navigates back to business rules on arrow-back press', async () => {
        render(<RoleAccessSettingsScreen />);
        await waitFor(() => {
            expect(screen.getByText('Admin dashboard')).toBeTruthy();
        });

        const backBtn = screen.getByText('arrow-back');
        fireEvent.press(backBtn);
        expect(safeBack).toHaveBeenCalledWith(expect.any(Object), '/(admin)/settings/business-rules');
    });

    it('allows changing selected role and filters permissions list', async () => {
        render(<RoleAccessSettingsScreen />);
        await waitFor(() => {
            expect(screen.getByText('Admin dashboard')).toBeTruthy();
        });

        const collectorTab = screen.getByText('Collector');
        fireEvent.press(collectorTab);

        await waitFor(() => {
            expect(screen.getByText('Collector dashboard')).toBeTruthy();
            expect(screen.queryByText('Admin dashboard')).toBeNull();
        });
    });

    it('prevents disabling admin/main_office dashboard access', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        render(<RoleAccessSettingsScreen />);
        await waitFor(() => {
            expect(screen.getByText('Admin dashboard')).toBeTruthy();
        });

        const switches = screen.UNSAFE_getAllByType(require('react-native').Switch);
        expect(switches.length).toBe(2);

        fireEvent(switches[0], 'valueChange', false);

        expect(alertSpy).toHaveBeenCalledWith(
            'Protected Access',
            expect.stringContaining('Admin and Main Office dashboard access cannot be disabled')
        );
        expect(SettingsService.setRolePermissionEnabled).not.toHaveBeenCalled();
    });

    it('successfully updates and toggles permission', async () => {
        (SettingsService.setRolePermissionEnabled as jest.Mock).mockResolvedValue(undefined);
        render(<RoleAccessSettingsScreen />);
        await waitFor(() => {
            expect(screen.getByText('Loans module')).toBeTruthy();
        });

        const switches = screen.UNSAFE_getAllByType(require('react-native').Switch);
        fireEvent(switches[1], 'valueChange', false);

        expect(SettingsService.setRolePermissionEnabled).toHaveBeenCalledWith(
            mockPermissions[1],
            false,
            'admin-id'
        );

        await waitFor(() => {
            expect(SettingsService.getRolePermissions).toHaveBeenCalledTimes(2);
        });
    });

    it('alerts error when save fails', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        (SettingsService.setRolePermissionEnabled as jest.Mock).mockRejectedValue(new Error('Save error'));
        render(<RoleAccessSettingsScreen />);
        await waitFor(() => {
            expect(screen.getByText('Loans module')).toBeTruthy();
        });

        const switches = screen.UNSAFE_getAllByType(require('react-native').Switch);
        fireEvent(switches[1], 'valueChange', false);

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith('Save Failed', 'Save error');
        });
    });

    it('alerts error when loading fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const alertSpy = jest.spyOn(Alert, 'alert');
        (SettingsService.getRolePermissions as jest.Mock).mockRejectedValue(new Error('Load error'));

        render(<RoleAccessSettingsScreen />);

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith('Settings Error', 'Unable to load role permissions.');
        });
        consoleSpy.mockRestore();
    });
});
