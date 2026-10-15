import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPHP } from '../../../../src/utils/currency';
import { DemoDataNotice } from '../../../../src/components/DemoDataNotice';

import { formatRelative } from '../../../../src/utils/dates';
import { useAuth } from '../../../../src/store/AuthContext';

interface ProductItem {
    id: string;
    name: string;
    category: string;
    unit: string;
    price: number;
    stock: number;
}

interface AgriSaleHistoryItem {
    id: string;
    productName: string;
    unit: string;
    price: number;
    operator: string;
    timestamp: number;
}

const INITIAL_SALES_HISTORY: AgriSaleHistoryItem[] = [
    { id: 'tx-1', productName: 'Complete Fertilizer 14-14-14 (50kg)', unit: 'bag', price: 2150, operator: 'Pedro Storekeeper', timestamp: Date.now() - 1000 * 60 * 45 },
    { id: 'tx-2', productName: 'Hybrid Rice Seeds NSIC Rc222 (20kg)', unit: 'bag', price: 1200, operator: 'Cybergada Master', timestamp: Date.now() - 1000 * 60 * 120 },
    { id: 'tx-3', productName: 'Insecticide Spray 1L', unit: 'bottle', price: 650, operator: 'Pedro Storekeeper', timestamp: Date.now() - 1000 * 60 * 240 },
];

const INITIAL_PRODUCTS: ProductItem[] = [
    { id: '1', name: 'Complete Fertilizer 14-14-14 (50kg)', category: 'Fertilizer', unit: 'bag', price: 2150, stock: 45 },
    { id: '2', name: 'Urea Fertilizer 46-0-0 (50kg)', category: 'Fertilizer', unit: 'bag', price: 1850, stock: 30 },
    { id: '3', name: 'Hybrid Rice Seeds NSIC Rc222 (20kg)', category: 'Seeds', unit: 'bag', price: 1200, stock: 60 },
    { id: '4', name: 'Corn Seeds Yellow Hybrid (18kg)', category: 'Seeds', unit: 'bag', price: 2900, stock: 25 },
    { id: '5', name: 'Insecticide Spray 1L', category: 'Chemicals', unit: 'bottle', price: 650, stock: 80 }
];

