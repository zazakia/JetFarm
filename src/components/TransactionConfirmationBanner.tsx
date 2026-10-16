import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export interface TransactionConfirmationBannerProps {
    title?: string;
    message: string;
    transactionCode?: string;
    onDismiss?: () => void;
    actionLabel?: string;
    onAction?: () => void;
    testID?: string;
}

export function TransactionConfirmationBanner({
    title = 'Transaction Recorded Successfully',
    message,
    transactionCode,
    onDismiss,
    actionLabel,
    onAction,
    testID = 'transaction-confirmation-banner',
}: TransactionConfirmationBannerProps) {
    return (
        <View
            testID={testID}
            className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 mb-6 shadow-sm flex-row items-center justify-between"
        >
            <View className="flex-row items-start gap-3 flex-1 mr-2">
                <View className="w-9 h-9 rounded-full bg-emerald-100 items-center justify-center mt-0.5">
                    <MaterialIcons name="check-circle" size={22} color="#047857" />
                </View>
                <View className="flex-1">
                    <View className="flex-row items-center gap-2 flex-wrap">
                        <Text className="text-emerald-950 font-black text-sm">{title}</Text>
                        {transactionCode && (
                            <View className="bg-emerald-200/80 px-2 py-0.5 rounded-md">
                                <Text className="text-emerald-900 font-mono font-bold text-xs">
                                    {transactionCode}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text className="text-emerald-800 text-xs mt-1 leading-relaxed font-medium">
                        {message}
                    </Text>
                    {actionLabel && onAction && (
                        <Pressable
                            onPress={onAction}
                            className="mt-2 self-start bg-emerald-700 px-3 py-1.5 rounded-lg active:bg-emerald-800"
                        >
                            <Text className="text-white font-bold text-xs">{actionLabel}</Text>
                        </Pressable>
                    )}
                </View>
            </View>

            {onDismiss && (
                <Pressable
                    testID="confirmation-banner-dismiss"
                    onPress={onDismiss}
                    className="p-1 rounded-full hover:bg-emerald-100 active:bg-emerald-200"
                >
                    <MaterialIcons name="close" size={20} color="#047857" />
                </Pressable>
            )}
        </View>
    );
}

export default TransactionConfirmationBanner;
