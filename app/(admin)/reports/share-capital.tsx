import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TextInput, Pressable } from 'react-native';
import { Stack, useRouter , useFocusEffect } from 'expo-router';

import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import Borrower from '../../../src/database/models/Borrower';
import ShareCapitalTransaction from '../../../src/database/models/ShareCapitalTransaction';
import { ShareCapitalService } from '../../../src/services/ShareCapitalService';
import { formatPHP } from '../../../src/utils/currency';
import { format } from 'date-fns';
import { formatDate } from '../../../src/utils/dates';
import { MetricBreakdownDialog, BreakdownItem } from '../../../src/components/MetricBreakdownDialog';

const PAR_VALUE = 100; // P100 per share

export default function ShareCapitalReportScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [rows, setRows] = useState<any[]>([]);
    const [filteredRows, setFilteredRows] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [summary, setSummary] = useState({ totalMembers: 0, totalPaidUp: 0, totalSubscribed: 0, totalShares: 0, avgPerMember: 0 });
    const [recentTx, setRecentTx] = useState<any[]>([]);
    const [breakdownVisible, setBreakdownVisible] = useState(false);
    const [breakdownData, setBreakdownData] = useState<{ title: string; total: number; items: BreakdownItem[]; color: string }>({
        title: '', total: 0, items: [], color: 'text-blue-900'
    });

    const handleTotalPaidUpClick = () => {
        const items: BreakdownItem[] = rows.map(r => ({
            id: r.id,
            label: r.name || 'Member',
            sublabel: `Member #${r.membershipNumber} • ${r.paidUpShares} Shares`,
            value: r.paidUpAmount,
            isCurrency: true,
            onPress: () => {
                setBreakdownVisible(false);
                if (r.id) router.push(`/(admin)/borrowers/${r.id}`);
            }
        }));

        setBreakdownData({
            title: 'Paid-Up Share Capital Breakdown',
            total: summary.totalPaidUp,
            items,
            color: 'text-blue-900',
        });
        setBreakdownVisible(true);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const allBorrowers = await database
                .get<Borrower>('borrowers')
                .query(Q.where('deleted_at', null))
                .fetch();

            const borrowers = allBorrowers.filter(b => {
                const s = ((b as any).membershipStatus || 'active').toString().toLowerCase();
                return s === 'active';
            });

            const memberRows: any[] = [];
            let totalPaidUp = 0;
            let totalSubscribedAmount = 0;
            let totalShares = 0;

            for (const b of borrowers) {
                const bal = await ShareCapitalService.getCurrentBalance(b.id);
                const history = await ShareCapitalService.getHistory(b.id);
                const subscribedShares = history.filter(t => t.transactionType === 'SUBSCRIPTION')
                    .reduce((s, t) => s + (t.numberOfShares ?? 0), 0);
                const subscribedAmount = subscribedShares * PAR_VALUE;

                totalPaidUp += bal.amount;
                totalSubscribedAmount += subscribedAmount;
                totalShares += bal.shares;

                memberRows.push({
                    id: b.id,
                    name: b.fullName,
                    membershipNumber: (b as any).membershipNumber ?? '—',
                    paidUpShares: bal.shares,
                    paidUpAmount: bal.amount,
                    subscribedShares,
                    subscribedAmount,
                    unsubscribedAmount: subscribedAmount - bal.amount,
                    completionPct: subscribedAmount > 0 ? (bal.amount / subscribedAmount) * 100 : 0,
                });
            }

            memberRows.sort((a, b) => b.paidUpAmount - a.paidUpAmount);
            setRows(memberRows);
            setFilteredRows(memberRows);

            setSummary({
                totalMembers: memberRows.length,
                totalPaidUp,
                totalSubscribed: totalSubscribedAmount,
                totalShares,
                avgPerMember: memberRows.length > 0 ? totalPaidUp / memberRows.length : 0,
            });

            // Recent transactions across all members
            const allTx = await database
                .get<ShareCapitalTransaction>('share_capital_transactions')
                .query(Q.where('deleted_at', null), Q.sortBy('date', Q.desc), Q.take(20))
                .fetch();

            const txWithNames = await Promise.all(allTx.map(async tx => {
                let name = 'Unknown';
                try {
                    const b = await database.get<Borrower>('borrowers').find(tx.memberId);
                    if (b) name = b.fullName;
                } catch {
                    name = 'Unknown';
                }
                return {
                    id: tx.id,
                    memberName: name,
                    transactionType: tx.transactionType,
                    transactionDate: tx.transactionDate || tx.createdAt,
                    amount: tx.amount,
                };
            }));

            setRecentTx(txWithNames);
        } catch (e) {
            console.error('Share Capital Report error:', e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, []));
    const onRefresh = async () => { setRefreshing(true); setSearch(''); await loadData(); setRefreshing(false); };

    const handleSearch = (text: string) => {
        setSearch(text);
        const q = text.toLowerCase();
        setFilteredRows(q ? rows.filter(r => r.name.toLowerCase().includes(q) || r.membershipNumber.toLowerCase().includes(q)) : rows);
    };

    if (loading && !refreshing) {
        return <View className="flex-1 justify-center items-center bg-gray-50"><ActivityIndicator size="large" color="#1E3A8A" /></View>;
    }

    const unsubscribedTotal = summary.totalSubscribed - summary.totalPaidUp;
    const overallPct = summary.totalSubscribed > 0 ? (summary.totalPaidUp / summary.totalSubscribed) * 100 : 0;

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Hero */}
            <Animated.View entering={FadeInDown.springify()}>
                <View className="bg-blue-900 pt-16 pb-8 px-6 rounded-b-[40px] shadow-xl" style={{ backgroundColor: '#1E3A8A' }}>
                    <Pressable testID="back-button" data-testid="back-button" onPress={() => router.back()} className="bg-white/10 p-2.5 rounded-full self-start mb-4 active:bg-white/20">
                        <MaterialIcons name="arrow-back" size={22} color="#FFFFFF" />
                    </Pressable>
                    <Text className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">Share Capital Portfolio (Tap for details)</Text>
                    <Pressable onPress={handleTotalPaidUpClick} className="active:opacity-80">
                        <Text className="text-white text-4xl font-black">{formatPHP(summary.totalPaidUp)}</Text>
                        <Text className="text-blue-100 text-xs mt-1 font-semibold">Total Paid-Up Capital</Text>
                    </Pressable>

                    {/* Progress bar */}
                    <View className="mt-4">
                        <View className="flex-row justify-between mb-1">
                            <Text className="text-blue-200 text-[9px] uppercase font-bold">Collection Progress</Text>
                            <Text className="text-white font-bold text-[10px]">{overallPct.toFixed(1)}%</Text>
                        </View>
                        <View className="h-2 bg-white/20 rounded-full overflow-hidden">
                            <View className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(overallPct, 100)}%` }} />
                        </View>
                        <Text className="text-blue-300 text-[9px] mt-1 font-semibold">
                            {formatPHP(summary.totalPaidUp)} collected of {formatPHP(summary.totalSubscribed)} subscribed
                        </Text>
                    </View>

                    <View className="flex-row mt-5 gap-3">
                        <View className="flex-1 bg-blue-800/50 p-3 rounded-2xl border border-blue-700/30">
                            <Text className="text-blue-200 text-[9px] uppercase font-bold">Members</Text>
                            <Text className="text-white text-lg font-black">{summary.totalMembers}</Text>
                        </View>
                        <View className="flex-1 bg-blue-800/50 p-3 rounded-2xl border border-blue-700/30">
                            <Text className="text-blue-200 text-[9px] uppercase font-bold">Total Shares</Text>
                            <Text className="text-white text-lg font-black">{summary.totalShares.toLocaleString()}</Text>
                        </View>
                        <View className="flex-1 bg-blue-800/50 p-3 rounded-2xl border border-blue-700/30">
                            <Text className="text-blue-200 text-[9px] uppercase font-bold">Still Owed</Text>
                            <Text className="text-yellow-400 text-sm font-black">{formatPHP(unsubscribedTotal)}</Text>
                        </View>
                    </View>
                </View>
            </Animated.View>

            {/* Search Box */}
            <View className="px-4 mt-4 mb-2">
                <View className="flex-row items-center bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                    <MaterialIcons name="search" size={20} color="#64748B" />
                    <TextInput
                        testID="search-input"
                        data-testid="search-input"
                        className="flex-1 ml-2 text-gray-900 text-sm font-semibold"
                        placeholder="Search members by name or no..."
                        placeholderTextColor="#64748B"
                        value={search}
                        onChangeText={handleSearch}
                    />
                    {search !== '' && (
                        <Pressable onPress={() => handleSearch('')} className="p-1">
                            <MaterialIcons name="close" size={18} color="#64748B" />
                        </Pressable>
                    )}
                </View>
            </View>

            <ScrollView
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Member Breakdown */}
                <View className="px-4 mt-4">
                    <View className="flex-row items-center justify-between mb-3">
                        <Text className="text-gray-900 font-black text-lg">Member Breakdown</Text>
                        <Text className="text-gray-500 text-xs font-bold">{filteredRows.length} members</Text>
                    </View>

                    {filteredRows.length === 0 ? (
                        <View className="items-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
                            <MaterialIcons name="account-balance" size={48} color="#9CA3AF" />
                            <Text className="text-gray-500 mt-3 font-bold">No members found</Text>
                        </View>
                    ) : (
                        filteredRows.map((r, idx) => (
                            <Animated.View
                                key={r.id}
                                entering={FadeInRight.delay(idx * 30).springify()}
                                className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm"
                            >
                                <View className="flex-row justify-between mb-1">
                                    <Text className="text-gray-900 font-bold text-sm flex-1 mr-2" numberOfLines={1}>{r.name}</Text>
                                    <Text className="text-blue-900 font-black text-sm">{formatPHP(r.paidUpAmount)}</Text>
                                </View>
                                <Text className="text-gray-500 text-[10px] font-bold mb-2">{r.membershipNumber}</Text>
                                <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                                    <View className="h-full rounded-full" style={{ width: `${Math.min(r.completionPct, 100)}%`, backgroundColor: r.completionPct >= 100 ? '#16A34A' : '#1E3A8A' }} />
                                </View>
                                <View className="flex-row justify-between">
                                    <Text className="text-gray-500 text-[9px]">{r.paidUpShares} paid / {r.subscribedShares} subscribed shares</Text>
                                    <Text className="text-gray-600 text-[9px] font-bold">{r.completionPct.toFixed(0)}%</Text>
                                </View>
                            </Animated.View>
                        ))
                    )}
                </View>

                {/* Recent Activity */}
                {recentTx.length > 0 && search === '' && (
                    <View className="px-4 mt-4">
                        <Text className="text-gray-900 font-black text-lg mb-3">Recent Transactions</Text>
                        <View className="bg-white rounded-[30px] border border-gray-100 shadow-sm overflow-hidden">
                            {recentTx.map((tx: any, idx) => (
                                <View key={tx.id} className={`flex-row items-center p-4 ${idx < recentTx.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                    <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${tx.transactionType === 'DEPOSIT' ? 'bg-green-50' : 'bg-blue-50'}`}>
                                        <MaterialIcons name={tx.transactionType === 'DEPOSIT' ? 'add' : 'assignment'} size={18} color={tx.transactionType === 'DEPOSIT' ? '#16A34A' : '#1E3A8A'} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-gray-900 font-bold text-xs" numberOfLines={1}>{tx.memberName}</Text>
                                        <Text className="text-gray-500 text-[9px]">{tx.transactionType} — {formatDate(tx.transactionDate)}</Text>
                                    </View>
                                    <Text className="text-green-700 font-black text-sm">{formatPHP(tx.amount)}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
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
