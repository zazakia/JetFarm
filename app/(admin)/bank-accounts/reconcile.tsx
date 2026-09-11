import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '../../../src/utils/navigation';
import { database } from '../../../src/database';
import BankAccount from '../../../src/database/models/BankAccount';
import BankTransaction from '../../../src/database/models/BankTransaction';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { formatPHP } from '../../../src/utils/currency';
import { formatDate } from '../../../src/utils/dates';

export default function BankReconciliationScreen() {
    const router = useRouter();
    const { accountId } = useLocalSearchParams<{ accountId?: string }>();

    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
    const [transactions, setTransactions] = useState<BankTransaction[]>([]);
    const [clearedIds, setClearedIds] = useState<Record<string, boolean>>({});

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form inputs
    const [statementBalance, setStatementBalance] = useState('');
    const [statementDate, setStatementDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        const loadAccounts = async () => {
            try {
                const fetched = await database.collections.get<BankAccount>('bank_accounts').query().fetch();
                setAccounts(fetched);

                if (accountId) {
                    const matched = fetched.find(a => a.id === accountId);
                    if (matched) setSelectedAccount(matched);
                } else if (fetched.length > 0) {
                    setSelectedAccount(fetched[0]);
                }
            } catch (error) {
                console.error('Failed to load bank accounts:', error);
            } finally {
                setLoading(false);
            }
        };
        loadAccounts();
    }, [accountId]);

    useEffect(() => {
        if (!selectedAccount) {
            setTransactions([]);
            return;
        }

        const loadTransactions = async () => {
            setLoading(true);
            try {
                // Fetch all uncleared transactions for the selected account
                const txs = await database.collections.get<BankTransaction>('bank_transactions').query(
                    Q.where('deleted_at', Q.eq(null)),
                    Q.where('bank_account_id', selectedAccount.id),
                    Q.or(Q.where('is_cleared', null), Q.where('is_cleared', false)),
                    Q.sortBy('transaction_date', Q.desc)
                ).fetch();
                setTransactions(txs);

                // Reset checklist
                setClearedIds({});
            } catch (error) {
                console.error('Failed to load bank transactions:', error);
            } finally {
                setLoading(false);
            }
        };
        loadTransactions();
    }, [selectedAccount]);

    const toggleCleared = (id: string) => {
        setClearedIds(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Calculate balances
    const statementVal = parseFloat(statementBalance);
    const statementEndingBalance = isNaN(statementVal) ? 0 : statementVal;

    // Cleared balance calculation
    const startingBalance = selectedAccount ? selectedAccount.startingBalance : 0;
    const clearedAmt = transactions.reduce((acc, tx) => {
        if (!clearedIds[tx.id]) return acc;
        return tx.type === 'deposit' ? acc + tx.amount : acc - tx.amount;
    }, 0);
    const clearedBalance = startingBalance + clearedAmt;
    const difference = statementEndingBalance - clearedBalance;

    const handleSaveReconciliation = async () => {
        if (!selectedAccount) return;
        const selectedCount = Object.values(clearedIds).filter(Boolean).length;
        if (selectedCount === 0) {
            Alert.alert('No Cleared Transactions', 'Please check at least one transaction to clear.');
            return;
        }

        setSaving(true);
        try {
            await database.write(async () => {
                const now = Date.now();
                // Clear the transactions
                for (const tx of transactions) {
                    if (clearedIds[tx.id]) {
                        await tx.update(record => {
                            record.isCleared = true;
                            record.clearedAt = now;
                        });
                    }
                }
            });
            Alert.alert('Success', 'Bank reconciliation saved successfully.');
            safeBack(router, `/(admin)/bank-accounts/${selectedAccount.id}` as any);
        } catch (error) {
            console.error('Failed to save bank reconciliation:', error);
            Alert.alert('Error', 'Failed to save bank reconciliation.');
        } finally {
            setSaving(false);
        }
    };

    if (loading && accounts.length === 0) {
        return (
            <View className="flex-1 bg-gray-50 justify-center items-center">
                <ActivityIndicator size="large" color="#1E3A8A" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="flex-row items-center p-4 bg-white border-b border-gray-100">
                <Pressable onPress={() => safeBack(router, '/(admin)/bank-accounts')} className="p-2 -ml-2 rounded-full active:bg-gray-50">
                    <Ionicons name="arrow-back" size={24} color="#1E3A8A" />
                </Pressable>
                <View className="ml-2 flex-1">
                    <Text className="text-xl font-black text-gray-900">Bank Reconciliation</Text>
                    <Text className="text-[10px] text-gray-700 font-bold uppercase tracking-widest">Match ledger entries to bank statement</Text>
                </View>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
                {/* Account Selector */}
                <View className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-6">
                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Select Bank Account</Text>
                    <View className="flex-row flex-wrap">
                        {accounts.map(acc => (
                            <Pressable
                                key={acc.id}
                                onPress={() => setSelectedAccount(acc)}
                                className={`px-4 py-2.5 rounded-2xl border mr-2 mb-2 ${
                                    selectedAccount?.id === acc.id 
                                        ? 'bg-blue-50 border-blue-900' 
                                        : 'bg-gray-50 border-gray-100'
                                }`}
                            >
                                <Text className={`text-xs font-black ${selectedAccount?.id === acc.id ? 'text-blue-900' : 'text-gray-700'}`}>
                                    {acc.bankName} ({acc.accountName})
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {selectedAccount && (
                    <>
                        {/* Reconcile Controls */}
                        <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                            <Text className="text-sm font-extrabold text-gray-900 mb-4">Statement Details</Text>

                            <View className="flex-row gap-4 mb-4">
                                <View className="flex-1">
                                    <Text className="text-xs font-bold text-gray-500 mb-2 uppercase">Statement Date</Text>
                                    <TextInput
                                        className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-gray-900 text-sm font-semibold"
                                        placeholder="YYYY-MM-DD"
                                        value={statementDate}
                                        onChangeText={setStatementDate}
                                     placeholderTextColor="#9CA3AF"/>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-xs font-bold text-gray-500 mb-2 uppercase">Ending Balance (₱)</Text>
                                    <TextInput
                                        className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-gray-900 text-sm font-semibold"
                                        placeholder="0.00"
                                        keyboardType="numeric"
                                        value={statementBalance}
                                        onChangeText={setStatementBalance}
                                     placeholderTextColor="#9CA3AF"/>
                                </View>
                            </View>

                            {/* Summary Math */}
                            <View className="bg-gray-50 rounded-2xl p-4 mt-2">
                                <View className="flex-row justify-between mb-2">
                                    <Text className="text-xs text-gray-700">Bank Statement Ending Balance:</Text>
                                    <Text className="text-xs font-extrabold text-gray-900">{formatPHP(statementEndingBalance)}</Text>
                                </View>
                                <View className="flex-row justify-between mb-2">
                                    <Text className="text-xs text-gray-700">Book Cleared Balance:</Text>
                                    <Text className="text-xs font-extrabold text-gray-900">{formatPHP(clearedBalance)}</Text>
                                </View>
                                <View className="flex-row justify-between pt-2 border-t border-gray-200">
                                    <Text className="text-xs font-bold text-gray-800">Difference:</Text>
                                    <Text className={`text-xs font-black ${difference === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatPHP(difference)}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Uncleared Transactions Checklist */}
                        <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="text-sm font-extrabold text-gray-900">Uncleared Ledger Transactions</Text>
                                <Text className="text-xs text-gray-500 font-bold">
                                    {Object.values(clearedIds).filter(Boolean).length} / {transactions.length}
                                </Text>
                            </View>

                            {loading ? (
                                <ActivityIndicator size="small" color="#1E3A8A" className="my-8" />
                            ) : transactions.length === 0 ? (
                                <View className="items-center py-8">
                                    <MaterialIcons name="fact-check" size={48} color="#D1D5DB" />
                                    <Text className="text-gray-500 text-xs font-bold mt-2">All transactions cleared!</Text>
                                </View>
                            ) : (
                                transactions.map(tx => (
                                    <Pressable
                                        key={tx.id}
                                        onPress={() => toggleCleared(tx.id)}
                                        className="flex-row items-center justify-between mb-3 py-3 border-b border-gray-50 active:bg-gray-50/50 rounded-xl"
                                    >
                                        <View className="flex-row items-center flex-1 mr-4">
                                            <MaterialIcons
                                                name={clearedIds[tx.id] ? 'check-box' : 'check-box-outline-blank'}
                                                size={24}
                                                color={clearedIds[tx.id] ? '#1E3A8A' : '#CBD5E1'}
                                                className="mr-3"
                                            />
                                            <View className="flex-1">
                                                <Text className="text-gray-900 font-bold text-xs" numberOfLines={1}>
                                                    {tx.particulars}
                                                </Text>
                                                <Text className="text-[10px] text-gray-700 mt-0.5">
                                                    {formatDate(new Date(tx.transactionDate))}
                                                </Text>
                                            </View>
                                        </View>
                                        <View className="items-end">
                                            <Text className={`text-xs font-black ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                                                {tx.type === 'deposit' ? '+' : '-'}{formatPHP(tx.amount)}
                                            </Text>
                                        </View>
                                    </Pressable>
                                ))
                            )}
                        </View>

                        {/* Save Actions */}
                        <View className="flex-row gap-4 mb-10">
                            <Pressable
                                onPress={() => safeBack(router, `/(admin)/bank-accounts/${selectedAccount.id}` as any)}
                                className="flex-1 bg-white border border-gray-100 py-4 rounded-2xl items-center shadow-sm active:bg-gray-50"
                            >
                                <Text className="text-gray-700 font-extrabold text-xs uppercase tracking-widest">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleSaveReconciliation}
                                disabled={saving}
                                className="flex-1 bg-blue-900 py-4 rounded-2xl items-center active:bg-blue-800"
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text className="text-white font-black text-xs uppercase tracking-widest">Save Clearing</Text>
                                )}
                            </Pressable>
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}
