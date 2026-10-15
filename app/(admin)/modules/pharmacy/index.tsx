import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPHP } from '../../../../src/utils/currency';
import { DemoDataNotice } from '../../../../src/components/DemoDataNotice';

import { formatRelative } from '../../../../src/utils/dates';
import { useAuth } from '../../../../src/store/AuthContext';

interface MedicineItem {
    id: string;
    genericName: string;
    brandName: string;
    dosage: string;
    price: number;
    stock: number;
    expiryDate: string;
}

interface PharmacyDispenseHistoryItem {
    id: string;
    genericName: string;
    brandName: string;
    dosage: string;
    price: number;
    operator: string;
    timestamp: number;
}

const INITIAL_DISPENSING_HISTORY: PharmacyDispenseHistoryItem[] = [
    { id: 'dp-1', genericName: 'Paracetamol', brandName: 'Biogesic', dosage: '500mg', price: 6.50, operator: 'Ana Cruz, RPh', timestamp: Date.now() - 1000 * 60 * 30 },
    { id: 'dp-2', genericName: 'Amoxicillin', brandName: 'Amoxil', dosage: '500mg', price: 12.00, operator: 'Cybergada Master', timestamp: Date.now() - 1000 * 60 * 95 },
    { id: 'dp-3', genericName: 'Ascorbic Acid + Zinc', brandName: 'Fern-C', dosage: '500mg', price: 11.00, operator: 'Ana Cruz, RPh', timestamp: Date.now() - 1000 * 60 * 180 },
];

const INITIAL_MEDICINES: MedicineItem[] = [
    { id: '1', genericName: 'Paracetamol', brandName: 'Biogesic', dosage: '500mg', price: 6.50, stock: 450, expiryDate: '2027-11-30' },
    { id: '2', genericName: 'Amoxicillin', brandName: 'Amoxil', dosage: '500mg', price: 12.00, stock: 200, expiryDate: '2027-08-15' },
    { id: '3', genericName: 'Mefenamic Acid', brandName: 'Gardan', dosage: '500mg', price: 9.50, stock: 320, expiryDate: '2026-12-31' },
    { id: '4', genericName: 'Losartan Potassium', brandName: 'Cozaar', dosage: '50mg', price: 18.00, stock: 180, expiryDate: '2028-02-28' },
    { id: '5', genericName: 'Ascorbic Acid + Zinc', brandName: 'Fern-C', dosage: '500mg', price: 11.00, stock: 500, expiryDate: '2028-05-20' }
];

