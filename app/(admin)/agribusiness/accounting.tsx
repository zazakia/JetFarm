import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import AgriCropCycle from '../../../src/database/models/AgriCropCycle';
import JournalEntry from '../../../src/database/models/JournalEntry';
import JournalEntryLine from '../../../src/database/models/JournalEntryLine';
import { AgriFinanceAnalyticsService, AgriGLSummaryResult } from '../../../src/services/AgriFinanceAnalyticsService';
import { AutoPostingService } from '../../../src/services/AutoPostingService';
import { formatPHP } from '../../../src/utils/currency';
import { format } from 'date-fns';

export default function AgribusinessAccountingScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isReconciling, setIsReconciling] = useState(false);

    const [summary, setSummary] = useState<AgriGLSummaryResult>({
        totalRevenue: 0,
        landOwnerSettlementCost: 0,
        laborCost: 0,
        farmInputExpenses: 0,
        totalExpenses: 0,
        netSurplus: 0,
        biologicalAssetsValue: 0,
        produceInventoryValue: 0,
        suppliesInventoryValue: 0,
        landOwnerPayable: 0,
        farmLaborPayable: 0,
        investorPartnerEquity: 0,
        journalEntryCount: 0,
    });

    const [cycles, setCycles] = useState<AgriCropCycle[]>([]);
    const [selectedCycleId, setSelectedCycleId] = useState<string>('all');
    const [entries, setEntries] = useState<Array<{ entry: JournalEntry; lines: JournalEntryLine[] }>>([]);

    const loadData = async () => {
        try {
            // 1. Load Crop Cycles for filtering
            const rawCycles = await database
                .get<AgriCropCycle>('agri_crop_cycles')
                .query(Q.where('deleted_at', null), Q.sortBy('planting_date', Q.desc))
                .fetch();
            setCycles(rawCycles);

            // 2. Load General Ledger summary
            const glSummary = await AgriFinanceAnalyticsService.getAgriGeneralLedgerSummary(database);
            setSummary(glSummary);

            // 3. Load Journal Entries
            const allEntries = await database
                .get<JournalEntry>('journal_entries')
                .query(
                    Q.where('deleted_at', null),
                    Q.sortBy('entry_date', Q.desc)
                )
                .fetch();

            const agriEntries: Array<{ entry: JournalEntry; lines: JournalEntryLine[] }> = [];

            for (const entry of allEntries) {
                const lines = await database
                    .get<JournalEntryLine>('journal_entry_lines')
                    .query(
                        Q.where('deleted_at', null),
                        Q.where('journal_entry_id', entry.id)
                    )
                    .fetch();

                const hasAgri = lines.some(l => 
                    l.businessUnitId === 'agribusiness' ||
                    (l.accountCode && (
                        l.accountCode.startsWith('516') ||
                        ['1240', '1245', '1246', '2035', '2036', '3015', '4140', '4145'].includes(l.accountCode)
                    ))
                );

                if (hasAgri) {
                    if (selectedCycleId === 'all') {
                        agriEntries.push({ entry, lines });
                    } else {
                        const matchesCycle = lines.some(l => l.moduleSourceId === selectedCycleId) ||
                            (entry.description && entry.description.includes(selectedCycleId));
                        if (matchesCycle) {
                            agriEntries.push({ entry, lines });
                        }
                    }
                }
            }

            setEntries(agriEntries.slice(0, 50));
        } catch (err) {
            console.error('[AgriAccounting] Error loading data:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [selectedCycleId])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleReconcile = async () => {
        setIsReconciling(true);
        try {
            const res = await AutoPostingService.backfillUnpostedTransactions();
            await loadData();
            if (res.errors.length > 0) {
                Alert.alert(
                    'Reconciliation Completed with Warnings',
                    `Posted ${res.postedCount} agribusiness and coop transaction(s) to the double-entry general ledger.\n\nWarnings: ${res.errors.join(', ')}`
                );
            } else {
                Alert.alert(
                    'Agri Ledger Synchronized',
                    `Successfully posted ${res.postedCount} transaction(s) to the double-entry general ledger. All farm operations are in balance.`
                );
            }
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to reconcile accounting.');
        } finally {
            setIsReconciling(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#047857" />
                <Text className="text-gray-500 font-medium mt-3">Loading Agribusiness General Ledger...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            contentContainerStyle={{ padding: 20 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Header Banner */}
            <View className="bg-emerald-900 rounded-3xl p-6 text-white mb-6 shadow-md">
                <View className="flex-row justify-between items-start">
                    <View>
                        <View className="flex-row items-center gap-2 mb-1">
                            <MaterialIcons name="account-balance" size={28} color="#FFFFFF" />
                            <Text className="text-white text-2xl font-black">Agri Farm General Ledger</Text>
                        </View>
                        <Text className="text-emerald-100 text-sm font-medium">
                            Double-Entry Accounting & CDA / PAS 41 Biological Asset Tracking
                        </Text>
                    </View>
                    <Pressable
                        onPress={handleReconcile}
                        disabled={isReconciling}
                        className="bg-emerald-700 px-4 py-2 rounded-xl flex-row items-center active:bg-emerald-800 border border-emerald-600 shadow-sm"
                    >
                        {isReconciling ? (
                            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                        ) : (
                            <MaterialIcons name="sync" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        )}
                        <Text className="text-white font-bold text-xs">
                            {isReconciling ? 'Reconciling...' : 'Reconcile Farm DB'}
                        </Text>
                    </Pressable>
                </View>

                {/* Status bar */}
                <View className="mt-4 bg-emerald-950/60 rounded-2xl p-4 border border-emerald-700/50 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                        <MaterialIcons name="verified" size={20} color="#34D399" />
                        <Text className="text-emerald-100 text-xs font-semibold">
                            {summary.journalEntryCount} Agribusiness Journal Entries in GL
                        </Text>
                    </View>
                    <Pressable
                        onPress={() => router.push('/(admin)/accounting/chart-of-accounts' as any)}
                        className="flex-row items-center gap-1"
                    >
                        <Text className="text-emerald-300 text-xs font-bold">View Farm CoA</Text>
                        <MaterialIcons name="chevron-right" size={16} color="#6EE7B7" />
                    </Pressable>
                </View>
            </View>

            {/* Primary KPI Grid */}
            <View className="flex-row flex-wrap gap-4 mb-6">
                {/* Revenue */}
                <View className="flex-1 min-w-[150px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">Harvest Revenue</Text>
                        <View className="w-8 h-8 rounded-lg bg-emerald-100 items-center justify-center">
                            <MaterialIcons name="trending-up" size={18} color="#047857" />
                        </View>
                    </View>
                    <Text className="text-2xl font-black text-gray-900">{formatPHP(summary.totalRevenue)}</Text>
                    <Text className="text-xs text-gray-500 mt-1">Acct 4140 • Crop Sales & Offtake</Text>
                </View>

                {/* Direct Farm Costs */}
                <View className="flex-1 min-w-[150px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Farm Costs</Text>
                        <View className="w-8 h-8 rounded-lg bg-rose-100 items-center justify-center">
                            <MaterialIcons name="payments" size={18} color="#E11D48" />
                        </View>
                    </View>
                    <Text className="text-2xl font-black text-rose-800">{formatPHP(summary.totalExpenses)}</Text>
                    <Text className="text-xs text-gray-500 mt-1">Acct 5160–5169 • Inputs, Labor, Share</Text>
                </View>

                {/* Net Farm Margin */}
                <View className="flex-1 min-w-[150px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">Net Farm Margin</Text>
                        <View className="w-8 h-8 rounded-lg bg-blue-100 items-center justify-center">
                            <MaterialIcons name="pie-chart" size={18} color="#1D4ED8" />
                        </View>
                    </View>
                    <Text className={`text-2xl font-black ${summary.netSurplus >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>
                        {formatPHP(summary.netSurplus)}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1">Operating Farm Surplus</Text>
                </View>
            </View>

            {/* Subsidiary Ledger Breakdown */}
            <View className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm mb-6">
                <Text className="text-lg font-black text-gray-900 mb-1">Agri Direct Cost Subsidiary Ledger</Text>
                <Text className="text-xs text-gray-500 mb-4">Categorized field expenditures posted to General Ledger</Text>

                <View className="gap-3">
                    <View className="flex-row justify-between items-center py-2.5 border-b border-gray-100">
                        <View className="flex-row items-center gap-2">
                            <MaterialIcons name="handshake" size={18} color="#059669" />
                            <View>
                                <Text className="text-gray-900 font-bold text-sm">Land Owner Settlements (5160)</Text>
                                <Text className="text-gray-500 text-xs">₱1/kg rate & ₱25k guaranteed minimum</Text>
                            </View>
                        </View>
                        <Text className="text-gray-900 font-black text-sm">{formatPHP(summary.landOwnerSettlementCost)}</Text>
                    </View>

                    <View className="flex-row justify-between items-center py-2.5 border-b border-gray-100">
                        <View className="flex-row items-center gap-2">
                            <MaterialIcons name="engineering" size={18} color="#0284C7" />
                            <View>
                                <Text className="text-gray-900 font-bold text-sm">Farm Field Labor & Wages (5161)</Text>
                                <Text className="text-gray-500 text-xs">Planting, weeding, harvesting wages</Text>
                            </View>
                        </View>
                        <Text className="text-gray-900 font-black text-sm">{formatPHP(summary.laborCost)}</Text>
                    </View>

                    <View className="flex-row justify-between items-center py-2.5">
                        <View className="flex-row items-center gap-2">
                            <MaterialIcons name="eco" size={18} color="#D97706" />
                            <View>
                                <Text className="text-gray-900 font-bold text-sm">Farm Inputs & Machinery (5162–5169)</Text>
                                <Text className="text-gray-500 text-xs">Fertilizers, chemicals, tractors, fuel, cuttings</Text>
                            </View>
                        </View>
                        <Text className="text-gray-900 font-black text-sm">{formatPHP(summary.farmInputExpenses)}</Text>
                    </View>
                </View>
            </View>

            {/* Partner Fund & Liabilities */}
            <View className="flex-row flex-wrap gap-4 mb-6">
                <View className="flex-1 min-w-[150px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">BioGreen Partner Equity</Text>
                    <Text className="text-xl font-black text-indigo-900 mt-1">{formatPHP(summary.investorPartnerEquity)}</Text>
                    <Text className="text-xs text-gray-500 mt-1">Acct 3015 • Partner Capital Contributed</Text>
                </View>

                <View className="flex-1 min-w-[150px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">Settlements Payable</Text>
                    <Text className="text-xl font-black text-amber-800 mt-1">{formatPHP(summary.landOwnerPayable)}</Text>
                    <Text className="text-xs text-gray-500 mt-1">Acct 2035 • Approved unpaid harvests</Text>
                </View>
            </View>

            {/* Filter by Crop Cycle */}
            <View className="flex-row justify-between items-center mb-3">
                <Text className="text-lg font-black text-gray-900">Agribusiness Journal Register</Text>
                <View className="flex-row gap-1">
                    <Pressable
                        onPress={() => setSelectedCycleId('all')}
                        className={`px-3 py-1 rounded-full border ${selectedCycleId === 'all' ? 'bg-emerald-800 border-emerald-800' : 'bg-white border-gray-300'}`}
                    >
                        <Text className={`text-xs font-bold ${selectedCycleId === 'all' ? 'text-white' : 'text-gray-700'}`}>All</Text>
                    </Pressable>
                    {cycles.slice(0, 3).map(c => (
                        <Pressable
                            key={c.id}
                            onPress={() => setSelectedCycleId(c.id)}
                            className={`px-3 py-1 rounded-full border ${selectedCycleId === c.id ? 'bg-emerald-800 border-emerald-800' : 'bg-white border-gray-300'}`}
                        >
                            <Text className={`text-xs font-bold ${selectedCycleId === c.id ? 'text-white' : 'text-gray-700'}`}>
                                {c.cycleCode.split('-').slice(1).join('-')}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </View>

            {/* Journal Entries List */}
            {entries.length === 0 ? (
                <View className="bg-white p-8 rounded-2xl border border-gray-200 items-center justify-center">
                    <MaterialIcons name="receipt-long" size={48} color="#9CA3AF" />
                    <Text className="text-gray-900 font-bold text-base mt-2">No Agri Journal Entries Found</Text>
                    <Text className="text-gray-500 text-xs text-center mt-1 mb-4">
                        Tap "Reconcile Farm DB" above to automatically generate double-entry records from your farm operations.
                    </Text>
                    <Pressable
                        onPress={handleReconcile}
                        className="bg-emerald-700 px-5 py-2.5 rounded-xl active:bg-emerald-800"
                    >
                        <Text className="text-white font-bold text-sm">Post Farm Entries Now</Text>
                    </Pressable>
                </View>
            ) : (
                <View className="bg-white rounded-3xl border border-gray-200 shadow-sm p-4 divide-y divide-gray-100">
                    {entries.map(({ entry, lines }) => (
                        <Pressable
                            key={entry.id}
                            onPress={() => router.push(`/(admin)/accounting/journal-entries?id=${entry.id}` as any)}
                            className="py-3 active:bg-gray-50"
                        >
                            <View className="flex-row justify-between items-start mb-1">
                                <View className="flex-1 mr-3">
                                    <Text className="text-gray-900 font-bold text-sm" numberOfLines={1}>
                                        {entry.description}
                                    </Text>
                                    <Text className="text-gray-500 text-xs mt-0.5">
                                        {entry.referenceNumber} • {format(new Date(entry.entryDate), 'MMM d, yyyy')} • {entry.sourceTable || 'Agri'}
                                    </Text>
                                </View>
                                <View className="items-end">
                                    <Text className="text-gray-900 font-black text-sm">
                                        {formatPHP(entry.totalDebit)}
                                    </Text>
                                    <View className="bg-emerald-100 px-2 py-0.5 rounded-full mt-1">
                                        <Text className="text-emerald-800 text-[9px] font-bold uppercase">
                                            {entry.entryType}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Line breakdown pill preview */}
                            <View className="flex-row flex-wrap gap-1.5 mt-2">
                                {lines.map(line => (
                                    <View key={line.id} className="bg-gray-100 px-2 py-0.5 rounded-md flex-row items-center gap-1">
                                        <Text className="text-gray-700 text-[10px] font-bold">{line.accountCode}</Text>
                                        <Text className="text-gray-500 text-[10px]">
                                            {line.debitAmount > 0 ? `DR ${formatPHP(line.debitAmount)}` : `CR ${formatPHP(line.creditAmount)}`}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </Pressable>
                    ))}
                </View>
            )}
        </ScrollView>
    );
}
