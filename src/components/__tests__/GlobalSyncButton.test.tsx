import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { GlobalSyncButton } from '../GlobalSyncButton';
import { useAuth } from '../../store/AuthContext';
import { useSyncStore } from '../../stores/syncStore';
import { SyncService } from '../../services/SyncService';
import { usePathname, useRouter } from 'expo-router';

jest.mock('../../store/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../../stores/syncStore', () => ({
    useSyncStore: jest.fn(),
}));

jest.mock('../../services/SyncService', () => ({
    SyncService: {
        checkAndSync: jest.fn(),
    },
}));

const push = jest.fn();

jest.mock('expo-router', () => ({
    usePathname: jest.fn(),
    useRouter: jest.fn(),
}));

describe('GlobalSyncButton', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useRouter as jest.Mock).mockReturnValue({ push });
        (usePathname as jest.Mock).mockReturnValue('/(collector)');
        (useAuth as unknown as jest.Mock).mockReturnValue({
            user: { id: 'user-1' },
            role: 'collector',
            sunlightMode: false,
        });
        (useSyncStore as unknown as jest.Mock).mockReturnValue({
            status: 'idle',
            pendingChanges: 0,
            isOnline: true,
        });
        (SyncService.checkAndSync as jest.Mock).mockResolvedValue(undefined);
    });

    it('renders for authenticated module screens', () => {
        const { getByTestId, getByText } = render(<GlobalSyncButton />);

        expect(getByTestId('global-sync-button')).toBeTruthy();
        expect(getByText('Sync')).toBeTruthy();
    });

    it('hides when there is no authenticated user', () => {
        (useAuth as unknown as jest.Mock).mockReturnValue({
            user: null,
            role: null,
            sunlightMode: false,
        });

        const { queryByTestId } = render(<GlobalSyncButton />);

        expect(queryByTestId('global-sync-button')).toBeNull();
    });

    it('hides on auth and sync-center routes', () => {
        (usePathname as jest.Mock).mockReturnValue('/login');
        const loginRender = render(<GlobalSyncButton />);
        expect(loginRender.queryByTestId('global-sync-button')).toBeNull();
        loginRender.unmount();

        (usePathname as jest.Mock).mockReturnValue('/sync-center');
        const syncCenterRender = render(<GlobalSyncButton />);
        expect(syncCenterRender.queryByTestId('global-sync-button')).toBeNull();
    });

    it('hides on the admin shell where local sync controls already exist', () => {
        (usePathname as jest.Mock).mockReturnValue('/(admin)');
        (useAuth as unknown as jest.Mock).mockReturnValue({
            user: { id: 'admin-1' },
            role: 'admin',
            sunlightMode: false,
        });

        const { queryByTestId } = render(<GlobalSyncButton />);

        expect(queryByTestId('global-sync-button')).toBeNull();
    });

    it('runs a forced sync when pressed online', async () => {
        const { getByTestId } = render(<GlobalSyncButton />);

        fireEvent.press(getByTestId('global-sync-button'));

        await waitFor(() => {
            expect(SyncService.checkAndSync).toHaveBeenCalledWith({ force: true });
        });
        expect(push).not.toHaveBeenCalled();
    });
    it('opens Sync Center on long press for detailed status', () => {
        const { getByTestId } = render(<GlobalSyncButton />);

        fireEvent(getByTestId('global-sync-button'), 'longPress');

        expect(push).toHaveBeenCalledWith('/sync-center');
        expect(SyncService.checkAndSync).not.toHaveBeenCalled();
    });

    it('shows pending-change count and cloud upload state', () => {
        (useSyncStore as unknown as jest.Mock).mockReturnValue({
            status: 'idle',
            pendingChanges: 7,
            isOnline: true,
        });

        const { getByText } = render(<GlobalSyncButton />);

        expect(getByText('7')).toBeTruthy();
        expect(getByText('Sync')).toBeTruthy();
    });

    it('stays anchored near the top-right to avoid bottom action buttons', () => {
        const { getByTestId } = render(<GlobalSyncButton />);

        expect(getByTestId('global-sync-button-container').props.style).toEqual(expect.objectContaining({
            position: 'absolute',
            right: 16,
            top: 84,
        }));
    });

    it('recovers from manual sync failure and returns to Sync label', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        (SyncService.checkAndSync as jest.Mock).mockRejectedValueOnce(new Error('network down'));

        const { getByTestId, getByText } = render(<GlobalSyncButton />);

        await act(async () => {
            fireEvent.press(getByTestId('global-sync-button'));
        });

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith('[GlobalSyncButton] Manual sync failed:', expect.any(Error));
            expect(getByText('Sync')).toBeTruthy();
        });
        consoleSpy.mockRestore();
    });
    it('opens Sync Center when offline', () => {
        (useSyncStore as unknown as jest.Mock).mockReturnValue({
            status: 'idle',
            pendingChanges: 3,
            isOnline: false,
        });

        const { getByTestId } = render(<GlobalSyncButton />);

        fireEvent.press(getByTestId('global-sync-button'));

        expect(SyncService.checkAndSync).not.toHaveBeenCalled();
        expect(push).toHaveBeenCalledWith('/sync-center');
    });

    it('opens Sync Center while already syncing', () => {
        (useSyncStore as unknown as jest.Mock).mockReturnValue({
            status: 'syncing',
            pendingChanges: 0,
            isOnline: true,
        });

        const { getByTestId } = render(<GlobalSyncButton />);

        fireEvent.press(getByTestId('global-sync-button'));

        expect(SyncService.checkAndSync).not.toHaveBeenCalled();
        expect(push).toHaveBeenCalledWith('/sync-center');
    });
});
