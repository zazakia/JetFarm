import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPHP } from '../../../../src/utils/currency';
import { DemoDataNotice } from '../../../../src/components/DemoDataNotice';

import { formatRelative } from '../../../../src/utils/dates';
import { useAuth } from '../../../../src/store/AuthContext';

interface VehicleUnit {
    id: string;
    plateNumber: string;
    vehicleType: string;
    assignedDriver: string;
    dailyBoundary: number;
    collectedToday: number;
    status: 'on_route' | 'maintenance' | 'idle';
}

interface TransportCollectionHistoryItem {
    id: string;
    plateNumber: string;
    vehicleType: string;
    driver: string;
    amount: number;
    operator: string;
    timestamp: number;
}

const INITIAL_COLLECTION_HISTORY: TransportCollectionHistoryItem[] = [
    { id: 'col-1', plateNumber: 'ABC-1234', vehicleType: 'Jeepney (Traditional)', driver: 'Mario Santos', amount: 1500, operator: 'Bong Dispatcher', timestamp: Date.now() - 1000 * 60 * 60 },
    { id: 'col-2', plateNumber: 'XYZ-5678', vehicleType: 'Modern PUV Euro-4', driver: 'Danilo Cruz', amount: 2500, operator: 'Cybergada Master', timestamp: Date.now() - 1000 * 60 * 150 },
    { id: 'col-3', plateNumber: 'TRK-9101', vehicleType: 'Tricycle Unit #12', driver: 'Ramon Mercado', amount: 400, operator: 'Bong Dispatcher', timestamp: Date.now() - 1000 * 60 * 270 },
];

const INITIAL_VEHICLES: VehicleUnit[] = [
    { id: '1', plateNumber: 'ABC-1234', vehicleType: 'Jeepney (Traditional)', assignedDriver: 'Mario Santos', dailyBoundary: 1500, collectedToday: 1500, status: 'on_route' },
    { id: '2', plateNumber: 'XYZ-5678', vehicleType: 'Modern PUV Euro-4', assignedDriver: 'Danilo Cruz', dailyBoundary: 2500, collectedToday: 2500, status: 'on_route' },
    { id: '3', plateNumber: 'TRK-9101', vehicleType: 'Tricycle Unit #12', assignedDriver: 'Ramon Mercado', dailyBoundary: 400, collectedToday: 400, status: 'on_route' },
    { id: '4', plateNumber: 'TRK-9102', vehicleType: 'Tricycle Unit #14', assignedDriver: 'Eddie Garcia', dailyBoundary: 400, collectedToday: 0, status: 'idle' },
    { id: '5', plateNumber: 'PUV-3344', vehicleType: 'Modern PUV Euro-4', assignedDriver: 'Unassigned', dailyBoundary: 2500, collectedToday: 0, status: 'maintenance' }
];

