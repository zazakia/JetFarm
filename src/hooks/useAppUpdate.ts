import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import {
    AppUpdateService,
    type AppVersionManifest,
    type UpdateCheckResult,
} from '../services/AppUpdateService';

/** Background re-check interval while app is open (6 hours) */
export const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function useAppUpdate(autoCheckOnMount = true) {
    const [isChecking, setIsChecking] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [isForced, setIsForced] = useState(false);
    const [manifest, setManifest] = useState<AppVersionManifest | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloadedBytes, setDownloadedBytes] = useState(0);
    const [totalExpectedBytes, setTotalExpectedBytes] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [downloadedUri, setDownloadedUri] = useState<string | null>(null);

    const hasCheckedRef = useRef(false);
    const checkInFlightRef = useRef(false);
    const prefetchInFlightRef = useRef(false);

    /**
     * Background prefetch: pre-downloads APK to local cache so user gets instant 1-click update.
     */
    const prefetchUpdate = useCallback(async (targetManifest: AppVersionManifest) => {
        if (prefetchInFlightRef.current || Platform.OS !== 'android') return;
        prefetchInFlightRef.current = true;
        setIsDownloading(true);
        try {
            const res = await AppUpdateService.downloadApk(targetManifest, (pct, written, total) => {
                setDownloadProgress(pct);
                setDownloadedBytes(written);
                setTotalExpectedBytes(total);
            });
            if (res.success && res.localUri) {
                setDownloadedUri(res.localUri);
                setModalVisible(true); // Pop up ready-to-install modal
            } else {
                console.warn('[AppUpdate] Background APK prefetch warning:', res.error || 'unknown');
            }
        } finally {
            setIsDownloading(false);
            prefetchInFlightRef.current = false;
        }
    }, []);

    const check = useCallback(async (options?: { forceCheck?: boolean; showModalIfAvailable?: boolean }) => {
        if (checkInFlightRef.current) return undefined;
        checkInFlightRef.current = true;
        setIsChecking(true);
        setErrorMessage(null);

        try {
            const result: UpdateCheckResult = await AppUpdateService.checkForUpdates({
                forceCheck: options?.forceCheck ?? false,
            });

            if (result.updateAvailable && result.manifest) {
                setUpdateAvailable(true);
                setIsForced(result.isForced);
                setManifest(result.manifest);
                const nextManifest = result.manifest;

                const canPrefetch =
                    !result.isForced &&
                    Platform.OS === 'android' &&
                    nextManifest.autoDownload !== false;

                if (canPrefetch) {
                    void prefetchUpdate(nextManifest);
                } else if (options?.showModalIfAvailable !== false) {
                    setModalVisible(true);
                }
            } else {
                setUpdateAvailable(false);
                setIsForced(false);
                setManifest(result.manifest);
                if (result.error && options?.forceCheck) {
                    setErrorMessage(result.error);
                }
            }

            return result;
        } finally {
            setIsChecking(false);
            checkInFlightRef.current = false;
        }
    }, [prefetchUpdate]);

    const startDownloadAndInstall = useCallback(async () => {
        if (!manifest) return;
        setIsDownloading(true);
        setDownloadProgress(0);
        setErrorMessage(null);

        let res: { success: boolean; localUri?: string; error?: string };
        if (downloadedUri) {
            // Instant 1-click install: APK already downloaded!
            res = await AppUpdateService.installApk(downloadedUri);
        } else {
            res = await AppUpdateService.downloadAndInstall(manifest, (pct, written, total) => {
                setDownloadProgress(pct);
                setDownloadedBytes(written);
                setTotalExpectedBytes(total);
            });
            if (res.success && res.localUri) {
                setDownloadedUri(res.localUri);
            }
        }

        setIsDownloading(false);

        if (!res.success) {
            setErrorMessage(res.error || 'Installation could not be started.');
        }
    }, [manifest, downloadedUri]);

    const dismissModal = useCallback(async (snooze = true) => {
        if (isForced) return;
        setModalVisible(false);
        if (snooze && manifest?.latestVersion) {
            await AppUpdateService.snoozeVersion(manifest.latestVersion);
        }
    }, [isForced, manifest]);

    // Initial check on mount
    useEffect(() => {
        if (Platform.OS === 'web') return;
        if (autoCheckOnMount && !hasCheckedRef.current) {
            hasCheckedRef.current = true;
            const timer = setTimeout(() => {
                check({ forceCheck: false, showModalIfAvailable: true });
            }, 2500);

            return () => clearTimeout(timer);
        }
    }, [autoCheckOnMount, check]);

    // Check on app foreground
    useEffect(() => {
        if (Platform.OS === 'web') return;
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                check({ forceCheck: false, showModalIfAvailable: true });
            }
        };

        const sub = AppState.addEventListener('change', handleAppStateChange);
        return () => sub.remove();
    }, [check]);

    // Periodic check
    useEffect(() => {
        if (Platform.OS === 'web') return;
        if (!autoCheckOnMount) return undefined;
        const intervalId = setInterval(() => {
            check({ forceCheck: false, showModalIfAvailable: true });
        }, AUTO_CHECK_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [autoCheckOnMount, check]);

    return {
        isChecking,
        updateAvailable,
        isForced,
        manifest,
        modalVisible,
        setModalVisible,
        isDownloading,
        downloadProgress,
        downloadedBytes,
        totalExpectedBytes,
        errorMessage,
        downloadReady: downloadedUri !== null,
        check,
        startDownloadAndInstall,
        dismissModal,
        currentVersion: AppUpdateService.getCurrentVersion(),
    };
}
