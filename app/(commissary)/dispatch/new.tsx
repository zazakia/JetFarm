import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../src/store/AuthContext';
import {
    CommissaryDispatchService,
    CreateDispatchItemInput,
} from '../../../src/services/CommissaryDispatchService';
import { formatPHP } from '../../../src/utils/currency';

const MASTER_COMMISSARY_ITEMS = [
    { productId: 'ck-chicken-raw', name: 'Marinated S-Cut Chicken (Kilos)', uom: 'kg', unitCost: 140.0 },
    { productId: 'ck-breading', name: 'Crispy King Breading Mix', uom: 'bag', unitCost: 250.0 },
    { productId: 'ck-gravy', name: 'Gravy Powder Mix', uom: 'pack', unitCost: 180.0 },
    { productId: 'ck-oil-tin', name: 'Deep Frying Oil (17kg Tin)', uom: 'tin', unitCost: 1250.0 },
    { productId: 'ck-rice-50k', name: 'Raw Rice (50kg Sack)', uom: 'sack', unitCost: 2400.0 },
    { productId: 'ck-sd10-case', name: 'Softdrinks 1.0L (Case 12s)', uom: 'case', unitCost: 420.0 },
    { productId: 'ck-sd15-case', name: 'Softdrinks 1.5L (Case 12s)', uom: 'case', unitCost: 620.0 },
    { productId: 'ck-paper-bags', name: 'Packaging Paper Bags (100s)', uom: 'bundle', unitCost: 85.0 },
    { productId: 'ck-chicken-neck', name: 'Marinated Chicken Neck (Kilos)', uom: 'kg', unitCost: 90.0 },
    { productId: 'ck-chicken-fillet', name: 'Marinated Chicken Fillet (Kilos)', uom: 'kg', unitCost: 160.0 },
];

const SAMPLE_BRANCHES = [
    { id: 'branch-bagacay', name: 'Bagacay (Benchmark)' },
    { id: 'branch-locsin', name: 'Locsin' },
    { id: 'branch-daro', name: 'Daro' },
    { id: 'branch-bayawan', name: 'Bayawan' },
    { id: 'branch-tanjay1', name: 'Tanjay 1' },
    { id: 'branch-sagay1', name: 'Sagay 1' },
    { id: 'branch-sancarlos1', name: 'San Carlos 1' },
    { id: 'branch-guihulngan', name: 'Guihulngan' },
    { id: 'branch-dumaguete-port', name: 'Dumaguete Port' },
    { id: 'branch-batinguel', name: 'Batinguel' },
];

