import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export interface ModuleQuickGuideProps {
    moduleTitle: string;
    description: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    badgeColor?: string; // e.g. 'bg-emerald-600'
    steps: Array<{
        title: string;
        desc: string;
    }>;
    showDemoDataButton?: boolean;
    onLoadDemoData?: () => void;
    helpSectionId?: string;
}

export function ModuleQuickGuide({
    moduleTitle,
    description,
    icon,
    badgeColor = 'bg-blue-900',
    steps,
    showDemoDataButton = false,
    onLoadDemoData,
    helpSectionId,
}: ModuleQuickGuideProps) {
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <View className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-5">
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1 mr-3">
                    <View className={`w-10 h-10 rounded-2xl ${badgeColor} items-center justify-center mr-3`}>
                        <MaterialIcons name={icon} size={22} color="#FFFFFF" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-gray-900 font-black text-base">{moduleTitle}</Text>
                        <Text className="text-gray-500 text-xs font-medium" numberOfLines={1}>{description}</Text>
                    </View>
                </View>

                <Pressable
                    onPress={() => setCollapsed(!collapsed)}
                    className="p-2 rounded-xl bg-gray-50 active:bg-gray-100"
                    hitSlop={8}
                >
                    <MaterialIcons
                        name={collapsed ? 'expand-more' : 'expand-less'}
                        size={20}
                        color="#6B7280"
                    />
                </Pressable>
            </View>

            {!collapsed && (
                <View className="mt-4 pt-4 border-t border-gray-100">
                    <View className="gap-2.5 mb-4">
                        {steps.map((s, idx) => (
                            <View key={s.title} className="flex-row items-start">
                                <View className="w-5 h-5 rounded-full bg-blue-50 border border-blue-200 items-center justify-center mr-2.5 mt-0.5">
                                    <Text className="text-blue-900 font-bold text-[10px]">{idx + 1}</Text>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-gray-900 font-bold text-xs">{s.title}</Text>
                                    <Text className="text-gray-600 text-xs leading-4">{s.desc}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    <View className="flex-row items-center justify-between pt-2 border-t border-gray-50">
                        <Pressable
                            onPress={() => router.push('/(admin)/help' as any)}
                            className="flex-row items-center py-1.5 px-3 rounded-xl bg-blue-50 active:bg-blue-100"
                        >
                            <MaterialIcons name="help-outline" size={16} color="#1E3A8A" />
                            <Text className="text-blue-900 font-bold text-xs ml-1.5">Open Full App Guide</Text>
                        </Pressable>

                        {showDemoDataButton && onLoadDemoData && (
                            <Pressable
                                onPress={onLoadDemoData}
                                className="flex-row items-center py-1.5 px-3 rounded-xl bg-emerald-50 active:bg-emerald-100"
                            >
                                <MaterialIcons name="auto-fix-high" size={16} color="#065F46" />
                                <Text className="text-emerald-900 font-bold text-xs ml-1.5">Load Demo Data</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            )}
        </View>
    );
}

export default ModuleQuickGuide;
