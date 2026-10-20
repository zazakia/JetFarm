import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { Stack , useFocusEffect } from 'expo-router';

import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import CashTransaction from '../../../src/database/models/CashTransaction';
import Expense from '../../../src/database/models/Expense';
import AgriFarmExpense from '../../../src/database/models/AgriFarmExpense';
import AgriLaborLog from '../../../src/database/models/AgriLaborLog';
import AgriWeeklySettlement from '../../../src/database/models/AgriWeeklySettlement';
import AgriInvestorLedger from '../../../src/database/models/AgriInvestorLedger';
import { formatPHP } from '../../../src/utils/currency';

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

            const NOT_DELETED = Q.where('deleted_at', null);
            const [cashIns, expenses, farmExpenses, laborPaid, settlementsPaid, investorLedgers] = await Promise.all([
                database.get<CashTransaction>('cash_transactions').query(NOT_DELETED, Q.where('type', 'in'), Q.where('transaction_date', Q.between(start, end))).fetch(),
                database.get<Expense>('expenses').query(NOT_DELETED, Q.where('expense_date', Q.between(start, end))).fetch(),
                database.get<AgriFarmExpense>('agri_farm_expenses').query(NOT_DELETED, Q.where('expense_date', Q.between(start, end))).fetch(),
                database.get<AgriLaborLog>('agri_labor_logs').query(NOT_DELETED, Q.where('payment_status', 'paid'), Q.where('work_date', Q.between(start, end))).fetch(),
                database.get<AgriWeeklySettlement>('agri_weekly_settlements').query(NOT_DELETED, Q.where('payment_status', 'paid'), Q.where('week_end_date', Q.between(start, end))).fetch(),
                database.get<AgriInvestorLedger>('agri_investor_ledgers').query(NOT_DELETED, Q.where('transaction_date', Q.between(start, end))).fetch(),
            ]);

            const sum = (rows: any[], field: string) => rows.reduce((s, r) => s + (r[field] ?? 0), 0);

            // Operating Activities — cash received into the till less recorded expenses
            const cashReceipts = sum(cashIns, 'amount');
            const operatingExpenses = sum(expenses, 'amount');
            const netOperating = cashReceipts - operatingExpenses;

            // Investing Activities — what the field consumed this quarter
            const farmInputs = sum(farmExpenses, 'amount');
            const laborAndSettlements = sum(laborPaid, 'totalPay') + sum(settlementsPaid, 'netPayoutDueThisWeek');
            const netInvesting = -(farmInputs + laborAndSettlements);

            // Financing Activities — investor capital against off-take and refunds
            const investorCapital = sum(investorLedgers.filter(l => l.type === 'capital_injection' || l.type === 'equipment_provision'), 'amount');
            const investorOutflows = sum(investorLedgers.filter(l => l.type === 'harvest_offtake' || l.type === 'payout_refund'), 'amount');
            const netFinancing = investorCapital - investorOutflows;

            const netChange = netOperating + netInvesting + netFinancing;

            setData({
                period: { year, q: q.label, months: q.months },
                operating: [
                    { label: 'Cash Receipts Recorded', amount: cashReceipts, inflow: true },
                    { label: 'Operating Expenses Paid', amount: operatingExpenses, inflow: false },
                ],
                netOperating,
                investing: [
                    { label: 'Farm Inputs Paid', amount: farmInputs, inflow: false },
                    { label: 'Labour & Land-Owner Payouts', amount: laborAndSettlements, inflow: false },
                ],
                netInvesting,
                financing: [
                    { label: 'Investor Capital Injected', amount: investorCapital, inflow: true },
                    { label: 'Off-take Deductions & Refunds', amount: investorOutflows, inflow: false },
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
