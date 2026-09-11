import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SyncStatusBadge } from '../SyncStatusBadge';
import { useSyncStore } from '../../stores/syncStore';
import { useAuth } from '../../store/AuthContext';
import { SyncService } from '../../services/SyncService';
import NetInfo from '@react-native-community/netinfo';

// Mock dependencies
jest.mock('../../stores/syncStore', () => ({
    useSyncStore: jest.fn()
}));

jest.mock('../../store/AuthContext', () => ({
    useAuth: jest.fn()
}));

jest.mock('../../services/SyncService', () => ({
    SyncService: {
        updatePendingCount: jest.fn(),
        checkAndSync: jest.fn()
    }
}));

jest.mock('@react-native-community/netinfo', () => ({
    configure: jest.fn(),
    addEventListener: jest.fn().mockImplementation((cb) => {
        // Return a dummy unsubscribe function
        return jest.fn();
    })
}));

describe('SyncStatusBadge', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Default mock states
        (useAuth as unknown as jest.Mock).mockReturnValue({ sunlightMode: false });
        
        (useSyncStore as unknown as jest.Mock).mockReturnValue({
            isOnline: true,
            pendingChanges: 0,
            status: 'idle',
            setOnline: jest.fn()
        });
    });

    it('renders correctly when online and synced', () => {
        const { getByText } = render(<SyncStatusBadge />);
        expect(getByText('Synced')).toBeTruthy();
        expect(SyncService.updatePendingCount).toHaveBeenCalled();
    });

    it('renders correctly when offline', () => {
        (useSyncStore as unknown as jest.Mock).mockReturnValue({
            isOnline: false,
            pendingChanges: 0,
            status: 'idle',
            setOnline: jest.fn()
        });
        const { getByText } = render(<SyncStatusBadge />);
        expect(getByText('Offline')).toBeTruthy();
    });

    it('renders correctly when there are pending changes', () => {
        (useSyncStore as unknown as jest.Mock).mockReturnValue({
            isOnline: true,
            pendingChanges: 5,
            status: 'idle',
            setOnline: jest.fn()
        });
        const { getByText } = render(<SyncStatusBadge />);
        expect(getByText('5 Pnd')).toBeTruthy();
    });

    it('renders syncing state', () => {
        (useSyncStore as unknown as jest.Mock).mockReturnValue({
            isOnline: true,
            pendingChanges: 5,
            status: 'syncing',
            setOnline: jest.fn()
        });
        const { getByText } = render(<SyncStatusBadge />);
        expect(getByText('Syncing')).toBeTruthy();
    });

    it('triggers sync when pressed, is online, and not currently syncing', async () => {
        const { getByText } = render(<SyncStatusBadge />);
        const button = getByText('Synced');
        
        fireEvent.press(button);

        await waitFor(() => {
            expect(SyncService.checkAndSync).toHaveBeenCalledWith({ force: true });
        });
    });

    it('does not trigger sync when pressed and offline', async () => {
        (useSyncStore as unknown as jest.Mock).mockReturnValue({
            isOnline: false,
            pendingChanges: 0,
            status: 'idle',
            setOnline: jest.fn()
        });
        const { getByText } = render(<SyncStatusBadge />);
        const button = getByText('Offline');
        
        // In reality, TouchableOpacity is disabled, but we can verify our internal check
        fireEvent.press(button);

        expect(SyncService.checkAndSync).not.toHaveBeenCalled();
    });

    it('unsubscribes from NetInfo on unmount', () => {
        const mockUnsubscribe = jest.fn();
        (NetInfo.addEventListener as jest.Mock).mockImplementationOnce(() => mockUnsubscribe);
        
        const { unmount } = render(<SyncStatusBadge />);
        unmount();
        
        expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('calls setOnline when NetInfo state changes', () => {
        let callback: any;
        const mockSetOnline = jest.fn();
        
        (useSyncStore as unknown as jest.Mock).mockReturnValue({
            isOnline: true,
            pendingChanges: 0,
            status: 'idle',
            setOnline: mockSetOnline
        });

        (NetInfo.addEventListener as jest.Mock).mockImplementationOnce((cb) => {
            callback = cb;
            return jest.fn();
        });
        
        render(<SyncStatusBadge />);
        
        // Simulate network state change
        callback({ isConnected: false });
        expect(mockSetOnline).toHaveBeenCalledWith(false);

        callback({ isConnected: true });
        expect(mockSetOnline).toHaveBeenCalledWith(true);
    });

    it('handles sunlight mode visually', () => {
        (useAuth as unknown as jest.Mock).mockReturnValue({ sunlightMode: true });
        const { getByText } = render(<SyncStatusBadge />);
        expect(getByText('Synced')).toBeTruthy();
        // Just verifying it renders without crashing when sunlightMode is true
    });

    it('renders syncing state in sunlight mode', () => {
        (useAuth as unknown as jest.Mock).mockReturnValue({ sunlightMode: true });
        (useSyncStore as unknown as jest.Mock).mockReturnValue({
            isOnline: true,
            pendingChanges: 5,
            status: 'syncing',
            setOnline: jest.fn()
        });
        const { getByText } = render(<SyncStatusBadge />);
        expect(getByText('Syncing')).toBeTruthy();
    });
});

