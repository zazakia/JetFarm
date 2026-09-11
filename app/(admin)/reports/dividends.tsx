import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, TextInput, Modal, Alert } from 'react-native';
import { Stack , useFocusEffect } from 'expo-router';

import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { DividendService, DividendDistributionSummary } from '../../../src/services/DividendService';
import { formatPHP } from '../../../src/utils/currency';

const CURRENT_YEAR = new Date().getFullYear();

export default function DividendsReportScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<DividendDistributionSummary | null>(null);
    const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
    const [netIncome, setNetIncome] = useState('');
    const [showConfig, setShowConfig] = useState(false);

    const loadData = async (incomeAmt?: number) => {
        setLoading(true);
        try {
            const amount = incomeAmt ?? (parseFloat(netIncome.replace(/,/g, '')) || 0);
            const result = await DividendService.calculateDistributionFromNetIncome(selectedYear, amount);
            setData(result);
        } catch (e) {
            console.error('Dividends Report error:', e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, [selectedYear]));
    const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

    const handleCompute = () => {
        const income = parseFloat(netIncome.replace(/,/g, ''));
        if (isNaN(income) || income <= 0) {
            Alert.alert('Invalid Input', 'Please enter a valid net income amount greater than zero.');
            return;
        }
        setShowConfig(false);
        loadData(income);
    };

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Year Selector */}
            <View className="flex-row items-center bg-blue-900 pt-20 pb-6 px-6 rounded-b-[40px] shadow-xl">
                <Pressable
                    onPress={() => setSelectedYear(y => y - 1)}
                    className="bg-white/10 rounded-full p-2"
                >
                    <MaterialIcons name="chevron-left" size={24} color="#FFF" />
                </Pressable>
                <View className="flex-1 items-center">
                    <Text className="text-white/70 text-[10px] uppercase font-bold tracking-widest">Distribution Year</Text>
                    <Text className="text-white text-3xl font-black">{selectedYear}</Text>
                </View>
                <Pressable
                    onPress={() => setSelectedYear(y => y + 1)}
                    className="bg-white/10 rounded-full p-2"
                >
                    <MaterialIcons name="chevron-right" size={24} color="#FFF" />
                </Pressable>
            </View>

            {loading && !refreshing ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#1E3A8A" />
                    <Text className="text-gray-400 mt-3">Computing dividends...</Text>
                </View>
            ) : (
                <ScrollView
                    className="flex-1 px-4 pt-4"
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Config prompt */}
                    <Pressable
                        onPress={() => setShowConfig(true)}
                        className="flex-row items-center bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4"
                    >
                        <MaterialIcons name="settings" size={20} color="#1E3A8A" />
                        <View className="flex-1 ml-3">
                            <Text className="text-blue-900 font-bold text-sm">Set Net Income</Text>
                            <Text className="text-blue-500 text-[10px]">
                                Net Income: {formatPHP(data?.netIncome ?? 0)} · ISC: {formatPHP(data?.totalISCPool ?? 0)} · PR: {formatPHP(data?.totalPRPool ?? 0)}
                            </Text>
                        </View>
                        <MaterialIcons name="edit" size={16} color="#1E3A8A" />
                    </Pressable>

                    {/* Summary Cards */}
                    {data && (
                        <>
                            <Animated.View entering={FadeInDown.springify()}>
                                <View className="flex-row gap-3 mb-4">
                                    <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                                        <Text className="text-gray-400 text-[9px] uppercase font-bold">ISC Pool</Text>
                                        <Text className="text-blue-900 font-black text-base">{formatPHP(data.totalISCPool)}</Text>
                                        <Text className="text-gray-400 text-[9px]">70% of member net surplus</Text>
                                    </View>
                                    <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                                        <Text className="text-gray-400 text-[9px] uppercase font-bold">PR Pool</Text>
                                        <Text className="text-emerald-600 font-black text-base">{formatPHP(data.totalPRPool)}</Text>
                                        <Text className="text-gray-400 text-[9px]">30% of member net surplus</Text>
                                    </View>
                                </View>

                                <View className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-4">
                                    <Text className="text-amber-900 font-black text-sm">Manual Formula</Text>
                                    <Text className="text-amber-700 text-xs mt-1">
                                        Net Income {formatPHP(data.netIncome ?? 0)} → Net Surplus for Distribution {formatPHP(data.netSurplusForDistribution ?? 0)} → ISC 70% / Patronage Refund 30%.
                                    </Text>
                                </View>

                                {data.absenteesCount > 0 && (
                                    <View className="flex-row items-center bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                                        <MaterialIcons name="warning" size={20} color="#D97706" />
                                        <View className="flex-1 ml-3">
                                            <Text className="text-amber-800 font-bold text-sm">GA Absentee Penalty Applied</Text>
                                            <Text className="text-amber-700 text-xs">
                                                {data.absenteesCount} member(s) had their PR ({formatPHP(data.amountPlowedBackToCBU)}) plowed back to CBU.
                                            </Text>
                                        </View>
                                    </View>
                                )}
                            </Animated.View>

                            {/* Member Distribution Table */}
                            <Text className="text-gray-900 font-black text-lg mb-3">Member Distribution</Text>
                            {data.members.map((m, idx) => (
                                <Animated.View
                                    key={m.memberId}
                                    entering={FadeInRight.delay(idx * 30).springify()}
                                    className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm"
                                >
                                    <View className="flex-row items-center justify-between mb-2">
                                        <View className="flex-1 mr-2">
                                            <Text className="text-gray-900 font-bold text-sm" numberOfLines={1}>{m.memberName}</Text>
                                            <Text className="text-gray-400 text-[10px]">{m.membershipNumber}</Text>
                                        </View>
                                        <View className="items-end">
                                            <Text className="text-blue-900 font-black text-sm">{formatPHP(m.totalBenefit)}</Text>
                                            <Text className="text-gray-400 text-[9px]">Total Benefit</Text>
                                        </View>
                                    </View>

                                    <View className="flex-row">
                                        <View className="flex-1">
                                            <Text className="text-gray-400 text-[9px] uppercase font-bold">ISC</Text>
                                            <Text className="text-blue-600 font-bold text-xs">{formatPHP(m.interestOnShareCapital)}</Text>
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-gray-400 text-[9px] uppercase font-bold">Patronage Refund</Text>
                                            <Text className="text-emerald-600 font-bold text-xs">{formatPHP(m.finalPatronageRefund)}</Text>
                                        </View>
                                        <View className="flex-1 items-end">
                                            {!m.attendedGA ? (
                                                <View className="bg-amber-50 px-2 py-0.5 rounded-full">
                                                    <Text className="text-amber-700 text-[9px] font-black">PR → CBU</Text>
                                                </View>
                                            ) : (
                                                <View className="bg-green-50 px-2 py-0.5 rounded-full">
                                                    <Text className="text-green-700 text-[9px] font-black">Attended GA</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </Animated.View>
                            ))}

                            {data.members.length === 0 && (
                                <View className="items-center py-16">
                                    <MaterialIcons name="people-outline" size={48} color="#E5E7EB" />
                                    <Text className="text-gray-400 mt-3 font-bold">No active regular members found</Text>
                                </View>
                            )}
                        </>
                    )}
                </ScrollView>
            )}

            {/* Config Modal */}
            <Modal visible={showConfig} transparent animationType="slide" onRequestClose={() => setShowConfig(false)}>
                <View className="flex-1 justify-end bg-black/40">
                    <View className="bg-white rounded-t-[40px] p-6">
                        <Text className="text-gray-900 font-black text-xl mb-2">Configure Net Income</Text>
                        <Text className="text-gray-500 text-sm mb-6">Enter net income for {selectedYear}. The app applies 70% to member net surplus, then splits that 70% into ISC 70% and Patronage Refund 30%.</Text>

                        <Text className="text-gray-700 font-bold text-sm mb-1">Net Income Amount (PHP)</Text>
                        <TextInput
                            className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-4 font-bold"
                            placeholder="e.g. 150000"
                            keyboardType="numeric"
                            value={netIncome}
                            onChangeText={setNetIncome}
                         placeholderTextColor="#9CA3AF"/>

                        <Pressable onPress={handleCompute} className="bg-blue-900 rounded-2xl py-4 items-center active:bg-blue-800 mb-3">
                            <Text className="text-white font-black text-base">Compute Distribution</Text>
                        </Pressable>
                        <Pressable onPress={() => setShowConfig(false)} className="items-center py-3">
                            <Text className="text-gray-400 font-bold">Cancel</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
