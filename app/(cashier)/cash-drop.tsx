import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/store/AuthContext';
import { ShiftCashService, CashDropHistoryRecord } from '../../src/services/ShiftCashService';
import { formatPHP } from '../../src/utils/currency';
import { formatDateTime, formatRelative } from '../../src/utils/dates';
import { Ionicons } from '@expo/vector-icons';

export default function CashDropScreen() {
    const router = useRouter();
    const { branchId, user } = useAuth();
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('Mid-shift drop to branch safe');
    const [loading, setLoading] = useState(false);
    const [drops, setDrops] = useState<CashDropHistoryRecord[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    const activeBranchId = branchId || 'branch-bagacay';

    const loadHistory = useCallback(async () => {
        try {
            setLoadingHistory(true);
            const shiftService = new ShiftCashService();
            const data = await shiftService.getCashDropHistory(activeBranchId, 20);
            setDrops(data);
        } catch (e) {
            console.warn('Failed to load cash drop history:', e);
        } finally {
            setLoadingHistory(false);
        }
    }, [activeBranchId]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const handleRecordDrop = async () => {
        const dropAmount = parseFloat(amount);
        if (isNaN(dropAmount) || dropAmount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid cash drop amount.');
            return;
        }

        setLoading(true);
        try {
            const shiftService = new ShiftCashService();
            await shiftService.recordCashDrop(
                activeBranchId,
                user?.id || 'cashier-1',
                dropAmount,
                reason || 'Mid-shift safe drop'
            );

            Alert.alert(
                'Cash Drop Recorded',
                `${formatPHP(dropAmount)} transferred from drawer to safe.`,
                [{ text: 'Back to POS', onPress: () => router.back() }]
            );
            setAmount('');
            await loadHistory();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to record cash drop.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView className="flex-1 bg-slate-100" contentContainerStyle={{ padding: 16 }}>
            {/* Header Back Button & Title */}
            <View className="flex-row items-center mb-6">
                <Pressable
                    onPress={() => router.back()}
                    className="mr-3 bg-white p-2.5 rounded-xl border border-slate-200 active:bg-slate-50"
                >
                    <Ionicons name="arrow-back" size={20} color="#0f172a" />
                </Pressable>
                <View>
                    <Text className="text-xl font-black text-slate-900">Mid-Shift Cash Drop</Text>
                    <Text className="text-slate-500 text-xs font-semibold">Store Safe Protection & Reconciliation</Text>
                </View>
            </View>

            {/* Drop Entry Card */}
            <View className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-6">
                <View className="flex-row items-center mb-3">
                    <View className="w-10 h-10 bg-amber-100 rounded-xl items-center justify-center mr-3">
                        <Ionicons name="shield-checkmark" size={22} color="#d97706" />
                    </View>
                    <View>
                        <Text className="text-slate-900 font-extrabold text-base">Transfer Cash to Safe</Text>
                        <Text className="text-slate-400 text-xs font-medium">Remove excess cash from till</Text>
                    </View>
                </View>

                <View className="mb-4">
                    <Text className="text-slate-700 font-bold text-xs mb-1.5 uppercase tracking-wider">Amount to Drop (₱)</Text>
                    <TextInput
                        keyboardType="numeric"
                        value={amount}
                        onChangeText={setAmount}
                        placeholder="5000.00"
                        placeholderTextColor="#9CA3AF"
                        className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-300 text-slate-900 text-2xl font-black"
                    />
                </View>

                <View className="flex-row justify-between mb-4 gap-2">
                    {[1000, 2000, 5000, 10000].map((preset) => (
                        <Pressable
                            key={preset}
                            onPress={() => setAmount(String(preset))}
                            className="flex-1 py-2.5 bg-slate-50 border border-slate-200 rounded-xl items-center active:bg-slate-100"
                        >
                            <Text className="text-slate-800 text-xs font-bold">₱{preset.toLocaleString()}</Text>
                        </Pressable>
                    ))}
                </View>

                <View className="mb-6">
                    <Text className="text-slate-700 font-bold text-xs mb-1.5 uppercase tracking-wider">Particulars / Reason</Text>
                    <TextInput
                        value={reason}
                        onChangeText={setReason}
                        placeholder="Reason for cash drop"
                        placeholderTextColor="#9CA3AF"
                        className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-300 text-slate-900 text-sm font-medium"
                    />
                </View>

                <Pressable
                    disabled={loading}
                    onPress={handleRecordDrop}
                    className="w-full bg-amber-600 active:bg-amber-700 py-4 rounded-2xl items-center shadow-sm flex-row justify-center"
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="lock-closed" size={18} color="#fff" style={{ marginRight: 8 }} />
                            <Text className="text-white font-black text-sm uppercase tracking-wider">
                                Confirm Safe Transfer
                            </Text>
                        </>
                    )}
                </Pressable>
            </View>

            {/* Cash Drop History & User Tracing */}
            <View className="mb-8">
                <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-base font-black text-slate-900">Recent Safe Drops & Tracing</Text>
                    <Text className="text-xs text-slate-500 font-bold">{drops.length} drop(s) on file</Text>
                </View>

                {loadingHistory ? (
                    <View className="py-8 items-center">
                        <ActivityIndicator size="small" color="#d97706" />
                    </View>
                ) : drops.length === 0 ? (
                    <View className="bg-white rounded-2xl p-6 items-center justify-center border border-slate-200">
                        <Ionicons name="receipt-outline" size={36} color="#94a3b8" />
                        <Text className="text-slate-600 font-bold text-sm mt-2">No Safe Drops Recorded Yet</Text>
                        <Text className="text-slate-400 text-xs text-center mt-0.5">
                            Cash drops executed during shifts will be logged here with cashier tracing.
                        </Text>
                    </View>
                ) : (
                    <View className="gap-2.5">
                        {drops.map((item) => (
                            <View
                                key={item.id}
                                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs"
                            >
                                <View className="flex-row justify-between items-center">
                                    <View>
                                        <Text className="text-lg font-black text-emerald-700">
                                            {formatPHP(item.amount)}
                                        </Text>
                                        <Text className="text-xs text-slate-500 mt-0.5 font-medium">
                                            {item.reason}
                                        </Text>
                                    </View>
                                    <View className="items-end">
                                        <View className="bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                            <Text className="text-[10px] font-bold text-emerald-800">
                                                Secured in Safe
                                            </Text>
                                        </View>
                                        <Text className="text-[11px] text-slate-400 mt-1 font-semibold">
                                            {formatRelative(item.timestamp)}
                                        </Text>
                                    </View>
                                </View>

                                {/* User Tracing Tag */}
                                <View className="mt-3 pt-2.5 border-t border-slate-100 flex-row justify-between items-center">
                                    <View className="flex-row items-center">
                                        <Ionicons name="person-circle-outline" size={16} color="#64748b" style={{ marginRight: 4 }} />
                                        <Text className="text-xs text-slate-600 font-semibold">
                                            Cashier: <Text className="font-bold text-slate-900">{item.operatorName || item.cashierId}</Text>
                                        </Text>
                                    </View>
                                    {item.operatorRole && (
                                        <Text className="text-[10px] font-bold text-indigo-700 uppercase">
                                            {item.operatorRole}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </ScrollView>
    );
}
