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

type FilterStatus = 'ALL' | 'draft' | 'in_transit' | 'received' | 'verified' | 'disputed';

export default function CommissaryDispatchListScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [dispatches, setDispatches] = useState<CommissaryDispatch[]>([]);
    const [filter, setFilter] = useState<FilterStatus>('ALL');
    const [loading, setLoading] = useState<boolean>(true);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const loadDispatches = useCallback(async () => {
        try {
            setLoading(true);
            const statusArg = filter === 'ALL' ? undefined : filter;
            const data = await CommissaryDispatchService.getDispatchesByCommissary(statusArg);
            setDispatches(data);
        } catch (error) {
            console.error('Error loading dispatches:', error);
            Alert.alert('Error', 'Failed to load dispatches.');
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        loadDispatches();
    }, [loadDispatches]);

    const handleMarkInTransit = async (dispatchId: string) => {
        try {
            setActionLoadingId(dispatchId);
            await CommissaryDispatchService.markInTransit(dispatchId);
            Alert.alert('Dispatched', 'Delivery is now marked In-Transit to destination branch.');
            loadDispatches();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to update dispatch status');
        } finally {
            setActionLoadingId(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'draft':
                return { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Draft' };
            case 'in_transit':
                return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In-Transit' };
            case 'received':
                return { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Received' };
            case 'verified':
                return { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Verified & Stocked' };
            case 'disputed':
                return { bg: 'bg-rose-100', text: 'text-rose-800', label: 'Disputed' };
            default:
                return { bg: 'bg-slate-100', text: 'text-slate-800', label: status };
        }
    };

    return (
        <View className="flex-1 bg-slate-50">
            {/* Header / Subhead */}
            <View className="bg-orange-800 px-4 py-3 flex-row justify-between items-center">
                <View>
                    <Text className="text-white text-lg font-bold">Commissary Dispatches</Text>
                    <Text className="text-orange-200 text-xs">
                        Outbound Supply Chain & Branch Deliveries
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => router.push('/(commissary)/dispatch/new' as any)}
                    className="bg-emerald-600 px-4 py-2 rounded-lg shadow-sm"
                >
                    <Text className="text-white font-bold text-sm">+ New Dispatch</Text>
                </TouchableOpacity>
            </View>

            {/* Filter Pills */}
            <View className="bg-white border-b border-slate-200 py-2 px-3">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    {(['ALL', 'draft', 'in_transit', 'received', 'verified', 'disputed'] as FilterStatus[]).map(
                        (f) => {
                            const isSelected = filter === f;
                            return (
                                <TouchableOpacity
                                    key={f}
                                    onPress={() => setFilter(f)}
                                    className={`px-3 py-1.5 rounded-full mr-2 ${
                                        isSelected ? 'bg-orange-800' : 'bg-slate-100'
                                    }`}
                                >
                                    <Text
                                        className={`text-xs font-semibold ${
                                            isSelected ? 'text-white' : 'text-slate-600'
                                        }`}
                                    >
                                        {f === 'ALL'
                                            ? 'All Dispatches'
                                            : f === 'in_transit'
                                            ? 'In-Transit'
                                            : f.charAt(0).toUpperCase() + f.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        }
                    )}
                </ScrollView>
            </View>

            {/* Content List */}
            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#c2410c" />
                    <Text className="text-slate-500 mt-2 text-sm">Loading dispatch records...</Text>
                </View>
            ) : dispatches.length === 0 ? (
                <View className="flex-1 justify-center items-center p-6">
                    <Text className="text-slate-400 text-base font-semibold">No dispatches found</Text>
                    <Text className="text-slate-400 text-xs text-center mt-1">
                        Create a new dispatch to ship chicken, breading, and supplies to branches.
                    </Text>
                </View>
            ) : (
                <ScrollView className="flex-1 p-3">
                    {dispatches.map((dispatch) => {
                        const badge = getStatusBadge(dispatch.status);
                        const items = dispatch.items || [];
                        const isActionLoading = actionLoadingId === dispatch.id;

                        return (
                            <View
                                key={dispatch.id}
                                className="bg-white rounded-xl p-4 mb-3 border border-slate-200 shadow-sm"
                            >
                                <View className="flex-row justify-between items-start mb-2">
                                    <View>
                                        <Text className="text-slate-900 font-bold text-base">
                                            {dispatch.dispatchNumber}
                                        </Text>
                                        <Text className="text-slate-500 text-xs mt-0.5">
                                            Destination: <Text className="font-semibold text-slate-800">{dispatch.toBranchId}</Text>
                                        </Text>
                                        {dispatch.poReference ? (
                                            <Text className="text-slate-400 text-xs">
                                                PO Ref: {dispatch.poReference}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <View className={`px-2.5 py-1 rounded-full ${badge.bg}`}>
                                        <Text className={`text-xs font-bold ${badge.text}`}>
                                            {badge.label}
                                        </Text>
                                    </View>
                                </View>

                                {/* Items Snapshot */}
                                <View className="bg-slate-50 rounded-lg p-2.5 my-2 border border-slate-100">
                                    <Text className="text-slate-700 text-xs font-semibold mb-1">
                                        Manifest ({items.length} {items.length === 1 ? 'item' : 'items'}):
                                    </Text>
                                    {items.slice(0, 3).map((item, idx) => (
                                        <Text key={idx} className="text-slate-600 text-xs">
                                            • {item.productName || item.productId}: {item.quantityExpected} {item.uom}
                                            {item.quantityReceived !== undefined && (
                                                <Text className={item.variance && item.variance < 0 ? 'text-rose-600 font-bold' : 'text-emerald-700'}>
                                                    {' '}(Rec: {item.quantityReceived})
                                                </Text>
                                            )}
                                        </Text>
                                    ))}
                                    {items.length > 3 && (
                                        <Text className="text-slate-400 text-xs mt-1">
                                            + {items.length - 3} more items...
                                        </Text>
                                    )}
                                </View>

                                {/* Total and Actions */}
                                <View className="flex-row justify-between items-center pt-2 border-t border-slate-100">
                                    <View>
                                        <Text className="text-slate-400 text-xs">Total Dispatch Value</Text>
                                        <Text className="text-orange-800 font-bold text-base">
                                            {formatPHP(dispatch.totalAmount)}
                                        </Text>
                                    </View>

                                    {dispatch.status === 'draft' && (
                                        <TouchableOpacity
                                            onPress={() => handleMarkInTransit(dispatch.id)}
                                            disabled={isActionLoading}
                                            className="bg-blue-600 px-3 py-1.5 rounded-lg flex-row items-center"
                                        >
                                            {isActionLoading ? (
                                                <ActivityIndicator size="small" color="#ffffff" />
                                            ) : (
                                                <Text className="text-white font-bold text-xs">
                                                    Mark In-Transit
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );
}
