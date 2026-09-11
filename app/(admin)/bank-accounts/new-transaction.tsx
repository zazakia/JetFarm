import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { database } from '../../../src/database';
import BankTransaction from '../../../src/database/models/BankTransaction';
import uuid from 'react-native-uuid';
import { Ionicons } from '@expo/vector-icons';
import { safeBack } from '../../../src/utils/navigation';
import { DatePicker } from '../../../src/components/DatePicker';
import { format, parseISO } from 'date-fns';

export default function NewBankTransactionScreen() {
    const { accountId } = useLocalSearchParams<{ accountId: string }>();
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    
    const [type, setType] = useState<'deposit' | 'withdrawal' | 'transfer'>('deposit');
    const [amount, setAmount] = useState('');
    const [particulars, setParticulars] = useState('');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [remarks, setRemarks] = useState('');

    const handleSave = async () => {
        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) {
            Alert.alert("Validation", "Enter a valid amount.");
            return;
        }
        if (!particulars.trim()) {
            Alert.alert("Validation", "Particulars/Description is required.");
            return;
        }

        setSaving(true);
        try {
            await database.write(async () => {
                await database.get<BankTransaction>('bank_transactions').create(record => {
                    record._raw.id = uuid.v4().toString();
                    record.bankAccountId = accountId!;
                    record.type = type;
                    record.amount = val;
                    record.particulars = particulars.trim();
                    record.transactionDate = parseISO(date).getTime();
                    record.remarks = remarks.trim() || null;
                });
            });
            Alert.alert("Success", "Transaction recorded successfully.");
            safeBack(router, `/(admin)/bank-accounts/${accountId}`);
        } catch (error) {
            console.error("Failed to save transaction", error);
            Alert.alert("Error", "Failed to save transaction.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="flex-row items-center mb-6">
                <Pressable onPress={() => safeBack(router, `/(admin)/bank-accounts/${accountId}`)} className="bg-white p-2 rounded-full mr-4 shadow-sm">
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </Pressable>
                <Text className="text-xl font-black text-gray-900">New Transaction</Text>
            </View>

            <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Type *</Text>
                    <View className="flex-row rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                        <Pressable onPress={() => setType('deposit')} className={`flex-1 p-3 items-center ${type === 'deposit' ? 'bg-blue-900' : ''}`}>
                            <Text className={`font-bold uppercase text-[9px] text-center ${type === 'deposit' ? 'text-white' : 'text-gray-700'}`}>Cash Deposit</Text>
                        </Pressable>
                        <Pressable onPress={() => setType('withdrawal')} className={`flex-1 p-3 items-center ${type === 'withdrawal' ? 'bg-blue-900' : ''}`}>
                            <Text className={`font-bold uppercase text-[9px] text-center ${type === 'withdrawal' ? 'text-white' : 'text-gray-700'}`}>Cash Withdraw</Text>
                        </Pressable>
                        <Pressable onPress={() => setType('transfer')} className={`flex-1 p-3 items-center ${type === 'transfer' ? 'bg-blue-900' : ''}`}>
                            <Text className={`font-bold uppercase text-[9px] text-center ${type === 'transfer' ? 'text-white' : 'text-gray-700'}`}>Fund Transfer</Text>
                        </Pressable>
                    </View>
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Amount (₱) *</Text>
                    <TextInput
                        className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 font-extrabold text-2xl"
                        value={amount} onChangeText={setAmount} keyboardType="numeric" editable={!saving} placeholder="0.00"
                     placeholderTextColor="#9CA3AF"/>
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Date *</Text>
                    <DatePicker value={date} onChange={setDate} />
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Particulars *</Text>
                    <TextInput
                        className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 font-bold"
                        value={particulars} onChangeText={setParticulars} editable={!saving} placeholder="e.g. Replenish Funds"
                     placeholderTextColor="#9CA3AF"/>
                </View>

                <View className="mb-8">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Remarks</Text>
                    <TextInput
                        className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900"
                        value={remarks} onChangeText={setRemarks} editable={!saving} placeholder="Optional notes"
                     placeholderTextColor="#9CA3AF"/>
                </View>

                <Pressable
                    className={`w-full py-4 rounded-xl items-center justify-center ${saving ? 'bg-green-400' : 'bg-blue-900 active:bg-green-800'}`}
                    onPress={handleSave} disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-black text-lg uppercase tracking-wider">Save Transaction</Text>}
                </Pressable>
            </View>
        </ScrollView>
    );
}
