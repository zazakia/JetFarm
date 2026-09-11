import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { JournalEntryService, LedgerLine } from '../../../src/services/JournalEntryService';
import { ChartOfAccountsService } from '../../../src/services/ChartOfAccountsService';
import ChartOfAccount from '../../../src/database/models/ChartOfAccount';
import { formatPHP } from '../../../src/utils/currency';
import { format } from 'date-fns';

export default function GeneralLedger() {
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
    const [selectedCode, setSelectedCode] = useState<string>('');
    const [ledgerLines, setLedgerLines] = useState<LedgerLine[]>([]);
    const [loading, setLoading] = useState(false);

    const loadAccounts = async () => {
        try {
            const list = await ChartOfAccountsService.getActivePostableAccounts();
            setAccounts(list);
            if (list.length > 0 && !selectedCode) {
                setSelectedCode(list[0].code);
            }
        } catch (err) {
            console.error('Failed to load postable accounts:', err);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadAccounts();
        }, [])
    );

    const loadLedger = async () => {
        if (!selectedCode) return;
        setLoading(true);
        try {
            const lines = await JournalEntryService.getLedger(selectedCode);
            setLedgerLines(lines);
        } catch (err) {
            console.error('Failed to load ledger lines:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLedger();
    }, [selectedCode]);

    return (
        <View className="flex-1 bg-gray-50">
            {/* Account Selector Bar */}
            <View className="bg-white border-b border-gray-100 p-4">
                <Text className="text-gray-600 text-xs font-bold uppercase mb-2">Select Account</Text>
                <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
                    <View className="flex-row">
                        {accounts.map(acc => (
                            <Pressable
                                key={acc.code}
                                onPress={() => setSelectedCode(acc.code)}
                                className={`px-4 py-2.5 rounded-full mr-2 border ${
                                    selectedCode === acc.code
                                        ? 'bg-blue-900 border-blue-900'
                                        : 'bg-gray-50 border-gray-200'
                                }`}
                            >
                                <Text className={`text-xs font-bold ${
                                    selectedCode === acc.code ? 'text-white' : 'text-gray-700'
                                }`}>
                                    {acc.code} — {acc.name}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {/* Ledger T-Account Rows */}
            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <Text className="text-gray-600 text-sm font-bold">Computing running balance...</Text>
                </View>
            ) : (
                <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
                    {ledgerLines.length === 0 ? (
                        <Text className="text-gray-600 text-sm text-center py-12">No transactions posted to this account.</Text>
                    ) : (
                        <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                            {/* Table Header */}
                            <View className="flex-row bg-gray-50 p-4 border-b border-gray-100">
                                <View className="w-[20%]"><Text className="text-gray-600 text-[10px] font-bold uppercase">Date</Text></View>
                                <View className="w-[30%]"><Text className="text-gray-600 text-[10px] font-bold uppercase">Reference</Text></View>
                                <View className="w-[15%] items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Debit</Text></View>
                                <View className="w-[15%] items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Credit</Text></View>
                                <View className="w-[20%] items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Balance</Text></View>
                            </View>

                            {/* Table Rows */}
                            {ledgerLines.map((line, idx) => (
                                <View key={idx} className="flex-row p-4 border-b border-gray-50 items-center">
                                    <View className="w-[20%]">
                                        <Text className="text-gray-700 text-xs font-medium">
                                            {format(new Date(line.date), 'MM/dd/yy')}
                                        </Text>
                                    </View>
                                    <View className="w-[30%] pr-2">
                                        <Text className="text-gray-900 font-bold text-xs">{line.referenceNumber}</Text>
                                        <Text className="text-gray-600 text-[9px] mt-0.5" numberOfLines={1}>
                                            {line.description}
                                        </Text>
                                    </View>
                                    <View className="w-[15%] items-end">
                                        {line.debit > 0 ? (
                                            <Text className="text-emerald-700 font-bold text-xs">{formatPHP(line.debit)}</Text>
                                        ) : (
                                            <Text className="text-gray-600 text-xs">—</Text>
                                        )}
                                    </View>
                                    <View className="w-[15%] items-end">
                                        {line.credit > 0 ? (
                                            <Text className="text-red-700 font-bold text-xs">{formatPHP(line.credit)}</Text>
                                        ) : (
                                            <Text className="text-gray-600 text-xs">—</Text>
                                        )}
                                    </View>
                                    <View className="w-[20%] items-end">
                                        <Text className="text-gray-900 font-black text-xs">{formatPHP(line.balance)}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </ScrollView>
            )}
        </View>
    );
}
