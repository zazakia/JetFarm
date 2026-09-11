import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, Pressable, ScrollView,
    ActivityIndicator, Alert, SafeAreaView, StatusBar,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { database } from '../../src/database';
import { formatPHP } from '../../src/utils/currency';
import { MaterialIcons } from '@expo/vector-icons';
import uuid from 'react-native-uuid';
import Expense from '../../src/database/models/Expense';
import { Q } from '@nozbe/watermelondb';
import { useAuth } from '../../src/store/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { SyncStatusIndicator } from '../../src/components/SyncStatusIndicator';
import { AuthService } from '../../src/services/AuthService';
import { format, startOfMonth, endOfMonth , parseISO } from 'date-fns';
import { BaseModelService } from '../../src/services/BaseModelService';
import { router, useLocalSearchParams } from 'expo-router';
import { handleFormValidationError, handleSaveError } from '../../src/utils/errorAlerts';




import { DatePicker } from '../../src/components/DatePicker';

const CATEGORY_ICONS: Record<string, { icon: keyof typeof MaterialIcons.glyphMap; color: string; bg: string }> = {
    'Transportation': { icon: 'directions-car', color: '#2563EB', bg: 'bg-blue-100' },
    'Office Supplies': { icon: 'inventory', color: '#9333EA', bg: 'bg-purple-100' },
    'Rent/Utilities': { icon: 'home', color: '#D97706', bg: 'bg-amber-100' },
    'Marketing': { icon: 'campaign', color: '#E11D48', bg: 'bg-rose-100' },
    'Taxes/Fees': { icon: 'account-balance', color: '#0284C7', bg: 'bg-sky-100' },
    'Other': { icon: 'more-horiz', color: '#6B7280', bg: 'bg-gray-100' },
};

