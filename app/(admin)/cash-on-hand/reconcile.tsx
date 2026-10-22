import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { safeBack } from '../../../src/utils/navigation';
import { database } from '../../../src/database';
import CashTransaction from '../../../src/database/models/CashTransaction';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { formatPHP } from '../../../src/utils/currency';
import { CashService } from '../../../src/services/CashService';
import uuid from 'react-native-uuid';
import { useAuth } from '../../../src/store/AuthContext';
import { handleSaveError } from '../../../src/utils/errorAlerts';

const DENOMINATIONS = [
    { label: '₱1,000 Bill', value: 1000, key: 'k1000' },
    { label: '₱500 Bill', value: 500, key: 'k500' },
    { label: '₱200 Bill', value: 200, key: 'k200' },
    { label: '₱100 Bill', value: 100, key: 'k100' },
    { label: '₱50 Bill', value: 50, key: 'k50' },
    { label: '₱20 Bill', value: 20, key: 'k20' },
] as const;

export default function ReconcileCashOnHandScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [bookBalance, setBookBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Bill Counts
    const [counts, setCounts] = useState<Record<string, string>>({
        k1000: '0',
        k500: '0',
        k200: '0',
        k100: '0',
        k50: '0',
        k20: '0',
    });
    const [coins, setCoins] = useState('0');
    const [remarks, setRemarks] = useState('');

    useEffect(() => {
        const fetchBalance = async () => {
            try {
                const bal = await CashService.getCurrentBalance();
                setBookBalance(bal);
            } catch (error) {
                console.error('Failed to fetch main vault balance:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchBalance();
    }, []);

    // Calculated fields
    const getDenominationTotal = (value: number, key: string) => {
        const count = parseInt(counts[key] || '0', 10);
        return isNaN(count) ? 0 : count * value;
    };

    const parsedCoins = parseFloat(coins || '0');
    const coinsTotal = isNaN(parsedCoins) ? 0 : parsedCoins;

    const physicalTotal = DENOMINATIONS.reduce((sum, d) => sum + getDenominationTotal(d.value, d.key), 0) + coinsTotal;
    const discrepancy = physicalTotal - bookBalance;

    const handleCountChange = (key: string, text: string) => {
        const cleaned = text.replace(/[^0-9]/g, '');
        setCounts(prev => ({ ...prev, [key]: cleaned }));
    };

    const handleCoinsChange = (text: string) => {
        const cleaned = text.replace(/[^0-9.]/g, '');
        setCoins(cleaned);
    };

    const handleSubmit = async () => {
        setSaving(true);
        try {
            await database.write(async () => {
                const now = Date.now();
                const countDetails = JSON.stringify({
                    bills: counts,
                    coins: coinsTotal,
                    physicalTotal,
                    bookBalance,
                    discrepancy,
                });

                if (discrepancy === 0) {
                    // Record balanced checkpoint
                    await database.collections.get<CashTransaction>('cash_transactions').create(record => {
                        record._raw.id = uuid.v4().toString();
                        record.particulars = 'Cash Box Reconciled - Balanced';
                        record.amount = 0;
                        record.type = 'in';
                        record.remarks = remarks ? `${remarks} | Count: ${countDetails}` : `Count: ${countDetails}`;
                        record.transactionDate = now;
                        record.isPettyCash = false;
                        if (user?.id) record.recordedBy = user.id;
                    });
                } else if (discrepancy < 0) {
                    // Shortage (Outflow)
                    const shortageAmount = Math.abs(discrepancy);
                    await database.collections.get<CashTransaction>('cash_transactions').create(record => {
                        record._raw.id = uuid.v4().toString();
                        record.particulars = 'Cash Box Reconciliation Adj (Shortage)';
                        record.amount = shortageAmount;
                        record.type = 'out';
                        record.remarks = remarks ? `${remarks} | Count: ${countDetails}` : `Count: ${countDetails}`;
                        record.transactionDate = now;
                        record.isPettyCash = false;
                        if (user?.id) record.recordedBy = user.id;
                    });
                } else {
                    // Overage (Inflow)
                    await database.collections.get<CashTransaction>('cash_transactions').create(record => {
                        record._raw.id = uuid.v4().toString();
                        record.particulars = 'Cash Box Reconciliation Adj (Overage)';
                        record.amount = discrepancy;
                        record.type = 'in';
                        record.remarks = remarks ? `${remarks} | Count: ${countDetails}` : `Count: ${countDetails}`;
                        record.transactionDate = now;
                        record.isPettyCash = false;
                        if (user?.id) record.recordedBy = user.id;
                    });
                }
            });

            Alert.alert("Success", "Cash box reconciliation saved successfully.");
            safeBack(router, '/(admin)/cash-on-hand');
        } catch (error) {
            handleSaveError(error, 'Reconciliation', 'save');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 bg-gray-50 justify-center items-center">
                <ActivityIndicator size="large" color="#0288D1" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="flex-row items-center p-4 bg-white border-b border-gray-100">
                <Pressable onPress={() => safeBack(router, '/(admin)/cash-on-hand')} className="p-2 -ml-2 rounded-full active:bg-gray-50">
                    <Ionicons name="arrow-back" size={24} color="#0288D1" />
                </Pressable>
                <View className="ml-2 flex-1">
                    <Text className="text-xl font-black text-gray-900">Reconcile Cash Box</Text>
                    <Text className="text-[10px] text-gray-700 font-bold uppercase tracking-widest">Verify main vault actual cash count</Text>
                </View>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
                {/* Book Balance Summary */}
                <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6 flex-row justify-between items-center">
                    <View>
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">Book Balance</Text>
                        <Text className="text-2xl font-black text-gray-900 mt-1">{formatPHP(bookBalance)}</Text>
                    </View>
                    <View className="items-end">
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">Physical Count</Text>
                        <Text className="text-2xl font-black text-sky-700 mt-1">{formatPHP(physicalTotal)}</Text>
                    </View>
                </View>

                {/* Discrepancy Alert */}
                <View className={`p-5 rounded-3xl mb-6 flex-row items-center border ${
                    discrepancy === 0 
                        ? 'bg-green-50 border-green-100' 
                        : discrepancy < 0 
                        ? 'bg-rose-50 border-rose-100' 
                        : 'bg-amber-50 border-amber-100'
                }`}>
                    <View className="mr-4">
                        <MaterialIcons 
                            name={discrepancy === 0 ? 'check-circle' : discrepancy < 0 ? 'warning' : 'add-circle'} 
                            size={32} 
                            color={discrepancy === 0 ? '#2E7D32' : discrepancy < 0 ? '#BE123C' : '#D97706'} 
                        />
                    </View>
                    <View className="flex-1">
                        <Text className={`font-black text-base ${
                            discrepancy === 0 ? 'text-green-900' : discrepancy < 0 ? 'text-rose-900' : 'text-amber-900'
                        }`}>
                            {discrepancy === 0 ? 'Balanced' : discrepancy < 0 ? 'Cash Shortage' : 'Cash Overage'}
                        </Text>
                        <Text className={`text-xs mt-0.5 leading-4 ${
                            discrepancy === 0 ? 'text-green-700' : discrepancy < 0 ? 'text-rose-700' : 'text-amber-700'
                        }`}>
                            {discrepancy === 0 
                                ? 'Physical cash matches the ledger balance.' 
                                : discrepancy < 0 
                                ? `Shortage of ${formatPHP(Math.abs(discrepancy))}. Adjusting entry (outflow) will be posted.` 
                                : `Overage of ${formatPHP(discrepancy)}. Adjusting entry (inflow) will be posted.`
                            }
                        </Text>
                    </View>
                </View>

                {/* Denomination Form */}
                <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                    <Text className="text-sm font-extrabold text-gray-900 mb-4">Physical Cash Count</Text>

                    {DENOMINATIONS.map(d => (
                        <View key={d.key} className="flex-row items-center justify-between mb-4 pb-4 border-b border-gray-50">
                            <View className="flex-1">
                                <Text className="text-sm font-bold text-gray-800">{d.label}</Text>
                                <Text className="text-[10px] text-gray-500 mt-0.5">Value: {formatPHP(getDenominationTotal(d.value, d.key))}</Text>
                            </View>
                            <View className="w-24 bg-gray-50 border border-gray-100 rounded-xl px-3 py-1 flex-row items-center">
                                <TextInput
                                    className="flex-1 text-right text-gray-900 font-extrabold text-sm p-0"
                                    keyboardType="number-pad"
                                    value={counts[d.key]}
                                    onChangeText={(text) => handleCountChange(d.key, text)}
                                    placeholder="0" placeholderTextColor="#9CA3AF"
                                />
                            </View>
                        </View>
                    ))}

                    {/* Coins input */}
                    <View className="flex-row items-center justify-between pt-2">
                        <View className="flex-1">
                            <Text className="text-sm font-bold text-gray-800">Coins Total</Text>
                            <Text className="text-[10px] text-gray-500 mt-0.5">Loose coins value</Text>
                        </View>
                        <View className="w-24 bg-gray-50 border border-gray-100 rounded-xl px-3 py-1 flex-row items-center">
                            <TextInput
                                className="flex-1 text-right text-gray-900 font-extrabold text-sm p-0"
                                keyboardType="numeric"
                                value={coins}
                                onChangeText={handleCoinsChange}
                                placeholder="0.00"
                             placeholderTextColor="#9CA3AF"/>
                        </View>
                    </View>
                </View>

                {/* Remarks & Save */}
                <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                    <View className="mb-6">
                        <Text className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Reconciliation Notes</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 text-gray-900 text-sm font-semibold min-h-[80px]"
                            placeholder="Add remarks or findings during vault recount..."
                            value={remarks}
                            onChangeText={setRemarks}
                            multiline
                            numberOfLines={3}
                         placeholderTextColor="#9CA3AF"/>
                    </View>

                    <View className="flex-row gap-4">
                        <Pressable
                            onPress={() => safeBack(router, '/(admin)/cash-on-hand')}
                            className="flex-1 bg-gray-100 py-4 rounded-2xl items-center active:bg-gray-200"
                        >
                            <Text className="text-gray-700 font-extrabold text-xs uppercase tracking-widest">Cancel</Text>
                        </Pressable>
                        <Pressable
                            onPress={handleSubmit}
                            disabled={saving}
                            className="flex-1 bg-sky-700 py-4 rounded-2xl items-center active:bg-sky-800"
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Text className="text-white font-black text-xs uppercase tracking-widest">Confirm Reconcile</Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
