import { Platform } from 'react-native';
import { GPSFix } from './BoundaryWalkService';

export type LocationPermissionStatus = 'granted' | 'denied' | 'unavailable';

export interface LocationWatchHandle {
    remove(): void;
}

/**
 * Platform-neutral position stream. Implemented with expo-location on native
 * and the browser Geolocation API on web, so boundary-walk capture works on
 * both and can be driven by Playwright's geolocation mocks in E2E.
 */
export interface LocationProvider {
    isAvailable(): boolean;
    requestPermission(): Promise<LocationPermissionStatus>;
    watchPosition(
        onFix: (fix: GPSFix) => void,
        onError: (error: Error) => void
    ): LocationWatchHandle;
}

class NativeLocationProvider implements LocationProvider {
    isAvailable(): boolean {
        return true;
    }

    async requestPermission(): Promise<LocationPermissionStatus> {
        try {
            const Location = await import('expo-location');
            const { status } = await Location.requestForegroundPermissionsAsync();
            return status === 'granted' ? 'granted' : 'denied';
        } catch {
            return 'unavailable';
        }
    }

    watchPosition(
        onFix: (fix: GPSFix) => void,
        onError: (error: Error) => void
    ): LocationWatchHandle {
        let subscription: LocationWatchHandle | null = null;
        let removed = false;

        import('expo-location')
            .then((Location) =>
                Location.watchPositionAsync(
                    {
                        accuracy: Location.LocationAccuracy.BestForNavigation,
                        distanceInterval: 1,
                        timeInterval: 1000,
                    },
                    (position) => {
                        onFix({
                            coordinate: {
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                            },
                            accuracyMeters: position.coords.accuracy ?? null,
                            timestamp: position.timestamp,
                        });
                    }
                )
            )
            .then((sub) => {
                if (removed) {
                    sub.remove();
                } else {
                    subscription = sub;
                }
            })
            .catch((error) => onError(error instanceof Error ? error : new Error(String(error))));

        return {
            remove: () => {
                removed = true;
                subscription?.remove();
            },
        };
    }
}

class WebLocationProvider implements LocationProvider {
    isAvailable(): boolean {
        return typeof navigator !== 'undefined' && !!navigator.geolocation;
    }

    async requestPermission(): Promise<LocationPermissionStatus> {
        if (!this.isAvailable()) return 'unavailable';
        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                () => resolve('granted'),
                (err) => resolve(err?.code === 1 ? 'denied' : 'unavailable'),
                { timeout: 5000, maximumAge: 0 }
            );
        });
    }

    watchPosition(
        onFix: (fix: GPSFix) => void,
        onError: (error: Error) => void
    ): LocationWatchHandle {
        const id = navigator.geolocation.watchPosition(
            (position) => {
                onFix({
                    coordinate: {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    },
                    accuracyMeters: position.coords.accuracy ?? null,
                    timestamp: position.timestamp,
                });
            },
            (err) => onError(new Error(err?.message || 'Geolocation watch failed')),
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
        );
        return { remove: () => navigator.geolocation.clearWatch(id) };
    }
}

export const locationProvider: LocationProvider =
    Platform.OS === 'web' ? new WebLocationProvider() : new NativeLocationProvider();
