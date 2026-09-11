import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { WsInventoryService } from '../../../../src/modules/water-station/services/WsInventoryService';
import { WsCustomerService } from '../../../../src/modules/water-station/services/WsCustomerService';
import { ConsolidationService } from '../../../../src/services/ConsolidationService';
import WsContainer from '../../../../src/database/models/WsContainer';
import WsCustomer from '../../../../src/database/models/WsCustomer';

export default function WaterStationInventory() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [containers, setContainers] = useState<WsContainer[]>([]);
    const [customers, setCustomers] = useState<WsCustomer[]>([]);
    const [coaBalances, setCoaBalances] = useState<{ code: string; name: string; balance: number }[]>([]);

    const loadData = async () => {
        setLoading(true);
        try {
            const customersList = await WsCustomerService.getAll();
            setCustomers(customersList);

            // Load all containers
            const allContainers: WsContainer[] = [];
            for (const c of customersList) {
                const customerContainers = await WsInventoryService.getByCustomer(c.id);
                allContainers.push(...customerContainers);
            }
            setContainers(allContainers);

            // Load Segment specific Chart of Accounts balances
            const balances = await ConsolidationService.getBalances(new Date(), 'water-station');
            const accounts = [
                { code: '1015', name: 'Cash on Hand — Water Station' },
                { code: '1500', name: 'Other Receivables (WS Charge Sales)' },
                { code: '4100', name: 'Water Sales Revenue' },
                { code: '5120', name: 'Cost of Sales — WS Supplies' }
            ];

            const coaList = accounts.map(acc => ({
                code: acc.code,
                name: acc.name,
                balance: balances.get(acc.code) ?? 0
            }));
            setCoaBalances(coaList);

        } catch (error) {
            console.error('Failed to load inventory / CoA details:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            void loadData();
        }, [])
    );

    const getCustomerName = (id: string) => {
        const found = customers.find(c => c.id === id);
        return found ? found.name : 'Unknown';
    };

    return (
        <ScrollView className="flex-1 bg-gray-50 p-4">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-6">
                <View className="flex-row items-center">
                    <Pressable onPress={() => router.back()} className="mr-3 bg-white p-2 rounded-lg border border-gray-200">
                        <MaterialIcons name="arrow-back" size={20} color="#1E3A8A" />
                    </Pressable>
                    <Text className="text-lg font-bold text-gray-900">WS Inventory & Accounting</Text>
                </View>
                <Pressable onPress={loadData} className="bg-white p-2 rounded-lg border border-gray-200 active:bg-gray-100">
                    <MaterialIcons name="refresh" size={20} color="#475569" />
                </Pressable>
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center py-10">
                    <ActivityIndicator size="large" color="#1E3A8A" />
                </View>
            ) : (
                <View className="space-y-6">
                    {/* Segment Chart of Accounts Card */}
                    <View className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs mb-4">
                        <Text className="text-base font-bold text-gray-900 mb-3">WS Segment Accounts</Text>
                        {coaBalances.map(acc => (
                            <View key={acc.code} className="flex-row justify-between items-center py-3 border-b border-gray-100 last:border-0">
                                <View>
                                    <Text className="text-sm font-semibold text-gray-800">{acc.name}</Text>
                                    <Text className="text-xs text-gray-400 mt-0.5">Account Code: {acc.code}</Text>
                                </View>
                                <Text className={`text-sm font-bold ${acc.code.startsWith('4') ? 'text-green-600' : 'text-gray-900'}`}>
                                    ₱{acc.balance.toFixed(2)}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Container Inventory balances */}
                    <View className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs">
                        <Text className="text-base font-bold text-gray-900 mb-3">Containers Tracker</Text>

                        {containers.length === 0 ? (
                            <Text className="text-gray-500 text-sm text-center py-6">No containers registered yet.</Text>
                        ) : (
                            containers.map(container => (
                                <View key={container.id} className="flex-row justify-between items-center py-3 border-b border-gray-100 last:border-0">
                                    <View>
                                        <Text className="text-sm font-semibold text-gray-800">{getCustomerName(container.customerId)}</Text>
                                        <Text className="text-xs text-gray-400 mt-0.5">Type: {container.containerType.toUpperCase()}</Text>
                                    </View>
                                    <View className="flex-row space-x-4">
                                        <View className="items-end">
                                            <Text className="text-xs text-gray-400">Owned</Text>
                                            <Text className="text-sm font-bold text-gray-900">{container.quantityOwned}</Text>
                                        </View>
                                        <View className="items-end ml-4">
                                            <Text className="text-xs text-gray-400">Loaned</Text>
                                            <Text className="text-sm font-bold text-blue-900">{container.quantityLoaned}</Text>
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
