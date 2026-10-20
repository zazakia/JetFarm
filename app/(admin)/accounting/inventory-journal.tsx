import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { InventoryJournalService, InventorySummary } from '../../../src/services/InventoryJournalService';
import StockMovement from '../../../src/database/models/StockMovement';
import { formatPHP } from '../../../src/utils/currency';

export default function InventoryJournal() {
    const [selectedModule, setSelectedModule] = useState<string>('agri-store');
    const [summaries, setSummaries] = useState<InventorySummary[]>([]);
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [loading, setLoading] = useState(false);

    // Stock Adjustment Modal
    const [adjustVisible, setAdjustVisible] = useState(false);
    const [productId, setProductId] = useState('');
    const [movementType, setMovementType] = useState<'adjustment_increase' | 'adjustment_decrease' | 'beginning'>('adjustment_increase');
    const [quantity, setQuantity] = useState('');
    const [unitCost, setUnitCost] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sumList, movList] = await Promise.all([
                InventoryJournalService.getInventorySummary(selectedModule),
                InventoryJournalService.getMovements({ moduleId: selectedModule, limit: 50 }),
            ]);
            setSummaries(sumList);
            setMovements(movList);
        } catch (err) {
            console.error('Failed to load inventory journal data:', err);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [selectedModule])
    );

    const handleRecordAdjustment = async () => {
        if (!productId.trim()) {
            Alert.alert('Error', 'Please enter a product SKU or ID.');
            return;
        }
        const parsedQty = parseFloat(quantity);
        if (isNaN(parsedQty) || parsedQty <= 0) {
            Alert.alert('Error', 'Please enter a valid quantity.');
            return;
        }
        const parsedCost = parseFloat(unitCost) || 0;

        setSaving(true);
        try {
            await InventoryJournalService.recordMovement({
                productId: productId.trim(),
                productSource: `${selectedModule.replace('-', '_')}_products`,
                moduleId: selectedModule,
                movementType,
                quantityIn: movementType === 'adjustment_increase' || movementType === 'beginning' ? parsedQty : undefined,
                quantityOut: movementType === 'adjustment_decrease' ? parsedQty : undefined,
                unitCost: parsedCost,
                movementDate: new Date(),
                notes: notes.trim() || undefined,
                performedBy: 'Admin',
            });

            Alert.alert('Success', 'Inventory movement recorded and journal entry posted.');
            setAdjustVisible(false);
            setProductId('');
            setQuantity('');
            setUnitCost('');
            setNotes('');
            await loadData();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to record movement.');
        } finally {
            setSaving(false);
        }
    };

    const totalStockValue = summaries.reduce((s, item) => s + item.totalCostValue, 0);

    return (
        <View className="flex-1 bg-gray-50">
            {/* Header & Module Selector */}
            <View className="bg-white border-b border-gray-100 p-4">
                <View className="flex-row justify-between items-center mb-3">
                    <View>
                        <Text className="text-gray-900 font-black text-xl">Inventory Journal</Text>
                        <Text className="text-gray-600 text-xs font-medium">Perpetual Stock Movement & WAC Cost Ledger</Text>
                    </View>
                    <Pressable
                        onPress={() => setAdjustVisible(true)}
                        className="bg-teal-800 px-4 py-2.5 rounded-xl active:bg-teal-900 flex-row items-center"
                    >
                        <MaterialIcons name="tune" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text className="text-white font-bold text-xs">Stock Adjustment</Text>
                    </Pressable>
                </View>

                {/* Module Selector Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row">
                        {[
                            { id: 'agri-store', label: 'Agri-Store (1210)' },
                        ].map(m => (
                            <Pressable
                                key={m.id}
                                onPress={() => setSelectedModule(m.id)}
                                className={`px-3 py-1.5 rounded-xl mr-2 border ${
                                    selectedModule === m.id
                                        ? 'bg-teal-900 border-teal-900'
                                        : 'bg-gray-50 border-gray-200'
                                }`}
                            >
                                <Text className={`text-xs font-bold ${
                                    selectedModule === m.id ? 'text-white' : 'text-gray-700'
                                }`}>
                                    {m.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#0F766E" />
                    <Text className="text-gray-600 text-xs font-bold mt-2">Computing Inventory Ledger...</Text>
                </View>
            ) : (
                <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
                    {/* Highlight Value Cards */}
                    <View className="flex-row justify-between mb-4">
                        <View className="w-[48%] bg-teal-950 p-5 rounded-3xl shadow-sm">
                            <Text className="text-teal-200 text-[10px] font-bold uppercase tracking-wider mb-1">
                                Total Inventory Value (WAC)
                            </Text>
                            <Text className="text-white font-black text-2xl">
                                {formatPHP(totalStockValue)}
                            </Text>
                        </View>
                        <View className="w-[48%] bg-emerald-950 p-5 rounded-3xl shadow-sm">
                            <Text className="text-emerald-200 text-[10px] font-bold uppercase tracking-wider mb-1">
                                Tracked SKUs
                            </Text>
                            <Text className="text-white font-black text-2xl">
                                {summaries.length} Products
                            </Text>
                        </View>
                    </View>

                    {/* Stock Movements Register Table */}
                    <View className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-8">
                        <View className="p-4 border-b border-gray-100">
                            <Text className="text-gray-900 font-bold text-sm">Chronological Stock Movement Log</Text>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View>
                                {/* Header */}
                                <View className="flex-row bg-gray-50 p-3 border-b border-gray-100">
                                    <View style={{ width: 80 }}><Text className="text-gray-600 text-[10px] font-bold uppercase">Date</Text></View>
                                    <View style={{ width: 110 }}><Text className="text-gray-600 text-[10px] font-bold uppercase">Product SKU</Text></View>
                                    <View style={{ width: 90 }} className="items-center"><Text className="text-gray-600 text-[10px] font-bold uppercase">Type</Text></View>
                                    <View style={{ width: 80 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Qty In</Text></View>
                                    <View style={{ width: 80 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Qty Out</Text></View>
                                    <View style={{ width: 90 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Balance</Text></View>
                                    <View style={{ width: 100 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Unit Cost</Text></View>
                                    <View style={{ width: 110 }} className="items-end"><Text className="text-gray-600 text-[10px] font-bold uppercase">Total Cost</Text></View>
                                    <View style={{ width: 140 }}><Text className="text-gray-600 text-[10px] font-bold uppercase">Notes</Text></View>
                                </View>

                                {/* Rows */}
                                {movements.length === 0 ? (
                                    <View className="p-8 items-center justify-center">
                                        <Text className="text-gray-600 text-xs font-bold">No stock movements recorded for this module.</Text>
                                        <Text className="text-gray-600 text-[10px] mt-1">Record a purchase or stock adjustment to initialize inventory.</Text>
                                    </View>
                                ) : (
                                    movements.map((m, idx) => (
                                        <View key={idx} className="flex-row p-3 border-b border-gray-50 items-center">
                                            <View style={{ width: 80 }}>
                                                <Text className="text-gray-700 text-xs font-medium">
                                                    {format(new Date(m.movementDate), 'MM/dd/yy')}
                                                </Text>
                                            </View>
                                            <View style={{ width: 110 }}>
                                                <Text className="text-gray-900 font-bold text-xs">{m.productId}</Text>
                                            </View>
                                            <View style={{ width: 90 }} className="items-center">
                                                <View className={`px-2 py-0.5 rounded-full ${
                                                    m.movementType === 'purchase' || m.movementType === 'beginning' ? 'bg-emerald-100' : m.movementType === 'sale' ? 'bg-blue-100' : 'bg-amber-100'
                                                }`}>
                                                    <Text className={`text-[8px] font-bold uppercase ${
                                                        m.movementType === 'purchase' || m.movementType === 'beginning' ? 'text-emerald-800' : m.movementType === 'sale' ? 'text-blue-900' : 'text-amber-800'
                                                    }`}>
                                                        {m.movementType}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={{ width: 80 }} className="items-end">
                                                <Text className="text-emerald-700 font-bold text-xs">{m.quantityIn ?? '—'}</Text>
                                            </View>
                                            <View style={{ width: 80 }} className="items-end">
                                                <Text className="text-red-700 font-bold text-xs">{m.quantityOut ?? '—'}</Text>
                                            </View>
                                            <View style={{ width: 90 }} className="items-end">
                                                <Text className="text-gray-900 font-black text-xs">{m.quantityBalance}</Text>
                                            </View>
                                            <View style={{ width: 100 }} className="items-end">
                                                <Text className="text-gray-700 text-xs">{m.unitCost ? formatPHP(m.unitCost) : '—'}</Text>
                                            </View>
                                            <View style={{ width: 110 }} className="items-end">
                                                <Text className="text-teal-700 font-bold text-xs">{m.totalCost ? formatPHP(m.totalCost) : '—'}</Text>
                                            </View>
                                            <View style={{ width: 140 }} className="pr-2">
                                                <Text className="text-gray-600 text-[10px]" numberOfLines={1}>{m.notes || '—'}</Text>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>
                        </ScrollView>
                    </View>
                </ScrollView>
            )}

            {/* Stock Adjustment Modal */}
            <Modal
                visible={adjustVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setAdjustVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-3xl p-6 h-[85%]">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-gray-900 font-black text-lg">Record Stock Adjustment</Text>
                            <Pressable onPress={() => setAdjustVisible(false)} className="p-1">
                                <MaterialIcons name="close" size={24} color="#6B7280" />
                            </Pressable>
                        </View>

                        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                            <Text className="text-gray-600 text-xs font-bold uppercase mb-1">Product SKU / ID *</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-sm mb-3 text-gray-900"
                                placeholder="e.g. FERT-UREA-50KG"
                                placeholderTextColor="#9CA3AF"
                                value={productId}
                                onChangeText={setProductId}
                            />

                            <Text className="text-gray-600 text-xs font-bold uppercase mb-1.5">Adjustment Type</Text>
                            <View className="flex-row mb-4">
                                {[
                                    { id: 'adjustment_increase', label: '+ Stock In (Gain)' },
                                    { id: 'adjustment_decrease', label: '- Stock Out (Loss)' },
                                    { id: 'beginning', label: 'Opening Balance' },
                                ].map(t => (
                                    <Pressable
                                        key={t.id}
                                        onPress={() => setMovementType(t.id as any)}
                                        className={`px-3 py-2 rounded-xl mr-2 border ${
                                            movementType === t.id
                                                ? 'bg-teal-900 border-teal-900'
                                                : 'bg-gray-50 border-gray-200'
                                        }`}
                                    >
                                        <Text className={`text-[10px] font-bold ${
                                            movementType === t.id ? 'text-white' : 'text-gray-700'
                                        }`}>
                                            {t.label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            <View className="flex-row justify-between mb-3">
                                <View className="w-[48%]">
                                    <Text className="text-gray-600 text-[10px] font-bold uppercase mb-1">Quantity *</Text>
                                    <TextInput
                                        className="bg-gray-100 rounded-xl px-4 py-3 text-sm text-gray-900 font-bold"
                                        placeholder="0"
                                        placeholderTextColor="#9CA3AF"
                                        value={quantity}
                                        onChangeText={setQuantity}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View className="w-[48%]">
                                    <Text className="text-gray-600 text-[10px] font-bold uppercase mb-1">Unit Cost (₱)</Text>
                                    <TextInput
                                        className="bg-gray-100 rounded-xl px-4 py-3 text-sm text-gray-900"
                                        placeholder="0.00"
                                        placeholderTextColor="#9CA3AF"
                                        value={unitCost}
                                        onChangeText={setUnitCost}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            <Text className="text-gray-600 text-xs font-bold uppercase mb-1">Reason / Notes</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-sm mb-6 text-gray-900"
                                placeholder="e.g. Physical inventory count discrepancy"
                                placeholderTextColor="#9CA3AF"
                                value={notes}
                                onChangeText={setNotes}
                            />

                            <View className="flex-row">
                                <Pressable
                                    onPress={() => setAdjustVisible(false)}
                                    className="flex-1 bg-gray-100 py-3.5 rounded-xl mr-2 items-center"
                                >
                                    <Text className="text-gray-700 font-bold text-sm">Cancel</Text>
                                </Pressable>
                                <Pressable
                                    onPress={handleRecordAdjustment}
                                    disabled={saving}
                                    className="flex-1 bg-teal-800 py-3.5 rounded-xl ml-2 items-center active:bg-teal-900"
                                >
                                    <Text className="text-white font-bold text-sm">
                                        {saving ? 'Posting...' : 'Post Stock Entry'}
                                    </Text>
                                </Pressable>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
