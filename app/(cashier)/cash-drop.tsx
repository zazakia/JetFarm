import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/store/AuthContext';
import { ShiftCashService } from '../../src/services/ShiftCashService';
import { formatPHP } from '../../src/utils/currency';
import { Ionicons } from '@expo/vector-icons';

export default function CashDropScreen() {
    const router = useRouter();
    const { branchId, user } = useAuth();
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('Mid-shift drop to branch safe');
    const [loading, setLoading] = useState(false);

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
                branchId || 'branch-bagacay',
                user?.id || 'cashier-1',
                dropAmount,
                reason || 'Mid-shift safe drop'
            );

            Alert.alert('Cash Drop Recorded', `${formatPHP(dropAmount)} transferred from drawer to safe.`, [
                { text: 'Back to POS', onPress: () => router.back() },
            ]);
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to record cash drop.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-slate-100 p-6 justify-center items-center">
            <View className="bg-white w-full max-w-md p-6 rounded-2xl border border-slate-200 shadow-sm">
                <View className="w-12 h-12 bg-amber-100 rounded-xl items-center justify-center mb-3">
                    <Ionicons name="shield-checkmark" size={24} color="#d97706" />
                </View>
                <Text className="text-slate-900 font-extrabold text-xl">Mid-Shift Cash Drop</Text>
                <Text className="text-slate-500 text-xs mt-1 mb-5">
                    Transfer excess cash from the active till into the store safe to maintain security.
                </Text>

                <View className="mb-4">
                    <Text className="text-slate-700 font-bold text-xs mb-1.5">Amount to Drop (₱)</Text>
                    <TextInput
                        keyboardType="numeric"
                        value={amount}
                        onChangeText={setAmount}
                        placeholder="5000.00"
                        placeholderTextColor="#9CA3AF"
                        className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-300 text-slate-900 text-xl font-bold"
                    />
                </View>

                <View className="flex-row justify-between mb-4">
                    {[2000, 5000, 10000].map((preset) => (
                        <Pressable
                            key={preset}
                            onPress={() => setAmount(String(preset))}
                            className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl"
                        >
                            <Text className="text-slate-800 text-xs font-bold">₱{preset.toLocaleString()}</Text>
                        </Pressable>
                    ))}
                </View>

                <View className="mb-6">
                    <Text className="text-slate-700 font-bold text-xs mb-1.5">Particulars / Reason</Text>
                    <TextInput
                        value={reason}
                        onChangeText={setReason}
                        placeholder="Reason for cash drop"
                        placeholderTextColor="#9CA3AF"
                        className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm"
                    />
                </View>

                <Pressable
                    disabled={loading}
                    onPress={handleRecordDrop}
                    className="w-full bg-amber-600 active:bg-amber-700 py-3.5 rounded-xl items-center shadow-sm"
                >
                    <Text className="text-white font-bold text-base">
                        {loading ? 'Recording Drop...' : 'Confirm Safe Transfer'}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}
