import React, { useEffect } from 'react';
import { View, Animated, StyleSheet, ViewStyle, Platform } from 'react-native';

interface SkeletonProps {
    width?: number | string;
    height?: number | string;
    borderRadius?: number;
    className?: string;
    style?: ViewStyle;
}

export function Skeleton({ width, height, borderRadius = 8, className, style }: SkeletonProps) {
    const opacity = new Animated.Value(0.3);

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.7,
                    duration: 800,
                    useNativeDriver: Platform.OS !== 'web',
                }),
                Animated.timing(opacity, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: Platform.OS !== 'web',
                }),
            ])
        ).start();
    }, []);

    const animatedStyle = {
        width,
        height,
        borderRadius,
        backgroundColor: '#E2E8F0',
        opacity,
    } as any;

    return (
        <Animated.View
            className={className}
            style={[
                animatedStyle,
                style,
            ]}
        />
    );
}
