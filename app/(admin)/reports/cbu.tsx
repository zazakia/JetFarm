import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
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

interface MemberCBU {
    id: string;
    name: string;
    membershipNumber: string;
    paidUpShares: number;
    paidUpAmount: number;
    subscribedShares: number;
    lastContribution: number | null;
    membershipStatus: string;
}

export default function CBUReportScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [members, setMembers] = useState<MemberCBU[]>([]);
    const [filtered, setFiltered] = useState<MemberCBU[]>([]);
    const [search, setSearch] = useState('');
    const [summary, setSummary] = useState({ totalMembers: 0, totalShares: 0, totalCapital: 0, fullySubscribed: 0 });

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

            const rows: MemberCBU[] = [];

            for (const b of borrowers) {
                const balance = await ShareCapitalService.getCurrentBalance(b.id);
                const history = await ShareCapitalService.getHistory(b.id);
                const subscribed = history
                    .filter(t => t.transactionType === 'SUBSCRIPTION')
                    .reduce((s, t) => s + (t.numberOfShares ?? 0), 0);
                const lastTx = history.length > 0 ? history[0].transactionDate : null;

                rows.push({
                    id: b.id,
                    name: b.fullName,
                    membershipNumber: (b as any).membershipNumber ?? '—',
                    paidUpShares: balance.shares,
                    paidUpAmount: balance.amount,
                    subscribedShares: subscribed,
                    lastContribution: lastTx,
                    membershipStatus: (b as any).membershipStatus ?? 'active',
                });
            }

            rows.sort((a, b) => b.paidUpAmount - a.paidUpAmount);
            setMembers(rows);
            setFiltered(rows);

            const totalCapital = rows.reduce((s, r) => s + r.paidUpAmount, 0);
            const totalShares = rows.reduce((s, r) => s + r.paidUpShares, 0);
            const fullySubscribed = rows.filter(r => r.subscribedShares >= 20 && r.paidUpShares >= 5).length;

            setSummary({ totalMembers: rows.length, totalShares, totalCapital, fullySubscribed });
        } catch (e) {
            console.error('CBU Report error:', e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, []));

    const onRefresh = async () => { setRefreshing(true); setSearch(''); await loadData(); setRefreshing(false); };

    const handleSearch = (text: string) => {
        setSearch(text);
        const q = text.toLowerCase();
        setFiltered(q ? members.filter(m => m.name.toLowerCase().includes(q) || m.membershipNumber.toLowerCase().includes(q)) : members);
    };

    if (loading && !refreshing) {
        return <View className="flex-1 justify-center items-center bg-gray-50"><ActivityIndicator size="large" color="#1E3A8A" /></View>;
    }

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Hero Banner */}
            <Animated.View entering={FadeInDown.springify()}>
                <View className="bg-blue-900 pt-16 pb-8 px-6 rounded-b-[40px] shadow-xl" style={{ backgroundColor: '#1E3A8A' }}>
                    <Pressable testID="back-button" data-testid="back-button" onPress={() => router.back()} className="bg-white/10 p-2.5 rounded-full self-start mb-4 active:bg-white/20">
                        <MaterialIcons name="arrow-back" size={22} color="#FFFFFF" />
                    </Pressable>
                    <Text className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">Capital Build-Up</Text>
                    <Text className="text-white text-4xl font-black">{formatPHP(summary.totalCapital)}</Text>
                    <Text className="text-blue-100 text-xs mt-1 font-semibold">Total Paid-Up Capital — {summary.totalMembers} members</Text>

                    <View className="flex-row mt-6 gap-3">
                        <View className="flex-1 bg-blue-800/50 p-4 rounded-2xl border border-blue-700/30">
                            <Text className="text-blue-200 text-[9px] uppercase font-bold">Total Shares</Text>
                            <Text className="text-white text-lg font-black">{summary.totalShares.toLocaleString()}</Text>
                        </View>
                        <View className="flex-1 bg-blue-800/50 p-4 rounded-2xl border border-blue-700/30">
                            <Text className="text-blue-200 text-[9px] uppercase font-bold">Fully Subscribed</Text>
                            <Text className="text-emerald-400 text-lg font-black">{summary.fullySubscribed}</Text>
                        </View>
                        <View className="flex-1 bg-blue-800/50 p-4 rounded-2xl border border-blue-700/30">
                            <Text className="text-blue-200 text-[9px] uppercase font-bold">Active Members</Text>
                            <Text className="text-white text-lg font-black">{summary.totalMembers}</Text>
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
                className="flex-1 px-4"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                <View className="flex-row items-center justify-between mb-3 mt-4">
                    <Text className="text-gray-900 font-black text-lg">Member CBU Ledger</Text>
                    <Text className="text-gray-500 text-xs font-bold">{filtered.length} members</Text>
                </View>

                {filtered.length === 0 ? (
                    <View className="items-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <MaterialIcons name="account-balance" size={48} color="#9CA3AF" />
                        <Text className="text-gray-500 mt-3 font-bold">No members found</Text>
                    </View>
                ) : filtered.map((m, idx) => (
                        <Animated.View
                            key={m.id}
                            entering={FadeInRight.delay(idx * 40).springify()}
                            className="bg-white rounded-2xl mb-3 border border-gray-100 shadow-sm overflow-hidden"
                        >
                            <Pressable
                                onPress={() => router.push(`/(admin)/borrowers/${m.id}/share-capital`)}
                                className="p-4 active:bg-gray-50"
                            >
                                <View className="flex-row items-start justify-between mb-2">
                                    <View className="flex-1 mr-2">
                                        <Text className="text-gray-900 font-bold text-sm" numberOfLines={1}>{m.name}</Text>
                                        <Text className="text-gray-500 text-[10px] font-bold mt-0.5">{m.membershipNumber}</Text>
                                    </View>
                                    <View className="flex-row items-center gap-2">
                                        <View className="bg-blue-50 px-3 py-1 rounded-full">
                                            <Text className="text-blue-900 font-black text-sm">{formatPHP(m.paidUpAmount)}</Text>
                                        </View>
                                        <MaterialIcons name="chevron-right" size={18} color="#9CA3AF" />
                                    </View>
                                </View>

                                <View className="flex-row mt-1">
                                    <View className="flex-1">
                                        <Text className="text-gray-500 text-[9px] uppercase font-bold">Paid-Up Shares</Text>
                                        <Text className="text-gray-950 font-bold text-xs">{m.paidUpShares} shares</Text>
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-gray-500 text-[9px] uppercase font-bold">Subscribed</Text>
                                        <Text className="text-gray-950 font-bold text-xs">{m.subscribedShares} / 20 shares</Text>
                                    </View>
                                    <View className="flex-1 items-end">
                                        <Text className="text-gray-500 text-[9px] uppercase font-bold">Last Payment</Text>
                                        <Text className="text-gray-800 font-bold text-[10px]">
                                            {m.lastContribution ? formatDate(m.lastContribution) : '—'}
                                        </Text>
                                    </View>
                                </View>

                                {/* Subscription progress bar */}
                                <View className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <View
                                        className="h-full bg-blue-900 rounded-full"
                                        style={{ width: `${Math.min((m.subscribedShares / 20) * 100, 100)}%` }}
                                    />
                                </View>
                            </Pressable>
                        </Animated.View>
                    ))
                }

            </ScrollView>
        </View>
    );
}
