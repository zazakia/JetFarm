import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { database } from '../../../../src/database';
import Borrower from '../../../../src/database/models/Borrower';
import ShareCapitalTransaction from '../../../../src/database/models/ShareCapitalTransaction';
import { ShareCapitalService } from '../../../../src/services/ShareCapitalService';
import { Ionicons } from '@expo/vector-icons';
import { safeBack } from '../../../../src/utils/navigation';
import { formatPHP } from '../../../../src/utils/currency';
import { useAuth } from '../../../../src/store/AuthContext';
import { useRolePermissions } from '../../../../src/hooks/useSettingsConfig';
import { formatDate } from '../../../../src/utils/dates';

export default function ShareCapitalScreen() {
    const { id: borrowerId } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { user, role } = useAuth();
    const { isAllowed } = useRolePermissions(role);
    const canEdit = isAllowed('action.edit');
    const canDelete = isAllowed('action.delete');

    const [transactions, setTransactions] = useState<ShareCapitalTransaction[]>([]);
    const [borrower, setBorrower] = useState<Borrower | null>(null);
    const [loading, setLoading] = useState(true);
    const [balance, setBalance] = useState({ amount: 0, shares: 0 });

    const [amount, setAmount] = useState('');
    const [type, setType] = useState<'DEPOSIT' | 'SUBSCRIPTION'>('DEPOSIT');
    const [shareType, setShareType] = useState<'COMMON' | 'PREFERRED'>('COMMON');
    const [numberOfShares, setNumberOfShares] = useState('');
    const [parValue, setParValue] = useState('100');

    // Edit modal states
    const [editingTx, setEditingTx] = useState<ShareCapitalTransaction | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [editNumberOfShares, setEditNumberOfShares] = useState('');
    const [editParValue, setEditParValue] = useState('');
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
        const list = await ShareCapitalService.getHistory(borrowerId);
        const currentBalance = await ShareCapitalService.getCurrentBalance(borrowerId);
        setTransactions(list);
        setBalance(currentBalance);
    };

    const handleSave = async () => {
        if (saving) return;
        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) {
            Alert.alert('Validation Error', 'Enter a valid amount.');
            return;
        }

        setSaving(true);
        try {
            if (type === 'SUBSCRIPTION') {
                const numShares = parseInt(numberOfShares, 10);
                const pVal = parseFloat(parValue);
                if (isNaN(numShares) || numShares <= 0 || isNaN(pVal) || pVal <= 0) {
                    Alert.alert('Validation Error', 'Enter valid number of shares and par value.');
                    setSaving(false);
                    return;
                }
                await ShareCapitalService.subscribe(borrowerId, shareType, val, numShares, pVal, user?.id || 'system', borrower?.fullName);
            } else {
                await ShareCapitalService.deposit(borrowerId, val, user?.id || 'system', borrower?.fullName);
            }

            setAmount('');
            setNumberOfShares('');
            await fetchTransactions();
        } catch (error) {
            console.error('Failed to save share capital transaction', error);
            Alert.alert('Error', 'Failed to save transaction.');
        } finally {
            setSaving(false);
        }
    };

    const handleOpenEdit = (t: ShareCapitalTransaction) => {
        if (!canEdit) {
            Alert.alert('Permission Denied', 'Your role does not have permission to edit data.');
            return;
        }
        setEditingTx(t);
        setEditAmount(t.amount ? t.amount.toString() : '');
        setEditNotes(t.notes || '');
        setEditNumberOfShares(t.numberOfShares ? t.numberOfShares.toString() : '');
        setEditParValue(t.parValue ? t.parValue.toString() : '100');
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
            const numShares = editNumberOfShares ? parseInt(editNumberOfShares, 10) : undefined;
            const pVal = editParValue ? parseFloat(editParValue) : undefined;

            await ShareCapitalService.updateTransaction(
                editingTx.id,
                {
                    amount: val,
                    numberOfShares: numShares,
                    parValue: pVal,
                    notes: editNotes.trim() || undefined,
                },
                user?.id || 'system'
            );

            setEditingTx(null);
            await fetchTransactions();
            Alert.alert('Success', 'Share capital record updated successfully.');
        } catch (error) {
            console.error('Failed to update transaction', error);
            Alert.alert('Error', 'Failed to update share capital transaction.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = (t: ShareCapitalTransaction) => {
        if (!canDelete) {
            Alert.alert('Permission Denied', 'Your role does not have permission to delete data.');
            return;
        }

        Alert.alert(
            'Confirm Delete',
            `Are you sure you want to delete this CBU record of ${formatPHP(t.amount)}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Use source-aware delete: legacy rows from savings_transactions carry _isLegacy=true
                            await ShareCapitalService.deleteTransactionById(
                                t.id,
                                (t as any)._isLegacy === true,
                                user?.id || 'system'
                            );
                            await fetchTransactions();
                            Alert.alert('Deleted', 'Record removed.');
                        } catch (error) {
                            console.error('Failed to delete transaction', error);
                            Alert.alert('Error', 'Failed to delete transaction.');
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" color="#1E3A8A" /></View>;
    }

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="flex-row items-center mb-6">
                <Pressable onPress={() => safeBack(router, `/(admin)/borrowers/${borrowerId}`)} className="bg-white p-2 rounded-full mr-4 shadow-sm">
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </Pressable>
                <View>
                    <Text className="text-xl font-black text-gray-900">Share Capital / CBU</Text>
                    <Text className="text-sm text-gray-500 font-bold">{borrower?.fullName}</Text>
                </View>
            </View>

            <View className="bg-blue-900 p-6 rounded-3xl shadow-sm border border-blue-800 mb-6 flex-row justify-between items-center" style={{ backgroundColor: '#1E3A8A' }}>
                <View>
                    <Text className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1">Total Share Capital</Text>
                    <Text className="text-3xl font-black text-white">{formatPHP(balance.amount)}</Text>
                    <Text className="text-blue-100 text-xs font-bold mt-1">Shares Owned: {balance.shares}</Text>
                </View>
                <Ionicons name="pie-chart" size={32} color="#93C5FD" />
            </View>

            <View className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mb-6">
                <Text className="text-sm font-black uppercase text-gray-800 mb-4">New Transaction</Text>
                
                <View className="flex-row rounded-xl border border-gray-200 overflow-hidden mb-4">
                    <Pressable onPress={() => setType('DEPOSIT')} className={`flex-1 p-3 items-center ${type === 'DEPOSIT' ? 'bg-blue-900' : 'bg-gray-50'}`}>
                        <Text className={`font-bold uppercase text-[11px] ${type === 'DEPOSIT' ? 'text-white' : 'text-gray-700'}`}>CBU Deposit</Text>
                    </Pressable>
                    <Pressable onPress={() => setType('SUBSCRIPTION')} className={`flex-1 p-3 items-center ${type === 'SUBSCRIPTION' ? 'bg-blue-900' : 'bg-gray-50'}`}>
                        <Text className={`font-bold uppercase text-[11px] ${type === 'SUBSCRIPTION' ? 'text-white' : 'text-gray-700'}`}>Subscription</Text>
                    </Pressable>
                </View>

                {type === 'SUBSCRIPTION' && (
                    <>
                        <View className="flex-row rounded-xl border border-gray-200 overflow-hidden mb-4">
                            <Pressable onPress={() => setShareType('COMMON')} className={`flex-1 p-2.5 items-center ${shareType === 'COMMON' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                <Text className={`font-bold uppercase text-[10px] ${shareType === 'COMMON' ? 'text-blue-900' : 'text-gray-700'}`}>Common Stock</Text>
                            </Pressable>
                            <Pressable onPress={() => setShareType('PREFERRED')} className={`flex-1 p-2.5 items-center ${shareType === 'PREFERRED' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                <Text className={`font-bold uppercase text-[10px] ${shareType === 'PREFERRED' ? 'text-blue-900' : 'text-gray-700'}`}>Preferred Stock</Text>
                            </Pressable>
                        </View>
                        <View className="flex-row gap-3 mb-4">
                            <TextInput
                                className="flex-1 bg-gray-50 border border-gray-200 p-3.5 rounded-xl font-bold text-gray-900 text-sm focus:border-blue-900"
                                placeholder="Num Shares"
                                placeholderTextColor="#9CA3AF"
                                value={numberOfShares} onChangeText={setNumberOfShares}
                                keyboardType="numeric"
                            />
                            <TextInput
                                className="flex-1 bg-gray-50 border border-gray-200 p-3.5 rounded-xl font-bold text-gray-900 text-sm focus:border-blue-900"
                                placeholder="Par Value"
                                placeholderTextColor="#9CA3AF"
                                value={parValue} onChangeText={setParValue}
                                keyboardType="numeric"
                            />
                        </View>
                    </>
                )}

                <TextInput
                    className="bg-gray-50 border border-gray-200 p-3.5 rounded-xl mb-5 font-bold text-gray-900 text-lg focus:border-blue-900"
                    placeholder="Amount Paid (₱) *"
                    placeholderTextColor="#9CA3AF"
                    value={amount} onChangeText={setAmount}
                    keyboardType="numeric"
                />

                <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    className={`p-4 rounded-xl items-center flex-row justify-center shadow-sm ${saving ? 'bg-emerald-400' : 'bg-emerald-600 active:bg-emerald-700'}`}
                >
                    {saving ? (
                        <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                        <>
                            <Ionicons name="save" size={20} color="#FFF" />
                            <Text className="text-white font-black uppercase tracking-widest ml-2">Save Transaction</Text>
                        </>
                    )}
                </Pressable>
            </View>

            <Text className="text-sm font-black uppercase text-gray-500 mb-4 ml-2">History</Text>
            {transactions.length === 0 ? (
                <View className="items-center py-12 bg-white rounded-3xl border border-gray-100 shadow-sm">
                    <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
                    <Text className="text-gray-500 font-bold mt-2">No share capital records.</Text>
                </View>
            ) : (
                transactions.map(t => (
                    <View key={t.id} className="bg-white p-4 rounded-2xl mb-3 shadow-sm border border-gray-100 flex-row items-center justify-between">
                        <View className="flex-row items-center flex-1">
                            <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${t.transactionType === 'SUBSCRIPTION' ? 'bg-blue-50' : 'bg-green-50'}`}>
                                <Ionicons 
                                    name={t.transactionType === 'SUBSCRIPTION' ? 'document-text' : 'cash'} 
                                    size={18} 
                                    color={t.transactionType === 'SUBSCRIPTION' ? '#1E3A8A' : '#16A34A'} 
                                />
                            </View>
                            <View className="flex-1 mr-2">
                                <Text className="font-bold text-gray-900 text-sm">
                                    {t.transactionType === 'SUBSCRIPTION' ? 'Share Subscription' : 'CBU Deposit'}
                                </Text>
                                <Text className="text-gray-400 text-[10px] mt-0.5">
                                    {t.transactionType === 'SUBSCRIPTION'
                                        ? `${t.numberOfShares} ${t.shareType} Shares @ ₱${t.parValue}`
                                        : 'Capital contribution'}
                                </Text>
                            </View>
                        </View>
                        <View className="items-end mr-3">
                            <Text className="text-gray-900 font-black text-sm">{formatPHP(t.amount)}</Text>
                            <Text className="text-gray-400 text-[10px] mt-0.5">{formatDate(t.transactionDate || t.createdAt)}</Text>
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
                        <Text className="text-lg font-black text-gray-900 mb-4">Edit CBU Record</Text>
                        
                        <Text className="text-xs font-bold text-gray-700 uppercase mb-1">Amount (₱)</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-200 p-3 rounded-xl mb-4 font-bold text-gray-900 text-base"
                            value={editAmount}
                            onChangeText={setEditAmount}
                            keyboardType="numeric"
                        />

                        {editingTx?.transactionType === 'SUBSCRIPTION' && (
                            <>
                                <Text className="text-xs font-bold text-gray-700 uppercase mb-1">Number of Shares</Text>
                                <TextInput
                                    className="bg-gray-50 border border-gray-200 p-3 rounded-xl mb-4 font-bold text-gray-900"
                                    value={editNumberOfShares}
                                    onChangeText={setEditNumberOfShares}
                                    keyboardType="numeric"
                                />

                                <Text className="text-xs font-bold text-gray-700 uppercase mb-1">Par Value (₱)</Text>
                                <TextInput
                                    className="bg-gray-50 border border-gray-200 p-3 rounded-xl mb-4 font-bold text-gray-900"
                                    value={editParValue}
                                    onChangeText={setEditParValue}
                                    keyboardType="numeric"
                                />
                            </>
                        )}

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
