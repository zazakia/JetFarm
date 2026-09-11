import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { database } from '../../../../src/database';
import { Q } from '@nozbe/watermelondb';
import Guarantor from '../../../../src/database/models/Guarantor';
import Loan from '../../../../src/database/models/Loan';
import Borrower from '../../../../src/database/models/Borrower';
import { Ionicons } from '@expo/vector-icons';
import uuid from 'react-native-uuid';
import { safeBack } from '../../../../src/utils/navigation';

export default function GuarantorsScreen() {
    const { id: loanId } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
    const [loan, setLoan] = useState<Loan | null>(null);
    const [borrower, setBorrower] = useState<Borrower | null>(null);
    const [loading, setLoading] = useState(true);

    const [newName, setNewName] = useState('');
    const [newContact, setNewContact] = useState('');
    const [newRelationship, setNewRelationship] = useState('');

    useEffect(() => {
        if (!loanId) return;
        const fetchData = async () => {
            try {
                const l = await database.get<Loan>('loans').find(loanId);
                setLoan(l);
                const b = await database.get<Borrower>('borrowers').find(l.borrowerId);
                setBorrower(b);
                await fetchGuarantors();
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [loanId]);

    const fetchGuarantors = async () => {
        const list = await database.get<Guarantor>('guarantors').query(
            Q.where('deleted_at', Q.eq(null)),
            Q.where('loan_id', loanId)
        ).fetch();
        setGuarantors(list);
    };

    const handleAdd = async () => {
        if (!newName.trim()) {
            Alert.alert('Validation Error', 'Guarantor name is required.');
            return;
        }
        try {
            await database.write(async () => {
                await database.get<Guarantor>('guarantors').create(record => {
                    record._raw.id = uuid.v4().toString();
                    record.loanId = loanId;
                    record.guarantorName = newName.trim();
                    record.contactNo = newContact.trim() || null;
                    record.relationship = newRelationship.trim() || null;
                });
            });
            setNewName('');
            setNewContact('');
            setNewRelationship('');
            await fetchGuarantors();
        } catch (error) {
            console.error('Failed to add guarantor', error);
            Alert.alert('Error', 'Failed to add guarantor.');
        }
    };

    const handleDelete = async (guarantor: Guarantor) => {
        Alert.alert('Confirm Delete', 'Are you sure you want to remove this guarantor?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await database.write(async () => {
                            await guarantor.update(record => {
                                record.deletedAt = Date.now();
                            });
                        });
                        await fetchGuarantors();
                    } catch (error) {
                        console.error('Failed to delete guarantor', error);
                        Alert.alert('Error', 'Failed to delete guarantor.');
                    }
                }
            }
        ]);
    };

    if (loading) {
        return <View className="flex-1 justify-center items-center"><ActivityIndicator size="large" color="#1E3A8A" /></View>;
    }

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="flex-row items-center mb-6">
                <Pressable onPress={() => safeBack(router, '/(admin)/loans')} className="bg-white p-2 rounded-full mr-4 shadow-sm">
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </Pressable>
                <View>
                    <Text className="text-xl font-black text-gray-900">Manage Guarantors</Text>
                    <Text className="text-sm text-gray-500 font-bold">{borrower?.fullName} - Loan {loan?.loanNumber}</Text>
                </View>
            </View>

            <View className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 mb-6">
                <Text className="text-sm font-black uppercase text-gray-800 mb-4">Add Guarantor</Text>
                
                <TextInput
                    className="bg-gray-50 border border-gray-200 p-3 rounded-xl mb-3 font-bold text-gray-900"
                    placeholder="Full Name *"
                    value={newName} onChangeText={setNewName}
                 placeholderTextColor="#9CA3AF"/>
                <TextInput
                    className="bg-gray-50 border border-gray-200 p-3 rounded-xl mb-3 font-bold text-gray-900"
                    placeholder="Contact Number (Optional)"
                    value={newContact} onChangeText={setNewContact}
                    keyboardType="phone-pad"
                 placeholderTextColor="#9CA3AF"/>
                <TextInput
                    className="bg-gray-50 border border-gray-200 p-3 rounded-xl mb-4 font-bold text-gray-900"
                    placeholder="Relationship (Optional)"
                    value={newRelationship} onChangeText={setNewRelationship}
                 placeholderTextColor="#9CA3AF"/>
                <Pressable onPress={handleAdd} className="bg-blue-900 p-4 rounded-xl items-center flex-row justify-center active:bg-green-800">
                    <Ionicons name="add-circle" size={20} color="#FFF" className="mr-2" />
                    <Text className="text-white font-black uppercase tracking-widest ml-2">Add Guarantor</Text>
                </Pressable>
            </View>

            <Text className="text-sm font-black uppercase text-gray-500 mb-4 ml-2">Current Guarantors</Text>
            {guarantors.length === 0 ? (
                <View className="items-center py-10">
                    <Ionicons name="people-outline" size={48} color="#D1D5DB" />
                    <Text className="text-gray-500 font-bold mt-2">No guarantors added yet.</Text>
                </View>
            ) : (
                guarantors.map(g => (
                    <View key={g.id} className="bg-white p-4 rounded-2xl mb-3 flex-row justify-between items-center shadow-sm border border-gray-100">
                        <View>
                            <Text className="text-gray-900 font-black text-lg">{g.guarantorName}</Text>
                            <View className="flex-row items-center mt-1">
                                <Ionicons name="call" size={14} color="#6B7280" />
                                <Text className="text-gray-600 font-bold text-xs ml-1 mr-3">{g.contactNo || 'N/A'}</Text>
                                <Ionicons name="people" size={14} color="#6B7280" />
                                <Text className="text-gray-600 font-bold text-xs ml-1">{g.relationship || 'N/A'}</Text>
                            </View>
                        </View>
                        <Pressable onPress={() => handleDelete(g)} className="bg-red-50 p-2 rounded-xl">
                            <Ionicons name="trash" size={20} color="#DC2626" />
                        </Pressable>
                    </View>
                ))
            )}
        </ScrollView>
    );
}
