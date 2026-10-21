import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { ChartOfAccountsService } from '../../../src/services/ChartOfAccountsService';
import { JournalEntryService } from '../../../src/services/JournalEntryService';
import { AutoPostingService } from '../../../src/services/AutoPostingService';
import { AgriFinanceAnalyticsService, AgriGLSummaryResult } from '../../../src/services/AgriFinanceAnalyticsService';
import JournalEntry from '../../../src/database/models/JournalEntry';
import { formatPHP } from '../../../src/utils/currency';
import { format } from 'date-fns';


export default function AccountingDashboard() {
    const router = useRouter();
    const [isSeeded, setIsSeeded] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([]);
    const [agriSummary, setAgriSummary] = useState<AgriGLSummaryResult | null>(null);
    
    const [summary, setSummary] = useState({
        assets: 0,
        liabilities: 0,
        equity: 0,
        income: 0,
        expenses: 0,
    });

    const handleSyncAccounting = async () => {
        setIsSyncing(true);
        try {
            const res = await AutoPostingService.backfillUnpostedTransactions();
            await loadData();
            if (res.errors.length > 0) {
                Alert.alert(
                    'Sync Completed with Warnings',
                    `Reconciled ${res.postedCount} transaction(s) to double-entry general ledger.\n\nWarnings: ${res.errors.join(', ')}`
                );
            } else {
                Alert.alert(
                    'Reconciliation Complete',
                    `Successfully posted ${res.postedCount} transaction(s) to double-entry general ledger.`
                );
            }
        } catch (err: any) {
            console.error('Failed to sync accounting:', err);
            Alert.alert('Error', 'Failed to synchronize accounting transactions.');
        } finally {
            setIsSyncing(false);
        }
    };


    const loadData = async () => {
        try {
            const seeded = await ChartOfAccountsService.isSeeded();
            setIsSeeded(seeded);

            if (seeded) {
                const now = new Date();
                const assets = await JournalEntryService.getTypeBalance('asset', now);
                const liabilities = await JournalEntryService.getTypeBalance('liability', now);
                const equity = await JournalEntryService.getTypeBalance('equity', now);
                const income = await JournalEntryService.getTypeBalance('income', now);
                const expenses = await JournalEntryService.getTypeBalance('expense', now);

                setSummary({ assets, liabilities, equity, income, expenses });

                const agri = await AgriFinanceAnalyticsService.getAgriGeneralLedgerSummary();
                setAgriSummary(agri);

                const recent = await JournalEntryService.getEntries({ limit: 10 });
                setRecentEntries(recent);
            }
        } catch (err) {
            console.error('Error loading accounting dashboard data:', err);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleSeedCoA = async () => {
        try {
            await ChartOfAccountsService.seed('System');
            await loadData();
        } catch (err) {
            console.error('Failed to seed CoA:', err);
        }
    };

    if (!isSeeded) {
        return (
            <View className="flex-1 justify-center items-center p-6 bg-gray-50">
                <View className="bg-white p-8 rounded-3xl border border-gray-100 shadow-md max-w-md items-center text-center">
                    <View className="w-16 h-16 rounded-full bg-blue-100 items-center justify-center mb-6">
                        <MaterialIcons name="menu-book" size={32} color="#1E3A8A" />
                    </View>
                    <Text className="text-gray-900 font-black text-xl mb-2 text-center">
                        Accounting System Setup
                    </Text>
                    <Text className="text-gray-600 text-sm text-center mb-6 leading-relaxed">
                        To activate the general ledger, double-entry journals, and financial reports, please initialize the standard Chart of Accounts.
                    </Text>
                    <Pressable
                        onPress={handleSeedCoA}
                        className="bg-blue-900 px-6 py-3 rounded-xl active:bg-blue-800 flex-row items-center justify-center w-full"
                    >
                        <MaterialIcons name="play-arrow" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text className="text-white font-bold text-sm">Initialize Chart of Accounts</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View className="p-6">
                {/* Dashboard Header */}
                <View className="mb-6 flex-row justify-between items-center">
                    <View>
                        <Text className="text-gray-900 font-black text-2xl">Accounting Overview</Text>
                        <Text className="text-gray-700 text-xs font-bold mt-1 uppercase tracking-wider">
                            Real-time General Ledger Summary
                        </Text>
                    </View>
                    <Pressable
                        onPress={handleSyncAccounting}
                        disabled={isSyncing}
                        className="bg-blue-900 px-4 py-2 rounded-xl flex-row items-center active:bg-blue-800"
                    >
                        {isSyncing ? (
                            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                        ) : (
                            <MaterialIcons name="sync" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        )}
                        <Text className="text-white font-bold text-xs">
                            {isSyncing ? 'Reconciling...' : 'Reconcile DB'}
                        </Text>
                    </Pressable>
                </View>


                {/* Dashboard Summary Cards */}
                <View className="flex-row flex-wrap justify-between mb-6">
                    {/* Assets Card */}
                    <View className="w-[48%] bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-4">
                        <View className="flex-row items-center mb-3">
                            <View className="w-8 h-8 rounded-xl bg-blue-100 items-center justify-center mr-2">
                                <MaterialIcons name="account-balance" size={16} color="#1E3A8A" />
                            </View>
                            <Text className="text-gray-600 font-bold text-xs uppercase tracking-wider">Assets</Text>
                        </View>
                        <Text className="text-gray-900 font-black text-lg">{formatPHP(summary.assets)}</Text>
                    </View>

                    {/* Liabilities Card */}
                    <View className="w-[48%] bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-4">
                        <View className="flex-row items-center mb-3">
                            <View className="w-8 h-8 rounded-xl bg-red-100 items-center justify-center mr-2">
                                <MaterialIcons name="account-balance-wallet" size={16} color="#B91C1C" />
                            </View>
                            <Text className="text-gray-600 font-bold text-xs uppercase tracking-wider">Liabilities</Text>
                        </View>
                        <Text className="text-gray-900 font-black text-lg">{formatPHP(summary.liabilities)}</Text>
                    </View>

                    {/* Equity Card */}
                    <View className="w-[48%] bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-4">
                        <View className="flex-row items-center mb-3">
                            <View className="w-8 h-8 rounded-xl bg-purple-100 items-center justify-center mr-2">
                                <MaterialIcons name="pie-chart" size={16} color="#7E22CE" />
                            </View>
                            <Text className="text-gray-600 font-bold text-xs uppercase tracking-wider">Equity</Text>
                        </View>
                        <Text className="text-gray-900 font-black text-lg">{formatPHP(summary.equity)}</Text>
                    </View>

                    {/* Net YTD Surplus Card */}
                    <View className="w-[48%] bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-4">
                        <View className="flex-row items-center mb-3">
                            <View className="w-8 h-8 rounded-xl bg-emerald-100 items-center justify-center mr-2">
                                <MaterialIcons name="trending-up" size={16} color="#047857" />
                            </View>
                            <Text className="text-gray-600 font-bold text-xs uppercase tracking-wider">Net Surplus</Text>
                        </View>
                        <Text className="text-gray-900 font-black text-lg">
                            {formatPHP(summary.income - summary.expenses)}
                        </Text>
                    </View>
                </View>

                {/* Operating Performance */}
                <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                    <Text className="text-gray-900 font-black text-md mb-4 uppercase tracking-wider">YTD Revenue vs Expenses</Text>
                    <View className="flex-row justify-between mb-4">
                        <View className="w-[48%] bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                            <Text className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">Total Revenue</Text>
                            <Text className="text-base font-black text-emerald-900">{formatPHP(summary.income)}</Text>
                        </View>
                        <View className="w-[48%] bg-red-50/50 p-4 rounded-2xl border border-red-100">
                            <Text className="text-[10px] text-red-600 font-bold uppercase tracking-wider mb-1">Total Expenses</Text>
                            <Text className="text-base font-black text-red-900">{formatPHP(summary.expenses)}</Text>
                        </View>
                    </View>
                </View>

                {/* Agribusiness Domain Performance (PAS 41) */}
                <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-row items-center">
                            <View className="w-8 h-8 rounded-xl bg-emerald-100 items-center justify-center mr-2.5">
                                <MaterialIcons name="agriculture" size={18} color="#047857" />
                            </View>
                            <View>
                                <Text className="text-gray-900 font-black text-md uppercase tracking-wider">Agribusiness Domain (PAS 41)</Text>
                                <Text className="text-gray-500 text-[10px] font-bold">Biological Assets & Farm Ledger Operations</Text>
                            </View>
                        </View>
                        <Pressable
                            onPress={() => router.push('/(admin)/agribusiness/accounting')}
                            className="bg-emerald-700 px-3 py-1.5 rounded-xl flex-row items-center active:bg-emerald-800"
                        >
                            <Text className="text-white text-xs font-bold mr-1">Farm Ledger</Text>
                            <MaterialIcons name="arrow-forward" size={14} color="#FFFFFF" />
                        </Pressable>
                    </View>

                    {/* Key Agri Ledger Metrics */}
                    <View className="flex-row flex-wrap justify-between mb-4">
                        <View className="w-[48%] bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100 mb-3">
                            <Text className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider mb-1">Biological Assets</Text>
                            <Text className="text-sm font-black text-emerald-900">
                                {formatPHP(agriSummary?.biologicalAssetsValue ?? 0)}
                            </Text>
                            <Text className="text-[9px] text-gray-500 mt-0.5">Acct 1240 Standing Crops</Text>
                        </View>

                        <View className="w-[48%] bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100 mb-3">
                            <Text className="text-[10px] text-blue-700 font-bold uppercase tracking-wider mb-1">Harvest Revenue</Text>
                            <Text className="text-sm font-black text-blue-900">
                                {formatPHP(agriSummary?.totalRevenue ?? 0)}
                            </Text>
                            <Text className="text-[9px] text-gray-500 mt-0.5">Acct 4140 Crop Offtake</Text>
                        </View>

                        <View className="w-[48%] bg-amber-50/50 p-3.5 rounded-2xl border border-amber-100">
                            <Text className="text-[10px] text-amber-700 font-bold uppercase tracking-wider mb-1">Direct Farm Costs</Text>
                            <Text className="text-sm font-black text-amber-900">
                                {formatPHP(agriSummary?.totalExpenses ?? 0)}
                            </Text>
                            <Text className="text-[9px] text-gray-500 mt-0.5">Land, Labor & Inputs</Text>
                        </View>

                        <View className="w-[48%] bg-purple-50/50 p-3.5 rounded-2xl border border-purple-100">
                            <Text className="text-[10px] text-purple-700 font-bold uppercase tracking-wider mb-1">Net Farm Margin</Text>
                            <Text className="text-sm font-black text-purple-900">
                                {formatPHP(agriSummary?.netSurplus ?? 0)}
                            </Text>
                            <Text className="text-[9px] text-gray-500 mt-0.5">
                                {agriSummary?.journalEntryCount ?? 0} GL farm entries
                            </Text>
                        </View>
                    </View>

                    {/* Breakdown sub-strip */}
                    <View className="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex-row justify-between">
                        <View className="items-center flex-1 border-r border-gray-200">
                            <Text className="text-[9px] text-gray-500 uppercase font-bold">Land Owner Share</Text>
                            <Text className="text-xs font-black text-gray-800 mt-0.5">
                                {formatPHP(agriSummary?.landOwnerSettlementCost ?? 0)}
                            </Text>
                        </View>
                        <View className="items-center flex-1 border-r border-gray-200">
                            <Text className="text-[9px] text-gray-500 uppercase font-bold">Field Labor</Text>
                            <Text className="text-xs font-black text-gray-800 mt-0.5">
                                {formatPHP(agriSummary?.laborCost ?? 0)}
                            </Text>
                        </View>
                        <View className="items-center flex-1">
                            <Text className="text-[9px] text-gray-500 uppercase font-bold">Farm Supplies</Text>
                            <Text className="text-xs font-black text-gray-800 mt-0.5">
                                {formatPHP(agriSummary?.farmInputExpenses ?? 0)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Books of Accounts Grid */}
                <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                    <Text className="text-gray-900 font-black text-md mb-1 uppercase tracking-wider">Books of Accounts</Text>
                    <Text className="text-gray-600 text-xs mb-4">Official subsidiary books and registers</Text>
                    
                    <View className="flex-row flex-wrap justify-between">
                        {[
                            { name: 'Cash Receipts', desc: 'CRJ Inflows', route: '/(admin)/accounting/crj', icon: 'receipt', color: '#047857', bg: 'bg-emerald-50' },
                            { name: 'Disbursements', desc: 'CDJ Outflows', route: '/(admin)/accounting/cdj', icon: 'outbox', color: '#B91C1C', bg: 'bg-red-50' },
                            { name: 'Agri Farm Journal', desc: 'PAS 41 Farm Ledger', route: '/(admin)/agribusiness/accounting', icon: 'agriculture', color: '#047857', bg: 'bg-emerald-50' },
                            { name: 'AR Ledger', desc: 'Receivables & Aging', route: '/(admin)/accounting/ar-ledger', icon: 'people-alt', color: '#1E3A8A', bg: 'bg-blue-50' },
                            { name: 'AP Journal', desc: 'Payables & Vendors', route: '/(admin)/accounting/ap-journal', icon: 'payments', color: '#B45309', bg: 'bg-amber-50' },
                            { name: 'Sales Journal', desc: 'Credit Sales (SJ)', route: '/(admin)/accounting/sales-journal', icon: 'store', color: '#4338CA', bg: 'bg-indigo-50' },
                            { name: 'Purchase Journal', desc: 'Credit Purchases (PJ)', route: '/(admin)/accounting/purchase-journal', icon: 'shopping-cart', color: '#0E7490', bg: 'bg-cyan-50' },
                            { name: 'Inventory Journal', desc: 'Stock Movements', route: '/(admin)/accounting/inventory-journal', icon: 'inventory-2', color: '#0F766E', bg: 'bg-teal-50' },
                            { name: 'Suppliers', desc: 'Vendor Masterlist', route: '/(admin)/accounting/suppliers', icon: 'business', color: '#374151', bg: 'bg-gray-100' },
                        ].map((book, idx) => (
                            <Pressable
                                key={idx}
                                onPress={() => router.push(book.route as any)}
                                className="w-[48%] bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-3 active:bg-gray-100 flex-row items-center"
                            >
                                <View className={`w-9 h-9 rounded-xl ${book.bg} items-center justify-center mr-3`}>
                                    <MaterialIcons name={book.icon as any} size={18} color={book.color} />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-gray-900 font-bold text-xs" numberOfLines={1}>{book.name}</Text>
                                    <Text className="text-gray-600 text-[10px]" numberOfLines={1}>{book.desc}</Text>
                                </View>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Recent Journal Entries */}
                <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-gray-900 font-black text-md uppercase tracking-wider">Recent Transactions</Text>
                        <Pressable onPress={() => router.push('/(admin)/accounting/journal-entries')}>
                            <Text className="text-blue-900 font-bold text-sm">View All</Text>
                        </Pressable>
                    </View>

                    {recentEntries.length === 0 ? (
                        <Text className="text-gray-600 text-sm text-center py-6">No journal entries recorded yet.</Text>
                    ) : (
                        recentEntries.map((entry) => (
                            <Pressable
                                key={entry.id}
                                onPress={() => router.push(`/(admin)/accounting/journal-entries?id=${entry.id}` as any)}
                                className="flex-row justify-between items-center py-3 border-b border-gray-50 active:bg-gray-50"
                            >
                                <View className="flex-1 mr-4">
                                    <Text className="text-gray-900 font-bold text-sm" numberOfLines={1}>
                                        {entry.description}
                                    </Text>
                                    <Text className="text-gray-600 text-[10px] font-medium mt-0.5">
                                        {entry.referenceNumber} • {format(new Date(entry.entryDate), 'MMM d, yyyy')}
                                    </Text>
                                </View>
                                <View className="items-end">
                                    <Text className="text-gray-900 font-black text-sm">
                                        {formatPHP(entry.totalDebit)}
                                    </Text>
                                    <View className="bg-blue-50 px-2 py-0.5 rounded-full mt-1">
                                        <Text className="text-blue-800 text-[8px] font-bold uppercase">
                                            {entry.entryType}
                                        </Text>
                                    </View>
                                </View>
                            </Pressable>
                        ))
                    )}
                </View>
            </View>
        </ScrollView>
    );
}
