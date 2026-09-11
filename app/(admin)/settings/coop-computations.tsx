import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SettingsService } from '../../../src/services/SettingsService';
import { useAuth } from '../../../src/store/AuthContext';
import { safeBack } from '../../../src/utils/navigation';

export default function CooperativeComputationsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const showAlert = (title: string, message: string, onPress?: () => void) => {
        if (Platform.OS === 'web') {
            alert(`${title}: ${message}`);
            if (onPress) onPress();
        } else {
            Alert.alert(title, message, onPress ? [{ text: 'OK', onPress }] : undefined);
        }
    };

    // Form states
    const [savingsInterestRate, setSavingsInterestRate] = useState('6');
    const [savingsMinBalance, setSavingsMinBalance] = useState('100');

    const [netSurplusAllocation, setNetSurplusAllocation] = useState('70');
    const [reserveAllocation, setReserveAllocation] = useState('10');
    const [educationAllocation, setEducationAllocation] = useState('10');
    const [communityAllocation, setCommunityAllocation] = useState('3');
    const [optionalAllocation, setOptionalAllocation] = useState('7');

    const [iscDistribution, setIscDistribution] = useState('70');
    const [prDistribution, setPrDistribution] = useState('30');

    useEffect(() => {
        async function loadSettings() {
            setLoading(true);
            try {
                const sir = await SettingsService.getNumberSetting('savings.interest_rate', 0.06);
                const smb = await SettingsService.getNumberSetting('savings.min_maintaining_balance', 100);
                
                const nsa = await SettingsService.getNumberSetting('fund.net_surplus_allocation', 0.70);
                const rfa = await SettingsService.getNumberSetting('fund.reserve_fund_allocation', 0.10);
                const eda = await SettingsService.getNumberSetting('fund.education_fund_allocation', 0.10);
                const cda = await SettingsService.getNumberSetting('fund.community_development_fund_allocation', 0.03);
                const opa = await SettingsService.getNumberSetting('fund.optional_fund_allocation', 0.07);

                const isc = await SettingsService.getNumberSetting('fund.isc_distribution', 0.70);
                const pr = await SettingsService.getNumberSetting('fund.pr_distribution', 0.30);

                setSavingsInterestRate(String(Math.round(sir * 10000) / 100)); // Handles decimals nicely like 6.5
                setSavingsMinBalance(String(smb));
                setNetSurplusAllocation(String(Math.round(nsa * 100)));
                setReserveAllocation(String(Math.round(rfa * 100)));
                setEducationAllocation(String(Math.round(eda * 100)));
                setCommunityAllocation(String(Math.round(cda * 100)));
                setOptionalAllocation(String(Math.round(opa * 100)));
                setIscDistribution(String(Math.round(isc * 100)));
                setPrDistribution(String(Math.round(pr * 100)));
            } catch (error) {
                console.error('[CooperativeComputations] load settings failed:', error);
                showAlert('Load Failed', 'Failed to load settings from database.');
            } finally {
                setLoading(false);
            }
        }
        void loadSettings();
    }, []);

    const handleSave = async () => {
        const sir = parseFloat(savingsInterestRate);
        const smb = parseFloat(savingsMinBalance);

        const nsa = parseFloat(netSurplusAllocation);
        const rfa = parseFloat(reserveAllocation);
        const eda = parseFloat(educationAllocation);
        const cda = parseFloat(communityAllocation);
        const opa = parseFloat(optionalAllocation);

        const isc = parseFloat(iscDistribution);
        const pr = parseFloat(prDistribution);

        console.log('[CooperativeComputations] handleSave called');
        console.log('[CooperativeComputations] values:', { sir, smb, nsa, rfa, eda, cda, opa, isc, pr });

        // Validation
        if (isNaN(sir) || sir < 0 || isNaN(smb) || smb < 0) {
            showAlert('Invalid Savings Rules', 'Interest rate and minimum balance must be valid non-negative numbers.');
            return;
        }

        if (isNaN(nsa) || nsa < 0 || isNaN(rfa) || rfa < 0 || isNaN(eda) || eda < 0 || isNaN(cda) || cda < 0 || isNaN(opa) || opa < 0) {
            showAlert('Invalid Fund Allocations', 'Allocation percentages must be valid non-negative numbers.');
            return;
        }

        if (isNaN(isc) || isc < 0 || isNaN(pr) || pr < 0) {
            showAlert('Invalid Distribution Splits', 'Distribution splits must be valid non-negative numbers.');
            return;
        }

        // Sum allocations
        const totalAllocation = nsa + rfa + eda + cda + opa;
        if (Math.abs(totalAllocation - 100) > 0.001) {
            showAlert(
                'Invalid Allocation Sum', 
                `The sum of all statutory allocations must be exactly 100%. Currently, it is ${totalAllocation}%.`
            );
            return;
        }

        // Sum splits
        const totalSplit = isc + pr;
        if (Math.abs(totalSplit - 100) > 0.001) {
            showAlert(
                'Invalid Distribution Split Sum', 
                `The sum of Member splits (ISC + Patronage Refund) must be exactly 100%. Currently, it is ${totalSplit}%.`
            );
            return;
        }

        setSaving(true);
        try {
            await SettingsService.setAppSetting('savings.interest_rate', String(sir / 100), user?.id);
            await SettingsService.setAppSetting('savings.min_maintaining_balance', String(smb), user?.id);
            await SettingsService.setAppSetting('fund.net_surplus_allocation', String(nsa / 100), user?.id);
            await SettingsService.setAppSetting('fund.reserve_fund_allocation', String(rfa / 100), user?.id);
            await SettingsService.setAppSetting('fund.education_fund_allocation', String(eda / 100), user?.id);
            await SettingsService.setAppSetting('fund.community_development_fund_allocation', String(cda / 100), user?.id);
            await SettingsService.setAppSetting('fund.optional_fund_allocation', String(opa / 100), user?.id);
            await SettingsService.setAppSetting('fund.isc_distribution', String(isc / 100), user?.id);
            await SettingsService.setAppSetting('fund.pr_distribution', String(pr / 100), user?.id);

            showAlert('Settings Saved', 'Cooperative calculation parameters updated successfully.', () => {
                safeBack(router, '/(admin)/settings/business-rules');
            });
        } catch (error: any) {
            console.error('[CooperativeComputations] save failed:', error);
            showAlert('Save Failed', error?.message || 'Unable to update settings.');
        } finally {
            setSaving(false);
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
                    <Text className="text-xl font-black text-gray-900">Cooperative Computations</Text>
                    <Text className="text-[10px] text-gray-700 font-bold uppercase tracking-widest">Financial rules and allocations</Text>
                </View>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                {/* Information Callout */}
                <View className="bg-blue-50 border border-blue-100 rounded-3xl p-5 mb-6">
                    <Text className="text-blue-900 font-black text-sm mb-1">CDA & Internal Rules Compliance</Text>
                    <Text className="text-blue-800 text-xs leading-4">
                        Modifying these settings alters the interest rate computations and net surplus allocations for reports, dividends, and interest payments immediately.
                    </Text>
                </View>

                {/* Section 1: Savings Rules */}
                <View className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mb-6">
                    <View className="flex-row items-center mb-4">
                        <MaterialIcons name="savings" size={20} color="#1E3A8A" className="mr-2" />
                        <Text className="text-gray-900 font-black text-base">Savings Settings</Text>
                    </View>

                    <View className="mb-4">
                        <Text className="text-gray-700 font-bold text-xs mb-1">Interest Rate Per Annum (%)</Text>
                        <TextInput
                            className="border border-gray-200 rounded-2xl px-4 py-3 text-gray-950 font-bold text-sm bg-gray-50"
                            value={savingsInterestRate}
                            onChangeText={setSavingsInterestRate}
                            keyboardType="numeric"
                            placeholder="e.g. 6.0"
                         placeholderTextColor="#9CA3AF"/>
                        <Text className="text-gray-400 text-[10px] mt-1">Annual percentage rate credited to eligible savings balances.</Text>
                    </View>

                    <View className="mb-2">
                        <Text className="text-gray-700 font-bold text-xs mb-1">Min Maintaining Balance (PHP)</Text>
                        <TextInput
                            className="border border-gray-200 rounded-2xl px-4 py-3 text-gray-950 font-bold text-sm bg-gray-50"
                            value={savingsMinBalance}
                            onChangeText={setSavingsMinBalance}
                            keyboardType="numeric"
                            placeholder="e.g. 100"
                         placeholderTextColor="#9CA3AF"/>
                        <Text className="text-gray-400 text-[10px] mt-1">Minimum average monthly balance required to earn quarterly interest.</Text>
                    </View>
                </View>

                {/* Section 2: Statutory Reserve Fund Allocations */}
                <View className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mb-6">
                    <View className="flex-row items-center mb-1">
                        <MaterialIcons name="account-balance" size={20} color="#1E3A8A" className="mr-2" />
                        <Text className="text-gray-900 font-black text-base">Statutory Allocations</Text>
                    </View>
                    <Text className="text-gray-400 text-[10px] mb-4">Allocation percentages of the Net Income. Must sum to exactly 100%.</Text>

                    <View className="mb-3">
                        <Text className="text-gray-700 font-bold text-xs mb-1">Net Surplus for Distribution (%)</Text>
                        <TextInput
                            className="border border-gray-200 rounded-2xl px-4 py-3 text-gray-950 font-bold text-sm bg-gray-50"
                            value={netSurplusAllocation}
                            onChangeText={setNetSurplusAllocation}
                            keyboardType="numeric"
                            placeholder="e.g. 70"
                         placeholderTextColor="#9CA3AF"/>
                        <Text className="text-gray-400 text-[10px] mt-1">Allocation to be divided among members (ISC and Patronage).</Text>
                    </View>

                    <View className="mb-3">
                        <Text className="text-gray-700 font-bold text-xs mb-1">General Reserve Fund (%)</Text>
                        <TextInput
                            className="border border-gray-200 rounded-2xl px-4 py-3 text-gray-950 font-bold text-sm bg-gray-50"
                            value={reserveAllocation}
                            onChangeText={setReserveAllocation}
                            keyboardType="numeric"
                            placeholder="e.g. 10"
                         placeholderTextColor="#9CA3AF"/>
                    </View>

                    <View className="mb-3">
                        <Text className="text-gray-700 font-bold text-xs mb-1">Education & Training Fund (%)</Text>
                        <TextInput
                            className="border border-gray-200 rounded-2xl px-4 py-3 text-gray-950 font-bold text-sm bg-gray-50"
                            value={educationAllocation}
                            onChangeText={setEducationAllocation}
                            keyboardType="numeric"
                            placeholder="e.g. 10"
                         placeholderTextColor="#9CA3AF"/>
                    </View>

                    <View className="mb-3">
                        <Text className="text-gray-700 font-bold text-xs mb-1">Community Development Fund (%)</Text>
                        <TextInput
                            className="border border-gray-200 rounded-2xl px-4 py-3 text-gray-950 font-bold text-sm bg-gray-50"
                            value={communityAllocation}
                            onChangeText={setCommunityAllocation}
                            keyboardType="numeric"
                            placeholder="e.g. 3"
                         placeholderTextColor="#9CA3AF"/>
                    </View>

                    <View className="mb-2">
                        <Text className="text-gray-700 font-bold text-xs mb-1">Optional Fund (%)</Text>
                        <TextInput
                            className="border border-gray-200 rounded-2xl px-4 py-3 text-gray-950 font-bold text-sm bg-gray-50"
                            value={optionalAllocation}
                            onChangeText={setOptionalAllocation}
                            keyboardType="numeric"
                            placeholder="e.g. 7"
                         placeholderTextColor="#9CA3AF"/>
                    </View>

                    <View className="mt-4 p-3 bg-gray-50 rounded-2xl border border-gray-100 flex-row justify-between items-center">
                        <Text className="text-gray-700 font-bold text-xs">Total Allocation Sum:</Text>
                        <Text className={`font-black text-sm ${
                            Math.abs(parseFloat(netSurplusAllocation || '0') + parseFloat(reserveAllocation || '0') + parseFloat(educationAllocation || '0') + parseFloat(communityAllocation || '0') + parseFloat(optionalAllocation || '0') - 100) < 0.001 
                            ? 'text-green-600' 
                            : 'text-red-500'
                        }`}>
                            {(parseFloat(netSurplusAllocation || '0') + parseFloat(reserveAllocation || '0') + parseFloat(educationAllocation || '0') + parseFloat(communityAllocation || '0') + parseFloat(optionalAllocation || '0')) || 0}%
                        </Text>
                    </View>
                </View>

                {/* Section 3: Sharing in Net Surplus Splits */}
                <View className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mb-6">
                    <View className="flex-row items-center mb-1">
                        <MaterialIcons name="people" size={20} color="#1E3A8A" className="mr-2" />
                        <Text className="text-gray-900 font-black text-base">Net Surplus Splits</Text>
                    </View>
                    <Text className="text-gray-400 text-[10px] mb-4">Distribution splits of the member pool. Must sum to exactly 100%.</Text>

                    <View className="mb-3">
                        <Text className="text-gray-700 font-bold text-xs mb-1">Interest on Share Capital (ISC) split (%)</Text>
                        <TextInput
                            className="border border-gray-200 rounded-2xl px-4 py-3 text-gray-950 font-bold text-sm bg-gray-50"
                            value={iscDistribution}
                            onChangeText={setIscDistribution}
                            keyboardType="numeric"
                            placeholder="e.g. 70"
                         placeholderTextColor="#9CA3AF"/>
                        <Text className="text-gray-400 text-[10px] mt-1">Proportion of net surplus distributed based on paid-up share capital.</Text>
                    </View>

                    <View className="mb-2">
                        <Text className="text-gray-700 font-bold text-xs mb-1">Patronage Refund split (%)</Text>
                        <TextInput
                            className="border border-gray-200 rounded-2xl px-4 py-3 text-gray-950 font-bold text-sm bg-gray-50"
                            value={prDistribution}
                            onChangeText={setPrDistribution}
                            keyboardType="numeric"
                            placeholder="e.g. 30"
                         placeholderTextColor="#9CA3AF"/>
                        <Text className="text-gray-400 text-[10px] mt-1">Proportion of net surplus distributed based on patronage (loan volume).</Text>
                    </View>

                    <View className="mt-4 p-3 bg-gray-50 rounded-2xl border border-gray-100 flex-row justify-between items-center">
                        <Text className="text-gray-700 font-bold text-xs">Total Split Sum:</Text>
                        <Text className={`font-black text-sm ${
                            Math.abs(parseFloat(iscDistribution || '0') + parseFloat(prDistribution || '0') - 100) < 0.001 
                            ? 'text-green-600' 
                            : 'text-red-500'
                        }`}>
                            {(parseFloat(iscDistribution || '0') + parseFloat(prDistribution || '0')) || 0}%
                        </Text>
                    </View>
                </View>

                {/* Save Button */}
                <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    className="bg-blue-900 rounded-3xl py-4 items-center mb-8 active:bg-blue-800 flex-row justify-center"
                >
                    {saving && <ActivityIndicator size="small" color="#FFFFFF" className="mr-2" />}
                    <Text className="text-white font-black text-base">Save Parameters</Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}
