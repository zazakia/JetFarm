import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Alert,
    RefreshControl,
    Modal,
    TextInput,
} from 'react-native';
import AccountHealthCard from '../../../src/components/marketplace/AccountHealthCard';
import MarketplaceStoreService from '../../../src/services/MarketplaceStoreService';
import MarketplaceProductService from '../../../src/services/MarketplaceProductService';
import MarketplaceOrderService from '../../../src/services/MarketplaceOrderService';
import MarketplacePayoutService, { PayoutSummary } from '../../../src/services/MarketplacePayoutService';
import MarketplaceStore from '../../../src/database/models/MarketplaceStore';
import MarketplaceProduct from '../../../src/database/models/MarketplaceProduct';
import MarketplaceSubOrder from '../../../src/database/models/MarketplaceSubOrder';

type TabType = 'overview' | 'products' | 'orders' | 'payouts';

export default function SellerCenterScreen() {
    const [store, setStore] = useState<MarketplaceStore | null>(null);
    const [payoutSummary, setPayoutSummary] = useState<PayoutSummary | null>(null);
    const [products, setProducts] = useState<MarketplaceProduct[]>([]);
    const [subOrders, setSubOrders] = useState<MarketplaceSubOrder[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [loading, setLoading] = useState(true);

    // Modal state for Add Product
    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newPrice, setNewPrice] = useState('');
    const [newStock, setNewStock] = useState('10');
    const [newCategory, setNewCategory] = useState('Agriculture & Fresh Produce');
    const [newDescription, setNewDescription] = useState('');

    const loadSellerData = async () => {
        setLoading(true);
        try {
            const stores = await MarketplaceStoreService.fetchActiveStores();
            if (stores.length > 0) {
                const activeStore = stores[0];
                setStore(activeStore);
                
                const [summary, storeProds, storeOrders] = await Promise.all([
                    MarketplacePayoutService.getStorePayoutSummary(activeStore.id),
                    MarketplaceProductService.fetchStoreProducts(activeStore.id),
                    MarketplaceOrderService.fetchStoreSubOrders(activeStore.id),
                ]);
                setPayoutSummary(summary);
                setProducts(storeProds);
                setSubOrders(storeOrders);
            }
        } catch (err) {
            console.error('[SellerCenter] Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSellerData();
    }, []);

    const handleApplyStore = async () => {
        try {
            const newStore = await MarketplaceStoreService.createStore({
                borrowerId: 'MEMBER-DEMO-001',
                name: 'Agri-Coop Fresh Store',
                description: 'Fresh organic produce directly from cooperative farmers',
                category: 'Agriculture & Fresh Produce',
            });
            Alert.alert('Application Submitted', 'Your POS Cursor store application has been submitted for Coop Admin review!');
            setStore(newStore);
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to submit application');
        }
    };

    const handleCashAdvanceDraw = () => {
        if (!payoutSummary || payoutSummary.eligibleCashAdvanceAmount <= 0) {
            Alert.alert('Cash Advance', 'No pending payouts available for cash advance draw at this time.');
            return;
        }
        Alert.alert(
            'POS Cursor Coop Micro-Loan Advance',
            `You are eligible for a cash advance of ₱${payoutSummary.eligibleCashAdvanceAmount.toFixed(2)} against your pending payout. Would you like to proceed?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Draw Advance',
                    onPress: () => Alert.alert('Success', 'Cash advance credited to your POS Cursor Savings Wallet!')
                }
            ]
        );
    };

    const handleAddProduct = async () => {
        if (!store) return;
        const priceNum = parseFloat(newPrice);
        const stockNum = parseInt(newStock, 10);

        if (!newTitle.trim() || isNaN(priceNum) || priceNum <= 0) {
            Alert.alert('Invalid Input', 'Please provide a valid product title and positive price.');
            return;
        }

        try {
            await MarketplaceProductService.createProduct({
                storeId: store.id,
                title: newTitle.trim(),
                price: priceNum,
                stockQuantity: isNaN(stockNum) ? 10 : stockNum,
                description: newDescription.trim() || undefined,
            });

            Alert.alert('Success', 'Product submitted for compliance review!');
            setShowAddProductModal(false);
            setNewTitle('');
            setNewPrice('');
            setNewStock('10');
            setNewDescription('');
            loadSellerData();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to create product');
        }
    };

    const handleAdvanceFulfillment = async (subOrderId: string, currentStatus: string) => {
        const nextStatusMap: Record<string, 'processing' | 'ready_for_pickup' | 'shipped' | 'completed'> = {
            'pending': 'processing',
            'processing': 'ready_for_pickup',
            'ready_for_pickup': 'shipped',
            'shipped': 'completed',
        };
        const nextStatus = nextStatusMap[currentStatus] || 'completed';

        try {
            await MarketplaceOrderService.updateFulfillmentStatus(subOrderId, nextStatus);
            Alert.alert('Status Updated', `Sub-order status updated to ${nextStatus.toUpperCase()}`);
            loadSellerData();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to update status');
        }
    };

    const handleRequestPayout = async () => {
        if (!store || !payoutSummary || payoutSummary.netAmount <= 0) {
            Alert.alert('Payout Unavailable', 'You do not have completed orders ready for payout.');
            return;
        }

        try {
            const payout = await MarketplacePayoutService.processPayout(store.id, 'savings_wallet');
            Alert.alert(
                'Payout Processed',
                `Net payout of ₱${payout.netAmount.toFixed(2)} has been deposited into your POS Cursor Savings Wallet! (Ref: ${payout.payoutNumber})`
            );
            loadSellerData();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to process payout');
        }
    };

    return (
        <ScrollView
            className="flex-1 bg-slate-50 p-4"
            refreshControl={<RefreshControl refreshing={loading} onRefresh={loadSellerData} />}
        >
            {/* Header */}
            <View className="mb-4 mt-2">
                <Text className="text-2xl font-bold text-slate-900">POS Cursor Seller Center</Text>
                <Text className="text-xs text-slate-500">Cooperative Member-Merchant Hub</Text>
            </View>

            {!store ? (
                <View className="bg-white rounded-2xl p-6 border border-slate-100 items-center">
                    <Text className="text-lg font-bold text-slate-800 mb-2">Open Your Member Store</Text>
                    <Text className="text-xs text-slate-500 text-center mb-4">
                        Sell your products or services directly to fellow POS Cursor cooperative members. Integrated with your POS Cursor Savings Wallet and accounting.
                    </Text>
                    <TouchableOpacity
                        onPress={handleApplyStore}
                        className="bg-emerald-600 px-5 py-3 rounded-xl active:opacity-80 w-full items-center"
                    >
                        <Text className="text-white font-bold text-sm">Apply for Store Registration</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    {/* Store Status Header */}
                    <View className="bg-white rounded-2xl p-4 border border-slate-100 mb-4 flex-row items-center justify-between">
                        <View>
                            <Text className="text-lg font-bold text-slate-900">{store.name}</Text>
                            <Text className="text-xs text-blue-600 font-semibold mt-0.5">{store.category || 'General Store'}</Text>
                        </View>

                        <View className={`px-3 py-1 rounded-full ${store.status === 'active' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                            <Text className={`text-xs font-bold ${store.status === 'active' ? 'text-emerald-800' : 'text-amber-800'}`}>
                                {store.status.toUpperCase()}
                            </Text>
                        </View>
                    </View>

                    {/* Navigation Tabs */}
                    <View className="flex-row bg-slate-200 p-1 rounded-xl mb-4">
                        {(['overview', 'products', 'orders', 'payouts'] as TabType[]).map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => setActiveTab(tab)}
                                className={`flex-1 py-2 items-center rounded-lg ${activeTab === tab ? 'bg-white shadow-sm' : ''}`}
                            >
                                <Text className={`text-xs font-bold capitalize ${activeTab === tab ? 'text-blue-700' : 'text-slate-600'}`}>
                                    {tab}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Tab 1: Overview */}
                    {activeTab === 'overview' && (
                        <>
                            {/* Financial & Payout Summary */}
                            <View className="bg-white rounded-2xl p-4 border border-slate-100 mb-4">
                                <Text className="text-sm font-bold text-slate-800 mb-3">Pending Sales & Payouts</Text>

                                <View className="flex-row justify-between items-center mb-3">
                                    <View>
                                        <Text className="text-xs text-slate-500">Gross Pending Sales</Text>
                                        <Text className="text-lg font-bold text-slate-900">
                                            ₱{(payoutSummary?.grossSales || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                        </Text>
                                    </View>

                                    <View className="items-end">
                                        <Text className="text-xs text-slate-500">Net Wallet Payout</Text>
                                        <Text className="text-lg font-bold text-emerald-600">
                                            ₱{(payoutSummary?.netAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                        </Text>
                                    </View>
                                </View>

                                {/* Cash Advance Action Banner */}
                                <TouchableOpacity
                                    onPress={handleCashAdvanceDraw}
                                    className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex-row items-center justify-between mt-1 active:opacity-80"
                                >
                                    <View className="flex-1 mr-2">
                                        <Text className="text-xs font-bold text-blue-900">Cash Advance against Pending Payout</Text>
                                        <Text className="text-xs text-blue-700">
                                            Available: ₱{(payoutSummary?.eligibleCashAdvanceAmount || 0).toFixed(2)} (POS Cursor Micro-Loan)
                                        </Text>
                                    </View>
                                    <View className="bg-blue-600 px-2.5 py-1.5 rounded-lg">
                                        <Text className="text-white text-xs font-bold">Draw Now</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>

                            {/* Account Health Score */}
                            <AccountHealthCard />
                        </>
                    )}

                    {/* Tab 2: Products */}
                    {activeTab === 'products' && (
                        <View className="mb-4">
                            <View className="flex-row justify-between items-center mb-3">
                                <Text className="text-sm font-bold text-slate-800">My Listings ({products.length})</Text>
                                <TouchableOpacity
                                    onPress={() => setShowAddProductModal(true)}
                                    className="bg-emerald-600 px-3 py-1.5 rounded-lg active:opacity-80"
                                >
                                    <Text className="text-white text-xs font-bold">+ Add Product</Text>
                                </TouchableOpacity>
                            </View>

                            {products.length === 0 ? (
                                <View className="bg-white rounded-2xl p-6 items-center border border-slate-100">
                                    <Text className="text-xs text-slate-500 text-center">
                                        No products listed yet. Click "+ Add Product" to list your first item on the POS Cursor Marketplace!
                                    </Text>
                                </View>
                            ) : (
                                products.map(prod => (
                                    <View key={prod.id} className="bg-white rounded-xl p-3 border border-slate-100 mb-2 flex-row justify-between items-center">
                                        <View className="flex-1 mr-2">
                                            <Text className="text-sm font-bold text-slate-900">{prod.title}</Text>
                                            <Text className="text-xs text-slate-500">Stock: {prod.stockQuantity} | Price: ₱{prod.price.toFixed(2)}</Text>
                                        </View>
                                        <View className={`px-2 py-1 rounded-md ${prod.status === 'active' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                                            <Text className={`text-xs font-bold ${prod.status === 'active' ? 'text-emerald-800' : 'text-amber-800'}`}>
                                                {prod.status.toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    )}

                    {/* Tab 3: Orders */}
                    {activeTab === 'orders' && (
                        <View className="mb-4">
                            <Text className="text-sm font-bold text-slate-800 mb-3">Customer Sub-Orders ({subOrders.length})</Text>

                            {subOrders.length === 0 ? (
                                <View className="bg-white rounded-2xl p-6 items-center border border-slate-100">
                                    <Text className="text-xs text-slate-500 text-center">
                                        No sub-orders received yet.
                                    </Text>
                                </View>
                            ) : (
                                subOrders.map(so => (
                                    <View key={so.id} className="bg-white rounded-xl p-4 border border-slate-100 mb-3">
                                        <View className="flex-row justify-between items-center mb-1">
                                            <Text className="text-sm font-bold text-blue-700">Sub-Order #{so.subOrderNumber}</Text>
                                            <Text className="text-xs font-bold text-slate-700 uppercase">{so.fulfillmentStatus}</Text>
                                        </View>
                                        <Text className="text-xs text-slate-500 mb-2">Subtotal: ₱{so.subtotal.toFixed(2)} | Net Payout: ₱{so.netPayout.toFixed(2)}</Text>

                                        {so.fulfillmentStatus !== 'completed' && (
                                            <TouchableOpacity
                                                onPress={() => handleAdvanceFulfillment(so.id, so.fulfillmentStatus)}
                                                className="bg-blue-600 py-2 rounded-lg items-center mt-1 active:opacity-80"
                                            >
                                                <Text className="text-white text-xs font-bold">Advance Fulfillment Status</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))
                            )}
                        </View>
                    )}

                    {/* Tab 4: Payouts */}
                    {activeTab === 'payouts' && (
                        <View className="bg-white rounded-2xl p-4 border border-slate-100 mb-4">
                            <Text className="text-sm font-bold text-slate-800 mb-3">Earnings & Wallet Transfers</Text>

                            <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
                                <Text className="text-xs text-emerald-800 font-semibold">Available for Payout</Text>
                                <Text className="text-2xl font-bold text-emerald-900 mt-1">
                                    ₱{(payoutSummary?.netAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                </Text>
                                <Text className="text-xs text-emerald-700 mt-1">
                                    Includes completed sub-orders minus 3.5% POS Cursor Coop commission.
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={handleRequestPayout}
                                className="bg-emerald-600 py-3 rounded-xl items-center active:opacity-80"
                            >
                                <Text className="text-white font-bold text-sm">Transfer Payout to POS Cursor Savings Wallet</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Modal: Add New Product */}
                    <Modal visible={showAddProductModal} animationType="slide" transparent>
                        <View className="flex-1 bg-black/50 justify-end">
                            <View className="bg-white rounded-t-3xl p-5 border-t border-slate-200">
                                <Text className="text-lg font-bold text-slate-900 mb-4">Add Product to POS Cursor Store</Text>

                                <Text className="text-xs font-bold text-slate-700 mb-1">Product Title</Text>
                                <TextInput
                                    value={newTitle}
                                    onChangeText={setNewTitle}
                                    placeholder="e.g. Organic Tablea 250g"
                                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm mb-3 text-gray-900"
                                 placeholderTextColor="#9CA3AF"/>

                                <View className="flex-row space-x-2 mb-3">
                                    <View className="flex-1">
                                        <Text className="text-xs font-bold text-slate-700 mb-1">Price (₱)</Text>
                                        <TextInput
                                            value={newPrice}
                                            onChangeText={setNewPrice}
                                            keyboardType="numeric"
                                            placeholder="150.00"
                                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                                         placeholderTextColor="#9CA3AF"/>
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-xs font-bold text-slate-700 mb-1">Stock Quantity</Text>
                                        <TextInput
                                            value={newStock}
                                            onChangeText={setNewStock}
                                            keyboardType="numeric"
                                            placeholder="10"
                                            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-gray-900"
                                         placeholderTextColor="#9CA3AF"/>
                                    </View>
                                </View>

                                <Text className="text-xs font-bold text-slate-700 mb-1">Description</Text>
                                <TextInput
                                    value={newDescription}
                                    onChangeText={setNewDescription}
                                    multiline
                                    numberOfLines={3}
                                    placeholder="Describe your handcrafted product or fresh produce..."
                                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm mb-4 text-gray-900"
                                 placeholderTextColor="#9CA3AF"/>

                                <View className="flex-row space-x-2">
                                    <TouchableOpacity
                                        onPress={() => setShowAddProductModal(false)}
                                        className="flex-1 bg-slate-200 py-3 rounded-xl items-center"
                                    >
                                        <Text className="text-slate-800 font-bold text-sm">Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleAddProduct}
                                        className="flex-1 bg-emerald-600 py-3 rounded-xl items-center"
                                    >
                                        <Text className="text-white font-bold text-sm">Submit Listing</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>
                </>
            )}
        </ScrollView>
    );
}
