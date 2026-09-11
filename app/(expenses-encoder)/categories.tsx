import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import { database } from '../../src/database';
import ExpenseCategory from '../../src/database/models/ExpenseCategory';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import uuid from 'react-native-uuid';

export default function ExpenseCategoriesScreen() {
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const subscription = database.collections
            .get<ExpenseCategory>('expense_categories')
            .query(Q.where('is_active', true), Q.sortBy('name', Q.asc))
            .observe()
            .subscribe(data => setCategories(data));
        return () => subscription.unsubscribe();
    }, []);

    const addCategory = async () => {
        const name = newCategoryName.trim();
        if (!name) return;

        setIsSaving(true);
        try {
            await database.write(async () => {
                await database.get<ExpenseCategory>('expense_categories').create(record => {
                    record._raw.id = uuid.v4().toString();
                    record.name = name;
                    record.isActive = true;
                });
            });
            setNewCategoryName('');
        } catch (error) {
            console.error('Failed to add category:', error);
            Alert.alert('Error', 'Failed to add category.');
        } finally {
            setIsSaving(false);
        }
    };

    const deleteCategory = async (category: ExpenseCategory) => {
        Alert.alert(
            "Delete Category",
            `Are you sure you want to remove "${category.name}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await database.write(async () => {
                                await category.update(record => {
                                    record.isActive = false;
                                });
                            });
                        } catch (error) {
                            console.error('Failed to delete category:', error);
                            Alert.alert('Error', 'Failed to delete category.');
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <View className="px-6 pt-10 pb-4 bg-white border-b border-gray-200 shadow-sm">
                <Text className="text-2xl font-black text-gray-900">Categories</Text>
                <Text className="text-gray-500 text-sm mt-1">Manage expense categories</Text>
            </View>

            <ScrollView className="flex-1 p-6">
                <View className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
                    <Text className="font-bold text-gray-700 mb-2">Add New Category</Text>
                    <View className="flex-row gap-3">
                        <TextInput
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                            placeholder="Category Name"
                            value={newCategoryName}
                            onChangeText={setNewCategoryName}
                            editable={!isSaving}
                         placeholderTextColor="#9CA3AF"/>
                        <Pressable
                            onPress={addCategory}
                            disabled={isSaving || !newCategoryName.trim()}
                            className={`px-6 rounded-xl justify-center items-center ${isSaving || !newCategoryName.trim() ? 'bg-purple-300' : 'bg-purple-600'}`}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text className="text-white font-bold">Add</Text>
                            )}
                        </Pressable>
                    </View>
                </View>

                <View className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {categories.length === 0 ? (
                        <View className="p-8 items-center">
                            <MaterialIcons name="label-outline" size={48} color="#D1D5DB" />
                            <Text className="text-gray-500 mt-4 font-semibold">No active categories</Text>
                        </View>
                    ) : (
                        categories.map((cat, index) => (
                            <View 
                                key={cat.id} 
                                className={`flex-row justify-between items-center p-4 ${index !== categories.length - 1 ? 'border-b border-gray-50' : ''}`}
                            >
                                <View className="flex-row items-center">
                                    <View className="w-10 h-10 rounded-full bg-purple-50 justify-center items-center mr-3">
                                        <MaterialIcons name="label" size={20} color="#7E22CE" />
                                    </View>
                                    <Text className="font-bold text-gray-800 text-base">{cat.name}</Text>
                                </View>
                                <Pressable 
                                    onPress={() => deleteCategory(cat)}
                                    className="p-2 rounded-full active:bg-red-50"
                                >
                                    <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                                </Pressable>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
