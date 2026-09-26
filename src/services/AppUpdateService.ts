import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    APP_VERSION,
    APP_BUILD_NUMBER,
    PRIMARY_VERSION_URL,
    FALLBACK_VERSION_URL,
} from '../constants/AppVersion';
import { database } from '../database';
import { SyncService } from './SyncService';

export interface AppVersionManifest {
    latestVersion: string;
    versionCode: number;
    releaseTag: string;
    releaseDate: string;
    minSupportedVersion: string;
    apkUrl: string;
    apkLatestUrl?: string;
    apkSizeMb?: number;
    sha256?: string;
    releaseNotes: string;
    forceUpdate?: boolean;
    /** When true or omitted, the app auto-prefetches the APK in the background
     *  after detecting a newer version so the prompt is a single tap to install. */
    autoDownload?: boolean;
}

export interface UpdateCheckResult {
    updateAvailable: boolean;
    isForced: boolean;
    currentVersion: string;
    manifest: AppVersionManifest | null;
    error?: string;
}

export type DownloadProgressCallback = (progressPercent: number, bytesWritten: number, totalBytes: number) => void;

const SNOOZED_UPDATE_KEY = 'agri-one_snoozed_update_version';
const LAST_UPDATE_CHECK_KEY = 'agri-one_last_update_check_ts';

export const MAX_UPDATE_SNOOZES = 3;
export const SNOOZE_FORCE_WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours

/**
 * Robust SemVer comparator:
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 == v2
 */
export function compareSemVer(v1: string, v2: string): number {
    const clean1 = (v1 || '').trim().replace(/^v/, '').split('-')[0];
    const clean2 = (v2 || '').trim().replace(/^v/, '').split('-')[0];

    const parts1 = clean1.split('.').map((n) => parseInt(n, 10) || 0);
    const parts2 = clean2.split('.').map((n) => parseInt(n, 10) || 0);

    const maxLen = Math.max(parts1.length, parts2.length, 3);
    for (let i = 0; i < maxLen; i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;
        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }
    return 0;
}

export function isNewerVersion(targetVersion: string, currentVersion: string): boolean {
    return compareSemVer(targetVersion, currentVersion) > 0;
}

export function isBelowMinimumVersion(currentVersion: string, minVersion: string): boolean {
    if (!minVersion) return false;
    return compareSemVer(currentVersion, minVersion) < 0;
}

export class AppUpdateService {
    static getCurrentVersion(): string {
        return Constants.expoConfig?.version || APP_VERSION || '0.1.3';
    }

    static getCurrentBuildNumber(): number {
        return (Constants.expoConfig?.android?.versionCode as number) || APP_BUILD_NUMBER || 1;
    }

