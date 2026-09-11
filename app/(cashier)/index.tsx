import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useAuth } from '../../src/store/AuthContext';
import { formatPHP } from '../../src/utils/currency';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function CashierDashboard() {
    const { user, branchId } = useAuth();
    const router = useRouter();

    return (
        <ScrollView className="flex-1 bg-slate-100 p-4">
            {/* Header Status Card */}
            <View className="bg-emerald-700 rounded-xl p-5 mb-4 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-emerald-100 text-sm font-medium">Active Branch Register</Text>
                    <View className="bg-emerald-600 px-3 py-1 rounded-full flex-row items-center">
                        <View className="w-2 h-2 rounded-full bg-emerald-300 mr-1.5" />
                        <Text className="text-white text-xs font-semibold">Till Open</Text>
                    </View>
                </View>
                <Text className="text-white text-2xl font-bold">{branchId || 'Crispy King Branch'}</Text>
                <Text className="text-emerald-200 text-sm mt-1">Cashier: {user?.email || 'Active Staff'}</Text>
            </View>

            {/* Quick KPI Row */}
            <View className="flex-row justify-between mb-4">
                <View className="flex-1 bg-white p-4 rounded-xl mr-2 shadow-sm border border-slate-200">
                    <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Today's Sales</Text>
                    <Text className="text-slate-900 text-xl font-extrabold mt-1">{formatPHP(0)}</Text>
                    <Text className="text-slate-400 text-xs mt-1">0 orders completed</Text>
                </View>
                <View className="flex-1 bg-white p-4 rounded-xl ml-2 shadow-sm border border-slate-200">
                    <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Drawer Cash</Text>
                    <Text className="text-emerald-700 text-xl font-extrabold mt-1">{formatPHP(0)}</Text>
                    <Text className="text-slate-400 text-xs mt-1">Opening Float + Cash</Text>
                </View>
            </View>

            {/* Main Action Grid */}
            <Text className="text-slate-800 text-base font-bold mb-3">POS Operations</Text>
            <View className="space-y-3 mb-6">
                <Pressable
                    onPress={() => router.push('/(cashier)/pos' as any)}
                    className="bg-emerald-600 active:bg-emerald-700 p-4 rounded-xl flex-row items-center justify-between shadow-sm"
                >
                    <View className="flex-row items-center">
                        <View className="w-12 h-12 bg-emerald-500 rounded-lg items-center justify-center mr-3">
                            <Ionicons name="cart" size={26} color="#ffffff" />
                        </View>
                        <View>
                            <Text className="text-white text-lg font-bold">New Sale / Touch POS</Text>
                            <Text className="text-emerald-100 text-xs">Ring up Chicken, Rice, Drinks & combos</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color="#ffffff" />
                </Pressable>

                <View className="flex-row space-x-3 mt-3">
                    <Pressable
                        onPress={() => router.push('/(cashier)/cash-drop' as any)}
                        className="flex-1 bg-white p-4 rounded-xl border border-slate-200 items-center justify-center shadow-sm"
                    >
                        <Ionicons name="cash-outline" size={28} color="#047857" />
                        <Text className="text-slate-800 font-bold text-sm mt-2">Cash Drop</Text>
                        <Text className="text-slate-500 text-xs text-center mt-0.5">Transfer cash to safe</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => router.push('/(cashier)/returns' as any)}
                        className="flex-1 bg-white p-4 rounded-xl border border-slate-200 items-center justify-center shadow-sm"
                    >
                        <Ionicons name="return-down-back-outline" size={28} color="#0d9488" />
                        <Text className="text-slate-800 font-bold text-sm mt-2">Sales Return</Text>
                        <Text className="text-slate-500 text-xs text-center mt-0.5">Refund & restock shelf</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => router.push('/(cashier)/shift-close' as any)}
                        className="flex-1 bg-white p-4 rounded-xl border border-slate-200 items-center justify-center shadow-sm"
                    >
                        <Ionicons name="lock-closed-outline" size={28} color="#b91c1c" />
                        <Text className="text-slate-800 font-bold text-sm mt-2">Z-Reading</Text>
                        <Text className="text-slate-500 text-xs text-center mt-0.5">End shift count</Text>
                    </Pressable>
                </View>
            </View>
        </ScrollView>
    );
}