export default function NewCommissaryDispatchScreen() {
    const router = useRouter();
    const { user } = useAuth();

    const [destinationBranchId, setDestinationBranchId] = useState<string>(SAMPLE_BRANCHES[0].id);
    const [poReference, setPoReference] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [items, setItems] = useState<CreateDispatchItemInput[]>([
        {
            productId: 'ck-chicken-raw',
            productName: 'Marinated S-Cut Chicken (Kilos)',
            quantityExpected: 150,
            uom: 'kg',
            unitCost: 140.0,
        },
        {
            productId: 'ck-breading',
            productName: 'Crispy King Breading Mix',
            quantityExpected: 10,
            uom: 'bag',
            unitCost: 250.0,
        },
    ]);
    const [saving, setSaving] = useState<boolean>(false);

    const handleAddItem = (catalogItem: typeof MASTER_COMMISSARY_ITEMS[0]) => {
        const existingIdx = items.findIndex((i) => i.productId === catalogItem.productId);
        if (existingIdx >= 0) {
            const updated = [...items];
            updated[existingIdx].quantityExpected += 1;
            setItems(updated);
        } else {
            setItems([
                ...items,
                {
                    productId: catalogItem.productId,
                    productName: catalogItem.name,
                    quantityExpected: 1,
                    uom: catalogItem.uom,
                    unitCost: catalogItem.unitCost,
                },
            ]);
        }
    };

    const handleUpdateQuantity = (index: number, quantityStr: string) => {
        const qty = parseFloat(quantityStr) || 0;
        const updated = [...items];
        updated[index].quantityExpected = qty;
        setItems(updated);
    };

    const handleRemoveItem = (index: number) => {
        const updated = items.filter((_, idx) => idx !== index);
        setItems(updated);
    };

    const totalAmount = items.reduce((sum, item) => {
        return sum + (item.quantityExpected || 0) * (item.unitCost || 0);
    }, 0);

    const handleSaveDispatch = async () => {
        if (!destinationBranchId) {
            Alert.alert('Validation Error', 'Please select a destination branch.');
            return;
        }

        const validItems = items.filter((i) => i.quantityExpected > 0);
        if (validItems.length === 0) {
            Alert.alert('Validation Error', 'Please specify at least one item with quantity > 0.');
            return;
        }

        try {
            setSaving(true);
            await CommissaryDispatchService.createDispatch({
                fromLocation: 'Main Office Commissary (Dumaguete)',
                toBranchId: destinationBranchId,
                poReference: poReference.trim() || undefined,
                dispatchedBy: user?.email || 'Commissary Keeper',
                notes: notes.trim() || undefined,
                items: validItems,
            });

            Alert.alert('Success', 'Commissary dispatch draft created successfully.', [
                {
                    text: 'OK',
                    onPress: () => router.back(),
                },
            ]);
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to create dispatch.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView className="flex-1 bg-slate-50 p-4">
            <View className="bg-white rounded-xl p-4 border border-slate-200 mb-4 shadow-sm">
                <Text className="text-slate-900 font-bold text-base mb-3">Delivery Information</Text>

                {/* Branch Selector */}
                <Text className="text-slate-700 font-semibold text-xs mb-1">Destination Branch</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-3">
                    {SAMPLE_BRANCHES.map((branch) => {
                        const isSelected = destinationBranchId === branch.id;
                        return (
                            <TouchableOpacity
                                key={branch.id}
                                onPress={() => setDestinationBranchId(branch.id)}
                                className={`px-3 py-1.5 rounded-lg mr-2 border ${
                                    isSelected
                                        ? 'bg-orange-800 border-orange-800'
                                        : 'bg-slate-100 border-slate-200'
                                }`}
                            >
                                <Text
                                    className={`text-xs font-semibold ${
                                        isSelected ? 'text-white' : 'text-slate-700'
                                    }`}
                                >
                                    {branch.name}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* PO Ref */}
                <Text className="text-slate-700 font-semibold text-xs mb-1">PO Reference (Optional)</Text>
                <TextInput
                    value={poReference}
                    onChangeText={setPoReference}
                    placeholder="e.g. PO-2026-0715-BAG"
                    placeholderTextColor="#9CA3AF"
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm mb-3"
                />

                {/* Notes */}
                <Text className="text-slate-700 font-semibold text-xs mb-1">Logistics Notes</Text>
                <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Special transit or cold-chain handling notes..."
                    placeholderTextColor="#9CA3AF"
                    className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm"
                />
            </View>

            {/* Quick Item Catalog Picker */}
            <View className="bg-white rounded-xl p-4 border border-slate-200 mb-4 shadow-sm">
                <Text className="text-slate-900 font-bold text-base mb-2">Add From Master Catalog</Text>
                <View className="flex-row flex-wrap">
                    {MASTER_COMMISSARY_ITEMS.map((item) => (
                        <TouchableOpacity
                            key={item.productId}
                            onPress={() => handleAddItem(item)}
                            className="bg-orange-50 border border-orange-200 px-2.5 py-1.5 rounded-lg mr-2 mb-2"
                        >
                            <Text className="text-orange-900 text-xs font-semibold">
                                + {item.name} ({formatPHP(item.unitCost)})
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Dispatch Manifest Items */}
            <View className="bg-white rounded-xl p-4 border border-slate-200 mb-4 shadow-sm">
                <Text className="text-slate-900 font-bold text-base mb-3">
                    Manifest Items ({items.length})
                </Text>

                {items.length === 0 ? (
                    <Text className="text-slate-400 text-xs py-4 text-center">
                        No items added yet. Pick items from the catalog above.
                    </Text>
                ) : (
                    items.map((item, index) => {
                        const lineTotal = (item.quantityExpected || 0) * (item.unitCost || 0);
                        return (
                            <View
                                key={index}
                                className="flex-row items-center justify-between py-2 border-b border-slate-100"
                            >
                                <View className="flex-1 mr-2">
                                    <Text className="text-slate-900 font-semibold text-xs">
                                        {item.productName}
                                    </Text>
                                    <Text className="text-slate-500 text-xs">
                                        Unit: {formatPHP(item.unitCost)} / {item.uom}
                                    </Text>
                                </View>

                                <View className="flex-row items-center">
                                    <TextInput
                                        keyboardType="numeric"
                                        value={String(item.quantityExpected || '')}
                                        onChangeText={(val) => handleUpdateQuantity(index, val)}
                                        placeholder="0"
                                        placeholderTextColor="#9CA3AF"
                                        className="w-16 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-center text-slate-900 text-sm mr-2"
                                    />
                                    <Text className="text-slate-500 text-xs w-8">{item.uom}</Text>
                                    <Text className="text-slate-900 font-bold text-xs w-20 text-right">
                                        {formatPHP(lineTotal)}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => handleRemoveItem(index)}
                                        className="ml-2 px-2 py-1 bg-rose-50 rounded"
                                    >
                                        <Text className="text-rose-600 font-bold text-xs">✕</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}

                {/* Total Value */}
                <View className="flex-row justify-between items-center pt-3 mt-2 border-t border-slate-200">
                    <Text className="text-slate-700 font-bold text-sm">Total Manifest Value:</Text>
                    <Text className="text-orange-800 font-bold text-lg">{formatPHP(totalAmount)}</Text>
                </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
                onPress={handleSaveDispatch}
                disabled={saving}
                className="bg-emerald-600 rounded-xl p-4 items-center justify-center mb-8 shadow-sm"
            >
                {saving ? (
                    <ActivityIndicator color="#ffffff" />
                ) : (
                    <Text className="text-white font-bold text-base">Create Dispatch Note</Text>
                )}
            </TouchableOpacity>
        </ScrollView>
    );
}
