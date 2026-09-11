import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { AnimatedPressable } from './AnimatedPressable';
import { PhpCurrencyText } from './PhpCurrencyText';

interface CollectorKpiCardProps {
    title: string;
    value: string | number;
    icon: keyof typeof MaterialIcons.glyphMap;
    color: string;
    gradient: [string, string];
    isCurrency?: boolean;
    progress?: number; // 0 to 1
    description?: string;
    onPress?: () => void;
    sunlightMode?: boolean;
}

export function CollectorKpiCard({
    title,
    value,
    icon,
    color,
    gradient,
    isCurrency = false,
    progress,
    description,
    onPress,
    sunlightMode = false
}: CollectorKpiCardProps) {
    const { width } = useWindowDimensions();
    const isSmallPhone = width < 390;
    const cardPadding = isSmallPhone ? 14 : 20;
    const cardRadius = isSmallPhone ? 24 : 32;
    const titleSize = isSmallPhone ? 10 : 12;
    const valueSize = isSmallPhone ? 28 : 30;
    const currencySize = isSmallPhone ? 22 : 24;

    if (sunlightMode) {
        return (
            <AnimatedPressable
                onPress={onPress}
                disabled={!onPress}
                className="w-[48%] bg-white mb-4 border-4 border-black overflow-hidden"
                accessibilityLabel={`${title} metric card`}
                accessibilityRole="button"
                accessibilityHint={onPress ? `Open ${title}` : undefined}
                accessibilityState={{ disabled: !onPress }}
                hitSlop={4}
                pressRetentionOffset={8}
                // Smaller Android screens need tighter cards to avoid clipping and text wraps.
                style={[styles.containerSunlight, { padding: cardPadding, borderRadius: cardRadius }]}
            >
                <View className="flex-row justify-between items-start mb-4">
                    <View className="w-12 h-12 rounded-2xl items-center justify-center border-4 border-black bg-black">
                        <MaterialIcons name={icon} size={24} color="#FFFFFF" />
                    </View>
                    {progress !== undefined && (
                        <View className="bg-black px-2 py-1 rounded-full border-2 border-black">
                            <Text className="text-white text-[12px] font-black">{Math.round(progress * 100)}%</Text>
                        </View>
                    )}
                </View>

                <View>
                    <Text className="text-black font-black uppercase tracking-widest mb-1" style={{ fontSize: titleSize }}>{title}</Text>
                    {isCurrency ? (
                        <PhpCurrencyText 
                            amount={Number(value)} 
                            className="font-black text-black leading-tight"
                            style={{ fontSize: currencySize }}
                        />
                    ) : (
                        <Text className="font-black text-black leading-tight" style={{ fontSize: valueSize }}>{value}</Text>
                    )}
                    {description && (
                        <Text className="text-black text-[10px] font-black mt-2 uppercase tracking-tight">{description}</Text>
                    )}
                </View>

                {progress !== undefined && (
                    <View className="mt-4 h-4 bg-gray-100 rounded-full overflow-hidden border-2 border-black">
                        <View 
                            style={{ width: `${progress * 100}%` }} 
                            className="h-full bg-black rounded-full"
                        />
                    </View>
                )}
            </AnimatedPressable>
        );
    }
    return (
        <AnimatedPressable
            onPress={onPress}
            disabled={!onPress}
            style={[styles.container, { padding: cardPadding, borderRadius: cardRadius }]}
            className="w-[48%] bg-white shadow-xl shadow-gray-200/50 mb-4 border border-gray-50 overflow-hidden"
            accessibilityLabel={`${title} metric card`}
            accessibilityRole="button"
            accessibilityHint={onPress ? `Open ${title}` : undefined}
            accessibilityState={{ disabled: !onPress }}
            hitSlop={4}
            pressRetentionOffset={8}
        >
            <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.accentCircle}
            />
            
            <View className="flex-row justify-between items-start mb-4">
                <View 
                    style={{ backgroundColor: `${color}15` }}
                    className="w-12 h-12 rounded-2xl items-center justify-center border border-white"
                >
                    <MaterialIcons name={icon} size={24} color={color} />
                </View>
                {progress !== undefined && (
                    <View className="bg-white/90 px-2 py-1 rounded-full border border-gray-100">
                        <Text style={{ color }} className="text-[10px] font-black">{Math.round(progress * 100)}%</Text>
                    </View>
                )}
            </View>

            <View>
                <Text className="text-slate-600 font-black uppercase tracking-widest mb-1" style={{ fontSize: titleSize }}>{title}</Text>
                {isCurrency ? (
                    <PhpCurrencyText 
                        amount={Number(value)} 
                        className="font-black text-slate-900 leading-tight"
                        style={{ fontSize: currencySize }}
                    />
                ) : (
                    <Text className="font-black text-slate-900 leading-tight" style={{ fontSize: valueSize }}>{value}</Text>
                )}
                {description && (
                    <Text className="text-slate-600 text-[10px] font-bold mt-1 uppercase tracking-tighter">{description}</Text>
                )}
            </View>

            {progress !== undefined && (
                <View className="mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <View 
                        style={{ 
                            width: `${progress * 100}%`,
                            backgroundColor: color 
                        }} 
                        className="h-full rounded-full"
                    />
                </View>
            )}
        </AnimatedPressable>
    );
}

const styles = StyleSheet.create({
    container: {
        elevation: 8,
    },
    containerSunlight: {
        elevation: 0,
    },
    accentCircle: {
        position: 'absolute',
        top: -20,
        right: -20,
        width: 80,
        height: 80,
        borderRadius: 40,
        opacity: 0.1,
    }
});
