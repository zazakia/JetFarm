import { useEffect, useState, useCallback } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import { SyncService } from '../services/SyncService';
import { useSyncStore } from '../stores/syncStore';
import { useNetworkStatus } from './useNetworkStatus';

interface SyncProgress {
    status: 'idle' | 'syncing' | 'completed' | 'error';
    progress: number;
    currentModel?: string;
    errorMessage?: string | null;
    pendingChanges?: number;
    lastSyncAt?: Date;
}

/**
 * Hook to manage sync operations and track sync state
 * Automatically triggers sync when network is restored
 * Provides manual sync trigger and progress tracking
 */
export function useSync() {
    const [isSyncing, setIsSyncing] = useState(false);
    const { isOnline } = useSyncStore();
    
    // Initialize network monitoring
    useNetworkStatus();

    // Get sync progress from store - properties are directly on the store
    const syncProgress = useSyncStore((state) => ({
        status: state.status as any,
        progress: state.progress ?? 0,
        currentModel: state.currentModel,
        errorMessage: state.errorMessage,
        pendingChanges: state.pendingChanges ?? 0,
        lastSyncAt: state.lastSyncAt,
    }));

    /**
     * Trigger a sync operation
     */
    const sync = useCallback(async (force: boolean = false) => {
        if (isSyncing && !force) {
            console.log('[useSync] Sync already in progress');
            return;
        }

        try {
            setIsSyncing(true);
            await SyncService.checkAndSync({ force });
        } catch (err) {
            console.error('[useSync] Sync failed:', err);
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing]);

    /**
     * Get count of pending changes (unsynced records)
     */
    const getPendingCount = useCallback(async () => {
        return await SyncService.updatePendingCount();
    }, []);

    /**
     * Verify that assigned borrowers are present in local DB
     * Useful for ensuring data consistency after sync
     */
    const verifyBorrowerAssignments = useCallback(async (collectorId: string) => {
        try {
            const collection = database.collections.get('borrowers');
            const query = collection.query(Q.where('collector_id', collectorId));
            const count = await query.fetchCount();
            return count > 0;
        } catch (err) {
            console.error('[useSync] Verification failed:', err);
            return false;
        }
    }, []);

    return {
        sync,
        isSyncing,
        isOnline,
        syncProgress: syncProgress as SyncProgress,
        pendingChanges: syncProgress.pendingChanges,
        lastSyncAt: syncProgress.lastSyncAt,
        getPendingCount,
        verifyBorrowerAssignments,
    };
}
