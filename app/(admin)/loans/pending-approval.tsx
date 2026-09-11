import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import Loan from '../../../src/database/models/Loan';
import Borrower from '../../../src/database/models/Borrower';
import { formatPHP } from '../../../src/utils/currency';
import { useAuth } from '../../../src/store/AuthContext';

type PendingRow = Loan & { borrowerName: string };

export default function PendingApprovalScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [loans, setLoans] = useState<PendingRow[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            const pending = await database.collections.get<Loan>('loans').query(
                Q.where('deleted_at', Q.eq(null)),
                Q.where('status', 'pending'),
                Q.sortBy('created_at', Q.desc),
            ).fetch();
            const borrowerIds = Array.from(new Set(pending.map(l => l.borrowerId)));
            const borrowers = borrowerIds.length
                ? await database.collections.get<Borrower>('borrowers').query(Q.where('id', Q.oneOf(borrowerIds))).fetch()
                : [];
            const bMap = new Map(borrowers.map(b => [b.id, b.fullName]));
            setLoans(pending.map(l => Object.assign(l, { borrowerName: bMap.get(l.borrowerId) ?? 'Unknown' })));
        } catch (e) {
            console.error('[PendingApproval] load error:', e);
            Alert.alert('Error', 'Failed to load pending loans.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { load(); }, []));

    const approveLoan = async (loan: Loan) => {
        try {
            await database.write(async () => {
                await loan.update(l => {
                    l.status = 'active';
                    (l as any).approvedBy = user?.id ?? '';
                    (l as any).approvedAt = Date.now();
                });
            });
            if (Platform.OS === 'web') window.alert('Loan approved and disbursed.');
            else Alert.alert('Approved', 'Loan has been approved and disbursed.');
            load();
        } catch (e) {
            Alert.alert('Error', 'Failed to approve loan.');
        }
    };

    const rejectLoan = async (loan: Loan) => {
        try {
            await database.write(async () => {
                await loan.update(l => { l.status = 'rejected'; });
            });
            load();
        } catch (e) {
            Alert.alert('Error', 'Failed to reject loan.');
        }
    };

    const confirmApprove = (loan: Loan) => {
        if (Platform.OS === 'web') {
            if (window.confirm(`Approve loan ${loan.loanNumber}?`)) approveLoan(loan);
        } else {
            Alert.alert('Approve Loan', `Approve and disburse ${loan.loanNumber}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Approve', onPress: () => approveLoan(loan) },
            ]);
        }
    };

    const confirmReject = (loan: Loan) => {
        if (Platform.OS === 'web') {
            if (window.confirm(`Reject loan ${loan.loanNumber}?`)) rejectLoan(loan);
        } else {
            Alert.alert('Reject Loan', `Reject ${loan.loanNumber}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reject', style: 'destructive', onPress: () => rejectLoan(loan) },
            ]);
        }
    };

    if (loading) return <ActivityIndicator className="flex-1 bg-gray-50 pt-20" size="large" color="#1E3A8A" />;

    return (
        <View className="flex-1 bg-gray-50 p-4">
            <FlatList
                data={loans}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListHeaderComponent={
                    <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-4">
                        <Text className="text-2xl font-black text-gray-900">Pending Approval</Text>
                        <Text className="text-gray-700 mt-1">Loans awaiting business owner approval before disbursement.</Text>
                        <Text className="font-black text-orange-700 mt-2">{loans.length} pending loan{loans.length !== 1 ? 's' : ''}</Text>
                    </View>
                }
                ListEmptyComponent={
                    <View className="items-center justify-center py-20">
                        <MaterialIcons name="check-circle" size={64} color="#E5E7EB" />
                        <Text className="text-gray-500 mt-4">No pending loans</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View className="bg-white rounded-2xl p-4 mb-3 border border-orange-100">
                        <View className="flex-row justify-between items-start">
                            <Pressable onPress={() => router.push(`/(admin)/borrowers/${item.borrowerId}`)}>
                                <Text className="font-black text-blue-700 text-base underline">{item.borrowerName}</Text>
                            </Pressable>
                            <View className="bg-orange-100 px-2 py-1 rounded">
                                <Text className="text-[10px] font-black text-orange-800 uppercase">Pending</Text>
                            </View>
                        </View>
                        <Text className="text-xs text-gray-500 mt-0.5">{item.loanNumber} • {item.loanType ?? 'Standard'}</Text>
                        <View className="flex-row justify-between mt-2">
                            <View>
                                <Text className="text-[10px] text-gray-500 uppercase font-bold">Principal</Text>
                                <Text className="font-extrabold text-blue-900">{formatPHP(item.principalAmount)}</Text>
                            </View>
                            <View>
                                <Text className="text-[10px] text-gray-500 uppercase font-bold">Total</Text>
                                <Text className="font-extrabold text-red-700">{formatPHP(item.totalAmount)}</Text>
                            </View>
                            <View>
                                <Text className="text-[10px] text-gray-500 uppercase font-bold">Installment</Text>
                                <Text className="font-bold text-gray-900">{formatPHP(item.installmentAmount)}</Text>
                            </View>
                        </View>
                        <View className="flex-row mt-3 gap-2">
                            <Pressable className="flex-1 bg-green-600 rounded-xl py-2 items-center" onPress={() => confirmApprove(item)}>
                                <Text className="text-white font-bold text-xs">✓ Approve</Text>
                            </Pressable>
                            <Pressable className="flex-1 bg-red-600 rounded-xl py-2 items-center" onPress={() => confirmReject(item)}>
                                <Text className="text-white font-bold text-xs">✗ Reject</Text>
                            </Pressable>
                            <Pressable className="flex-1 bg-gray-700 rounded-xl py-2 items-center" onPress={() => router.push(`/(admin)/loans/${item.id}`)}>
                                <Text className="text-white font-bold text-xs">View</Text>
                            </Pressable>
                        </View>
                    </View>
                )}
            />
        </View>
    );
}
