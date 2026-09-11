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
import { WasteLogService, WasteReason } from '../../../src/services/WasteLogService';
import { formatPHP } from '../../../src/utils/currency';

const INVENTORY_ITEMS = [
    { productId: 'ck-scut-cooked', name: 'Fried S-Cut Chicken', uom: 'pcs', unitCost: 32.0 },
    { productId: 'ck-chicken-raw', name: 'Raw Marinated Chicken', uom: 'kg', unitCost: 140.0 },
    { productId: 'ck-rice-cooked', name: 'Cooked Rice', uom: 'cups', unitCost: 6.0 },
    { productId: 'ck-rice-raw', name: 'Raw Rice', uom: 'kg', unitCost: 48.0 },
    { productId: 'ck-breading', name: 'Crispy King Breading Mix', uom: 'kg', unitCost: 125.0 },
    { productId: 'ck-oil', name: 'Frying Oil', uom: 'liters', unitCost: 75.0 },
    { productId: 'ck-sd10', name: 'Softdrinks 1.0L', uom: 'btl', unitCost: 35.0 },
    { productId: 'ck-atsara', name: 'Atsara Papaya', uom: 'cups', unitCost: 5.0 },
    { productId: 'ck-fillet', name: 'Chicken Fillet', uom: 'pcs', unitCost: 28.0 },
    { productId: 'ck-neck', name: 'Chicken Neck', uom: 'pcs', unitCost: 12.0 },
];

const REASONS: { value: WasteReason; label: string }[] = [
    { value: 'burnt_overcooked', label: 'Burnt / Overcooked in Fryer' },
    { value: 'expired', label: 'Expired / Passed Shelf Life' },
    { value: 'spilled_dropped', label: 'Spilled / Dropped on Floor' },
    { value: 'damaged', label: 'Damaged Packaging / Punctured' },
    { value: 'contamination', label: 'Contamination' },
    { value: 'bad_order', label: 'Bad Order (Rotten / Sour Smell)' },
];

