/**
 * SUPABASE CONFIGURATION (ENHANCED FOR WEB & MOBILE)
 * 
 * Key features:
 * 1. URL/URLSearchParams polyfill for web/native compatibility
 * 2. Project-aware storage key generation to prevent cross-project conflicts
 */

// Only apply URL polyfill if native URL is not available (Expo SDK 55+ has it built-in)
import { createClient } from '@supabase/supabase-js';
import { SecureStorageAdapter } from '../utils/SecureStorageAdapter';
import { Platform } from 'react-native';
import { getRuntimeSupabaseUrl } from './supabaseUrl';
import { isProductionSupabaseUrl } from './supabaseSafety';

try {
    if (typeof globalThis.URL !== 'function' || typeof globalThis.URLSearchParams !== 'function') {
        const { URL: PolyfilledURL, URLSearchParams: PolyfilledURLSearchParams } = require('react-native-url-polyfill');
        if (typeof globalThis.URL !== 'function') {
            (globalThis as any).URL = PolyfilledURL;
        }
        if (typeof globalThis.URLSearchParams !== 'function') {
            (globalThis as any).URLSearchParams = PolyfilledURLSearchParams;
        }
    }
} catch (e) {
    // Polyfill not available or not needed — safe to continue
}

// Read from environment variables with safe offline-first emulator fallbacks
const configuredSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:45421';
const supabaseUrl = getRuntimeSupabaseUrl(configuredSupabaseUrl);
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const isTestEnvironment = process.env.NODE_ENV === 'test';

// Safety Guard: Block production database access in development/test environments
if (configuredSupabaseUrl && isProductionSupabaseUrl(configuredSupabaseUrl)) {
    const isLocalDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
    if (isTestEnvironment || isLocalDev) {
        throw new Error(
            `\n❌ SAFETY BREACH: Attempting to connect to the PRODUCTION Supabase instance (${configuredSupabaseUrl}) in a local ${process.env.NODE_ENV || 'development'} environment is blocked!\n` +
            `Please use the local emulator (http://127.0.0.1:45421) or a dedicated staging database.\n`
        );
    }
}

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Missing credentials in environment variables');
}

/**
 * Get the unique storage key for this specific Supabase project
 */
export const getSupabaseAuthStorageKey = (url = supabaseUrl) => {
    const projectRef = url
        .replace(/^https?:\/\//, '')
        .split('.')[0]
        .split(':')[0];

    return `sb-${projectRef}-auth-token`;
};

/**
 * Clear all Supabase-related storage for the current project
 */
const clearSupabaseAuthStorage = async () => {
    const storageKey = getSupabaseAuthStorageKey();
    console.log('[Supabase] Purging auth storage:', storageKey);

    try {
        await SecureStorageAdapter.removeItem(storageKey);
    } catch (e) {
        console.warn('[Supabase] SecureStorage purge failed:', e);
    }

    if (typeof localStorage !== 'undefined') {
        try {
            localStorage.removeItem(storageKey);
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch (error) {
            console.warn('[Supabase] LocalStorage purge failed:', error);
        }
    }
};

/**
 * Cleanup stale tokens from other projects in localStorage (Web only)
 */
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
        const storageKey = getSupabaseAuthStorageKey();
        const keysToDelete: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token') && key !== storageKey) {
                keysToDelete.push(key);
            }
        }
        if (keysToDelete.length > 0) {
            keysToDelete.forEach(k => localStorage.removeItem(k));
            console.log('[Supabase] Cleared stale auth tokens for old projects:', keysToDelete);
        }
    } catch (e) {
        console.warn('[Supabase] Could not clean up stale session tokens:', e);
    }
}

/**
 * Full session purge utility
 */
export const clearPersistedAuthSession = async () => {
    console.log('[Supabase] Full session purge initiated');
    try {
        await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
        console.warn('[Supabase] Local signOut failed during session purge:', error);
    } finally {
        await clearSupabaseAuthStorage();
        await new Promise(resolve => setTimeout(resolve, 100));
    }
};

console.log('[Supabase] Initializing client on platform:', Platform.OS);
if (configuredSupabaseUrl && configuredSupabaseUrl !== supabaseUrl) {
    console.log('[Supabase] Rewrote local Supabase URL for runtime:', supabaseUrl);
}

/**
 * Supabase client configuration
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: SecureStorageAdapter,
        autoRefreshToken: !isTestEnvironment,
        persistSession: !isTestEnvironment,
        detectSessionInUrl: false,
        // Disable Web Locks API in favor of simple in-memory queue
        lock: (() => {
            let currentLock: Promise<any> = Promise.resolve();
            return async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
                const acquired = currentLock.then(() => fn(), () => fn());
                currentLock = acquired.catch(() => {});
                return await acquired;
            };
        })(),
    },
});

console.log('[Supabase] Client created successfully');

/**
 * Custom fetch wrapper to add timeout protection
 */
export const withTimeout = async <T,>(
    promise: Promise<T>,
    timeoutMs: number = 10000,
    operationName: string = 'Operation'
): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(
            () => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
            timeoutMs
        );
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
};
