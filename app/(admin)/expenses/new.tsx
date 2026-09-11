import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '../../../src/utils/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { database } from '../../../src/database';
import Expense from '../../../src/database/models/Expense';
import { MaterialIcons } from '@expo/vector-icons';
import uuid from 'react-native-uuid';
import { useAuth } from '../../../src/store/AuthContext';
import { Q } from '@nozbe/watermelondb';
import { BaseModelService } from '../../../src/services/BaseModelService';
import { AutoPostingService } from '../../../src/services/AutoPostingService';

import { DatePicker } from '../../../src/components/DatePicker';
import { format, parseISO } from 'date-fns';
import { handleFormValidationError } from '../../../src/utils/errorAlerts';

const schema = z.object({
    description: z.string().optional(),
    amount: z.string().refine(v => v.trim() !== '' && !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Amount must be greater than zero"),
    category: z.string(),
    frequency: z.enum(['daily', 'weekly', 'monthly', 'none']),
    expenseDate: z.string().min(1, "Date is required"),
});

type FormData = z.infer<typeof schema>;

export default function NewExpenseScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string }>();
    const expenseId = Array.isArray(params.id) ? params.id[0] : params.id;
    const { user } = useAuth();
    const [saving, setSaving] = useState(false);
    const [loadingExpense, setLoadingExpense] = useState(!!expenseId);
    const [categories, setCategories] = useState<string[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [existingExpense, setExistingExpense] = useState<Expense | null>(null);

    const { control, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            description: '',
            amount: '',
            category: 'Other',
            frequency: 'none',
            expenseDate: format(new Date(), 'yyyy-MM-dd'),
        }
    });

    const fetchCategories = async () => {
        try {
            const list = await database.get<any>('expense_categories')
                .query(Q.where('is_active', true), Q.sortBy('name', Q.asc))
                .fetch();
            const names = list.map((c: any) => c.name);
            setCategories(names);
            if (names.length > 0 && !expenseId) {
                setValue('category', names[0]);
            }
        } catch (error) {
            console.error('Failed to fetch expense categories', error);
        } finally {
            setLoadingCategories(false);
        }
    };

    const fetchExistingExpense = async () => {
        if (!expenseId) return;
        try {
            const exp = await database.get<Expense>('expenses').find(expenseId);
            if (exp) {
                setExistingExpense(exp);
                const dateStr = exp.expenseDate ? format(new Date(exp.expenseDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
                reset({
                    description: exp.description || '',
                    amount: exp.amount ? exp.amount.toString() : '',
                    category: exp.category || 'Other',
                    frequency: (exp.frequency as any) || 'none',
                    expenseDate: dateStr,
                });
            }
        } catch (error) {
            console.error('Failed to fetch expense for editing', error);
            Alert.alert("Error", "Could not load expense details.");
        } finally {
            setLoadingExpense(false);
        }
    };

    useEffect(() => {
        fetchCategories();
        fetchExistingExpense();
    }, [expenseId]);

    const onSubmit = async (data: FormData) => {
        setSaving(true);
        try {
            const selectedDateMs = data.expenseDate ? parseISO(data.expenseDate).getTime() : Date.now();

            if (existingExpense) {
                await BaseModelService.update<Expense>(existingExpense, exp => {
                    exp.description = data.description.trim();
                    exp.amount = parseFloat(data.amount);
                    exp.category = data.category;
                    exp.frequency = data.frequency;
                    exp.expenseDate = selectedDateMs;
                }, user?.id);

                AutoPostingService.postExpense({
                    expenseId: existingExpense.id,
                    amount: parseFloat(data.amount),
                    category: data.category,
                    description: data.description.trim(),
                    entryDate: new Date(selectedDateMs),
                    postedBy: user?.id,
                }).catch(e => console.warn('[NewExpenseScreen] Auto-posting expense update failed:', e));

                Alert.alert("Success", "Expense updated successfully.");
            } else {
                const createdExpense = await BaseModelService.create<Expense>('expenses', exp => {
                    exp._raw.id = uuid.v4().toString();
                    exp.description = data.description.trim();
                    exp.amount = parseFloat(data.amount);
                    exp.category = data.category;
                    exp.frequency = data.frequency;
                    exp.expenseDate = selectedDateMs;
                    exp.encodedBy = user?.id || null;
                }, user?.id);

                AutoPostingService.postExpense({
                    expenseId: createdExpense.id,
                    amount: parseFloat(data.amount),
                    category: data.category,
                    description: data.description.trim(),
                    entryDate: new Date(selectedDateMs),
                    postedBy: user?.id,
                }).catch(e => console.warn('[NewExpenseScreen] Auto-posting expense failed:', e));

                Alert.alert("Success", "Expense recorded.");
            }

            safeBack(router, '/(admin)');
        } catch (error) {
            console.error('Failed to save expense', error);
            Alert.alert("Error", "Failed to save expense.");
        } finally {
            setSaving(false);
        }
    };

    if (loadingExpense) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#7B1FA2" />
                <Text className="text-gray-500 mt-2 font-medium">Loading expense details...</Text>
            </View>
        );
    }

    return (
        <ScrollView  className="flex-1 bg-gray-50"  contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <Text className="text-xl font-extrabold text-gray-900 mb-6">{expenseId ? 'Edit Expense' : 'New Expense'}</Text>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Category</Text>
                    {loadingCategories ? (
                        <ActivityIndicator size="small" color="#7B1FA2" style={{ alignSelf: 'flex-start', margin: 10 }} />
                    ) : (
                        <Controller
                            control={control}
                            name="category"
                            render={({ field: { onChange, value } }) => (
                                <View className="flex-row flex-wrap">
                                    {categories.length === 0 ? (
                                        <Text className="text-gray-700 italic text-xs mb-2">No active categories found. Please add them in Settings.</Text>
                                    ) : (
                                        categories.map(cat => (
                                            <Pressable
                                                key={cat}
                                                onPress={() => onChange(cat)}
                                                className={`px-4 py-2 rounded-lg border mr-2 mb-2 ${value === cat ? 'bg-purple-50 border-purple-500' : 'bg-gray-50 border-gray-100'}`}
                                            >
                                                <Text className={`text-xs font-bold ${value === cat ? 'text-purple-700' : 'text-gray-700'}`}>{cat}</Text>
                                            </Pressable>
                                        ))
                                    )}
                                </View>
                            )}
                        />
                    )}
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Frequency</Text>
                    <Controller
                        control={control}
                        name="frequency"
                        render={({ field: { onChange, value } }) => (
                            <View className="flex-row bg-gray-50 p-1 rounded-xl">
                                {['none', 'daily', 'weekly', 'monthly'].map(freq => (
                                    <Pressable
                                        key={freq}
                                        onPress={() => onChange(freq)}
                                        className={`flex-1 py-3 items-center rounded-lg ${value === freq ? 'bg-white shadow-sm' : ''}`}
                                    >
                                        <Text className={`text-xs font-bold capitalize ${value === freq ? 'text-purple-700' : 'text-gray-700'}`}>{freq}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    />
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Expense Date *</Text>
                    <Controller
                        control={control}
                        name="expenseDate"
                        render={({ field: { onChange, value } }) => (
                            <DatePicker value={value} onChange={onChange} />
                        )}
                    />
                    {errors.expenseDate && <Text className="text-red-500 text-xs mt-1">{errors.expenseDate.message}</Text>}
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Amount (₱) *</Text>
                    <Controller
                        control={control}
                        name="amount"
                        render={({ field: { onChange, value } }) => (
                            <TextInput
                                className={`bg-gray-50 p-4 rounded-xl border ${errors.amount ? 'border-red-500' : 'border-gray-200'} text-gray-900 font-extrabold text-2xl`}
                                value={value} onChangeText={onChange} keyboardType="numeric" editable={!saving}
                                placeholder="0.00"
                             placeholderTextColor="#9CA3AF"/>
                        )}
                    />
                    {errors.amount && <Text className="text-red-500 text-xs mt-1">{errors.amount.message}</Text>}
                </View>

                <View className="mb-8">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Description *</Text>
                    <Controller
                        control={control}
                        name="description"
                        render={({ field: { onChange, value } }) => (
                            <TextInput
                                className={`bg-gray-50 p-4 rounded-xl border ${errors.description ? 'border-red-500' : 'border-gray-200'} text-gray-900 h-24 text-top`}
                                value={value} onChangeText={onChange} editable={!saving} multiline
                                placeholder="What was this expense for?"
                                textAlignVertical="top"
                             placeholderTextColor="#9CA3AF"/>
                        )}
                    />
                    {errors.description && <Text className="text-red-500 text-xs mt-1">{errors.description.message}</Text>}
                </View>

                <Pressable
                    className={`w-full py-4 rounded-xl items-center flex-row justify-center ${saving ? 'bg-purple-400' : 'bg-purple-700 active:bg-purple-900'}`}
                    onPress={handleSubmit(onSubmit, (errs) => handleFormValidationError(errs, 'Expense'))} disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : (
                        <>
                            <MaterialIcons name="save" size={24} color="#fff" className="mr-2" />
                            <Text className="text-white font-black text-xl uppercase tracking-wider">Save Expense</Text>
                        </>
                    )}
                </Pressable>
            </View>
        </ScrollView>
    );
}
