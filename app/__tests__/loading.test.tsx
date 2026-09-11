import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import LoadingScreen from '../loading';
import { LAST_AUTHORIZED_ROUTE_KEY } from '../../src/utils/authNavigation';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
    router: { replace: mockReplace },
}));

jest.mock('../../src/services/SyncService', () => ({
    SyncService: {
        checkAndSync: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../../src/stores/syncStore', () => ({
    useSyncStore: jest.fn(),
}));

jest.mock('../../src/store/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
}));

describe('LoadingScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        const { router } = require('expo-router');
        router.replace = mockReplace;
        const AsyncStorage = require('@react-native-async-storage/async-storage');
        AsyncStorage.getItem.mockResolvedValue(null);
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it('waits for role resolution before redirecting logged-in users', () => {
        const { useSyncStore } = require('../../src/stores/syncStore');
        const { useAuth } = require('../../src/store/AuthContext');

        useSyncStore.mockReturnValue({
            status: 'completed',
            currentModel: '',
            progress: 1,
        });

        useAuth.mockReturnValue({
            initialized: true,
            user: { id: 'u1' },
            role: null,
            roleResolved: false,
        });

        render(<LoadingScreen />);

        expect(screen.getByText('Resolving access...')).toBeTruthy();
        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('redirects after role resolution changes while the role stays null', () => {
        const { useSyncStore } = require('../../src/stores/syncStore');
        const { useAuth } = require('../../src/store/AuthContext');

        useSyncStore.mockReturnValue({
            status: 'completed',
            currentModel: '',
            progress: 1,
        });

        useAuth.mockReturnValue({
            initialized: true,
            user: { id: 'u1' },
            role: null,
            roleResolved: false,
            initializationError: null,
        });

        const { rerender } = render(<LoadingScreen />);

        expect(mockReplace).not.toHaveBeenCalled();

        useAuth.mockReturnValue({
            initialized: true,
            user: { id: 'u1' },
            role: null,
            roleResolved: true,
            initializationError: null,
        });

        rerender(<LoadingScreen />);
        jest.advanceTimersByTime(1000);

        expect(mockReplace).toHaveBeenCalledWith('/login');
    });

    it('clears the sync timeout on unmount after sync completes', async () => {
        const { useSyncStore } = require('../../src/stores/syncStore');
        const { useAuth } = require('../../src/store/AuthContext');
        const { SyncService } = require('../../src/services/SyncService');
        const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

        useSyncStore.mockReturnValue({
            status: 'idle',
            currentModel: '',
            progress: 0,
        });

        useAuth.mockReturnValue({
            initialized: true,
            user: { id: 'u1' },
            role: 'admin',
            roleResolved: true,
            initializationError: null,
        });

        SyncService.checkAndSync.mockResolvedValue(undefined);

        const { unmount } = render(<LoadingScreen />);

        await Promise.resolve();
        await Promise.resolve();
        unmount();

        expect(clearTimeoutSpy).toHaveBeenCalled();
        clearTimeoutSpy.mockRestore();
    });

    it('restores the last authorized route instead of always returning to the role dashboard', async () => {
        const { useSyncStore } = require('../../src/stores/syncStore');
        const { useAuth } = require('../../src/store/AuthContext');
        const AsyncStorage = require('@react-native-async-storage/async-storage');

        useSyncStore.mockReturnValue({
            status: 'completed',
            currentModel: '',
            progress: 1,
        });

        useAuth.mockReturnValue({
            initialized: true,
            user: { id: 'u1' },
            role: 'admin',
            roleResolved: true,
            initializationError: null,
        });

        AsyncStorage.getItem.mockResolvedValue('/(admin)/borrowers');

        render(<LoadingScreen />);

        await act(async () => {
            jest.advanceTimersByTime(1000);
            await Promise.resolve();
        });

        expect(AsyncStorage.getItem).toHaveBeenCalledWith(LAST_AUTHORIZED_ROUTE_KEY);
        expect(mockReplace).toHaveBeenCalledWith('/(admin)/borrowers');
    });

    it('opens the role home while initial sync continues in the background', async () => {
        const { useSyncStore } = require('../../src/stores/syncStore');
        const { useAuth } = require('../../src/store/AuthContext');
        const { SyncService } = require('../../src/services/SyncService');

        useSyncStore.mockReturnValue({
            status: 'syncing',
            currentModel: 'loans',
            progress: 0.2,
        });

        useAuth.mockReturnValue({
            initialized: true,
            user: { id: 'u1' },
            role: 'collector',
            roleResolved: true,
            initializationError: null,
        });

        SyncService.checkAndSync.mockImplementation(() => new Promise(() => {}));

        render(<LoadingScreen />);

        await act(async () => {
            jest.advanceTimersByTime(1200);
            await Promise.resolve();
        });

        expect(SyncService.checkAndSync).toHaveBeenCalledWith({ force: true });
        expect(mockReplace).toHaveBeenCalledWith('/(collector)');
    });
});
