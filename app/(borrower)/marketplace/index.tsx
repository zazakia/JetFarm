import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    TextInput,
    Alert,
    Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import ProductCard from '../../../src/components/marketplace/ProductCard';
import MultiSellerCartSummary, { CartStoreGroup } from '../../../src/components/marketplace/MultiSellerCartSummary';
import MarketplaceProductService from '../../../src/services/MarketplaceProductService';
import MarketplaceStoreService from '../../../src/services/MarketplaceStoreService';
import MarketplaceOrderService, { CartLineItem } from '../../../src/services/MarketplaceOrderService';
import MarketplaceProduct from '../../../src/database/models/MarketplaceProduct';
import MarketplaceStore from '../../../src/database/models/MarketplaceStore';
import MarketplaceOrder from '../../../src/database/models/MarketplaceOrder';

const CATEGORIES = [
    'All',
    'Agriculture',
    'Handicrafts',
    'Food & Beverage',
    'Services',
    'Apparel',
];

export default function BuyerMarketplaceScreen() {
    const router = useRouter();
    const [products, setProducts] = useState<MarketplaceProduct[]>([]);
    const [stores, setStores] = useState<MarketplaceStore[]>([]);
    const [buyerOrders, setBuyerOrders] = useState<MarketplaceOrder[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [refreshing, setRefreshing] = useState(false);

    // Cart state
    const [cartItems, setCartItems] = useState<(CartLineItem & { title: string })[]>([]);
    const [showCartModal, setShowCartModal] = useState(false);
    const [showOrdersModal, setShowOrdersModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'cash_on_delivery' | 'payroll_deduction'>('wallet');

    const loadData = async () => {
        setRefreshing(true);
        try {
            await MarketplaceProductService.seedDefaultCategories();
            const [activeProds, activeStores, orders] = await Promise.all([
                MarketplaceProductService.fetchActiveProducts(),
                MarketplaceStoreService.fetchActiveStores(),
                MarketplaceOrderService.fetchBuyerOrders('MEMBER-DEMO-001'),
            ]);
            setProducts(activeProds);
            setStores(activeStores);
            setBuyerOrders(orders);
        } catch (err) {
            console.error('[Marketplace] Error loading data:', err);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const addToCart = (product: MarketplaceProduct) => {
        const existingIdx = cartItems.findIndex(item => item.productId === product.id);
        if (existingIdx >= 0) {
            const updated = [...cartItems];
            updated[existingIdx].quantity += 1;
            setCartItems(updated);
        } else {
            setCartItems([
                ...cartItems,
                {
                    productId: product.id,
                    storeId: product.storeId,
                    title: product.title,
                    quantity: 1,
                    unitPrice: product.price,
                },
            ]);
        }
        Alert.alert('Added to Cart', `${product.title} has been added to your cart.`);
    };

    const handleCheckout = async () => {
        if (cartItems.length === 0) {
            Alert.alert('Empty Cart', 'Please add products to your cart before checking out.');
            return;
        }

        try {
            const checkoutResult = await MarketplaceOrderService.checkout({
                buyerId: 'MEMBER-DEMO-001',
                items: cartItems.map(i => ({
                    productId: i.productId,
                    storeId: i.storeId,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                })),
                paymentMethod,
            });

            Alert.alert(
                'Order Placed!',
                `Thank you! Order #${checkoutResult.order.orderNumber} placed across ${checkoutResult.subOrders.length} seller store(s).`
            );
            setCartItems([]);
            setShowCartModal(false);
            loadData();
        } catch (err: any) {
            Alert.alert('Checkout Failed', err.message || 'Unable to complete checkout');
        }
    };

    const filteredProducts = products.filter(p => {
        const matchesQuery = p.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || p.productType?.toLowerCase().includes(selectedCategory.toLowerCase());
        return matchesQuery && matchesCategory;
    });

    // Build Cart Store Groups for display
    const storeMap = new Map<string, string>();
    stores.forEach(s => storeMap.set(s.id, s.name));

    const cartGroupsMap = new Map<string, CartStoreGroup>();
    cartItems.forEach(item => {
        const storeName = storeMap.get(item.storeId) || 'Member Store';
        if (!cartGroupsMap.has(item.storeId)) {
            cartGroupsMap.set(item.storeId, {
                storeId: item.storeId,
                storeName,
                items: [],
            });
        }
        cartGroupsMap.get(item.storeId)!.items.push({
            title: item.title,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
        });
    });

    const cartGroups = Array.from(cartGroupsMap.values());
    const totalCartCount = cartItems.reduce((acc, i) => acc + i.quantity, 0);

    return (
        <ScrollView
            className="flex-1 bg-slate-50 p-4"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
        >
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4 mt-2">
                <View className="flex-1 mr-2">
                    <Text className="text-2xl font-bold text-slate-900">POS Cursor Coop Marketplace</Text>
                    <Text className="text-xs text-slate-500">Shop quality goods directly from fellow POS Cursor members</Text>
                </View>

                <View className="flex-row space-x-2">
                    <TouchableOpacity
                        onPress={() => setShowCartModal(true)}
                        className="bg-emerald-600 px-3 py-2 rounded-xl flex-row items-center active:opacity-80 relative"
                    >
                        <Text className="text-white text-xs font-bold">Cart ({totalCartCount})</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.push('/(borrower)/seller-center/' as any)}
                        className="bg-blue-600 px-3 py-2 rounded-xl active:opacity-80"
                    >
                        <Text className="text-white text-xs font-bold">Seller Portal</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* My Orders Button Banner */}
            {buyerOrders.length > 0 && (
                <TouchableOpacity
                    onPress={() => setShowOrdersModal(true)}
                    className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex-row items-center justify-between active:opacity-80"
                >
                    <View>
                        <Text className="text-xs font-bold text-blue-900">My Orders ({buyerOrders.length})</Text>
                        <Text className="text-xs text-blue-700">Track fulfillment status across seller stores</Text>
                    </View>
                    <View className="bg-blue-600 px-2.5 py-1 rounded-lg">
                        <Text className="text-white text-xs font-bold">View Orders</Text>
                    </View>
                </TouchableOpacity>
            )}

            {/* Search Bar */}
            <View className="bg-white rounded-xl border border-slate-200 px-3 py-2 mb-3">
                <TextInput
                    placeholder="Search products, services, stores..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    className="text-sm text-slate-800"
                 placeholderTextColor="#9CA3AF"/>
            </View>

            {/* Category Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {CATEGORIES.map(cat => (
                    <TouchableOpacity
                        key={cat}
                        onPress={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-full mr-2 ${selectedCategory === cat ? 'bg-emerald-600' : 'bg-white border border-slate-200'}`}
                    >
                        <Text className={`text-xs font-bold ${selectedCategory === cat ? 'text-white' : 'text-slate-700'}`}>
                            {cat}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Featured Store Showcase */}
            {stores.length > 0 && (
                <View className="mb-4">
                    <Text className="text-sm font-bold text-slate-800 mb-2">Featured POS Cursor Member Stores</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {stores.map(store => (
                            <View key={store.id} className="bg-white rounded-xl p-3 border border-slate-100 mr-3 w-36 items-center">
                                <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mb-1">
                                    <Text className="text-blue-700 font-bold text-base">{store.name.charAt(0)}</Text>
                                </View>
                                <Text className="text-xs font-bold text-slate-900 text-center" numberOfLines={1}>
                                    {store.name}
                                </Text>
                                <Text className="text-xs text-emerald-600 font-semibold mt-0.5">
                                    ★ {store.rating ? store.rating.toFixed(1) : '5.0'}
                                </Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Product Feed */}
            <Text className="text-sm font-bold text-slate-800 mb-3">All POS Cursor Listings ({filteredProducts.length})</Text>

            {filteredProducts.length === 0 ? (
                <View className="bg-white rounded-2xl p-6 items-center border border-slate-100 my-4">
                    <Text className="text-sm font-semibold text-slate-600 mb-1">No products found</Text>
                    <Text className="text-xs text-slate-400 text-center">
                        Be the first member to open a store and list products on the POS Cursor marketplace!
                    </Text>
                </View>
            ) : (
                filteredProducts.map(prod => (
                    <View key={prod.id} className="relative mb-2">
                        <ProductCard
                            id={prod.id}
                            title={prod.title}
                            price={prod.price}
                            compareAtPrice={prod.compareAtPrice}
                            storeName={storeMap.get(prod.storeId) || 'Member Store'}
                            rating={5.0}
                            productType={prod.productType}
                        />
                        <TouchableOpacity
                            onPress={() => addToCart(prod)}
                            className="bg-emerald-600 px-3 py-1.5 rounded-lg absolute right-3 bottom-5 active:opacity-80"
                        >
                            <Text className="text-white text-xs font-bold">+ Add to Cart</Text>
                        </TouchableOpacity>
                    </View>
                ))
            )}

            {/* Cart & Checkout Modal */}
            <Modal visible={showCartModal} animationType="slide" transparent>
                <View className="flex-1 bg-black/50 justify-end">
                    <View className="bg-white rounded-t-3xl p-5 max-h-[85%] border-t border-slate-200">
                        <Text className="text-lg font-bold text-slate-900 mb-3">Your POS Cursor Shopping Cart</Text>

                        {cartItems.length === 0 ? (
                            <Text className="text-xs text-slate-500 py-6 text-center">Your cart is currently empty.</Text>
                        ) : (
                            <ScrollView className="mb-4">
                                <MultiSellerCartSummary groups={cartGroups} commissionRate={0.035} />

                                {/* Payment Method Selector */}
                                <Text className="text-xs font-bold text-slate-700 mb-2">Payment Method</Text>
                                <View className="flex-row space-x-2 mb-4">
                                    {(['wallet', 'cash_on_delivery', 'payroll_deduction'] as const).map(pm => (
                                        <TouchableOpacity
                                            key={pm}
                                            onPress={() => setPaymentMethod(pm)}
                                            className={`flex-1 py-2 px-1 rounded-xl items-center border ${paymentMethod === pm ? 'bg-blue-50 border-blue-600' : 'bg-white border-slate-200'}`}
                                        >
                                            <Text className={`text-xs font-bold capitalize text-center ${paymentMethod === pm ? 'text-blue-900' : 'text-slate-700'}`}>
                                                {pm.replace(/_/g, ' ')}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        )}

                        <View className="flex-row space-x-2">
                            <TouchableOpacity
                                onPress={() => setShowCartModal(false)}
                                className="flex-1 bg-slate-200 py-3 rounded-xl items-center"
                            >
                                <Text className="text-slate-800 font-bold text-sm">Close</Text>
                            </TouchableOpacity>
                            {cartItems.length > 0 && (
                                <TouchableOpacity
                                    onPress={handleCheckout}
                                    className="flex-1 bg-emerald-600 py-3 rounded-xl items-center"
                                >
                                    <Text className="text-white font-bold text-sm">Place Order</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* My Orders Modal */}
            <Modal visible={showOrdersModal} animationType="slide" transparent>
                <View className="flex-1 bg-black/50 justify-end">
                    <View className="bg-white rounded-t-3xl p-5 max-h-[85%] border-t border-slate-200">
                        <Text className="text-lg font-bold text-slate-900 mb-3">My Orders</Text>
                        <ScrollView className="mb-4">
                            {buyerOrders.map(ord => (
                                <View key={ord.id} className="bg-slate-50 rounded-xl p-3 mb-2 border border-slate-200">
                                    <View className="flex-row justify-between items-center mb-1">
                                        <Text className="text-xs font-bold text-slate-900">Order #{ord.orderNumber}</Text>
                                        <Text className="text-xs font-bold text-emerald-700">₱{ord.totalAmount.toFixed(2)}</Text>
                                    </View>
                                    <Text className="text-xs text-slate-500 capitalize">Payment: {ord.paymentMethod.replace(/_/g, ' ')} ({ord.paymentStatus})</Text>
                                </View>
                            ))}
                        </ScrollView>
                        <TouchableOpacity
                            onPress={() => setShowOrdersModal(false)}
                            className="bg-slate-200 py-3 rounded-xl items-center"
                        >
                            <Text className="text-slate-800 font-bold text-sm">Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}
