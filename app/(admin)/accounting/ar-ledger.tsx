import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { AccountsReceivableLedgerService, ARAgingSummary, ARLedgerLine, ARCustomerSummary } from '../../../src/services/AccountsReceivableLedgerService';
import { formatPHP } from '../../../src/utils/currency';

export default function AccountsReceivableLedger() {
    const [aging, setAging] = useState<ARAgingSummary | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Detail Modal State
    const [selectedCustomer, setSelectedCustomer] = useState<ARCustomerSummary | null>(null);
    const [ledgerLines, setLedgerLines] = useState<ARLedgerLine[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await AccountsReceivableLedgerService.getAgingSummary(new Date());
            setAging(data);
        } catch (err) {
            console.error('Failed to load AR aging:', err);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const handleSelectCustomer = async (cust: ARCustomerSummary) => {
        setSelectedCustomer(cust);
        setModalVisible(true);
        setDetailLoading(true);
        try {
            const lines = await AccountsReceivableLedgerService.getSourceLedger(cust.sourceTable, cust.customerId);
            setLedgerLines(lines);
        } catch (err) {
            console.error('Failed to load customer AR ledger:', err);
        } finally {
            setDetailLoading(false);
        }
    };

    const filteredCustomers = (aging?.customers ?? []).filter(c =>
        c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.customerId.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <View className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="bg-white border-b border-gray-100 p-4">
                <View className="flex-row justify-between items-center mb-3">
                    <View>
                        <Text className="text-gray-900 font-black text-xl">Accounts Receivable Ledger</Text>
                        <Text className="text-gray-600 text-xs font-medium">Subsidiary Debtor Ledger & Portfolio Aging</Text>
                    </View>
                    <View className="bg-blue-100 px-3 py-1 rounded-full">
                        <Text className="text-blue-900 text-[10px] font-bold uppercase">AR Subsidiary</Text>
                    </View>
                </View>

                {/* Search Bar */}
                <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2">
                    <MaterialIcons name="search" size={20} color="#9CA3AF" />
                    <TextInput
                        className="flex-1 ml-2 text-sm text-gray-900"
                        placeholder="Search debtor name or reference ID..."
                        placeholderTextColor="#9CA3AF"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#1E3A8A" />
                    <Text className="text-gray-600 text-xs font-bold mt-2">Computing Receivables Aging...</Text>
                </View>
            ) : (
                <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
                    {/* Total AR Outstanding Card */}
                    <View className="bg-blue-950 p-6 rounded-3xl mb-4 shadow-sm">
                        <Text className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">
                            Total Accounts Receivable (1100 / 1200 / 1500)
                        </Text>
                        <Text className="text-white font-black text-3xl">
                            {formatPHP(aging?.grandTotal ?? 0)}
                        </Text>
                        <Text className="text-blue-300 text-[10px] mt-2">
                            {aging?.customers.length ?? 0} active accounts with unpaid balances
                        </Text>
                    </View>

                    {/* Aging Buckets Row */}
                    <View className="flex-row flex-wrap justify-between mb-4">
                        <View className="w-[18%] bg-white p-2.5 rounded-2xl border border-gray-100 items-center">
                            <Text className="text-gray-600 text-[9px] font-bold uppercase">Current</Text>
                            <Text className="text-emerald-700 font-bold text-[11px] mt-1">{formatPHP(aging?.totalCurrent ?? 0)}</Text>
                        </View>
                        <View className="w-[18%] bg-white p-2.5 rounded-2xl border border-gray-100 items-center">
                            <Text className="text-gray-600 text-[9px] font-bold uppercase">1-30d</Text>
                            <Text className="text-blue-900 font-bold text-[11px] mt-1">{formatPHP(aging?.total1to30 ?? 0)}</Text>
                        </View>
                        <View className="w-[18%] bg-white p-2.5 rounded-2xl border border-gray-100 items-center">
                            <Text className="text-gray-600 text-[9px] font-bold uppercase">31-60d</Text>
                            <Text className="text-amber-700 font-bold text-[11px] mt-1">{formatPHP(aging?.total31to60 ?? 0)}</Text>
                        </View>
                        <View className="w-[18%] bg-white p-2.5 rounded-2xl border border-gray-100 items-center">
                            <Text className="text-gray-600 text-[9px] font-bold uppercase">61-90d</Text>
                            <Text className="text-orange-700 font-bold text-[11px] mt-1">{formatPHP(aging?.total61to90 ?? 0)}</Text>
                        </View>
                        <View className="w-[18%] bg-white p-2.5 rounded-2xl border border-gray-100 items-center">
                            <Text className="text-gray-600 text-[9px] font-bold uppercase">&gt;90d</Text>
                            <Text className="text-red-700 font-bold text-[11px] mt-1">{formatPHP(aging?.totalOver90 ?? 0)}</Text>
                        </View>
                    </View>

                    {/* Customer AR Cards */}
                    <Text className="text-gray-900 font-black text-xs uppercase tracking-wider mb-3">
                        Outstanding Accounts ({filteredCustomers.length})
                    </Text>

                    {filteredCustomers.length === 0 ? (
                        <View className="bg-white p-8 rounded-3xl border border-gray-100 items-center justify-center">
                            <MaterialIcons name="check-circle" size={32} color="#059669" />
                            <Text className="text-gray-700 font-bold text-sm mt-2">Zero Overdue AR</Text>
                            <Text className="text-gray-600 text-xs text-center mt-1">All receivables have been settled or no matches found.</Text>
                        </View>
                    ) : (
                        filteredCustomers.map(cust => (
                            <Pressable
                                key={cust.customerId}
                                onPress={() => handleSelectCustomer(cust)}
                                className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-3 active:bg-gray-50 flex-row justify-between items-center"
                            >
                                <View className="flex-1 mr-4">
                                    <View className="flex-row items-center">
                                        <Text className="text-gray-900 font-bold text-sm">{cust.customerName}</Text>
                                        <View className="bg-gray-100 px-2 py-0.5 rounded-full ml-2">
                                            <Text className="text-gray-600 text-[8px] font-bold uppercase">{cust.sourceTable || 'manual'}</Text>
                                        </View>
                                    </View>
                                    <Text className="text-gray-600 text-[10px] mt-1">
                                        ID: {cust.customerId.substring(0, 12)}...
                                    </Text>
                                </View>
                                <View className="items-end">
                                    <Text className="text-blue-900 font-black text-sm">{formatPHP(cust.totalAR)}</Text>
                                    {cust.agingOver90 > 0 && (
                                        <Text className="text-red-600 text-[9px] font-bold mt-0.5">&gt;90 days overdue</Text>
                                    )}
                                </View>
                            </Pressable>
                        ))
                    )}
                </ScrollView>
            )}

            {/* Customer Ledger Statement Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-3xl p-6 h-[85%]">
                        <View className="flex-row justify-between items-center mb-4">
                            <View>
                                <Text className="text-gray-900 font-black text-lg">Debtor Statement of Account</Text>
                                <Text className="text-gray-600 text-xs font-medium">{selectedCustomer?.customerName}</Text>
                            </View>
                            <Pressable onPress={() => setModalVisible(false)} className="p-1">
                                <MaterialIcons name="close" size={24} color="#6B7280" />
                            </Pressable>
                        </View>

                        {detailLoading ? (
                            <View className="flex-1 justify-center items-center">
                                <ActivityIndicator size="large" color="#1E3A8A" />
                                <Text className="text-gray-600 text-xs mt-2">Loading debtor ledger...</Text>
                            </View>
                        ) : (
                            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                                <View className="bg-blue-50 p-4 rounded-2xl mb-4 border border-blue-100 flex-row justify-between items-center">
                                    <View>
                                        <Text className="text-blue-900 text-xs font-bold uppercase">Current Outstanding Balance</Text>
                                        <Text className="text-blue-950 font-black text-xl mt-0.5">{formatPHP(selectedCustomer?.totalAR ?? 0)}</Text>
                                    </View>
                                    <MaterialIcons name="account-balance-wallet" size={28} color="#1E3A8A" />
                                </View>

                                <Text className="text-gray-900 font-black text-xs uppercase tracking-wider mb-2">Transaction History</Text>

                                {ledgerLines.length === 0 ? (
                                    <Text className="text-gray-600 text-xs py-8 text-center">No individual ledger lines found.</Text>
                                ) : (
                                    ledgerLines.map((line, idx) => (
                                        <View key={idx} className="flex-row justify-between items-center py-3 border-b border-gray-50">
                                            <View className="flex-1 mr-3">
                                                <Text className="text-gray-900 font-bold text-xs">{line.referenceNumber}</Text>
                                                <Text className="text-gray-600 text-[10px] mt-0.5">{line.description}</Text>
                                                <Text className="text-gray-600 text-[9px]">
                                                    {format(new Date(line.date), 'MMM d, yyyy')} • Acct {line.accountCode}
                                                </Text>
                                            </View>
                                            <View className="items-end">
                                                {line.debit > 0 ? (
                                                    <Text className="text-red-700 font-bold text-xs">+{formatPHP(line.debit)}</Text>
                                                ) : (
                                                    <Text className="text-emerald-700 font-bold text-xs">-{formatPHP(line.credit)}</Text>
                                                )}
                                                <Text className="text-gray-900 font-bold text-[10px] mt-1">Bal: {formatPHP(line.balance)}</Text>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}
