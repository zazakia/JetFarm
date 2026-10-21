import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, TextInput, Alert } from 'react-native';
import { Stack , useFocusEffect } from 'expo-router';

import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CooperativeFundService, SurplusDistribution } from '../../../src/services/CooperativeFundService';
import { SettingsService } from '../../../src/services/SettingsService';
import { formatPHP } from '../../../src/utils/currency';
import { COMPANY_NAME } from '../../../src/constants/brand';

export default function StatutoryReservesScreen() {
    const [netIncome, setNetIncome] = useState('');
    const [result, setResult] = useState<SurplusDistribution | null>(null);
    const [computed, setComputed] = useState(false);
    const [percentages, setPercentages] = useState({
        reserve: 10,
        education: 10,
        community: 3,
        optional: 7,
    });

    useFocusEffect(
        useCallback(() => {
            let active = true;
            async function load() {
                const rf = await SettingsService.getNumberSetting('fund.reserve_fund_allocation', 0.10);
                const ed = await SettingsService.getNumberSetting('fund.education_fund_allocation', 0.10);
                const cf = await SettingsService.getNumberSetting('fund.community_development_fund_allocation', 0.03);
                const op = await SettingsService.getNumberSetting('fund.optional_fund_allocation', 0.07);
                if (active) {
                    setPercentages({
                        reserve: Math.round(rf * 100),
                        education: Math.round(ed * 100),
                        community: Math.round(cf * 100),
                        optional: Math.round(op * 100),
                    });
                }
            }
            load();
            return () => {
                active = false;
            };
        }, [])
    );

    const handleCompute = async () => {
        const amount = parseFloat(netIncome.replace(/,/g, ''));
        if (isNaN(amount) || amount <= 0) {
            Alert.alert('Invalid Input', 'Please enter a valid net income amount greater than zero.');
            return;
        }
        const dist = await CooperativeFundService.calculateSurplusDistribution(amount);
        setResult(dist);
        setComputed(true);
    };

    const FUNDS = [
        {
            key: 'reserveFund',
            label: 'General Reserve Fund',
            pct: `${percentages.reserve}%`,
            description: '100% deposited to the bank',
            icon: 'account-balance' as const,
            color: '#1E3A8A',
            bg: '#EFF6FF',
        },
        {
            key: 'educationFund',
            label: 'CETF (Education & Training)',
            pct: `${percentages.education}%`,
            description: 'Mandatory trainings, seminars, Coop Month celebrations',
            icon: 'school' as const,
            color: '#7C3AED',
            bg: '#F5F3FF',
        },
        {
            key: 'communityDevelopmentFund',
            label: 'Community Development Fund',
            pct: `${percentages.community}%`,
            description: 'Community projects, outreach, donations',
            icon: 'favorite' as const,
            color: '#DC2626',
            bg: '#FEF2F2',
        },
        {
            key: 'optionalFund',
            label: 'Optional Fund',
            pct: `${percentages.optional}%`,
            description: 'Land, building, computerization, promotions',
            icon: 'savings' as const,
            color: '#059669',
            bg: '#ECFDF5',
        },
    ];

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <Animated.View
                    entering={FadeInDown.springify()}
                    className="shadow-xl"
                    style={{
                        backgroundColor: '#1E3A8A',
                        paddingTop: 96,
                        paddingBottom: 40,
                        paddingHorizontal: 24,
                        borderBottomLeftRadius: 40,
                        borderBottomRightRadius: 40,
                        marginBottom: 24,
                    }}
                >
                    <Text className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">Statutory Reserves</Text>
                    <Text className="text-white text-2xl font-black mb-2">Surplus Distribution</Text>
                    <Text className="text-white/60 text-xs leading-5">
                        Per the {COMPANY_NAME} Operational Manual, net income is allocated to statutory funds and member distributions.
                    </Text>
                </Animated.View>

                {/* Input */}
                <View className="mx-4 bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mb-6">
                    <Text className="text-gray-900 font-black text-base mb-1">Net Income for the Period</Text>
                    <Text className="text-gray-400 text-xs mb-3">Enter total net income before statutory fund and member distribution allocations.</Text>
                    <View className="flex-row items-center border border-gray-200 rounded-2xl px-4 py-3 mb-4">
                        <Text className="text-gray-400 font-bold mr-2">PHP</Text>
                        <TextInput
                            className="flex-1 text-gray-900 font-bold text-base"
                            placeholder="e.g. 150,000"
                            keyboardType="numeric"
                            value={netIncome}
                            onChangeText={setNetIncome}
                         placeholderTextColor="#9CA3AF"/>
                    </View>
                    <Pressable
                        onPress={handleCompute}
                        className="bg-blue-900 rounded-2xl py-4 items-center active:bg-blue-900"
                    >
                        <Text className="text-white font-black text-base">Calculate Distribution</Text>
                    </Pressable>
                </View>

                {/* Results */}
                {computed && result && (
                    <View className="px-4">
                        <View className="bg-gray-900 rounded-3xl p-5 mb-4">
                            <Text className="text-white/60 text-xs uppercase font-bold tracking-widest">Net Income</Text>
                            <Text className="text-white text-3xl font-black">{formatPHP(result.netIncome)}</Text>
                        </View>

                        {FUNDS.map((fund, idx) => (
                            <Animated.View
                                key={fund.key}
                                entering={FadeInDown.delay(idx * 80).springify()}
                                className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mb-3"
                            >
                                <View className="flex-row items-start">
                                    <View className="w-12 h-12 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: fund.bg }}>
                                        <MaterialIcons name={fund.icon} size={24} color={fund.color} />
                                    </View>
                                    <View className="flex-1">
                                        <View className="flex-row items-center justify-between mb-0.5">
                                            <Text className="text-gray-900 font-black text-sm flex-1 mr-2">{fund.label}</Text>
                                            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: fund.bg }}>
                                                <Text className="text-xs font-black" style={{ color: fund.color }}>{fund.pct}</Text>
                                            </View>
                                        </View>
                                        <Text className="text-gray-400 text-[10px] mb-2">{fund.description}</Text>
                                        <Text className="font-black text-xl" style={{ color: fund.color }}>
                                            {formatPHP((result as any)[fund.key])}
                                        </Text>
                                    </View>
                                </View>
                            </Animated.View>
                        ))}

                        <View className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mt-1 mb-3">
                            <Text className="text-amber-900 font-black text-sm mb-3">Surplus After Appropriations</Text>
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-amber-800 font-bold text-xs flex-1">Total Statutory Funds</Text>
                                <Text className="text-amber-900 font-black text-xs">{formatPHP(result.totalStatutoryFunds)}</Text>
                            </View>
                            <View className="flex-row justify-between">
                                <Text className="text-amber-800 font-bold text-xs flex-1">Retained Surplus</Text>
                                <Text className="text-amber-900 font-black text-xs">{formatPHP(result.retainedSurplus)}</Text>
                            </View>
                            <Text className="text-amber-700 text-[10px] mt-2 leading-4">
                                Retained surplus is not paid out as a member dividend. Crop partners are settled
                                through their investor ledgers when the harvest is closed.
                            </Text>
                        </View>

                        {/* Verify total */}
                        <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mt-2">
                            <View className="flex-row justify-between">
                                <Text className="text-gray-700 font-bold">Total Allocated</Text>
                                <Text className="text-gray-900 font-black">
                                    {formatPHP(result.totalStatutoryFunds + result.retainedSurplus)}
                                </Text>
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