const schema = z.object({
    category: z.string().min(1, 'Category is required'),
    frequency: z.enum(['daily', 'weekly', 'none']).optional(),
    expenseDate: z.string().optional(),
    amount: z.string().refine(v => v.trim() !== '' && !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Amount must be greater than zero'),
    payee: z.string().optional(),
    tin: z.string().optional(),
    invoiceNumber: z.string().optional(),
    vatAmount: z.string().optional().refine(v => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0), 'VAT cannot be negative'),
    description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function ExpensesEncoderScreen() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    const isEditMode = Boolean(id);
    const { user, signOut } = useAuth();
    const [saving, setSaving] = useState(false);
    const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
    const [dbCategories, setDbCategories] = useState<string[]>([]);
    const [existingExpense, setExistingExpense] = useState<Expense | null>(null);

    const { control, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { category: '', frequency: 'none', expenseDate: format(new Date(), 'yyyy-MM-dd'), amount: '', payee: '', tin: '', invoiceNumber: '', vatAmount: '', description: '' },
    });

    const fetchCategories = async () => {
        const list = await database.get<any>('expense_categories')
            .query(Q.where('is_active', true), Q.sortBy('name', Q.asc))
            .fetch();
        const names = list.map((c: any) => c.name);
        setDbCategories(names);
        if (!isEditMode && names.length > 0) {
            setValue('category', names[0]);
        }
    };

    const [monthlyTotal, setMonthlyTotal] = useState(0);

    const fetchRecent = async () => {
        const expenses = await database.collections
            .get<Expense>('expenses')
            .query(Q.sortBy('expense_date', Q.desc), Q.take(5))
            .fetch();
        setRecentExpenses(expenses);

        const start = startOfMonth(new Date()).getTime();
        const end = endOfMonth(new Date()).getTime();
        const monthlyExpenses = await database.collections
            .get<Expense>('expenses')
            .query(
                Q.where('expense_date', Q.between(start, end))
            )
            .fetch();
        setMonthlyTotal(monthlyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0));
    };

    useEffect(() => { 
        fetchRecent();
        fetchCategories();
    }, []);

    useEffect(() => {
        if (!id) return;
        const loadExpense = async () => {
            try {
                const expense = await database.get<Expense>('expenses').find(id);
                setExistingExpense(expense);
                setValue('category', expense.category || '');
                setValue('frequency', (expense.frequency as any) || 'none');
                setValue('expenseDate', expense.expenseDate ? format(new Date(expense.expenseDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
                setValue('amount', String(expense.amount || ''));
                setValue('payee', expense.payee || '');
                setValue('tin', expense.tin || '');
                setValue('invoiceNumber', expense.invoiceNumber || '');
                setValue('vatAmount', expense.vatAmount ? String(expense.vatAmount) : '');
                setValue('description', expense.description || '');
            } catch (error) {
                console.error('Failed to load expense for edit:', error);
                Alert.alert('Error', 'Failed to load expense for editing.');
                router.push('/(expenses-encoder)/receipts');
            }
        };
        loadExpense();
    }, [id]);

    const onSubmit = async (data: FormData) => {
        setSaving(true);
        try {
            const selectedDateMs = data.expenseDate ? parseISO(data.expenseDate).getTime() : Date.now();

            if (isEditMode && existingExpense) {
                await BaseModelService.update<Expense>(existingExpense, expense => {
                    expense.category = data.category;
                    expense.frequency = data.frequency || 'none';
                    expense.expenseDate = selectedDateMs;
                    expense.description = data.description?.trim() || null;
                    expense.payee = data.payee?.trim() || null;
                    expense.tin = data.tin?.trim() || null;
                    expense.invoiceNumber = data.invoiceNumber?.trim() || null;
                    expense.vatAmount = data.vatAmount ? parseFloat(data.vatAmount) : 0;
                    expense.amount = parseFloat(data.amount);
                });
                Alert.alert('✓ Updated', 'Expense updated successfully.');
                router.push('/(expenses-encoder)/receipts');
            } else {
                await BaseModelService.create<Expense>('expenses', expense => {
                    expense._raw.id = uuid.v4().toString();
                    expense.category = data.category;
                    expense.frequency = data.frequency || 'none';
                    expense.expenseDate = selectedDateMs;
                    expense.description = data.description?.trim() || null;
                    expense.payee = data.payee?.trim() || null;
                    expense.tin = data.tin?.trim() || null;
                    expense.invoiceNumber = data.invoiceNumber?.trim() || null;
                    expense.vatAmount = data.vatAmount ? parseFloat(data.vatAmount) : 0;
                    expense.amount = parseFloat(data.amount);
                    expense.encodedBy = user?.id || '';
                });
                Alert.alert('✓ Saved', 'Expense recorded successfully.');
                reset();
                fetchRecent();
            }
        } catch (error) {
            handleSaveError(error, 'Expense', isEditMode ? 'update' : 'save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            <StatusBar barStyle="light-content" />
            <ScrollView className="flex-1"   showsVerticalScrollIndicator={false} >
                {/* Header */}
                <LinearGradient
                    colors={['#581C87', '#3B0764']}
                    className="pt-10 pb-20 px-6 rounded-b-[40px]"
                >
                    <View className="flex-row items-center justify-between">
                        <View>
                            <Text className="text-purple-200/70 text-xs font-bold uppercase tracking-[3px]">Expenses Encoder</Text>
                            <Text className="text-white text-3xl font-black mt-1">{user?.email?.split('@')[0]}</Text>
                        </View>
                        <View className="items-end gap-2">
                            <SyncStatusIndicator />
                            <Pressable
                                onPress={signOut}
                                className="p-2.5 bg-white/10 rounded-2xl active:bg-white/20 border border-white/10"
                            >
                                <MaterialIcons name="logout" size={18} color="#FFF" />
                            </Pressable>
                        </View>
                    </View>
                </LinearGradient>

                {/* Dashboard Actions & Analytics */}
                <View className="px-6 -mt-10 mb-6 flex-row gap-4">
                    <Pressable 
                        onPress={() => router.push('/(expenses-encoder)/receipts')}
                        className="flex-1 bg-white rounded-3xl p-5 border border-purple-50 shadow-sm items-center"
                    >
                        <View className="w-12 h-12 bg-purple-100 rounded-full items-center justify-center mb-2">
                            <MaterialIcons name="receipt-long" size={24} color="#7E22CE" />
                        </View>
                        <Text className="text-gray-900 font-bold text-sm">Ledger</Text>
                        <Text className="text-gray-500 text-[10px] text-center mt-1">View all</Text>
                    </Pressable>

                    <View className="flex-1 bg-purple-900 rounded-3xl p-5 shadow-sm justify-center">
                        <Text className="text-purple-200 text-[10px] font-bold uppercase tracking-wider mb-1">This Month</Text>
                        <Text className="text-white font-black text-xl">{formatPHP(monthlyTotal)}</Text>
                    </View>

                    <Pressable 
                        onPress={() => router.push('/(expenses-encoder)/categories')}
                        className="flex-1 bg-white rounded-3xl p-5 border border-purple-50 shadow-sm items-center"
                    >
                        <View className="w-12 h-12 bg-purple-100 rounded-full items-center justify-center mb-2">
                            <MaterialIcons name="category" size={24} color="#7E22CE" />
                        </View>
                        <Text className="text-gray-900 font-bold text-sm">Categories</Text>
                        <Text className="text-gray-500 text-[10px] text-center mt-1">Manage</Text>
                    </Pressable>
                </View>

                {/* Form Card */}
                <View className="px-6 mb-6">
                    <View className="bg-white rounded-[32px] p-6 border border-gray-50" style={{ boxShadow: '0 20px 25px -5px rgba(88,28,135,0.1)' }}>
                        <Text className="text-gray-900 text-xl font-black mb-6">{isEditMode ? 'Edit Expense' : 'Record Expense'}</Text>

                        {/* Category */}                        <Text className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">Category</Text>
                        <Controller
                            control={control}
                            name="category"
                            render={({ field: { onChange, value } }) => (
                                <View className="flex-row flex-wrap mb-5">
                                    {dbCategories.length === 0 ? (
                                        <Text className="text-gray-700 italic text-xs mb-2">No categories defined. Please add them in Settings.</Text>
                                    ) : (
                                        dbCategories.map(cat => {
                                            const info = CATEGORY_ICONS[cat] ?? { icon: 'label', color: '#6B7280', bg: 'bg-gray-100' };
                                            const selected = value === cat;
                                            return (
                                                <Pressable
                                                    key={cat}
                                                    onPress={() => onChange(cat)}
                                                    className={`flex-row items-center px-3 py-2 rounded-2xl border mr-2 mb-2 ${selected ? 'bg-purple-50 border-purple-400' : 'bg-gray-50 border-gray-100'}`}
                                                >
                                                    <MaterialIcons name={info.icon} size={14} color={selected ? '#9333EA' : '#9CA3AF'} />
                                                    <Text className={`text-xs font-bold ml-1 ${selected ? 'text-purple-700' : 'text-gray-700'}`}>{cat}</Text>
                                                </Pressable>
                                            );
                                        })
                                    )}
                                </View>
                            )}
                        />

                        <View className="mb-5">
                            <Text className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">Frequency</Text>
                            <Controller
                                control={control}
                                name="frequency"
                                render={({ field: { onChange, value } }) => (
                                    <View className="flex-row">
                                        {['none', 'daily', 'weekly'].map(freq => (
                                            <Pressable
                                                key={freq}
                                                onPress={() => onChange(freq)}
                                                className={`flex-1 py-3 items-center rounded-2xl border mr-2 last:mr-0 ${value === freq ? 'bg-purple-50 border-purple-400' : 'bg-gray-50 border-gray-100'}`}
                                            >
                                                <Text className={`text-xs font-bold capitalize ${value === freq ? 'text-purple-700' : 'text-gray-700'}`}>{freq}</Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                )}
                            />
                        </View>

                        {/* Expense Date */}
                        <View className="mb-5">
                            <Text className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Expense Date</Text>
                            <Controller
                                control={control}
                                name="expenseDate"
                                render={({ field: { onChange, value } }) => (
                                    <DatePicker value={value || format(new Date(), 'yyyy-MM-dd')} onChange={onChange} />
                                )}
                            />
                        </View>

                        {/* Amount */}
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Amount (₱)</Text>
                        <Controller
                            control={control}
                            name="amount"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className={`bg-gray-50 px-5 py-4 rounded-2xl border text-gray-900 font-black text-2xl mb-1 ${errors.amount ? 'border-red-400' : 'border-gray-200'}`}
                                    value={value} onChangeText={onChange} keyboardType="numeric"
                                    editable={!saving} placeholder="0.00" placeholderTextColor="#D1D5DB"
                                />
                            )}
                        />
                        {errors.amount && <Text className="text-red-500 text-xs mb-3">{errors.amount.message}</Text>}

                        <View className="bg-purple-50 border border-purple-100 rounded-2xl p-4 mt-4 mb-2">
                            <Text className="text-xs font-black text-purple-900 mb-3 uppercase tracking-wider">Receipt / Invoice Details</Text>
                            <Text className="text-[10px] font-bold text-purple-700 mb-1 uppercase">Payee / Expense Name</Text>
                            <Controller control={control} name="payee" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white px-4 py-3 rounded-xl border border-purple-100 text-gray-900 mb-3" value={value || ''} onChangeText={onChange} editable={!saving} placeholder="Supplier or payee"  placeholderTextColor="#9CA3AF"/>
                            )} />
                            <View className="flex-row">
                                <View className="flex-1 mr-2">
                                    <Text className="text-[10px] font-bold text-purple-700 mb-1 uppercase">TIN</Text>
                                    <Controller control={control} name="tin" render={({ field: { onChange, value } }) => (
                                        <TextInput className="bg-white px-4 py-3 rounded-xl border border-purple-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} placeholder="TIN / NON-VAT"  placeholderTextColor="#9CA3AF"/>
                                    )} />
                                </View>
                                <View className="flex-1 ml-2">
                                    <Text className="text-[10px] font-bold text-purple-700 mb-1 uppercase">Receipt No.</Text>
                                    <Controller control={control} name="invoiceNumber" render={({ field: { onChange, value } }) => (
                                        <TextInput className="bg-white px-4 py-3 rounded-xl border border-purple-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} placeholder="Invoice/OR no."  placeholderTextColor="#9CA3AF"/>
                                    )} />
                                </View>
                            </View>
                        </View>

                        {/* Description */}
                        <Text className="text-xs font-bold text-gray-700 mb-2 mt-4 uppercase tracking-wider">Description (optional)</Text>
                        <Controller
                            control={control}
                            name="description"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className="bg-gray-50 px-5 py-4 rounded-2xl border border-gray-200 text-gray-900 h-24 mb-6"
                                    value={value} onChangeText={onChange} multiline
                                    textAlignVertical="top" editable={!saving} placeholder="Optional details..."
                                    placeholderTextColor="#D1D5DB"
                                />
                            )}
                        />

                        <Pressable
                            className={`w-full py-4 rounded-2xl items-center flex-row justify-center ${saving ? 'bg-purple-300' : 'bg-purple-700 active:bg-purple-800'}`}
                            onPress={handleSubmit(onSubmit, (errs) => handleFormValidationError(errs, 'Expense'))}
                            disabled={saving}
                        >
                            {saving ? <ActivityIndicator color="#fff" /> : (
                                <>
                                    <MaterialIcons name="receipt" size={20} color="#fff" />
                                    <Text className="text-white font-black text-lg ml-2">{isEditMode ? 'Update Expense' : 'Save Expense'}</Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                </View>

                {/* Recent Entries */}
                <View className="px-6 mb-4 flex-row justify-between items-center">
                    <View>
                        <Text className="text-gray-900 font-black text-xl">Recent Entries</Text>
                        <View className="h-1.5 w-10 bg-purple-600 rounded-full mt-1" />
                    </View>
                </View>

                <View className="px-6 pb-12">
                    {recentExpenses.length === 0 ? (
                        <View className="bg-white p-10 rounded-3xl items-center border border-gray-100">
                            <MaterialIcons name="receipt-long" size={40} color="#D1D5DB" />
                            <Text className="text-gray-700 font-semibold mt-3">No recent expenses</Text>
                        </View>
                    ) : (
                        <View className="bg-white rounded-3xl border border-gray-100">
                            {recentExpenses.map((exp, idx) => {
                                const info = CATEGORY_ICONS[exp.category] ?? CATEGORY_ICONS['Other'];
                                return (
                                    <View key={exp.id} className={`flex-row items-center px-5 py-4 ${idx < recentExpenses.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                        <View className={`w-10 h-10 rounded-2xl items-center justify-center mr-4 ${info.bg}`}>
                                            <MaterialIcons name={info.icon} size={18} color={info.color} />
                                        </View>
                                        <View className="flex-1">
                                            <View className="flex-row items-center">
                                                <Text className="font-bold text-gray-900">{exp.category}</Text>
                                                {exp.frequency && exp.frequency !== 'none' && (
                                                    <View className="ml-2 bg-gray-100 px-1.5 py-0.5 rounded-md">
                                                        <Text className="text-[8px] font-black text-gray-700 uppercase">{exp.frequency}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text className="text-xs text-gray-700 mt-0.5">{format(new Date(exp.expenseDate), 'MMM d, yyyy')}</Text>
                                        </View>
                                        <Text className="font-black text-red-600">{formatPHP(exp.amount)}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
