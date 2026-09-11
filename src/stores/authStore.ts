import { create } from 'zustand';
import { User } from '@supabase/supabase-js';

interface AuthStore {
    user: User | null;
    role: string | null;
    loading: boolean;
    setUser: (u: User | null) => void;
    setRole: (r: string | null) => void;
    setLoading: (l: boolean) => void;
    reset: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
    user: null,
    role: null,
    loading: true,
    setUser: (user) => set({ user }),
    setRole: (role) => set({ role }),
    setLoading: (loading) => set({ loading }),
    reset: () => set({ user: null, role: null, loading: false }),
}));
