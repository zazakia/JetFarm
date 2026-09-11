import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import {
    AppUpdateService,
    compareSemVer,
    isNewerVersion,
    isBelowMinimumVersion,
    MAX_UPDATE_SNOOZES,
    SNOOZE_FORCE_WINDOW_MS,
    type AppVersionManifest,
} from '../AppUpdateService';

// Mock expo-file-system
jest.mock('expo-file-system/legacy', () => ({
    cacheDirectory: 'file:///data/user/0/com.jetfarm.app/cache/',
    getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
    deleteAsync: jest.fn().mockResolvedValue(undefined),
    getContentUriAsync: jest.fn().mockImplementation(async (uri: string) => 'content://mock/' + uri),
    createDownloadResumable: jest.fn().mockImplementation((url: string, dest: string, options: any, callback: any) => ({
        downloadAsync: jest.fn().mockImplementation(async () => {
            if (callback) {
                callback({ totalBytesWritten: 5000000, totalBytesExpectedToWrite: 10000000 });
            }
            return { uri: dest, status: 200 };
        }),
    })),
}));

// Mock expo-intent-launcher
jest.mock('expo-intent-launcher', () => ({
    startActivityAsync: jest.fn().mockResolvedValue({}),
}));

describe('AppUpdateService Suite', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await AsyncStorage.clear();
        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
        (FileSystem.deleteAsync as jest.Mock).mockResolvedValue(undefined);
        (FileSystem.getContentUriAsync as jest.Mock).mockImplementation(async (uri: string) => 'content://mock/' + uri);
    });

    describe('1. SemVer Version Comparison Utilities', () => {
        it('compares standard semver correctly', () => {
            expect(compareSemVer('0.1.4', '0.1.3')).toBe(1);
            expect(compareSemVer('0.1.3', '0.1.4')).toBe(-1);
            expect(compareSemVer('0.1.3', '0.1.3')).toBe(0);
            expect(compareSemVer('1.0.0', '0.9.9')).toBe(1);
            expect(compareSemVer('0.1.2', '0.1.3')).toBe(-1);
        });

        it('handles version strings with prefix v and build tags', () => {
            expect(compareSemVer('v0.2.0', '0.1.3')).toBe(1);
            expect(compareSemVer('v0.1.3-beta.1', 'v0.1.3')).toBe(0);
            expect(compareSemVer('  0.2.0 ', '0.1.9')).toBe(1);
        });

        it('evaluates isNewerVersion accurately', () => {
            expect(isNewerVersion('0.1.4', '0.1.3')).toBe(true);
            expect(isNewerVersion('0.1.3', '0.1.3')).toBe(false);
            expect(isNewerVersion('0.1.2', '0.1.3')).toBe(false);
        });

        it('evaluates isBelowMinimumVersion accurately', () => {
            expect(isBelowMinimumVersion('0.1.1', '0.1.3')).toBe(true);
            expect(isBelowMinimumVersion('0.1.3', '0.1.3')).toBe(false);
            expect(isBelowMinimumVersion('0.1.5', '0.1.3')).toBe(false);
            expect(isBelowMinimumVersion('0.1.0', '')).toBe(false);
        });
    });

    describe('2. Version & Manifest Fetching', () => {
        it('returns current version and build number', () => {
            const version = AppUpdateService.getCurrentVersion();
            const build = AppUpdateService.getCurrentBuildNumber();
            expect(typeof version).toBe('string');
            expect(typeof build).toBe('number');
        });

        it('fetches remote manifest successfully', async () => {
            const mockManifest: AppVersionManifest = {
                latestVersion: '0.2.0',
                versionCode: 2,
                releaseTag: 'v0.2.0',
                releaseDate: '2026-09-11',
                minSupportedVersion: '0.1.0',
                apkUrl: 'https://jetfarm.pages.dev/download/v0.2.0.apk',
                apkSizeMb: 45.5,
                releaseNotes: '• Major update',
                forceUpdate: false,
            };

            global.fetch = jest.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => mockManifest,
            } as any);

            const manifest = await AppUpdateService.fetchRemoteManifest();
            expect(manifest).toEqual(mockManifest);
        });

        it('detects available updates in checkForUpdates', async () => {
            const mockManifest: AppVersionManifest = {
                latestVersion: '0.9.0',
                versionCode: 9,
                releaseTag: 'v0.9.0',
                releaseDate: '2026-09-11',
                minSupportedVersion: '0.1.0',
                apkUrl: 'https://jetfarm.pages.dev/download/v0.9.0.apk',
                releaseNotes: '• New update',
            };

            jest.spyOn(AppUpdateService, 'getCurrentVersion').mockReturnValue('0.1.3');
            jest.spyOn(AppUpdateService, 'fetchRemoteManifest').mockResolvedValueOnce(mockManifest);

            const result = await AppUpdateService.checkForUpdates();
            expect(result.updateAvailable).toBe(true);
            expect(result.isForced).toBe(false);
            expect(result.manifest).toEqual(mockManifest);
        });
    });

    describe('3. Snooze Policy', () => {
        it('snoozes version up to max limit then marks exhausted', async () => {
            expect(await AppUpdateService.readSnoozeState('0.2.0')).toBe('none');

            await AppUpdateService.snoozeVersion('0.2.0');
            expect(await AppUpdateService.readSnoozeState('0.2.0')).toBe('blocked');

            await AppUpdateService.snoozeVersion('0.2.0');
            await AppUpdateService.snoozeVersion('0.2.0');
            expect(await AppUpdateService.readSnoozeState('0.2.0')).toBe('exhausted');

            await AppUpdateService.clearSnoozedVersion();
            expect(await AppUpdateService.readSnoozeState('0.2.0')).toBe('none');
        });
    });

    describe('4. Download & Install Handling', () => {
        it('downloads APK via FileSystem', async () => {
            const mockManifest: AppVersionManifest = {
                latestVersion: '0.2.0',
                versionCode: 2,
                releaseTag: 'v0.2.0',
                releaseDate: '2026-09-11',
                minSupportedVersion: '0.1.0',
                apkUrl: 'https://jetfarm.pages.dev/download/v0.2.0.apk',
                releaseNotes: '• Test',
            };

            const progressCb = jest.fn();
            const result = await AppUpdateService.downloadApk(mockManifest, progressCb);
            expect(result.success).toBe(true);
        });
    });
});
