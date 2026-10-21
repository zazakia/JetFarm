import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SettingsService } from '../../../src/services/SettingsService';
import { useAuth } from '../../../src/store/AuthContext';
import { safeBack } from '../../../src/utils/navigation';

/**
 * Statutory reserve allocations - the settings half of the retained financial layer.
 *
 * This screen replaced `settings/coop-computations.tsx`, which also edited the savings interest
 * rate, minimum maintaining balance, the net-surplus split and the ISC / patronage refund shares.
 * Those four keys configure the lending cooperative, which is physically deleted on this variant,
 * so nothing reads them any more. What is still read is the four percentages below, consumed by
 * app/(admin)/reports/statutory-reserves.tsx and CoopFinancialReportService.
 *
 * Deliberately absent: the old "allocations must sum to exactly 100%" rule. Under the cooperative
 * distribution model the whole net surplus was carved up; here the statutory appropriation is what
 * it is (10 + 10 + 3 + 7 = 30% by default) and the remainder stays in retained surplus, which the
 * statements compute themselves and crop partners settle through their investor ledgers.
 */

interface AllocationField {
    key: string;
    label: string;
    fallback: number;
    hint?: string;
}

const FIELDS: AllocationField[] = [
    { key: 'fund.reserve_fund_allocation', label: 'General Reserve Fund (%)', fallback: 0.10 },
    { key: 'fund.education_fund_allocation', label: 'Education & Training Fund (%)', fallback: 0.10 },
    {
        key: 'fund.community_development_fund_allocation',
        label: 'Community Development Fund (%)',
        fallback: 0.03,
    },
    {
        key: 'fund.optional_fund_allocation',
        label: 'Optional Fund (%)',
        fallback: 0.07,
        hint: 'Appropriation this fund is a board decision, not a statutory minimum.',
    },
];

export default function StatutoryAllocationsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [values, setValues] = useState<string[]>(FIELDS.map(() => '0'));

    const showAlert = (title: string, message: string, onPress?: () => void) => {
        if (Platform.OS === 'web') {
            alert(`${title}: ${message}`);
            if (onPress) onPress();
        } else {
            Alert.alert(title, message, onPress ? [{ text: 'OK', onPress }] : undefined);
        }
    };

    useEffect(() => {
        async function loadSettings() {
            setLoading(true);
            try {
                const loaded = await Promise.all(
                    FIELDS.map(field => SettingsService.getNumberSetting(field.key, field.fallback))
                );
                // round to whole percentage points the way the report renders them
                setValues(loaded.map(ratio => String(Math.round(ratio * 100))));
            } catch (error) {
                console.error('[StatutoryAllocations] load settings failed:', error);
                showAlert('Load Failed', 'Failed to load allocations from the settings table.');
            } finally {
                setLoading(false);
            }
        }
        void loadSettings();
    }, []);

    const handleSave = async () => {
        const percentages = values.map(value => parseFloat(value));

        if (percentages.some(pct => isNaN(pct) || pct < 0 || pct > 100)) {
            showAlert(
                'Invalid Allocation',
                'Allocation percentages must be valid non-negative numbers not exceeding 100.'
            );
            return;
        }

        setSaving(true);
        try {
            for (let index = 0; index < FIELDS.length; index += 1) {
                await SettingsService.setAppSetting(FIELDS[index].key, String(percentages[index] / 100), user?.id);
            }
            showAlert('Settings Saved', 'Statutory fund percentages updated successfully.', () => {
                safeBack(router, '/(admin)/settings/business-rules');
            });
        } catch (error: any) {
            console.error('[StatutoryAllocations] save failed:', error);
            showAlert('Save Failed', 'Could not update the statutory allocations. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <ActivityIndicator className="flex-1 bg-gray-50 pt-20" size="large" color="#1E3A8A" />;
    }

    const total = values.reduce((sum, value) => sum + (parseFloat(value) || 0), 0);

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <View className="flex-row items-center p-4 bg-white border-b border-gray-100">
                <Pressable onPress={() => safeBack(router, '/(admin)/settings/business-rules')} className="p-2 -ml-2">
                    <MaterialIcons name="arrow-back" size={24} color="#1E3A8A" />
                </Pressable>
                <View className="ml-2 flex-1">
                    <Text className="text-xl font-black text-gray-900">Statutory Reserve Allocations</Text>
                    <Text className="text-[10px] text-gray-700 font-bold uppercase tracking-widest">Financial statements inputs</Text>
                </View>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                <View className="bg-blue-50 border border-blue-100 rounded-3xl p-5 mb-6">
                    <Text className="text-blue-900 font-black text-sm mb-1">Feeds the Statutory Reserves report</Text>
                    <Text className="text-blue-800 text-xs leading-4">
                        Changing these percentages changes how much of the net surplus the reserve, education,
                        community development and optional funds appropriate on the report and the notes to the
                        financial statements.
                    </Text>
                </View>

                <View className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mb-6">
                    <View className="flex-row items-center mb-1">
                        <MaterialIcons name="account-balance" size={20} color="#1E3A8A" className="mr-2" />
                        <Text className="text-gray-900 font-black text-base">Statutory Allocations</Text>
                    </View>
                    <Text className="text-gray-400 text-[10px] mb-4">
                        Percentage of net surplus appropriated to each statutory fund.
                    </Text>

                    {FIELDS.map((field, index) => (
                        <View key={field.key} className={index === FIELDS.length - 1 ? 'mb-2' : 'mb-4'}>
                            <Text className="text-gray-700 font-bold text-xs mb-1">{field.label}</Text>
                            <TextInput
                                className="border border-gray-200 rounded-2xl px-4 py-3 text-gray-950 font-bold text-sm bg-gray-50"
                                value={values[index]}
                                onChangeText={(next) => setValues(prev => prev.map((v, i) => (i === index ? next : v)))}
                                keyboardType="numeric"
                                placeholder="e.g. 10"
                                placeholderTextColor="#9CA3AF"
                            />
                            {field.hint ? (
                                <Text className="text-gray-400 text-[10px] mt-1">{field.hint}</Text>
                            ) : null}
                        </View>
                    ))}

                    <View className="mt-4 p-3 bg-gray-50 rounded-2xl border border-gray-100 flex-row justify-between items-center">
                        <Text className="text-gray-700 font-bold text-xs">Total Appropriated:</Text>
                        <Text className="font-black text-sm text-gray-900">{total}%</Text>
                    </View>

                    <Text className="text-gray-400 text-[10px] mt-3 leading-4">
                        The surplus not appropriated here stays in retained surplus. It is not paid out as a
                        member dividend — crop partners are settled through their investor ledgers when the
                        harvest is closed.
                    </Text>
                </View>

                <Pressable
                    className={`rounded-2xl py-4 px-6 items-center mt-2 ${saving ? 'bg-blue-900' : 'bg-blue-950'}`}
                    onPress={handleSave}
                    disabled={saving}
                >
                    <Text className="text-white font-black text-base">
                        {saving ? 'Saving…' : 'Save Parameters'}
                    </Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}
