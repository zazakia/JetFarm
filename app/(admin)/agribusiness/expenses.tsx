import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, Modal, Alert, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import AgriFarmExpense from '../../../src/database/models/AgriFarmExpense';
import AgriCropCycle from '../../../src/database/models/AgriCropCycle';
import { formatPHP } from '../../../src/utils/currency';
import { Q } from '@nozbe/watermelondb';
import { AutoPostingService } from '../../../src/services/AutoPostingService';
import { DynamicSearchBar } from '../../../src/components/DynamicSearchBar';
import { useDynamicSearch } from '../../../src/hooks/useDynamicSearch';

export const EXPENSE_CATEGORIES = [
    { id: 'fertilizer', label: 'Fertilizer', icon: 'eco' as const, badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-800' },
    { id: 'herbicide_pesticide', label: 'Herbicide & Pest', icon: 'pest-control' as const, badgeBg: 'bg-rose-100', badgeText: 'text-rose-800' },
    { id: 'tractor_equipment', label: 'Tractor & Machinery', icon: 'agriculture' as const, badgeBg: 'bg-amber-100', badgeText: 'text-amber-800' },
    { id: 'seedlings', label: 'Seedlings & Cuttings', icon: 'grass' as const, badgeBg: 'bg-green-100', badgeText: 'text-green-800' },
    { id: 'fuel_oil', label: 'Fuel & Oil', icon: 'local-gas-station' as const, badgeBg: 'bg-orange-100', badgeText: 'text-orange-800' },
    { id: 'transport', label: 'Trucking & Hauling', icon: 'local-shipping' as const, badgeBg: 'bg-blue-100', badgeText: 'text-blue-800' },
    { id: 'tools', label: 'Farm Tools', icon: 'build' as const, badgeBg: 'bg-purple-100', badgeText: 'text-purple-800' },
    { id: 'miscellaneous', label: 'Miscellaneous', icon: 'more-horiz' as const, badgeBg: 'bg-gray-100', badgeText: 'text-gray-800' },
] as const;

export default function FarmExpensesScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [expenses, setExpenses] = useState<Array<{ expense: AgriFarmExpense; cycleCode: string }>>([]);
    const [cycles, setCycles] = useState<AgriCropCycle[]>([]);
    const [selectedCycleId, setSelectedCycleId] = useState<string>('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // New Expense Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [formCycleId, setFormCycleId] = useState('');
    const [formCategory, setFormCategory] = useState<string>('fertilizer');
    const [formDescription, setFormDescription] = useState('');
    const [formAmount, setFormAmount] = useState('');
    const [formPaidBy, setFormPaidBy] = useState<'jet' | 'investor'>('jet');
    const [formReceiptRef, setFormReceiptRef] = useState('');
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        try {
            const cycleList = await database
                .get<AgriCropCycle>('agri_crop_cycles')
                .query(Q.where('deleted_at', null), Q.sortBy('planting_date', Q.desc))
                .fetch();
            setCycles(cycleList);

            if (cycleList.length > 0 && !formCycleId) {
                setFormCycleId(cycleList[0].id);
            }

            const rawExpenses = await database
                .get<AgriFarmExpense>('agri_farm_expenses')
                .query(
                    Q.where('deleted_at', null),
                    Q.sortBy('expense_date', Q.desc)
                )
                .fetch();

            const formatted: Array<{ expense: AgriFarmExpense; cycleCode: string }> = [];
            for (const exp of rawExpenses) {
                let code = 'Unassigned';
                if (exp.cropCycleId) {
                    try {
                        const c = await database.get<AgriCropCycle>('agri_crop_cycles').find(exp.cropCycleId);
                        code = c.cycleCode;
                    } catch {
                        code = 'Cycle';
                    }
                }
                formatted.push({ expense: exp, cycleCode: code });
            }
            setExpenses(formatted);
        } catch (err) {
            console.error('[FarmExpenses] Error loading:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleCreateExpense = async () => {
        if (!formDescription.trim()) {
            Alert.alert('Validation Error', 'Please enter a description for this expense.');
            return;
        }
        const parsedAmount = parseFloat(formAmount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            Alert.alert('Validation Error', 'Please enter a valid expense amount.');
            return;
        }

        setSaving(true);
        try {
            let createdExpense: AgriFarmExpense | null = null;
            await database.write(async () => {
                createdExpense = await database.get<AgriFarmExpense>('agri_farm_expenses').create((record) => {
                    record.cropCycleId = formCycleId || null;
                    record.parcelId = null;
                    record.expenseDate = new Date();
                    record.category = formCategory;
                    record.description = formDescription.trim();
                    record.amount = parsedAmount;
                    record.paidBy = formPaidBy;
                    record.receiptPhotoUri = formReceiptRef.trim() || null;
                });
            });

            if (createdExpense) {
                try {
                    await AutoPostingService.postAgriFarmExpense({
                        expenseId: (createdExpense as AgriFarmExpense).id,
                        amount: parsedAmount,
                        category: formCategory,
                        description: formDescription.trim(),
                        paidBy: formPaidBy,
                        cropCycleId: formCycleId || null,
                        entryDate: new Date(),
                        postedBy: 'Operator',
                    });
                } catch (postErr) {
                    console.warn('[FarmExpenses] Failed to auto-post to accounting:', postErr);
                }
            }

            setModalVisible(false);
            setFormDescription('');
            setFormAmount('');
            setFormReceiptRef('');
            setFormPaidBy('jet');
            setFormCategory('fertilizer');
            Alert.alert('Success', 'Farm input expense recorded and posted to General Ledger.');
            loadData();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to save farm expense.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteExpense = (id: string, desc: string) => {
        Alert.alert(
            'Confirm Delete',
            `Are you sure you want to remove this expense record: "${desc}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await database.write(async () => {
                                const rec = await database.get<AgriFarmExpense>('agri_farm_expenses').find(id);
                                await rec.update((r) => {
                                    r.deletedAt = new Date();
                                });
                            });
                            loadData();
                        } catch (err: any) {
                            Alert.alert('Error', err.message || 'Failed to delete expense.');
                        }
                    },
                },
            ]
        );
    };

    // Filtered list
    const filteredExpenses = expenses.filter((item) => {
        const matchesCycle = !selectedCycleId || item.expense.cropCycleId === selectedCycleId;
        const matchesCat = selectedCategory === 'all' || item.expense.category === selectedCategory;
        return matchesCycle && matchesCat;
    });

    // Dynamic and flexible search on filtered expenses
    const {
        query: searchQuery,
        setQuery: setSearchQuery,
        filteredData: searchedExpenses,
    } = useDynamicSearch({
        data: filteredExpenses,
        searchKeys: [
            'expense.description',
            'expense.category',
            'cycleCode',
            'expense.paidBy',
            (item: any) => String(item.expense?.amount ?? ''),
        ],
        debounceMs: 150,
    });

    // KPI computations
    const totalExpenses = filteredExpenses.reduce((sum, item) => sum + (item.expense.amount || 0), 0);
    const jetPaidTotal = filteredExpenses
        .filter((item) => item.expense.paidBy === 'jet')
        .reduce((sum, item) => sum + (item.expense.amount || 0), 0);
    const investorPaidTotal = filteredExpenses
        .filter((item) => item.expense.paidBy === 'investor')
        .reduce((sum, item) => sum + (item.expense.amount || 0), 0);

    // Calculate area in Ha for unit cost
    let relevantAreaHa = 0;
    if (selectedCycleId) {
        const c = cycles.find((cy) => cy.id === selectedCycleId);
        relevantAreaHa = c?.areaPlantedHa || 1;
    } else {
        relevantAreaHa = cycles.reduce((sum, c) => sum + (c.areaPlantedHa || 0), 0) || 1;
    }
    const costPerHectare = totalExpenses / Math.max(0.01, relevantAreaHa);

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#047857']} />}
        >
            {/* Header */}
            <View className="bg-emerald-800 p-6 pb-8">
                <View className="flex-row items-center justify-between mb-4">
                    <Pressable
                        onPress={() => router.push('/(admin)/agribusiness' as any)}
                        className="flex-row items-center bg-emerald-900/60 px-3 py-1.5 rounded-lg active:bg-emerald-900"
                    >
                        <MaterialIcons name="arrow-back" size={18} color="#FFFFFF" />
                        <Text className="text-white text-xs font-semibold ml-1">Command Center</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setModalVisible(true)}
                        className="flex-row items-center bg-amber-500 px-3 py-1.5 rounded-lg active:bg-amber-600 shadow-sm"
                    >
                        <MaterialIcons name="add" size={18} color="#FFFFFF" />
                        <Text className="text-white text-xs font-bold ml-1">+ Log Farm Expense</Text>
                    </Pressable>
                </View>

                <View className="flex-row items-center mb-1">
                    <MaterialIcons name="receipt-long" size={26} color="#FDE68A" className="mr-2" />
                    <Text className="text-white text-2xl font-black tracking-tight">Farm Input Expenses</Text>
                </View>
                <Text className="text-emerald-100 text-xs mt-1">
                    Operational cost accounting: Fertilizer, Land Prep, Tractor, Seedlings & Pest Control
                </Text>
            </View>

            {/* KPI Overview Cards */}
            <View className="p-4 -mt-5">
                <View className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <View className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <View className="flex-row items-center justify-between mb-1">
                            <Text className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Expenses</Text>
                            <MaterialIcons name="account-balance-wallet" size={16} color="#047857" />
                        </View>
                        <Text className="text-lg font-black text-gray-900">{formatPHP(totalExpenses)}</Text>
                        <Text className="text-[10px] text-gray-400 mt-0.5">{filteredExpenses.length} records logged</Text>
                    </View>

                    <View className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <View className="flex-row items-center justify-between mb-1">
                            <Text className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Jet (Operator)</Text>
                            <MaterialIcons name="person" size={16} color="#2563EB" />
                        </View>
                        <Text className="text-lg font-black text-blue-700">{formatPHP(jetPaidTotal)}</Text>
                        <Text className="text-[10px] text-blue-500 mt-0.5">Operator Funded</Text>
                    </View>

                    <View className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <View className="flex-row items-center justify-between mb-1">
                            <Text className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">BioGreen Investor</Text>
                            <MaterialIcons name="trending-up" size={16} color="#D97706" />
                        </View>
                        <Text className="text-lg font-black text-amber-600">{formatPHP(investorPaidTotal)}</Text>
                        <Text className="text-[10px] text-amber-500 mt-0.5">Investor Capital</Text>
                    </View>

                    <View className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <View className="flex-row items-center justify-between mb-1">
                            <Text className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Cost / Hectare</Text>
                            <MaterialIcons name="landscape" size={16} color="#7C3AED" />
                        </View>
                        <Text className="text-lg font-black text-purple-700">{formatPHP(costPerHectare)}/ha</Text>
                        <Text className="text-[10px] text-purple-500 mt-0.5">{relevantAreaHa.toFixed(2)} ha basis</Text>
                    </View>
                </View>
            </View>

            {/* Cycle Selector Filter */}
            <View className="px-4 mb-2">
                <Text className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Filter by Crop Cycle</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row pb-1">
                    <Pressable
                        onPress={() => setSelectedCycleId('')}
                        className={`px-3 py-1.5 rounded-lg mr-2 ${
                            selectedCycleId === '' ? 'bg-emerald-800 shadow-sm' : 'bg-white border border-gray-200'
                        }`}
                    >
                        <Text className={`text-xs font-bold ${selectedCycleId === '' ? 'text-white' : 'text-gray-700'}`}>
                            All Crop Cycles
                        </Text>
                    </Pressable>
                    {cycles.map((cy) => (
                        <Pressable
                            key={cy.id}
                            onPress={() => setSelectedCycleId(cy.id)}
                            className={`px-3 py-1.5 rounded-lg mr-2 flex-row items-center ${
                                selectedCycleId === cy.id ? 'bg-emerald-800 shadow-sm' : 'bg-white border border-gray-200'
                            }`}
                        >
                            <MaterialIcons
                                name="grass"
                                size={14}
                                color={selectedCycleId === cy.id ? '#FFFFFF' : '#047857'}
                                className="mr-1"
                            />
                            <Text className={`text-xs font-bold ${selectedCycleId === cy.id ? 'text-white' : 'text-gray-700'}`}>
                                {cy.cycleCode} ({cy.variety})
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            {/* Category Filter Chips */}
            <View className="px-4 mb-4">
                <Text className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Filter by Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row pb-1">
                    <Pressable
                        onPress={() => setSelectedCategory('all')}
                        className={`px-3 py-1.5 rounded-full mr-2 ${
                            selectedCategory === 'all' ? 'bg-gray-900' : 'bg-white border border-gray-200'
                        }`}
                    >
                        <Text className={`text-xs font-semibold ${selectedCategory === 'all' ? 'text-white' : 'text-gray-600'}`}>
                            All Categories
                        </Text>
                    </Pressable>
                    {EXPENSE_CATEGORIES.map((cat) => (
                        <Pressable
                            key={cat.id}
                            onPress={() => setSelectedCategory(cat.id)}
                            className={`px-3 py-1.5 rounded-full mr-2 flex-row items-center ${
                                selectedCategory === cat.id ? 'bg-gray-900' : 'bg-white border border-gray-200'
                            }`}
                        >
                            <MaterialIcons
                                name={cat.icon}
                                size={14}
                                color={selectedCategory === cat.id ? '#FFFFFF' : '#4B5563'}
                                className="mr-1"
                            />
                            <Text className={`text-xs font-semibold ${selectedCategory === cat.id ? 'text-white' : 'text-gray-600'}`}>
                                {cat.label}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            {/* Dynamic and Flexible Search */}
            <View className="px-4 mb-2">
                <DynamicSearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search expenses by description, amount, payee..."
                />
            </View>

            {/* Expense Item List */}
            <View className="px-4 pb-12">
                <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-bold text-gray-900">
                        Recorded Input Logs ({searchedExpenses.length})
                    </Text>
                </View>

                {loading ? (
                    <View className="py-12 items-center">
                        <ActivityIndicator size="large" color="#047857" />
                        <Text className="text-gray-500 text-xs mt-2">Loading farm expenses...</Text>
                    </View>
                ) : searchedExpenses.length === 0 ? (
                    <View className="bg-white p-8 rounded-2xl border border-gray-200 items-center justify-center my-2">
                        <MaterialIcons name="receipt-long" size={48} color="#D1D5DB" />
                        <Text className="text-gray-800 font-bold text-base mt-2">
                            {searchQuery ? 'No Matching Expenses' : 'No Farm Expenses Found'}
                        </Text>
                        <Text className="text-gray-500 text-xs text-center mt-1 mb-4">
                            {searchQuery
                                ? `No expenses match your search for "${searchQuery}".`
                                : 'Log fertilizers, seedling purchases, tractor hours or hauling to track input costs.'}
                        </Text>
                        {searchQuery ? (
                            <Pressable
                                onPress={() => setSearchQuery('')}
                                className="bg-gray-100 px-4 py-2 rounded-xl active:bg-gray-200"
                            >
                                <Text className="text-emerald-800 font-bold text-xs">Clear Search</Text>
                            </Pressable>
                        ) : (
                            <Pressable
                                onPress={() => setModalVisible(true)}
                                className="bg-emerald-800 px-4 py-2 rounded-xl active:bg-emerald-900"
                            >
                                <Text className="text-white text-xs font-bold">+ Log First Expense</Text>
                            </Pressable>
                        )}
                    </View>
                ) : (
                    searchedExpenses.map((item) => {
                        const catMeta = EXPENSE_CATEGORIES.find((c) => c.id === item.expense.category) || {
                            id: 'miscellaneous',
                            label: item.expense.category,
                            icon: 'receipt' as const,
                            badgeBg: 'bg-gray-100',
                            badgeText: 'text-gray-800',
                        };
                        const isInvestor = item.expense.paidBy === 'investor';
                        const expDate = item.expense.expenseDate ? new Date(item.expense.expenseDate).toLocaleDateString() : '-';

                        return (
                            <View
                                key={item.expense.id}
                                className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-3"
                            >
                                <View className="flex-row items-start justify-between mb-2">
                                    <View className="flex-row items-center flex-1 mr-2">
                                        <View className={`px-2.5 py-1 rounded-full flex-row items-center mr-2 ${catMeta.badgeBg}`}>
                                            <MaterialIcons name={catMeta.icon} size={12} className="mr-1" />
                                            <Text className={`text-[11px] font-bold ${catMeta.badgeText}`}>
                                                {catMeta.label}
                                            </Text>
                                        </View>
                                        <View className="bg-gray-100 px-2 py-0.5 rounded">
                                            <Text className="text-[10px] font-bold text-gray-600">{item.cycleCode}</Text>
                                        </View>
                                    </View>

                                    <Text className="text-base font-black text-gray-900">
                                        {formatPHP(item.expense.amount || 0)}
                                    </Text>
                                </View>

                                <Text className="text-sm font-semibold text-gray-800 mb-2">
                                    {item.expense.description}
                                </Text>

                                <View className="flex-row items-center justify-between pt-2 border-t border-gray-100">
                                    <View className="flex-row items-center gap-2">
                                        <View
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold flex-row items-center ${
                                                isInvestor ? 'bg-amber-100' : 'bg-blue-100'
                                            }`}
                                        >
                                            <Text className={`text-[10px] font-bold ${isInvestor ? 'text-amber-800' : 'text-blue-800'}`}>
                                                Paid by: {isInvestor ? 'BioGreen Investor' : 'Jet (Operator)'}
                                            </Text>
                                        </View>
                                        <Text className="text-[11px] text-gray-400">{expDate}</Text>
                                        {item.expense.receiptPhotoUri && (
                                            <View className="flex-row items-center bg-gray-100 px-1.5 py-0.5 rounded">
                                                <MaterialIcons name="receipt" size={12} color="#6B7280" className="mr-1" />
                                                <Text className="text-[10px] text-gray-600 font-mono">
                                                    Ref: {item.expense.receiptPhotoUri}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    <Pressable
                                        onPress={() => handleDeleteExpense(item.expense.id, item.expense.description)}
                                        className="p-1 rounded hover:bg-red-50 active:bg-red-100"
                                    >
                                        <MaterialIcons name="delete-outline" size={18} color="#EF4444" />
                                    </Pressable>
                                </View>
                            </View>
                        );
                    })
                )}
            </View>

            {/* Modal: Log Farm Expense */}
            <Modal visible={modalVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/60 items-center justify-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-lg border border-gray-100 shadow-2xl">
                        <View className="flex-row items-center justify-between mb-4 border-b border-gray-100 pb-3">
                            <View className="flex-row items-center">
                                <MaterialIcons name="add-circle" size={24} color="#047857" className="mr-2" />
                                <Text className="text-lg font-black text-gray-900">Record Farm Expense</Text>
                            </View>
                            <Pressable onPress={() => setModalVisible(false)} className="p-1">
                                <MaterialIcons name="close" size={20} color="#6B7280" />
                            </Pressable>
                        </View>

                        <ScrollView className="max-h-[75vh]" showsVerticalScrollIndicator={false}>
                            {/* Crop Cycle */}
                            <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                Crop Cycle
                            </Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-3">
                                {cycles.map((cy) => (
                                    <Pressable
                                        key={cy.id}
                                        onPress={() => setFormCycleId(cy.id)}
                                        className={`px-3 py-1.5 rounded-lg mr-2 border ${
                                            formCycleId === cy.id
                                                ? 'bg-emerald-800 border-emerald-800'
                                                : 'bg-gray-50 border-gray-200'
                                        }`}
                                    >
                                        <Text
                                            className={`text-xs font-bold ${
                                                formCycleId === cy.id ? 'text-white' : 'text-gray-800'
                                            }`}
                                        >
                                            {cy.cycleCode}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>

                            {/* Category Selector */}
                            <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                Expense Category
                            </Text>
                            <View className="flex-row flex-wrap gap-1.5 mb-3">
                                {EXPENSE_CATEGORIES.map((cat) => (
                                    <Pressable
                                        key={cat.id}
                                        onPress={() => setFormCategory(cat.id)}
                                        className={`px-3 py-1.5 rounded-lg flex-row items-center border ${
                                            formCategory === cat.id
                                                ? 'bg-emerald-800 border-emerald-800'
                                                : 'bg-gray-50 border-gray-200'
                                        }`}
                                    >
                                        <MaterialIcons
                                            name={cat.icon}
                                            size={14}
                                            color={formCategory === cat.id ? '#FFFFFF' : '#4B5563'}
                                            className="mr-1"
                                        />
                                        <Text
                                            className={`text-xs font-bold ${
                                                formCategory === cat.id ? 'text-white' : 'text-gray-700'
                                            }`}
                                        >
                                            {cat.label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            {/* Description */}
                            <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                Item / Service Description
                            </Text>
                            <TextInput
                                className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 mb-3"
                                placeholder="e.g. 10 bags Complete 14-14-14 Fertilizer"
                                placeholderTextColor="#9CA3AF"
                                value={formDescription}
                                onChangeText={setFormDescription}
                            />

                            {/* Amount */}
                            <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                Amount (PHP ₱)
                            </Text>
                            <TextInput
                                className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 font-bold mb-3"
                                placeholder="0.00"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="numeric"
                                value={formAmount}
                                onChangeText={setFormAmount}
                            />

                            {/* Paid By Toggle */}
                            <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                Payment Source
                            </Text>
                            <View className="flex-row gap-2 mb-3">
                                <Pressable
                                    onPress={() => setFormPaidBy('jet')}
                                    className={`flex-1 p-3 rounded-xl border flex-row items-center justify-center ${
                                        formPaidBy === 'jet'
                                            ? 'bg-blue-50 border-blue-600'
                                            : 'bg-gray-50 border-gray-200'
                                    }`}
                                >
                                    <MaterialIcons
                                        name="person"
                                        size={18}
                                        color={formPaidBy === 'jet' ? '#2563EB' : '#6B7280'}
                                        className="mr-1.5"
                                    />
                                    <Text
                                        className={`text-xs font-bold ${
                                            formPaidBy === 'jet' ? 'text-blue-800' : 'text-gray-600'
                                        }`}
                                    >
                                        Jet (Operator)
                                    </Text>
                                </Pressable>

                                <Pressable
                                    onPress={() => setFormPaidBy('investor')}
                                    className={`flex-1 p-3 rounded-xl border flex-row items-center justify-center ${
                                        formPaidBy === 'investor'
                                            ? 'bg-amber-50 border-amber-600'
                                            : 'bg-gray-50 border-gray-200'
                                    }`}
                                >
                                    <MaterialIcons
                                        name="trending-up"
                                        size={18}
                                        color={formPaidBy === 'investor' ? '#D97706' : '#6B7280'}
                                        className="mr-1.5"
                                    />
                                    <Text
                                        className={`text-xs font-bold ${
                                            formPaidBy === 'investor' ? 'text-amber-800' : 'text-gray-600'
                                        }`}
                                    >
                                        BioGreen Investor
                                    </Text>
                                </Pressable>
                            </View>

                            {/* Receipt / Invoice Ref */}
                            <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                Receipt / Official Invoice Ref (Optional)
                            </Text>
                            <TextInput
                                className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 mb-4"
                                placeholder="e.g. OR #10492 / Agro Supply"
                                placeholderTextColor="#9CA3AF"
                                value={formReceiptRef}
                                onChangeText={setFormReceiptRef}
                            />

                            {/* Action Buttons */}
                            <View className="flex-row gap-3 pt-2">
                                <Pressable
                                    onPress={() => setModalVisible(false)}
                                    className="flex-1 py-3 bg-gray-100 rounded-xl items-center active:bg-gray-200"
                                >
                                    <Text className="text-gray-700 font-bold text-sm">Cancel</Text>
                                </Pressable>
                                <Pressable
                                    onPress={handleCreateExpense}
                                    disabled={saving}
                                    className="flex-1 py-3 bg-emerald-800 rounded-xl items-center active:bg-emerald-900 shadow-sm"
                                >
                                    {saving ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <Text className="text-white font-bold text-sm">Save Expense</Text>
                                    )}
                                </Pressable>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}
