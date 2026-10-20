import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { SalesJournalService, SJSummary, SJRow } from '../../../src/services/SalesJournalService';
import { formatPHP } from '../../../src/utils/currency';

type PeriodFilter = 'this_month' | 'last_month' | 'ytd';

export default function SalesJournal() {
    const [period, setPeriod] = useState<PeriodFilter>('this_month');
    const [selectedModule, setSelectedModule] = useState<string>('all');
    const [summary, setSummary] = useState<SJSummary | null>(null);
    const [loading, setLoading] = useState(false);

    const getDateRange = (p: PeriodFilter): { start: Date; end: Date } => {
        const now = new Date();
        if (p === 'this_month') {
            return { start: startOfMonth(now), end: endOfMonth(now) };
        } else if (p === 'last_month') {
            const prev = subMonths(now, 1);
            return { start: startOfMonth(prev), end: endOfMonth(prev) };
        } else {
            return { start: startOfYear(now), end: endOfMonth(now) };
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const { start, end } = getDateRange(period);
            const data = await SalesJournalService.getReport(
                start,
                end,
                selectedModule === 'all' ? undefined : selectedModule
            );
            setSummary(data);
        } catch (err) {
            console.error('Failed to load Sales Journal:', err);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [period, selectedModule])
    );

    return (
        <View className="flex-1 bg-gray-50">
            {/* Header & Filter Bar */}
            <View className="bg-white border-b border-gray-100 p-4">
                <View className="flex-row justify-between items-center mb-3">
                    <View>
                        <Text className="text-gray-900 font-black text-xl">Sales Journal (SJ)</Text>
                        <Text className="text-gray-600 text-xs font-medium">Credit Sales on Account Register</Text>
                    </View>
                    <View className="bg-indigo-100 px-3 py-1 rounded-full">
                        <Text className="text-indigo-900 text-[10px] font-bold uppercase">SJ Register</Text>
                    </View>
                </View>

                {/* Period Selectors */}
                <View className="flex-row mb-3">
                    {[
                        { id: 'this_month', label: 'This Month' },
                        { id: 'last_month', label: 'Last Month' },
                        { id: 'ytd', label: 'Year to Date' },
                    ].map(btn => (
                        <Pressable
                            key={btn.id}
                            onPress={() => setPeriod(btn.id as PeriodFilter)}
                            className={`px-4 py-2 rounded-full mr-2 border ${
                                period === btn.id
                                    ? 'bg-blue-900 border-blue-900'
                                    : 'bg-gray-50 border-gray-200'
                            }`}
                        >
                            <Text className={`text-xs font-bold ${
                                period === btn.id ? 'text-white' : 'text-gray-700'
                            }`}>
                                {btn.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {/* Module Filter Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row">
                        {[
                            { id: 'all', label: 'All Units' },
                            { id: 'agri-store', label: 'Agri-Store' },
                        ].map(m => (
                            <Pressable
                                key={m.id}
                                onPress={() => setSelectedModule(m.id)}
                                className={`px-3 py-1.5 rounded-xl mr-2 border ${
                                    selectedModule === m.id
                                        ? 'bg-indigo-900 border-indigo-900'
                                        : 'bg-gray-50 border-gray-200'
                                }`}
                            >
                                <Text className={`text-xs font-bold ${
                                    selectedModule === m.id ? 'text-white' : 'text-gray-700'
                                }`}>
                                    {m.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#1E3A8A" />
                    <Text className="text-gray-600 text-xs font-bold mt-2">Computing Sales Register...</Text>
                </View>
            ) : (
                <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
                    {/* Summary Cards */}
                    <View className="flex-row justify-between mb-4">
                        <View className="w-[48%] bg-indigo-900 p-5 rounded-3xl shadow-sm">
                            <Text className="text-indigo-200 text-[10px] font-bold uppercase tracking-wider mb-1">
                                Total Sales Revenue (Cr 4xxx)
                            </Text>
                            <Text className="text-white font-black text-2xl">
                                {formatPHP(summary?.totalSalesCredit ?? 0)}
                            </Text>
                        </View>
                        <View className="w-[48%] bg-blue-900 p-5 rounded-3xl shadow-sm">
                            <Text className="text-blue-200 text-[10px] font-bold uppercase tracking-wider mb-1">
                                Total AR Charged (Dr 1xxx)
                            </Text>
                            <Text className="text-white font-black text-2xl">
                                {formatPHP(summary?.totalARDebit ?? 0)}
                            </Text>
                        </View>
                    </View>

                    {/* Columnar Table */}
                    <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-8">
                        <View className="p-4 border-b border-gray-100">
                            <Text className="text-gray-900 font-bold text-sm">Credit Sales Register</Text>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View>
                                {/* Header */}
                                <View className="flex-row bg-gray-50 p-3 border-b border-gray-100">
                                    <View style={{ width: 80 }}><Text className="text-gray-600 text-[10px] font-bold uppercase">Date</Text></View>
                                    <View style={{ width: 130 }}><Text className="text-gray-600 text-[10px] font-bold uppercase">Invoice / Ref#</Text></View>
                                    <View style={{ width: 180 }}><Text className="text-gray-600 text-[10px] font-bold uppercase">Particulars</Text></View>
                                    <View style={{ width: 100 }}><Text className="text-gray-600 text-[10px] font-bold uppercase">Unit</Text></View>
                                    <View style={{ width: 110 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">AR Debit</Text></View>
                                    <View style={{ width: 110 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Sales Credit</Text></View>
                                </View>

                                {/* Rows */}
                                {(!summary?.rows || summary.rows.length === 0) ? (
                                    <View className="p-8 items-center justify-center">
                                        <Text className="text-gray-600 text-xs font-bold">No credit sales recorded in this period.</Text>
                                    </View>
                                ) : (
                                    summary.rows.map((row: SJRow, idx: number) => (
                                        <View key={idx} className="flex-row p-3 border-b border-gray-50 items-center">
                                            <View style={{ width: 80 }}>
                                                <Text className="text-gray-700 text-xs font-medium">
                                                    {format(new Date(row.date), 'MM/dd/yy')}
                                                </Text>
                                            </View>
                                            <View style={{ width: 130 }}>
                                                <Text className="text-gray-900 font-bold text-xs">{row.referenceNumber}</Text>
                                            </View>
                                            <View style={{ width: 180 }} className="pr-2">
                                                <Text className="text-gray-700 text-xs" numberOfLines={1}>{row.description}</Text>
                                            </View>
                                            <View style={{ width: 100 }}>
                                                <Text className="text-gray-600 text-xs uppercase">{row.moduleId || row.sourceType}</Text>
                                            </View>
                                            <View style={{ width: 110 }} className="items-end">
                                                <Text className="text-blue-900 font-bold text-xs">{formatPHP(row.arDebit)}</Text>
                                            </View>
                                            <View style={{ width: 110 }} className="items-end">
                                                <Text className="text-indigo-700 font-black text-xs">{formatPHP(row.salesCredit)}</Text>
                                            </View>
                                        </View>
                                    ))
                                )}

                                {/* Totals Row */}
                                {summary && summary.rows.length > 0 && (
                                    <View className="flex-row bg-indigo-50 p-3 items-center border-t border-indigo-100">
                                        <View style={{ width: 490 }}>
                                            <Text className="text-indigo-950 font-black text-xs uppercase">Totals</Text>
                                        </View>
                                        <View style={{ width: 110 }} className="items-end">
                                            <Text className="text-blue-950 font-black text-xs">{formatPHP(summary.totalARDebit)}</Text>
                                        </View>
                                        <View style={{ width: 110 }} className="items-end">
                                            <Text className="text-indigo-950 font-black text-xs">{formatPHP(summary.totalSalesCredit)}</Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </ScrollView>
                    </View>
                </ScrollView>
            )}
        </View>
    );
}
