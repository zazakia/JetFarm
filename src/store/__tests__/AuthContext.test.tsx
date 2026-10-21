import React from 'react';
import { render, renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import { AuthService } from '../../services/AuthService';
import { clearPersistedAuthSession, supabase } from '../../database/supabase';
import { SyncService } from '../../services/SyncService';
import { usePathname, useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LAST_AUTHORIZED_ROUTE_KEY } from '../../utils/authNavigation';

const mockRouter = { replace: jest.fn(), push: jest.fn() };
const mockUnsubscribe = { data: { subscription: { unsubscribe: jest.fn() } } };

jest.mock('../../services/AuthService', () => ({
    AuthService: {
        getCurrentUserRole: jest.fn(),
        signOut: jest.fn(),
    },
}));
jest.mock('../../services/SyncService', () => ({
    SyncService: {
        checkAndSync: jest.fn(),
    },
}));
jest.mock('../../database/supabase', () => ({
    supabase: {
        auth: {
            getSession: jest.fn(),
            refreshSession: jest.fn(),
            onAuthStateChange: jest.fn(),
        },
    },
    clearPersistedAuthSession: jest.fn(),
    withTimeout: jest.fn((promise) => promise),
}));
jest.mock('expo-router', () => ({
    useRouter: () => mockRouter,
    useSegments: jest.fn(),
    usePathname: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

describe('AuthContext', () => {
    const flushDeferredAuthStateChange = async () => {
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
            await Promise.resolve();
            await Promise.resolve();
        });
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (useSegments as jest.Mock).mockReturnValue([]);
        (usePathname as jest.Mock).mockReturnValue('/');
        (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue(mockUnsubscribe);
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
        (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
        (AuthService.getCurrentUserRole as jest.Mock).mockResolvedValue('admin');
        (AuthService.signOut as jest.Mock).mockResolvedValue(undefined);
        (SyncService.checkAndSync as jest.Mock).mockResolvedValue(undefined);
        (clearPersistedAuthSession as jest.Mock).mockResolvedValue(undefined);
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue('false');
        (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
    });

    it('handles sunlight mode loading error', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Load Fail'));
        render(<AuthProvider children={null} />);
        await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
        consoleSpy.mockRestore();
    });

    it('handles role fetch error during initial checkSession', async () => {
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
        (AuthService.getCurrentUserRole as jest.Mock).mockRejectedValue(new Error('Init Role Fail'));
        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
        await waitFor(() => expect(result.current.initialized).toBe(true));
        expect(result.current.role).toBeNull();
        expect(result.current.roleResolved).toBe(true);
    });

    it('resolves a kept role during session check', async () => {
        const mockUser = { id: 'u1' };
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: mockUser } } });
        (AuthService.getCurrentUserRole as jest.Mock).mockResolvedValue('expenses_encoder');

        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
        await waitFor(() => expect(result.current.role).toBe('expenses_encoder'));
        expect(result.current.roleResolved).toBe(true);
    });

    it('handles refresh token errors in checkSession', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        (supabase.auth.getSession as jest.Mock).mockRejectedValue({ 
            message: 'Invalid Refresh Token',
            code: 'refresh_token_not_found'
        });

        render(<AuthProvider children={null} />);
        await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/login'));
        consoleSpy.mockRestore();
    });

    it('clears a stale initialization error after a successful sign-in event', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        let callback: any;
        const mockUser = { id: 'u-after-error', email: 'u-after-error@test.com' };

        (supabase.auth.getSession as jest.Mock).mockResolvedValue({
            data: { session: null },
            error: {
                message: 'Invalid Refresh Token',
                code: 'refresh_token_not_found',
            },
        });
        (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((cb) => {
            callback = cb;
            return mockUnsubscribe;
        });

        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

        await waitFor(() => expect(result.current.initializationError).not.toBeNull());

        await act(async () => {
            await callback('SIGNED_IN', { user: mockUser });
        });
        await flushDeferredAuthStateChange();

        expect(result.current.user?.id).toBe(mockUser.id);
        expect(result.current.initializationError).toBeNull();
        consoleSpy.mockRestore();
    });

    it('refreshes the session once when initial session restore times out', async () => {
        const mockUser = { id: 'u-refresh', email: 'refresh@test.com' };
        const { withTimeout } = require('../../database/supabase');
        (withTimeout as jest.Mock).mockRejectedValueOnce(new Error('Session restore timed out'));
        (supabase.auth.refreshSession as jest.Mock).mockResolvedValue({
            data: { session: { user: mockUser } },
            error: null,
        });
        (AuthService.getCurrentUserRole as jest.Mock).mockResolvedValue('admin');

        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

        await waitFor(() => expect(result.current.user?.id).toBe(mockUser.id));
        expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
        expect(result.current.role).toBe('admin');
    });

    it('handles auth state change events including role resolution', async () => {
        let callback: any;
        (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((cb) => {
            callback = cb;
            return mockUnsubscribe;
        });

        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
        await waitFor(() => expect(result.current.initialized).toBe(true));
        
        // Test SIGNED_IN as a kept operational role
        const mockUser = { id: 'u2', email: 'u2@test.com' };
        (AuthService.getCurrentUserRole as jest.Mock).mockResolvedValue('main_office');
        
        await act(async () => {
            await callback('SIGNED_IN', { user: mockUser });
        });
        await flushDeferredAuthStateChange();
        expect(result.current.role).toBe('main_office');
        expect(result.current.roleResolved).toBe(true);

        // Test sign out (null user)
        await act(async () => {
            await callback('SIGNED_OUT', null);
        });
        expect(result.current.user).toBeNull();
        expect(result.current.roleResolved).toBe(true);

        // Token refresh updates the session only and must not trigger role re-resolution.
        const roleCallCount = (AuthService.getCurrentUserRole as jest.Mock).mock.calls.length;
        await act(async () => {
            await callback('TOKEN_REFRESHED', { user: mockUser });
        });
        await flushDeferredAuthStateChange();
        expect(AuthService.getCurrentUserRole).toHaveBeenCalledTimes(roleCallCount);
        expect(result.current.role).toBeNull();
        expect(result.current.roleResolved).toBe(true);
    });

    it('handles sign out perfectly', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
        await waitFor(() => expect(result.current.initialized).toBe(true));
        
        await act(async () => {
            await result.current.signOut();
        });
        expect(result.current.user).toBeNull();
        expect(mockRouter.replace).toHaveBeenCalledWith('/login');
    });

    it('clears local state and redirects even when remote sign out fails', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        (AuthService.signOut as jest.Mock).mockRejectedValueOnce(new Error('Network down'));
        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
        await waitFor(() => expect(result.current.initialized).toBe(true));

        await act(async () => {
            await result.current.signOut();
        });

        expect(result.current.user).toBeNull();
        expect(result.current.role).toBeNull();
        expect(result.current.roleResolved).toBe(true);
        expect(mockRouter.replace).toHaveBeenCalledWith('/login');
        consoleSpy.mockRestore();
    });

    it('toggles sunlight mode with error handling', async () => {
        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
        await waitFor(() => expect(result.current.initialized).toBe(true));
        
        await act(async () => {
            await result.current.toggleSunlightMode();
        });
        expect(result.current.sunlightMode).toBe(true);

        (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Save Fail'));
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        await act(async () => {
            await result.current.toggleSunlightMode();
        });
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('RBAC Guard: redirects from wrong group', async () => {
        const mockUser = { id: 'u1' };
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: mockUser } } });
        (AuthService.getCurrentUserRole as jest.Mock).mockResolvedValue('expenses_encoder');
        (useSegments as jest.Mock).mockReturnValue(['(admin)', 'dashboard']);

        render(<AuthProvider children={null} />);
        await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(expenses-encoder)'));
    });

    it('Redirects from login to loading screen if logged in', async () => {
        const mockUser = { id: 'u1' };
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: mockUser } } });
        (AuthService.getCurrentUserRole as jest.Mock).mockResolvedValue('admin');
        (useSegments as jest.Mock).mockReturnValue(['login']);

        render(<AuthProvider children={null} />);
        await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/loading'));
    });

    it('keeps the restored mock-auth identity when Supabase reports no remote session in local E2E mode', async () => {
        // Full reload: checkSession restores the persisted E2E identity, but the Supabase
        // client is pointed at an unreachable loopback backend and its onAuthStateChange
        // INITIAL_SESSION callback fires with null. That must not log the operator out.
        const originalWindow = (globalThis as any).window;
        const e2eUser = { id: 'admin', email: 'admin@jetfarm.com', role: 'admin', full_name: 'Admin User' };
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: {
                ...originalWindow,
                location: { hostname: '127.0.0.1', port: '19129' },
                localStorage: { getItem: jest.fn().mockReturnValue(JSON.stringify(e2eUser)), setItem: jest.fn(), removeItem: jest.fn() },
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
            },
        });
        const previousE2eMode = process.env.EXPO_PUBLIC_E2E_MODE;
        process.env.EXPO_PUBLIC_E2E_MODE = '1';
        try {
            let callback: any;
            (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((cb) => {
                callback = cb;
                return mockUnsubscribe;
            });

            const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
            await waitFor(() => expect(result.current.user?.id).toBe('admin'));
            await waitFor(() => expect(result.current.roleResolved).toBe(true));

            await act(async () => {
                callback('INITIAL_SESSION', null);
                await Promise.resolve();
            });

            expect(result.current.user?.id).toBe('admin');
            expect(result.current.role).toBe('admin');
            expect(mockRouter.replace).not.toHaveBeenCalledWith('/login');
        } finally {
            if (previousE2eMode === undefined) delete process.env.EXPO_PUBLIC_E2E_MODE;
            else process.env.EXPO_PUBLIC_E2E_MODE = previousE2eMode;
            Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
        }
    });

    it('still clears guest state on auth changes outside local E2E mode', async () => {
        let callback: any;
        (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((cb) => {
            callback = cb;
            return mockUnsubscribe;
        });
        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
        await waitFor(() => expect(result.current.initialized).toBe(true));

        await act(async () => {
            callback('SIGNED_OUT', null);
            await Promise.resolve();
        });
        expect(result.current.user).toBeNull();
    });

    it('ignores quick-login storage and events on the production Cloudflare host', async () => {
        const originalWindow = (globalThis as any).window;
        const listeners = new Map<string, EventListener>();
        const mockWindow = {
            location: { hostname: 'jetfarm.pages.dev', port: '' },
            localStorage: {
                getItem: jest.fn().mockReturnValue(JSON.stringify({
                    id: 'admin',
                    email: 'admin@jetfarm.com',
                    role: 'admin',
                    full_name: 'Admin User',
                })),
            },
            addEventListener: jest.fn((eventName: string, listener: EventListener) => {
                listeners.set(eventName, listener);
            }),
            removeEventListener: jest.fn(),
        };

        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: mockWindow,
        });
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: null }, error: null });
        (useSegments as jest.Mock).mockReturnValue(['login']);
        (usePathname as jest.Mock).mockReturnValue('/login');

        try {
            const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
            await waitFor(() => expect(result.current.initialized).toBe(true));

            expect(mockWindow.addEventListener).not.toHaveBeenCalledWith(
                'jetfarm:e2e-auth-changed',
                expect.any(Function)
            );
            expect(listeners.has('jetfarm:e2e-auth-changed')).toBe(false);
            expect(result.current.user).toBeNull();
            expect(mockRouter.replace).not.toHaveBeenCalledWith('/loading');
        } finally {
            Object.defineProperty(globalThis, 'window', {
                configurable: true,
                value: originalWindow,
            });
        }
    });

    it('bounces a guest off a deleted public marketing route to login', async () => {
        // The variant ships no guest-facing screens: loan-calculator and loan-application were
        // deleted with the lending domain, so PUBLIC_ROUTES is gone and every unauthenticated
        // visit lands on /login.
        (useSegments as jest.Mock).mockReturnValue(['loan-calculator']);
        (usePathname as jest.Mock).mockReturnValue('/loan-calculator');

        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

        await waitFor(() => expect(result.current.initialized).toBe(true));
        expect(mockRouter.replace).toHaveBeenCalledWith('/login');
    });

    it('skips one automatic sync after a local database reset flag is present', async () => {
        const mockUser = { id: 'u1', email: 'u1@test.com' };
        let callback: any;

        (AsyncStorage.getItem as jest.Mock)
            .mockResolvedValueOnce('false')
            .mockResolvedValueOnce('true');
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { user: mockUser } }, error: null });
        (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((cb) => {
            callback = cb;
            return mockUnsubscribe;
        });

        render(<AuthProvider children={null} />);

        await waitFor(() => {
            expect(AuthService.getCurrentUserRole).toHaveBeenCalledWith(mockUser.id, mockUser.email);
        });

        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('skip_next_auto_sync_once');
        expect(SyncService.checkAndSync).not.toHaveBeenCalled();

        await act(async () => {
            await callback('TOKEN_REFRESHED', { user: mockUser });
        });
        await flushDeferredAuthStateChange();

        expect(SyncService.checkAndSync).not.toHaveBeenCalled();
    });

    it('resolves a real sign-in event that arrives during initial bootstrap', async () => {
        const mockUser = { id: 'u1', email: 'u1@test.com' };
        let callback: any;
        let resolveSession: (value: any) => void = () => {};
        const sessionPromise = new Promise((resolve) => {
            resolveSession = resolve;
        });

        (AsyncStorage.getItem as jest.Mock)
            .mockResolvedValueOnce('false')
            .mockResolvedValueOnce('true');
        (supabase.auth.getSession as jest.Mock).mockReturnValue(sessionPromise);
        (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((cb) => {
            callback = cb;
            return mockUnsubscribe;
        });

        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

        await act(async () => {
            await callback('SIGNED_IN', { user: mockUser });
        });
        await flushDeferredAuthStateChange();

        expect(SyncService.checkAndSync).not.toHaveBeenCalled();

        expect(AuthService.getCurrentUserRole).toHaveBeenCalledWith(mockUser.id, mockUser.email);
        expect(result.current.role).toBe('admin');

        await act(async () => {
            resolveSession({ data: { session: { user: mockUser } }, error: null });
            await sessionPromise;
        });

        await waitFor(() => expect(result.current.initialized).toBe(true));
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('skip_next_auto_sync_once');
        expect(SyncService.checkAndSync).not.toHaveBeenCalled();
    });

    it('keeps access resolved during a same-user token refresh', async () => {
        const mockUser = { id: 'u1', email: 'u1@test.com' };
        let callback: any;
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({
            data: { session: { user: mockUser } },
            error: null,
        });
        (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((cb) => {
            callback = cb;
            return mockUnsubscribe;
        });

        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
        await waitFor(() => expect(result.current.roleResolved).toBe(true));
        expect(result.current.role).toBe('admin');

        const roleCallCount = (AuthService.getCurrentUserRole as jest.Mock).mock.calls.length;

        await act(async () => {
            await callback('TOKEN_REFRESHED', { user: mockUser });
            await Promise.resolve();
        });

        expect(AuthService.getCurrentUserRole).toHaveBeenCalledTimes(roleCallCount);
        expect(result.current.roleResolved).toBe(true);
        expect(result.current.user?.id).toBe(mockUser.id);
    });

    it('keeps access resolved during a same-user signed-in refocus event', async () => {
        const mockUser = { id: 'u1', email: 'u1@test.com' };
        let callback: any;
        let resolveRefreshedRole: (role: string) => void = () => {};

        (supabase.auth.getSession as jest.Mock).mockResolvedValue({
            data: { session: { user: mockUser } },
            error: null,
        });
        (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((cb) => {
            callback = cb;
            return mockUnsubscribe;
        });

        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
        await waitFor(() => expect(result.current.roleResolved).toBe(true));
        expect(result.current.role).toBe('admin');

        (AuthService.getCurrentUserRole as jest.Mock).mockImplementationOnce(
            () => new Promise((resolve) => {
                resolveRefreshedRole = resolve;
            })
        );

        await act(async () => {
            await callback('SIGNED_IN', { user: mockUser });
            await Promise.resolve();
        });

        expect(result.current.roleResolved).toBe(true);
        expect(result.current.user?.id).toBe(mockUser.id);

        await act(async () => {
            resolveRefreshedRole('admin');
            await Promise.resolve();
        });

        expect(result.current.roleResolved).toBe(true);
    });

    it('persists the last authorized protected route for later restoration', async () => {
        const mockUser = { id: 'u1', email: 'u1@test.com' };
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({
            data: { session: { user: mockUser } },
            error: null,
        });
        (useSegments as jest.Mock).mockReturnValue(['(admin)', 'agribusiness', 'parcels']);
        (usePathname as jest.Mock).mockReturnValue('/agribusiness/parcels');

        render(<AuthProvider children={null} />);

        await waitFor(() => {
            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                LAST_AUTHORIZED_ROUTE_KEY,
                '/(admin)/agribusiness/parcels'
            );
        });
    });
});
