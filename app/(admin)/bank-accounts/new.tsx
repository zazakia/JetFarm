import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '../../../src/utils/navigation';
import { database } from '../../../src/database';
import BankAccount from '../../../src/database/models/BankAccount';
import { MaterialIcons } from '@expo/vector-icons';
import uuid from 'react-native-uuid';
import { EncryptionService } from '../../../src/services/EncryptionService';
import { BaseModelService } from '../../../src/services/BaseModelService';


export default function NewBankAccountScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id?: string }>();
    const isEditMode = !!id;

    const [bankName, setBankName] = useState('');
    const [accountName, setAccountName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [balance, setBalance] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(isEditMode);
    const [existingAccount, setExistingAccount] = useState<BankAccount | null>(null);

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                const acc = await database.get<BankAccount>('bank_accounts').find(id);
                setExistingAccount(acc);
                setBankName(acc.bankName ?? '');
                setAccountName(acc.decryptedAccountName ?? '');
                setAccountNumber(acc.decryptedAccountNumber ?? '');
                setBalance(String(acc.startingBalance ?? ''));
            } catch (e) {
                console.error('Failed to load bank account for edit', e);
                Alert.alert('Error', 'Could not load account details.');
                safeBack(router, '/(admin)/bank-accounts');
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    const handleSave = async () => {
        const bal = parseFloat(balance);
        if (!bankName || !accountNumber) {
            Alert.alert('Error', 'Bank name and account number are required.');
            return;
        }
        if (isNaN(bal)) {
            Alert.alert('Error', 'Please enter a valid starting balance.');
            return;
        }

        setSaving(true);
        try {
            if (isEditMode && existingAccount) {
                await BaseModelService.update<BankAccount>(existingAccount, acc => {
                    acc.bankName = bankName.trim();
                    acc.accountName = EncryptionService.encrypt(accountName.trim()) ?? accountName.trim();
                    acc.accountNumber = EncryptionService.encrypt(accountNumber.trim()) ?? accountNumber.trim();
                    acc.startingBalance = bal;
                });
                Alert.alert('Success', 'Bank account updated.');
                router.replace(`/(admin)/bank-accounts/${id}` as any);
            } else {
                await BaseModelService.create<BankAccount>('bank_accounts', acc => {
                    acc._raw.id = uuid.v4().toString();
                    acc.bankName = bankName.trim();
                    acc.accountName = EncryptionService.encrypt(accountName.trim()) ?? accountName.trim();
                    acc.accountNumber = EncryptionService.encrypt(accountNumber.trim()) ?? accountNumber.trim();
                    acc.startingBalance = bal;
                });
                Alert.alert('Success', 'Bank account registered.');
                safeBack(router, '/(admin)');
            }
        } catch (error) {
            console.error('Failed to save bank account', error);
            Alert.alert('Error', 'Failed to save account.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#1E3A8A" />
            </View>
        );
    }

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <Text className="text-xl font-extrabold text-gray-900 mb-6">
                    {isEditMode ? 'Edit Bank Account' : 'Setup Bank Account'}
                </Text>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Bank Name *</Text>
                    <TextInput
                        className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 font-bold"
                        value={bankName} onChangeText={setBankName} editable={!saving}
                        placeholder="e.g. BDO, BPI, GCash Business"
                     placeholderTextColor="#9CA3AF"/>
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Account Holder Name</Text>
                    <TextInput
                        className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 font-bold"
                        value={accountName} onChangeText={setAccountName} editable={!saving}
                        placeholder="Account name..."
                     placeholderTextColor="#9CA3AF"/>
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Account Number *</Text>
                    <TextInput
                        className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 font-bold"
                        value={accountNumber} onChangeText={setAccountNumber} editable={!saving}
                        placeholder="XXXX-XXXX-XXXX"
                     placeholderTextColor="#9CA3AF"/>
                </View>

                <View className="mb-8">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Starting Balance (₱) *</Text>
                    <TextInput
                        className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 font-extrabold text-2xl"
                        value={balance} onChangeText={setBalance} keyboardType="numeric" editable={!saving}
                        placeholder="0.00"
                     placeholderTextColor="#9CA3AF"/>
                </View>

                <Pressable
                    className={`w-full py-4 rounded-xl items-center flex-row justify-center ${saving ? 'bg-blue-300' : 'bg-blue-900 active:bg-blue-900'}`}
                    onPress={handleSave} disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : (
                        <>
                            <MaterialIcons name={isEditMode ? 'save' : 'account-balance'} size={24} color="#fff" className="mr-2" />
                            <Text className="text-white font-black text-xl uppercase tracking-wider">
                                {isEditMode ? 'Save Changes' : 'Add Account'}
                            </Text>
                        </>
                    )}
                </Pressable>
            </View>
        </ScrollView>
    );
}
