import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MfiKpiService } from '../../../src/services/MfiKpiService';
import { formatPHP } from '../../../src/utils/currency';
import { format } from 'date-fns';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { MetricBreakdownDialog, BreakdownItem } from '../../../src/components/MetricBreakdownDialog';

export default function SavingsReportScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<any>(null);
    const [breakdownVisible, setBreakdownVisible] = useState(false);
    const [breakdownData, setBreakdownData] = useState<{ title: string; total: number; items: BreakdownItem[]; color: string }>({
        title: '', total: 0, items: [], color: 'text-blue-900'
    });

    const handleTotalSavingsClick = () => {
        if (!data) return;
        const items: BreakdownItem[] = (data.topSavers || []).map((s: any) => ({
            id: s.id,
            label: s.name || 'Member',
            sublabel: `Savings Account Balance`,
            value: s.balance,
            isCurrency: true,
        }));

        setBreakdownData({
            title: 'Member Savings Portfolio',
            total: data.summary.currentBalance,
            items,
            color: 'text-blue-900',
        });
        setBreakdownVisible(true);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await MfiKpiService.getSavingsReportData();
            setData(result);
        } catch (error) {
            console.error('Failed to load savings report:', error);
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
                <ActivityIndicator size="large" color="#1E3A8A" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            {/* ── Top controls (Static) ── */}
            <View className="p-6 pb-2 bg-gray-50 border-b border-gray-100">
                <View className="flex-row justify-between items-center">
                    <View>
                        <Text className="text-2xl font-black text-gray-900">Savings Overview</Text>
                        <Text className="text-gray-700 font-bold uppercase tracking-widest text-[10px]">
                            Borrower Capital Tracking
                        </Text>
                    </View>
                    <Pressable onPress={onRefresh} className="bg-white p-2 rounded-full shadow-sm border border-gray-100">
                        <MaterialIcons name="refresh" size={20} color="#1E3A8A" />
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
                        {/* Hero Card */}
                        <Animated.View entering={FadeInDown.springify()}>
                            <Pressable onPress={handleTotalSavingsClick} className="bg-blue-900 p-8 rounded-[40px] shadow-xl mb-8 active:opacity-90">
                            <View className="flex-row justify-between items-start mb-6">
                                <View>
                                    <Text className="text-white/90 text-xs font-bold uppercase tracking-widest mb-1">Total Savings Portfolio (Tap for details)</Text>
                                    <Text className="text-white text-4xl font-black">{formatPHP(data.summary.currentBalance)}</Text>
                                </View>
                                <View className="bg-white/10 p-3 rounded-2xl">
                                    <MaterialIcons name="savings" size={32} color="#FFFFFF" />
                                </View>
                            </View>
                            
                            <View className="flex-row justify-between items-center bg-white/5 p-4 rounded-3xl">
                                <View>
                                    <Text className="text-white/80 text-[10px] uppercase font-bold">30-Day Velocity</Text>
                                    <Text className={`font-black text-base ${data.summary.recentVelocity >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {data.summary.recentVelocity >= 0 ? '+' : ''}{formatPHP(data.summary.recentVelocity)}
                                    </Text>
                                </View>
                                <View className="items-end">
                                    <Text className="text-white/80 text-[10px] uppercase font-bold">Total Interest Paid</Text>
                                    <Text className="text-yellow-400 font-black text-base">{formatPHP(data.summary.totalInterest)}</Text>
                                </View>
                            </View>
                            </Pressable>
                        </Animated.View>

                        {/* Stats Grid */}
                        <View className="flex-row mb-8">
                            <View className="flex-1 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mr-4">
                                <Text className="text-gray-700 text-[10px] font-black uppercase mb-1">Gross Deposits</Text>
                                <Text className="text-gray-900 font-black text-xl text-green-600">{formatPHP(data.summary.totalDeposits)}</Text>
                            </View>
                            <View className="flex-1 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                                <Text className="text-gray-700 text-[10px] font-black uppercase mb-1">Total Withdrawals</Text>
                                <Text className="text-gray-900 font-black text-xl text-red-600">({formatPHP(data.summary.totalWithdrawals)})</Text>
                            </View>
                        </View>

                        {/* Top Savers */}
                        <Text className="text-gray-900 font-black text-xl mb-4 ml-1">Top Savers</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8">
                            {data.topSavers.map((saver: any, idx: number) => (
                                <Animated.View 
                                    key={saver.id} 
                                    entering={FadeInRight.delay(idx * 100).springify()}
                                    className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mr-4 w-48"
                                >
                                    <Text className="text-gray-900 font-bold text-sm mb-1" numberOfLines={1}>{saver.name}</Text>
                                    <Text className="text-blue-900 font-black text-lg">{formatPHP(saver.balance)}</Text>
                                    <View className="mt-3 bg-blue-50 self-start px-2 py-1 rounded-lg">
                                        <Text className="text-blue-700 font-bold text-[10px]">RANK #{idx + 1}</Text>
                                    </View>
                                </Animated.View>
                            ))}
                        </ScrollView>

                        {/* Recent Activity */}
                        <Text className="text-gray-900 font-black text-xl mb-4 ml-1">Recent Savings Activity</Text>
                        <View className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden mb-10">
                            {data.activity.length === 0 ? (
                                <View className="py-20 items-center">
                                    <MaterialIcons name="history" size={48} color="#E5E7EB" />
                                    <Text className="text-gray-700 mt-2 font-bold">No recent activity</Text>
                                </View>
                            ) : (
                                data.activity.map((tx: any, idx: number) => (
                                    <View key={tx.id} className={`flex-row items-center p-5 ${idx < data.activity.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                        <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${
                                            tx.type === 'deposit' ? 'bg-green-50' : 
                                            tx.type === 'interest' ? 'bg-yellow-50' : 'bg-red-50'
                                        }`}>
                                            <MaterialIcons 
                                                name={tx.type === 'deposit' ? 'add-card' : tx.type === 'interest' ? 'trending-up' : 'account-balance-wallet'} 
                                                size={24} 
                                                color={tx.type === 'deposit' ? '#16A34A' : tx.type === 'interest' ? '#CA8A04' : '#DC2626'} 
                                            />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-gray-900 font-bold text-sm">{tx.borrowerName}</Text>
                                            <Text className="text-gray-700 text-[10px] font-medium uppercase tracking-tighter">
                                                {format(tx.date, 'MMM d, yyyy • h:mm a')}
                                            </Text>
                                        </View>
                                        <View className="items-end">
                                            <Text className={`font-black text-base ${
                                                (tx.type === 'deposit' || tx.type === 'interest') ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                                {(tx.type === 'deposit' || tx.type === 'interest') ? '+' : '-'}{formatPHP(tx.amount)}
                                            </Text>
                                            <Text className="text-gray-700 text-[9px] font-bold uppercase">{tx.type.replace('_', ' ')}</Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    </>
                )}
            </ScrollView>

            <MetricBreakdownDialog
                visible={breakdownVisible}
                onClose={() => setBreakdownVisible(false)}
                {...breakdownData}
            />
        </View>
    );
}
