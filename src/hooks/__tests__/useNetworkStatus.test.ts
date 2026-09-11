import { renderHook, act } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import { useNetworkStatus } from '../useNetworkStatus';
import { useSyncStore } from '../../stores/syncStore';
import { AutoSyncService } from '../../services/AutoSyncService';

jest.mock('@react-native-community/netinfo', () => ({
    configure: jest.fn(),
    addEventListener: jest.fn(),
    fetch: jest.fn(),
}));

jest.mock('../../services/AutoSyncService', () => ({
    AutoSyncService: {
        queue: jest.fn(),
    }
}));

describe('useNetworkStatus', () => {
    let mockUnsubscribe: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockUnsubscribe = jest.fn();
        (NetInfo.addEventListener as jest.Mock).mockReturnValue(mockUnsubscribe);
        (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });
        
        // Reset store state
        useSyncStore.getState().setOnline(true);
    });

    it('should initialize with online status from fetch', async () => {
        (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });
        
        renderHook(() => useNetworkStatus());
        
        await act(async () => {
            // Wait for fetch promise
        });

        expect(useSyncStore.getState().isOnline).toBe(false);
    });

    it('should update status and trigger sync when coming back online', async () => {
        let changeCallback: (state: any) => void = () => {};
        (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
            changeCallback = cb;
            return mockUnsubscribe;
        });

        useSyncStore.getState().setOnline(false); // Start offline
        renderHook(() => useNetworkStatus());

        await act(async () => {
            changeCallback({ isConnected: true });
        });

        expect(useSyncStore.getState().isOnline).toBe(true);
        expect(AutoSyncService.queue).toHaveBeenCalledWith('network-reconnected', 0);
    });

    it('should not trigger sync when staying online', async () => {
        let changeCallback: (state: any) => void = () => {};
        (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
            changeCallback = cb;
            return mockUnsubscribe;
        });

        useSyncStore.getState().setOnline(true);
        renderHook(() => useNetworkStatus());

        await act(async () => {
            changeCallback({ isConnected: true });
        });

        expect(AutoSyncService.queue).not.toHaveBeenCalled();
    });

    it('should unsubscribe on unmount', () => {
        const { unmount } = renderHook(() => useNetworkStatus());
        unmount();
        expect(mockUnsubscribe).toHaveBeenCalled();
    });
});
