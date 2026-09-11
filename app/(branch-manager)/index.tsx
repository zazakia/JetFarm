import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useAuth } from '../../src/store/AuthContext';
import { formatPHP } from '../../src/utils/currency';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function BranchManagerDashboard() {
    const { user, branchId } = useAuth();
    const router = useRouter();

    return (
        <ScrollView className="flex-1 bg-slate-100 p-4">
            {/* Branch Banner Card */}
            <View className="bg-blue-800 rounded-xl p-5 mb-4 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Crispy King Store Management</Text>
                    <View className="bg-blue-700 px-3 py-1 rounded-full">
                        <Text className="text-white text-xs font-medium">Store Operations</Text>
                    </View>
                </View>
                <Text className="text-white text-2xl font-bold">{branchId || 'Bagacay Branch (Dumaguete)'}</Text>
                <Text className="text-blue-100 text-sm mt-1">Manager: {user?.email || 'Store Leader'}</Text>
            </View>

            {/* Quick Metrics */}
            <View className="flex-row justify-between mb-4">
                <View className="flex-1 bg-white p-4 rounded-xl mr-2 shadow-sm border border-slate-200">
                    <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Month-To-Date Sales</Text>
                    <Text className="text-slate-900 text-xl font-extrabold mt-1">{formatPHP(512383)}</Text>
                    <Text className="text-emerald-600 text-xs font-semibold mt-1">Target: ₱500k achieved</Text>
                </View>
                <View className="flex-1 bg-white p-4 rounded-xl ml-2 shadow-sm border border-slate-200">
                    <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Food Cost %</Text>
                    <Text className="text-amber-700 text-xl font-extrabold mt-1">64.97%</Text>
                    <Text className="text-slate-500 text-xs mt-1">Target: ≤ 65.00%</Text>
                </View>
            </View>

            {/* Store Workflow Menu */}
            <Text className="text-slate-800 text-base font-bold mb-3">Store Controls</Text>
            <View className="space-y-3 mb-6">
                <Pressable
                    onPress={() => router.push('/(branch-manager)/receiving' as any)}
                    className="bg-white p-4 rounded-xl border border-slate-200 flex-row items-center justify-between shadow-sm mb-3"
                >
                    <View className="flex-row items-center">
                        <View className="w-12 h-12 bg-blue-100 rounded-lg items-center justify-center mr-3">
                            <Ionicons name="cube-outline" size={26} color="#1e40af" />
                        </View>
                        <View>
                            <Text className="text-slate-900 text-base font-bold">Commissary Receiving</Text>
                            <Text className="text-slate-500 text-xs">Verify deliveries & acknowledge POs</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="#94a3b8" />
                </Pressable>

                <Pressable
                    onPress={() => router.push('/(branch-manager)/waste-log' as any)}
                    className="bg-white p-4 rounded-xl border border-slate-200 flex-row items-center justify-between shadow-sm mb-3"
                >
                    <View className="flex-row items-center">
                        <View className="w-12 h-12 bg-rose-100 rounded-lg items-center justify-center mr-3">
                            <Ionicons name="trash-outline" size={26} color="#be123c" />
                        </View>
                        <View>
                            <Text className="text-slate-900 text-base font-bold">Bad Order & Spoilage</Text>
                            <Text className="text-slate-500 text-xs">Log dropped, expired, or overcooked chicken</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="#94a3b8" />
                </Pressable>

                <Pressable
                    onPress={() => router.push('/(branch-manager)/msr' as any)}
                    className="bg-white p-4 rounded-xl border border-slate-200 flex-row items-center justify-between shadow-sm mb-3"
                >
                    <View className="flex-row items-center">
                        <View className="w-12 h-12 bg-indigo-100 rounded-lg items-center justify-center mr-3">
                            <Ionicons name="document-text-outline" size={26} color="#4338ca" />
                        </View>
                        <View>
                            <Text className="text-slate-900 text-base font-bold">Digital MSR Report</Text>
                            <Text className="text-slate-500 text-xs">View 31-day store sales, OPEX & profit</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="#94a3b8" />
                </Pressable>
            </View>
        </ScrollView>
    );
}
