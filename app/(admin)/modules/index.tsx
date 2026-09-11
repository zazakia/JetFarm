import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Switch } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { ModuleRegistry } from '../../../src/modules/registry';
import { BusinessUnitService } from '../../../src/services/BusinessUnitService';
import { useFeatureFlags } from '../../../src/hooks/useSettingsConfig';

export default function ModuleHubScreen() {
    const router = useRouter();
    const { isEnabled: isFlagEnabled } = useFeatureFlags();
    const [loading, setLoading] = useState(true);
    const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({});

    const loadModules = async () => {
        setLoading(true);
        try {
            const activeBUs = await BusinessUnitService.getAll();

            const enabledMap: Record<string, boolean> = {};
            activeBUs.forEach(bu => {
                if (bu.isActive) {
                    enabledMap[bu.moduleId] = true;
                }
            });
            setEnabledModules(enabledMap);
        } catch (error) {
            console.error('Failed to load modules from database:', error);
            Alert.alert('Error', 'Failed to retrieve business unit settings.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            void loadModules();
        }, [])
    );

    const toggleModule = async (moduleId: string) => {
        const module = ModuleRegistry.get(moduleId);
        if (!module) return;

        const isFlagActive = isFlagEnabled(module.featureKey);
        if (!isFlagActive) {
            Alert.alert(
                'Feature Flag Disabled',
                `${module.name} is currently turned off in Settings > Feature Flags. Please enable the feature flag first.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Open Settings', onPress: () => router.push('/(admin)/settings/feature-flags' as any) }
                ]
            );
            return;
        }

        const isCurrentlyEnabled = !!enabledModules[moduleId];
        setLoading(true);
        try {
            if (isCurrentlyEnabled) {
                // Disable
                await BusinessUnitService.setActiveState(moduleId, false);
                Alert.alert('Success', `${module.name} has been disabled.`);
            } else {
                // Enable/Register
                await BusinessUnitService.registerModule(module);
                Alert.alert('Success', `${module.name} has been enabled and accounts have been seeded.`);
            }
            await loadModules();
        } catch (error: any) {
            console.error('Failed to toggle module:', error);
            Alert.alert('Error', `Failed to update module state: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const allModules = ModuleRegistry.getAll();

    return (
        <ScrollView className="flex-1 bg-gray-50 p-4">
            <View className="mb-6">
                <Text className="text-2xl font-bold text-gray-900">Cooperative Business Modules</Text>
                <Text className="text-gray-600 mt-1">
                    Enable or disable specific business modules for your multi-purpose cooperative.
                </Text>
            </View>

            {loading && allModules.length === 0 ? (
                <View className="flex-1 justify-center items-center py-20">
                    <ActivityIndicator size="large" color="#1E3A8A" />
                    <Text className="text-gray-500 mt-4">Loading modules...</Text>
                </View>
            ) : (
                <View className="flex-row flex-wrap justify-between">
                    {allModules.map(module => {
                        const isFlagActive = isFlagEnabled(module.featureKey);
                        const isEnabled = isFlagActive && !!enabledModules[module.id];
                        return (
                            <View 
                                key={module.id} 
                                className="w-full md:w-[48%] bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-150 flex-col justify-between"
                            >
                                <View>
                                    <View className="flex-row items-center justify-between mb-3">
                                        <View className="bg-blue-50 p-3 rounded-xl">
                                            <MaterialIcons name={module.icon as any} size={28} color="#1E3A8A" />
                                        </View>
                                        <Switch
                                            value={isEnabled}
                                            onValueChange={() => toggleModule(module.id)}
                                            trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                                            thumbColor={isEnabled ? '#1E3A8A' : '#F3F4F6'}
                                        />
                                    </View>
                                    <Text className="text-lg font-bold text-gray-900">{module.name}</Text>
                                    <Text className="text-xs text-gray-500 mt-1">v{module.version}</Text>
                                    <Text className="text-gray-600 text-sm mt-3 leading-relaxed">
                                        {module.description}
                                    </Text>
                                    {!isFlagActive && (
                                        <View className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 mt-3 self-start">
                                            <Text className="text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                                                Flag Disabled in Settings
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                <View className="mt-6 border-t border-gray-100 pt-4 flex-row items-center justify-between">
                                    <View>
                                        <Text className="text-xs text-gray-400">CoA Segment</Text>
                                        <Text className="text-sm font-semibold text-gray-700">{module.coaSegmentCode} (e.g. {module.defaultCoA[0]?.code})</Text>
                                    </View>

                                    {isEnabled ? (
                                        <Pressable
                                            onPress={() => router.push(`/(admin)/modules/${module.id}` as any)}
                                            className="bg-blue-900 px-4 py-2 rounded-lg active:bg-blue-800"
                                        >
                                            <Text className="text-white text-xs font-bold">Open Console</Text>
                                        </Pressable>
                                    ) : (
                                        <Text className="text-xs font-medium text-gray-400 italic">Inactive</Text>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}
        </ScrollView>
    );
}
