import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

type StateViewProps = {
    title: string;
    message?: string;
    icon?: keyof typeof MaterialIcons.glyphMap;
    actionLabel?: string;
    onAction?: () => void;
    loading?: boolean;
    testID?: string;
};

export function StateView({
    title,
    message,
    icon = 'info-outline',
    actionLabel,
    onAction,
    loading = false,
    testID,
}: StateViewProps) {
    return (
        <View
            testID={testID}
            className="bg-white rounded-3xl p-8 items-center border border-gray-100"
            accessibilityRole={loading ? 'progressbar' : 'summary'}
            accessibilityLabel={message ? `${title}. ${message}` : title}
        >
            <View className="bg-gray-50 p-5 rounded-full mb-4">
                {loading ? (
                    <ActivityIndicator color={Colors.primary} size="large" />
                ) : (
                    <MaterialIcons name={icon} size={40} color="#9CA3AF" />
                )}
            </View>
            <Text className="text-gray-900 font-black text-base text-center">{title}</Text>
            {message ? (
                <Text className="text-gray-700 text-sm text-center mt-1">{message}</Text>
            ) : null}
            {actionLabel && onAction ? (
                <Pressable
                    onPress={onAction}
                    accessibilityRole="button"
                    accessibilityLabel={actionLabel}
                    className="mt-5 px-6 py-3 min-h-[44px] items-center justify-center rounded-2xl bg-emerald-600 active:bg-emerald-700 active:scale-[0.98]"
                >
                    <Text className="text-white font-black">{actionLabel}</Text>
                </Pressable>
            ) : null}
        </View>
    );
}
