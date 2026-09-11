import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { Stack , useFocusEffect } from 'expo-router';

import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import Payment from '../../../src/database/models/Payment';
import Expense from '../../../src/database/models/Expense';
import Remittance from '../../../src/database/models/Remittance';
import { formatPHP } from '../../../src/utils/currency';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface MonthlyCashRow {
    label: string;
    amount: number;
    type: 'receipt' | 'disbursement';
    icon: any;
    color: string;
}

export default function MonthlyReceiptsScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [rows, setRows] = useState<MonthlyCashRow[]>([]);
    const [totals, setTotals] = useState({ receipts: 0, disbursements: 0, netCash: 0 });

    const loadData = async () => {
        setLoading(true);
        try {
            const start = startOfMonth(selectedMonth).getTime();
            const end = endOfMonth(selectedMonth).getTime();

            const [payments, expenses, remittances] = await Promise.all([
                database.get<Payment>('payments').query(Q.where('payment_date', Q.between(start, end)), Q.where('deleted_at', null)).fetch(),
                database.get<Expense>('expenses').query(Q.where('expense_date', Q.between(start, end)), Q.where('deleted_at', null)).fetch(),
                database.get<Remittance>('remittances').query(Q.where('status', 'approved'), Q.where('remittance_date', Q.between(start, end)), Q.where('deleted_at', null)).fetch(),
            ]);

            const totalPayments = payments.reduce((s, p) => s + (p.amount ?? 0), 0);
            const totalExpenses = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);
            const totalRemitted = remittances.reduce((s, r) => s + (r.amount ?? 0), 0);

            const data: MonthlyCashRow[] = [
                { label: 'Loan Repayments Collected', amount: totalPayments, type: 'receipt', icon: 'payments', color: '#16A34A' },
                { label: 'Remittances Received', amount: totalRemitted, type: 'receipt', icon: 'account-balance-wallet', color: '#2563EB' },
                { label: 'Operating Expenses Paid', amount: totalExpenses, type: 'disbursement', icon: 'receipt-long', color: '#DC2626' },
            ];

            setRows(data);
            const receipts = totalPayments + totalRemitted;
            const disbursements = totalExpenses;
            setTotals({ receipts, disbursements, netCash: receipts - disbursements });
        } catch (e) {
            console.error('Monthly Receipts error:', e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, [selectedMonth]));
    const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };
    const changeMonth = (delta: number) => { const d = new Date(selectedMonth); d.setMonth(d.getMonth() + delta); setSelectedMonth(d); };

    if (loading && !refreshing) {
        return <View className="flex-1 justify-center items-center bg-gray-50"><ActivityIndicator size="large" color="#1E3A8A" /></View>;
    }

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero */}
                <View className="bg-slate-900 pt-24 pb-10 px-6 rounded-b-[40px] shadow-xl mb-6">
                    <Text className="text-white/70 text-[10px] uppercase font-bold tracking-widest mb-3">Treasurer's Monthly Statement</Text>

                    {/* Month Selector */}
                    <View className="flex-row items-center justify-between mb-6">
                        <Pressable onPress={() => changeMonth(-1)} className="bg-white/10 rounded-full p-2">
                            <MaterialIcons name="chevron-left" size={22} color="#FFF" />
                        </Pressable>
                        <Text className="text-white text-2xl font-black">{format(selectedMonth, 'MMMM yyyy')}</Text>
                        <Pressable onPress={() => changeMonth(1)} className="bg-white/10 rounded-full p-2">
                            <MaterialIcons name="chevron-right" size={22} color="#FFF" />
                        </Pressable>
                    </View>

                    {/* Net Balance */}
                    <View className="bg-white/5 rounded-3xl p-5 border border-white/10">
                        <Text className="text-white/70 text-xs uppercase font-bold mb-1">Net Cash Flow</Text>
                        <Text className={`text-4xl font-black ${totals.netCash >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {totals.netCash >= 0 ? '+' : ''}{formatPHP(totals.netCash)}
                        </Text>
                    </View>
                </View>

                <View className="px-4">
                    {/* Totals Row */}
                    <View className="flex-row gap-3 mb-6">
                        <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                            <View className="flex-row items-center mb-2">
                                <View className="bg-green-50 rounded-xl p-2 mr-2">
                                    <MaterialIcons name="trending-up" size={18} color="#16A34A" />
                                </View>
                                <Text className="text-gray-400 text-[9px] uppercase font-bold">Total Receipts</Text>
                            </View>
                            <Text className="text-green-600 font-black text-lg">{formatPHP(totals.receipts)}</Text>
                        </View>
                        <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                            <View className="flex-row items-center mb-2">
                                <View className="bg-red-50 rounded-xl p-2 mr-2">
                                    <MaterialIcons name="trending-down" size={18} color="#DC2626" />
                                </View>
                                <Text className="text-gray-400 text-[9px] uppercase font-bold">Total Disbursements</Text>
                            </View>
                            <Text className="text-red-600 font-black text-lg">{formatPHP(totals.disbursements)}</Text>
                        </View>
                    </View>

                    {/* Detail Rows */}
                    <Text className="text-gray-900 font-black text-lg mb-3">Statement of Cash Receipts & Disbursements</Text>
                    <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                        {/* Receipts Section */}
                        <View className="bg-green-50 px-5 py-3">
                            <Text className="text-green-800 text-[10px] uppercase font-black tracking-widest">Cash Receipts</Text>
                        </View>
                        {rows.filter(r => r.type === 'receipt').map((row, idx, arr) => (
                            <View key={idx} className={`flex-row items-center px-5 py-4 ${idx < arr.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: `${row.color}15` }}>
                                    <MaterialIcons name={row.icon} size={18} color={row.color} />
                                </View>
                                <Text className="flex-1 text-gray-700 text-sm font-medium">{row.label}</Text>
                                <Text className="font-black text-sm" style={{ color: row.color }}>{formatPHP(row.amount)}</Text>
                            </View>
                        ))}

                        {/* Disbursements Section */}
                        <View className="bg-red-50 px-5 py-3 mt-1">
                            <Text className="text-red-800 text-[10px] uppercase font-black tracking-widest">Cash Disbursements</Text>
                        </View>
                        {rows.filter(r => r.type === 'disbursement').map((row, idx, arr) => (
                            <View key={idx} className={`flex-row items-center px-5 py-4 ${idx < arr.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: `${row.color}15` }}>
                                    <MaterialIcons name={row.icon} size={18} color={row.color} />
                                </View>
                                <Text className="flex-1 text-gray-700 text-sm font-medium">{row.label}</Text>
                                <Text className="font-black text-sm text-red-600">({formatPHP(row.amount)})</Text>
                            </View>
                        ))}

                        {/* Net Line */}
                        <View className="flex-row items-center justify-between px-5 py-5 border-t-2 border-gray-100 bg-gray-50">
                            <Text className="text-gray-900 font-black text-sm">Net Cash for the Period</Text>
                            <Text className={`font-black text-lg ${totals.netCash >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatPHP(totals.netCash)}
                            </Text>
                        </View>
                    </View>

                    {/* Disclaimer */}
                    <View className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                        <View className="flex-row items-start">
                            <MaterialIcons name="info" size={16} color="#2563EB" />
                            <Text className="text-blue-700 text-xs ml-2 flex-1 leading-4">
                                This statement is prepared by the Treasurer as required by the Cooperative Manual. It is distinct from the accrual-based Financial Summary and reflects physical cash movements only.
                            </Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
