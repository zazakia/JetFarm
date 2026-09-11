import { create } from 'zustand';

interface AppState {
    isGlobalSyncing: boolean;
    selectedTheme: 'light' | 'dark';
    setGlobalSyncing: (syncing: boolean) => void;
    setTheme: (theme: 'light' | 'dark') => void;
}

export const useAppStore = create<AppState>((set) => ({
    isGlobalSyncing: false,
    selectedTheme: 'light',

    setGlobalSyncing: (syncing) => set({ isGlobalSyncing: syncing }),
    setTheme: (theme) => set({ selectedTheme: theme }),
}));
