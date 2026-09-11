import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/store/AuthContext';
import { ShiftCashService } from '../../src/services/ShiftCashService';
import { formatPHP } from '../../src/utils/currency';
import { Ionicons } from '@expo/vector-icons';

export default function ShiftOpenScreen() {
    const router = useRouter();
    const { branchId, user } = useAuth();
    const [openingFloat, setOpeningFloat] = useState('2000');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);

    const handleOpenShift = async () => {
        const floatAmount = parseFloat(openingFloat);
        if (isNaN(floatAmount) || floatAmount < 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid opening float amount.');
            return;
        }

        setLoading(true);
        try {
            const shiftService = new ShiftCashService();
            await shiftService.openShift(
                branchId || 'branch-bagacay',
                user?.id || 'cashier-1',
                floatAmount,
                notes || 'Morning Shift Start'
            );

            Alert.alert('Till Opened', `Shift registered with opening float of ${formatPHP(floatAmount)}.`, [
                { text: 'Go to POS', onPress: () => router.replace('/(cashier)/pos' as any) },
            ]);
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to open shift.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-slate-100 p-6 justify-center items-center">
            <View className="bg-white w-full max-w-md p-6 rounded-2xl border border-slate-200 shadow-sm">
                <View className="w-12 h-12 bg-emerald-100 rounded-xl items-center justify-center mb-3">
                    <Ionicons name="key" size={24} color="#047857" />
                </View>
                <Text className="text-slate-900 font-extrabold text-xl">Open Shift Register</Text>
                <Text className="text-slate-500 text-xs mt-1 mb-5">
                    Count and record the initial change fund in the cash drawer before taking orders.
                </Text>

                <View className="mb-4">
                    <Text className="text-slate-700 font-bold text-xs mb-1.5">Opening Change Float (₱)</Text>
                    <TextInput
                        keyboardType="numeric"
                        value={openingFloat}
                        onChangeText={setOpeningFloat}
                        placeholder="2000.00"
                        placeholderTextColor="#9CA3AF"
                        className="bg-slate-50 px-4 py-3 rounded-xl border border-slate-300 text-slate-900 text-xl font-bold"
                    />
                </View>

                <View className="mb-6">
                    <Text className="text-slate-700 font-bold text-xs mb-1.5">Shift Notes (Optional)</Text>
                    <TextInput
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="e.g. AM Shift / Crew: Mario, Ana"
                        placeholderTextColor="#9CA3AF"
                        className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm"
                    />
                </View>

                <Pressable
                    disabled={loading}
                    onPress={handleOpenShift}
                    className="w-full bg-emerald-600 active:bg-emerald-700 py-3.5 rounded-xl items-center shadow-sm"
                >
                    <Text className="text-white font-bold text-base">
                        {loading ? 'Opening Register...' : 'Confirm & Open Register'}
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}
