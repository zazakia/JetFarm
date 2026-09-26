import { Stack, useRouter } from 'expo-router';
import { AuthProvider, useAuth } from '../src/store/AuthContext';
import { GlobalErrorBoundary } from '../src/components/ErrorBoundary';
import Toast from '../src/components/AppToast';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { GlobalSyncButton } from '../src/components/GlobalSyncButton';
import { useNetworkStatus } from '../src/hooks/useNetworkStatus';
import { MaterialIcons, Ionicons, FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { cssInterop } from 'nativewind';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import '../global.css';
import { AutoSyncService } from '../src/services/AutoSyncService';
import { SettingsService } from '../src/services/SettingsService';
import { DeviceLockOverlay } from '../src/components/DeviceLockOverlay';
import { deviceSecurityService } from '../src/services/DeviceSecurityService';
import { AutoUpdateController } from '../src/components/AutoUpdateController';

import { AnimatedPressable } from '../src/components/AnimatedPressable';

import { database } from '../src/database';
import { useSyncStore } from '../src/stores/syncStore';

if (typeof cssInterop === 'function') {
    try {
        cssInterop(MaterialIcons, {
            className: 'style',
        });

        cssInterop(AnimatedPressable, {
            className: 'style',
        });
    } catch (e) {
        // Safe fallthrough if cssInterop fails in non-native environment
    }
}

function AppShell({ children }: { children: React.ReactNode }) {
    // Bootstrap network monitoring at the root level
    useNetworkStatus();
    const router = useRouter();
    const { initialized, user } = useAuth();
    useEffect(() => {
        if (typeof globalThis !== 'undefined') {
            (globalThis as any).__WATERMELON_DB__ = database;
            (globalThis as any).__AUTO_SYNC_SERVICE__ = AutoSyncService;
            (globalThis as any).__SYNC_STORE__ = useSyncStore;
            (globalThis as any).router = router;
        }
        if (typeof window !== 'undefined') {
            (window as any).router = router;
        }
        AutoSyncService.start();
        void SettingsService.ensureDefaults()
            .then(async () => {
                try {
                    const name = await SettingsService.getAppSetting('brand.company_name', 'Agri-One');
                    const fullName = await SettingsService.getAppSetting('brand.company_name_full', 'Agri-One');
                    const logo = await SettingsService.getAppSetting('brand.logo_base64', '');

                    const { setBrandData } = require('../src/constants/brand');
                    const { setLogoBase64 } = require('../src/utils/logoBase64');

                    setBrandData(name, fullName);
                    if (logo) {
                        setLogoBase64(logo);
                    }
                } catch (err) {
                    console.warn('[RootLayout] Failed to load brand settings:', err);
                }
            })
            .catch((error) => {
                console.warn('[RootLayout] Settings defaults bootstrap failed:', error);
            });
        return () => {
            AutoSyncService.stop();
            deviceSecurityService.stopHeartbeat();
        };
    }, []);

    useEffect(() => {
        if (!initialized) return;
        const isAuthenticated = Boolean(user);
        AutoSyncService.setAuthenticated(isAuthenticated);
        if (isAuthenticated) {
            deviceSecurityService.startHeartbeat();
        } else {
            deviceSecurityService.stopHeartbeat();
        }
    }, [initialized, user]);

    return (
        <>
            {children}
            <AutoUpdateController />
            <GlobalSyncButton />
            <OfflineBanner />
            <Toast />
            <DeviceLockOverlay />
        </>
    );
}

export default function RootLayout() {
    console.log('[RootLayout] Rendering RootLayout');

    const [fontsLoaded, fontError] = useFonts({
        ...FontAwesome.font,
        ...FontAwesome5.font,
        ...Ionicons.font,
        ...MaterialIcons.font,
    });

    useEffect(() => {
        if (fontError) {
            console.error('[RootLayout] Error loading fonts:', fontError);
        }
    }, [fontError]);

    if (!fontsLoaded && !fontError) {
        return null;
    }

    return (
        <GlobalErrorBoundary>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <AuthProvider>
                    <AppShell>
                        <Stack screenOptions={{ headerShown: false }}>
                            <Stack.Screen name="loading" />
                            <Stack.Screen name="login" />
                            <Stack.Screen name="loan-calculator" />
                            <Stack.Screen name="loan-application" />
                            <Stack.Screen name="sync-center" options={{ presentation: 'modal' }} />
                            <Stack.Screen name="(admin)" />
                            <Stack.Screen name="(cashier)" />
                            <Stack.Screen name="(collector)" />
                            <Stack.Screen name="(loan-encoder)" />
                            <Stack.Screen name="(payment-encoder)" />
                            <Stack.Screen name="(expenses-encoder)" />
                            <Stack.Screen name="(borrower)" />
                            <Stack.Screen name="select-branch" />
                        </Stack>
                    </AppShell>
                </AuthProvider>
            </GestureHandlerRootView>
        </GlobalErrorBoundary>
    );
}

export { RouteErrorBoundary as ErrorBoundary } from '../src/components/RouteErrorBoundary';
