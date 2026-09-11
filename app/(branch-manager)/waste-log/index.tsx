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
import { WasteLogService, WasteReason } from '../../../src/services/WasteLogService';
import WasteLog from '../../../src/database/models/WasteLog';
import { formatPHP } from '../../../src/utils/currency';

const REASON_LABELS: Record<string, { label: string; bg: string; text: string }> = {
    damaged: { label: 'Damaged Cargo', bg: 'bg-amber-100', text: 'text-amber-800' },
    expired: { label: 'Expired', bg: 'bg-rose-100', text: 'text-rose-800' },
    burnt_overcooked: { label: 'Burnt / Overcooked', bg: 'bg-orange-100', text: 'text-orange-800' },
    spilled_dropped: { label: 'Spilled / Dropped', bg: 'bg-slate-100', text: 'text-slate-800' },
    contamination: { label: 'Contamination', bg: 'bg-purple-100', text: 'text-purple-800' },
    bad_order: { label: 'Bad Order (BO)', bg: 'bg-red-100', text: 'text-red-800' },
};

export default function BranchWasteLogIndexScreen() {
    const router = useRouter();
    const { branchId } = useAuth();
    const activeBranchId = branchId || 'branch-bagacay';

    const [logs, setLogs] = useState<WasteLog[]>([]);
    const [selectedReason, setSelectedReason] = useState<string>('ALL');
    const [loading, setLoading] = useState<boolean>(true);

    const loadWasteLogs = useCallback(async () => {
        try {
            setLoading(true);
            const data = await WasteLogService.getBranchWasteLogs(activeBranchId, 100);
            setLogs(data);
        } catch (err) {
            console.error('Failed to load waste logs:', err);
            Alert.alert('Error', 'Could not load branch waste logs.');
        } finally {
            setLoading(false);
        }
    }, [activeBranchId]);

    useEffect(() => {
        loadWasteLogs();
    }, [loadWasteLogs]);

    const filteredLogs = selectedReason === 'ALL'
        ? logs
        : logs.filter((l) => l.reason === selectedReason);

    const totalSpoilageAmount = logs.reduce((sum, l) => sum + (l.totalCost || 0), 0);

    return (
        <View className="flex-1 bg-slate-50">
            {/* Header Banner */}
            <View className="bg-slate-900 px-4 py-3 flex-row justify-between items-center">
                <View>
                    <Text className="text-white text-lg font-bold">Spoilage & Bad Orders</Text>
                    <Text className="text-slate-400 text-xs">
                        Branch: <Text className="font-semibold text-white">{activeBranchId}</Text>
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => router.push('/(branch-manager)/waste-log/create' as any)}
                    className="bg-rose-600 px-3.5 py-2 rounded-lg shadow-sm"
                >
                    <Text className="text-white font-bold text-xs">+ Log Spoilage</Text>
                </TouchableOpacity>
            </View>

            {/* KPI Summary Card */}
            <View className="bg-white p-4 border-b border-slate-200">
                <Text className="text-slate-500 text-xs font-semibold">Total Recorded Spoilage Loss</Text>
                <Text className="text-rose-600 font-black text-2xl mt-0.5">
                    {formatPHP(totalSpoilageAmount)}
                </Text>
                <Text className="text-slate-400 text-xs mt-1">
                    {logs.length} logged incident{logs.length === 1 ? '' : 's'} recorded to General Ledger (Account 5100)
                </Text>
            </View>

            {/* Reason Filters */}
            <View className="bg-white border-b border-slate-200 py-2 px-3">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    {['ALL', 'burnt_overcooked', 'expired', 'damaged', 'spilled_dropped', 'contamination', 'bad_order'].map(
                        (r) => {
                            const isSelected = selectedReason === r;
                            const label = r === 'ALL' ? 'All Reasons' : (REASON_LABELS[r]?.label || r);
                            return (
                                <TouchableOpacity
                                    key={r}
                                    onPress={() => setSelectedReason(r)}
                                    className={`px-3 py-1.5 rounded-full mr-2 ${
                                        isSelected ? 'bg-slate-900' : 'bg-slate-100'
                                    }`}
                                >
                                    <Text
                                        className={`text-xs font-semibold ${
                                            isSelected ? 'text-white' : 'text-slate-600'
                                        }`}
                                    >
                                        {label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        }
                    )}
                </ScrollView>
            </View>

            {/* Logs List */}
            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#e11d48" />
                    <Text className="text-slate-500 mt-2 text-sm">Loading spoilage logs...</Text>
                </View>
            ) : filteredLogs.length === 0 ? (
                <View className="flex-1 justify-center items-center p-6">
                    <Text className="text-slate-400 text-base font-semibold">No waste logs recorded</Text>
                    <Text className="text-slate-400 text-xs text-center mt-1">
                        Tap &quot;+ Log Spoilage&quot; above to record damaged chicken, expired sauce, or fryer waste.
                    </Text>
                </View>
            ) : (
                <ScrollView className="flex-1 p-3">
                    {filteredLogs.map((log) => {
                        const reasonInfo = REASON_LABELS[log.reason] || {
                            label: log.reason,
                            bg: 'bg-slate-100',
                            text: 'text-slate-700',
                        };
                        const dateStr = log.logDate
                            ? new Date(log.logDate).toLocaleDateString()
                            : 'Today';

                        return (
                            <View
                                key={log.id}
                                className="bg-white rounded-xl p-4 mb-3 border border-slate-200 shadow-sm"
                            >
                                <View className="flex-row justify-between items-start mb-1.5">
                                    <View className="flex-1 mr-2">
                                        <Text className="text-slate-900 font-bold text-base">
                                            {log.productName || log.productId}
                                        </Text>
                                        <Text className="text-slate-500 text-xs mt-0.5">
                                            Date: {dateStr} • Recorded by: {log.recordedBy || 'Staff'}
                                        </Text>
                                    </View>
                                    <View className={`px-2.5 py-1 rounded-full ${reasonInfo.bg}`}>
                                        <Text className={`text-xs font-bold ${reasonInfo.text}`}>
                                            {reasonInfo.label}
                                        </Text>
                                    </View>
                                </View>

                                <View className="flex-row justify-between items-center py-2 bg-slate-50 rounded-lg px-3 my-1">
                                    <Text className="text-slate-600 text-xs">
                                        Quantity: <Text className="font-bold text-slate-900">{log.quantity} {log.uom}</Text>
                                    </Text>
                                    <Text className="text-rose-600 font-bold text-sm">
                                        Loss: {formatPHP(log.totalCost)}
                                    </Text>
                                </View>

                                {log.notes && (
                                    <Text className="text-slate-600 text-xs italic mt-1">
                                        &quot;{log.notes}&quot;
                                    </Text>
                                )}

                                <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-slate-100">
                                    <Text className="text-slate-400 text-xs">
                                        GL: DR 5100 / CR 1200
                                    </Text>
                                    <Text className="text-emerald-700 text-xs font-semibold">
                                        ✓ Stock Auto-Deducted
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            )}
        </View>
    );
}
