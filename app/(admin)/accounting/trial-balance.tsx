import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { JournalEntryService, TrialBalanceSummary } from '../../../src/services/JournalEntryService';
import { formatPHP } from '../../../src/utils/currency';

export default function TrialBalance() {
    const [summary, setSummary] = useState<TrialBalanceSummary | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const loadTrialBalance = async () => {
        try {
            const data = await JournalEntryService.getTrialBalance(new Date());
            setSummary(data);
        } catch (err) {
            console.error('Failed to load trial balance:', err);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadTrialBalance();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadTrialBalance();
        setRefreshing(false);
    };

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View className="p-6">
                {/* Header */}
                <View className="flex-row justify-between items-center mb-6">
                    <View>
                        <Text className="text-gray-900 font-black text-2xl">Trial Balance</Text>
                        <Text className="text-gray-700 text-xs font-bold mt-1 uppercase tracking-wider">
                            As of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </Text>
                    </View>

                    {summary && (
                        <View className={`px-4 py-2 rounded-full flex-row items-center ${
                            summary.isBalanced ? 'bg-emerald-100' : 'bg-red-100'
                        }`}>
                            <MaterialIcons
                                name={summary.isBalanced ? 'check-circle' : 'warning'}
                                size={16}
                                color={summary.isBalanced ? '#047857' : '#B91C1C'}
                                style={{ marginRight: 6 }}
                            />
                            <Text className={`text-xs font-black uppercase ${
                                summary.isBalanced ? 'text-emerald-800' : 'text-red-800'
                            }`}>
                                {summary.isBalanced ? 'Balanced' : 'Out of Balance'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Main Table */}
                {!summary || summary.rows.length === 0 ? (
                    <View className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm items-center">
                        <Text className="text-gray-600 text-sm font-medium">No ledger activity found to calculate trial balance.</Text>
                    </View>
                ) : (
                    <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                        {/* Table Header */}
                        <View className="flex-row bg-gray-50 p-4 border-b border-gray-100">
                            <View className="w-[15%]"><Text className="text-gray-600 text-[10px] font-bold uppercase">Code</Text></View>
                            <View className="w-[35%]"><Text className="text-gray-600 text-[10px] font-bold uppercase">Account Name</Text></View>
                            <View className="w-[25%] items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Debit</Text></View>
                            <View className="w-[25%] items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Credit</Text></View>
                        </View>

                        {/* Table Rows */}
                        {summary.rows.map((row) => (
                            <View key={row.code} className="flex-row p-4 border-b border-gray-50 items-center">
                                <View className="w-[15%]">
                                    <Text className="text-gray-700 text-xs font-bold">{row.code}</Text>
                                </View>
                                <View className="w-[35%]">
                                    <Text className="text-gray-900 font-bold text-xs">{row.name}</Text>
                                    <Text className="text-gray-600 text-[8px] font-bold uppercase mt-0.5">{row.accountType}</Text>
                                </View>
                                <View className="w-[25%] items-end">
                                    {row.totalDebit > 0 ? (
                                        <Text className="text-gray-900 font-medium text-xs">{formatPHP(row.totalDebit)}</Text>
                                    ) : (
                                        <Text className="text-gray-600 text-xs">—</Text>
                                    )}
                                </View>
                                <View className="w-[25%] items-end">
                                    {row.totalCredit > 0 ? (
                                        <Text className="text-gray-900 font-medium text-xs">{formatPHP(row.totalCredit)}</Text>
                                    ) : (
                                        <Text className="text-gray-600 text-xs">—</Text>
                                    )}
                                </View>
                            </View>
                        ))}

                        {/* Table Footer Totals */}
                        <View className="flex-row bg-gray-100 p-4 items-center">
                            <View className="w-[50%]">
                                <Text className="text-gray-900 font-black text-xs uppercase">Total Trial Balance</Text>
                            </View>
                            <View className="w-[25%] items-end">
                                <Text className="text-emerald-950 font-black text-xs">{formatPHP(summary.totalDebits)}</Text>
                            </View>
                            <View className="w-[25%] items-end">
                                <Text className="text-emerald-950 font-black text-xs">{formatPHP(summary.totalCredits)}</Text>
                            </View>
                        </View>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}
