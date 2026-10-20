import React from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { AnimatedPressable } from '../../../src/components/AnimatedPressable';
import { safeBack } from '../../../src/utils/navigation';

const ALL_CARDS = [
    {
        icon: 'calculate',
        title: 'Cooperative Computations',
        description: 'Edit savings interest rate, statutory allocations, and net surplus distributions.',
        route: '/(admin)/settings/coop-computations',
        lendingOnly: false,
    },
    {
        icon: 'toggle-on',
        title: 'Feature Flags',
        description: 'Turn optional modules on or off without changing code.',
        route: '/(admin)/settings/feature-flags',
        lendingOnly: false,
    },
    {
        icon: 'admin-panel-settings',
        title: 'Role Access',
        description: 'Control which roles can see route groups and major modules.',
        route: '/(admin)/settings/role-access',
        lendingOnly: false,
    },
    {
        icon: 'category',
        title: 'Expense Categories',
        description: 'Maintain expense categories used by admin and expense encoder screens.',
        route: '/(admin)/settings/expense-categories',
        lendingOnly: false,
    },
];

export default function BusinessRulesScreen() {
    const router = useRouter();

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <View className="flex-row items-center p-4 bg-white border-b border-gray-100">
                <AnimatedPressable onPress={() => safeBack(router, '/(admin)/settings')} className="p-2 -ml-2">
                    <MaterialIcons name="arrow-back" size={24} color="#1E3A8A" />
                </AnimatedPressable>
                <View className="ml-2 flex-1">
                    <Text className="text-xl font-black text-gray-900">Business Rules</Text>
                    <Text className="text-[10px] text-gray-700 font-bold uppercase tracking-widest">Settings-driven app behavior</Text>
                </View>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
                <View className="bg-blue-50 border border-blue-100 rounded-3xl p-5 mb-4">
                    <Text className="text-blue-900 font-black text-base mb-1">No-code configuration center</Text>
                    <Text className="text-blue-800 text-sm leading-5">
                        These settings are stored locally, synced to Supabase, and audited. Built-in defaults keep the app working if a device has not synced yet.
                    </Text>
                </View>

                {ALL_CARDS.map(card => (
                    <AnimatedPressable
                        key={card.route}
                        testID={`business-rule-card-${card.route}`}
                        onPress={() => router.push(card.route as any)}
                        className="mb-3"
                    >
                        <View className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex-row items-center">
                            <View className="w-12 h-12 rounded-2xl bg-green-50 items-center justify-center mr-4">
                                <MaterialIcons name={card.icon as any} size={24} color="#1E3A8A" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-gray-900 font-black text-base">{card.title}</Text>
                                <Text className="text-gray-700 text-xs leading-4 mt-1">{card.description}</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color="#CBD5E1" />
                        </View>
                    </AnimatedPressable>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
