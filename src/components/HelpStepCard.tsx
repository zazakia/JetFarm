import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useAuth } from '../store/AuthContext';

interface HelpStepCardProps {
    stepNumber: number;
    title: string;
    description: string;
    icon: keyof typeof MaterialIcons.glyphMap | keyof typeof Ionicons.glyphMap;
    color?: string;
    delay?: number;
}

export function HelpStepCard({ stepNumber, title, description, icon, color = '#4F46E5', delay = 0 }: HelpStepCardProps) {
    const { sunlightMode } = useAuth();
    return (
        <Animated.View 
            entering={FadeInRight.delay(delay).springify()}
            className={`flex-row p-5 rounded-[28px] mb-4 items-center border ${sunlightMode ? 'bg-white border-2 border-black' : 'bg-white shadow-sm border-gray-50'}`}
        >
            <View className="mr-5 items-center justify-center">
                <View 
                    className={`w-12 h-12 rounded-2xl items-center justify-center mb-1 border ${sunlightMode ? 'bg-black border-black' : 'bg-indigo-50 border-transparent shadow-sm'}`}
                    style={!sunlightMode ? { backgroundColor: `${color}10` } : undefined}
                >
                    <MaterialIcons name={icon as any} size={24} color={sunlightMode ? "#FFF" : color} />
                    <View 
                        className={`absolute -top-2 -right-2 w-6 h-6 rounded-full items-center justify-center border-2 border-white shadow-sm ${sunlightMode ? 'bg-black shadow-none' : ''}`}
                        style={!sunlightMode ? { backgroundColor: color } : undefined}
                    >
                        <Text className="text-white font-black text-[10px]">{stepNumber}</Text>
                    </View>
                </View>
            </View>
            <View className="flex-1">
                <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-base mb-1 tracking-tight`}>{title}</Text>
                <Text className={`${sunlightMode ? 'text-black/70' : 'text-gray-700'} text-xs font-bold leading-5`}>{description}</Text>
            </View>
        </Animated.View>
    );
}
