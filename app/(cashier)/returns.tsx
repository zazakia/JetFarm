import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/store/AuthContext';
import { formatPHP } from '../../src/utils/currency';
import { COMPANY_NAME } from '../../src/constants/brand';
import { CRISPY_KING_MENU, MenuItem } from '../../src/services/QSRPosService';
import { SalesReturnService, ReturnItemInput, ReturnCondition } from '../../src/services/SalesReturnService';
import { SupervisorApprovalModal } from '../../src/components/SupervisorApprovalModal';

export default function CashierReturnsScreen() {
    const router = useRouter();
    const { branchId, user } = useAuth();

    // Order info
    const [orderNumber, setOrderNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [refundMethod, setRefundMethod] = useState<'cash' | 'credit'>('cash');

    // Return items cart
    const [returnItems, setReturnItems] = useState<ReturnItemInput[]>([]);

    // Item selection modal
    const [itemModalOpen, setItemModalOpen] = useState(false);
    const [selectedMenuProduct, setSelectedMenuProduct] = useState<MenuItem | null>(null);
    const [itemQty, setItemQty] = useState('1');
    const [itemCondition, setItemCondition] = useState<ReturnCondition>('good_resellable');
    const [itemReason, setItemReason] = useState('Customer changed mind / wrong order');

    // Supervisor approval modal
    const [supervisorModalOpen, setSupervisorModalOpen] = useState(false);
    const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

    // Completed summary modal
    const [completedSummary, setCompletedSummary] = useState<{
        returnNumber: string;
        refundAmount: number;
        itemsCount: number;
    } | null>(null);

    const totalRefund = returnItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    const handleAddItem = () => {
        if (!selectedMenuProduct) return;
        const qty = parseInt(itemQty, 10);
        if (isNaN(qty) || qty <= 0) {
            Alert.alert('Invalid Quantity', 'Please enter a valid quantity.');
            return;
        }

        const newItem: ReturnItemInput = {
            productId: selectedMenuProduct.productId,
            productName: selectedMenuProduct.name,
            condition: itemCondition,
            quantity: qty,
            unitPrice: selectedMenuProduct.price,
            unitCost: Math.round(selectedMenuProduct.price * 0.55),
            reason: itemReason,
        };

        setReturnItems((prev) => [...prev, newItem]);
        setItemModalOpen(false);
        setSelectedMenuProduct(null);
        setItemQty('1');
        setItemCondition('good_resellable');
    };

    const handleRemoveItem = (index: number) => {
        setReturnItems((prev) => prev.filter((_, idx) => idx !== index));
    };

    const handleRequestApproval = () => {
        if (returnItems.length === 0) {
            Alert.alert('Empty Return', 'Please add at least one item to return.');
            return;
        }

        try {
            // Step 1: Draft
            const draft = SalesReturnService.createReturnDraft({
                branchId: branchId || 'Crispy King Branch',
                cashierId: user?.id || 'cashier-1',
                originalOrderNumber: orderNumber.trim() || undefined,
                customerName: customerName.trim() || 'Walk-in Customer',
                items: returnItems,
                refundMethod,
            });

            setActiveDraftId(draft.id);
            // Step 2: Open supervisor approval modal
            setSupervisorModalOpen(true);
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to create return draft.');
        }
    };

    const handleSupervisorApproved = async (supervisorName: string) => {
        setSupervisorModalOpen(false);
        if (!activeDraftId) return;

        try {
            // Step 2: Approve
            SalesReturnService.approveReturn(activeDraftId, supervisorName);

            // Step 3: Complete (Restocks good items, wastes damaged items, pays refund)
            const result = await SalesReturnService.completeReturn(activeDraftId);

            setCompletedSummary({
                returnNumber: result.returnDraft.returnNumber,
                refundAmount: result.returnDraft.totalRefundAmount,
                itemsCount: result.returnDraft.items.length,
            });

            // Reset form
            setReturnItems([]);
            setOrderNumber('');
            setCustomerName('');
            setActiveDraftId(null);
        } catch (err: any) {
            Alert.alert('Completion Error', err.message || 'Failed to complete return.');
        }
    };

    return (
        <ScrollView className="flex-1 bg-slate-100 p-4">
            {/* Header Card */}
            <View className="bg-emerald-800 rounded-2xl p-5 mb-4 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-emerald-200 text-xs font-semibold uppercase tracking-wider">
                        {COMPANY_NAME} Store Operations
                    </Text>
                    <View className="bg-emerald-700 px-3 py-1 rounded-full">
                        <Text className="text-white text-xs font-bold">POS Return & Refund</Text>
                    </View>
                </View>
                <Text className="text-white text-2xl font-black">Sales Return Terminal</Text>
                <Text className="text-emerald-100 text-xs mt-1">
                    Process customer product returns, restock sellable units, write off damaged items & refund money.
                </Text>
            </View>

            {/* Customer & Order Reference Card */}
            <View className="bg-white rounded-2xl p-4 border border-slate-200 mb-4 shadow-sm">
                <Text className="text-slate-800 text-sm font-bold mb-3">Customer & Order Details</Text>
                <View className="flex-row space-x-3 mb-3">
                    <View className="flex-1">
                        <Text className="text-slate-500 text-xs font-medium mb-1">Receipt / Order Number (Optional)</Text>
                        <TextInput
                            value={orderNumber}
                            onChangeText={setOrderNumber}
                            placeholder="e.g. CK-20260910-ABC12"
                            placeholderTextColor="#9CA3AF"
                            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-sm"
                        />
                    </View>
                    <View className="flex-1">
                        <Text className="text-slate-500 text-xs font-medium mb-1">Customer Name</Text>
                        <TextInput
                            value={customerName}
                            onChangeText={setCustomerName}
                            placeholder="e.g. Maria Santos"
                            placeholderTextColor="#9CA3AF"
                            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-sm"
                        />
                    </View>
                </View>

                <View className="flex-row items-center justify-between pt-2 border-t border-slate-100">
                    <Text className="text-slate-700 text-xs font-semibold">Refund Method:</Text>
                    <View className="flex-row space-x-2">
                        <Pressable
                            onPress={() => setRefundMethod('cash')}
                            className={`px-3 py-1.5 rounded-lg border ${
                                refundMethod === 'cash' ? 'bg-emerald-700 border-emerald-700' : 'bg-slate-50 border-slate-200'
                            }`}
                        >
                            <Text className={`text-xs font-bold ${refundMethod === 'cash' ? 'text-white' : 'text-slate-700'}`}>
                                Cash Payout
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setRefundMethod('credit')}
                            className={`px-3 py-1.5 rounded-lg border ${
                                refundMethod === 'credit' ? 'bg-emerald-700 border-emerald-700' : 'bg-slate-50 border-slate-200'
                            }`}
                        >
                            <Text className={`text-xs font-bold ${refundMethod === 'credit' ? 'text-white' : 'text-slate-700'}`}>
                                Store Credit
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>

            {/* Return Items Section */}
            <View className="bg-white rounded-2xl p-4 border border-slate-200 mb-4 shadow-sm">
                <View className="flex-row items-center justify-between mb-3">
                    <View>
                        <Text className="text-slate-800 text-sm font-bold">Returned Items</Text>
                        <Text className="text-slate-500 text-xs">Specify condition for correct inventory routing</Text>
                    </View>
                    <Pressable
                        onPress={() => setItemModalOpen(true)}
                        className="bg-emerald-700 px-3 py-1.5 rounded-xl flex-row items-center"
                    >
                        <Ionicons name="add" size={16} color="#ffffff" style={{ marginRight: 4 }} />
                        <Text className="text-white text-xs font-bold">Add Item</Text>
                    </Pressable>
                </View>

                {returnItems.length === 0 ? (
                    <View className="py-8 items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50">
                        <Ionicons name="cart-outline" size={32} color="#94a3b8" />
                        <Text className="text-slate-600 font-semibold text-xs mt-2">No items selected for return</Text>
                        <Text className="text-slate-400 text-[11px] mt-0.5">Click "Add Item" above to select products</Text>
                    </View>
                ) : (
                    returnItems.map((item, idx) => (
                        <View
                            key={idx}
                            className="p-3 bg-slate-50 border border-slate-200 rounded-xl mb-2 flex-row items-center justify-between"
                        >
                            <View className="flex-1 mr-2">
                                <View className="flex-row items-center">
                                    <Text className="text-slate-900 font-bold text-sm">{item.productName}</Text>
                                    <View
                                        className={`ml-2 px-2 py-0.5 rounded ${
                                            item.condition === 'good_resellable'
                                                ? 'bg-emerald-100 border border-emerald-200'
                                                : 'bg-rose-100 border border-rose-200'
                                        }`}
                                    >
                                        <Text
                                            className={`text-[10px] font-bold ${
                                                item.condition === 'good_resellable' ? 'text-emerald-800' : 'text-rose-800'
                                            }`}
                                        >
                                            {item.condition === 'good_resellable' ? 'Good (Restock)' : 'Damaged (Waste)'}
                                        </Text>
                                    </View>
                                </View>
                                <Text className="text-slate-500 text-xs mt-0.5">
                                    {item.quantity} pc(s) @ {formatPHP(item.unitPrice)} • Reason: {item.reason}
                                </Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-slate-900 font-extrabold text-sm">
                                    {formatPHP(item.unitPrice * item.quantity)}
                                </Text>
                                <Pressable onPress={() => handleRemoveItem(idx)} className="mt-1">
                                    <Ionicons name="trash-outline" size={18} color="#e11d48" />
                                </Pressable>
                            </View>
                        </View>
                    ))
                )}
            </View>

            {/* Total & Action Bar */}
            <View className="bg-white rounded-2xl p-4 border border-slate-200 mb-6 shadow-sm">
                <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-slate-600 font-bold text-sm">Total Refund Payout:</Text>
                    <Text className="text-emerald-800 text-2xl font-black">{formatPHP(totalRefund)}</Text>
                </View>

                <Pressable
                    onPress={handleRequestApproval}
                    disabled={returnItems.length === 0}
                    className={`py-3.5 rounded-xl items-center justify-center flex-row shadow-sm ${
                        returnItems.length > 0 ? 'bg-emerald-700 active:bg-emerald-800' : 'bg-slate-300'
                    }`}
                >
                    <Ionicons name="shield-checkmark" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text className="text-white text-sm font-bold">Request Supervisor Approval & Refund</Text>
                </Pressable>
            </View>

            {/* Add Item Modal */}
            <Modal visible={itemModalOpen} transparent animationType="fade" onRequestClose={() => setItemModalOpen(false)}>
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-5 w-full max-w-md shadow-xl">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-slate-900 font-bold text-base">Select Item to Return</Text>
                            <Pressable onPress={() => setItemModalOpen(false)}>
                                <Ionicons name="close" size={22} color="#64748b" />
                            </Pressable>
                        </View>

                        <Text className="text-slate-500 text-xs font-semibold mb-2">Choose Crispy King Product:</Text>
                        <ScrollView className="max-h-48 mb-3">
                            {CRISPY_KING_MENU.map((p) => {
                                const isSelected = selectedMenuProduct?.productId === p.productId;
                                return (
                                    <Pressable
                                        key={p.productId}
                                        onPress={() => setSelectedMenuProduct(p)}
                                        className={`p-2.5 rounded-xl border mb-1.5 flex-row justify-between items-center ${
                                            isSelected ? 'bg-emerald-50 border-emerald-600' : 'bg-slate-50 border-slate-200'
                                        }`}
                                    >
                                        <Text className="text-slate-900 text-xs font-bold">{p.name}</Text>
                                        <Text className="text-emerald-700 text-xs font-extrabold">{formatPHP(p.price)}</Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>

                        <View className="flex-row space-x-3 mb-3">
                            <View className="w-24">
                                <Text className="text-slate-500 text-xs font-medium mb-1">Quantity (pcs)</Text>
                                <TextInput
                                    value={itemQty}
                                    onChangeText={setItemQty}
                                    keyboardType="numeric"
                                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-sm font-bold"
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-slate-500 text-xs font-medium mb-1">Condition</Text>
                                <View className="flex-row space-x-2">
                                    <Pressable
                                        onPress={() => setItemCondition('good_resellable')}
                                        className={`flex-1 py-2 rounded-xl border items-center ${
                                            itemCondition === 'good_resellable'
                                                ? 'bg-emerald-700 border-emerald-700'
                                                : 'bg-slate-50 border-slate-200'
                                        }`}
                                    >
                                        <Text
                                            className={`text-xs font-bold ${
                                                itemCondition === 'good_resellable' ? 'text-white' : 'text-slate-700'
                                            }`}
                                        >
                                            Good / Shelf
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => setItemCondition('damaged_expired')}
                                        className={`flex-1 py-2 rounded-xl border items-center ${
                                            itemCondition === 'damaged_expired'
                                                ? 'bg-rose-700 border-rose-700'
                                                : 'bg-slate-50 border-slate-200'
                                        }`}
                                    >
                                        <Text
                                            className={`text-xs font-bold ${
                                                itemCondition === 'damaged_expired' ? 'text-white' : 'text-slate-700'
                                            }`}
                                        >
                                            Damaged
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                        </View>

                        <View className="mb-4">
                            <Text className="text-slate-500 text-xs font-medium mb-1">Return Reason</Text>
                            <TextInput
                                value={itemReason}
                                onChangeText={setItemReason}
                                placeholder="e.g. Wrong order, cold, customer request"
                                placeholderTextColor="#9CA3AF"
                                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 text-sm"
                            />
                        </View>

                        <Pressable
                            onPress={handleAddItem}
                            disabled={!selectedMenuProduct}
                            className={`py-3 rounded-xl items-center ${
                                selectedMenuProduct ? 'bg-emerald-700' : 'bg-slate-300'
                            }`}
                        >
                            <Text className="text-white font-bold text-sm">Confirm Item</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* Supervisor PIN Authorization Modal */}
            <SupervisorApprovalModal
                visible={supervisorModalOpen}
                actionTitle="Supervisor Approval Required"
                actionDescription={`Approve return refund of ${formatPHP(totalRefund)} to ${customerName || 'customer'}.`}
                branchId={branchId || 'branch-bagacay'}
                onApproved={({ supervisorName }) => {
                    handleSupervisorApproved(supervisorName);
                }}
                onClose={() => setSupervisorModalOpen(false)}
            />

            {/* Return Completed Success Receipt Modal */}
            <Modal visible={!!completedSummary} transparent animationType="fade">
                <View className="flex-1 bg-black/60 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-sm items-center shadow-2xl">
                        <View className="w-16 h-16 bg-emerald-100 rounded-full items-center justify-center mb-3">
                            <Ionicons name="checkmark-circle" size={40} color="#047857" />
                        </View>
                        <Text className="text-slate-900 font-extrabold text-xl mb-1">Return Completed</Text>
                        <Text className="text-slate-500 text-xs font-mono mb-4">{completedSummary?.returnNumber}</Text>

                        <View className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-5 space-y-2">
                            <View className="flex-row justify-between">
                                <Text className="text-slate-600 text-xs">Refund Amount:</Text>
                                <Text className="text-emerald-700 font-black text-sm">
                                    {formatPHP(completedSummary?.refundAmount || 0)}
                                </Text>
                            </View>
                            <View className="flex-row justify-between">
                                <Text className="text-slate-600 text-xs">Total Items Processed:</Text>
                                <Text className="text-slate-800 font-bold text-xs">{completedSummary?.itemsCount} line(s)</Text>
                            </View>
                            <View className="flex-row justify-between">
                                <Text className="text-slate-600 text-xs">Warehouse Shelves:</Text>
                                <Text className="text-emerald-700 font-bold text-xs">Restocked Good Units</Text>
                            </View>
                        </View>

                        <Pressable
                            onPress={() => setCompletedSummary(null)}
                            className="bg-emerald-700 w-full py-3 rounded-xl items-center"
                        >
                            <Text className="text-white font-bold text-sm">Done & Close</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}
