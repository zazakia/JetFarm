import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../src/store/AuthContext';
import {
    CommissaryDispatchService,
    ReceivedItemInput,
} from '../../../src/services/CommissaryDispatchService';
import CommissaryDispatch, { DispatchItem } from '../../../src/database/models/CommissaryDispatch';
import { formatPHP } from '../../../src/utils/currency';

export default function BranchReceivingDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { user } = useAuth();

    const [dispatch, setDispatch] = useState<CommissaryDispatch | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [disputeModalVisible, setDisputeModalVisible] = useState<boolean>(false);
    const [disputeReason, setDisputeReason] = useState<string>('');

    const loadDispatch = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const data = await CommissaryDispatchService.getDispatchById(id);
            setDispatch(data);

            const initialCounts: Record<string, number> = {};
            const initialNotes: Record<string, string> = {};
            data.items.forEach((item) => {
                initialCounts[item.productId] =
                    item.quantityReceived !== undefined ? item.quantityReceived : item.quantityExpected;
                if (item.notes) {
                    initialNotes[item.productId] = item.notes;
                }
            });
            setCounts(initialCounts);
            setItemNotes(initialNotes);
        } catch (err) {
            console.error('Failed to load dispatch detail:', err);
            Alert.alert('Error', 'Could not load dispatch details.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadDispatch();
    }, [loadDispatch]);

    const handleCountChange = (productId: string, val: string) => {
        const num = parseFloat(val);
        setCounts((prev) => ({
            ...prev,
            [productId]: isNaN(num) ? 0 : num,
        }));
    };

    const handleNoteChange = (productId: string, val: string) => {
        setItemNotes((prev) => ({
            ...prev,
            [productId]: val,
        }));
    };

    const handleReceivePhysicalCount = async () => {
        if (!dispatch) return;

        const receivedList: ReceivedItemInput[] = (dispatch.items || []).map((item) => ({
            productId: item.productId,
            quantityReceived: counts[item.productId] ?? item.quantityExpected,
            notes: itemNotes[item.productId] || undefined,
        }));

        try {
            setSubmitting(true);
            const managerName = user?.email || 'Branch Manager';
            await CommissaryDispatchService.receiveDispatch(dispatch.id, receivedList, managerName);
            Alert.alert('Success', 'Physical count recorded. Status is now Received.');
            loadDispatch();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to save physical count.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleVerifyAndCommit = async () => {
        if (!dispatch) return;

        try {
            setSubmitting(true);
            const verifierName = user?.email || 'Store Supervisor';
            await CommissaryDispatchService.verifyAndPostToInventory(dispatch.id, verifierName);
            Alert.alert('Stock Committed', 'Delivery stock successfully added to branch shelf inventory.');
            loadDispatch();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to verify and post stock.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDispute = async () => {
        if (!dispatch || !disputeReason.trim()) {
            Alert.alert('Reason Required', 'Please enter a description for the dispute.');
            return;
        }

        try {
            setSubmitting(true);
            await CommissaryDispatchService.disputeDispatch(dispatch.id, disputeReason.trim());
            setDisputeModalVisible(false);
            Alert.alert('Dispute Logged', 'Delivery has been marked as Disputed for Supervisor investigation.');
            loadDispatch();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to flag dispute.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-slate-50">
                <ActivityIndicator size="large" color="#1e40af" />
                <Text className="text-slate-500 mt-2 text-sm">Loading delivery manifest...</Text>
            </View>
        );
    }

    if (!dispatch) {
        return (
            <View className="flex-1 justify-center items-center p-6 bg-slate-50">
                <Text className="text-slate-500 text-base font-bold">Dispatch not found</Text>
            </View>
        );
    }

    const items: DispatchItem[] = dispatch.items || [];

    return (
        <ScrollView className="flex-1 bg-slate-50 p-4">
            {/* Delivery Info Card */}
            <View className="bg-white rounded-xl p-4 border border-slate-200 mb-4 shadow-sm">
                <View className="flex-row justify-between items-start">
                    <View>
                        <Text className="text-slate-900 font-bold text-lg">{dispatch.dispatchNumber}</Text>
                        <Text className="text-slate-500 text-xs mt-0.5">From: {dispatch.fromLocation}</Text>
                        <Text className="text-slate-500 text-xs">Destination: {dispatch.toBranchId}</Text>
                        {dispatch.poReference && (
                            <Text className="text-slate-400 text-xs mt-0.5">PO: {dispatch.poReference}</Text>
                        )}
                    </View>
                    <View className="bg-blue-100 px-3 py-1 rounded-full">
                        <Text className="text-blue-800 text-xs font-bold uppercase">
                            {dispatch.status.replace('_', ' ')}
                        </Text>
                    </View>
                </View>

                {dispatch.notes && (
                    <View className="bg-amber-50 p-2.5 rounded-lg mt-3 border border-amber-200">
                        <Text className="text-amber-800 text-xs font-semibold">Notes / Discrepancies:</Text>
                        <Text className="text-amber-700 text-xs mt-0.5">{dispatch.notes}</Text>
                    </View>
                )}
            </View>

            {/* Verification Instructions */}
            <View className="bg-blue-50 p-3 rounded-xl border border-blue-200 mb-4">
                <Text className="text-blue-900 text-xs font-bold">Physical Count Procedure:</Text>
                <Text className="text-blue-700 text-xs mt-0.5">
                    Weigh raw chicken batches, count breading bags, and inspect cold seals. Enter received
                    quantities below. Shortages or overages will be automatically highlighted.
                </Text>
            </View>

            {/* Line Items List */}
            <View className="bg-white rounded-xl p-4 border border-slate-200 mb-4 shadow-sm">
                <Text className="text-slate-900 font-bold text-base mb-3">
                    Cargo Manifest & Physical Count
                </Text>

                {items.map((item) => {
                    const receivedCount = counts[item.productId] ?? item.quantityExpected;
                    const variance = receivedCount - item.quantityExpected;
                    const hasShortage = variance < 0;
                    const hasOverage = variance > 0;
                    const isExact = variance === 0;

                    return (
                        <View
                            key={item.productId}
                            className="py-3 border-b border-slate-100"
                        >
                            <View className="flex-row justify-between items-start mb-1">
                                <View className="flex-1 mr-2">
                                    <Text className="text-slate-900 font-bold text-sm">
                                        {item.productName}
                                    </Text>
                                    <Text className="text-slate-500 text-xs">
                                        Unit Cost: {formatPHP(item.unitCost)} / {item.uom}
                                    </Text>
                                </View>

                                {/* Variance Badge */}
                                {isExact ? (
                                    <View className="bg-emerald-100 px-2 py-0.5 rounded">
                                        <Text className="text-emerald-800 text-xs font-semibold">
                                            ✓ Exact Match
                                        </Text>
                                    </View>
                                ) : hasShortage ? (
                                    <View className="bg-rose-100 px-2 py-0.5 rounded">
                                        <Text className="text-rose-800 text-xs font-bold">
                                            Shortage: {variance} {item.uom}
                                        </Text>
                                    </View>
                                ) : (
                                    <View className="bg-blue-100 px-2 py-0.5 rounded">
                                        <Text className="text-blue-800 text-xs font-bold">
                                            Overage: +{variance} {item.uom}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Side-by-side Expected vs Received */}
                            <View className="flex-row items-center justify-between mt-2 bg-slate-50 p-2 rounded-lg">
                                <View>
                                    <Text className="text-slate-400 text-xs">Expected</Text>
                                    <Text className="text-slate-800 font-semibold text-sm">
                                        {item.quantityExpected} {item.uom}
                                    </Text>
                                </View>

                                <View className="flex-row items-center">
                                    <Text className="text-slate-600 text-xs mr-2 font-medium">
                                        Actual Count:
                                    </Text>
                                    <TextInput
                                        keyboardType="numeric"
                                        value={String(counts[item.productId] ?? '')}
                                        onChangeText={(val) => handleCountChange(item.productId, val)}
                                        editable={dispatch.status !== 'verified'}
                                        placeholderTextColor="#9CA3AF"
                                        className={`w-20 bg-white border rounded px-2 py-1 text-center font-bold text-sm text-slate-900 ${
                                            hasShortage
                                                ? 'border-rose-400 bg-rose-50'
                                                : hasOverage
                                                ? 'border-blue-400 bg-blue-50'
                                                : 'border-slate-300'
                                        }`}
                                    />
                                    <Text className="text-slate-500 text-xs ml-1.5">{item.uom}</Text>
                                </View>
                            </View>

                            {/* Discrepancy / Damage note */}
                            {dispatch.status !== 'verified' && (
                                <TextInput
                                    value={itemNotes[item.productId] || ''}
                                    onChangeText={(val) => handleNoteChange(item.productId, val)}
                                    placeholder="Add inspection note or seal condition..."
                                    placeholderTextColor="#9CA3AF"
                                    className="bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-900 text-xs mt-2"
                                />
                            )}
                        </View>
                    );
                })}
            </View>

            {/* Action Buttons */}
            <View className="mb-8">
                {dispatch.status !== 'verified' && (
                    <TouchableOpacity
                        onPress={handleReceivePhysicalCount}
                        disabled={submitting}
                        className="bg-blue-600 rounded-xl p-4 items-center justify-center mb-3 shadow-sm"
                    >
                        {submitting ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <Text className="text-white font-bold text-base">
                                1. Save Physical Count (Mark Received)
                            </Text>
                        )}
                    </TouchableOpacity>
                )}

                {dispatch.status === 'received' && (
                    <TouchableOpacity
                        onPress={handleVerifyAndCommit}
                        disabled={submitting}
                        className="bg-emerald-600 rounded-xl p-4 items-center justify-center mb-3 shadow-sm"
                    >
                        {submitting ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <Text className="text-white font-bold text-base">
                                2. Verify & Post Stock to Branch Inventory
                            </Text>
                        )}
                    </TouchableOpacity>
                )}

                {dispatch.status !== 'disputed' && dispatch.status !== 'verified' && (
                    <TouchableOpacity
                        onPress={() => setDisputeModalVisible(true)}
                        disabled={submitting}
                        className="bg-rose-50 border border-rose-200 rounded-xl p-3 items-center justify-center"
                    >
                        <Text className="text-rose-700 font-bold text-sm">
                            ⚠️ Dispute Delivery Discrepancy
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Dispute Reason Modal */}
            {disputeModalVisible && (
                <View className="bg-white p-4 rounded-xl border border-rose-300 mb-8 shadow-md">
                    <Text className="text-rose-900 font-bold text-base mb-2">
                        Flag Delivery Dispute
                    </Text>
                    <Text className="text-slate-600 text-xs mb-3">
                        Provide detailed evidence (e.g. broken ice seals, severe spoilage, weight shortage)
                        for Area Supervisor audit.
                    </Text>
                    <TextInput
                        value={disputeReason}
                        onChangeText={setDisputeReason}
                        placeholder="Explain reason for dispute..."
                        placeholderTextColor="#9CA3AF"
                        multiline
                        numberOfLines={3}
                        className="bg-slate-50 border border-slate-300 rounded-lg p-3 text-slate-900 text-sm mb-3"
                    />
                    <View className="flex-row justify-end">
                        <TouchableOpacity
                            onPress={() => setDisputeModalVisible(false)}
                            className="bg-slate-200 px-4 py-2 rounded-lg mr-2"
                        >
                            <Text className="text-slate-700 font-semibold text-sm">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleDispute}
                            disabled={submitting}
                            className="bg-rose-600 px-4 py-2 rounded-lg"
                        >
                            <Text className="text-white font-bold text-sm">Submit Dispute</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </ScrollView>
    );
}
