import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { SyncService } from '../services/SyncService';
import { useSyncStore } from '../stores/syncStore';
import { useAuth } from '../store/AuthContext';

const HIDDEN_ROUTES = ['/login', '/register', '/loading', '/sync-center', '/(admin)'];

export function GlobalSyncButton() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, role, sunlightMode } = useAuth();
    const { status, pendingChanges, isOnline } = useSyncStore();
    const [isPressedSyncing, setIsPressedSyncing] = useState(false);
    const spinAnim = useRef(new Animated.Value(0)).current;

    const isSyncing = status === 'syncing' || isPressedSyncing;
    const isAdminShell = role === 'admin' || role === 'main_office';
    const shouldHide = !user || isAdminShell || HIDDEN_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));

    useEffect(() => {
        if (!isSyncing) {
            spinAnim.stopAnimation();
            spinAnim.setValue(0);
            return;
        }

        const animation = Animated.loop(
            Animated.timing(spinAnim, {
                toValue: 1,
                duration: 900,
                easing: Easing.linear,
                useNativeDriver: Platform.OS !== 'web',
            })
        );

        animation.start();
        return () => animation.stop();
    }, [isSyncing, spinAnim]);

    if (shouldHide) return null;

    const iconName = !isOnline ? 'cloud-off' : pendingChanges > 0 ? 'cloud-upload' : 'cloud-done';
    const label = isSyncing ? 'Syncing' : 'Sync';
    const statusLabel = !isOnline ? 'Offline' : pendingChanges > 0 ? `${pendingChanges}` : '';
    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const handlePress = async () => {
        if (isSyncing || !isOnline) {
            router.push('/sync-center' as any);
            return;
        }

        setIsPressedSyncing(true);
        try {
            await SyncService.checkAndSync({ force: true });
        } catch (error) {
            console.error('[GlobalSyncButton] Manual sync failed:', error);
        } finally {
            setIsPressedSyncing(false);
        }
    };

    const handleLongPress = () => {
        router.push('/sync-center' as any);
    };

    return (
        <View
            testID="global-sync-button-container"
            style={{
                position: 'absolute',
                right: 16,
                top: 84,
                zIndex: 9998,
                elevation: 12,
                pointerEvents: 'box-none',
            }}
        >
            <Pressable
                testID="global-sync-button"
                accessibilityRole="button"
                accessibilityLabel="Sync now"
                accessibilityHint="Runs sync. Long press opens Sync Center."
                onPress={handlePress}
                onLongPress={handleLongPress}
                className={`h-11 min-w-[86px] flex-row items-center justify-center rounded-full border px-3 shadow-lg active:opacity-80 ${
                    sunlightMode
                        ? 'bg-white border-2 border-black'
                        : !isOnline
                            ? 'bg-amber-50 border-amber-200'
                            : isSyncing
                                ? 'bg-blue-600 border-blue-700'
                                : 'bg-emerald-600 border-emerald-700'
                }`}
            >
                {isSyncing ? (
                    <Animated.View style={{ transform: [{ rotate: spin }] }} className="mr-2">
                        <MaterialIcons name="sync" size={18} color={sunlightMode ? '#000000' : '#FFFFFF'} />
                    </Animated.View>
                ) : !isOnline ? (
                    <MaterialIcons name={iconName} size={18} color={sunlightMode ? '#000000' : '#D97706'} />
                ) : (
                    <MaterialIcons name={iconName} size={18} color={sunlightMode ? '#000000' : '#FFFFFF'} />
                )}

                <Text
                    className={`ml-1.5 text-xs font-black uppercase ${
                        sunlightMode ? 'text-black' : !isOnline ? 'text-amber-800' : 'text-white'
                    }`}
                >
                    {label}
                </Text>

                {isSyncing && !sunlightMode && <ActivityIndicator size="small" color="#FFFFFF" className="ml-2" />}

                {statusLabel ? (
                    <View
                        className={`ml-2 min-w-5 items-center rounded-full px-1.5 py-0.5 ${
                            sunlightMode ? 'bg-black' : !isOnline ? 'bg-amber-200' : 'bg-white/20'
                        }`}
                    >
                        <Text
                            className={`text-[10px] font-black ${
                                sunlightMode ? 'text-white' : !isOnline ? 'text-amber-900' : 'text-white'
                            }`}
                        >
                            {statusLabel}
                        </Text>
                    </View>
                ) : null}
            </Pressable>
        </View>
    );
}
