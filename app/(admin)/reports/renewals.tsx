import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MfiKpiService } from '../../../src/services/MfiKpiService';
import { formatPHP } from '../../../src/utils/currency';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function RenewalReportScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<any>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await MfiKpiService.getRenewalReportData();
            setData(result);
        } catch (error) {
            console.error('Failed to load renewal report:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, []));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    if (loading && !refreshing && !data) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#4F46E5" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            {/* ── Top controls (Static) ── */}
            <View className="p-6 pb-2 bg-gray-50 border-b border-gray-100">
                <View className="flex-row justify-between items-center">
                    <View>
                        <Text className="text-2xl font-black text-gray-900">Borrower Retention</Text>
                        <Text className="text-gray-700 font-bold uppercase tracking-widest text-[10px]">
                            Loan Renewals & Growth Analysis
                        </Text>
                    </View>
                    <Pressable onPress={onRefresh} className="bg-white p-2 rounded-full shadow-sm border border-gray-100">
                        <MaterialIcons name="refresh" size={20} color="#4F46E5" />
                    </Pressable>
                </View>
            </View>

            <ScrollView
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ padding: 24 }}
            >
                {data && (
                    <>
                        {/* Retention Rate Hero */}
                        <Animated.View entering={FadeInDown.springify()} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm mb-8 items-center">
                            <View className="w-32 h-32 rounded-full border-8 border-indigo-50 items-center justify-center mb-4">
                                <Text className="text-3xl font-black text-indigo-600">{data.count.rate.toFixed(1)}%</Text>
                            </View>
                            <Text className="text-gray-900 font-black text-xl mb-1">Retention Rate</Text>
                            <Text className="text-gray-700 text-xs font-medium text-center px-10">
                                Percentage of your total loan portfolio that consists of repeat borrowers.
                            </Text>
                        </Animated.View>

                        {/* Counts Grid */}
                        <View className="flex-row gap-4 mb-8">
                            <View className="flex-1 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <View className="bg-blue-50 w-10 h-10 rounded-xl items-center justify-center mb-3">
                                    <Ionicons name="person-add" size={20} color="#3B82F6" />
                                </View>
                                <Text className="text-gray-700 text-[10px] font-black uppercase mb-1">New Borrowers</Text>
                                <Text className="text-gray-900 font-black text-2xl">{data.count.new}</Text>
                            </View>
                            <View className="flex-1 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <View className="bg-indigo-50 w-10 h-10 rounded-xl items-center justify-center mb-3">
                                    <Ionicons name="repeat" size={20} color="#4F46E5" />
                                </View>
                                <Text className="text-gray-700 text-[10px] font-black uppercase mb-1">Renewals</Text>
                                <Text className="text-gray-900 font-black text-2xl">{data.count.renewed}</Text>
                            </View>
                        </View>

                        {/* Volume Comparison */}
                        <Text className="text-gray-900 font-black text-xl mb-4 ml-1">Portfolio Volume Breakdown</Text>
                        <View className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-8">
                            <View className="mb-6">
                                <View className="flex-row justify-between items-end mb-2">
                                    <Text className="text-gray-600 font-bold">New Loans Volume</Text>
                                    <Text className="text-gray-900 font-black">{formatPHP(data.volume.new)}</Text>
                                </View>
                                <View className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                    <View 
                                        style={{ width: `${(data.volume.new / (data.volume.new + data.volume.renewed || 1)) * 100}%` }} 
                                        className="h-full bg-blue-500" 
                                    />
                                </View>
                            </View>

                            <View>
                                <View className="flex-row justify-between items-end mb-2">
                                    <Text className="text-gray-600 font-bold">Renewal Volume</Text>
                                    <Text className="text-gray-900 font-black">{formatPHP(data.volume.renewed)}</Text>
                                </View>
                                <View className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                    <View 
                                        style={{ width: `${(data.volume.renewed / (data.volume.new + data.volume.renewed || 1)) * 100}%` }} 
                                        className="h-full bg-indigo-600" 
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Trend Analysis */}
                        <Text className="text-gray-900 font-black text-xl mb-4 ml-1">Historical Trends (Volume)</Text>
                        <View className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden mb-10">
                            {data.trend.map((item: any, idx: number) => (
                                <View key={item.month} className={`flex-row items-center p-6 ${idx < data.trend.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                    <View className="flex-1">
                                        <Text className="text-gray-900 font-black">{item.month}</Text>
                                        <View className="flex-row mt-1">
                                            <View className="flex-row items-center mr-3">
                                                <View className="w-2 h-2 rounded-full bg-blue-500 mr-1" />
                                                <Text className="text-[10px] text-gray-700 font-bold">NEW</Text>
                                            </View>
                                            <View className="flex-row items-center">
                                                <View className="w-2 h-2 rounded-full bg-indigo-600 mr-1" />
                                                <Text className="text-[10px] text-gray-700 font-bold">RENEWED</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View className="items-end">
                                        <Text className="text-gray-900 font-black text-lg">{formatPHP(item.total)}</Text>
                                        <Text className="text-[10px] text-gray-700 font-bold">
                                            {((item.renewed / (item.total || 1)) * 100).toFixed(0)}% Renewal
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}
