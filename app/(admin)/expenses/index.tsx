import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import Expense from '../../../src/database/models/Expense';
import { MaterialIcons } from '@expo/vector-icons';
import { SearchBar } from '../../../src/components/SearchBar';
import { formatPHP } from '../../../src/utils/currency';
import { formatDate } from '../../../src/utils/dates';
import BaseModelService from '../../../src/services/BaseModelService';
import SwipeableItem from '../../../src/components/SwipeableItem';
import ConfirmDialog from '../../../src/components/ConfirmDialog';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useAuth } from '../../../src/store/AuthContext';
import { useRolePermissions } from '../../../src/hooks/useSettingsConfig';

export default function ExpensesListScreen() {
    const router = useRouter();
    const { role } = useAuth();
    const { isAllowed } = useRolePermissions(role);
    const canEdit = isAllowed('action.edit');
    const canDelete = isAllowed('action.delete');

    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
    const [isConfirmDeleteVisible, setIsConfirmDeleteVisible] = useState(false);
    const [visibleSwipeActionId, setVisibleSwipeActionId] = useState<string | null>(null);

    const loadData = async () => {
        try {
            const fetched = await BaseModelService.fetchActive<Expense>('expenses');
            setExpenses(fetched.sort((a, b) => b.expenseDate - a.expenseDate));
        } catch (error) {
            console.error('Failed to load expenses:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const filteredExpenses = expenses.filter(e => {
        const query = searchQuery.toLowerCase();
        return e.description.toLowerCase().includes(query) ||
            e.category?.toLowerCase().includes(query);
    });

    const handleDelete = async () => {
        if (!selectedExpense) return;
        try {
            await BaseModelService.softDelete(selectedExpense);
            setIsConfirmDeleteVisible(false);
            loadData();
            if (Platform.OS === 'web') {
                window.alert('Expense record deleted.');
            }
        } catch (error) {
            console.error('Failed to delete expense:', error);
            Alert.alert("Error", "Could not delete expense.");
        }
    };

    const renderItem = ({ item }: { item: Expense }) => (
        <SwipeableItem
            onActionsVisibilityChange={(isVisible) => {
                setVisibleSwipeActionId((currentId) => isVisible ? item.id : currentId === item.id ? null : currentId);
            }}
            onEdit={canEdit ? () => router.push(`/(admin)/expenses/new?id=${item.id}`) : undefined}
            onDelete={canDelete ? () => {
                setSelectedExpense(item);
                setIsConfirmDeleteVisible(true);
            } : undefined}
        >
            <View className="bg-white p-4 border-b border-gray-100 flex-row items-center active:bg-gray-50">
                <View className="w-12 h-12 rounded-full bg-purple-50 items-center justify-center mr-4">
                    <MaterialIcons name="receipt-long" size={24} color="#7B1FA2" />
                </View>
                <View className="flex-1">
                    <Text className="text-base font-bold text-gray-900">{item.description}</Text>
                    <Text className="text-xs text-gray-700 mt-1">
                        {item.category ? `${item.category.toUpperCase()} ` : ''}
                        {item.frequency && item.frequency !== 'none' ? `• ${item.frequency.toUpperCase()} ` : ''}
                        • {formatDate(new Date(item.expenseDate))}
                    </Text>
                </View>
                <View className="items-end pl-2">
                    <Text className="text-sm font-extrabold text-red-600">-{formatPHP(item.amount)}</Text>
                </View>
            </View>
        </SwipeableItem>
    );

    return (
        <GestureHandlerRootView className="flex-1">
            <View className="flex-1 bg-gray-50 p-4">
                <View className="mb-4">
                    <SearchBar
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search by description, category..."
                    />
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#D32F2F" className="mt-10" />
                ) : (
                    <FlatList
                        data={filteredExpenses}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        ListEmptyComponent={
                            <View className="items-center justify-center py-20">
                                <MaterialIcons name="money-off" size={64} color="#E5E7EB" />
                                <Text className="text-gray-700 font-medium mt-4 text-base">No expenses found</Text>
                            </View>
                        }
                    />
                )}

                {/* FAB */}
                {!visibleSwipeActionId && (
                    <Pressable
                        className={`${Platform.OS === 'web' ? 'absolute bottom-6 left-6' : 'absolute bottom-6 right-6'} flex-row items-center bg-red-700 px-6 py-4 rounded-full shadow-xl active:bg-red-800`}
                        onPress={() => router.push('/(admin)/expenses/new')}
                    >
                        <MaterialIcons name="add" size={24} color="#FFFFFF" className="mr-2" />
                        <Text className="text-white font-black uppercase tracking-wider">Add Expense</Text>
                    </Pressable>
                )}

                <ConfirmDialog
                    visible={isConfirmDeleteVisible}
                    title="Delete Expense?"
                    message={`Are you sure you want to delete this expense record for "${selectedExpense?.description}"?`}
                    confirmLabel="Delete"
                    onConfirm={handleDelete}
                    onCancel={() => setIsConfirmDeleteVisible(false)}
                    isDestructive
                />
            </View>
        </GestureHandlerRootView>
    );
}
