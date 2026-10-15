import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { WsDeliveryService } from '../../../../src/modules/water-station/services/WsDeliveryService';
import { WsCustomerService } from '../../../../src/modules/water-station/services/WsCustomerService';
import { WsPaymentService } from '../../../../src/modules/water-station/services/WsPaymentService';
import { ConsolidationService } from '../../../../src/services/ConsolidationService';
import WsDelivery from '../../../../src/database/models/WsDelivery';

export default function WaterStationDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        todayDeliveries: 0,
        receivables: 0,
        monthRevenue: 0,
        activeCustomers: 0
    });
    const [recentDeliveries, setRecentDeliveries] = useState<WsDelivery[]>([]);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const customers = await WsCustomerService.getAll();
            const activeCustCount = customers.filter(c => c.isActive).length;

            const deliveries = await WsDeliveryService.getAll();
            
            // Stats computations
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayDeliveriesList = deliveries.filter(d => d.deliveryDate >= todayStart.getTime());
            const todayCount = todayDeliveriesList.reduce((sum, d) => sum + d.gallons, 0);

            // Fetch revenue and receivables from Consolidation / Accounting balances
            const balances = await ConsolidationService.getBalances(new Date(), 'water-station');
            const wsCash = balances.get('1015') ?? 0;
            const wsRevenue = balances.get('4100') ?? 0;
            const wsReceivables = balances.get('1500') ?? 0; // Other Receivables for WS

            setStats({
                todayDeliveries: todayCount,
                receivables: wsReceivables,
                monthRevenue: wsRevenue,
                activeCustomers: activeCustCount
            });

            // Get last 5 deliveries sorted by date desc
            const sortedDeliveries = deliveries
                .sort((a, b) => b.deliveryDate - a.deliveryDate)
                .slice(0, 5);
            setRecentDeliveries(sortedDeliveries);

        } catch (error) {
            console.error('Failed to load Water Station dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            void loadDashboardData();
        }, [])
    );

    return (
        <ScrollView className="flex-1 bg-gray-50 p-4">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
                <View className="flex-row items-center">
                    <Pressable onPress={() => router.push('/(admin)/modules')} className="mr-3 bg-white p-2 rounded-lg border border-gray-200">
                        <MaterialIcons name="arrow-back" size={20} color="#1E3A8A" />
                    </Pressable>
                    <View>
                        <Text className="text-xl font-bold text-gray-900">Water Station</Text>
                        <Text className="text-xs text-gray-500">Business Unit Console</Text>
                    </View>
                </View>
                <Pressable onPress={loadDashboardData} className="bg-white p-2 rounded-lg border border-gray-200 active:bg-gray-100">
                    <MaterialIcons name="refresh" size={20} color="#475569" />
                </Pressable>
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center py-20">
                    <ActivityIndicator size="large" color="#1E3A8A" />
                </View>
            ) : (
                <View>
                    {/* Metrics Cards Grid */}
                    <View className="flex-row flex-wrap justify-between mb-6">
                        {/* Card 1: Today's Deliveries */}
                        <View className="w-[48%] bg-white p-4 rounded-2xl mb-4 border border-gray-150 shadow-xs">
                            <View className="flex-row justify-between items-center mb-2">
                                <Text className="text-xs font-semibold text-gray-400">TODAY'S SALES</Text>
                                <MaterialIcons name="local-shipping" size={20} color="#1E3A8A" />
                            </View>
                            <Text className="text-2xl font-bold text-gray-950">{stats.todayDeliveries} gal</Text>
                            <Text className="text-xs text-gray-500 mt-1">Delivered today</Text>
                        </View>

                        {/* Card 2: Receivables */}
                        <View className="w-[48%] bg-white p-4 rounded-2xl mb-4 border border-gray-150 shadow-xs">
                            <View className="flex-row justify-between items-center mb-2">
                                <Text className="text-xs font-semibold text-gray-400">RECEIVABLES</Text>
                                <MaterialIcons name="account-balance-wallet" size={20} color="#DC2626" />
                            </View>
                            <Text className="text-2xl font-bold text-red-650">₱{stats.receivables.toFixed(2)}</Text>
                            <Text className="text-xs text-gray-500 mt-1">Outstanding charges</Text>
                        </View>

                        {/* Card 3: Month Revenue */}
                        <View className="w-[48%] bg-white p-4 rounded-2xl mb-4 border border-gray-150 shadow-xs">
                            <View className="flex-row justify-between items-center mb-2">
                                <Text className="text-xs font-semibold text-gray-400">WS REVENUE</Text>
                                <MaterialIcons name="trending-up" size={20} color="#16A34A" />
                            </View>
                            <Text className="text-2xl font-bold text-green-650">₱{stats.monthRevenue.toFixed(2)}</Text>
                            <Text className="text-xs text-gray-500 mt-1">Total revenue collected</Text>
                        </View>

                        {/* Card 4: Customers */}
                        <View className="w-[48%] bg-white p-4 rounded-2xl mb-4 border border-gray-150 shadow-xs">
                            <View className="flex-row justify-between items-center mb-2">
                                <Text className="text-xs font-semibold text-gray-400">CUSTOMERS</Text>
                                <MaterialIcons name="people" size={20} color="#7C3AED" />
                            </View>
                            <Text className="text-2xl font-bold text-gray-950">{stats.activeCustomers}</Text>
                            <Text className="text-xs text-gray-500 mt-1">Active customer accounts</Text>
                        </View>
                    </View>

                    {/* Quick Action Navigation */}
                    <Text className="text-base font-bold text-gray-900 mb-3">Quick Actions</Text>
                    <View className="flex-row justify-between mb-6 bg-white p-4 rounded-2xl border border-gray-150">
                        <Pressable 
                            onPress={() => router.push('/(admin)/modules/water-station/customers')} 
                            className="items-center flex-1"
                        >
                            <View className="bg-blue-50 p-3 rounded-full mb-2">
                                <MaterialIcons name="person-add" size={24} color="#1E3A8A" />
                            </View>
                            <Text className="text-xs font-medium text-gray-700">Customers</Text>
                        </Pressable>

                        <Pressable 
                            onPress={() => router.push('/(admin)/modules/water-station/deliveries')} 
                            className="items-center flex-1"
                        >
                            <View className="bg-green-50 p-3 rounded-full mb-2">
                                <MaterialIcons name="local-shipping" size={24} color="#16A34A" />
                            </View>
                            <Text className="text-xs font-medium text-gray-700">Deliveries</Text>
                        </Pressable>

                        <Pressable 
                            onPress={() => router.push('/(admin)/modules/water-station/inventory')} 
                            className="items-center flex-1"
                        >
                            <View className="bg-purple-50 p-3 rounded-full mb-2">
                                <MaterialIcons name="inventory" size={24} color="#7C3AED" />
                            </View>
                            <Text className="text-xs font-medium text-gray-700">Inventory/CoA</Text>
                        </Pressable>

                        <Pressable 
                            onPress={() => router.push('/(admin)/modules/water-station/history')} 
                            className="items-center flex-1"
                        >
                            <View className="bg-amber-50 p-3 rounded-full mb-2">
                                <MaterialIcons name="history" size={24} color="#D97706" />
                            </View>
                            <Text className="text-xs font-medium text-gray-700">History</Text>
                        </Pressable>
                    </View>

                    {/* Recent Deliveries List */}
                    <View className="bg-white rounded-2xl p-4 border border-gray-150">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-base font-bold text-gray-900">Recent Deliveries</Text>
                            <Pressable onPress={() => router.push('/(admin)/modules/water-station/deliveries')}>
                                <Text className="text-xs text-blue-900 font-bold">See All</Text>
                            </Pressable>
                        </View>

                        {recentDeliveries.length === 0 ? (
                            <Text className="text-gray-500 text-sm text-center py-6">No recent deliveries recorded.</Text>
                        ) : (
                            recentDeliveries.map((delivery) => (
                                <View key={delivery.id} className="flex-row justify-between items-center py-3 border-b border-gray-100 last:border-0">
                                    <View>
                                        <Text className="text-sm font-bold text-gray-900">Delivery of {delivery.gallons} gallons</Text>
                                        <Text className="text-xs text-gray-400 mt-0.5">
                                            {new Date(delivery.deliveryDate).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    <View className="items-end">
                                        <Text className="text-sm font-bold text-gray-900">₱{delivery.totalAmount.toFixed(2)}</Text>
                                        <View className={`px-2 py-0.5 rounded-full mt-1 ${delivery.status === 'delivered' ? 'bg-green-50' : 'bg-amber-50'}`}>
                                            <Text className={`text-[10px] font-semibold ${delivery.status === 'delivered' ? 'text-green-700' : 'text-amber-700'}`}>
                                                {delivery.status.toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </View>
            )}
        </ScrollView>
    );
}
