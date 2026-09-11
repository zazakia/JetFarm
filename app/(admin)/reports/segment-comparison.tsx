import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { ConsolidationService } from '../../../src/services/ConsolidationService';
import { BusinessUnitService } from '../../../src/services/BusinessUnitService';
import { ChartOfAccountsServiceClass } from '../../../src/services/ChartOfAccountsService';
import { formatPHP } from '../../../src/utils/currency';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COMPANY_NAME_FULL } from '../../../src/constants/brand';
import { database } from '../../../src/database';

interface SegmentColumn {
    id: string; // 'coop-base', business unit slug, or 'consolidated'
    name: string;
    balances: Map<string, number>;
}

export default function SegmentComparisonScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [year, setYear] = useState(2025);
    const [columns, setColumns] = useState<SegmentColumn[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);

    const loadData = async () => {
        setLoading(true);
        try {
            const asOf = new Date(year, 11, 31, 23, 59, 59, 999);
            
            // 1. Fetch active business units
            const buList = await BusinessUnitService.getAll();
            const activeBus = buList.filter(bu => bu.isActive);

            // 2. Fetch Accounts list
            const coaService = new ChartOfAccountsServiceClass(database);
            const allAccounts = await coaService.getAll();
            // Sort by account code hierarchy
            allAccounts.sort((a, b) => a.code.localeCompare(b.code));
            setAccounts(allAccounts);

            // 3. Fetch balances for Cooperative Base, each Segment, and Consolidated
            const cols: SegmentColumn[] = [];

            // Column A: Cooperative Base
            const baseBalances = await ConsolidationService.getBalances(asOf, 'coop-base');
            cols.push({ id: 'coop-base', name: 'Coop Base', balances: baseBalances });

            // Columns B to N: Active segments
            for (const bu of activeBus) {
                const buBalances = await ConsolidationService.getBalances(asOf, bu.slug);
                cols.push({ id: bu.slug, name: bu.name, balances: buBalances });
            }

            // Column Total: Consolidated
            const totalBalances = await ConsolidationService.getBalances(asOf);
            cols.push({ id: 'consolidated', name: 'Consolidated', balances: totalBalances });

            setColumns(cols);
        } catch (error) {
            console.error('Failed to load Segment Comparison:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [year])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const formatAmount = (val: number) => {
        if (val < 0) return `(${formatPHP(Math.abs(val)).replace('PHP ', '')})`;
        if (val === 0) return '-';
        return formatPHP(val).replace('PHP ', '');
    };

    const renderHeader = () => (
        <View className="items-center bg-white p-6 border-b border-gray-150 mb-4 shadow-sm">
            <Text className="text-center font-black text-gray-900 tracking-wider text-xs uppercase">
                {COMPANY_NAME_FULL}
            </Text>
            <Text className="text-center text-[10px] text-gray-600 mt-0.5">
                Purok 2, CCT Village, Linao, Ormoc City
            </Text>
            <View className="h-px bg-gray-200 w-full my-3" />
            <Text className="font-bold text-gray-950 text-base uppercase tracking-widest text-center">
                Segment comparative statements
            </Text>
            <Text className="text-xs text-slate-500 mt-1 font-semibold">
                For the Fiscal Year Ended December 31, {year}
            </Text>
        </View>
    );

    // Compute net surplus (revenues - expenses) for each column
    const getColumnNetSurplus = (col: SegmentColumn) => {
        let net = 0;
        for (const acc of accounts) {
            const balance = col.balances.get(acc.code) ?? 0;
            if (acc.accountType === 'income') {
                net += balance;
            } else if (acc.accountType === 'expense') {
                net -= balance;
            }
        }
        return net;
    };

    if (loading && !refreshing && accounts.length === 0) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#0F172A" />
                <Text className="text-gray-500 font-medium text-xs mt-3">Aggregating segment reports...</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            {/* Top Toolbar */}
            <View className="flex-row justify-between items-center px-4 py-3 bg-white border-b border-gray-200">
                <View className="flex-row items-center">
                    <Pressable onPress={() => router.back()} className="p-2 mr-2 rounded-full active:bg-gray-150">
                        <MaterialIcons name="arrow-back" size={20} color="#334155" />
                    </Pressable>
                    <Text className="text-lg font-black text-gray-900">Segment Comparative</Text>
                </View>
                <View className="flex-row items-center">
                    <Pressable 
                        onPress={() => setYear(y => y - 1)}
                        className="p-2 bg-slate-100 rounded-lg active:bg-slate-200 mr-1"
                    >
                        <MaterialIcons name="chevron-left" size={18} color="#1E293B" />
                    </Pressable>
                    <Text className="font-black text-slate-800 px-2 text-sm">{year}</Text>
                    <Pressable 
                        onPress={() => setYear(y => y + 1)}
                        className="p-2 bg-slate-100 rounded-lg active:bg-slate-200 mr-2"
                    >
                        <MaterialIcons name="chevron-right" size={18} color="#1E293B" />
                    </Pressable>
                </View>
            </View>

            <ScrollView 
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {renderHeader()}

                <ScrollView horizontal showsHorizontalScrollIndicator={true} className="px-4">
                    <View className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {/* Table Header Row */}
                        <View className="flex-row bg-slate-100 border-b border-slate-200 py-3 items-center">
                            <Text className="w-20 font-bold text-slate-700 text-[10px] pl-3">CODE</Text>
                            <Text className="w-48 font-bold text-slate-700 text-[10px]">ACCOUNT NAME</Text>
                            {columns.map(col => (
                                <Text 
                                    key={col.id} 
                                    className={`w-28 text-right pr-4 font-bold text-[10px] ${
                                        col.id === 'consolidated' ? 'text-blue-900' : 'text-slate-700'
                                    }`}
                                >
                                    {col.name.toUpperCase()}
                                </Text>
                            ))}
                        </View>

                        {/* Accounts List Rows */}
                        {accounts.map(acc => {
                            // Only render rows that have a non-zero balance in at least one column
                            const hasBalance = columns.some(c => (c.balances.get(acc.code) ?? 0) !== 0);
                            if (!hasBalance) return null;

                            return (
                                <View key={acc.code} className="flex-row border-b border-gray-100 py-2.5 items-center">
                                    <Text className="w-20 text-gray-500 font-semibold text-[11px] pl-3">{acc.code}</Text>
                                    <Text className="w-48 text-gray-800 font-medium text-[11px] pr-2" numberOfLines={1}>
                                        {acc.name}
                                    </Text>
                                    {columns.map(col => {
                                        const val = col.balances.get(acc.code) ?? 0;
                                        return (
                                            <Text 
                                                key={col.id} 
                                                className={`w-28 text-right pr-4 text-[11px] font-medium ${
                                                    col.id === 'consolidated' ? 'text-gray-900 font-semibold' : 'text-gray-600'
                                                }`}
                                            >
                                                {formatAmount(val)}
                                            </Text>
                                        );
                                    })}
                                </View>
                            );
                        })}

                        {/* Net Surplus Summary Row */}
                        <View className="flex-row bg-blue-50/50 border-t border-b border-blue-100 py-3 items-center">
                            <Text className="w-20 pl-3"></Text>
                            <Text className="w-48 font-black text-blue-900 text-xs">NET SURPLUS / (DEFICIT)</Text>
                            {columns.map(col => {
                                const surplus = getColumnNetSurplus(col);
                                return (
                                    <Text 
                                        key={col.id} 
                                        className="w-28 text-right pr-4 font-black text-blue-900 text-xs"
                                    >
                                        {formatAmount(surplus)}
                                    </Text>
                                );
                            })}
                        </View>
                    </View>
                </ScrollView>
            </ScrollView>
        </View>
    );
}
