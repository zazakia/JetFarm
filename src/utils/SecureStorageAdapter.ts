import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

/**
 * A cross-platform storage adapter for Supabase that uses
 * expo-secure-store on Native platforms, and localStorage on the Web.
 * 
 * This ensures that sensitive authentication tokens (like JWTs and Refresh Tokens)
 * are encrypted at rest on mobile devices.
 */
export const SecureStorageAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        try {
            if (isWeb) {
                if (typeof localStorage !== 'undefined') {
                    return localStorage.getItem(key);
                }
                return null;
            }
            // Mobile (iOS/Android) uses SecureStore
            return await SecureStore.getItemAsync(key);
        } catch (error) {
            console.error('[SecureStorageAdapter] Error reading key:', key, error);
            return null;
        }
    },
    setItem: async (key: string, value: string): Promise<void> => {
        try {
            if (isWeb) {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(key, value);
                }
                return;
            }
            // Mobile (iOS/Android) uses SecureStore
            await SecureStore.setItemAsync(key, value);
        } catch (error) {
            console.error('[SecureStorageAdapter] Error setting key:', key, error);
        }
    },
    removeItem: async (key: string): Promise<void> => {
        try {
            if (isWeb) {
                if (typeof localStorage !== 'undefined') {
                    localStorage.removeItem(key);
                }
                return;
            }
            // Mobile (iOS/Android) uses SecureStore
            await SecureStore.deleteItemAsync(key);
        } catch (error) {
            console.error('[SecureStorageAdapter] Error removing key:', key, error);
        }
    },
};
