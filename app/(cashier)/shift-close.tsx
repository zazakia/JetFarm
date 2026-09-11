import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/store/AuthContext';
import { ShiftCashService, CashDenominations, ShiftSummaryInput } from '../../src/services/ShiftCashService';
import { formatPHP } from '../../src/utils/currency';
import { Ionicons } from '@expo/vector-icons';

export default function ShiftCloseScreen() {
    const router = useRouter();
    const { branchId, user } = useAuth();

    // Denomination counts
    const [p1000, setP1000] = useState('0');
    const [p500, setP500] = useState('0');
    const [p200, setP200] = useState('0');
    const [p100, setP100] = useState('0');
    const [p50, setP50] = useState('0');
    const [p20, setP20] = useState('0');
    const [coins, setCoins] = useState('0');

    // Simulated/active shift data
    const shiftSummary: ShiftSummaryInput = useMemo(() => ({
        branchId: branchId || 'branch-bagacay',
        cashierId: user?.id || 'cashier-1',
        openingFloat: 2000.0,
        grossSales: 16850.0,
        cashSales: 14200.0,
        nonCashSales: 2650.0,
        totalDrops: 10000.0,
        orderCount: 54,
    }), [branchId, user?.id]);

    const denominations: CashDenominations = useMemo(() => ({
        p1000: parseInt(p1000) || 0,
        p500: parseInt(p500) || 0,
        p200: parseInt(p200) || 0,
        p100: parseInt(p100) || 0,
        p50: parseInt(p50) || 0,
        p20: parseInt(p20) || 0,
        coins: parseFloat(coins) || 0,
    }), [p1000, p500, p200, p100, p50, p20, coins]);

    const zReport = useMemo(() => {
        return ShiftCashService.computeZReading(shiftSummary, denominations);
    }, [shiftSummary, denominations]);

    const handleConfirmZClose = () => {
        const varianceText =
            zReport.varianceStatus === 'exact'
                ? 'Balanced (Exact)'
                : zReport.varianceStatus === 'over'
                ? `Overage: +${formatPHP(zReport.variance)}`
                : `Shortage: -${formatPHP(Math.abs(zReport.variance))}`;

        Alert.alert(
            'Z-Reading Shift Closure',
            `Actual Counted Cash: ${formatPHP(zReport.actualCashCount)}\nExpected Cash: ${formatPHP(
                zReport.expectedDrawerCash
            )}\nResult: ${varianceText}\n\nConfirm closing register?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm & Lock Till',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert('Register Closed', 'Shift report saved and sent to Main Office.', [
                            { text: 'Back to Dashboard', onPress: () => router.replace('/(cashier)' as any) },
                        ]);
                    },
                },
            ]
        );
    };

    return (
        <ScrollView className="flex-1 bg-slate-100 p-4">
            {/* Header */}
            <View className="bg-rose-900 rounded-2xl p-5 mb-4 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-rose-200 text-xs font-bold uppercase tracking-wider">End of Shift / Z-Reading</Text>
                    <View className="bg-rose-800 px-3 py-1 rounded-full">
                        <Text className="text-white text-xs font-semibold">Shift Reconciliation</Text>
                    </View>
                </View>
                <Text className="text-white text-2xl font-extrabold">{branchId || 'Bagacay Branch'}</Text>
                <Text className="text-rose-100 text-xs mt-1">Cashier: {user?.email || 'Active Shift'}</Text>
            </View>

            {/* Expected vs Actual Reconciliation Summary */}
            <View className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-4">
                <Text className="text-slate-900 font-bold text-sm mb-3">Till Reconciliation</Text>
                <View className="space-y-2 mb-3">
                    <View className="flex-row justify-between">
                        <Text className="text-slate-500 text-xs">Opening Float</Text>
                        <Text className="text-slate-800 font-semibold text-xs">{formatPHP(shiftSummary.openingFloat)}</Text>
                    </View>
                    <View className="flex-row justify-between">
                        <Text className="text-slate-500 text-xs">Gross Sales (Cash)</Text>
                        <Text className="text-emerald-700 font-semibold text-xs">+{formatPHP(shiftSummary.cashSales)}</Text>
                    </View>
                    <View className="flex-row justify-between">
                        <Text className="text-slate-500 text-xs">Safe Drops</Text>
                        <Text className="text-rose-700 font-semibold text-xs">-{formatPHP(shiftSummary.totalDrops)}</Text>
                    </View>
                    <View className="flex-row justify-between border-t border-slate-100 pt-2">
                        <Text className="text-slate-900 font-bold text-sm">Expected Drawer Cash</Text>
                        <Text className="text-slate-900 font-bold text-sm">{formatPHP(zReport.expectedDrawerCash)}</Text>
                    </View>
                </View>

                {/* Live Counted vs Variance */}
                <View
                    className={`p-3.5 rounded-xl border flex-row justify-between items-center ${
                        zReport.varianceStatus === 'exact'
                            ? 'bg-emerald-50 border-emerald-200'
                            : zReport.varianceStatus === 'over'
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-rose-50 border-rose-200'
                    }`}
                >
                    <View>
                        <Text className="text-slate-600 text-xs font-semibold">Physical Counted Cash</Text>
                        <Text className="text-slate-900 font-black text-xl">{formatPHP(zReport.actualCashCount)}</Text>
                    </View>
                    <View className="items-end">
                        <Text className="text-slate-600 text-xs font-semibold">Variance</Text>
                        <Text
                            className={`font-black text-lg ${
                                zReport.varianceStatus === 'exact'
                                    ? 'text-emerald-700'
                                    : zReport.varianceStatus === 'over'
                                    ? 'text-amber-700'
                                    : 'text-rose-700'
                            }`}
                        >
                            {zReport.variance === 0
                                ? '₱0.00 (Balanced)'
                                : zReport.variance > 0
                                ? `+${formatPHP(zReport.variance)} (Over)`
                                : `-${formatPHP(Math.abs(zReport.variance))} (Short)`}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Cash Denominations Counter Form */}
            <View className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6">
                <Text className="text-slate-900 font-bold text-sm mb-3">Count Physical Bills & Coins</Text>

                {[
                    { label: '₱1,000 Bills', val: p1000, setVal: setP1000, mult: 1000 },
                    { label: '₱500 Bills', val: p500, setVal: setP500, mult: 500 },
                    { label: '₱200 Bills', val: p200, setVal: setP200, mult: 200 },
                    { label: '₱100 Bills', val: p100, setVal: setP100, mult: 100 },
                    { label: '₱50 Bills', val: p50, setVal: setP50, mult: 50 },
                    { label: '₱20 Bills', val: p20, setVal: setP20, mult: 20 },
                ].map((row, idx) => {
                    const count = parseInt(row.val) || 0;
                    return (
                        <View key={idx} className="flex-row items-center justify-between py-2 border-b border-slate-100">
                            <View className="w-28">
                                <Text className="text-slate-800 font-bold text-xs">{row.label}</Text>
                            </View>
                            <TextInput
                                keyboardType="numeric"
                                value={row.val}
                                onChangeText={row.setVal}
                                placeholder="0"
                                placeholderTextColor="#9CA3AF"
                                className="w-20 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-300 text-center text-slate-900 font-bold text-sm"
                            />
                            <View className="w-24 items-end">
                                <Text className="text-slate-600 text-xs font-semibold">{formatPHP(count * row.mult)}</Text>
                            </View>
                        </View>
                    );
                })}

                {/* Loose Coins row */}
                <View className="flex-row items-center justify-between py-2">
                    <View className="w-28">
                        <Text className="text-slate-800 font-bold text-xs">Loose Coins (₱)</Text>
                    </View>
                    <TextInput
                        keyboardType="numeric"
                        value={coins}
                        onChangeText={setCoins}
                        placeholder="0.00"
                        placeholderTextColor="#9CA3AF"
                        className="w-20 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-300 text-center text-slate-900 font-bold text-sm"
                    />
                    <View className="w-24 items-end">
                        <Text className="text-slate-600 text-xs font-semibold">
                            {formatPHP(parseFloat(coins) || 0)}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Final Action Button */}
            <Pressable
                onPress={handleConfirmZClose}
                className="w-full bg-rose-700 active:bg-rose-800 py-4 rounded-xl items-center shadow-sm mb-10"
            >
                <Text className="text-white font-black text-base">Lock Till & Submit Z-Reading</Text>
            </Pressable>
        </ScrollView>
    );
}