    /**
     * Fetches the remote version manifest with timeout and fallback.
     */
    static async fetchRemoteManifest(timeoutMs = 6000): Promise<AppVersionManifest | null> {
        const urls = [PRIMARY_VERSION_URL, FALLBACK_VERSION_URL];

        for (const url of urls) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

                // Cache-busting parameter
                const cacheBusterUrl = `${url}?_t=${Date.now()}`;
                const response = await fetch(cacheBusterUrl, {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json',
                    },
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = (await response.json()) as AppVersionManifest;
                    if (data && data.latestVersion) {
                        return data;
                    }
                }
            } catch (_err) {
                // Try next URL fallback
            }
        }

        return null;
    }

    /**
     * Checks whether a new update is available.
     */
    static async checkForUpdates(options?: { forceCheck?: boolean }): Promise<UpdateCheckResult> {
        const currentVersion = this.getCurrentVersion();

        try {
            const manifest = await this.fetchRemoteManifest();
            if (!manifest) {
                return {
                    updateAvailable: false,
                    isForced: false,
                    currentVersion,
                    manifest: null,
                    error: 'Unable to connect to update server.',
                };
            }

            await AsyncStorage.setItem(LAST_UPDATE_CHECK_KEY, Date.now().toString());

            const newer = isNewerVersion(manifest.latestVersion, currentVersion);
            const belowMin = isBelowMinimumVersion(currentVersion, manifest.minSupportedVersion);

            let snoozeState: 'none' | 'blocked' | 'exhausted' = 'none';
            if (newer && !options?.forceCheck && !belowMin && !manifest.forceUpdate) {
                snoozeState = await this.readSnoozeState(manifest.latestVersion);
                if (snoozeState === 'blocked') {
                    return {
                        updateAvailable: false,
                        isForced: false,
                        currentVersion,
                        manifest,
                    };
                }
            }

            const isForced =
                Boolean(manifest.forceUpdate) ||
                belowMin ||
                (newer && snoozeState === 'exhausted');

            return {
                updateAvailable: newer,
                isForced,
                currentVersion,
                manifest,
            };
        } catch (err: any) {
            return {
                updateAvailable: false,
                isForced: false,
                currentVersion,
                manifest: null,
                error: err?.message || 'Update check failed.',
            };
        }
    }

    static async readSnoozeState(version: string): Promise<'none' | 'blocked' | 'exhausted'> {
        try {
            const raw = await AsyncStorage.getItem(SNOOZED_UPDATE_KEY);
            if (!raw) return 'none';

            let count = 0;
            let firstSnoozedAt = 0;
            if (raw.startsWith('{')) {
                try {
                    const state = JSON.parse(raw);
                    if (state?.version !== version) return 'none';
                    count = Number(state.count) || 0;
                    firstSnoozedAt = Number(state.firstSnoozedAt) || 0;
                } catch {
                    return 'none';
                }
            } else {
                if (raw !== version) return 'none';
                count = 1;
                firstSnoozedAt = Date.now();
            }

            if (
                count >= MAX_UPDATE_SNOOZES ||
                (firstSnoozedAt > 0 && Date.now() - firstSnoozedAt > SNOOZE_FORCE_WINDOW_MS)
            ) {
                return 'exhausted';
            }
            return 'blocked';
        } catch {
            return 'none';
        }
    }

    static async snoozeVersion(version: string): Promise<void> {
        try {
            const raw = await AsyncStorage.getItem(SNOOZED_UPDATE_KEY);
            let count = 0;
            let firstSnoozedAt = 0;
            if (raw?.startsWith('{')) {
                try {
                    const state = JSON.parse(raw);
                    if (state?.version === version) {
                        count = Number(state.count) || 0;
                        firstSnoozedAt = Number(state.firstSnoozedAt) || 0;
                    }
                } catch {
                    /* ignore */
                }
            } else if (raw === version) {
                count = 1;
            }
            if (!firstSnoozedAt) firstSnoozedAt = Date.now();
            await AsyncStorage.setItem(
                SNOOZED_UPDATE_KEY,
                JSON.stringify({ version, count: Math.min(count + 1, MAX_UPDATE_SNOOZES), firstSnoozedAt })
            );
        } catch (_e) {}
    }

    static async clearSnoozedVersion(): Promise<void> {
        try {
            await AsyncStorage.removeItem(SNOOZED_UPDATE_KEY);
        } catch (_e) {}
    }

    /**
     * Pre-update safeguard:
     * Commits pending transactions and sync before Android terminates the app process.
     */
    static async prepareForUpdate(): Promise<void> {
        try {
            // Drain local database queues safely if adapter supports it
            if (database && typeof (database.adapter as any)?.flush === 'function') {
                await (database.adapter as any).flush();
            }

            // Flush pending sync queue
            try {
                if (typeof (SyncService as any).sync === 'function') {
                    await (SyncService as any).sync();
                }
            } catch (_e) {}

            try {
                await (AsyncStorage as any).flushGetRequests?.();
            } catch (_e) {}
        } catch (err) {
            console.warn('[AppUpdateService] Pre-update safeguard warning:', err);
        }
    }

    /**
     * Downloads APK to local cache.
     */
    static async downloadApk(
        manifest: AppVersionManifest,
        onProgress?: DownloadProgressCallback
    ): Promise<{ success: boolean; localUri?: string; error?: string }> {
        const apkUrl =
            manifest.apkUrl ||
            manifest.apkLatestUrl ||
            PRIMARY_VERSION_URL.replace('/version.json', '/download');

        if (Platform.OS !== 'android') {
            return { success: true };
        }

        try {
            const destinationFileUri = `${FileSystem.cacheDirectory}agri-one-update.apk`;

            const info = await FileSystem.getInfoAsync(destinationFileUri);
            if (info.exists) {
                await FileSystem.deleteAsync(destinationFileUri, { idempotent: true });
            }

            const downloadResumable = FileSystem.createDownloadResumable(
                apkUrl,
                destinationFileUri,
                {},
                (downloadProgress) => {
                    const total = downloadProgress.totalBytesExpectedToWrite;
                    const written = downloadProgress.totalBytesWritten;
                    const pct = total > 0 ? Math.round((written / total) * 100) : 0;
                    if (onProgress) {
                        onProgress(pct, written, total);
                    }
                }
            );

            const downloadResult = await downloadResumable.downloadAsync();
            if (!downloadResult?.uri) {
                throw new Error('Download failed: No output URI returned.');
            }

            return { success: true, localUri: downloadResult.uri };
        } catch (error: any) {
            return { success: false, error: error?.message || 'Failed to download update.' };
        }
    }

    /**
     * Installs downloaded APK via Android package installer intent.
     */
    static async installApk(localUri: string): Promise<{ success: boolean; error?: string }> {
        try {
            await this.triggerAndroidInstaller(localUri);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error?.message || 'Installer could not be started.' };
        }
    }

    /**
     * Download and install combo.
     */
    static async downloadAndInstall(
        manifest: AppVersionManifest,
        onProgress?: DownloadProgressCallback
    ): Promise<{ success: boolean; localUri?: string; error?: string }> {
        const apkUrl =
            manifest.apkUrl ||
            manifest.apkLatestUrl ||
            PRIMARY_VERSION_URL.replace('/version.json', '/download');

        if (Platform.OS === 'web') {
            if (typeof window !== 'undefined' && typeof window.open === 'function') {
                window.open(apkUrl, '_blank');
            } else {
                await Linking.openURL(apkUrl);
            }
            return { success: true };
        }

        if (Platform.OS !== 'android') {
            await Linking.openURL(apkUrl);
            return { success: true };
        }

        const downloaded = await this.downloadApk(manifest, onProgress);
        if (!downloaded.success || !downloaded.localUri) {
            return downloaded;
        }
        const installed = await this.installApk(downloaded.localUri);
        return {
            success: installed.success,
            localUri: downloaded.localUri,
            error: installed.error,
        };
    }

    /**
     * Native Android Package Installer trigger with content URI conversion.
     */
    static async triggerAndroidInstaller(fileUri: string): Promise<void> {
        try {
            await AppUpdateService.prepareForUpdate();

            const contentUri = await FileSystem.getContentUriAsync(fileUri);

            // Dynamically require expo-intent-launcher
            let IntentLauncher: any = null;
            try {
                IntentLauncher = require('expo-intent-launcher');
            } catch (_e) {}

            if (IntentLauncher && IntentLauncher.startActivityAsync) {
                await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                    data: contentUri,
                    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
                    type: 'application/vnd.android.package-archive',
                });
            } else {
                await Linking.openURL(contentUri);
            }
        } catch (_err) {
            const contentUri = await FileSystem.getContentUriAsync(fileUri);
            await Linking.openURL(contentUri);
        }
    }
}
