import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import MarketplaceStoreService from '../../../src/services/MarketplaceStoreService';
import MarketplaceProductService from '../../../src/services/MarketplaceProductService';
import MarketplaceStore from '../../../src/database/models/MarketplaceStore';
import MarketplaceProduct from '../../../src/database/models/MarketplaceProduct';
import { ModuleQuickGuide } from '../../../src/components/ModuleQuickGuide';
import { SampleDataService } from '../../../src/services/SampleDataService';
import { database } from '../../../src/database';

export default function AdminMarketplaceManagementScreen() {
    const [pendingStores, setPendingStores] = useState<MarketplaceStore[]>([]);
    const [pendingProducts, setPendingProducts] = useState<MarketplaceProduct[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const loadAdminQueues = async () => {
        setRefreshing(true);
        try {
            const stores = await MarketplaceStoreService.fetchPendingStores();
            const prods = await MarketplaceProductService.fetchPendingProducts();
            setPendingStores(stores);
            setPendingProducts(prods);
        } catch (err) {
            console.error('[AdminMarketplace] Error loading queues:', err);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadAdminQueues();
    }, []);

    const handleApproveStore = async (storeId: string) => {
        try {
            await MarketplaceStoreService.updateStoreStatus(storeId, 'active', 'ADMIN');
            Alert.alert('Store Approved', 'The store application has been approved and is now active!');
            loadAdminQueues();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to approve store');
        }
    };

    const handleApproveProduct = async (productId: string) => {
        try {
            await MarketplaceProductService.updateProductStatus(productId, 'active', 'ADMIN');
            Alert.alert('Product Approved', 'The product listing is now active on the marketplace!');
            loadAdminQueues();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to approve product');
        }
    };

    return (
        <ScrollView
            className="flex-1 bg-slate-50 p-4"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAdminQueues} />}
        >
            <View className="mb-4 mt-2">
                <Text className="text-2xl font-bold text-slate-900">POS Cursor Marketplace Operator Console</Text>
                <Text className="text-xs text-slate-500">Manage seller applications, product compliance, and commissions</Text>
            </View>

            {/* Marketplace Quick Guide */}
            <ModuleQuickGuide
                moduleTitle="🏪 Marketplace & Retail POS Guide"
                description="Product catalog, inventory stock, POS registers, and audited sales returns"
                icon="storefront"
                badgeColor="bg-blue-900"
                showDemoDataButton={pendingStores.length === 0 && pendingProducts.length === 0}
                onLoadDemoData={async () => {
                    try {
                        await SampleDataService.enable(database);
                        Alert.alert('Demo Data Loaded', 'Sample stores, agricultural products, stock movements, and sales returns have been populated.');
                        loadAdminQueues();
                    } catch (e: any) {
                        Alert.alert('Error', e.message || 'Failed to load demo data');
                    }
                }}
                steps={[
                    { title: '1. Stores & Categories', desc: 'Approve vendor store applications and organize catalogs by product categories.' },
                    { title: '2. Inventory & Warehouses', desc: 'Track stock balances, purchase receipts, and automatic deduction upon POS sale.' },
                    { title: '3. Touch POS Terminal', desc: 'Ring up retail items, apply member discounts, accept cash, and issue official receipts in ₱ PHP.' },
                    { title: '4. Audited Sales Returns (3 Steps)', desc: 'Draft reason & items -> Supervisor Approval -> Restock good items or log damaged to waste -> Customer refund.' },
                ]}
            />

            {/* Platform Financial Overview */}
            <View className="bg-blue-900 rounded-2xl p-4 mb-4 shadow-sm">
                <Text className="text-xs text-blue-200 uppercase font-semibold tracking-wider mb-1">
                    Platform Revenue & GMV
                </Text>
                <View className="flex-row justify-between items-baseline mt-1">
                    <View>
                        <Text className="text-2xl font-bold text-white">₱125,450.00</Text>
                        <Text className="text-xs text-blue-300">Total Monthly GMV</Text>
                    </View>

                    <View className="items-end">
                        <Text className="text-lg font-bold text-emerald-400">₱4,390.75</Text>
                        <Text className="text-xs text-blue-300">Coop Revenue (3.5% Fee)</Text>
                    </View>
                </View>
            </View>

            {/* Pending Seller Applications */}
            <View className="mb-4">
                <Text className="text-sm font-bold text-slate-800 mb-2">
                    Pending Store Vetting ({pendingStores.length})
                </Text>

                {pendingStores.length === 0 ? (
                    <View className="bg-white rounded-xl p-4 border border-slate-100 items-center">
                        <Text className="text-xs text-slate-500">No pending seller applications</Text>
                    </View>
                ) : (
                    pendingStores.map(store => (
                        <View key={store.id} className="bg-white rounded-xl p-4 border border-slate-100 mb-3 flex-row items-center justify-between">
                            <View className="flex-1 mr-3">
                                <Text className="text-sm font-bold text-slate-900">{store.name}</Text>
                                <Text className="text-xs text-blue-600 font-semibold">{store.category || 'General'}</Text>
                                <Text className="text-xs text-slate-500 mt-1" numberOfLines={1}>{store.description}</Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => handleApproveStore(store.id)}
                                className="bg-emerald-600 px-3 py-2 rounded-lg active:opacity-80"
                            >
                                <Text className="text-white text-xs font-bold">Approve</Text>
                            </TouchableOpacity>
                        </View>
                    ))
                )}
            </View>

            {/* Pending Product Compliance */}
            <View className="mb-4">
                <Text className="text-sm font-bold text-slate-800 mb-2">
                    Product Compliance Queue ({pendingProducts.length})
                </Text>

                {pendingProducts.length === 0 ? (
                    <View className="bg-white rounded-xl p-4 border border-slate-100 items-center">
                        <Text className="text-xs text-slate-500">No pending product approvals</Text>
                    </View>
                ) : (
                    pendingProducts.map(prod => (
                        <View key={prod.id} className="bg-white rounded-xl p-4 border border-slate-100 mb-3 flex-row items-center justify-between">
                            <View className="flex-1 mr-3">
                                <Text className="text-sm font-bold text-slate-900">{prod.title}</Text>
                                <Text className="text-xs text-emerald-600 font-bold">₱{prod.price.toFixed(2)}</Text>
                                <Text className="text-xs text-slate-500 mt-0.5">Stock: {prod.stockQuantity} units</Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => handleApproveProduct(prod.id)}
                                className="bg-blue-600 px-3 py-2 rounded-lg active:opacity-80"
                            >
                                <Text className="text-white text-xs font-bold">Approve Live</Text>
                            </TouchableOpacity>
                        </View>
                    ))
                )}
            </View>
        </ScrollView>
    );
}
