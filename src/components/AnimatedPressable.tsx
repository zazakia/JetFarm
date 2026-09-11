import React from 'react';
import { Platform, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { cssInterop, remapProps } from 'nativewind';

interface AnimatedPressableProps extends PressableProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    /** Scale factor on press. Defaults to 0.93. */
    scaleFactor?: number;
    /** Opacity on press. Defaults to 0.75. */
    pressedOpacity?: number;
    /** Whether to trigger haptic feedback. Defaults to true. */
    haptic?: boolean;
    /** Test ID for Playwright/E2E testing. */
    "data-testid"?: string;
}

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export function AnimatedPressable({
    children,
    style,
    scaleFactor = 0.93,
    pressedOpacity = 0.75,
    haptic = true,
    onPressIn,
    onPressOut,
    ...props
}: AnimatedPressableProps) {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: opacity.value,
    }));

    const handlePressIn = (event: any) => {
        // Scale down with a snappier, more premium spring
        scale.value = withSpring(scaleFactor, {
            damping: 15,
            stiffness: 250,
            mass: 0.4,
        });
        // Dim opacity quickly for instant visual feedback
        opacity.value = withSpring(pressedOpacity, {
            damping: 20,
            stiffness: 300,
        });
        // Trigger a light haptic pulse
        if (haptic && Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        onPressIn?.(event);
    };

    const handlePressOut = (event: any) => {
        // Spring back with a satisfying, high-tension bounce
        scale.value = withSpring(1, {
            damping: 15,
            stiffness: 220,
            mass: 0.5,
        });
        // Restore opacity
        opacity.value = withSpring(1, {
            damping: 20,
            stiffness: 300,
        });
        onPressOut?.(event);
    };

    return (
        <AnimatedPressableBase
            {...props}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={[style, animatedStyle]}
        >
            {children}
        </AnimatedPressableBase>
    );
}

const interop = typeof cssInterop === 'function' ? cssInterop : remapProps;

if (typeof interop === 'function') {
    try {
        interop(AnimatedPressableBase, {
            className: 'style',
        });
    } catch (e) {
        // NativeWind cssInterop safe fallthrough for Jest
    }
}
