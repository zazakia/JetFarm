import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { useSyncStore } from '../stores/syncStore';
import { AutoSyncService } from '../services/AutoSyncService';

// NetInfo's web default reachability URL is "/" which becomes the Expo dev
// server origin (for example http://localhost:8081). When Metro restarts or
// crashes during development, the browser repeatedly logs noisy HEAD failures
// against that local URL. Web already has navigator online/offline events, and
// this app only consumes isConnected, so disable the extra web reachability poll.
if (Platform.OS === 'web') {
    NetInfo.configure({
        reachabilityShouldRun: () => false,
        useNativeReachability: true,
    });
}

/**
 * Hook that monitors network connectivity and:
 * - Updates syncStore.isOnline on every change
 * - Triggers a sync automatically when connectivity is restored
 */
export function useNetworkStatus() {
    const { setOnline, isOnline } = useSyncStore();

    useEffect(() => {
        // Fetch initial state
        NetInfo.fetch().then((state) => {
            setOnline(state.isConnected ?? true);
        });

        const unsubscribe = NetInfo.addEventListener((state) => {
            const connected = state.isConnected ?? true;
            const wasOffline = !useSyncStore.getState().isOnline;

            setOnline(connected);

            // Auto-sync when coming back online (throttled)
            if (connected && wasOffline) {
                console.log('[NetworkStatus] Reconnected – triggering sync...');
                AutoSyncService.queue('network-reconnected', 0);
            }
        });

        return () => unsubscribe();
    }, []);
}