export default function CreateWasteLogScreen() {
    const router = useRouter();
    const { user, branchId } = useAuth();
    const activeBranchId = branchId || 'branch-bagacay';

    const [selectedItem, setSelectedItem] = useState(INVENTORY_ITEMS[0]);
    const [quantity, setQuantity] = useState<string>('1');
    const [unitCost, setUnitCost] = useState<string>(String(INVENTORY_ITEMS[0].unitCost));
    const [reason, setReason] = useState<WasteReason>('burnt_overcooked');
    const [notes, setNotes] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);

    const handleItemSelect = (item: typeof INVENTORY_ITEMS[0]) => {
        setSelectedItem(item);
        setUnitCost(String(item.unitCost));
    };

    const numQty = parseFloat(quantity) || 0;
    const numCost = parseFloat(unitCost) || 0;
    const totalLoss = Math.round(numQty * numCost * 100) / 100;

    const handleSubmit = async () => {
        if (numQty <= 0) {
            Alert.alert('Validation Error', 'Waste quantity must be greater than zero.');
            return;
        }

        try {
            setSubmitting(true);
            const staffName = user?.email || 'Branch Manager';

            await WasteLogService.recordWaste({
                branchId: activeBranchId,
                productId: selectedItem.productId,
                productName: selectedItem.name,
                quantity: numQty,
                uom: selectedItem.uom,
                reason,
                unitCost: numCost,
                recordedBy: staffName,
                notes: notes.trim() || undefined,
            });

            Alert.alert(
                'Waste Recorded',
                `Successfully recorded loss of ${formatPHP(totalLoss)}. Shelf stock deducted and Journal Voucher posted.`,
                [
                    {
                        text: 'OK',
                        onPress: () => router.back(),
                    },
                ]
            );
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to record waste.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ScrollView className="flex-1 bg-slate-50 p-4">
            {/* Branch Header */}
            <View className="bg-white p-3 rounded-xl border border-slate-200 mb-4 flex-row justify-between items-center">
                <Text className="text-slate-600 text-xs">Branch: <Text className="font-bold text-slate-900">{activeBranchId}</Text></Text>
                <Text className="text-rose-600 font-bold text-xs">Debit 5100 / Credit 1200</Text>
            </View>

            {/* Product Selector */}
            <View className="bg-white rounded-xl p-4 border border-slate-200 mb-4 shadow-sm">
                <Text className="text-slate-900 font-bold text-base mb-2">Select Spoiled Item</Text>
                <View className="flex-row flex-wrap">
                    {INVENTORY_ITEMS.map((item) => {
                        const isSelected = selectedItem.productId === item.productId;
                        return (
                            <TouchableOpacity
                                key={item.productId}
                                onPress={() => handleItemSelect(item)}
                                className={`px-3 py-2 rounded-lg mr-2 mb-2 border ${
                                    isSelected
                                        ? 'bg-rose-700 border-rose-700'
                                        : 'bg-slate-50 border-slate-200'
                                }`}
                            >
                                <Text
                                    className={`text-xs font-semibold ${
                                        isSelected ? 'text-white' : 'text-slate-800'
                                    }`}
                                >
                                    {item.name}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* Quantity and Unit Cost */}
            <View className="bg-white rounded-xl p-4 border border-slate-200 mb-4 shadow-sm">
                <Text className="text-slate-900 font-bold text-base mb-3">Quantity & Cost</Text>

                <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-1 mr-3">
                        <Text className="text-slate-700 text-xs font-semibold mb-1">
                            Spoiled Quantity ({selectedItem.uom})
                        </Text>
                        <TextInput
                            keyboardType="numeric"
                            value={quantity}
                            onChangeText={setQuantity}
                            placeholder="0"
                            placeholderTextColor="#9CA3AF"
                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-base font-bold"
                        />
                    </View>

                    <View className="flex-1">
                        <Text className="text-slate-700 text-xs font-semibold mb-1">
                            Unit Cost (₱)
                        </Text>
                        <TextInput
                            keyboardType="numeric"
                            value={unitCost}
                            onChangeText={setUnitCost}
                            placeholder="0.00"
                            placeholderTextColor="#9CA3AF"
                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-base font-bold"
                        />
                    </View>
                </View>

                {/* Live Loss Card */}
                <View className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex-row justify-between items-center">
                    <Text className="text-rose-900 font-bold text-sm">Estimated Spoilage Loss:</Text>
                    <Text className="text-rose-700 font-black text-lg">{formatPHP(totalLoss)}</Text>
                </View>
            </View>

            {/* Reason Selector */}
            <View className="bg-white rounded-xl p-4 border border-slate-200 mb-4 shadow-sm">
                <Text className="text-slate-900 font-bold text-base mb-2">Reason for Spoilage / BO</Text>
                {REASONS.map((r) => {
                    const isSelected = reason === r.value;
                    return (
                        <TouchableOpacity
                            key={r.value}
                            onPress={() => setReason(r.value)}
                            className={`p-2.5 rounded-lg mb-2 border flex-row items-center ${
                                isSelected
                                    ? 'bg-rose-50 border-rose-500'
                                    : 'bg-slate-50 border-slate-200'
                            }`}
                        >
                            <View
                                className={`w-4 h-4 rounded-full border mr-2.5 items-center justify-center ${
                                    isSelected ? 'border-rose-600 bg-rose-600' : 'border-slate-400'
                                }`}
                            >
                                {isSelected && <View className="w-2 h-2 rounded-full bg-white" />}
                            </View>
                            <Text
                                className={`text-xs ${
                                    isSelected ? 'text-rose-900 font-bold' : 'text-slate-700'
                                }`}
                            >
                                {r.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Inspection Notes */}
            <View className="bg-white rounded-xl p-4 border border-slate-200 mb-4 shadow-sm">
                <Text className="text-slate-900 font-bold text-base mb-1">Inspection Notes / Batch #</Text>
                <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="e.g. Overheated oil batch, power outage freezer thaw, dropped during transfer..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={3}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 text-sm"
                />
            </View>

            {/* Accounting Notice */}
            <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <Text className="text-amber-900 font-bold text-xs">⚠️ Immediate Effect:</Text>
                <Text className="text-amber-800 text-xs mt-0.5">
                    Submitting this log immediately creates an inventory stock adjustment deduction
                    and posts a Loss on Spoilage entry to the general ledger.
                </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting}
                className="bg-rose-600 rounded-xl p-4 items-center justify-center mb-8 shadow-sm"
            >
                {submitting ? (
                    <ActivityIndicator color="#ffffff" />
                ) : (
                    <Text className="text-white font-bold text-base">Record Waste & Deduct Stock</Text>
                )}
            </TouchableOpacity>
        </ScrollView>
    );
}
