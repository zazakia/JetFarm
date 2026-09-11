import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { database } from '../../../../src/database';
import { Q } from '@nozbe/watermelondb';
import LoanPenalty from '../../../../src/database/models/LoanPenalty';
import Loan from '../../../../src/database/models/Loan';
import Borrower from '../../../../src/database/models/Borrower';
import { Ionicons } from '@expo/vector-icons';
import uuid from 'react-native-uuid';
import { safeBack } from '../../../../src/utils/navigation';
import { formatPHP } from '../../../../src/utils/currency';
import { DatePicker } from '../../../../src/components/DatePicker';
import { format, parseISO } from 'date-fns';

export default function PenaltiesScreen() {
    const { id: loanId } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [penalties, setPenalties] = useState<LoanPenalty[]>([]);
    const [loan, setLoan] = useState<Loan | null>(null);
    const [borrower, setBorrower] = useState<Borrower | null>(null);
    const [loading, setLoading] = useState(true);

    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    useEffect(() => {
        if (!loanId) return;
        const fetchData = async () => {
            try {
                const l = await database.get<Loan>('loans').find(loanId);
                setLoan(l);
                const b = await database.get<Borrower>('borrowers').find(l.borrowerId);
                setBorrower(b);
                await fetchPenalties();
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [loanId]);

    const fetchPenalties = async () => {
        const list = await database.get<LoanPenalty>('loan_penalties').query(
            Q.where('deleted_at', Q.eq(null)),
            Q.where('loan_id', loanId),
            Q.sortBy('penalty_date', Q.desc)
        ).fetch();
        setPenalties(list);
    };

    const handleAdd = async () => {
        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) {
            Alert.alert('Validation Error', 'Enter a valid amount.');
            return;
        }
        if (!reason.trim()) {
            Alert.alert('Validation Error', 'Reason is required.');
            return;
        }
        try {
            await database.write(async () => {
                await database.get<LoanPenalty>('loan_penalties').create(record => {
                    record._raw.id = uuid.v4().toString();
                    record.loanId = loanId;
                    record.amount = val;
                    record.reason = reason.trim();
                    record.penaltyDate = parseISO(date).getTime();
                });
            });
            setAmount('');
            setReason('');
            await fetchPenalties();
        } catch (error) {
            console.error('Failed to add penalty', error);
            Alert.alert('Error', 'Failed to add penalty.');
        }
    };

    const handleDelete = async (penalty: LoanPenalty) => {
        Alert.alert('Confirm Delete', 'Are you sure you want to remove this penalty?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await database.write(async () => {
                            await penalty.update(record => {
                                record.deletedAt = Date.now();
                            });
                        });
                        await fetchPenalties();
                    } catch (error) {
                        console.error('Failed to delete penalty', error);
                        Alert.alert('Error', 'Failed to delete penalty.');
                    }
                }
            }
        ]);
    };

    if (loading) {
        return <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" color="#1E3A8A" /></View>;
    }

    const totalPenalties = penalties.reduce((sum, p) => sum + p.amount, 0);

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="flex-row items-center mb-6">
                <Pressable onPress={() => safeBack(router, `/`)} className="bg-white p-2 rounded-full mr-4 shadow-sm">
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </Pressable>
                <View>
                    <Text className="text-xl font-black text-gray-900">Manage Penalties</Text>
                    <Text className="text-sm text-gray-500 font-bold">{borrower?.fullName} - Loan {loan?.loanNumber}</Text>
                </View>
            </View>

            <View className="bg-red-50 p-6 rounded-3xl shadow-sm border border-red-100 mb-6 flex-row justify-between items-center">
                <View>
                    <Text className="text-red-800 text-[10px] font-black uppercase tracking-widest mb-1">Total Penalties</Text>
                    <Text className="text-2xl font-black text-red-900">{formatPHP(totalPenalties)}</Text>
                </View>
                <Ionicons name="warning" size={32} color="#DC2626" />
            </View>

            <View className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-6">
                <Text className="text-sm font-black uppercase text-gray-800 mb-4">Add Penalty</Text>
                
                <TextInput
                    className="bg-gray-50 border border-gray-200 p-3 rounded-xl mb-3 font-bold text-gray-900 text-lg"
                    placeholder="Amount (₱) *"
                    value={amount} onChangeText={setAmount}
                    keyboardType="numeric"
                 placeholderTextColor="#9CA3AF"/>
                <TextInput
                    className="bg-gray-50 border border-gray-200 p-3 rounded-xl mb-3 font-bold text-gray-900"
                    placeholder="Reason *"
                    value={reason} onChangeText={setReason}
                 placeholderTextColor="#9CA3AF"/>
                <View className="mb-4">
                    <DatePicker value={date} onChange={setDate} />
                </View>
                <Pressable onPress={handleAdd} className="bg-red-600 p-4 rounded-xl items-center flex-row justify-center active:bg-red-800">
                    <Ionicons name="add-circle" size={20} color="#FFF" className="mr-2" />
                    <Text className="text-white font-black uppercase tracking-widest ml-2">Add Penalty</Text>
                </Pressable>
            </View>

            <Text className="text-sm font-black uppercase text-gray-500 mb-4 ml-2">Penalty History</Text>
            {penalties.length === 0 ? (
                <View className="items-center py-10">
                    <Ionicons name="shield-checkmark" size={48} color="#D1D5DB" />
                    <Text className="text-gray-500 font-bold mt-2">No penalties applied.</Text>
                </View>
            ) : (
                penalties.map(p => (
                    <View key={p.id} className="bg-white p-4 rounded-2xl mb-3 flex-row justify-between items-center shadow-sm border border-gray-100">
                        <View className="flex-1">
                            <Text className="text-gray-900 font-black text-lg">{formatPHP(p.amount)}</Text>
                            <Text className="text-gray-600 font-bold text-xs mt-1">{p.reason}</Text>
                            <Text className="text-gray-400 text-[10px] uppercase mt-1">{format(new Date(p.penaltyDate), 'MMM dd, yyyy')}</Text>
                        </View>
                        <Pressable onPress={() => handleDelete(p)} className="bg-red-50 p-2 rounded-xl ml-2">
                            <Ionicons name="trash" size={20} color="#DC2626" />
                        </Pressable>
                    </View>
                ))
            )}
        </ScrollView>
    );
}
