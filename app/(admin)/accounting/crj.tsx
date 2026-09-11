import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { CashReceiptsJournalService, CRJSummary, CRJRow } from '../../../src/services/CashReceiptsJournalService';
import { formatPHP } from '../../../src/utils/currency';

type PeriodFilter = 'this_month' | 'last_month' | 'ytd';

export default function CashReceiptsJournal() {
    const [period, setPeriod] = useState<PeriodFilter>('this_month');
    const [summary, setSummary] = useState<CRJSummary | null>(null);
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
            const data = await CashReceiptsJournalService.getReport(start, end);
            setSummary(data);
        } catch (err) {
            console.error('Failed to load CRJ data:', err);
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
                        <Text className="text-gray-900 font-black text-xl">Cash Receipts Journal</Text>
                        <Text className="text-gray-600 text-xs font-medium">Book of Cash Inflows & Official Collections</Text>
                    </View>
                    <View className="bg-emerald-100 px-3 py-1 rounded-full">
                        <Text className="text-emerald-800 text-[10px] font-bold uppercase">CRJ Register</Text>
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
                    <Text className="text-gray-600 text-xs font-bold mt-2">Computing Cash Inflows...</Text>
                </View>
            ) : (
                <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
                    {/* Grand Total Highlight Card */}
                    <View className="bg-emerald-900 p-6 rounded-3xl mb-4 shadow-sm">
                        <Text className="text-emerald-200 text-xs font-bold uppercase tracking-wider mb-1">
                            Total Cash Collections (Dr 1010)
                        </Text>
                        <Text className="text-white font-black text-3xl">
                            {formatPHP(summary?.grandTotalCash ?? 0)}
                        </Text>
                        <Text className="text-emerald-300 text-[10px] mt-2">
                            {summary?.rows.length ?? 0} transaction receipts recorded in period
                        </Text>
                    </View>

                    {/* Breakdown Summary Grid */}
                    <View className="flex-row flex-wrap justify-between mb-4">
                        <View className="w-[48%] bg-white p-4 rounded-2xl border border-gray-100 mb-3">
                            <Text className="text-gray-600 text-[10px] font-bold uppercase">Loan Repayments</Text>
                            <Text className="text-gray-900 font-bold text-sm mt-1">{formatPHP(summary?.totalLoanRepayments ?? 0)}</Text>
                        </View>
                        <View className="w-[48%] bg-white p-4 rounded-2xl border border-gray-100 mb-3">
                            <Text className="text-gray-600 text-[10px] font-bold uppercase">Savings Deposits</Text>
                            <Text className="text-gray-900 font-bold text-sm mt-1">{formatPHP(summary?.totalSavingsDeposits ?? 0)}</Text>
                        </View>
                        <View className="w-[48%] bg-white p-4 rounded-2xl border border-gray-100 mb-3">
                            <Text className="text-gray-600 text-[10px] font-bold uppercase">Share Capital</Text>
                            <Text className="text-gray-900 font-bold text-sm mt-1">{formatPHP(summary?.totalShareCapital ?? 0)}</Text>
                        </View>
                        <View className="w-[48%] bg-white p-4 rounded-2xl border border-gray-100 mb-3">
                            <Text className="text-gray-600 text-[10px] font-bold uppercase">Service & Misc</Text>
                            <Text className="text-gray-900 font-bold text-sm mt-1">
                                {formatPHP((summary?.totalServiceCharges ?? 0) + (summary?.totalMembershipFees ?? 0) + (summary?.totalOtherReceipts ?? 0))}
                            </Text>
                        </View>
                    </View>

                    {/* Columnar Journal Table */}
                    <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-8">
                        <View className="p-4 border-b border-gray-100">
                            <Text className="text-gray-900 font-bold text-sm">Subsidiary Journal Entries</Text>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View>
                                {/* Table Header */}
                                <View className="flex-row bg-gray-50 p-3 border-b border-gray-100">
                                    <View style={{ width: 80 }}><Text className="text-gray-600 text-[10px] font-bold uppercase">Date</Text></View>
                                    <View style={{ width: 120 }}><Text className="text-gray-600 text-[10px] font-bold uppercase">Ref / OR No.</Text></View>
                                    <View style={{ width: 180 }}><Text className="text-gray-600 text-[10px] font-bold uppercase">Description</Text></View>
                                    <View style={{ width: 100 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Loan Rep.</Text></View>
                                    <View style={{ width: 100 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Savings</Text></View>
                                    <View style={{ width: 100 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Capital</Text></View>
                                    <View style={{ width: 90 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Fees/Other</Text></View>
                                    <View style={{ width: 110 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Cash (Dr 1010)</Text></View>
                                </View>

                                {/* Table Rows */}
                                {(!summary?.rows || summary.rows.length === 0) ? (
                                    <View className="p-8 items-center justify-center">
                                        <Text className="text-gray-600 text-xs font-bold">No cash receipts in this period.</Text>
                                    </View>
                                ) : (
                                    summary.rows.map((row: CRJRow, idx: number) => (
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
                                                <Text className="text-gray-900 text-xs">{row.loanRepayments > 0 ? formatPHP(row.loanRepayments) : '—'}</Text>
                                            </View>
                                            <View style={{ width: 100 }} className="items-end">
                                                <Text className="text-gray-900 text-xs">{row.savingsDeposits > 0 ? formatPHP(row.savingsDeposits) : '—'}</Text>
                                            </View>
                                            <View style={{ width: 100 }} className="items-end">
                                                <Text className="text-gray-900 text-xs">{row.shareCapital > 0 ? formatPHP(row.shareCapital) : '—'}</Text>
                                            </View>
                                            <View style={{ width: 90 }} className="items-end">
                                                <Text className="text-gray-900 text-xs">
                                                    {(row.serviceCharges + row.membershipFees + row.otherReceipts) > 0
                                                        ? formatPHP(row.serviceCharges + row.membershipFees + row.otherReceipts)
                                                        : '—'}
                                                </Text>
                                            </View>
                                            <View style={{ width: 110 }} className="items-end">
                                                <Text className="text-emerald-700 font-black text-xs">{formatPHP(row.totalCash)}</Text>
                                            </View>
                                        </View>
                                    ))
                                )}

                                {/* Totals Row */}
                                {summary && summary.rows.length > 0 && (
                                    <View className="flex-row bg-emerald-50 p-3 items-center border-t border-emerald-100">
                                        <View style={{ width: 380 }}>
                                            <Text className="text-emerald-950 font-black text-xs uppercase">Totals</Text>
                                        </View>
                                        <View style={{ width: 100 }} className="items-end">
                                            <Text className="text-emerald-950 font-black text-xs">{formatPHP(summary.totalLoanRepayments)}</Text>
                                        </View>
                                        <View style={{ width: 100 }} className="items-end">
                                            <Text className="text-emerald-950 font-black text-xs">{formatPHP(summary.totalSavingsDeposits)}</Text>
                                        </View>
                                        <View style={{ width: 100 }} className="items-end">
                                            <Text className="text-emerald-950 font-black text-xs">{formatPHP(summary.totalShareCapital)}</Text>
                                        </View>
                                        <View style={{ width: 90 }} className="items-end">
                                            <Text className="text-emerald-950 font-black text-xs">
                                                {formatPHP(summary.totalServiceCharges + summary.totalMembershipFees + summary.totalOtherReceipts)}
                                            </Text>
                                        </View>
                                        <View style={{ width: 110 }} className="items-end">
                                            <Text className="text-emerald-700 font-black text-xs">{formatPHP(summary.grandTotalCash)}</Text>
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