// Preview state. Nothing below reaches WatermelonDB, so nothing syncs and no journal entry is
// posted; the seed figures and the counters reset on reload. See src/components/DemoDataNotice.tsx
// and docs/CRUD-PERSISTENCE-AUDIT.md M4 for the wiring this console still needs
// (stock_movements + InventoryJournalService.recordMovement, CoA 1210/5130 are already mapped).
export default function AgriStoreConsoleScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
    const [salesHistory, setSalesHistory] = useState<AgriSaleHistoryItem[]>(INITIAL_SALES_HISTORY);
    const [search, setSearch] = useState('');
    const [salesCount, setSalesCount] = useState(14);
    const [totalRevenue, setTotalRevenue] = useState(48250);

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()));

    const handleRecordSale = (product: ProductItem) => {
        if (product.stock <= 0) {
            Alert.alert('Out of Stock', `${product.name} is currently out of stock.`);
            return;
        }

        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: p.stock - 1 } : p));
        setSalesCount(prev => prev + 1);
        setTotalRevenue(prev => prev + product.price);

        const operatorName = (user?.user_metadata?.full_name as string) || user?.email || 'Active Storekeeper';
        setSalesHistory(prev => [
            {
                id: 'tx-' + Date.now(),
                productName: product.name,
                unit: product.unit,
                price: product.price,
                operator: operatorName,
                timestamp: Date.now(),
            },
            ...prev,
        ]);

        Alert.alert(
            'Preview Only — Nothing Was Saved',
            `This decremented in-memory stock for ${product.name} by 1 ${product.unit}. ` +
                'No sale record was written, no stock movement was journaled, and the figure resets when the page reloads.'
        );
    };

    return (
        <ScrollView className="flex-1 bg-gray-50 p-4">
            {/* Header Banner */}
            <View className="bg-emerald-900 p-6 rounded-3xl mb-6 shadow-md">
                <View className="flex-row items-center justify-between mb-4">
                    <Pressable onPress={() => router.back()} className="bg-white/10 p-2 rounded-full active:bg-white/20">
                        <MaterialIcons name="arrow-back" size={22} color="#FFFFFF" />
                    </Pressable>
                    <View className="bg-emerald-800/80 px-3 py-1 rounded-full border border-emerald-700/50">
                        <Text className="text-emerald-200 text-xs font-bold uppercase tracking-wider">COA Segment: AGRI (planned)</Text>
                    </View>
                </View>

                <View className="flex-row items-center mb-2">
                    <MaterialIcons name="grass" size={28} color="#A7F3D0" className="mr-2" />
                    <Text className="text-white text-2xl font-bold">Agri-Store Console</Text>
                </View>
                <Text className="text-emerald-100 text-sm">Agricultural supplies, fertilizers, member credit purchasing, and stock management.</Text>

                <View className="flex-row mt-6 gap-3">
                    <View className="flex-1 bg-emerald-800/60 p-4 rounded-2xl border border-emerald-700/40">
                        <Text className="text-emerald-200 text-xs font-semibold">Preview Sales (sample)</Text>
                        <Text className="text-white text-xl font-bold mt-1">{formatPHP(totalRevenue)}</Text>
                    </View>
                    <View className="flex-1 bg-emerald-800/60 p-4 rounded-2xl border border-emerald-700/40">
                        <Text className="text-emerald-200 text-xs font-semibold">Preview Transactions</Text>
                        <Text className="text-white text-xl font-bold mt-1">{salesCount} items</Text>
                    </View>
                </View>
            </View>

            <DemoDataNotice moduleName="Agri-Store" whatShowsNumbers />

            {/* Inventory List Header & Search */}
            <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-bold text-gray-900">Inventory Stock</Text>
                <Text className="text-xs text-gray-500 font-semibold">{filteredProducts.length} items listed</Text>
            </View>

            <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-4 py-3 mb-4 shadow-sm">
                <MaterialIcons name="search" size={20} color="#64748B" />
                <TextInput
                    className="flex-1 ml-2 text-sm text-gray-900 font-semibold"
                    placeholder="Search seeds, fertilizer, chemicals..."
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {/* Inventory Table / Cards */}
            {filteredProducts.map(item => (
                <View key={item.id} className="bg-white rounded-2xl p-4 mb-3 border border-gray-150 shadow-sm flex-row items-center justify-between">
                    <View className="flex-1 pr-3">
                        <View className="flex-row items-center mb-1">
                            <Text className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mr-2">{item.category}</Text>
                            <Text className="text-xs text-gray-400 font-medium">Stock: {item.stock} {item.unit}s</Text>
                        </View>
                        <Text className="text-base font-bold text-gray-900">{item.name}</Text>
                        <Text className="text-sm font-semibold text-emerald-800 mt-1">{formatPHP(item.price)} / {item.unit}</Text>
                    </View>

                    <Pressable
                        onPress={() => handleRecordSale(item)}
                        className={`px-4 py-2.5 rounded-xl flex-row items-center ${item.stock > 0 ? 'bg-emerald-800 active:bg-emerald-900' : 'bg-gray-200'}`}
                    >
                        <MaterialIcons name="add-shopping-cart" size={16} color={item.stock > 0 ? '#FFFFFF' : '#94A3B8'} />
                        <Text className={`text-xs font-bold ml-1.5 ${item.stock > 0 ? 'text-white' : 'text-gray-400'}`}>
                            {item.stock > 0 ? 'Sell' : 'Out'}
                        </Text>
                    </Pressable>
                </View>
            ))}

            {/* Sales & Activity History Feed */}
            <View className="mt-8 mb-8">
                <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-lg font-bold text-gray-900">Sales & Activity History</Text>
                    <Text className="text-xs text-gray-500 font-semibold">{salesHistory.length} recorded</Text>
                </View>

                <View className="gap-2.5">
                    {salesHistory.map((item) => (
                        <View key={item.id} className="bg-white p-4 rounded-2xl border border-gray-150 shadow-xs">
                            <View className="flex-row justify-between items-start">
                                <View className="flex-1 mr-2">
                                    <Text className="text-sm font-bold text-gray-900">{item.productName}</Text>
                                    <Text className="text-xs text-gray-400 mt-0.5">{formatRelative(item.timestamp)}</Text>
                                </View>
                                <Text className="text-sm font-black text-emerald-800">{formatPHP(item.price)}</Text>
                            </View>
                            <View className="mt-2 pt-2 border-t border-gray-50 flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <MaterialIcons name="person" size={14} color="#64748B" style={{ marginRight: 4 }} />
                                    <Text className="text-[11px] text-gray-500 font-medium">
                                        Sold by: <Text className="font-bold text-gray-800">{item.operator}</Text>
                                    </Text>
                                </View>
                                <View className="bg-emerald-50 px-2 py-0.5 rounded-full">
                                    <Text className="text-[10px] font-bold text-emerald-700">1 {item.unit}</Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </ScrollView>
    );
}
