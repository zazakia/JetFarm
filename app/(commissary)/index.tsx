import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../../src/store/AuthContext';
import { formatPHP } from '../../src/utils/currency';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function CommissaryDashboard() {
    const { user } = useAuth();
    const router = useRouter();

    return (
        <ScrollView className="flex-1 bg-slate-100 p-4">
            {/* Commissary Header */}
            <View className="bg-orange-800 rounded-xl p-5 mb-4 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-orange-200 text-xs font-semibold uppercase tracking-wider">Central Commissary & Dressing Plant</Text>
                    <View className="bg-orange-700 px-3 py-1 rounded-full">
                        <Text className="text-white text-xs font-medium">Main Office</Text>
                    </View>
                </View>
                <Text className="text-white text-2xl font-bold">Crispy King Central Commissary</Text>
                <Text className="text-orange-100 text-sm mt-1">Officer: {user?.email || 'Commissary Keeper'}</Text>
            </View>

            {/* Procurement & Yield KPIs */}
            <View className="flex-row justify-between mb-4">
                <View className="flex-1 bg-white p-4 rounded-xl mr-2 shadow-sm border border-slate-200">
                    <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Live Broiler Stock</Text>
                    <Text className="text-slate-900 text-xl font-extrabold mt-1">9,000 hds</Text>
                    <Text className="text-slate-500 text-xs mt-1">600 crates on floor</Text>
                </View>
                <View className="flex-1 bg-white p-4 rounded-xl ml-2 shadow-sm border border-slate-200">
                    <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider">SCUT Yield %</Text>
                    <Text className="text-emerald-700 text-xl font-extrabold mt-1">78.5%</Text>
                    <Text className="text-slate-500 text-xs mt-1">Standard Cut Efficiency</Text>
                </View>
            </View>

            {/* Quick Actions */}
            <Text className="text-slate-800 text-base font-bold mb-3">Commissary Workflows</Text>
            <View className="space-y-3 mb-6">
                <TouchableOpacity
                    onPress={() => router.push('/(commissary)/dispatch' as any)}
                    className="bg-white p-4 rounded-xl border border-slate-200 flex-row items-center justify-between shadow-sm mb-3"
                >
                    <View className="flex-row items-center">
                        <View className="w-12 h-12 bg-orange-100 rounded-lg items-center justify-center mr-3">
                            <Ionicons name="send-outline" size={26} color="#9a3412" />
                        </View>
                        <View>
                            <Text className="text-slate-900 text-base font-bold">Branch Dispatches (STR)</Text>
                            <Text className="text-slate-500 text-xs">Dispatch chicken & supplies to 39 stores</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="#94a3b8" />
                </TouchableOpacity>

                <View className="bg-white p-4 rounded-xl border border-slate-200 flex-row items-center justify-between shadow-sm mb-3">
                    <View className="flex-row items-center">
                        <View className="w-12 h-12 bg-amber-100 rounded-lg items-center justify-center mr-3">
                            <Ionicons name="scale-outline" size={26} color="#b45309" />
                        </View>
                        <View>
                            <Text className="text-slate-900 text-base font-bold">Live Weight Dressing & BOM</Text>
                            <Text className="text-slate-500 text-xs">Track heads, kg, NMIS cert & SCUTS yield</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="#94a3b8" />
                </View>
            </View>
        </ScrollView>
    );
}
