import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator , Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import Payment from '../../../src/database/models/Payment';
import Expense from '../../../src/database/models/Expense';
import Remittance from '../../../src/database/models/Remittance';
import UserProfile from '../../../src/database/models/UserProfile';
import FinancialSnapshot from '../../../src/database/models/FinancialSnapshot';
import uuid from 'react-native-uuid';

import { CashService } from '../../../src/services/CashService';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { startOfMonth, endOfMonth, format, isWithinInterval } from 'date-fns';
import { ReportInfoModal, InfoModalContent, InfoIcon } from '../../../src/components/ReportInfoModal';
import { MetricBreakdownDialog, BreakdownItem } from '../../../src/components/MetricBreakdownDialog';
import Borrower from '../../../src/database/models/Borrower';

const formatPHP = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
    }).format(amount);
};

export default function FinancialSummaryScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({
        totalIncome: 0,
        totalExpenses: 0,
        netProfit: 0,
        expenseCount: 0,
        paymentCount: 0,
        inTransit: 0,
        totalRemitted: 0,
        realizedProfit: 0,
    });
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [infoContent, setInfoContent] = useState<InfoModalContent | null>(null);
    const [breakdownVisible, setBreakdownVisible] = useState(false);
    const [breakdownData, setBreakdownData] = useState<{ title: string; total: number; isTotalCurrency: boolean; items: BreakdownItem[]; color: string }>({
        title: '', total: 0, isTotalCurrency: true, items: [], color: 'text-emerald-600'
    });

    const handleInTransitClick = async () => {
        const collectors = await database.collections.get<UserProfile>('user_profiles').query(Q.where('role', 'collector')).fetch();
        const items: BreakdownItem[] = [];
        for (const c of collectors) {
            const bal = await CashService.getCollectorBalance(c.id);
            if (bal > 0) {
                items.push({
                    id: c.id,
                    label: c.fullName || 'Collector',
                    sublabel: `Unremitted Cash Balance`,
                    value: bal,
                    isCurrency: true,
                });
            }
        }
        setBreakdownData({
            title: 'Collection In Transit (Held by Collectors)',
            total: summary.inTransit,
            isTotalCurrency: true,
            items,
            color: 'text-orange-600',
        });
        setBreakdownVisible(true);
    };

    const handleRemittedClick = async () => {
        const start = startOfMonth(selectedMonth).getTime();
        const end = endOfMonth(selectedMonth).getTime();
        const remittances = await database.collections.get<Remittance>('remittances')
            .query(Q.where('status', 'approved'), Q.where('remittance_date', Q.between(start, end)))
            .fetch();
        const collectors = await database.collections.get<UserProfile>('user_profiles').query().fetch();

        const items: BreakdownItem[] = remittances.map(r => {
            const collector = collectors.find(c => c.id === r.collectorId);
            return {
                id: r.id,
                label: collector?.fullName || 'Approved Remittance',
                sublabel: format(new Date(r.remittanceDate), 'MMM d, yyyy • hh:mm a'),
                value: r.amount,
                isCurrency: true,
            };
        });

        setBreakdownData({
            title: 'Approved Cash Remittances',
            total: summary.totalRemitted,
            isTotalCurrency: true,
            items,
            color: 'text-blue-600',
        });
        setBreakdownVisible(true);
    };

    const handleGrossInterestClick = async () => {
        const start = startOfMonth(selectedMonth).getTime();
        const end = endOfMonth(selectedMonth).getTime();
        const payments = await database.collections.get<Payment>('payments')
            .query(Q.where('payment_date', Q.between(start, end)))
            .fetch();
        const borrowers = await database.collections.get<Borrower>('borrowers').query().fetch();

        const items: BreakdownItem[] = payments.map(p => {
            const borrower = borrowers.find(b => b.id === p.borrowerId);
            return {
                id: p.id,
                label: borrower?.fullName || 'Loan Payment',
                sublabel: `${format(new Date(p.paymentDate), 'MMM d, yyyy')} • OR #${p.receiptNumber || 'N/A'}`,
                value: p.amount,
                isCurrency: true,
                onPress: () => {
                    setBreakdownVisible(false);
                    if (borrower?.id) router.push(`/(admin)/borrowers/${borrower.id}`);
                }
            };
        });

        setBreakdownData({
            title: 'Gross Interest & Loan Payments',
            total: summary.totalIncome,
            isTotalCurrency: true,
            items,
            color: 'text-emerald-600',
        });
        setBreakdownVisible(true);
    };

    const handleExpensesClick = async () => {
        const start = startOfMonth(selectedMonth).getTime();
        const end = endOfMonth(selectedMonth).getTime();
        const expenses = await database.collections.get<Expense>('expenses')
            .query(Q.where('expense_date', Q.between(start, end)))
            .fetch();

        const items: BreakdownItem[] = expenses.map(e => ({
            id: e.id,
            label: e.description || e.payee || e.category || 'Operating Expense',
            sublabel: `${format(new Date(e.expenseDate), 'MMM d, yyyy')} • Category: ${e.category || 'General'}`,
            value: e.amount,
            isCurrency: true,
        }));

        setBreakdownData({
            title: 'Monthly Operating Expenses',
            total: summary.totalExpenses,
            isTotalCurrency: true,
            items,
            color: 'text-rose-600',
        });
        setBreakdownVisible(true);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const start = startOfMonth(selectedMonth).getTime();
            const end = endOfMonth(selectedMonth).getTime();

            // Total Collections (Accrual basis)
            const payments = await database.collections.get<Payment>('payments')
                .query(Q.where('payment_date', Q.between(start, end)))
                .fetch();

            const expenses = await database.collections.get<Expense>('expenses')
                .query(Q.where('expense_date', Q.between(start, end)))
                .fetch();

            // Remitted Cash (Physical cash flow basis)
            const remittances = await database.collections.get<Remittance>('remittances')
                .query(
                    Q.where('status', 'approved'),
                    Q.where('remittance_date', Q.between(start, end))
                ).fetch();

            const grossCollections = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const totalRemitted = remittances.reduce((sum, r) => sum + (r.amount || 0), 0);
            const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

            // Calculate current "In Transit" (Held by collectors)
            // Note: This is a point-in-time metric, but for report consistency we show what's currently held
            const allUsers = await database.collections.get<UserProfile>('user_profiles').query().fetch();
            let inTransit = 0;
            for (const u of allUsers.filter(usr => usr.role === 'collector')) {
                inTransit += await CashService.getCollectorBalance(u.id);
            }

            setSummary({
                totalIncome: grossCollections,
                totalRemitted,
                totalExpenses,
                inTransit,
                netProfit: grossCollections - totalExpenses,
                realizedProfit: totalRemitted - totalExpenses,
                expenseCount: expenses.length,
                paymentCount: payments.length,
            });
        } catch (error) {
            console.error('Failed to load financial summary:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTakeSnapshot = async () => {
        Alert.alert('Confirm Snapshot', 'Save current metrics as a financial snapshot?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Save Snapshot',
                style: 'default',
                onPress: async () => {
                    try {
                        await database.write(async () => {
                            await database.get<FinancialSnapshot>('financial_snapshots').create(record => {
                                record._raw.id = uuid.v4().toString();
                                record.snapshotDate = Date.now();
                                record.totalAssets = summary.inTransit; // Simplify for now
                                record.totalEquity = summary.netProfit;
                                record.totalLiabilities = 0;
                                record.loanLossReserve = 0;
                                record.operatingRevenue = summary.totalIncome;
                                record.financialCosts = summary.totalExpenses;
                            });
                        });
                        Alert.alert('Success', 'Snapshot saved successfully.');
                    } catch (error) {
                        console.error(error);
                        Alert.alert('Error', 'Failed to save snapshot.');
                    }
                }
            }
        ]);
    };

    useEffect(() => {
        fetchData();
    }, [selectedMonth]);

    const changeMonth = (delta: number) => {
        const next = new Date(selectedMonth);
        next.setMonth(next.getMonth() + delta);
        setSelectedMonth(next);
    };

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />
            
            <View className="bg-slate-900 pt-24 pb-12 px-6 rounded-b-[40px] shadow-2xl">
                <View className="flex-row items-center justify-between mb-8">
                    <Pressable onPress={() => changeMonth(-1)} className="p-2 bg-white/10 rounded-full">
                        <MaterialIcons name="chevron-left" size={24} color="#FFF" />
                    </Pressable>
                    <View className="items-center">
                        <Text className="text-gray-300 text-xs font-bold uppercase tracking-[3px]">Reporting Period</Text>
                        <Text className="text-white text-2xl font-black mt-1">{format(selectedMonth, 'MMMM yyyy')}</Text>
                    </View>
                    <Pressable onPress={() => changeMonth(1)} className="p-2 bg-white/10 rounded-full">
                        <MaterialIcons name="chevron-right" size={24} color="#FFF" />
                    </Pressable>
                </View>

                <View className="bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-xl">
                    <View className="flex-row items-center">
                        <Text className="text-white/90 text-sm font-medium">Net Monthly Performance</Text>
                        <InfoIcon color="#FFFFFF80" onPress={() => setInfoContent({
                            title: 'Net Monthly Performance',
                            question: 'Did the business actually make money this month on an accrual basis?',
                            formula: 'Gross Interest (Earned) - Total Expenses',
                            explanation: 'This metric shows how profitable the business was during the month, assuming all payments collected are recognized as revenue.'
                        })} />
                    </View>
                    <Text className={`text-4xl font-black mt-2 ${summary.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatPHP(summary.netProfit)}
                    </Text>
                </View>
            </View>

            <ScrollView className="flex-1 px-6 bg-gray-50" showsVerticalScrollIndicator={false}>
                <View className="h-4" />
                <View className="flex-row justify-between mb-6">
                    <Pressable onPress={handleInTransitClick} className="w-[31%] bg-white p-4 rounded-3xl shadow-sm border border-gray-100 active:bg-gray-50">
                        <View className="flex-row items-center mb-1">
                            <Text className="text-gray-700 text-[8px] font-bold uppercase tracking-wider">In Transit</Text>
                            <InfoIcon onPress={() => setInfoContent({
                                title: 'Collection In Transit',
                                question: 'How much cash is currently held by collectors and not yet remitted to the main branch?',
                                formula: 'Sum of all unremitted cash across all collectors',
                                explanation: 'This cash has been collected from borrowers but has not yet been physically deposited or transferred to the admin.'
                            })} />
                        </View>
                        <Text className="text-gray-900 text-sm font-black text-orange-600">{formatPHP(summary.inTransit)}</Text>
                    </Pressable>
                    <Pressable onPress={handleRemittedClick} className="w-[31%] bg-white p-4 rounded-3xl shadow-sm border border-gray-100 active:bg-gray-50">
                        <View className="flex-row items-center mb-1">
                            <Text className="text-gray-700 text-[8px] font-bold uppercase tracking-wider">Remitted</Text>
                            <InfoIcon onPress={() => setInfoContent({
                                title: 'Remitted Cash',
                                question: 'How much cash was actually handed over to the admin this month?',
                                formula: 'Sum of all approved remittances matching the current month',
                                explanation: 'This determines your actual physical cash inflow for the month.'
                            })} />
                        </View>
                        <Text className="text-gray-900 text-sm font-black text-blue-600">{formatPHP(summary.totalRemitted)}</Text>
                    </Pressable>
                    <View className="w-[31%] bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
                        <View className="flex-row items-center mb-1">
                            <Text className="text-gray-700 text-[8px] font-bold uppercase tracking-wider">Realized Net</Text>
                            <InfoIcon onPress={() => setInfoContent({
                                title: 'Realized Net Profit',
                                question: 'Based purely on cash handed to admin, did we make a profit?',
                                formula: 'Total Remitted - Total Expenses',
                                explanation: 'Because collectors might hold onto "In Transit" cash, this represents the true liquidity increase to the main branch.'
                            })} />
                        </View>
                        <Text className={`text-sm font-black ${summary.realizedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatPHP(summary.realizedProfit)}</Text>
                    </View>
                </View>

                <View className="flex-row justify-between mb-6">
                    <Pressable onPress={handleGrossInterestClick} className="w-[48%] bg-white p-5 rounded-[32px] shadow-sm border border-gray-100 active:bg-gray-50">
                        <View className="bg-emerald-100 w-10 h-10 rounded-2xl items-center justify-center mb-3">
                            <MaterialIcons name="trending-up" size={20} color="#355E3B" />
                        </View>
                        <View className="flex-row items-center">
                            <Text className="text-gray-700 text-[10px] font-bold uppercase tracking-wider">Gross Interest</Text>
                            <InfoIcon onPress={() => setInfoContent({
                                title: 'Gross Interest Collected',
                                question: 'How much total money (principal + interest) did borrowers pay this month?',
                                formula: 'Sum of all payments made during this reporting period',
                                explanation: 'This includes both the return of capital (principal) and the earnings (interest).'
                            })} />
                        </View>
                        <Text className="text-gray-900 text-lg font-black mt-1">{formatPHP(summary.totalIncome)}</Text>
                        <Text className="text-gray-700 text-[9px] mt-1">{summary.paymentCount} payments</Text>
                    </Pressable>

                    <Pressable onPress={handleExpensesClick} className="w-[48%] bg-white p-5 rounded-[32px] shadow-sm border border-gray-100 active:bg-gray-50">
                        <View className="bg-rose-100 w-10 h-10 rounded-2xl items-center justify-center mb-3">
                            <MaterialIcons name="trending-down" size={20} color="#E11D48" />
                        </View>
                        <View className="flex-row items-center">
                            <Text className="text-gray-700 text-[10px] font-bold uppercase tracking-wider">Total Expenses</Text>
                            <InfoIcon onPress={() => setInfoContent({
                                title: 'Total Expenses',
                                question: 'How much did we spend on operational costs this month?',
                                formula: 'Sum of all expenses recorded during this month',
                                explanation: 'Includes salaries, rent, utilities, marketing, and other overhead costs.'
                            })} />
                        </View>
                        <Text className="text-gray-900 text-lg font-black mt-1">{formatPHP(summary.totalExpenses)}</Text>
                        <Text className="text-gray-700 text-[9px] mt-1">{summary.expenseCount} entries</Text>
                    </Pressable>
                </View>

                <View className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 mb-6">
                    <Text className="text-gray-900 font-black text-lg mb-4">Performance Highlights</Text>
                    
                    <View className="space-y-4">
                        <Pressable onPress={handleInTransitClick} className="flex-row items-center justify-between py-2 border-b border-gray-50 active:bg-gray-50">
                            <View className="flex-row items-center">
                                <MaterialIcons name="local-shipping" size={20} color="#EA580C" className="mr-3" />
                                <Text className="text-gray-600 font-medium">Collection in Transit</Text>
                            </View>
                            <Text className="text-gray-900 font-bold">{formatPHP(summary.inTransit)}</Text>
                        </Pressable>

                        <View className="flex-row items-center justify-between py-2 border-b border-gray-50">
                            <View className="flex-row items-center">
                                <MaterialIcons name="account-balance-wallet" size={20} color="#2563EB" className="mr-3" />
                                <Text className="text-gray-600 font-medium">Realized Monthly Net</Text>
                            </View>
                            <Text className={`font-bold ${summary.realizedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {formatPHP(summary.realizedProfit)}
                            </Text>
                        </View>
                        
                        <View className="flex-row items-center justify-between py-2 border-b border-gray-50">
                            <View className="flex-row items-center">
                                <MaterialIcons name="account-balance" size={20} color="#64748B" className="mr-3" />
                                <Text className="text-gray-600 font-medium">Average Interest / Pmt</Text>
                            </View>
                            <Text className="text-gray-900 font-bold">
                                {summary.paymentCount > 0 ? formatPHP(summary.totalIncome / summary.paymentCount) : formatPHP(0)}
                            </Text>
                        </View>
                    </View>
                </View>

                {loading && (
                    <View className="flex-row items-center justify-center py-8">
                        <ActivityIndicator color="#0F172A" />
                        <Text className="ml-3 text-gray-700 font-medium">Crunching numbers...</Text>
                    </View>
                )}

                <Pressable
                    className="bg-slate-900 w-full py-4 rounded-xl flex-row items-center justify-center mb-8 active:bg-gray-800"
                    onPress={handleTakeSnapshot}
                >
                    <MaterialIcons name="camera" size={20} color="#FFF" />
                    <Text className="text-white font-bold ml-2">Take Financial Snapshot</Text>
                </Pressable>
            </ScrollView>

            <ReportInfoModal 
                visible={!!infoContent}
                content={infoContent}
                onClose={() => setInfoContent(null)}
            />

            <MetricBreakdownDialog
                visible={breakdownVisible}
                onClose={() => setBreakdownVisible(false)}
                {...breakdownData}
            />
        </View>
    );
}
