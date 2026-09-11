import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, SafeAreaView, Pressable, TextInput, Alert, Platform } from 'react-native';
import { database } from '../../src/database';
import Expense from '../../src/database/models/Expense';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { formatPHP } from '../../src/utils/currency';
import { useRouter } from 'expo-router';
import SwipeableItem from '../../src/components/SwipeableItem';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BaseModelService } from '../../src/services/BaseModelService';

export default function ExpenseReceiptsScreen() {
    const router = useRouter();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
    const [isConfirmDeleteVisible, setIsConfirmDeleteVisible] = useState(false);

    useEffect(() => {
        const subscription = database.collections
            .get<Expense>('expenses')
            .query(
                Q.sortBy('expense_date', Q.desc),
                Q.take(100)
            )
            .observe()
            .subscribe(data => setExpenses(data));
        
        return () => subscription.unsubscribe();
    }, []);

    const filteredExpenses = expenses.filter(exp => 
        (exp.payee?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
        (exp.category?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
        (exp.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
    );

    const totalAmount = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    const handleDelete = async () => {
        if (!selectedExpense) return;
        try {
            await BaseModelService.softDelete(selectedExpense);
            setIsConfirmDeleteVisible(false);
            if (Platform.OS === 'web') {
                window.alert('Expense record deleted.');
            } else {
                Alert.alert('Deleted', 'Expense deleted.');
            }
        } catch (error) {
            console.error('Failed to delete expense:', error);
            Alert.alert("Error", "Could not delete expense.");
        }
    };

    return (
        <GestureHandlerRootView className="flex-1">
            <SafeAreaView className="flex-1 bg-gray-50">
                <View className="px-6 pt-10 pb-4 bg-white border-b border-gray-200 shadow-sm">
                    <Text className="text-2xl font-black text-gray-900">Expense Ledger</Text>
                    <Text className="text-gray-500 text-sm mt-1">View all recorded expenses and receipts</Text>
                </View>

                <View className="px-6 py-4 bg-white border-b border-gray-100">
                    <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-2">
                        <MaterialIcons name="search" size={20} color="#9CA3AF" />
                        <TextInput 
                            className="flex-1 ml-2 font-semibold text-gray-800"
                            placeholder="Search by payee, category, or invoice..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                         placeholderTextColor="#9CA3AF"/>
                        {searchQuery.length > 0 && (
                            <Pressable onPress={() => setSearchQuery('')}>
                                <MaterialIcons name="close" size={20} color="#9CA3AF" />
                            </Pressable>
                        )}
                    </View>
                    
                    <View className="mt-4 p-4 bg-purple-50 rounded-2xl border border-purple-100">
                        <Text className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-1">Total (Filtered)</Text>
                        <Text className="text-xl font-black text-purple-900">{formatPHP(totalAmount)}</Text>
                    </View>
                </View>

                <ScrollView className="flex-1 px-6 pt-4">
                    {filteredExpenses.length === 0 ? (
                        <View className="py-12 items-center">
                            <MaterialIcons name="receipt-long" size={48} color="#D1D5DB" />
                            <Text className="text-gray-500 font-semibold mt-4">No expenses found</Text>
                        </View>
                    ) : (
                        filteredExpenses.map((exp, index) => (
                            <SwipeableItem
                                key={exp.id}
                                onEdit={() => router.push(`/(expenses-encoder)?id=${exp.id}`)}
                                onDelete={() => {
                                    setSelectedExpense(exp);
                                    setIsConfirmDeleteVisible(true);
                                }}
                            >
                                <View className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-3">
                                    <View className="flex-row justify-between items-start mb-2">
                                        <View className="flex-1 mr-4">
                                            <View className="flex-row items-center">
                                                <Text className="font-bold text-gray-900 text-base">{exp.category}</Text>
                                                {exp.invoiceNumber && (
                                                    <View className="ml-2 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                                        <Text className="text-[10px] font-bold text-gray-600">OR: {exp.invoiceNumber}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text className="text-sm font-semibold text-gray-700 mt-1">{exp.payee || 'No Payee specified'}</Text>
                                            <Text className="text-xs text-gray-500 mt-0.5">{format(new Date(exp.expenseDate), 'MMM d, yyyy h:mm a')}</Text>
                                        </View>
                                        <View className="items-end">
                                            <Text className="font-black text-red-600 text-lg">{formatPHP(exp.amount)}</Text>
                                        </View>
                                    </View>
                                    {exp.description && (
                                        <Text className="text-xs text-gray-600 mt-2 italic bg-gray-50 p-2 rounded-lg border border-gray-100">
                                            {exp.description}
                                        </Text>
                                    )}
                                </View>
                            </SwipeableItem>
                        ))
                    )}
                    <View className="h-10" />
                </ScrollView>

                <ConfirmDialog
                    visible={isConfirmDeleteVisible}
                    title="Delete Expense?"
                    message={`Are you sure you want to delete this expense record for "${selectedExpense?.description || selectedExpense?.category}"?`}
                    confirmLabel="Delete"
                    onConfirm={handleDelete}
                    onCancel={() => setIsConfirmDeleteVisible(false)}
                    isDestructive
                />
            </SafeAreaView>
        </GestureHandlerRootView>
    );
}
