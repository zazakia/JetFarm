import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { safeBack } from '../../../src/utils/navigation';
import { database } from '../../../src/database';
import CashTransaction from '../../../src/database/models/CashTransaction';
import BankTransaction from '../../../src/database/models/BankTransaction';
import BankAccount from '../../../src/database/models/BankAccount';
import { MaterialIcons } from '@expo/vector-icons';
import uuid from 'react-native-uuid';
import { useAuth } from '../../../src/store/AuthContext';
import { BaseModelService } from '../../../src/services/BaseModelService';
import { Q } from '@nozbe/watermelondb';

type EntryCategory = 'transfer_petty_cash' | 'transfer_bank' | 'bank_withdraw';

export default function NewCashTransactionScreen() {
    const router = useRouter();
    const { user } = useAuth();

    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<EntryCategory>('transfer_petty_cash');
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [selectedBankId, setSelectedBankId] = useState<string>('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchBankAccounts = async () => {
            try {
                const accounts = await database.get<BankAccount>('bank_accounts')
                    .query(Q.where('deleted_at', Q.eq(null)))
                    .fetch();
                setBankAccounts(accounts);
                if (accounts.length > 0) {
                    setSelectedBankId(accounts[0].id);
                }
            } catch (err) {
                console.error('Failed to load bank accounts:', err);
            }
        };
        fetchBankAccounts();
    }, []);

    const handleSave = async () => {
        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) {
            Alert.alert("Error", "Please enter a valid amount.");
            return;
        }

        let finalParticulars = description.trim();
        let txnType: 'in' | 'out' = 'out';

        if (category === 'transfer_petty_cash') {
            finalParticulars = finalParticulars ? `Fund Transfer to Petty Cash: ${finalParticulars}` : 'Fund Transfer from Cash on Hand to Petty Cash';
            txnType = 'out';
        } else if (category === 'transfer_bank') {
            finalParticulars = finalParticulars ? `Fund Transfer to Bank: ${finalParticulars}` : 'Fund Transfer from Cash on Hand to Bank Account';
            txnType = 'out';
        } else if (category === 'bank_withdraw') {
            finalParticulars = finalParticulars ? `Bank Withdrawal to COH: ${finalParticulars}` : 'Withdrawal from Bank Account to Cash on Hand';
            txnType = 'in';
        }

        if (!finalParticulars) {
            Alert.alert("Error", "Please enter a description.");
            return;
        }

        setSaving(true);
        try {
            const now = Date.now();

            // 1. Create main CashTransaction
            await BaseModelService.create<CashTransaction>('cash_transactions', txn => {
                txn._raw.id = uuid.v4().toString();
                txn.particulars = finalParticulars;
                txn.amount = val;
                txn.type = txnType;
                txn.transactionDate = now;
                txn.recordedBy = user?.id || null;
            });

            // 2. If Bank Withdrawal or Transfer to Bank, create corresponding BankTransaction
            if ((category === 'bank_withdraw' || category === 'transfer_bank') && selectedBankId) {
                await BaseModelService.create<BankTransaction>('bank_transactions', bTxn => {
                    bTxn._raw.id = uuid.v4().toString();
                    bTxn.bankAccountId = selectedBankId;
                    bTxn.transactionDate = now;
                    bTxn.type = category === 'bank_withdraw' ? 'withdrawal' : 'deposit';
                    bTxn.amount = val;
                    bTxn.particulars = finalParticulars;
                });
            }

            Alert.alert("Success", "Cash entry and financial transfer recorded successfully.");
            safeBack(router, '/(admin)');
        } catch (error) {
            console.error('Failed to save cash transaction', error);
            Alert.alert("Error", "Failed to save cash entry.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <Text className="text-xl font-extrabold text-gray-900 mb-6">Cash & Fund Transfer Entry</Text>

                {/* Entry Category Selector */}
                <View className="mb-6">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Transfer Type</Text>
                    <View className="flex-row flex-wrap gap-2">
                        {[
                            { key: 'transfer_petty_cash', label: 'COH → Petty Cash' },
                            { key: 'transfer_bank', label: 'COH → Bank' },
                            { key: 'bank_withdraw', label: 'Bank Withdrawal → COH' },
                        ].map((item) => (
                            <Pressable
                                key={item.key}
                                onPress={() => {
                                    setCategory(item.key as EntryCategory);
                                }}
                                className={`px-3 py-2 rounded-xl border ${category === item.key ? 'bg-sky-50 border-sky-500' : 'bg-gray-50 border-gray-200'}`}
                            >
                                <Text className={`text-xs font-bold ${category === item.key ? 'text-sky-700' : 'text-gray-700'}`}>{item.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Bank Account Selector for Bank Transfers/Withdrawals */}
                {(category === 'transfer_bank' || category === 'bank_withdraw') && bankAccounts.length > 0 && (
                    <View className="mb-6">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Select Bank Account</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                            {bankAccounts.map((acc) => (
                                <Pressable
                                    key={acc.id}
                                    onPress={() => setSelectedBankId(acc.id)}
                                    className={`p-3 mr-2 rounded-xl border ${selectedBankId === acc.id ? 'bg-blue-50 border-blue-500' : 'bg-gray-50 border-gray-200'}`}
                                >
                                    <Text className="font-bold text-xs text-gray-900">{acc.bankName}</Text>
                                    <Text className="text-[10px] text-gray-500">{acc.accountNumber}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Amount */}
                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Amount (₱) *</Text>
                    <TextInput
                        className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 font-extrabold text-2xl"
                        value={amount} onChangeText={setAmount} keyboardType="numeric" editable={!saving}
                        placeholder="0.00"
                     placeholderTextColor="#9CA3AF"/>
                </View>

                {/* Description */}
                <View className="mb-8">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Particulars / Description</Text>
                    <TextInput
                        className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 h-24 text-top"
                        value={description} onChangeText={setDescription} editable={!saving} multiline
                        placeholder="Enter transaction details..."
                        textAlignVertical="top"
                     placeholderTextColor="#9CA3AF"/>
                </View>

                <Pressable
                    className={`w-full py-4 rounded-xl items-center flex-row justify-center ${saving ? 'bg-sky-400' : 'bg-sky-600 active:bg-sky-900'}`}
                    onPress={handleSave} disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : (
                        <>
                            <MaterialIcons name="save" size={24} color="#fff" className="mr-2" />
                            <Text className="text-white font-black text-xl uppercase tracking-wider">Submit Entry</Text>
                        </>
                    )}
                </Pressable>
            </View>
        </ScrollView>
    );
}
