import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { WsDeliveryService } from '../../../../src/modules/water-station/services/WsDeliveryService';
import { WsCustomerService } from '../../../../src/modules/water-station/services/WsCustomerService';
import ActionLogService from '../../../../src/services/ActionLogService';
import WsDelivery from '../../../../src/database/models/WsDelivery';
import WsCustomer from '../../../../src/database/models/WsCustomer';
import { formatPHP } from '../../../../src/utils/currency';
import { formatDateTime, formatRelative } from '../../../../src/utils/dates';
import { resolveOperator } from '../../../../src/utils/auditTrailFormatter';

export default function WaterStationHistoryScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [deliveries, setDeliveries] = useState<WsDelivery[]>([]);
    const [customersMap, setCustomersMap] = useState<Map<string, WsCustomer>>(new Map());
    const [auditMap, setAuditMap] = useState<Map<string, string>>(new Map()); // deliveryId -> operatorName
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'delivered' | 'pending'>('ALL');

    const loadHistoryData = async () => {
        try {
            const [deliveriesList, customersList, actionLogs, userProfiles] = await Promise.all([
                WsDeliveryService.getAll(),
                WsCustomerService.getAll(),
                ActionLogService.getLogs(150, 'ws_deliveries'),
                ActionLogService.getUserProfilesMap(),
            ]);

            const cMap = new Map<string, WsCustomer>();
            customersList.forEach((c) => cMap.set(c.id, c));
            setCustomersMap(cMap);

            const aMap = new Map<string, string>();
            actionLogs.forEach((log) => {
                if (log.entityId && !aMap.has(log.entityId)) {
                    const op = resolveOperator(log.performedBy, userProfiles);
                    aMap.set(log.entityId, `${op.name} (${op.role})`);
                }
            });
            setAuditMap(aMap);

            const sorted = deliveriesList.sort((a, b) => b.deliveryDate - a.deliveryDate);
            setDeliveries(sorted);
        } catch (error) {
            console.error('[WaterStationHistory] Failed to load history:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadHistoryData();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadHistoryData();
    };

    const filteredDeliveries = useMemo(() => {
        return deliveries.filter((item) => {
            const customer = customersMap.get(item.customerId);
            const customerName = (customer?.name || '').toLowerCase();
            const q = search.toLowerCase().trim();

            const matchesSearch = !q || customerName.includes(q) || String(item.gallons).includes(q);
            const matchesStatus = filterStatus === 'ALL' || item.status === filterStatus;

            return matchesSearch && matchesStatus;
        });
    }, [deliveries, customersMap, search, filterStatus]);

    const totalGallons = filteredDeliveries.reduce((sum, d) => sum + d.gallons, 0);
    const totalRevenue = filteredDeliveries.reduce((sum, d) => sum + d.totalAmount, 0);

    return (
        <ScrollView
            className="flex-1 bg-gray-50 p-4"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Header Navigation */}
            <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                    <Pressable
                        onPress={() => router.push('/(admin)/modules/water-station')}
                        className="mr-3 bg-white p-2 rounded-xl border border-gray-200"
                    >
                        <MaterialIcons name="arrow-back" size={20} color="#1E3A8A" />
                    </Pressable>
                    <View>
                        <Text className="text-xl font-bold text-gray-900">Delivery & Order History</Text>
                        <Text className="text-xs text-gray-500">Water Station Refill & Customer Traceability</Text>
                    </View>
                </View>
                <Pressable
                    onPress={onRefresh}
                    className="bg-white p-2 rounded-xl border border-gray-200 active:bg-gray-100"
                >
                    <MaterialIcons name="refresh" size={20} color="#475569" />
                </Pressable>
            </View>

            {/* KPI Cards */}
            <View className="flex-row justify-between mb-4 gap-3">
                <View className="flex-1 bg-white p-4 rounded-2xl border border-gray-150 shadow-xs">
                    <Text className="text-gray-400 text-xs font-semibold uppercase">Total Gallons</Text>
                    <Text className="text-xl font-bold text-gray-900 mt-1">{totalGallons.toLocaleString()} gal</Text>
                </View>
                <View className="flex-1 bg-white p-4 rounded-2xl border border-gray-150 shadow-xs">
                    <Text className="text-gray-400 text-xs font-semibold uppercase">Total Sales Value</Text>
                    <Text className="text-xl font-bold text-emerald-700 mt-1">{formatPHP(totalRevenue)}</Text>
                </View>
            </View>

            {/* Search Filter Bar */}
            <View className="bg-white rounded-2xl p-3 border border-gray-200 mb-3 flex-row items-center shadow-xs">
                <MaterialIcons name="search" size={20} color="#9CA3AF" />
                <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search by customer name or gallons..."
                    placeholderTextColor="#9CA3AF"
                    className="flex-1 ml-2 text-sm text-gray-900"
                />
            </View>

            {/* Filter Pills */}
            <View className="flex-row gap-2 mb-4">
                {(['ALL', 'delivered', 'pending'] as const).map((status) => (
                    <Pressable
                        key={status}
                        onPress={() => setFilterStatus(status)}
                        className={`px-3 py-1.5 rounded-full border ${
                            filterStatus === status ? 'bg-blue-900 border-blue-900' : 'bg-white border-gray-200'
                        }`}
                    >
                        <Text
                            className={`text-xs font-bold ${
                                filterStatus === status ? 'text-white' : 'text-gray-700'
                            }`}
                        >
                            {status === 'ALL' ? 'All Deliveries' : status.toUpperCase()}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* History Feed */}
            {loading ? (
                <View className="py-20 items-center justify-center">
                    <ActivityIndicator size="large" color="#1E3A8A" />
                    <Text className="text-gray-500 text-xs mt-3">Loading delivery audit trail...</Text>
                </View>
            ) : filteredDeliveries.length === 0 ? (
                <View className="bg-white rounded-2xl p-8 items-center justify-center border border-gray-150">
                    <MaterialIcons name="local-drink" size={40} color="#CBD5E1" />
                    <Text className="text-gray-700 font-bold text-sm mt-2">No Delivery Records Found</Text>
                    <Text className="text-gray-400 text-xs text-center mt-1">
                        Completed refills and deliveries will show here with customer and dispatcher tracing.
                    </Text>
                </View>
            ) : (
                <View className="gap-3 mb-8">
                    {filteredDeliveries.map((item) => {
                        const customer = customersMap.get(item.customerId);
                        const operator = auditMap.get(item.id) || 'System / Station Staff';

                        return (
                            <View
                                key={item.id}
                                className="bg-white p-4 rounded-2xl border border-gray-150 shadow-xs"
                            >
                                <View className="flex-row justify-between items-start">
                                    <View className="flex-1 mr-2">
                                        <View className="flex-row items-center mb-1">
                                            <Text className="text-sm font-bold text-gray-900">
                                                {customer ? customer.name : `Customer ID: ${item.customerId}`}
                                            </Text>
                                            {customer?.isMember && (
                                                <View className="bg-purple-50 px-1.5 py-0.5 rounded ml-2 border border-purple-200">
                                                    <Text className="text-[10px] font-bold text-purple-700">MEMBER</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text className="text-xs text-gray-400">
                                            {formatDateTime(item.deliveryDate)} ({formatRelative(item.deliveryDate)})
                                        </Text>
                                    </View>

                                    <View className="items-end">
                                        <Text className="text-base font-black text-gray-900">
                                            {formatPHP(item.totalAmount)}
                                        </Text>
                                        <View
                                            className={`px-2 py-0.5 rounded-full mt-1 ${
                                                item.status === 'delivered' ? 'bg-green-50' : 'bg-amber-50'
                                            }`}
                                        >
                                            <Text
                                                className={`text-[10px] font-bold ${
                                                    item.status === 'delivered' ? 'text-green-700' : 'text-amber-700'
                                                }`}
                                            >
                                                {item.status.toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Delivery Details */}
                                <View className="mt-3 pt-2.5 border-t border-gray-100 flex-row justify-between items-center">
                                    <Text className="text-xs text-gray-600 font-medium">
                                        Quantity: <Text className="font-bold text-gray-900">{item.gallons} gallons</Text> (₱{item.pricePerGallon}/gal)
                                    </Text>
                                </View>

                                {/* User Tracing Footer */}
                                <View className="mt-2 pt-2 border-t border-gray-50 flex-row items-center justify-between">
                                    <View className="flex-row items-center">
                                        <MaterialIcons name="person" size={14} color="#64748B" style={{ marginRight: 4 }} />
                                        <Text className="text-[11px] text-gray-500 font-medium">
                                            Recorded by: <Text className="font-bold text-gray-800">{operator}</Text>
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}
        </ScrollView>
    );
}
