import { AutoSyncServiceClass } from '../AutoSyncService';
import { useSyncStore } from '../../stores/syncStore';

const flushPromises = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

function createMockDb() {
    const subscribers: ((count: number) => void)[] = [];
    const collectionMock = {
        query: jest.fn(() => ({
            observeCount: jest.fn(() => ({
                subscribe: jest.fn((cb: (count: number) => void) => {
                    subscribers.push(cb);
                    cb(0);
                    return { unsubscribe: jest.fn() };
                }),
            })),
        })),
    };
    const db = {
        collections: {
            get: jest.fn(() => collectionMock),
        },
        get: jest.fn(() => collectionMock),
    };
    return { db, subscribers };
}

describe('AutoSyncService', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        useSyncStore.getState().reset();
        useSyncStore.getState().setOnline(true);
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('debounces pending local changes into one local-change sync', async () => {
        const { db, subscribers } = createMockDb();
        const syncService = {
            updatePendingCount: jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(0),
            checkAndSync: jest.fn().mockResolvedValue(undefined),
        };
        const service = new AutoSyncServiceClass(db as any, syncService as any);

        service.start();
        subscribers[0](1);
        subscribers[1](1);

        jest.advanceTimersByTime(2999);
        expect(syncService.checkAndSync).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        await flushPromises();

        expect(syncService.checkAndSync).toHaveBeenCalledTimes(1);
        expect(syncService.checkAndSync).toHaveBeenCalledWith(expect.objectContaining({
            force: false,
            localChange: true,
        }));

        service.stop();
    });

    it('does not sync while offline but still refreshes pending count', async () => {
        const { db } = createMockDb();
        const syncService = {
            updatePendingCount: jest.fn().mockResolvedValue(2),
            checkAndSync: jest.fn().mockResolvedValue(undefined),
        };
        const service = new AutoSyncServiceClass(db as any, syncService as any);
        useSyncStore.getState().setOnline(false);

        service.queue('unit-test', 0);
        jest.advanceTimersByTime(0);
        await flushPromises();

        expect(syncService.updatePendingCount).toHaveBeenCalled();
        expect(syncService.checkAndSync).not.toHaveBeenCalled();

        service.stop();
    });

    it('does not sync when no pending records remain', async () => {
        const { db } = createMockDb();
        const syncService = {
            updatePendingCount: jest.fn().mockResolvedValue(0),
            checkAndSync: jest.fn().mockResolvedValue(undefined),
        };
        const service = new AutoSyncServiceClass(db as any, syncService as any);

        service.queue('unit-test', 0);
        jest.advanceTimersByTime(0);
        await flushPromises();

        expect(syncService.checkAndSync).not.toHaveBeenCalled();

        service.stop();
    });

    it('waits for an authenticated session before subscribing to realtime', async () => {
        const { db } = createMockDb();
        const channel = {
            on: jest.fn(() => channel),
            subscribe: jest.fn(() => channel),
            unsubscribe: jest.fn(),
        };
        const realtimeClient = {
            channel: jest.fn(() => channel),
            removeChannel: jest.fn().mockResolvedValue(undefined),
        };
        const syncService = {
            updatePendingCount: jest.fn().mockResolvedValue(0),
            checkAndSync: jest.fn().mockResolvedValue(undefined),
        };
        const service = new AutoSyncServiceClass(db as any, syncService as any, realtimeClient as any);

        service.start();
        expect(realtimeClient.channel).not.toHaveBeenCalled();

        service.setAuthenticated(true);
        expect(realtimeClient.channel).toHaveBeenCalledTimes(1);

        service.setAuthenticated(false);
        await flushPromises();
        expect(realtimeClient.removeChannel).toHaveBeenCalledWith(channel);

        service.stop();
    });

    it('queues a pull sync when Supabase Realtime reports remote changes', async () => {
        const { db } = createMockDb();
        let remoteChangeHandler: (() => void) | undefined;
        const channel = {
            on: jest.fn((_type, _filter, callback) => {
                remoteChangeHandler = callback;
                return channel;
            }),
            subscribe: jest.fn(() => channel),
            unsubscribe: jest.fn(),
        };
        const realtimeClient = {
            channel: jest.fn(() => channel),
            removeChannel: jest.fn(),
        };
        const syncService = {
            updatePendingCount: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
            checkAndSync: jest.fn().mockResolvedValue(undefined),
        };
        const service = new AutoSyncServiceClass(db as any, syncService as any, realtimeClient as any);

        service.setAuthenticated(true);
        service.start();
        remoteChangeHandler?.();

        jest.advanceTimersByTime(1000);
        await flushPromises();

        expect(realtimeClient.channel).toHaveBeenCalledWith('autosync-remote-changes');
        expect(channel.on).toHaveBeenCalledWith(
            'postgres_changes',
            expect.objectContaining({ event: '*', schema: 'public' }),
            expect.any(Function)
        );
        expect(syncService.checkAndSync).toHaveBeenCalledWith(expect.objectContaining({
            localChange: true,
            reason: expect.stringContaining('remote-change:'),
        }));

        service.stop();
        expect(realtimeClient.removeChannel).toHaveBeenCalledWith(channel);
    });

    it('reconnects realtime after transient channel errors without crashing autosync', async () => {
        const { db } = createMockDb();
        let statusCallback: ((status: string) => void) | undefined;
        const channel = {
            on: jest.fn(() => channel),
            subscribe: jest.fn((callback?: (status: string) => void) => {
                statusCallback = callback;
                return channel;
            }),
            unsubscribe: jest.fn(),
        };
        const realtimeClient = {
            channel: jest.fn(() => channel),
            removeChannel: jest.fn().mockResolvedValue(undefined),
        };
        const syncService = {
            updatePendingCount: jest.fn().mockResolvedValue(0),
            checkAndSync: jest.fn().mockResolvedValue(undefined),
        };
        const service = new AutoSyncServiceClass(db as any, syncService as any, realtimeClient as any);

        service.setAuthenticated(true);
        service.start();
        expect(realtimeClient.channel).toHaveBeenCalledTimes(1);

        statusCallback?.('CHANNEL_ERROR');
        jest.advanceTimersByTime(5000);
        await flushPromises();

        expect(realtimeClient.removeChannel).toHaveBeenCalledWith(channel);
        expect(realtimeClient.channel).toHaveBeenCalledTimes(2);

        service.stop();
    });

    it('does not flush if already syncing and queues a recheck', async () => {
        const { db } = createMockDb();
        const syncService = {
            updatePendingCount: jest.fn(),
            checkAndSync: jest.fn(),
        };
        const service = new AutoSyncServiceClass(db as any, syncService as any);
        useSyncStore.getState().setOnline(true);
        useSyncStore.getState().status = 'syncing';

        service.queue('unit-test', 0);
        jest.advanceTimersByTime(0);
        await flushPromises();

        expect(syncService.checkAndSync).not.toHaveBeenCalled();
        service.stop();
    });

    it('stops syncing and does not retry if errorMessage contains No active session', async () => {
        const { db } = createMockDb();
        const syncService = {
            updatePendingCount: jest.fn().mockResolvedValue(1),
            checkAndSync: jest.fn().mockImplementation(() => {
                useSyncStore.getState().status = 'error';
                useSyncStore.getState().errorMessage = 'No active session';
            }),
        };
        const service = new AutoSyncServiceClass(db as any, syncService as any);

        service.queue('unit-test', 0);
        jest.advanceTimersByTime(0);
        await flushPromises();

        expect(jest.getTimerCount()).toBe(0);
        service.stop();
    });

    it('schedules retry when sync fails', async () => {
        const { db } = createMockDb();
        const syncService = {
            updatePendingCount: jest.fn().mockResolvedValue(1),
            checkAndSync: jest.fn().mockRejectedValue(new Error('Network error')),
        };
        const service = new AutoSyncServiceClass(db as any, syncService as any);
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        service.queue('unit-test', 0);
        jest.advanceTimersByTime(0);
        await flushPromises();

        expect(warnSpy).toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(1);
        
        warnSpy.mockRestore();
        service.stop();
    });

    it('handles DB get error in start gracefully', () => {
        const db = {
            get: jest.fn().mockImplementation(() => {
                throw new Error('Table missing');
            }),
        };
        const service = new AutoSyncServiceClass(db as any, {} as any);
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        expect(() => service.start()).not.toThrow();
        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
        service.stop();
    });

    it('handles realtime subscribe error gracefully', () => {
        const { db } = createMockDb();
        const realtimeClient = {
            channel: jest.fn().mockImplementation(() => {
                throw new Error('Realtime error');
            }),
        };
        const service = new AutoSyncServiceClass(db as any, {} as any, realtimeClient as any);
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        service.start();
        expect(() => service.setAuthenticated(true)).not.toThrow();
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Could not start realtime pull triggers'),
            expect.any(Error)
        );

        warnSpy.mockRestore();
        service.stop();
    });

    it('unsubscribes from channel if removeChannel is not defined', async () => {
        const { db } = createMockDb();
        const channel = {
            on: jest.fn(() => channel),
            subscribe: jest.fn(() => channel),
            unsubscribe: jest.fn().mockResolvedValue(undefined),
        };
        const realtimeClient = {
            channel: jest.fn(() => channel),
        };
        const service = new AutoSyncServiceClass(db as any, {} as any, realtimeClient as any);

        service.setAuthenticated(true);
        service.start();
        await service.stop();

        expect(channel.unsubscribe).toHaveBeenCalled();
    });
});
