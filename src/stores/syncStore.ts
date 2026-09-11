import { create } from 'zustand';

export interface SyncLogEntry {
    id: string;
    timestamp: Date;
    type: 'info' | 'success' | 'error' | 'table';
    message: string;
    detail?: string;
    duration?: number;
    rowCount?: number;
}

export interface SyncProgress {
    status: 'idle' | 'syncing' | 'completed' | 'error';
    currentModel: string;
    progress: number;
    errorMessage: string | null;
    pendingChanges: number;
    lastSyncAt: Date | null;
    isOnline: boolean;
    logs: SyncLogEntry[];
    latestAuditSessionId: string | null;
    auditPersistenceWarning: string | null;
}

interface SyncStore extends SyncProgress {
    setSyncProgress: (p: Partial<SyncProgress>) => void;
    addLog: (entry: Omit<SyncLogEntry, 'id'>) => void;
    clearLogs: () => void;
    setOnline: (online: boolean) => void;
    reset: () => void;
}

const initialState: SyncProgress = {
    status: 'idle',
    currentModel: '',
    progress: 0,
    errorMessage: null,
    pendingChanges: 0,
    lastSyncAt: null,
    isOnline: true,
    logs: [],
    latestAuditSessionId: null,
    auditPersistenceWarning: null,
};

export const useSyncStore = create<SyncStore>((set) => ({
    ...initialState,
    setSyncProgress: (p) => set((state) => ({ ...state, ...p })),
    addLog: (entry) =>
        set((state) => ({
            logs: [
                { ...entry, id: `${Date.now()}-${Math.random()}` },
                ...state.logs.slice(0, 99), // keep at most 100 logs
            ],
        })),
    clearLogs: () => set({ logs: [] }),
    setOnline: (online) => set({ isOnline: online }),
    reset: () => set(initialState),
}));
