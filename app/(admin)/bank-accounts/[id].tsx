import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, Pressable, ActivityIndicator,
    Modal, TextInput, Alert
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { database } from '../../../src/database';
import BankAccount from '../../../src/database/models/BankAccount';
import BankTransaction from '../../../src/database/models/BankTransaction';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { formatPHP } from '../../../src/utils/currency';
import { safeBack } from '../../../src/utils/navigation';
import { format } from 'date-fns';
import { useAuth } from '../../../src/store/AuthContext';
import { useRolePermissions } from '../../../src/hooks/useSettingsConfig';
import { DatePicker } from '../../../src/components/DatePicker';

type TxType = 'deposit' | 'withdrawal' | 'transfer';

const TX_TYPES: { label: string; value: TxType }[] = [
    { label: 'Deposit', value: 'deposit' },
    { label: 'Withdrawal', value: 'withdrawal' },
    { label: 'Transfer', value: 'transfer' },
];

export default function BankAccountDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { user, role } = useAuth();
    const { isAllowed } = useRolePermissions(role);
    const canEdit = isAllowed('action.edit');
    const canDelete = isAllowed('action.delete');

    const [account, setAccount] = useState<BankAccount | null>(null);
    const [transactions, setTransactions] = useState<BankTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    // Starting balance modal
    const [beginningModalVisible, setBeginningModalVisible] = useState(false);
    const [beginningValue, setBeginningValue] = useState('');
    const [savingBeginning, setSavingBeginning] = useState(false);

    // Edit transaction modal
    const [editingTx, setEditingTx] = useState<BankTransaction | null>(null);
    const [editParticulars, setEditParticulars] = useState('');
    const [editType, setEditType] = useState<TxType>('deposit');
    const [editAmount, setEditAmount] = useState('');
    const [editRemarks, setEditRemarks] = useState('');
    const [editDate, setEditDate] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    const loadData = async () => {
        try {
            const acc = await database.get<BankAccount>('bank_accounts').find(id);
            setAccount(acc);
            const txs = await database.get<BankTransaction>('bank_transactions').query(
                Q.where('deleted_at', Q.eq(null)),
                Q.where('bank_account_id', id),
                Q.sortBy('transaction_date', Q.desc)
            ).fetch();
            setTransactions(txs);
        } catch (error) {
            console.error('Failed to load bank account details:', error);
            safeBack(router, '/(admin)/bank-accounts');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [id])
    );

    // ─── Starting Balance ────────────────────────────────────────────────────────

    const handleSaveBeginningBalance = async () => {
        const val = parseFloat(beginningValue);
        if (isNaN(val) || val < 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid amount.');
            return;
        }
        setSavingBeginning(true);
        try {
            if (account) {
                await database.write(async () => {
                    await account.update(record => {
                        record.startingBalance = val;
                    });
                });
                Alert.alert('Success', 'Starting balance updated.');
                setBeginningModalVisible(false);
                loadData();
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to update starting balance.');
        } finally {
            setSavingBeginning(false);
        }
    };

    // ─── Delete Account ──────────────────────────────────────────────────────────

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Bank Account',
            `Are you sure you want to delete "${account?.bankName}"? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await database.write(async () => {
                                await account?.update(r => {
                                    r.deletedAt = Date.now();
                                });
                            });
                            safeBack(router, '/(admin)/bank-accounts');
                        } catch {
                            Alert.alert('Error', 'Failed to delete bank account.');
                        }
                    }
                }
            ]
        );
    };

    // ─── Edit Transaction ────────────────────────────────────────────────────────

    const handleOpenEdit = (tx: BankTransaction) => {
        setEditingTx(tx);
        setEditParticulars(tx.particulars ?? '');
        setEditType((tx.type as TxType) ?? 'deposit');
        setEditAmount(String(tx.amount ?? ''));
        setEditRemarks(tx.remarks ?? '');
        setEditDate(format(new Date(tx.transactionDate), 'yyyy-MM-dd'));
    };

    const handleSaveEdit = async () => {
        if (!editingTx) return;
        const amt = parseFloat(editAmount);
        if (!editParticulars || isNaN(amt) || amt <= 0) {
            Alert.alert('Error', 'Particulars and a valid amount are required.');
            return;
        }
        setSavingEdit(true);
        try {
            await database.write(async () => {
                await editingTx.update(r => {
                    r.particulars = editParticulars.trim();
                    r.type = editType;
                    r.amount = amt;
                    r.remarks = editRemarks.trim();
                    r.transactionDate = new Date(editDate).getTime();
                });
            });
            setEditingTx(null);
            loadData();
        } catch {
            Alert.alert('Error', 'Failed to update transaction.');
        } finally {
            setSavingEdit(false);
        }
    };

    // ─── Delete Transaction ──────────────────────────────────────────────────────

    const handleDeleteTx = (tx: BankTransaction) => {
        Alert.alert(
            'Delete Transaction',
            `Delete "${tx.particulars}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await database.write(async () => {
                                await tx.update(r => { r.deletedAt = Date.now(); });
                            });
                            loadData();
                        } catch {
                            Alert.alert('Error', 'Failed to delete transaction.');
                        }
                    }
                }
            ]
        );
    };

    // ─── Render ──────────────────────────────────────────────────────────────────

    if (loading || !account) {
        return <View className="flex-1 justify-center items-center bg-gray-50"><ActivityIndicator size="large" color="#1E3A8A" /></View>;
    }

    const currentBalance = account.startingBalance + transactions.reduce((acc, tx) => {
        return tx.type === 'deposit' ? acc + tx.amount : acc - tx.amount;
    }, 0);

    return (
        <View className="flex-1 bg-gray-50">
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {/* Header */}
                <View className="flex-row items-center mb-6">
                    <Pressable onPress={() => safeBack(router, '/(admin)/bank-accounts')} className="bg-white p-2 rounded-full mr-4 shadow-sm">
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </Pressable>
                    <View className="flex-1">
                        <Text className="text-xl font-black text-gray-900">Account Ledger</Text>
                        <Text className="text-sm text-gray-500 font-bold">{account.bankName}</Text>
                    </View>
                    {canEdit && (
                        <Pressable
                            onPress={() => router.push(`/(admin)/bank-accounts/new?id=${account.id}` as any)}
                            className="bg-blue-50 p-2 rounded-xl mr-2"
                        >
                            <Ionicons name="pencil" size={20} color="#1E3A8A" />
                        </Pressable>
                    )}
                    {canDelete && (
                        <Pressable onPress={handleDeleteAccount} className="bg-red-50 p-2 rounded-xl">
                            <Ionicons name="trash" size={20} color="#DC2626" />
                        </Pressable>
                    )}
                </View>

                {/* Balance Card */}
                <View className="bg-blue-900 p-6 rounded-3xl shadow-md mb-6">
                    <Text className="text-green-100 text-[10px] font-bold uppercase tracking-widest mb-1">Current Balance</Text>
                    <Text className="text-4xl font-extrabold text-white mb-2">{formatPHP(currentBalance)}</Text>
                    <Text className="text-green-100 text-xs font-bold mb-4">{account.accountName} • {account.decryptedAccountNumber}</Text>

                    <View className="flex-row gap-3 pt-2 border-t border-white/10 flex-wrap">
                        <Pressable
                            onPress={() => {
                                setBeginningValue(String(account.startingBalance));
                                setBeginningModalVisible(true);
                            }}
                            className="bg-white/10 px-4 py-2.5 rounded-xl border border-white/10 active:bg-white/20"
                        >
                            <Text className="text-white font-bold text-xs uppercase tracking-wider">Set Beginning</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => router.push(`/(admin)/bank-accounts/reconcile?accountId=${account.id}` as any)}
                            className="bg-white/10 px-4 py-2.5 rounded-xl border border-white/10 active:bg-white/20"
                        >
                            <Text className="text-white font-bold text-xs uppercase tracking-wider">Reconcile</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Transactions */}
                <View className="flex-row justify-between items-center mb-4 px-2">
                    <Text className="text-sm font-black uppercase text-gray-500">Transactions</Text>
                </View>

                {transactions.length === 0 ? (
                    <View className="items-center py-10">
                        <MaterialIcons name="receipt-long" size={48} color="#D1D5DB" />
                        <Text className="text-gray-500 font-bold mt-2">No transactions recorded.</Text>
                    </View>
                ) : (
                    transactions.map(tx => (
                        <View key={tx.id} className="bg-white p-4 rounded-2xl mb-3 shadow-sm border border-gray-100">
                            <View className="flex-row justify-between items-start">
                                <View className="flex-1 pr-2">
                                    <View className="flex-row items-center flex-wrap gap-2 mb-1">
                                        <Text className="text-gray-900 font-black text-sm">{tx.particulars}</Text>
                                        <View className={`px-2 py-0.5 rounded-full ${
                                            tx.type === 'deposit' ? 'bg-green-50 border border-green-200' :
                                            tx.type === 'withdrawal' ? 'bg-rose-50 border border-rose-200' :
                                            'bg-blue-50 border border-blue-200'
                                        }`}>
                                            <Text className={`text-[8px] font-black uppercase ${
                                                tx.type === 'deposit' ? 'text-green-700' :
                                                tx.type === 'withdrawal' ? 'text-rose-700' :
                                                'text-blue-700'
                                            }`}>
                                                {tx.type === 'deposit' ? 'Deposit' : tx.type === 'withdrawal' ? 'Withdrawal' : 'Transfer'}
                                            </Text>
                                        </View>
                                        {tx.isCleared && (
                                            <View className="bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                                                <Text className="text-green-700 text-[8px] font-black uppercase">Cleared</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text className="text-gray-500 font-bold text-[10px] uppercase mt-1">
                                        {format(new Date(tx.transactionDate), 'MMM dd, yyyy')}
                                    </Text>
                                    {tx.remarks ? <Text className="text-gray-400 text-[10px] mt-1">{tx.remarks}</Text> : null}
                                </View>
                                <View className="items-end gap-1">
                                    <Text className={`text-lg font-black ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                                        {tx.type === 'deposit' ? '+' : '-'}{formatPHP(tx.amount)}
                                    </Text>
                                    <View className="flex-row gap-1">
                                        {canEdit && (
                                            <Pressable
                                                onPress={() => handleOpenEdit(tx)}
                                                className="bg-blue-50 p-1.5 rounded-lg"
                                            >
                                                <Ionicons name="pencil" size={14} color="#1E3A8A" />
                                            </Pressable>
                                        )}
                                        {canDelete && (
                                            <Pressable
                                                onPress={() => handleDeleteTx(tx)}
                                                className="bg-red-50 p-1.5 rounded-lg"
                                            >
                                                <Ionicons name="trash" size={14} color="#DC2626" />
                                            </Pressable>
                                        )}
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>

            {/* FAB: New Transaction */}
            <Pressable
                className="absolute bottom-6 right-6 flex-row items-center bg-blue-900 px-6 py-4 rounded-full shadow-xl active:bg-blue-950"
                onPress={() => router.push(`/(admin)/bank-accounts/new-transaction?accountId=${account.id}` as any)}
            >
                <MaterialIcons name="add" size={24} color="#FFFFFF" className="mr-2" />
                <Text className="text-white font-black uppercase tracking-wider">New Transaction</Text>
            </Pressable>

            {/* Starting Balance Modal */}
            <Modal animationType="slide" transparent visible={beginningModalVisible} onRequestClose={() => setBeginningModalVisible(false)}>
                <View className="flex-1 justify-center items-center bg-black/50 p-6">
                    <View className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">
                        <Text className="text-lg font-black text-gray-900 mb-4">Set Starting Balance</Text>
                        <Text className="text-xs text-gray-700 mb-4 leading-4">
                            Update the beginning balance of this bank account. This serves as the basis for the account balance calculation.
                        </Text>
                        <View className="bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-6">
                            <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Starting Balance (₱)</Text>
                            <TextInput
                                className="text-2xl font-black text-gray-900 p-0"
                                keyboardType="numeric"
                                value={beginningValue}
                                onChangeText={setBeginningValue}
                                placeholder="0.00"
                                autoFocus
                             placeholderTextColor="#9CA3AF"/>
                        </View>
                        <View className="flex-row gap-4">
                            <Pressable onPress={() => setBeginningModalVisible(false)} className="flex-1 bg-gray-100 py-3.5 rounded-2xl items-center active:bg-gray-200">
                                <Text className="text-gray-700 font-bold text-sm uppercase">Cancel</Text>
                            </Pressable>
                            <Pressable onPress={handleSaveBeginningBalance} disabled={savingBeginning} className="flex-1 bg-blue-900 py-3.5 rounded-2xl items-center active:bg-blue-950">
                                {savingBeginning ? <ActivityIndicator size="small" color="#FFF" /> : <Text className="text-white font-black text-sm uppercase">Save</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Edit Transaction Modal */}
            <Modal animationType="fade" transparent visible={!!editingTx} onRequestClose={() => setEditingTx(null)}>
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white w-full max-w-md p-6 rounded-3xl shadow-xl">
                        <Text className="text-lg font-black text-gray-900 mb-4">Edit Transaction</Text>

                        {/* Type selector */}
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Type</Text>
                        <View className="flex-row gap-2 mb-4">
                            {TX_TYPES.map(t => (
                                <Pressable
                                    key={t.value}
                                    onPress={() => setEditType(t.value)}
                                    className={`flex-1 py-2.5 rounded-xl items-center border ${editType === t.value ? 'bg-blue-900 border-blue-900' : 'bg-gray-50 border-gray-200'}`}
                                >
                                    <Text className={`text-xs font-black uppercase ${editType === t.value ? 'text-white' : 'text-gray-700'}`}>{t.label}</Text>
                                </Pressable>
                            ))}
                        </View>

                        {/* Date */}
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Date</Text>
                        <View className="mb-4">
                            <DatePicker value={editDate} onChange={setEditDate} />
                        </View>

                        {/* Particulars */}
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Particulars</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900 font-bold mb-4"
                            value={editParticulars}
                            onChangeText={setEditParticulars}
                            placeholder="Description..."
                         placeholderTextColor="#9CA3AF"/>

                        {/* Amount */}
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Amount (₱)</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900 font-extrabold text-xl mb-4"
                            keyboardType="numeric"
                            value={editAmount}
                            onChangeText={setEditAmount}
                            placeholder="0.00"
                         placeholderTextColor="#9CA3AF"/>

                        {/* Remarks */}
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Remarks</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-gray-900 mb-6"
                            value={editRemarks}
                            onChangeText={setEditRemarks}
                            placeholder="Optional remarks..."
                         placeholderTextColor="#9CA3AF"/>

                        <View className="flex-row gap-3">
                            <Pressable onPress={() => setEditingTx(null)} className="flex-1 bg-gray-100 py-3.5 rounded-2xl items-center">
                                <Text className="text-gray-700 font-bold text-sm uppercase">Cancel</Text>
                            </Pressable>
                            <Pressable onPress={handleSaveEdit} disabled={savingEdit} className="flex-1 bg-blue-900 py-3.5 rounded-2xl items-center">
                                {savingEdit ? <ActivityIndicator size="small" color="#FFF" /> : <Text className="text-white font-black text-sm uppercase">Save</Text>}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
