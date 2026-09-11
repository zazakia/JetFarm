import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../src/store/AuthContext';
import { CommissaryDispatchService } from '../../../src/services/CommissaryDispatchService';
import CommissaryDispatch from '../../../src/database/models/CommissaryDispatch';
import { formatPHP } from '../../../src/utils/currency';

export default function BranchReceivingListScreen() {
    const router = useRouter();
    const { branchId } = useAuth();
    const activeBranchId = branchId || 'branch-bagacay'; // Default to benchmark branch if not set

    const [dispatches, setDispatches] = useState<CommissaryDispatch[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    const loadDeliveries = useCallback(async () => {
        try {
            setLoading(true);
            const data = await CommissaryDispatchService.getDispatchesByBranch(activeBranchId);
            setDispatches(data);
        } catch (err) {
            console.error('Error loading inbound deliveries:', err);
            Alert.alert('Error', 'Failed to load inbound deliveries.');
        } finally {
            setLoading(false);
        }
    }, [activeBranchId]);

    useEffect(() => {
        loadDeliveries();
    }, [loadDeliveries]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'in_transit':
                return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In-Transit (Awaiting Arrival)' };
            case 'received':
                return { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Received (Pending Final Sign-Off)' };
            case 'verified':
                return { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Verified & Stocked' };
            case 'disputed':
                return { bg: 'bg-rose-100', text: 'text-rose-800', label: 'Disputed' };
            default:
                return { bg: 'bg-slate-100', text: 'text-slate-700', label: status };
        }
    };

    return (
        <View className="flex-1 bg-slate-50">
            {/* Header */}
            <View className="bg-blue-900 px-4 py-3 flex-row justify-between items-center">
                <View>
                    <Text className="text-white text-lg font-bold">Inbound Store Deliveries</Text>
                    <Text className="text-blue-200 text-xs">
                        Branch: <Text className="font-semibold text-white">{activeBranchId}</Text>
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={loadDeliveries}
                    className="bg-blue-800 px-3 py-1.5 rounded-lg border border-blue-700"
                >
                    <Text className="text-white text-xs font-semibold">↻ Refresh</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#1e40af" />
                    <Text className="text-slate-500 mt-2 text-sm">Checking commissary dispatches...</Text>
                </View>
            ) : dispatches.length === 0 ? (
                <View className="flex-1 justify-center items-center p-6">
                    <Text className="text-slate-400 text-base font-semibold">No inbound deliveries</Text>
                    <Text className="text-slate-400 text-xs text-center mt-1">
                        All deliveries for this branch have been received or none are currently scheduled.
                    </Text>
                </View>
            ) : (
                <ScrollView className="flex-1 p-3">
                    {dispatches.map((dispatch) => {
                        const badge = getStatusBadge(dispatch.status);
                        const items = dispatch.items || [];

                        return (
                            <TouchableOpacity
                                key={dispatch.id}
                                onPress={() => router.push(`/(branch-manager)/receiving/${dispatch.id}` as any)}
                                className="bg-white rounded-xl p-4 mb-3 border border-slate-200 shadow-sm"
                            >
                                <View className="flex-row justify-between items-start mb-2">
                                    <View>
                                        <Text className="text-slate-900 font-bold text-base">
                                            {dispatch.dispatchNumber}
                                        </Text>
                                        <Text className="text-slate-500 text-xs mt-0.5">
                                            From: {dispatch.fromLocation}
                                        </Text>
                                    </View>
                                    <View className={`px-2.5 py-1 rounded-full ${badge.bg}`}>
                                        <Text className={`text-xs font-bold ${badge.text}`}>
                                            {badge.label}
                                        </Text>
                                    </View>
                                </View>

                                {/* Manifest snippet */}
                                <View className="bg-slate-50 rounded-lg p-2.5 my-2 border border-slate-100">
                                    <Text className="text-slate-700 text-xs font-semibold mb-1">
                                        Cargo ({items.length} {items.length === 1 ? 'item' : 'items'}):
                                    </Text>
                                    {items.map((item, idx) => (
                                        <Text key={idx} className="text-slate-600 text-xs">
                                            • {item.productName || item.productId}: Expected {item.quantityExpected} {item.uom}
                                            {item.quantityReceived !== undefined && (
                                                <Text className={item.variance && item.variance < 0 ? 'text-rose-600 font-bold' : 'text-emerald-700'}>
                                                    {' '}(Count: {item.quantityReceived})
                                                </Text>
                                            )}
                                        </Text>
                                    ))}
                                </View>

                                <View className="flex-row justify-between items-center pt-2 border-t border-slate-100">
                                    <Text className="text-slate-500 text-xs">
                                        Total Value: <Text className="font-bold text-slate-800">{formatPHP(dispatch.totalAmount)}</Text>
                                    </Text>
                                    <Text className="text-blue-600 font-bold text-xs">
                                        {dispatch.status === 'in_transit' ? 'Receive & Count →' : 'View Details →'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );
}
