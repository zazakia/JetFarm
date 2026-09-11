import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useAuth } from '../../src/store/AuthContext';
import { BorrowerPortalService, BorrowerProfile } from '../../src/services/BorrowerPortalService';
import { MemberFinancialSummaryService, MemberLedgerSummary } from '../../src/services/MemberFinancialSummaryService';
import { formatPHP } from '../../src/utils/currency';

export default function BorrowerSavingsCbuScreen() {
    const { user } = useAuth();
    const [borrower, setBorrower] = useState<BorrowerProfile | null>(null);
    const [summary, setSummary] = useState<MemberLedgerSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadData = useCallback(async () => {
        if (!user) return;
        try {
            const profile = await BorrowerPortalService.getBorrowerProfile(user.id);
            setBorrower(profile);
            setSummary(profile ? await MemberFinancialSummaryService.getMemberSummary(profile.id) : null);
        } catch (error) {
            console.error('[BorrowerSavingsCbuScreen] Failed to load data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const [selectedYear, setSelectedYear] = useState<'all' | '2026' | '2025' | '2024'>('all');

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#1E3A8A" />
            </View>
        );
    }

    if (!borrower || !summary) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 p-6">
                <MaterialIcons name="account-circle" size={56} color="#D1D5DB" />
                <Text className="text-gray-900 font-black text-xl mt-3">No member ledger found</Text>
                <Text className="text-gray-600 text-center mt-1">Your borrower profile is not linked to savings or CBU records yet.</Text>
            </View>
        );
    }

    const filteredTransactions = summary.recentTransactions.filter(tx => {
        if (selectedYear === 'all') return true;
        const txYear = new Date(tx.date).getFullYear();
        return txYear === parseInt(selectedYear, 10);
    });

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={['#1E3A8A']} />}
        >
            <View className="mb-6">
                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Member ledger</Text>
                <Text className="text-gray-900 text-3xl font-black">{borrower.fullName}</Text>
            </View>

            <View className="bg-blue-900 rounded-3xl p-6 mb-5" style={{ backgroundColor: '#1E3A8A' }}>
                <Text className="text-blue-100 text-[10px] font-bold uppercase tracking-wider mb-2">Current savings balance</Text>
                <Text className="text-white text-4xl font-black">{formatPHP(summary.savingsBalance)}</Text>
                <View className="h-px bg-white/10 my-5" />
                <Text className="text-blue-100 text-[10px] font-bold uppercase tracking-wider mb-2">Current CBU / share capital</Text>
                <Text className="text-white text-3xl font-black">{formatPHP(summary.cbuBalance)}</Text>
            </View>

            <View className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
                <Text className="text-gray-900 font-black text-lg mb-4">2026 Activity</Text>
                <View className="flex-row flex-wrap justify-between">
                    <View className="w-[48%] mb-4">
                        <Text className="text-gray-500 text-[10px] font-bold uppercase">Savings In</Text>
                        <Text className="text-green-700 text-lg font-black">{formatPHP(summary.savings2026Deposits)}</Text>
                    </View>
                    <View className="w-[48%] mb-4">
                        <Text className="text-gray-500 text-[10px] font-bold uppercase">Savings Out</Text>
                        <Text className="text-red-700 text-lg font-black">{formatPHP(summary.savings2026Withdrawals)}</Text>
                    </View>
                    <View className="w-[48%]">
                        <Text className="text-gray-500 text-[10px] font-bold uppercase">CBU Contributions</Text>
                        <Text className="text-blue-900 text-lg font-black">{formatPHP(summary.cbu2026Contributions)}</Text>
                    </View>
                </View>
            </View>

            <View className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
                <Text className="text-gray-900 font-black text-lg mb-4">2025 Activity</Text>
                <View className="flex-row flex-wrap justify-between">
                    <View className="w-[48%] mb-4">
                        <Text className="text-gray-500 text-[10px] font-bold uppercase">Savings In</Text>
                        <Text className="text-green-700 text-lg font-black">{formatPHP(summary.savings2025Deposits)}</Text>
                    </View>
                    <View className="w-[48%] mb-4">
                        <Text className="text-gray-500 text-[10px] font-bold uppercase">Savings Out</Text>
                        <Text className="text-red-700 text-lg font-black">{formatPHP(summary.savings2025Withdrawals)}</Text>
                    </View>
                    <View className="w-[48%]">
                        <Text className="text-gray-500 text-[10px] font-bold uppercase">CBU Contributions</Text>
                        <Text className="text-blue-900 text-lg font-black">{formatPHP(summary.cbu2025Contributions)}</Text>
                    </View>
                </View>
            </View>

            <View className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
                <Text className="text-gray-900 font-black text-lg mb-4">2024 Starting Balances</Text>
                <View className="flex-row">
                    <View className="flex-1 pr-3">
                        <Text className="text-gray-500 text-[10px] font-bold uppercase">Savings</Text>
                        <Text className="text-green-700 text-xl font-black">{formatPHP(summary.savings2024Balance)}</Text>
                    </View>
                    <View className="flex-1 pl-3 border-l border-gray-100">
                        <Text className="text-gray-500 text-[10px] font-bold uppercase">CBU</Text>
                        <Text className="text-blue-900 text-xl font-black">{formatPHP(summary.cbu2024Balance)}</Text>
                    </View>
                </View>
            </View>

            <View className="flex-row mb-5 bg-slate-200/70 p-1 rounded-2xl">
                {(['all', '2026', '2025', '2024'] as const).map(y => (
                    <Pressable
                        key={y}
                        onPress={() => setSelectedYear(y)}
                        className={`flex-1 py-2.5 items-center rounded-xl ${selectedYear === y ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Text className={`text-xs font-black uppercase tracking-wider ${selectedYear === y ? 'text-blue-900' : 'text-slate-600'}`}>
                            {y === 'all' ? 'All Time' : y}
                        </Text>
                    </Pressable>
                ))}
            </View>

            <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <View className="p-5 border-b border-gray-100">
                    <Text className="text-gray-900 font-black text-lg">Ledger Transactions</Text>
                </View>
                {filteredTransactions.length === 0 ? (
                    <View className="p-8 items-center">
                        <MaterialIcons name="receipt-long" size={38} color="#D1D5DB" />
                        <Text className="text-gray-600 font-bold mt-2">No transactions found for this year.</Text>
                    </View>
                ) : filteredTransactions.map(tx => {
                    const sourceLabel = tx.source === 'savings' ? 'Savings' : 'CBU';
                    const typeLabel = tx.type
                        .split('_')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');
                    
                    return (
                        <View key={`${tx.source}-${tx.id}`} className="px-5 py-4 border-b border-gray-50 flex-row items-center">
                            <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${tx.source === 'savings' ? 'bg-green-50' : 'bg-blue-50'}`}>
                                <MaterialIcons name={tx.source === 'savings' ? 'savings' : 'pie-chart'} size={20} color={tx.source === 'savings' ? '#15803D' : '#1E3A8A'} />
                            </View>
                            <View className="flex-1">
                                <Text className="text-gray-900 font-bold text-xs">{sourceLabel} — {typeLabel}</Text>
                                <Text className="text-gray-400 text-[10px] mt-0.5">{format(new Date(tx.date), 'MMM d, yyyy')}</Text>
                            </View>
                            <Text className="text-gray-900 font-black text-sm">{formatPHP(tx.amount)}</Text>
                        </View>
                    );
                })}
            </View>
        </ScrollView>
    );
}
