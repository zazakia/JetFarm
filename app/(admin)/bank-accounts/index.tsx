import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { database } from '../../../src/database';
import BankAccount from '../../../src/database/models/BankAccount';
import BankTransaction from '../../../src/database/models/BankTransaction';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPHP } from '../../../src/utils/currency';

interface AccountWithBalance {
    account: BankAccount;
    balance: number;
}

export default function BankAccountsScreen() {
    const router = useRouter();
    const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            const fetchedAccounts = await database.collections
                .get<BankAccount>('bank_accounts')
                .query(Q.where('deleted_at', Q.eq(null)))
                .fetch();

            // Batch-fetch all non-deleted transactions for these accounts
            const accountIds = fetchedAccounts.map(a => a.id);
            const allTransactions = accountIds.length > 0
                ? await database.collections
                    .get<BankTransaction>('bank_transactions')
                    .query(
                        Q.where('deleted_at', Q.eq(null)),
                        Q.where('bank_account_id', Q.oneOf(accountIds))
                    )
                    .fetch()
                : [];

            // Group transactions by account and compute running balance
            const txByAccount = new Map<string, BankTransaction[]>();
            for (const tx of allTransactions) {
                const list = txByAccount.get(tx.bankAccountId) ?? [];
                list.push(tx);
                txByAccount.set(tx.bankAccountId, list);
            }

            const accountsWithBalance: AccountWithBalance[] = fetchedAccounts.map(account => {
                const txs = txByAccount.get(account.id) ?? [];
                const balance = account.startingBalance + txs.reduce((sum, tx) => {
                    return tx.type === 'deposit' ? sum + tx.amount : sum - tx.amount;
                }, 0);
                return { account, balance };
            });

            setAccounts(accountsWithBalance);
        } catch (error) {
            console.error('Failed to load bank accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const renderItem = ({ item }: { item: AccountWithBalance }) => (
        <Pressable
            className="bg-white p-6 rounded-3xl mb-4 border border-gray-100 shadow-sm flex-row items-center active:bg-gray-50"
            onPress={() => router.push(`/(admin)/bank-accounts/${item.account.id}` as any)}
        >
            <View className="w-14 h-14 rounded-2xl bg-indigo-50 items-center justify-center mr-4">
                <MaterialIcons name="account-balance" size={28} color="#1E3A8A" />
            </View>
            <View className="flex-1">
                <Text className="text-lg font-black text-gray-900">{item.account.bankName}</Text>
                <Text className="text-xs text-gray-700 font-bold uppercase tracking-widest">{item.account.decryptedAccountNumber}</Text>
                <Text className="text-gray-700 text-[10px] mt-1">{item.account.accountName}</Text>
            </View>
            <View className="items-end">
                <Text className="text-sm font-bold text-gray-700 uppercase tracking-tighter mb-1">Balance</Text>
                <Text className={`text-lg font-black ${item.balance < 0 ? 'text-red-600' : 'text-blue-900'}`}>
                    {formatPHP(item.balance)}
                </Text>
            </View>
        </Pressable>
    );

    return (
        <View className="flex-1 bg-gray-50 p-4">
            <View className="mb-6 px-2">
                <Text className="text-2xl font-black text-gray-900">Bank Accounts</Text>
                <Text className="text-gray-700 font-medium">Manage institutional funds</Text>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#1E3A8A" className="mt-10" />
            ) : (
                <FlatList
                    data={accounts}
                    keyExtractor={(item) => item.account.id}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View className="items-center justify-center py-20">
                            <MaterialIcons name="savings" size={64} color="#E5E7EB" />
                            <Text className="text-gray-700 font-medium mt-4 text-base">No accounts added</Text>
                        </View>
                    }
                />
            )}

            {/* FAB */}
            <Pressable
                className="absolute bottom-6 right-6 flex-row items-center bg-blue-900 px-6 py-4 rounded-full shadow-xl active:bg-blue-900"
                onPress={() => router.push('/(admin)/bank-accounts/new')}
            >
                <MaterialIcons name="add" size={24} color="#FFFFFF" className="mr-2" />
                <Text className="text-white font-black uppercase tracking-wider">Add Bank Account</Text>
            </Pressable>
        </View>
    );
}
