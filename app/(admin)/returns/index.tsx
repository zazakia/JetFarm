import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SalesReturnService, ReturnDraft } from '../../../src/services/SalesReturnService';
import { formatPHP } from '../../../src/utils/currency';
import { COMPANY_NAME } from '../../../src/constants/brand';
import { format } from 'date-fns';

export default function AdminReturnsScreen() {
    const router = useRouter();
    const [returns, setReturns] = useState<ReturnDraft[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const loadReturns = () => {
        const all = SalesReturnService.getAllReturns();
        setReturns(all);
    };

    useFocusEffect(
        useCallback(() => {
            loadReturns();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadReturns();
        setRefreshing(false);
    };

    const filtered = returns.filter(
        (r) =>
            r.returnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (r.customerName && r.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (r.originalOrderNumber && r.originalOrderNumber.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const totalRefunds = returns.reduce((sum, r) => sum + r.totalRefundAmount, 0);

    return (
        <ScrollView
            className="flex-1 bg-gray-50 p-6"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Header */}
            <View className="mb-6 flex-row justify-between items-center">
                <View>
                    <Text className="text-gray-900 font-black text-2xl">Sales Returns & Refunds</Text>
                    <Text className="text-gray-600 text-xs font-bold mt-1 uppercase tracking-wider">
                        {COMPANY_NAME} In-Store Returns & Inventory Reversal Audit
                    </Text>
                </View>
                <Pressable
                    onPress={() => router.push('/(cashier)/returns' as any)}
                    className="bg-emerald-700 px-4 py-2.5 rounded-xl flex-row items-center active:bg-emerald-800"
                >
                    <MaterialIcons name="add" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text className="text-white font-bold text-xs">New Return</Text>
                </Pressable>
            </View>

            {/* KPI Cards */}
            <View className="flex-row justify-between mb-6">
                <View className="w-[48%] bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                    <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">
                        Total Returns Logged
                    </Text>
                    <Text className="text-gray-900 font-black text-2xl">{returns.length}</Text>
                    <Text className="text-gray-400 text-xs mt-1">Processed across branches</Text>
                </View>

                <View className="w-[48%] bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                    <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">
                        Total Refund Payout
                    </Text>
                    <Text className="text-emerald-700 font-black text-2xl">{formatPHP(totalRefunds)}</Text>
                    <Text className="text-gray-400 text-xs mt-1">Reversed in Drawer / GL</Text>
                </View>
            </View>

            {/* Search Filter */}
            <View className="bg-white rounded-2xl p-3 border border-gray-200 mb-4 flex-row items-center">
                <MaterialIcons name="search" size={20} color="#9CA3AF" />
                <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search by Return Number, Customer, or Order #..."
                    placeholderTextColor="#9CA3AF"
                    className="flex-1 ml-2 text-sm text-gray-900"
                />
            </View>

            {/* Returns Registry Table */}
            <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-8">
                <View className="p-4 bg-gray-50 border-b border-gray-100 flex-row justify-between items-center">
                    <Text className="text-gray-900 font-bold text-sm">Processed Customer Returns</Text>
                    <Text className="text-gray-500 text-xs">{filtered.length} record(s)</Text>
                </View>

                {filtered.length === 0 ? (
                    <View className="p-10 items-center justify-center">
                        <MaterialIcons name="assignment-return" size={40} color="#CBD5E1" />
                        <Text className="text-gray-500 font-semibold text-sm mt-3">No sales returns found</Text>
                        <Text className="text-gray-400 text-xs mt-1">Cashier return refunds will appear here in real-time.</Text>
                    </View>
                ) : (
                    filtered.map((r, idx) => (
                        <View
                            key={r.id || idx}
                            className={`p-4 flex-row items-center justify-between ${
                                idx !== filtered.length - 1 ? 'border-b border-gray-100' : ''
                            }`}
                        >
                            <View className="flex-1 mr-3">
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-gray-900 font-bold text-sm">{r.returnNumber}</Text>
                                    <View
                                        className={`px-2 py-0.5 rounded ${
                                            r.status === 'completed'
                                                ? 'bg-emerald-100'
                                                : r.status === 'approved'
                                                ? 'bg-blue-100'
                                                : 'bg-amber-100'
                                        }`}
                                    >
                                        <Text
                                            className={`text-[10px] font-bold uppercase ${
                                                r.status === 'completed'
                                                    ? 'text-emerald-800'
                                                    : r.status === 'approved'
                                                    ? 'text-blue-800'
                                                    : 'text-amber-800'
                                            }`}
                                        >
                                            {r.status}
                                        </Text>
                                    </View>
                                </View>
                                <Text className="text-gray-600 text-xs mt-1">
                                    Customer: <Text className="font-semibold">{r.customerName || 'Walk-in'}</Text>
                                    {r.originalOrderNumber ? ` • Ref: ${r.originalOrderNumber}` : ''}
                                </Text>
                                <Text className="text-gray-400 text-[11px] mt-0.5">
                                    Approved by: {r.approvedBy || 'System Supervisor'} • {format(new Date(r.createdAt), 'MMM dd, yyyy hh:mm a')}
                                </Text>
                            </View>

                            <View className="items-end">
                                <Text className="text-emerald-700 font-extrabold text-base">
                                    {formatPHP(r.totalRefundAmount)}
                                </Text>
                                <Text className="text-gray-500 text-xs mt-0.5">{r.items.length} item(s)</Text>
                            </View>
                        </View>
                    ))
                )}
            </View>
        </ScrollView>
    );
}
