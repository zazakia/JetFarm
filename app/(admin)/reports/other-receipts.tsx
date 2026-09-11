import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, Pressable, ActivityIndicator,
    TextInput, RefreshControl, Platform, Modal
} from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
    OtherReceiptService,
    OtherReceiptSummary,
    OtherReceiptItem,
    OTHER_RECEIPT_CATEGORIES
} from '../../../src/services/OtherReceiptService';
import { formatPHP } from '../../../src/utils/currency';
import { formatDate } from '../../../src/utils/dates';
import { format, addDays, subDays, addMonths, subMonths, addYears, subYears } from 'date-fns';

type PeriodType = 'daily' | 'monthly' | 'yearly';

export default function OtherReceiptsReportScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [period, setPeriod] = useState<PeriodType>('daily');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [searchQuery, setSearchQuery] = useState('');
    const [summary, setSummary] = useState<OtherReceiptSummary | null>(null);

    // Selected receipt for detail dialog
    const [selectedReceipt, setSelectedReceipt] = useState<OtherReceiptItem | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await OtherReceiptService.getReceiptSummary({
                period,
                date: selectedDate,
            });
            setSummary(data);
        } catch (error) {
            console.error('Failed to load other receipts summary:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [period, selectedDate]);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [period, selectedDate])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const changeDate = (direction: number) => {
        const d = new Date(selectedDate);
        if (period === 'daily') {
            setSelectedDate(direction > 0 ? addDays(d, 1) : subDays(d, 1));
        } else if (period === 'monthly') {
            setSelectedDate(direction > 0 ? addMonths(d, 1) : subMonths(d, 1));
        } else if (period === 'yearly') {
            setSelectedDate(direction > 0 ? addYears(d, 1) : subYears(d, 1));
        }
    };

    const getPeriodHeader = () => {
        if (period === 'daily') return format(selectedDate, 'EEEE, MMMM d, yyyy');
        if (period === 'monthly') return format(selectedDate, 'MMMM yyyy');
        return format(selectedDate, 'yyyy');
    };

    const filteredReceipts = (summary?.receipts || []).filter(r => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
            r.payorName.toLowerCase().includes(q) ||
            r.receiptNumber.toLowerCase().includes(q) ||
            r.categoryLabel.toLowerCase().includes(q) ||
            (r.notes && r.notes.toLowerCase().includes(q))
        );
    });

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingBottom: 60 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Header Banner */}
                <View className="bg-emerald-800 pt-20 pb-10 px-6 rounded-b-[40px] shadow-lg mb-6">
                    <View className="flex-row items-center justify-between mb-4">
                        <Pressable
                            onPress={() => router.back()}
                            className="bg-white/10 rounded-full p-2.5 active:bg-white/20"
                        >
                            <MaterialIcons name="arrow-back" size={20} color="#FFF" />
                        </Pressable>
                        <Text className="text-emerald-200 text-xs font-black uppercase tracking-widest">
                            Non-Loan Collections
                        </Text>
                        <Pressable
                            onPress={() => router.push('/(admin)/payments/other-receipt')}
                            className="bg-white px-3 py-1.5 rounded-full flex-row items-center active:bg-emerald-50"
                        >
                            <MaterialIcons name="add" size={16} color="#065F46" />
                            <Text className="text-emerald-900 font-black text-xs ml-1">New OR</Text>
                        </Pressable>
                    </View>

                    <Text className="text-white font-black text-3xl">Other Receipts Summary</Text>
                    <Text className="text-emerald-100 text-xs mt-1">
                        Comprehensive summary statement of fees, service charges, and non-loan receipts
                    </Text>

                    {/* Period Tabs */}
                    <View className="flex-row bg-emerald-900/60 p-1 rounded-2xl mt-6 border border-emerald-700/50">
                        {(['daily', 'monthly', 'yearly'] as PeriodType[]).map(p => (
                            <Pressable
                                key={p}
                                onPress={() => setPeriod(p)}
                                className={`flex-1 py-2.5 items-center rounded-xl ${
                                    period === p ? 'bg-white shadow-sm' : ''
                                }`}
                            >
                                <Text className={`text-xs font-black uppercase ${
                                    period === p ? 'text-emerald-900' : 'text-emerald-200'
                                }`}>
                                    {p}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {/* Date Stepper */}
                    <View className="flex-row items-center justify-between mt-4 bg-white/10 p-3 rounded-2xl border border-white/10">
                        <Pressable onPress={() => changeDate(-1)} className="p-1 bg-white/10 rounded-xl active:bg-white/20">
                            <MaterialIcons name="chevron-left" size={24} color="#FFF" />
                        </Pressable>
                        <Text className="text-white font-black text-base text-center">
                            {getPeriodHeader()}
                        </Text>
                        <Pressable onPress={() => changeDate(1)} className="p-1 bg-white/10 rounded-xl active:bg-white/20">
                            <MaterialIcons name="chevron-right" size={24} color="#FFF" />
                        </Pressable>
                    </View>
                </View>

                {loading && !refreshing ? (
                    <View className="py-20 items-center justify-center">
                        <ActivityIndicator size="large" color="#059669" />
                        <Text className="text-gray-500 font-bold text-xs mt-3">Loading receipts statement...</Text>
                    </View>
                ) : (
                    <View className="px-4">
                        {/* KPI Cards Row */}
                        <View className="flex-row gap-3 mb-6">
                            <View className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                <View className="flex-row items-center mb-1.5">
                                    <View className="w-8 h-8 rounded-xl bg-emerald-50 items-center justify-center mr-2">
                                        <MaterialIcons name="payments" size={18} color="#059669" />
                                    </View>
                                    <Text className="text-[10px] font-black text-gray-500 uppercase">Total Collected</Text>
                                </View>
                                <Text className="text-emerald-700 font-black text-xl">
                                    {formatPHP(summary?.totalAmount || 0)}
                                </Text>
                            </View>

                            <View className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                <View className="flex-row items-center mb-1.5">
                                    <View className="w-8 h-8 rounded-xl bg-blue-50 items-center justify-center mr-2">
                                        <MaterialIcons name="receipt-long" size={18} color="#2563EB" />
                                    </View>
                                    <Text className="text-[10px] font-black text-gray-500 uppercase">Total ORs</Text>
                                </View>
                                <Text className="text-blue-700 font-black text-xl">
                                    {summary?.receiptCount || 0}
                                </Text>
                            </View>

                            <View className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                <View className="flex-row items-center mb-1.5">
                                    <View className="w-8 h-8 rounded-xl bg-purple-50 items-center justify-center mr-2">
                                        <MaterialIcons name="trending-up" size={18} color="#7C3AED" />
                                    </View>
                                    <Text className="text-[10px] font-black text-gray-500 uppercase">Average</Text>
                                </View>
                                <Text className="text-purple-700 font-black text-base">
                                    {formatPHP(summary?.averageAmount || 0)}
                                </Text>
                            </View>
                        </View>

                        {/* Payment Channel Breakdown */}
                        <View className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-6">
                            <Text className="text-xs font-black text-gray-700 uppercase tracking-wider mb-3">
                                Payment Channels
                            </Text>
                            <View className="flex-row gap-3">
                                <View className="flex-1 p-3 bg-emerald-50/70 rounded-2xl border border-emerald-100">
                                    <Text className="text-[10px] font-bold text-emerald-800 uppercase">Cash on Hand</Text>
                                    <Text className="text-emerald-900 font-black text-lg mt-0.5">
                                        {formatPHP(summary?.paymentMethodBreakdown.cash || 0)}
                                    </Text>
                                </View>
                                <View className="flex-1 p-3 bg-blue-50/70 rounded-2xl border border-blue-100">
                                    <Text className="text-[10px] font-bold text-blue-800 uppercase">Bank Deposits</Text>
                                    <Text className="text-blue-900 font-black text-lg mt-0.5">
                                        {formatPHP(summary?.paymentMethodBreakdown.bank || 0)}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Category Breakdown Table/Cards */}
                        <View className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-6">
                            <Text className="text-xs font-black text-gray-700 uppercase tracking-wider mb-4">
                                Category Breakdown
                            </Text>
                            {(!summary?.categoryBreakdown || summary.categoryBreakdown.length === 0) ? (
                                <Text className="text-xs text-gray-500 italic py-2">No category data for this period.</Text>
                            ) : (
                                summary.categoryBreakdown.map((item, idx) => (
                                    <View
                                        key={item.category}
                                        className={`py-3 flex-row items-center justify-between ${
                                            idx < summary.categoryBreakdown.length - 1 ? 'border-b border-gray-100' : ''
                                        }`}
                                    >
                                        <View className="flex-row items-center flex-1 pr-2">
                                            <View 
                                                className="w-8 h-8 rounded-xl items-center justify-center mr-3"
                                                style={{ backgroundColor: `${item.color}15` }}
                                            >
                                                <MaterialIcons name={item.icon as any} size={16} color={item.color} />
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-xs font-bold text-gray-900">{item.label}</Text>
                                                <Text className="text-[10px] text-gray-500 font-medium">
                                                    {item.count} {item.count === 1 ? 'receipt' : 'receipts'} • {item.percentage.toFixed(1)}%
                                                </Text>
                                            </View>
                                        </View>
                                        <Text className="text-sm font-black text-gray-900">{formatPHP(item.amount)}</Text>
                                    </View>
                                ))
                            )}
                        </View>

                        {/* Itemized Receipts Ledger */}
                        <View className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-6">
                            <View className="flex-row items-center justify-between mb-4">
                                <Text className="text-xs font-black text-gray-700 uppercase tracking-wider">
                                    Itemized Receipts ({filteredReceipts.length})
                                </Text>
                            </View>

                            {/* Search */}
                            <View className="mb-4">
                                <TextInput
                                    className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-gray-900 text-xs font-semibold"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholder="Search payor name, OR#, or category..."
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>

                            {filteredReceipts.length === 0 ? (
                                <View className="py-12 items-center justify-center">
                                    <MaterialIcons name="receipt-long" size={40} color="#D1D5DB" />
                                    <Text className="text-gray-500 font-bold text-xs mt-2">No receipts found for this period.</Text>
                                </View>
                            ) : (
                                filteredReceipts.map((r, idx) => (
                                    <Pressable
                                        key={r.id}
                                        onPress={() => setSelectedReceipt(r)}
                                        className={`py-3.5 flex-row items-center justify-between active:bg-gray-50 ${
                                            idx < filteredReceipts.length - 1 ? 'border-b border-gray-100' : ''
                                        }`}
                                    >
                                        <View className="flex-1 pr-2">
                                            <View className="flex-row items-center gap-2">
                                                <Text className="text-xs font-black text-emerald-800">{r.receiptNumber}</Text>
                                                <View className="px-2 py-0.5 rounded-full bg-gray-100">
                                                    <Text className="text-[9px] font-bold text-gray-600 uppercase">{r.categoryLabel}</Text>
                                                </View>
                                            </View>
                                            <Text className="text-sm font-bold text-gray-900 mt-0.5">{r.payorName}</Text>
                                            <Text className="text-[10px] text-gray-500">
                                                {formatDate(new Date(r.transactionDate))} • {r.paymentMethod === 'bank' ? 'Bank Deposit' : 'Cash'}
                                            </Text>
                                        </View>
                                        <View className="items-end">
                                            <Text className="text-sm font-black text-emerald-700">{formatPHP(r.amount)}</Text>
                                            <MaterialIcons name="chevron-right" size={18} color="#9CA3AF" />
                                        </View>
                                    </Pressable>
                                ))
                            )}
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Receipt Detail Modal */}
            <Modal
                visible={!!selectedReceipt}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedReceipt(null)}
            >
                <View className="flex-1 bg-black/60 items-center justify-center p-4">
                    <View className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-gray-100">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-gray-900 font-black text-lg">Receipt Details</Text>
                            <Pressable onPress={() => setSelectedReceipt(null)} className="p-1 rounded-full bg-gray-100">
                                <MaterialIcons name="close" size={20} color="#4B5563" />
                            </Pressable>
                        </View>

                        <View className="bg-gray-50 p-4 rounded-2xl border border-gray-200 mb-6">
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-xs text-gray-500 font-medium">Receipt #:</Text>
                                <Text className="text-xs font-black text-emerald-800">{selectedReceipt?.receiptNumber}</Text>
                            </View>
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-xs text-gray-500 font-medium">Date:</Text>
                                <Text className="text-xs font-bold text-gray-900">
                                    {formatDate(new Date(selectedReceipt?.transactionDate || Date.now()))}
                                </Text>
                            </View>
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-xs text-gray-500 font-medium">Payor Name:</Text>
                                <Text className="text-xs font-bold text-gray-900">{selectedReceipt?.payorName}</Text>
                            </View>
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-xs text-gray-500 font-medium">Category:</Text>
                                <Text className="text-xs font-black text-emerald-900">{selectedReceipt?.categoryLabel}</Text>
                            </View>
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-xs text-gray-500 font-medium">Payment Channel:</Text>
                                <Text className="text-xs font-bold text-gray-700 uppercase">
                                    {selectedReceipt?.paymentMethod === 'bank' ? 'Bank Deposit' : 'Cash on Hand'}
                                </Text>
                            </View>
                            {selectedReceipt?.notes ? (
                                <View className="p-2.5 bg-white rounded-xl border border-gray-200 mt-2">
                                    <Text className="text-[10px] text-gray-700">Remarks: {selectedReceipt.notes}</Text>
                                </View>
                            ) : null}
                            <View className="border-t border-dashed border-gray-300 pt-3 mt-3 flex-row justify-between items-center">
                                <Text className="text-sm font-black text-gray-900">Amount Paid:</Text>
                                <Text className="text-xl font-black text-emerald-600">
                                    {formatPHP(selectedReceipt?.amount || 0)}
                                </Text>
                            </View>
                        </View>

                        <Pressable
                            onPress={() => setSelectedReceipt(null)}
                            className="w-full py-3.5 bg-gray-900 rounded-xl items-center justify-center active:bg-gray-800"
                        >
                            <Text className="text-white font-bold text-xs uppercase">Close</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
