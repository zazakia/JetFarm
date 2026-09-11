import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import FeatureFlag from '../../../src/database/models/FeatureFlag';
import { SettingsService } from '../../../src/services/SettingsService';
import { useAuth } from '../../../src/store/AuthContext';
import { safeBack } from '../../../src/utils/navigation';

export default function FeatureFlagsSettingsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [flags, setFlags] = useState<FeatureFlag[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            setFlags(await SettingsService.getFeatureFlags());
        } catch (error) {
            console.error('[FeatureFlagsSettings] load failed:', error);
            Alert.alert('Settings Error', 'Unable to load feature flags.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const toggle = async (flag: FeatureFlag, enabled: boolean) => {
        setSavingId(flag.id);
        try {
            await SettingsService.setFeatureEnabled(flag, enabled, user?.id);
            await load();
        } catch (error: any) {
            Alert.alert('Save Failed', error?.message || 'Unable to update feature flag.');
        } finally {
            setSavingId(null);
        }
    };

    if (loading) {
        return <ActivityIndicator className="flex-1 bg-gray-50 pt-20" size="large" color="#1E3A8A" />;
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <View className="flex-row items-center p-4 bg-white border-b border-gray-100">
                <Pressable onPress={() => safeBack(router, '/(admin)/settings/business-rules')} className="p-2 -ml-2">
                    <MaterialIcons name="arrow-back" size={24} color="#1E3A8A" />
                </Pressable>
                <View className="ml-2 flex-1">
                    <Text className="text-xl font-black text-gray-900">Feature Flags</Text>
                    <Text className="text-[10px] text-gray-700 font-bold uppercase tracking-widest">Enable or hide app modules</Text>
                </View>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
                <View className="bg-amber-50 border border-amber-100 rounded-3xl p-5 mb-4">
                    <Text className="text-amber-900 font-black text-sm">Runtime visibility controls</Text>
                    <Text className="text-amber-800 text-xs leading-4 mt-1">
                        Disabling a feature hides navigation/actions. It does not delete existing data.
                    </Text>
                </View>

                {flags.map(flag => (
                    <View key={flag.id} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mb-3 flex-row items-center">
                        <View className="flex-1 pr-4">
                            <Text className="text-gray-900 font-black text-base">{flag.label}</Text>
                            <Text className="text-gray-700 text-xs mt-1 leading-4">{flag.description}</Text>
                            <Text className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-2">{flag.key}</Text>
                        </View>
                        {savingId === flag.id ? (
                            <ActivityIndicator color="#1E3A8A" />
                        ) : (
                            <Switch
                                value={flag.enabled !== false}
                                trackColor={{ true: '#1E3A8A' }}
                                onValueChange={value => toggle(flag, value)}
                            />
                        )}
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