export default function TransportConsoleScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [vehicles, setVehicles] = useState<VehicleUnit[]>(INITIAL_VEHICLES);
    const [collectionHistory, setCollectionHistory] = useState<TransportCollectionHistoryItem[]>(INITIAL_COLLECTION_HISTORY);
    const [totalCollections, setTotalCollections] = useState(4400);

    const handleCollectBoundary = (unit: VehicleUnit) => {
        if (unit.collectedToday >= unit.dailyBoundary) {
            Alert.alert('Boundary Complete', `Daily boundary for ${unit.plateNumber} (${formatPHP(unit.dailyBoundary)}) has already been collected.`);
            return;
        }

        setVehicles(prev => prev.map(v => v.id === unit.id ? { ...v, collectedToday: unit.dailyBoundary } : v));
        setTotalCollections(prev => prev + unit.dailyBoundary);

        const operatorName = (user?.user_metadata?.full_name as string) || user?.email || 'Fleet Dispatcher';
        setCollectionHistory(prev => [
            {
                id: 'col-' + Date.now(),
                plateNumber: unit.plateNumber,
                vehicleType: unit.vehicleType,
                driver: unit.assignedDriver,
                amount: unit.dailyBoundary,
                operator: operatorName,
                timestamp: Date.now(),
            },
            ...prev,
        ]);

        Alert.alert(
            'Preview Only — Nothing Was Saved',
            `This marked the ${formatPHP(unit.dailyBoundary)} boundary for ${unit.plateNumber} as collected in memory. ` +
                'No collection record was written and the figure resets when the page reloads.'
        );
    };

    return (
        <ScrollView className="flex-1 bg-gray-50 p-4">
            {/* Header Banner */}
            <View className="bg-indigo-900 p-6 rounded-3xl mb-6 shadow-md">
                <View className="flex-row items-center justify-between mb-4">
                    <Pressable onPress={() => router.back()} className="bg-white/10 p-2 rounded-full active:bg-white/20">
                        <MaterialIcons name="arrow-back" size={22} color="#FFFFFF" />
                    </Pressable>
                    <View className="bg-indigo-800/80 px-3 py-1 rounded-full border border-indigo-700/50">
                        <Text className="text-indigo-200 text-xs font-bold uppercase tracking-wider">COA Segment: TRANS (planned)</Text>
                    </View>
                </View>

                <View className="flex-row items-center mb-2">
                    <MaterialIcons name="directions-bus" size={28} color="#C7D2FE" className="mr-2" />
                    <Text className="text-white text-2xl font-bold">Transport Fleet Console</Text>
                </View>
                <Text className="text-indigo-100 text-sm">Vehicle fleet tracking, daily jeepney/tricycle boundary collection, and maintenance logs.</Text>

                <View className="flex-row mt-6 gap-3">
                    <View className="flex-1 bg-indigo-800/60 p-4 rounded-2xl border border-indigo-700/40">
                        <Text className="text-indigo-200 text-xs font-semibold">Preview Collections (sample)</Text>
                        <Text className="text-white text-xl font-bold mt-1">{formatPHP(totalCollections)}</Text>
                    </View>
                    <View className="flex-1 bg-indigo-800/60 p-4 rounded-2xl border border-indigo-700/40">
                        <Text className="text-indigo-200 text-xs font-semibold">Active Fleet</Text>
                        <Text className="text-white text-xl font-bold mt-1">3 / 5 on route</Text>
                    </View>
                </View>
            </View>

            <DemoDataNotice moduleName="Transport Fleet" whatShowsNumbers />

            {/* Vehicle List Header */}
            <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-bold text-gray-900">Cooperative Fleet Vehicles</Text>
                <Text className="text-xs text-gray-500 font-semibold">{vehicles.length} units</Text>
            </View>

            {/* Vehicle Cards */}
            {vehicles.map(item => (
                <View key={item.id} className="bg-white rounded-2xl p-4 mb-3 border border-gray-150 shadow-sm flex-row items-center justify-between">
                    <View className="flex-1 pr-3">
                        <View className="flex-row items-center mb-1">
                            <Text className={`text-xs font-bold px-2 py-0.5 rounded-md mr-2 ${
                                item.status === 'on_route' ? 'bg-emerald-50 text-emerald-700' :
                                item.status === 'maintenance' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                                {item.status.toUpperCase().replace('_', ' ')}
                            </Text>
                            <Text className="text-xs text-gray-400 font-semibold">{item.plateNumber}</Text>
                        </View>
                        <Text className="text-base font-bold text-gray-900">{item.vehicleType}</Text>
                        <Text className="text-xs text-gray-500 font-medium">Driver: {item.assignedDriver}</Text>
                        <Text className="text-sm font-semibold text-indigo-900 mt-1">
                            Boundary: {formatPHP(item.collectedToday)} / {formatPHP(item.dailyBoundary)}
                        </Text>
                    </View>

                    <Pressable
                        onPress={() => handleCollectBoundary(item)}
                        className={`px-4 py-2.5 rounded-xl flex-row items-center ${
                            item.collectedToday < item.dailyBoundary ? 'bg-indigo-900 active:bg-indigo-950' : 'bg-gray-200'
                        }`}
                    >
                        <MaterialIcons name="payments" size={16} color={item.collectedToday < item.dailyBoundary ? '#FFFFFF' : '#94A3B8'} />
                        <Text className={`text-xs font-bold ml-1.5 ${item.collectedToday < item.dailyBoundary ? 'text-white' : 'text-gray-400'}`}>
                            {item.collectedToday < item.dailyBoundary ? 'Collect' : 'Paid'}
                        </Text>
                    </Pressable>
                </View>
            ))}

            {/* Boundary Collection & Fleet Trip History Feed */}
            <View className="mt-8 mb-8">
                <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-lg font-bold text-gray-900">Boundary & Trip History</Text>
                    <Text className="text-xs text-gray-500 font-semibold">{collectionHistory.length} recorded</Text>
                </View>

                <View className="gap-2.5">
                    {collectionHistory.map((item) => (
                        <View key={item.id} className="bg-white p-4 rounded-2xl border border-gray-150 shadow-xs">
                            <View className="flex-row justify-between items-start">
                                <View className="flex-1 mr-2">
                                    <View className="flex-row items-center">
                                        <Text className="text-sm font-bold text-gray-900">{item.plateNumber}</Text>
                                        <Text className="text-xs text-gray-500 ml-1.5 font-medium">({item.vehicleType})</Text>
                                    </View>
                                    <Text className="text-xs text-gray-400 mt-0.5">Driver: {item.driver} • {formatRelative(item.timestamp)}</Text>
                                </View>
                                <Text className="text-sm font-black text-indigo-900">{formatPHP(item.amount)}</Text>
                            </View>
                            <View className="mt-2 pt-2 border-t border-gray-50 flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <MaterialIcons name="person" size={14} color="#64748B" style={{ marginRight: 4 }} />
                                    <Text className="text-[11px] text-gray-500 font-medium">
                                        Collected by: <Text className="font-bold text-gray-800">{item.operator}</Text>
                                    </Text>
                                </View>
                                <View className="bg-indigo-50 px-2 py-0.5 rounded-full">
                                    <Text className="text-[10px] font-bold text-indigo-700">Boundary Settled</Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </ScrollView>
    );
}
