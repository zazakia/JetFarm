import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { Stack , useFocusEffect } from 'expo-router';

import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import Borrower from '../../../src/database/models/Borrower';
import { ShareCapitalService } from '../../../src/services/ShareCapitalService';
import { formatPHP } from '../../../src/utils/currency';
import { format } from 'date-fns';

interface MemberRecord {
    id: string;
    name: string;
    membershipNumber: string;
    membershipType: string;
    membershipStatus: string;
    dateJoined: number | null;
    dateAccepted: number | null;
    pmesCompleted: boolean;
    paidUpAmount: number;
    paidUpShares: number;
    subscribedShares: number;
    isFullySubscribed: boolean;
}

const STATUS_COLORS: Record<string, string> = {
    active: '#16A34A',
    inactive: '#9CA3AF',
    expelled: '#DC2626',
    resigned: '#F59E0B',
    suspended: '#EA580C',
};

export default function MembershipRegistryScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [members, setMembers] = useState<MemberRecord[]>([]);
    const [filtered, setFiltered] = useState<MemberRecord[]>([]);
    const [search, setSearch] = useState('');
    const [summary, setSummary] = useState({ total: 0, regular: 0, associate: 0, pmesDone: 0 });

    const loadData = async () => {
        setLoading(true);
        try {
            const borrowers = await database
                .get<Borrower>('borrowers')
                .query(Q.where('deleted_at', null))
                .fetch();

            const rows: MemberRecord[] = [];

            for (const b of borrowers) {
                const balance = await ShareCapitalService.getCurrentBalance(b.id);
                const history = await ShareCapitalService.getHistory(b.id);
                const subscribedShares = history
                    .filter(t => t.transactionType === 'SUBSCRIPTION')
                    .reduce((s, t) => s + (t.numberOfShares ?? 0), 0);

                rows.push({
                    id: b.id,
                    name: b.fullName,
                    membershipNumber: (b as any).membershipNumber ?? '',
                    membershipType: (b as any).membershipType ?? 'associate',
                    membershipStatus: (b as any).membershipStatus ?? 'active',
                    dateJoined: (b as any).dateJoined ?? null,
                    dateAccepted: (b as any).dateAccepted ?? null,
                    pmesCompleted: (b as any).pmesCompleted ?? false,
                    paidUpAmount: balance.amount,
                    paidUpShares: balance.shares,
                    subscribedShares,
                    isFullySubscribed: subscribedShares >= 20 && balance.shares >= 5,
                });
            }

            rows.sort((a, b) => (a.membershipNumber || 'zzz').localeCompare(b.membershipNumber || 'zzz'));
            setMembers(rows);
            setFiltered(rows);

            setSummary({
                total: rows.length,
                regular: rows.filter(r => r.membershipType === 'regular').length,
                associate: rows.filter(r => r.membershipType === 'associate').length,
                pmesDone: rows.filter(r => r.pmesCompleted).length,
            });
        } catch (e) {
            console.error('Membership Registry error:', e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, []));

    const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

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

            {/* Hero */}
            <Animated.View entering={FadeInDown.springify()}>
                <View className="bg-blue-900 pt-24 pb-10 px-6 rounded-b-[40px] shadow-xl">
                <Text className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">Member Registry</Text>
                <Text className="text-white text-4xl font-black">{summary.total}</Text>
                <Text className="text-white/70 text-xs mt-1">Total Registered Members</Text>

                <View className="flex-row mt-6 gap-3">
                    <View className="flex-1 bg-white/10 p-4 rounded-2xl">
                        <Text className="text-white/70 text-[9px] uppercase font-bold">Regular</Text>
                        <Text className="text-emerald-400 text-xl font-black">{summary.regular}</Text>
                    </View>
                    <View className="flex-1 bg-white/10 p-4 rounded-2xl">
                        <Text className="text-white/70 text-[9px] uppercase font-bold">Associate</Text>
                        <Text className="text-yellow-400 text-xl font-black">{summary.associate}</Text>
                    </View>
                    <View className="flex-1 bg-white/10 p-4 rounded-2xl">
                        <Text className="text-white/70 text-[9px] uppercase font-bold">PMES Done</Text>
                        <Text className="text-white text-xl font-black">{summary.pmesDone}</Text>
                    </View>
                </View>
                </View>
            </Animated.View>

            {/* Search */}
            <View className="mx-4 mt-4 mb-2">
                <View className="flex-row items-center bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                    <MaterialIcons name="search" size={20} color="#9CA3AF" />
                    <TextInput
                        className="flex-1 ml-2 text-gray-900 text-sm"
                        placeholder="Search by name or member no..."
                        placeholderTextColor="#9CA3AF"
                        value={search}
                        onChangeText={handleSearch}
                    />
                </View>
            </View>

            <ScrollView
                className="flex-1 px-4"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                <Text className="text-gray-500 text-xs font-medium mb-3">{filtered.length} members</Text>

                {filtered.map((m, idx) => (
                    <Animated.View
                        key={m.id}
                        entering={FadeInRight.delay(idx * 30).springify()}
                        className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm"
                    >
                        <View className="flex-row items-start justify-between mb-2">
                            <View className="flex-1 mr-2">
                                <Text className="text-gray-900 font-bold text-sm" numberOfLines={1}>{m.name}</Text>
                                <Text className="text-gray-400 text-[10px]">{m.membershipNumber || 'No Member #'}</Text>
                            </View>
                            <View className="items-end gap-1">
                                <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: `${STATUS_COLORS[m.membershipStatus] ?? '#9CA3AF'}20` }}>
                                    <Text className="text-[9px] font-black uppercase" style={{ color: STATUS_COLORS[m.membershipStatus] ?? '#9CA3AF' }}>
                                        {m.membershipStatus}
                                    </Text>
                                </View>
                                <View className="bg-blue-50 px-2 py-0.5 rounded-full">
                                    <Text className="text-[9px] font-black text-blue-700 uppercase">{m.membershipType}</Text>
                                </View>
                            </View>
                        </View>

                        <View className="flex-row mt-1">
                            <View className="flex-1">
                                <Text className="text-gray-400 text-[9px] uppercase font-bold">Paid-Up Capital</Text>
                                <Text className="text-blue-900 font-black text-xs">{formatPHP(m.paidUpAmount)}</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="text-gray-400 text-[9px] uppercase font-bold">Shares</Text>
                                <Text className="text-gray-900 font-bold text-xs">{m.paidUpShares} / {m.subscribedShares}</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="text-gray-400 text-[9px] uppercase font-bold">PMES</Text>
                                <View className="flex-row items-center">
                                    <MaterialIcons name={m.pmesCompleted ? "check-circle" : "cancel"} size={14} color={m.pmesCompleted ? "#16A34A" : "#DC2626"} />
                                    <Text className="text-[10px] font-bold ml-1" style={{ color: m.pmesCompleted ? '#16A34A' : '#DC2626' }}>
                                        {m.pmesCompleted ? 'Done' : 'Pending'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {m.dateAccepted && (
                            <Text className="text-gray-300 text-[9px] mt-2">
                                Accepted: {format(m.dateAccepted, 'MMM d, yyyy')}
                            </Text>
                        )}
                    </Animated.View>
                ))}
            </ScrollView>
        </View>
    );
}
