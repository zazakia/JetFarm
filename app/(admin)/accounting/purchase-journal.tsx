import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { PurchaseJournalService, PJSummary, PJRow } from '../../../src/services/PurchaseJournalService';
import { formatPHP } from '../../../src/utils/currency';

type PeriodFilter = 'this_month' | 'last_month' | 'ytd';

export default function PurchaseJournal() {
    const [period, setPeriod] = useState<PeriodFilter>('this_month');
    const [selectedModule, setSelectedModule] = useState<string>('all');
    const [summary, setSummary] = useState<PJSummary | null>(null);
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
            const data = await PurchaseJournalService.getReport(
                start,
                end,
                selectedModule === 'all' ? undefined : selectedModule
            );
            setSummary(data);
        } catch (err) {
            console.error('Failed to load Purchase Journal:', err);
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
                        <Text className="text-gray-900 font-black text-xl">Purchase Journal (PJ)</Text>
                        <Text className="text-gray-600 text-xs font-medium">Credit Purchases & Accounts Payable Incurred</Text>
                    </View>
                    <View className="bg-cyan-100 px-3 py-1 rounded-full">
                        <Text className="text-cyan-900 text-[10px] font-bold uppercase">PJ Register</Text>
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
                            { id: 'pharmacy', label: 'Pharmacy' },
                            { id: 'water-station', label: 'Water Station' },
                        ].map(m => (
                            <Pressable
                                key={m.id}
                                onPress={() => setSelectedModule(m.id)}
                                className={`px-3 py-1.5 rounded-xl mr-2 border ${
                                    selectedModule === m.id
                                        ? 'bg-cyan-900 border-cyan-900'
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
                    <Text className="text-gray-600 text-xs font-bold mt-2">Computing Purchase Journal...</Text>
                </View>
            ) : (
                <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
                    {/* Summary Cards */}
                    <View className="flex-row justify-between mb-4">
                        <View className="w-[31%] bg-cyan-900 p-4 rounded-3xl shadow-sm">
                            <Text className="text-cyan-200 text-[9px] font-bold uppercase tracking-wider mb-1">
                                Total AP Credit
                            </Text>
                            <Text className="text-white font-black text-lg">
                                {formatPHP(summary?.totalAPCredit ?? 0)}
                            </Text>
                        </View>
                        <View className="w-[31%] bg-teal-900 p-4 rounded-3xl shadow-sm">
                            <Text className="text-teal-200 text-[9px] font-bold uppercase tracking-wider mb-1">
                                Inventory DR (12xx)
                            </Text>
                            <Text className="text-white font-black text-lg">
                                {formatPHP(summary?.totalInventoryDebit ?? 0)}
                            </Text>
                        </View>
                        <View className="w-[31%] bg-gray-800 p-4 rounded-3xl shadow-sm">
                            <Text className="text-gray-300 text-[9px] font-bold uppercase tracking-wider mb-1">
                                Expense DR (5xxx)
                            </Text>
                            <Text className="text-white font-black text-lg">
                                {formatPHP(summary?.totalExpenseDebit ?? 0)}
                            </Text>
                        </View>
                    </View>

                    {/* Columnar Table */}
                    <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-8">
                        <View className="p-4 border-b border-gray-100">
                            <Text className="text-gray-900 font-bold text-sm">Credit Purchases Register</Text>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View>
                                {/* Header */}
                                <View className="flex-row bg-gray-50 p-3 border-b border-gray-100">
                                    <View style={{ width: 80 }}><Text className="text-gray-600 text-[10px] font-bold uppercase">Date</Text></View>
                                    <View style={{ width: 120 }}><Text className="text-gray-600 text-[10px] font-bold uppercase">Voucher No.</Text></View>
                                    <View style={{ width: 140 }}><Text className="text-gray-600 text-[10px] font-bold uppercase">Supplier</Text></View>
                                    <View style={{ width: 110 }}><Text className="text-gray-600 text-[10px] font-bold uppercase">Invoice#</Text></View>
                                    <View style={{ width: 100 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Inventory DR</Text></View>
                                    <View style={{ width: 100 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Expense DR</Text></View>
                                    <View style={{ width: 110 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">AP Credit</Text></View>
                                    <View style={{ width: 80 }} className="items-center"><Text className="text-gray-600 text-[10px] font-bold uppercase">Status</Text></View>
                                </View>

                                {/* Rows */}
                                {(!summary?.rows || summary.rows.length === 0) ? (
                                    <View className="p-8 items-center justify-center">
                                        <Text className="text-gray-600 text-xs font-bold">No purchase entries recorded in this period.</Text>
                                    </View>
                                ) : (
                                    summary.rows.map((row: PJRow, idx: number) => (
                                        <View key={idx} className="flex-row p-3 border-b border-gray-50 items-center">
                                            <View style={{ width: 80 }}>
                                                <Text className="text-gray-700 text-xs font-medium">
                                                    {format(new Date(row.date), 'MM/dd/yy')}
                                                </Text>
                                            </View>
                                            <View style={{ width: 120 }}>
                                                <Text className="text-gray-900 font-bold text-xs">{row.voucherNumber}</Text>
                                            </View>
                                            <View style={{ width: 140 }} className="pr-2">
                                                <Text className="text-gray-900 font-bold text-xs" numberOfLines={1}>{row.supplierName}</Text>
                                            </View>
                                            <View style={{ width: 110 }}>
                                                <Text className="text-gray-600 text-xs">{row.invoiceNumber || '—'}</Text>
                                            </View>
                                            <View style={{ width: 100 }} className="items-end">
                                                <Text className="text-teal-700 font-bold text-xs">
                                                    {row.inventoryDebit > 0 ? formatPHP(row.inventoryDebit) : '—'}
                                                </Text>
                                            </View>
                                            <View style={{ width: 100 }} className="items-end">
                                                <Text className="text-gray-900 text-xs">
                                                    {row.expenseDebit > 0 ? formatPHP(row.expenseDebit) : '—'}
                                                </Text>
                                            </View>
                                            <View style={{ width: 110 }} className="items-end">
                                                <Text className="text-cyan-700 font-black text-xs">{formatPHP(row.apCredit)}</Text>
                                            </View>
                                            <View style={{ width: 80 }} className="items-center">
                                                <View className={`px-2 py-0.5 rounded-full ${
                                                    row.status === 'paid' ? 'bg-emerald-100' : row.status === 'partial' ? 'bg-amber-100' : 'bg-blue-100'
                                                }`}>
                                                    <Text className={`text-[8px] font-bold uppercase ${
                                                        row.status === 'paid' ? 'text-emerald-800' : row.status === 'partial' ? 'text-amber-800' : 'text-blue-900'
                                                    }`}>
                                                        {row.status}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    ))
                                )}

                                {/* Totals Row */}
                                {summary && summary.rows.length > 0 && (
                                    <View className="flex-row bg-cyan-50 p-3 items-center border-t border-cyan-100">
                                        <View style={{ width: 450 }}>
                                            <Text className="text-cyan-950 font-black text-xs uppercase">Totals</Text>
                                        </View>
                                        <View style={{ width: 100 }} className="items-end">
                                            <Text className="text-teal-950 font-black text-xs">{formatPHP(summary.totalInventoryDebit)}</Text>
                                        </View>
                                        <View style={{ width: 100 }} className="items-end">
                                            <Text className="text-gray-950 font-black text-xs">{formatPHP(summary.totalExpenseDebit)}</Text>
                                        </View>
                                        <View style={{ width: 110 }} className="items-end">
                                            <Text className="text-cyan-950 font-black text-xs">{formatPHP(summary.totalAPCredit)}</Text>
                                        </View>
                                        <View style={{ width: 80 }} />
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
