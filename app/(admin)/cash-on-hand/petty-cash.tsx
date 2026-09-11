import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import CashTransaction from '../../../src/database/models/CashTransaction';
import BankAccount from '../../../src/database/models/BankAccount';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { formatPHP } from '../../../src/utils/currency';
import { formatDate } from '../../../src/utils/dates';
import { CashService } from '../../../src/services/CashService';
import { LinearGradient } from 'expo-linear-gradient';
import { safeBack } from '../../../src/utils/navigation';
import uuid from 'react-native-uuid';
import { useAuth } from '../../../src/store/AuthContext';

export default function PettyCashScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [txns, setTxns] = useState<CashTransaction[]>([]);
    const [balance, setBalance] = useState(0);
    const [startingBal, setStartingBal] = useState(0);
    const [totalIn, setTotalIn] = useState(0);
    const [totalOut, setTotalOut] = useState(0);
    const [loading, setLoading] = useState(true);

    // Beginning Balance Modal State
    const [beginningModalVisible, setBeginningModalVisible] = useState(false);
    const [beginningValue, setBeginningValue] = useState('');
    const [savingBeginning, setSavingBeginning] = useState(false);

    // Replenishment Modal State
    const [replenishModalVisible, setReplenishModalVisible] = useState(false);
    const [replenishAmount, setReplenishAmount] = useState('');
    const [replenishSource, setReplenishSource] = useState<'vault' | 'bank'>('vault');
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [selectedBankId, setSelectedBankId] = useState<string>('');
    const [replenishNotes, setReplenishNotes] = useState('');
    const [savingReplenish, setSavingReplenish] = useState(false);

    const loadData = async () => {
        try {
            const fetched = await database.collections.get<CashTransaction>('cash_transactions')
                .query(
                    Q.where('deleted_at', Q.eq(null)),
                    Q.where('is_petty_cash', true),
                    Q.sortBy('transaction_date', Q.desc)
                ).fetch();

            const banks = await database.collections.get<BankAccount>('bank_accounts')
                .query(Q.where('deleted_at', Q.eq(null))).fetch();
            setBankAccounts(banks);
            if (banks.length > 0 && !selectedBankId) {
                setSelectedBankId(banks[0].id);
            }

            const currentBal = await CashService.getPettyCashBalance();
            setTxns(fetched);
            setBalance(currentBal);

            let start = 0;
            let cin = 0;
            let cout = 0;
            fetched.forEach(t => {
                if (t.type === 'starting_balance') start += t.amount;
                else if (t.type === 'in') cin += t.amount;
                else if (t.type === 'out') cout += t.amount;
            });
            setStartingBal(start);
            setTotalIn(cin);
            setTotalOut(cout);
        } catch (error) {
            console.error('Failed to load petty cash data:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const handleSaveBeginningBalance = async () => {
        const val = parseFloat(beginningValue);
        if (isNaN(val) || val < 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount.');
            return;
        }

        setSavingBeginning(true);
        try {
            await database.write(async () => {
                const existing = await database.collections.get<CashTransaction>('cash_transactions')
                    .query(
                        Q.where('deleted_at', Q.eq(null)),
                        Q.where('is_petty_cash', true),
                        Q.where('type', 'starting_balance')
                    ).fetch();

                if (existing.length > 0) {
                    await existing[0].update(record => {
                        record.amount = val;
                        record.transactionDate = Date.now();
                        if (user?.id) record.recordedBy = user.id;
                    });
                } else {
                    await database.collections.get<CashTransaction>('cash_transactions').create((record) => {
                        record._raw.id = uuid.v4().toString();
                        record.type = 'starting_balance';
                        record.amount = val;
                        record.particulars = 'Petty Cash Beginning Balance';
                        record.transactionDate = Date.now();
                        record.isPettyCash = true;
                        if (user?.id) record.recordedBy = user.id;
                    });
                }
            });
            Alert.alert('Success', 'Beginning balance updated successfully.');
            setBeginningModalVisible(false);
            setBeginningValue('');
            loadData();
        } catch (error) {
            console.error('Failed to save beginning balance:', error);
            Alert.alert('Error', 'Failed to save beginning balance.');
        } finally {
            setSavingBeginning(false);
        }
    };

    const handleOpenBeginningModal = () => {
        const existingTx = txns.find(t => t.type === 'starting_balance');
        setBeginningValue(existingTx ? String(existingTx.amount) : '0');
        setBeginningModalVisible(true);
    };

    const handleSaveReplenishment = async () => {
        const amt = parseFloat(replenishAmount);
        if (isNaN(amt) || amt <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid replenishment amount.');
            return;
        }

        setSavingReplenish(true);
        try {
            const now = Date.now();
            await database.write(async () => {
                const cashColl = database.collections.get<CashTransaction>('cash_transactions');

                // 1. Credit Source: Outflow from Vault or Bank
                const sourceLabel = replenishSource === 'vault' ? 'Main Cash Vault' : 'Bank Transfer';
                await cashColl.create((record) => {
                    record._raw.id = uuid.v4().toString();
                    record.type = 'out';
                    record.amount = amt;
                    record.particulars = `Petty Cash Replenishment (Source: ${sourceLabel})`;
                    record.remarks = replenishNotes || 'Replenish Petty Cash Custodian Fund';
                    record.transactionDate = now;
                    record.isPettyCash = false;
                    if (user?.id) record.recordedBy = user.id;
                });

                // 2. Debit Destination: Inflow to Petty Cash Fund
                await cashColl.create((record) => {
                    record._raw.id = uuid.v4().toString();
                    record.type = 'in';
                    record.amount = amt;
                    record.particulars = `Fund Replenishment received from ${sourceLabel}`;
                    record.remarks = replenishNotes || 'Petty cash replenishment';
                    record.transactionDate = now;
                    record.isPettyCash = true;
                    if (user?.id) record.recordedBy = user.id;
                });
            });

            Alert.alert('Success', `Successfully replenished ${formatPHP(amt)} into the Petty Cash fund.`);
            setReplenishModalVisible(false);
            setReplenishAmount('');
            setReplenishNotes('');
            loadData();
        } catch (error: any) {
            console.error('Failed to replenish petty cash:', error);
            Alert.alert('Error', error.message || 'Failed to replenish petty cash fund.');
        } finally {
            setSavingReplenish(false);
        }
    };

    const renderItem = ({ item }: { item: CashTransaction }) => (
        <View className="bg-white p-4 rounded-2xl mb-3 border border-gray-100 shadow-sm flex-row items-center">
            <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${
                item.type === 'in' || item.type === 'starting_balance' ? 'bg-teal-50' : 'bg-rose-50'
            }`}>
                <MaterialIcons
                    name={item.type === 'in' || item.type === 'starting_balance' ? 'add' : 'remove'}
                    size={24}
                    color={item.type === 'in' || item.type === 'starting_balance' ? '#0F766E' : '#BE123C'}
                />
            </View>
            <View className="flex-1">
                <Text className="text-base font-bold text-gray-900">{item.particulars}</Text>
                <Text className="text-xs text-gray-700 mt-1">
                    {item.type.replace('_', ' ').toUpperCase()} • {formatDate(new Date(item.transactionDate))}
                </Text>
            </View>
            <View className="items-end pl-2">
                <Text className={`text-sm font-extrabold ${
                    item.type === 'in' || item.type === 'starting_balance' ? 'text-teal-700' : 'text-rose-700'
                }`}>
                    {item.type === 'in' || item.type === 'starting_balance' ? '+' : '-'}{formatPHP(item.amount)}
                </Text>
            </View>
        </View>
    );

    return (
        <View className="flex-1 bg-gray-50">
            {/* Header */}
            <LinearGradient
                colors={['#0F766E', '#115E59']}
                className="pt-10 pb-12 px-6 rounded-b-[40px] shadow-lg mb-6"
            >
                <View className="flex-row items-center mb-6">
                    <Pressable onPress={() => safeBack(router, '/(admin)')} className="bg-white/10 p-2.5 rounded-full mr-4 border border-white/10 active:bg-white/20">
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </Pressable>
                    <View>
                        <Text className="text-teal-100 text-xs font-bold uppercase tracking-[2px]">Financials</Text>
                        <Text className="text-white text-2xl font-black">Petty Cash Ledger</Text>
                    </View>
                </View>

                <View className="items-center py-4">
                    <Text className="text-teal-100 text-sm font-bold uppercase tracking-widest mb-1">Available Petty Cash</Text>
                    <Text className="text-4xl font-black text-white tracking-tighter">{formatPHP(balance)}</Text>
                </View>
            </LinearGradient>

            {/* Summaries & Action Buttons */}
            <View className="px-4 -mt-10 mb-6">
                <View className="bg-white rounded-3xl p-5 shadow-md border border-gray-100 flex-row justify-around mb-6">
                    <View className="items-center flex-1 border-r border-gray-100">
                        <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Beginning</Text>
                        <Text className="text-sm font-extrabold text-gray-900 mt-1">{formatPHP(startingBal)}</Text>
                    </View>
                    <View className="items-center flex-1 border-r border-gray-100">
                        <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total In</Text>
                        <Text className="text-sm font-extrabold text-teal-600 mt-1">+{formatPHP(totalIn)}</Text>
                    </View>
                    <View className="items-center flex-1">
                        <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Out</Text>
                        <Text className="text-sm font-extrabold text-rose-600 mt-1">-{formatPHP(totalOut)}</Text>
                    </View>
                </View>

                {/* Actions */}
                <View className="flex-row gap-3 mb-2">
                    <Pressable
                        onPress={() => setReplenishModalVisible(true)}
                        className="flex-1 bg-teal-700 border border-teal-800 rounded-2xl py-3 px-2 flex-row justify-center items-center shadow-sm active:bg-teal-800"
                    >
                        <MaterialIcons name="add-circle" size={18} color="#FFFFFF" className="mr-1.5" />
                        <Text className="text-white font-extrabold text-xs uppercase tracking-wider">Replenish</Text>
                    </Pressable>

                    <Pressable
                        onPress={handleOpenBeginningModal}
                        className="flex-1 bg-white border border-teal-100 rounded-2xl py-3 px-2 flex-row justify-center items-center shadow-sm active:bg-teal-50"
                    >
                        <MaterialIcons name="settings" size={18} color="#0F766E" className="mr-1.5" />
                        <Text className="text-teal-800 font-extrabold text-xs uppercase tracking-wider">Beginning</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => router.push('/(admin)/cash-on-hand/reconcile-petty-cash')}
                        className="flex-1 bg-white border border-teal-100 rounded-2xl py-3 px-2 flex-row justify-center items-center shadow-sm active:bg-teal-50"
                    >
                        <MaterialIcons name="fact-check" size={18} color="#0F766E" className="mr-1.5" />
                        <Text className="text-teal-800 font-extrabold text-xs uppercase tracking-wider">Reconcile</Text>
                    </Pressable>
                </View>
            </View>

            {/* Transactions List */}
            <View className="flex-1 px-4">
                <Text className="text-lg font-extrabold text-gray-900 mb-4 px-2">Transactions History</Text>

                {loading ? (
                    <ActivityIndicator size="large" color="#0F766E" className="mt-10" />
                ) : (
                    <FlatList
                        data={txns}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        ListEmptyComponent={
                            <View className="items-center justify-center py-10">
                                <MaterialIcons name="receipt-long" size={48} color="#9CA3AF" />
                                <Text className="text-gray-700 font-bold mt-2">No transactions recorded yet</Text>
                            </View>
                        }
                    />
                )}
            </View>

            {/* Add Entry FAB */}
            <Pressable
                onPress={() => router.push('/(admin)/cash-on-hand/new-petty-cash')}
                className="absolute bottom-6 right-6 bg-teal-700 px-6 py-4 rounded-full flex-row items-center shadow-lg active:bg-teal-800"
            >
                <MaterialIcons name="add" size={24} color="#FFFFFF" className="mr-2" />
                <Text className="text-white font-black uppercase tracking-wider">Add Entry</Text>
            </Pressable>

            {/* Replenish Petty Cash Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={replenishModalVisible}
                onRequestClose={() => setReplenishModalVisible(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/50 p-6">
                    <View className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">
                        <Text className="text-lg font-black text-gray-900 mb-1">Replenish Petty Cash Fund</Text>
                        <Text className="text-xs text-gray-600 mb-4">
                            Transfer cash from Main Vault Cash or Bank to restore the petty cash custodian balance.
                        </Text>

                        {/* Source selector */}
                        <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Funding Source</Text>
                        <View className="flex-row gap-3 mb-4">
                            <Pressable
                                onPress={() => setReplenishSource('vault')}
                                className={`flex-1 py-2.5 rounded-xl border items-center ${
                                    replenishSource === 'vault' ? 'bg-teal-50 border-teal-700' : 'bg-gray-50 border-gray-200'
                                }`}
                            >
                                <Text className={`text-xs font-bold ${replenishSource === 'vault' ? 'text-teal-900' : 'text-gray-700'}`}>
                                    Main Vault Cash
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={() => setReplenishSource('bank')}
                                className={`flex-1 py-2.5 rounded-xl border items-center ${
                                    replenishSource === 'bank' ? 'bg-teal-50 border-teal-700' : 'bg-gray-50 border-gray-200'
                                }`}
                            >
                                <Text className={`text-xs font-bold ${replenishSource === 'bank' ? 'text-teal-900' : 'text-gray-700'}`}>
                                    Bank Withdrawal
                                </Text>
                            </Pressable>
                        </View>

                        <View className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-3">
                            <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Amount (₱)</Text>
                            <TextInput
                                className="text-2xl font-black text-gray-900 p-0"
                                keyboardType="numeric"
                                value={replenishAmount}
                                onChangeText={setReplenishAmount}
                                placeholder="0.00"
                                autoFocus
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        <View className="mb-5">
                            <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Notes / Voucher Reference</Text>
                            <TextInput
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white"
                                value={replenishNotes}
                                onChangeText={setReplenishNotes}
                                placeholder="e.g. Check #1042 / Voucher PC-001"
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={() => setReplenishModalVisible(false)}
                                className="flex-1 bg-gray-100 py-3.5 rounded-2xl items-center active:bg-gray-200"
                            >
                                <Text className="text-gray-700 font-bold text-sm uppercase">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleSaveReplenishment}
                                disabled={savingReplenish}
                                className="flex-1 bg-teal-700 py-3.5 rounded-2xl items-center active:bg-teal-800"
                            >
                                {savingReplenish ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text className="text-white font-black text-sm uppercase">Replenish</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Beginning Balance Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={beginningModalVisible}
                onRequestClose={() => setBeginningModalVisible(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/50 p-6">
                    <View className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">
                        <Text className="text-lg font-black text-gray-900 mb-4">Set Petty Cash Beginning Balance</Text>
                        <Text className="text-xs text-gray-700 mb-4 leading-4">
                            Configure the starting balance of the petty cash fund. This creates a special ledger record that serves as the basis of the fund balance.
                        </Text>

                        <View className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-6">
                            <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Beginning Balance (₱)</Text>
                            <TextInput
                                className="text-2xl font-black text-gray-900 p-0"
                                keyboardType="numeric"
                                value={beginningValue}
                                onChangeText={setBeginningValue}
                                placeholder="0.00"
                                autoFocus
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        <View className="flex-row gap-4">
                            <Pressable
                                onPress={() => setBeginningModalVisible(false)}
                                className="flex-1 bg-gray-100 py-3.5 rounded-2xl items-center active:bg-gray-200"
                            >
                                <Text className="text-gray-700 font-bold text-sm uppercase">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleSaveBeginningBalance}
                                disabled={savingBeginning}
                                className="flex-1 bg-teal-700 py-3.5 rounded-2xl items-center active:bg-teal-800"
                            >
                                {savingBeginning ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text className="text-white font-black text-sm uppercase">Save</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
