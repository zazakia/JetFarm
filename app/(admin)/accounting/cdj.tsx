import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { CashDisbursementsJournalService, CDJSummary, CDJRow } from '../../../src/services/CashDisbursementsJournalService';
import { formatPHP } from '../../../src/utils/currency';

type PeriodFilter = 'this_month' | 'last_month' | 'ytd';

export default function CashDisbursementsJournal() {
    const [period, setPeriod] = useState<PeriodFilter>('this_month');
    const [summary, setSummary] = useState<CDJSummary | null>(null);
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
            const data = await CashDisbursementsJournalService.getReport(start, end);
            setSummary(data);
        } catch (err) {
            console.error('Failed to load CDJ data:', err);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [period])
    );

    return (
        <View className="flex-1 bg-gray-50">
            {/* Header & Filter Bar */}
            <View className="bg-white border-b border-gray-100 p-4">
                <View className="flex-row justify-between items-center mb-3">
                    <View>
                        <Text className="text-gray-900 font-black text-xl">Cash Disbursements Journal</Text>
                        <Text className="text-gray-600 text-xs font-medium">Book of Cash Outflows & Expense Vouchers</Text>
                    </View>
                    <View className="bg-red-100 px-3 py-1 rounded-full">
                        <Text className="text-red-800 text-[10px] font-bold uppercase">CDJ Register</Text>
                    </View>
                </View>

                {/* Period Selectors */}
                <View className="flex-row">
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
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#1E3A8A" />
                    <Text className="text-gray-600 text-xs font-bold mt-2">Computing Cash Disbursements...</Text>
                </View>
            ) : (
                <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
                    {/* Grand Total Disbursed Card */}
                    <View className="bg-red-900 p-6 rounded-3xl mb-4 shadow-sm">
                        <Text className="text-red-200 text-xs font-bold uppercase tracking-wider mb-1">
                            Total Cash &amp; Bank Disbursed
                        </Text>
                        <Text className="text-white font-black text-3xl">
                            {formatPHP(summary?.grandTotalCash ?? 0)}
                        </Text>
                        <Text className="text-red-300 text-[10px] mt-2">
                            {summary?.rows.length ?? 0} disbursement vouchers recorded in period
                        </Text>
                    </View>

                    {/* Breakdown Summary Grid */}
                    <View className="flex-row flex-wrap justify-between mb-4">
                        <View className="w-[48%] bg-white p-4 rounded-2xl border border-gray-100 mb-3">
                            <Text className="text-gray-600 text-[10px] font-bold uppercase">Settlements &amp; Wages</Text>
                            <Text className="text-gray-900 font-bold text-sm mt-1">{formatPHP(summary?.totalSettlementsAndWages ?? 0)}</Text>
                        </View>
                        <View className="w-[48%] bg-white p-4 rounded-2xl border border-gray-100 mb-3">
                            <Text className="text-gray-600 text-[10px] font-bold uppercase">Operating Expenses</Text>
                            <Text className="text-gray-900 font-bold text-sm mt-1">{formatPHP(summary?.totalOperatingExpenses ?? 0)}</Text>
                        </View>
                        <View className="w-[48%] bg-white p-4 rounded-2xl border border-gray-100 mb-3">
                            <Text className="text-gray-600 text-[10px] font-bold uppercase">Receivable Advances</Text>
                            <Text className="text-gray-900 font-bold text-sm mt-1">{formatPHP(summary?.totalReceivableAdvances ?? 0)}</Text>
                        </View>
                        <View className="w-[48%] bg-white p-4 rounded-2xl border border-gray-100 mb-3">
                            <Text className="text-gray-600 text-[10px] font-bold uppercase">Capital / Transfers / Other</Text>
                            <Text className="text-gray-900 font-bold text-sm mt-1">
                                {formatPHP((summary?.totalCapitalRefunds ?? 0) + (summary?.totalInternalTransfers ?? 0) + (summary?.totalOtherDisbursements ?? 0))}
                            </Text>
                        </View>
                    </View>

                    {/* Columnar Journal Table */}
                    <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-8">
                        <View className="p-4 border-b border-gray-100">
                            <Text className="text-gray-900 font-bold text-sm">Disbursement Registers</Text>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View>
                                {/* Table Header */}
                                <View className="flex-row bg-gray-50 p-3 border-b border-gray-100">
                                    <View style={{ width: 80 }}><Text className="text-gray-600 text-[10px] font-bold uppercase">Date</Text></View>
                                    <View style={{ width: 120 }}><Text className="text-gray-600 text-[10px] font-bold uppercase">Voucher No.</Text></View>
                                    <View style={{ width: 180 }}><Text className="text-gray-600 text-[10px] font-bold uppercase">Description</Text></View>
                                    <View style={{ width: 100 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Sett &amp; Wages</Text></View>
                                    <View style={{ width: 100 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Expenses</Text></View>
                                    <View style={{ width: 100 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Advances</Text></View>
                                    <View style={{ width: 90 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Other</Text></View>
                                    <View style={{ width: 110 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Cash Out</Text></View>
                                </View>

                                {/* Table Rows */}
                                {(!summary?.rows || summary.rows.length === 0) ? (
                                    <View className="p-8 items-center justify-center">
                                        <Text className="text-gray-600 text-xs font-bold">No disbursements in this period.</Text>
                                    </View>
                                ) : (
                                    summary.rows.map((row: CDJRow, idx: number) => (
                                        <View key={idx} className="flex-row p-3 border-b border-gray-50 items-center">
                                            <View style={{ width: 80 }}>
                                                <Text className="text-gray-700 text-xs font-medium">
                                                    {format(new Date(row.date), 'MM/dd/yy')}
                                                </Text>
                                            </View>
                                            <View style={{ width: 120 }}>
                                                <Text className="text-gray-900 font-bold text-xs">{row.referenceNumber}</Text>
                                            </View>
                                            <View style={{ width: 180 }} className="pr-2">
                                                <Text className="text-gray-700 text-xs" numberOfLines={1}>{row.description}</Text>
                                            </View>
                                            <View style={{ width: 100 }} className="items-end">
                                                <Text className="text-gray-900 text-xs">{row.settlementsAndWages > 0 ? formatPHP(row.settlementsAndWages) : '—'}</Text>
                                            </View>
                                            <View style={{ width: 100 }} className="items-end">
                                                <Text className="text-gray-900 text-xs">{row.operatingExpenses > 0 ? formatPHP(row.operatingExpenses) : '—'}</Text>
                                            </View>
                                            <View style={{ width: 100 }} className="items-end">
                                                <Text className="text-gray-900 text-xs">{row.receivableAdvances > 0 ? formatPHP(row.receivableAdvances) : '—'}</Text>
                                            </View>
                                            <View style={{ width: 90 }} className="items-end">
                                                <Text className="text-gray-900 text-xs">
                                                    {(row.capitalRefunds + row.internalTransfers + row.otherDisbursements) > 0
                                                        ? formatPHP(row.capitalRefunds + row.internalTransfers + row.otherDisbursements)
                                                        : '—'}
                                                </Text>
                                            </View>
                                            <View style={{ width: 110 }} className="items-end">
                                                <Text className="text-red-700 font-black text-xs">{formatPHP(row.totalCash)}</Text>
                                            </View>
                                        </View>
                                    ))
                                )}

                                {/* Totals Row */}
                                {summary && summary.rows.length > 0 && (
                                    <View className="flex-row bg-red-50 p-3 items-center border-t border-red-100">
                                        <View style={{ width: 380 }}>
                                            <Text className="text-red-950 font-black text-xs uppercase">Totals</Text>
                                        </View>
                                        <View style={{ width: 100 }} className="items-end">
                                            <Text className="text-red-950 font-black text-xs">{formatPHP(summary.totalSettlementsAndWages)}</Text>
                                        </View>
                                        <View style={{ width: 100 }} className="items-end">
                                            <Text className="text-red-950 font-black text-xs">{formatPHP(summary.totalOperatingExpenses)}</Text>
                                        </View>
                                        <View style={{ width: 100 }} className="items-end">
                                            <Text className="text-red-950 font-black text-xs">{formatPHP(summary.totalReceivableAdvances)}</Text>
                                        </View>
                                        <View style={{ width: 90 }} className="items-end">
                                            <Text className="text-red-950 font-black text-xs">
                                                {formatPHP(summary.totalCapitalRefunds + summary.totalInternalTransfers + summary.totalOtherDisbursements)}
                                            </Text>
                                        </View>
                                        <View style={{ width: 110 }} className="items-end">
                                            <Text className="text-red-700 font-black text-xs">{formatPHP(summary.grandTotalCash)}</Text>
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
