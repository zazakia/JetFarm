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
import SavingsTransaction from '../../../src/database/models/SavingsTransaction';
import ShareCapitalTransaction from '../../../src/database/models/ShareCapitalTransaction';
import { formatPHP } from '../../../src/utils/currency';
import { format, startOfQuarter, endOfQuarter } from 'date-fns';

const QUARTERS = [
    { label: 'Q1', months: 'Jan–Mar', start: 0 },
    { label: 'Q2', months: 'Apr–Jun', start: 3 },
    { label: 'Q3', months: 'Jul–Sep', start: 6 },
    { label: 'Q4', months: 'Oct–Dec', start: 9 },
];

export default function CashFlowsScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [year, setYear] = useState(new Date().getFullYear());
    const [quarter, setQuarter] = useState(Math.floor(new Date().getMonth() / 3));
    const [data, setData] = useState<any>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const q = QUARTERS[quarter];
            const start = new Date(year, q.start, 1).getTime();
            const end = new Date(year, q.start + 3, 0, 23, 59, 59).getTime();

            const [payments, expenses, remittances, savingsTx, shareTx] = await Promise.all([
                database.get<Payment>('payments').query(Q.where('payment_date', Q.between(start, end)), Q.where('deleted_at', null)).fetch(),
                database.get<Expense>('expenses').query(Q.where('expense_date', Q.between(start, end)), Q.where('deleted_at', null)).fetch(),
                database.get<Remittance>('remittances').query(Q.where('status', 'approved'), Q.where('remittance_date', Q.between(start, end)), Q.where('deleted_at', null)).fetch(),
                database.get<SavingsTransaction>('savings_transactions').query(Q.where('date', Q.between(start, end)), Q.where('deleted_at', null)).fetch(),
                database.get<ShareCapitalTransaction>('share_capital_transactions').query(Q.where('date', Q.between(start, end)), Q.where('deleted_at', null)).fetch(),
            ]);

            // Operating Activities
            const loanRepayments = payments.reduce((s, p) => s + (p.amount ?? 0), 0);
            const operatingExpenses = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);
            const netOperating = loanRepayments - operatingExpenses;

            // Investing Activities — savings withdrawals vs deposits as rough proxy
            const savingsDeposits = savingsTx.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
            const savingsWithdrawals = savingsTx.filter(t => t.type === 'withdrawal').reduce((s, t) => s + t.amount, 0);
            const netInvesting = savingsDeposits - savingsWithdrawals;

            // Financing Activities — share capital contributions
            const shareDeposits = shareTx.filter(t => t.transactionType === 'DEPOSIT').reduce((s, t) => s + t.amount, 0);
            const netFinancing = shareDeposits;

            const netChange = netOperating + netInvesting + netFinancing;

            setData({
                period: { year, q: q.label, months: q.months },
                operating: [
                    { label: 'Loan Repayments Collected', amount: loanRepayments, inflow: true },
                    { label: 'Operating Expenses Paid', amount: operatingExpenses, inflow: false },
                ],
                netOperating,
                investing: [
                    { label: 'Savings Deposits Received', amount: savingsDeposits, inflow: true },
                    { label: 'Savings Withdrawals Paid', amount: savingsWithdrawals, inflow: false },
                ],
                netInvesting,
                financing: [
                    { label: 'Share Capital Contributions', amount: shareDeposits, inflow: true },
                ],
                netFinancing,
                netChange,
            });
        } catch (e) {
            console.error('Cash Flow error:', e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, [year, quarter]));
    const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

    const Section = ({ title, items, net, color }: any) => (
        <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-4">
            <View className="px-5 py-3" style={{ backgroundColor: `${color}15` }}>
                <Text className="text-[10px] uppercase font-black tracking-widest" style={{ color }}>{title}</Text>
            </View>
            {items.map((item: any, idx: number) => (
                <View key={idx} className="flex-row items-center px-5 py-3 border-b border-gray-50">
                    <Text className="flex-1 text-gray-700 text-sm">{item.label}</Text>
                    <Text className={`font-bold text-sm ${item.inflow ? 'text-green-600' : 'text-red-500'}`}>
                        {item.inflow ? '' : '('}{formatPHP(item.amount)}{item.inflow ? '' : ')'}
                    </Text>
                </View>
            ))}
            <View className="flex-row items-center px-5 py-4 bg-gray-50">
                <Text className="flex-1 text-gray-900 font-black text-sm">Net {title}</Text>
                <Text className={`font-black text-base ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatPHP(net)}</Text>
            </View>
        </View>
    );

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View className="bg-slate-900 pt-24 pb-10 px-6 rounded-b-[40px] shadow-xl mb-6">
                    <Text className="text-white/70 text-[10px] uppercase font-bold tracking-widest mb-2">Statement of Cash Flows</Text>

                    {/* Quarter Selector */}
                    <View className="flex-row mb-4 gap-2">
                        {QUARTERS.map((q, i) => (
                            <Pressable
                                key={q.label}
                                onPress={() => setQuarter(i)}
                                className={`flex-1 py-2 rounded-xl items-center ${quarter === i ? 'bg-white' : 'bg-white/10'}`}
                            >
                                <Text className={`font-black text-sm ${quarter === i ? 'text-gray-900' : 'text-white/70'}`}>{q.label}</Text>
                                <Text className={`text-[8px] ${quarter === i ? 'text-gray-500' : 'text-white/40'}`}>{q.months}</Text>
                            </Pressable>
                        ))}
                    </View>

                    {/* Year selector */}
                    <View className="flex-row items-center justify-center">
                        <Pressable onPress={() => setYear(y => y - 1)} className="bg-white/10 rounded-full p-2 mr-4">
                            <MaterialIcons name="chevron-left" size={20} color="#FFF" />
                        </Pressable>
                        <Text className="text-white font-black text-xl">{year}</Text>
                        <Pressable onPress={() => setYear(y => y + 1)} className="bg-white/10 rounded-full p-2 ml-4">
                            <MaterialIcons name="chevron-right" size={20} color="#FFF" />
                        </Pressable>
                    </View>

                    {!loading && data && (
                        <View className="mt-5 bg-white/10 rounded-2xl p-4 border border-white/10">
                            <Text className="text-white/70 text-xs">Net Change in Cash</Text>
                            <Text className={`font-black text-3xl ${(data?.netChange ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {(data?.netChange ?? 0) >= 0 ? '+' : ''}{formatPHP(data?.netChange ?? 0)}
                            </Text>
                        </View>
                    )}
                </View>

                {loading ? (
                    <View className="flex-1 justify-center items-center py-20">
                        <ActivityIndicator size="large" color="#1E3A8A" />
                    </View>
                ) : data ? (
                    <View className="px-4">
                        <Section title="Operating Activities" items={data.operating} net={data.netOperating} color="#1E3A8A" />
                        <Section title="Investing Activities" items={data.investing} net={data.netInvesting} color="#059669" />
                        <Section title="Financing Activities" items={data.financing} net={data.netFinancing} color="#7C3AED" />

                        <View className="bg-slate-900 rounded-3xl p-5 mt-2">
                            <Text className="text-white/70 text-xs uppercase font-bold mb-1">Net Increase / (Decrease) in Cash</Text>
                            <Text className={`font-black text-2xl ${data.netChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formatPHP(data.netChange)}
                            </Text>
                            <Text className="text-white/40 text-[10px] mt-1">{QUARTERS[quarter].label} {year} · {QUARTERS[quarter].months}</Text>
                        </View>
                    </View>
                ) : null}
            </ScrollView>
        </View>
    );
}
