const mockHasServicesEnabledAsync = jest.fn();
const mockRequestForegroundPermissionsAsync = jest.fn();
const mockWatchPositionAsync = jest.fn();

jest.mock('expo-location', () => ({
    __esModule: true,
    hasServicesEnabledAsync: () => mockHasServicesEnabledAsync(),
    requestForegroundPermissionsAsync: () => mockRequestForegroundPermissionsAsync(),
    watchPositionAsync: (opts: any, cb: any) => mockWatchPositionAsync(opts, cb),
    LocationAccuracy: {
        BestForNavigation: 6,
    },
}));

import {
    NativeLocationProvider,
    WebLocationProvider,
    locationProvider,
} from '../LocationService';

describe('LocationService', () => {
    describe('WebLocationProvider', () => {
        let originalNavigator: any;

        beforeEach(() => {
            originalNavigator = global.navigator;
        });

        afterEach(() => {
            Object.defineProperty(global, 'navigator', {
                value: originalNavigator,
                writable: true,
                configurable: true,
            });
        });

        it('reports availability based on navigator.geolocation', () => {
            const provider = new WebLocationProvider();

            Object.defineProperty(global, 'navigator', {
                value: { geolocation: {} },
                writable: true,
                configurable: true,
            });
            expect(provider.isAvailable()).toBe(true);

            Object.defineProperty(global, 'navigator', {
                value: {},
                writable: true,
                configurable: true,
            });
            expect(provider.isAvailable()).toBe(false);
        });

        it('resolves permission granted when getCurrentPosition succeeds', async () => {
            const provider = new WebLocationProvider();
            Object.defineProperty(global, 'navigator', {
                value: {
                    geolocation: {
                        getCurrentPosition: jest.fn((success) => success({ coords: { latitude: 8.35, longitude: 124.86 } })),
                    },
                },
                writable: true,
                configurable: true,
            });

            const status = await provider.requestPermission();
            expect(status).toBe('granted');
        });

        it('resolves permission denied when error code is 1', async () => {
            const provider = new WebLocationProvider();
            Object.defineProperty(global, 'navigator', {
                value: {
                    geolocation: {
                        getCurrentPosition: jest.fn((_, error) => error({ code: 1, message: 'User denied' })),
                    },
                },
                writable: true,
                configurable: true,
            });

            const status = await provider.requestPermission();
            expect(status).toBe('denied');
        });

        it('resolves unavailable when error code is not 1 or geolocation unavailable', async () => {
            const provider = new WebLocationProvider();
            Object.defineProperty(global, 'navigator', {
                value: {},
                writable: true,
                configurable: true,
            });

            const status = await provider.requestPermission();
            expect(status).toBe('unavailable');
        });

        it('streams fixes through watchPosition and removes watch on cleanup', () => {
            const provider = new WebLocationProvider();
            let capturedSuccess: any;
            const clearWatchMock = jest.fn();

            Object.defineProperty(global, 'navigator', {
                value: {
                    geolocation: {
                        watchPosition: jest.fn((success) => {
                            capturedSuccess = success;
                            return 42;
                        }),
                        clearWatch: clearWatchMock,
                    },
                },
                writable: true,
                configurable: true,
            });

            const onFix = jest.fn();
            const onError = jest.fn();
            const handle = provider.watchPosition(onFix, onError);

            capturedSuccess({
                coords: { latitude: 8.3512, longitude: 124.8621, accuracy: 4.5 },
                timestamp: 1700000000000,
            });

            expect(onFix).toHaveBeenCalledWith({
                coordinate: { latitude: 8.3512, longitude: 124.8621 },
                accuracyMeters: 4.5,
                timestamp: 1700000000000,
            });

            handle.remove();
            expect(clearWatchMock).toHaveBeenCalledWith(42);
        });

        it('forwards watch errors to onError', () => {
            const provider = new WebLocationProvider();
            let capturedError: any;

            Object.defineProperty(global, 'navigator', {
                value: {
                    geolocation: {
                        watchPosition: jest.fn((_, error) => {
                            capturedError = error;
                            return 42;
                        }),
                        clearWatch: jest.fn(),
                    },
                },
                writable: true,
                configurable: true,
            });

            const onFix = jest.fn();
            const onError = jest.fn();
            provider.watchPosition(onFix, onError);

            capturedError({ message: 'GPS signal lost' });
            expect(onError).toHaveBeenCalledWith(expect.any(Error));
            expect(onError.mock.calls[0][0].message).toBe('GPS signal lost');
        });
    });

    describe('NativeLocationProvider', () => {
        beforeEach(() => {
            mockHasServicesEnabledAsync.mockReset();
            mockRequestForegroundPermissionsAsync.mockReset();
            mockWatchPositionAsync.mockReset();
        });

        it('reports availability as true on native platform', () => {
            const provider = new NativeLocationProvider();
            expect(provider.isAvailable()).toBe(true);
        });

        it('returns unavailable if device location services are disabled', async () => {
            mockHasServicesEnabledAsync.mockResolvedValue(false);
            mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });

            const provider = new NativeLocationProvider();
            const status = await provider.requestPermission();
            expect(status).toBe('unavailable');
            expect(mockHasServicesEnabledAsync).toHaveBeenCalled();
            expect(mockRequestForegroundPermissionsAsync).not.toHaveBeenCalled();
        });

        it('returns granted if services enabled and permission is granted', async () => {
            mockHasServicesEnabledAsync.mockResolvedValue(true);
            mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });

            const provider = new NativeLocationProvider();
            const status = await provider.requestPermission();
            expect(status).toBe('granted');
            expect(mockRequestForegroundPermissionsAsync).toHaveBeenCalled();
        });

        it('returns denied if services enabled but permission is denied', async () => {
            mockHasServicesEnabledAsync.mockResolvedValue(true);
            mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

            const provider = new NativeLocationProvider();
            const status = await provider.requestPermission();
            expect(status).toBe('denied');
        });

        it('returns unavailable if expo-location throws', async () => {
            mockHasServicesEnabledAsync.mockRejectedValue(new Error('Native module missing'));

            const provider = new NativeLocationProvider();
            const status = await provider.requestPermission();
            expect(status).toBe('unavailable');
        });

        it('watches position and unsubscribes cleanly on native', async () => {
            let capturedCallback: any;
            const removeMock = jest.fn();
            mockWatchPositionAsync.mockImplementation((opts, cb) => {
                capturedCallback = cb;
                return Promise.resolve({ remove: removeMock });
            });

            const provider = new NativeLocationProvider();
            const onFix = jest.fn();
            const onError = jest.fn();

            const handle = provider.watchPosition(onFix, onError);
            // wait a tick for import('expo-location') to resolve
            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(mockWatchPositionAsync).toHaveBeenCalled();
            capturedCallback({
                coords: { latitude: 8.35, longitude: 124.86, accuracy: 5.2 },
                timestamp: 1710000000000,
            });

            expect(onFix).toHaveBeenCalledWith({
                coordinate: { latitude: 8.35, longitude: 124.86 },
                accuracyMeters: 5.2,
                timestamp: 1710000000000,
            });

            handle.remove();
            expect(removeMock).toHaveBeenCalled();
        });
    });

    describe('locationProvider export', () => {
        it('exports a valid LocationProvider singleton', () => {
            expect(locationProvider).toBeDefined();
            expect(typeof locationProvider.isAvailable).toBe('function');
            expect(typeof locationProvider.requestPermission).toBe('function');
            expect(typeof locationProvider.watchPosition).toBe('function');
        });
    });
});
