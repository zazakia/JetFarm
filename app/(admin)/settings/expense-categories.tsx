import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, Pressable, TextInput,
    ActivityIndicator, Alert, SafeAreaView, FlatList
} from 'react-native';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import ExpenseCategory from '../../../src/database/models/ExpenseCategory';
import { MaterialIcons } from '@expo/vector-icons';
import uuid from 'react-native-uuid';
import { useRouter } from 'expo-router';
import { BaseModelService } from '../../../src/services/BaseModelService';

import { safeBack } from '../../../src/utils/navigation';

export default function ExpenseCategoriesScreen() {
    const router = useRouter();
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const list = await database.get<ExpenseCategory>('expense_categories')
                .query(
                    Q.where('deleted_at', Q.eq(null)),
                    Q.sortBy('name', Q.asc)
                )
                .fetch();

            // Ensure "Petty Cash (COH)" exists in default category list
            const hasPettyCash = list.some(c => c.name.toLowerCase().includes('petty cash'));
            if (!hasPettyCash) {
                await BaseModelService.create<ExpenseCategory>('expense_categories', cat => {
                    cat._raw.id = uuid.v4().toString();
                    cat.name = 'Petty Cash (COH)';
                    cat.isActive = true;
                    cat.createdAt = Date.now();
                    cat.updatedAt = Date.now();
                });
                const updatedList = await database.get<ExpenseCategory>('expense_categories')
                    .query(
                        Q.where('deleted_at', Q.eq(null)),
                        Q.sortBy('name', Q.asc)
                    )
                    .fetch();
                setCategories(updatedList);
            } else {
                setCategories(list);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleAdd = async () => {
        if (!newName.trim()) return;
        setSaving(true);
        try {
            await BaseModelService.create<ExpenseCategory>('expense_categories', cat => {
                cat._raw.id = uuid.v4().toString();
                cat.name = newName.trim();
                cat.isActive = true;
                cat.createdAt = Date.now();
                cat.updatedAt = Date.now();
            });

            setNewName('');
            fetchCategories();
        } catch (error) {
            Alert.alert("Error", "Failed to save category");
        } finally {
            setSaving(false);
        }
    };

    const toggleStatus = async (category: ExpenseCategory) => {
        try {
            await BaseModelService.update<ExpenseCategory>(category, cat => {
                cat.isActive = !cat.isActive;
                cat.updatedAt = Date.now();
            });

            fetchCategories();
        } catch (error) {
            Alert.alert("Error", "Failed to update status");
        }
    };

    const handleDelete = (category: ExpenseCategory) => {
        Alert.alert(
            "Action Restricted",
            "Deletion of Chart of Accounts / Expense Categories is not allowed. You may deactivate the account using the visibility toggle instead.",
            [{ text: "OK", style: "default" }]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <View className="flex-row items-center p-4 bg-white border-b border-gray-100">
                <Pressable onPress={() => safeBack(router, '/(admin)')} className="p-2 -ml-2">
                    <MaterialIcons name="arrow-back" size={24} color="#1E3A8A" />
                </Pressable>
                <Text className="text-xl font-black text-gray-900 ml-2">Expense Categories</Text>
            </View>

            <View className="p-4">
                <View className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm mb-6">
                    <Text className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-3">Add New Category</Text>
                    <View className="flex-row items-center">
                        <TextInput
                            className="flex-1 bg-gray-50 px-4 py-3 rounded-2xl border border-gray-100 text-gray-900 font-bold mr-3"
                            placeholder="Category name (e.g. Fuel)"
                            value={newName}
                            onChangeText={setNewName}
                            editable={!saving}
                         placeholderTextColor="#9CA3AF"/>
                        <Pressable
                            onPress={handleAdd}
                            disabled={saving || !newName.trim()}
                            className={`w-12 h-12 rounded-2xl items-center justify-center ${saving || !newName.trim() ? 'bg-gray-200' : 'bg-blue-900 active:bg-blue-900'}`}
                        >
                            {saving ? <ActivityIndicator color="white" size="small" /> : <MaterialIcons name="add" size={24} color="white" />}
                        </Pressable>
                    </View>
                </View>

                {loading ? (
                    <View className="py-20 items-center">
                        <ActivityIndicator color="#1E3A8A" />
                        <Text className="text-gray-700 font-bold mt-4">Loading categories...</Text>
                    </View>
                ) : (
                    <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        {categories.length === 0 ? (
                            <View className="p-10 items-center">
                                <MaterialIcons name="category" size={48} color="#E5E7EB" />
                                <Text className="text-gray-700 font-bold mt-2">No categories yet</Text>
                            </View>
                        ) : (
                            categories.map((item, index) => (
                                <View key={item.id} className={`flex-row items-center p-4 ${index < categories.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                    <View className={`w-10 h-10 rounded-2xl items-center justify-center mr-4 ${item.isActive ? 'bg-blue-50' : 'bg-gray-100'}`}>
                                        <MaterialIcons name="category" size={20} color={item.isActive ? '#1E3A8A' : '#9CA3AF'} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`font-bold text-base ${item.isActive ? 'text-gray-900' : 'text-gray-700'}`}>{item.name}</Text>
                                        <Text className="text-[10px] text-gray-700 font-bold uppercase tracking-wider">{item.isActive ? 'Active' : 'Inactive'}</Text>
                                    </View>
                                    <Pressable 
                                        onPress={() => toggleStatus(item)}
                                        className="p-2"
                                    >
                                        <MaterialIcons 
                                            name={item.isActive ? "visibility" : "visibility-off"} 
                                            size={20} 
                                            color={item.isActive ? "#1E3A8A" : "#9CA3AF"} 
                                        />
                                    </Pressable>
                                    <View className="w-2" />
                                    <Pressable 
                                        onPress={() => handleDelete(item)}
                                        className="p-2"
                                    >
                                        <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                                    </Pressable>
                                </View>
                            ))
                        )}
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}
