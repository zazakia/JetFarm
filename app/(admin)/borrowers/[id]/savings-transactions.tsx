import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { database } from '../../../../src/database';
import { Q } from '@nozbe/watermelondb';
import Borrower from '../../../../src/database/models/Borrower';
import SavingsTransaction from '../../../../src/database/models/SavingsTransaction';
import { Ionicons } from '@expo/vector-icons';
import uuid from 'react-native-uuid';
import { safeBack } from '../../../../src/utils/navigation';
import { formatPHP } from '../../../../src/utils/currency';
import { DatePicker } from '../../../../src/components/DatePicker';
import { format, parseISO } from 'date-fns';
import { CooperativeSavingsService } from '../../../../src/services/CooperativeSavingsService';
import { AutoPostingService } from '../../../../src/services/AutoPostingService';
import { useAuth } from '../../../../src/store/AuthContext';
import { useRolePermissions } from '../../../../src/hooks/useSettingsConfig';

export default function SavingsTransactionsScreen() {
    const { id: borrowerId } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { user, role } = useAuth();
    const { isAllowed } = useRolePermissions(role);
    const canEdit = isAllowed('action.edit');
    const canDelete = isAllowed('action.delete');

    const [transactions, setTransactions] = useState<SavingsTransaction[]>([]);
    const [borrower, setBorrower] = useState<Borrower | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentAmb, setCurrentAmb] = useState(0);

    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [notes, setNotes] = useState('');

    // Edit Modal states
    const [editingTx, setEditingTx] = useState<SavingsTransaction | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editType, setEditType] = useState<'deposit' | 'withdrawal'>('deposit');
    const [editNotes, setEditNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!borrowerId) return;
        const fetchData = async () => {
            try {
                const b = await database.get<Borrower>('borrowers').find(borrowerId);
                setBorrower(b);
                await fetchTransactions();
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [borrowerId]);

    const fetchTransactions = async () => {
        const list = await database.get<SavingsTransaction>('savings_transactions').query(
            Q.where('deleted_at', Q.eq(null)),
            Q.where('borrower_id', borrowerId),
            Q.sortBy('date', Q.desc)
        ).fetch();
        setTransactions(list);

        const now = new Date();
        const amb = await CooperativeSavingsService.calculateAverageMonthlyBalance(borrowerId, now.getFullYear(), now.getMonth());
        setCurrentAmb(amb);
    };

    const handleAdd = async () => {
        if (saving) return;
        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) {
            Alert.alert('Validation Error', 'Enter a valid amount.');
            return;
        }
        
        setSaving(true);
        try {
            let createdId = '';
            await database.write(async () => {
                const record = await database.get<SavingsTransaction>('savings_transactions').create(r => {
                    r._raw.id = uuid.v4().toString();
                    r.borrowerId = borrowerId;
                    r.type = type;
                    r.amount = val;
                    r.date = parseISO(date).getTime();
                    r.notes = notes.trim() || null;
                });
                createdId = record.id;
            });

            // Auto-post to accounting: DR/CR Cash on Hand ↔ Savings Deposits Payable
            AutoPostingService.postSavingsTransaction({
                transactionId: createdId,
                type: type === 'deposit' ? 'deposit' : 'withdrawal',
                amount: val,
                entryDate: parseISO(date),
                borrowerName: borrower?.fullName,
            }).catch(e => console.warn('[SavingsTransactions] Auto-posting failed:', e));

            setAmount('');
            setNotes('');
            await fetchTransactions();
        } catch (error) {
            console.error('Failed to add savings transaction', error);
            Alert.alert('Error', 'Failed to save transaction.');
        } finally {
            setSaving(false);
        }
    };

    const handleOpenEdit = (tx: SavingsTransaction) => {
        if (!canEdit) {
            Alert.alert('Permission Denied', 'Your role does not have permission to edit data.');
            return;
        }
        setEditingTx(tx);
        setEditAmount(tx.amount ? tx.amount.toString() : '');
        setEditType(tx.type === 'withdrawal' || tx.type === 'withdraw_cash' || tx.type === 'withdraw_loan' ? 'withdrawal' : 'deposit');
        setEditNotes(tx.notes || '');
    };

    const handleUpdateSave = async () => {
        if (!editingTx) return;
        const val = parseFloat(editAmount);
        if (isNaN(val) || val <= 0) {
            Alert.alert('Validation Error', 'Enter a valid amount.');
            return;
        }

        setIsSubmitting(true);
        try {
            await CooperativeSavingsService.updateTransaction(
                editingTx.id,
                {
                    amount: val,
                    type: editType,
                    notes: editNotes.trim() || null,
                },
                user?.id || 'system'
            );

            setEditingTx(null);
            await fetchTransactions();
            Alert.alert('Success', 'Savings transaction updated successfully.');
        } catch (error) {
            console.error('Failed to update savings transaction', error);
            Alert.alert('Error', 'Failed to update savings transaction.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (tx: SavingsTransaction) => {
        if (!canDelete) {
            Alert.alert('Permission Denied', 'Your role does not have permission to delete data.');
            return;
        }

        Alert.alert('Confirm Delete', 'Are you sure you want to remove this transaction?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await CooperativeSavingsService.deleteTransaction(tx.id, user?.id || 'system');
                        await fetchTransactions();
                        Alert.alert('Deleted', 'Savings transaction deleted.');
                    } catch (error) {
                        console.error('Failed to delete transaction', error);
                        Alert.alert('Error', 'Failed to delete transaction.');
                    }
                }
            }
        ]);
    };

    if (loading) {
        return <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" color="#1E3A8A" /></View>;
    }

    const currentBalance = transactions.reduce((sum, t) => {
        return (t.type === 'deposit' || t.type === 'cbu' || t.type === 'cbu_deposit') ? sum + t.amount : sum - t.amount;
    }, 0);

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="flex-row items-center mb-6">
                <Pressable onPress={() => safeBack(router, `/(admin)/borrowers/${borrowerId}`)} className="bg-white p-2 rounded-full mr-4 shadow-sm">
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </Pressable>
                <View>
                    <Text className="text-xl font-black text-gray-900">Savings Ledger</Text>
                    <Text className="text-sm text-gray-500 font-bold">{borrower?.fullName}</Text>
                </View>
            </View>

            <View className="bg-blue-900 p-6 rounded-3xl shadow-sm border border-emerald-950 mb-6">
                <View className="flex-row justify-between items-center mb-4">
                    <View>
                        <Text className="text-green-100 text-[10px] font-black uppercase tracking-widest mb-1">Total Savings Balance</Text>
                        <Text className="text-3xl font-black text-white">{formatPHP(currentBalance)}</Text>
                    </View>
                    <Ionicons name="wallet" size={32} color="#4ADE80" />
                </View>
                <View className="bg-blue-900 rounded-2xl p-3 flex-row justify-between items-center">
                    <Text className="text-blue-200 text-xs font-bold uppercase">Avg. Daily Bal (This Month)</Text>
                    <Text className="text-white font-black text-sm">{formatPHP(currentAmb)}</Text>
                </View>
            </View>

            <View className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-6">
                <Text className="text-sm font-black uppercase text-gray-800 mb-4">New Transaction</Text>
                
                <View className="flex-row rounded-xl border border-gray-200 overflow-hidden mb-3">
                    <Pressable onPress={() => setType('deposit')} className={`flex-1 p-3 items-center ${type === 'deposit' ? 'bg-blue-900' : 'bg-gray-50'}`}>
                        <Text className={`font-bold uppercase text-[11px] ${type === 'deposit' ? 'text-white' : 'text-gray-700'}`}>Deposit</Text>
                    </Pressable>
                    <Pressable onPress={() => setType('withdrawal')} className={`flex-1 p-3 items-center ${type === 'withdrawal' ? 'bg-blue-900' : 'bg-gray-50'}`}>
                        <Text className={`font-bold uppercase text-[11px] ${type === 'withdrawal' ? 'text-white' : 'text-gray-700'}`}>Withdrawal</Text>
                    </Pressable>
                </View>

                <TextInput
                    className="bg-gray-50 border border-gray-200 p-3 rounded-xl mb-3 font-bold text-gray-900 text-lg"
                    placeholder="Amount (₱) *"
                    value={amount} onChangeText={setAmount}
                    keyboardType="numeric"
                 placeholderTextColor="#9CA3AF"/>
                
                <View className="mb-3">
                    <DatePicker value={date} onChange={setDate} />
                </View>

                <TextInput
                    className="bg-gray-50 border border-gray-200 p-3 rounded-xl mb-4 font-bold text-gray-900"
                    placeholder="Notes (Optional)"
                    value={notes} onChangeText={setNotes}
                 placeholderTextColor="#9CA3AF"/>

                <Pressable
                    onPress={handleAdd}
                    disabled={saving}
                    className={`p-4 rounded-xl items-center flex-row justify-center ${saving ? 'bg-blue-400' : 'bg-blue-900 active:bg-green-800'}`}
                >
                    {saving ? (
                        <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                        <>
                            <Ionicons name="save" size={20} color="#FFF" className="mr-2" />
                            <Text className="text-white font-black uppercase tracking-widest ml-2">Save</Text>
                        </>
                    )}
                </Pressable>
            </View>

            <Text className="text-sm font-black uppercase text-gray-500 mb-4 ml-2">Transaction History</Text>
            {transactions.length === 0 ? (
                <View className="items-center py-10">
                    <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
                    <Text className="text-gray-500 font-bold mt-2">No transactions recorded.</Text>
                </View>
            ) : (
                transactions.map(t => (
                    <View key={t.id} className="bg-white p-4 rounded-2xl mb-3 flex-row justify-between items-center shadow-sm border border-gray-100">
                        <View className="flex-1 mr-2">
                            <Text className={`font-black text-lg ${t.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                                {t.type === 'deposit' ? '+' : '-'}{formatPHP(t.amount)}
                            </Text>
                            {t.notes && <Text className="text-gray-600 font-bold text-xs mt-1">{t.notes}</Text>}
                            <Text className="text-gray-400 text-[10px] uppercase mt-1">{format(new Date(t.date), 'MMM dd, yyyy')}</Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                            {canEdit && (
                                <Pressable onPress={() => handleOpenEdit(t)} className="bg-blue-50 p-2 rounded-xl">
                                    <Ionicons name="pencil" size={18} color="#1E3A8A" />
                                </Pressable>
                            )}
                            {canDelete && (
                                <Pressable onPress={() => handleDelete(t)} className="bg-red-50 p-2 rounded-xl ml-1">
                                    <Ionicons name="trash" size={18} color="#DC2626" />
                                </Pressable>
                            )}
                        </View>
                    </View>
                ))
            )}

            {/* Edit Modal */}
            <Modal visible={!!editingTx} transparent animationType="fade" onRequestClose={() => setEditingTx(null)}>
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white w-full max-w-md p-6 rounded-3xl shadow-xl">
                        <Text className="text-lg font-black text-gray-900 mb-4">Edit Savings Record</Text>
                        
                        <Text className="text-xs font-bold text-gray-700 uppercase mb-1">Transaction Type</Text>
                        <View className="flex-row rounded-xl border border-gray-200 overflow-hidden mb-4">
                            <Pressable onPress={() => setEditType('deposit')} className={`flex-1 p-3 items-center ${editType === 'deposit' ? 'bg-blue-900' : 'bg-gray-50'}`}>
                                <Text className={`font-bold uppercase text-[11px] ${editType === 'deposit' ? 'text-white' : 'text-gray-700'}`}>Deposit</Text>
                            </Pressable>
                            <Pressable onPress={() => setEditType('withdrawal')} className={`flex-1 p-3 items-center ${editType === 'withdrawal' ? 'bg-blue-900' : 'bg-gray-50'}`}>
                                <Text className={`font-bold uppercase text-[11px] ${editType === 'withdrawal' ? 'text-white' : 'text-gray-700'}`}>Withdrawal</Text>
                            </Pressable>
                        </View>

                        <Text className="text-xs font-bold text-gray-700 uppercase mb-1">Amount (₱)</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-200 p-3 rounded-xl mb-4 font-bold text-gray-900 text-base"
                            value={editAmount}
                            onChangeText={setEditAmount}
                            keyboardType="numeric"
                        />

                        <Text className="text-xs font-bold text-gray-700 uppercase mb-1">Notes</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-200 p-3 rounded-xl mb-6 font-bold text-gray-900"
                            placeholder="Optional notes"
                            value={editNotes}
                            onChangeText={setEditNotes}
                         placeholderTextColor="#9CA3AF"/>

                        <View className="flex-row justify-end gap-3">
                            <Pressable
                                onPress={() => setEditingTx(null)}
                                className="px-5 py-3 rounded-xl bg-gray-100 active:bg-gray-200"
                            >
                                <Text className="font-bold text-gray-700">Cancel</Text>
                            </Pressable>

                            <Pressable
                                onPress={handleUpdateSave}
                                disabled={isSubmitting}
                                className="px-5 py-3 rounded-xl bg-blue-900 active:bg-blue-800 flex-row items-center"
                            >
                                {isSubmitting && <ActivityIndicator color="#FFF" size="small" className="mr-2" />}
                                <Text className="font-black text-white uppercase tracking-wider">Update</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}
