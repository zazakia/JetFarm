import { Platform } from 'react-native';

const ANDROID_EMULATOR_HOST = '10.0.2.2';

const LOCALHOST_HOSTS = new Set(['127.0.0.1', 'localhost']);

/**
 * Android emulators cannot reach the development machine through 127.0.0.1
 * because that address points back to the emulator itself. Keep host/web URLs
 * unchanged, but route local Supabase URLs through the emulator host gateway.
 */
export const getRuntimeSupabaseUrl = (
    url: string,
    platform: typeof Platform.OS = Platform.OS
) => {
    if (platform !== 'android' || !url) {
        return url;
    }

    try {
        const parsed = new URL(url);
        if (!LOCALHOST_HOSTS.has(parsed.hostname)) {
            return url;
        }

        parsed.hostname = ANDROID_EMULATOR_HOST;
        return parsed.toString().replace(/\/$/, '');
    } catch {
        return url;
    }
};