export default function PharmacyConsoleScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [medicines, setMedicines] = useState<MedicineItem[]>(INITIAL_MEDICINES);
    const [dispensingHistory, setDispensingHistory] = useState<PharmacyDispenseHistoryItem[]>(INITIAL_DISPENSING_HISTORY);
    const [search, setSearch] = useState('');
    const [dispensedCount, setDispensedCount] = useState(38);
    const [totalRevenue, setTotalRevenue] = useState(6450);

    const filteredMedicines = medicines.filter(m => 
        m.genericName.toLowerCase().includes(search.toLowerCase()) || 
        m.brandName.toLowerCase().includes(search.toLowerCase())
    );

    const handleDispense = (item: MedicineItem) => {
        if (item.stock <= 0) {
            Alert.alert('Out of Stock', `${item.genericName} is out of stock.`);
            return;
        }

        setMedicines(prev => prev.map(m => m.id === item.id ? { ...m, stock: m.stock - 1 } : m));
        setDispensedCount(prev => prev + 1);
        setTotalRevenue(prev => prev + item.price);

        const operatorName = (user?.user_metadata?.full_name as string) || user?.email || 'Coop Pharmacist';
        setDispensingHistory(prev => [
            {
                id: 'dp-' + Date.now(),
                genericName: item.genericName,
                brandName: item.brandName,
                dosage: item.dosage,
                price: item.price,
                operator: operatorName,
                timestamp: Date.now(),
            },
            ...prev,
        ]);

        Alert.alert(
            'Preview Only — Nothing Was Saved',
            `This decremented in-memory stock for ${item.genericName} (${item.brandName}) by 1 pc. ` +
                'No dispensing record was written and the figure resets when the page reloads.'
        );
    };

    return (
        <ScrollView className="flex-1 bg-gray-50 p-4">
            {/* Header Banner */}
            <View className="bg-teal-900 p-6 rounded-3xl mb-6 shadow-md">
                <View className="flex-row items-center justify-between mb-4">
                    <Pressable onPress={() => router.back()} className="bg-white/10 p-2 rounded-full active:bg-white/20">
                        <MaterialIcons name="arrow-back" size={22} color="#FFFFFF" />
                    </Pressable>
                    <View className="bg-teal-800/80 px-3 py-1 rounded-full border border-teal-700/50">
                        <Text className="text-teal-200 text-xs font-bold uppercase tracking-wider">COA Segment: PHARM (planned)</Text>
                    </View>
                </View>

                <View className="flex-row items-center mb-2">
                    <MaterialIcons name="medical-services" size={28} color="#99F6E4" className="mr-2" />
                    <Text className="text-white text-2xl font-bold">Coop Pharmacy Console</Text>
                </View>
                <Text className="text-teal-100 text-sm">Medicine dispensing, inventory expiry tracking, and member senior/PWD discounts.</Text>

                <View className="flex-row mt-6 gap-3">
                    <View className="flex-1 bg-teal-800/60 p-4 rounded-2xl border border-teal-700/40">
                        <Text className="text-teal-200 text-xs font-semibold">Preview Sales (sample)</Text>
                        <Text className="text-white text-xl font-bold mt-1">{formatPHP(totalRevenue)}</Text>
                    </View>
                    <View className="flex-1 bg-teal-800/60 p-4 rounded-2xl border border-teal-700/40">
                        <Text className="text-teal-200 text-xs font-semibold">Preview Dispensed</Text>
                        <Text className="text-white text-xl font-bold mt-1">{dispensedCount} units</Text>
                    </View>
                </View>
            </View>

            <DemoDataNotice moduleName="Coop Pharmacy" whatShowsNumbers />

            {/* Inventory List Header & Search */}
            <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-bold text-gray-900">Medicine Inventory</Text>
                <Text className="text-xs text-gray-500 font-semibold">{filteredMedicines.length} items listed</Text>
            </View>

            <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-4 py-3 mb-4 shadow-sm">
                <MaterialIcons name="search" size={20} color="#64748B" />
                <TextInput
                    className="flex-1 ml-2 text-sm text-gray-900 font-semibold"
                    placeholder="Search generic or brand name..."
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {/* Medicine Items */}
            {filteredMedicines.map(item => (
                <View key={item.id} className="bg-white rounded-2xl p-4 mb-3 border border-gray-150 shadow-sm flex-row items-center justify-between">
                    <View className="flex-1 pr-3">
                        <View className="flex-row items-center mb-1">
                            <Text className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md mr-2">{item.dosage}</Text>
                            <Text className="text-xs text-gray-400 font-medium">Exp: {item.expiryDate}</Text>
                        </View>
                        <Text className="text-base font-bold text-gray-900">{item.genericName}</Text>
                        <Text className="text-xs text-gray-500 font-medium">Brand: {item.brandName} • Stock: {item.stock}</Text>
                        <Text className="text-sm font-semibold text-teal-800 mt-1">{formatPHP(item.price)} / pc</Text>
                    </View>

                    <Pressable
                        onPress={() => handleDispense(item)}
                        className={`px-4 py-2.5 rounded-xl flex-row items-center ${item.stock > 0 ? 'bg-teal-800 active:bg-teal-900' : 'bg-gray-200'}`}
                    >
                        <MaterialIcons name="medication" size={16} color={item.stock > 0 ? '#FFFFFF' : '#94A3B8'} />
                        <Text className={`text-xs font-bold ml-1.5 ${item.stock > 0 ? 'text-white' : 'text-gray-400'}`}>
                            Dispense
                        </Text>
                    </Pressable>
                </View>
            ))}

            {/* Dispensing & Prescription History Feed */}
            <View className="mt-8 mb-8">
                <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-lg font-bold text-gray-900">Dispensing & Prescription History</Text>
                    <Text className="text-xs text-gray-500 font-semibold">{dispensingHistory.length} recorded</Text>
                </View>

                <View className="gap-2.5">
                    {dispensingHistory.map((item) => (
                        <View key={item.id} className="bg-white p-4 rounded-2xl border border-gray-150 shadow-xs">
                            <View className="flex-row justify-between items-start">
                                <View className="flex-1 mr-2">
                                    <View className="flex-row items-center">
                                        <Text className="text-sm font-bold text-gray-900">{item.genericName}</Text>
                                        <Text className="text-xs text-gray-500 ml-1.5 font-medium">({item.brandName})</Text>
                                    </View>
                                    <Text className="text-xs text-gray-400 mt-0.5">{formatRelative(item.timestamp)}</Text>
                                </View>
                                <Text className="text-sm font-black text-teal-800">{formatPHP(item.price)}</Text>
                            </View>
                            <View className="mt-2 pt-2 border-t border-gray-50 flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <MaterialIcons name="person" size={14} color="#64748B" style={{ marginRight: 4 }} />
                                    <Text className="text-[11px] text-gray-500 font-medium">
                                        Dispensed by: <Text className="font-bold text-gray-800">{item.operator}</Text>
                                    </Text>
                                </View>
                                <View className="bg-teal-50 px-2 py-0.5 rounded-full">
                                    <Text className="text-[10px] font-bold text-teal-700">{item.dosage}</Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </ScrollView>
    );
}
