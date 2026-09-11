import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, Pressable, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSyncStore } from '../stores/syncStore';
import { useRouter } from 'expo-router';
import { useAuth } from '../store/AuthContext';

export function SyncStatusIndicator() {
    const { status, pendingChanges, lastSyncAt } = useSyncStore();
    const spinAnim = useRef(new Animated.Value(0)).current;
    const router = useRouter();
    const { sunlightMode } = useAuth();

    useEffect(() => {
        if (status === 'syncing') {
            Animated.loop(
                Animated.timing(spinAnim, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.linear,
                    useNativeDriver: Platform.OS !== 'web',
                })
            ).start();
        } else {
            spinAnim.stopAnimation();
            spinAnim.setValue(0);
        }
    }, [status]);

    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const handlePress = () => {
        router.push('/sync-center' as any);
    };

    if (status === 'syncing') {
        return (
            <Pressable 
                testID="sync-status-indicator"
                onPress={handlePress} 
                className={`flex-row items-center px-3 py-1.5 rounded-full border active:opacity-70 ${sunlightMode ? 'bg-white border-2 border-black' : 'bg-amber-50 border-amber-200'}`}
            >
                <Animated.View style={{ transform: [{ rotate: spin }] }} className="mr-1.5">
                    <MaterialIcons name="sync" size={14} color={sunlightMode ? "#000" : "#D97706"} />
                </Animated.View>
                <Text className={`${sunlightMode ? 'text-black' : 'text-amber-700'} text-xs font-black uppercase tracking-tighter`}>Syncing</Text>
            </Pressable>
        );
    }

    if (status === 'error') {
        return (
            <Pressable 
                testID="sync-status-indicator"
                onPress={handlePress} 
                className={`flex-row items-center px-3 py-1.5 rounded-full border active:opacity-70 ${sunlightMode ? 'bg-white border-2 border-black' : 'bg-red-50 border-red-200'}`}
            >
                <MaterialIcons name="error-outline" size={14} color={sunlightMode ? "#000" : "#DC2626"} />
                <Text className={`${sunlightMode ? 'text-black' : 'text-red-700'} text-xs font-black uppercase tracking-tighter ml-1`}>Sync Fail</Text>
            </Pressable>
        );
    }

    if (pendingChanges > 0) {
        return (
            <Pressable 
                testID="sync-status-indicator"
                onPress={handlePress} 
                className={`flex-row items-center px-3 py-1.5 rounded-full border active:opacity-70 ${sunlightMode ? 'bg-white border-2 border-black' : 'bg-blue-50 border-blue-200'}`}
            >
                <MaterialIcons name="cloud-upload" size={14} color={sunlightMode ? "#000" : "#2563EB"} />
                <Text className={`${sunlightMode ? 'text-black' : 'text-blue-700'} text-xs font-black uppercase tracking-tighter ml-1`}>{pendingChanges} Pend</Text>
            </Pressable>
        );
    }

    // Default: idle or completed
    return (
        <Pressable 
            testID="sync-status-indicator"
            onPress={handlePress} 
            className={`flex-row items-center px-3 py-1.5 rounded-full border active:opacity-70 ${sunlightMode ? 'bg-white border-2 border-black' : 'bg-green-50 border-green-200'}`}
        >
            <MaterialIcons name="cloud-done" size={14} color={sunlightMode ? "#000" : "#16A34A"} />
            <Text className={`${sunlightMode ? 'text-black' : 'text-green-700'} text-xs font-black uppercase tracking-tighter ml-1`}>Synced</Text>
        </Pressable>
    );
}
