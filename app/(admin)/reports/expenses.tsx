import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Dimensions, Pressable, Modal, TextInput, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { database } from '../../../src/database';
import Expense from '../../../src/database/models/Expense';
import { AutoPostingService } from '../../../src/services/AutoPostingService';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPHP } from '../../../src/utils/currency';
import { PieChart } from 'react-native-chart-kit';
import uuid from 'react-native-uuid';
import { MetricBreakdownDialog, BreakdownItem } from '../../../src/components/MetricBreakdownDialog';


const CATEGORY_COLORS: Record<string, string> = {
    'Transportation': '#3B82F6',
    'Office Supplies': '#4F7F52',
    'Rent/Utilities': '#F59E0B',
    'Marketing': '#EF4444',
    'Taxes/Fees': '#8B5CF6',
    'Other': '#6B7280',
};

export default function ExpenseReportScreen() {
    const screenWidth = Dimensions.get('window').width - 48;
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<{ name: string; amount: number; color: string; legendFontColor: string; legendFontSize: number }[]>([]);
    const [totalExpense, setTotalExpense] = useState(0);

    // Encoding Modal State
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [category, setCategory] = useState('Transportation');
    const [amount, setAmount] = useState('');
    const [payee, setPayee] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [breakdownVisible, setBreakdownVisible] = useState(false);
    const [breakdownData, setBreakdownData] = useState<{ title: string; total: number; items: BreakdownItem[]; color: string }>({
        title: '', total: 0, items: [], color: 'text-purple-700'
    });

    const handleCategoryClick = async (categoryName?: string) => {
        const expenses = await database.collections.get<Expense>('expenses').query().fetch();
        const filtered = categoryName ? expenses.filter(e => (e.category || 'Other') === categoryName) : expenses;

        const items: BreakdownItem[] = filtered.map(e => ({
            id: e.id,
            label: e.description || e.payee || e.category || 'Expense',
            sublabel: `${e.expenseDate ? new Date(e.expenseDate).toLocaleDateString() : ''} • Category: ${e.category || 'General'}`,
            value: e.amount,
            isCurrency: true,
        }));

        setBreakdownData({
            title: categoryName ? `Expenses: ${categoryName}` : 'All Business Expenses',
            total: filtered.reduce((s, e) => s + e.amount, 0),
            items,
            color: 'text-purple-700',
        });
        setBreakdownVisible(true);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const expenses = await database.collections.get<Expense>('expenses').query().fetch();
            
            const categoryMap: Record<string, number> = {};
            let total = 0;
            
            expenses.forEach(exp => {
                const cat = exp.category || 'Other';
                categoryMap[cat] = (categoryMap[cat] || 0) + exp.amount;
                total += exp.amount;
            });

            const statsArray = Object.entries(categoryMap).map(([category, amount]) => ({
                name: category,
                amount,
                color: CATEGORY_COLORS[category] || CATEGORY_COLORS['Other'],
                legendFontColor: "#7F7F7F",
                legendFontSize: 12
            })).sort((a, b) => b.amount - a.amount);

            setStats(statsArray);
            setTotalExpense(total);
        } catch (error) {
            console.error('Failed to load expense report:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, []));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleCreateExpense = async () => {
        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) {
            return Alert.alert("Invalid Amount", "Please enter a valid expense amount.");
        }
        setSaving(true);
        try {
            const expId = uuid.v4().toString();
            const now = Date.now();
            await database.write(async () => {
                await database.collections.get<Expense>('expenses').create(e => {
                    e._raw.id = expId;
                    e.category = category;
                    e.amount = val;
                    e.payee = payee.trim();
                    e.description = description.trim();
                    e.expenseDate = now;
                });
            });

            // Auto-post to double-entry General Ledger
            try {
                await AutoPostingService.postExpense({
                    expenseId: expId,
                    amount: val,
                    category,
                    description: description.trim() || `Expense: ${category}`,
                    entryDate: new Date(now),
                });
            } catch (postErr) {
                console.warn('[ExpenseReport] Auto-posting warning:', postErr);
            }

            Alert.alert("Success", "Expense recorded & posted to accounting.");
            setAddModalVisible(false);
            setAmount('');
            setPayee('');
            setDescription('');
            await loadData();
        } catch (error) {
            console.error('Failed to save expense:', error);
            Alert.alert("Error", "Failed to save expense record.");
        } finally {
            setSaving(false);
        }
    };

    if (loading && !refreshing) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#7B1FA2" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            <View className="p-6 pb-2 bg-gray-50 border-b border-gray-100 flex-row justify-between items-center">
                <View>
                    <Text className="text-2xl font-black text-gray-900 mb-1">Expense Breakdown</Text>
                    <Text className="text-gray-700 font-bold uppercase tracking-widest text-[10px]">
                        Lifetime Business Expenses
                    </Text>
                </View>
                <Pressable
                    onPress={() => setAddModalVisible(true)}
                    className="bg-purple-900 px-4 py-2.5 rounded-2xl flex-row items-center active:bg-purple-800 shadow-sm"
                >
                    <MaterialIcons name="add" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text className="text-white font-black text-xs uppercase tracking-wider">Encode</Text>
                </Pressable>
            </View>


            <ScrollView 
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ padding: 24 }}
            >

                <Pressable onPress={() => handleCategoryClick()} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-6 items-center active:bg-gray-50">
                    <Text className="text-gray-700 text-xs font-bold uppercase mb-1">Total Expenses (Tap for details)</Text>
                    <Text className="text-3xl font-black text-gray-900 mb-4">{formatPHP(totalExpense)}</Text>
                    
                    {stats.length > 0 ? (
                        <View className="items-center justify-center">
                            <PieChart
                                data={stats.map(s => ({
                                    name: s.name,
                                    population: s.amount,
                                    color: s.color,
                                    legendFontColor: s.legendFontColor,
                                    legendFontSize: s.legendFontSize,
                                }))}
                                width={screenWidth}
                                height={220}
                                chartConfig={{
                                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                                }}
                                accessor={"population"}
                                backgroundColor={"transparent"}
                                paddingLeft={"15"}
                                absolute
                            />
                        </View>
                    ) : (
                        <View className="py-20 items-center">
                            <MaterialIcons name="pie-chart-outlined" size={64} color="#E5E7EB" />
                            <Text className="text-gray-700 mt-4 font-bold">No Data Available</Text>
                        </View>
                    )}
                </Pressable>

                <Text className="text-gray-900 font-black text-xl mb-4">Detailed Categories</Text>
                <View className="bg-white rounded-[32px] border border-gray-100 overflow-hidden mb-10">
                    {stats.map((item, idx) => (
                        <Pressable key={item.name} onPress={() => handleCategoryClick(item.name)} className={`flex-row items-center px-6 py-4 active:bg-gray-50 ${idx < stats.length - 1 ? 'border-b border-gray-50' : ''}`}>
                            <View style={{ backgroundColor: item.color }} className="w-3 h-3 rounded-full mr-4" />
                            <View className="flex-1">
                                <Text className="font-bold text-gray-900">{item.name}</Text>
                                <Text className="text-[10px] text-gray-700 font-bold uppercase">
                                    {((item.amount / (totalExpense || 1)) * 100).toFixed(1)}% of total
                                </Text>
                            </View>
                            <Text className="font-black text-gray-900 mr-2">{formatPHP(item.amount)}</Text>
                            <MaterialIcons name="chevron-right" size={18} color="#9CA3AF" />
                        </Pressable>
                    ))}
                </View>
            </ScrollView>

            {/* Encode Expense Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={addModalVisible}
                onRequestClose={() => setAddModalVisible(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/50 p-6">
                    <View className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-xl font-black text-gray-900">Encode New Expense</Text>
                            <Pressable onPress={() => setAddModalVisible(false)}>
                                <MaterialIcons name="close" size={24} color="#6B7280" />
                            </Pressable>
                        </View>

                        <Text className="text-xs text-gray-500 mb-4">
                            Select category, enter details, and record expense. Automatically creates double-entry journal entry in general ledger.
                        </Text>

                        {/* Category Selector */}
                        <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">Category</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                            {['Transportation', 'Office Supplies', 'Rent/Utilities', 'Marketing', 'Taxes/Fees', 'Salaries & Wages', 'Other'].map(cat => (
                                <Pressable
                                    key={cat}
                                    onPress={() => setCategory(cat)}
                                    className={`px-3 py-2 rounded-xl mr-2 ${category === cat ? 'bg-purple-900' : 'bg-gray-100'}`}
                                >
                                    <Text className={`text-xs font-bold ${category === cat ? 'text-white' : 'text-gray-700'}`}>{cat}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>

                        {/* Amount */}
                        <View className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 mb-3">
                            <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Amount (₱)</Text>
                            <TextInput
                                className="text-xl font-black text-gray-900 p-0"
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={setAmount}
                                placeholder="0.00"
                             placeholderTextColor="#9CA3AF"/>
                        </View>

                        {/* Payee */}
                        <View className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 mb-3">
                            <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Payee / Vendor</Text>
                            <TextInput
                                className="text-sm font-bold text-gray-900 p-0"
                                value={payee}
                                onChangeText={setPayee}
                                placeholder="e.g. Shell, Office Warehouse"
                             placeholderTextColor="#9CA3AF"/>
                        </View>

                        {/* Description */}
                        <View className="bg-gray-50 border border-gray-100 rounded-2xl p-3.5 mb-6">
                            <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Description / Particulars</Text>
                            <TextInput
                                className="text-sm font-medium text-gray-900 p-0"
                                value={description}
                                onChangeText={setDescription}
                                placeholder="Brief explanation of expense"
                             placeholderTextColor="#9CA3AF"/>
                        </View>

                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={() => setAddModalVisible(false)}
                                className="flex-1 bg-gray-100 py-3.5 rounded-2xl items-center active:bg-gray-200"
                            >
                                <Text className="text-gray-700 font-bold text-sm uppercase">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleCreateExpense}
                                disabled={saving}
                                className="flex-1 bg-purple-900 py-3.5 rounded-2xl items-center active:bg-purple-800"
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text className="text-white font-black text-sm uppercase">Save & Post</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <MetricBreakdownDialog
                visible={breakdownVisible}
                onClose={() => setBreakdownVisible(false)}
                {...breakdownData}
            />
        </View>
    );
}

