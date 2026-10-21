import { renderHook, act, waitFor } from '@testing-library/react-native';

import { useSync } from '../useSync';
import { SyncService } from '../../services/SyncService';

// Mock all dependencies
jest.mock('../../services/SyncService', () => ({
    SyncService: {
        checkAndSync: jest.fn().mockResolvedValue(undefined),
        updatePendingCount: jest.fn().mockResolvedValue(5),
    },
}));

const mockFetchCount = jest.fn().mockResolvedValue(3);
jest.mock('../../database', () => ({
    database: {
        collections: {
            get: jest.fn(() => ({
                query: jest.fn().mockReturnValue({
                    fetchCount: mockFetchCount,
                }),
            })),
        },
    },
}));

jest.mock('@react-native-community/netinfo', () => ({
    addEventListener: jest.fn().mockReturnValue(jest.fn()),
    fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

jest.mock('../../stores/syncStore', () => {
    const actual: Record<string, any> = {
        status: 'idle',
        progress: 0,
        currentModel: '',
        errorMessage: null,
        pendingChanges: 0,
        lastSyncAt: null,
        isOnline: true,
        setOnline: jest.fn(),
    };
    const store = (selector?: (state: any) => any) => {
        if (selector) return selector(actual);
        return actual;
    };
    store.getState = () => actual;
    store.setState = (update: any) => Object.assign(actual, typeof update === 'function' ? update(actual) : update);
    store.subscribe = jest.fn();

    return {
        useSyncStore: store,
    };
});

describe('useSync', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns correct shape', () => {
        const { result } = renderHook(() => useSync());

        expect(result.current).toHaveProperty('sync');
        expect(result.current).toHaveProperty('isSyncing');
        expect(result.current).toHaveProperty('isOnline');
        expect(result.current).toHaveProperty('syncProgress');
        expect(result.current).toHaveProperty('pendingChanges');
        expect(result.current).toHaveProperty('lastSyncAt');
        expect(result.current).toHaveProperty('getPendingCount');
    });

    it('triggers SyncService.checkAndSync when sync is called', async () => {
        const { result } = renderHook(() => useSync());

        await act(async () => {
            await result.current.sync();
        });

        expect(SyncService.checkAndSync).toHaveBeenCalledWith({ force: false });
    });

    it('passes force flag to SyncService', async () => {
        const { result } = renderHook(() => useSync());

        await act(async () => {
            await result.current.sync(true);
        });

        expect(SyncService.checkAndSync).toHaveBeenCalledWith({ force: true });
    });

    it('handles sync errors gracefully', async () => {
        (SyncService.checkAndSync as jest.Mock).mockRejectedValueOnce(
            new Error('Network error')
        );
        const errorSpy = jest.spyOn(console, 'error').mockImplementation();

        const { result } = renderHook(() => useSync());

        await act(async () => {
            await result.current.sync();
        });

        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('[useSync]'),
            expect.any(Error)
        );
        errorSpy.mockRestore();
    });

    it('getPendingCount delegates to SyncService', async () => {
        const { result } = renderHook(() => useSync());

        let count: number = 0;
        await act(async () => {
            count = await result.current.getPendingCount();
        });

        expect(SyncService.updatePendingCount).toHaveBeenCalled();
        expect(count).toBe(5);
    });

    it('isSyncing is false initially', () => {
        const { result } = renderHook(() => useSync());
        expect(result.current.isSyncing).toBe(false);
    });
});
