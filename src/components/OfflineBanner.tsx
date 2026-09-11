import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSyncStore } from '../stores/syncStore';

export function OfflineBanner() {
    const { isOnline } = useSyncStore();
    const slideAnim = useRef(new Animated.Value(-60)).current;
    const wasOffline = useRef(false);

    useEffect(() => {
        const useNativeDriver = Platform.OS !== 'web';
        
        if (!isOnline) {
            wasOffline.current = true;
            // Slide down to reveal
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver,
                friction: 8,
            }).start();
        } else {
            // Slide back up when reconnected
            Animated.timing(slideAnim, {
                toValue: -60,
                duration: 300,
                useNativeDriver,
            }).start();
        }
    }, [isOnline]);

    // Don't render anything if we've never been offline
    if (isOnline && !wasOffline.current) return null;

    return (
        <Animated.View
            style={{
                transform: [{ translateY: slideAnim }],
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 9999,
            }}
        >
            <View
                style={{
                    backgroundColor: '#1C1917',
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                }}
            >
                <MaterialIcons
                    name={isOnline ? 'wifi' : 'wifi-off'}
                    size={16}
                    color={isOnline ? '#4ADE80' : '#FCA5A5'}
                />
                <Text
                    style={{
                        color: isOnline ? '#4ADE80' : '#FCA5A5',
                        fontSize: 13,
                        fontWeight: '700',
                    }}
                >
                    {isOnline
                        ? 'Back online — syncing your changes...'
                        : "You're offline — changes will sync when reconnected"}
                </Text>
            </View>
        </Animated.View>
    );
}
