import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/store/AuthContext';
import { formatPHP } from '../../src/utils/currency';
import { handleSaveError } from '../../src/utils/errorAlerts';
import {
    QSRPosService,
    CRISPY_KING_MENU,
    MenuItem,
    OrderItemInput,
    DiscountInput,
    PaymentTender,
} from '../../src/services/QSRPosService';
import { SupervisorApprovalModal } from '../../src/components/SupervisorApprovalModal';
import { SupervisorApprovalService } from '../../src/services/SupervisorApprovalService';

export default function CashierPosScreen() {
    const router = useRouter();
    const { branchId, user } = useAuth();

    // Menu filtering
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Cart state
    const [cart, setCart] = useState<OrderItemInput[]>([]);
    const [isScPwd, setIsScPwd] = useState(false);
    const [scPwdId, setScPwdId] = useState('');

    // Checkout modal state
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash' | 'maya' | 'split'>('cash');
    const [cashTender, setCashTender] = useState<string>('');
    const [eWalletTender, setEWalletTender] = useState<string>('');
    const [eWalletRef, setEWalletRef] = useState('');

    // Completed order receipt modal
    const [completedReceipt, setCompletedReceipt] = useState<{
        orderNumber: string;
        items: OrderItemInput[];
        totals: any;
        change: number;
        paid: number;
    } | null>(null);

    // Filtered menu
    const filteredMenu = useMemo(() => {
        return CRISPY_KING_MENU.filter((item) => {
            const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCat && matchesSearch;
        });
    }, [selectedCategory, searchQuery]);

    // Totals
    const discountInput: DiscountInput = useMemo(() => {
        if (isScPwd) {
            return { type: 'sc_pwd_20', idNumber: scPwdId };
        }
        return { type: 'none' };
    }, [isScPwd, scPwdId]);

    const totals = useMemo(() => {
        return QSRPosService.calculateOrderTotals(cart, discountInput);
    }, [cart, discountInput]);

    // Cart mutators
    const addToCart = (item: MenuItem, qty = 1) => {
        setCart((prev) => {
            const existing = prev.find((i) => i.productId === item.productId);
            if (existing) {
                return prev.map((i) =>
                    i.productId === item.productId
                        ? { ...i, quantity: i.quantity + qty }
                        : i
                );
            }
            return [...prev, { productId: item.productId, name: item.name, price: item.price, quantity: qty }];
        });
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart((prev) => {
            return prev
                .map((item) => {
                    if (item.productId === productId) {
                        const newQty = item.quantity + delta;
                        return newQty > 0 ? { ...item, quantity: newQty } : null;
                    }
                    return item;
                })
                .filter(Boolean) as OrderItemInput[];
        });
    };

    // Void order supervisor approval
    const [isVoidApprovalOpen, setIsVoidApprovalOpen] = useState(false);

    const handleRequestClearCart = () => {
        if (cart.length === 0) return;
        setIsVoidApprovalOpen(true);
    };

    const handleVoidApproved = async (result: { supervisorId: string; supervisorName: string }) => {
        await SupervisorApprovalService.recordApprovalLog({
            supervisorId: result.supervisorId,
            cashierId: user?.id || 'cashier',
            branchId: branchId || 'branch-bagacay',
            action: 'VOID_ORDER',
            details: {
                itemCount: cart.length,
                totalAmount: totals.grossTotal,
            },
        });
        setCart([]);
        setIsScPwd(false);
        setScPwdId('');
        Alert.alert('Order Voided', `Order was successfully voided with authorization from ${result.supervisorName}.`);
    };

    // Checkout calculation
    const tenderAmount = Number(cashTender) || 0;
    const eWalletAmount = Number(eWalletTender) || 0;

    const tenders: PaymentTender[] = useMemo(() => {
        if (paymentMethod === 'cash') {
            return [{ method: 'cash', amount: tenderAmount }];
        }
        if (paymentMethod === 'gcash' || paymentMethod === 'maya') {
            return [{ method: paymentMethod, amount: totals.netPayable, referenceNumber: eWalletRef }];
        }
        // Split
        const res: PaymentTender[] = [];
        if (tenderAmount > 0) res.push({ method: 'cash', amount: tenderAmount });
        if (eWalletAmount > 0) res.push({ method: 'gcash', amount: eWalletAmount, referenceNumber: eWalletRef });
        return res;
    }, [paymentMethod, tenderAmount, eWalletAmount, eWalletRef, totals.netPayable]);

    const paymentValidation = useMemo(() => {
        return QSRPosService.validatePayment(totals.netPayable, tenders);
    }, [totals.netPayable, tenders]);

    const handleCompleteCheckout = async () => {
        if (!paymentValidation.isValid) {
            const err = paymentValidation.error || 'Please enter valid tender amount.';
            if (Platform.OS === 'web') {
                window.alert(`Payment Incomplete: ${err}`);
            } else {
                Alert.alert('Payment Incomplete', err);
            }
            return;
        }

        try {
            const posService = new QSRPosService();
            const result = await posService.processOrder({
                branchId: branchId || 'branch-bagacay',
                cashierId: user?.id || 'cashier-1',
                items: cart,
                discount: discountInput,
                tenders,
            });

            // Show receipt modal
            setCompletedReceipt({
                orderNumber: result.orderNumber,
                items: [...cart],
                totals,
                change: paymentValidation.change,
                paid: paymentValidation.totalPaid,
            });

            // Reset checkout state
            setIsCheckoutOpen(false);
            setCart([]);
            setIsScPwd(false);
            setScPwdId('');
            setCashTender('');
            setEWalletTender('');
            setEWalletRef('');
        } catch (err: any) {
            console.error('[POS Checkout Error]:', err);
            handleSaveError(err, 'POS Checkout Order', 'save');
        }
    };

    return (
        <View className="flex-1 bg-slate-100 flex-row">
            {/* LEFT: Menu Selection Grid (approx 65% width) */}
            <View className="flex-1 p-3 border-r border-slate-200">
                {/* Search and Category Filter */}
                <View className="mb-3">
                    <View className="flex-row items-center mb-2">
                        <View className="flex-1 flex-row items-center bg-white px-3 py-2 rounded-xl border border-slate-300 mr-2">
                            <Ionicons name="search" size={18} color="#64748b" />
                            <TextInput
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder="Search menu (Chicken, Rice, Drinks...)"
                                placeholderTextColor="#9CA3AF"
                                className="flex-1 ml-2 text-slate-900 text-sm"
                            />
                            {searchQuery.length > 0 && (
                                <Pressable onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                                </Pressable>
                            )}
                        </View>
                        <Pressable
                            onPress={() => router.push('/(cashier)/returns' as any)}
                            className="bg-emerald-800 px-3 py-2.5 rounded-xl flex-row items-center active:bg-emerald-900"
                        >
                            <Ionicons name="return-down-back" size={16} color="#ffffff" style={{ marginRight: 4 }} />
                            <Text className="text-white text-xs font-bold">Returns</Text>
                        </Pressable>
                    </View>

                    {/* Category Pills */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="flex-grow-0"
                        contentContainerStyle={{ alignItems: 'center', flexDirection: 'row' }}
                    >
                        {[
                            { key: 'all', label: 'All Items' },
                            { key: 'chicken', label: 'Fried Chicken' },
                            { key: 'sides', label: 'Rice & Sides' },
                            { key: 'drinks', label: 'Softdrinks' },
                            { key: 'specialty', label: 'Specialty' },
                            { key: 'condiments', label: 'Atsara' },
                        ].map((cat) => (
                            <Pressable
                                key={cat.key}
                                onPress={() => setSelectedCategory(cat.key)}
                                className={`mr-2 px-3.5 py-1.5 rounded-full border items-center justify-center self-start ${
                                    selectedCategory === cat.key
                                        ? 'bg-emerald-700 border-emerald-700'
                                        : 'bg-white border-slate-300'
                                }`}
                            >
                                <Text
                                    className={`text-xs font-bold ${
                                        selectedCategory === cat.key ? 'text-white' : 'text-slate-700'
                                    }`}
                                >
                                    {cat.label}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>

                {/* Product Touch Grid */}
                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    <View className="flex-row flex-wrap justify-between">
                        {filteredMenu.map((item) => {
                            const cartQty = cart.find((i) => i.productId === item.productId)?.quantity || 0;
                            return (
                                <Pressable
                                    key={item.productId}
                                    onPress={() => addToCart(item, 1)}
                                    className="w-[48%] bg-white p-3.5 rounded-2xl border border-slate-200 mb-3 shadow-sm active:scale-95"
                                >
                                    <View className="flex-row justify-between items-start mb-2">
                                        <View className="w-10 h-10 bg-emerald-100 rounded-xl items-center justify-center">
                                            <Ionicons name={item.icon as any} size={22} color="#047857" />
                                        </View>
                                        {cartQty > 0 && (
                                            <View className="bg-emerald-600 px-2 py-0.5 rounded-full">
                                                <Text className="text-white text-xs font-bold">{cartQty}x</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text className="text-slate-900 font-bold text-sm leading-tight mb-1" numberOfLines={2}>
                                        {item.name}
                                    </Text>
                                    <Text className="text-emerald-700 font-black text-base">{formatPHP(item.price)}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>

            {/* RIGHT: Active Ticket & Order Sidebar (approx 35% width) */}
            <View className="w-80 bg-white p-4 flex-col justify-between border-l border-slate-200 shadow-md">
                <View className="flex-1">
                    {/* Cart Header */}
                    <View className="flex-row items-center justify-between border-b border-slate-200 pb-3 mb-3">
                        <View>
                            <Text className="text-slate-900 font-bold text-lg">Current Order</Text>
                            <Text className="text-slate-500 text-xs">{cart.length} item kinds</Text>
                        </View>
                        {cart.length > 0 && (
                            <Pressable onPress={handleRequestClearCart} className="px-2 py-1 bg-rose-50 rounded-lg">
                                <Text className="text-rose-600 text-xs font-bold">Clear</Text>
                            </Pressable>
                        )}
                    </View>

                    {/* Cart Items List */}
                    {cart.length === 0 ? (
                        <View className="flex-1 items-center justify-center py-10">
                            <Ionicons name="cart-outline" size={48} color="#cbd5e1" />
                            <Text className="text-slate-400 text-sm mt-2">No items in order</Text>
                            <Text className="text-slate-400 text-xs">Tap menu items to add</Text>
                        </View>
                    ) : (
                        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                            {cart.map((item) => (
                                <View
                                    key={item.productId}
                                    className="flex-row items-center justify-between py-2.5 border-b border-slate-100"
                                >
                                    <View className="flex-1 mr-2">
                                        <Text className="text-slate-900 font-bold text-xs" numberOfLines={1}>
                                            {item.name}
                                        </Text>
                                        <Text className="text-slate-500 text-xs">
                                            {formatPHP(item.price)} × {item.quantity} = {formatPHP(item.price * item.quantity)}
                                        </Text>
                                    </View>
                                    <View className="flex-row items-center bg-slate-100 rounded-lg p-1">
                                        <Pressable
                                            onPress={() => updateQuantity(item.productId, -1)}
                                            className="w-6 h-6 bg-white rounded items-center justify-center shadow-xs"
                                        >
                                            <Ionicons name="remove" size={14} color="#334155" />
                                        </Pressable>
                                        <Text className="text-slate-800 font-bold text-xs mx-2">{item.quantity}</Text>
                                        <Pressable
                                            onPress={() => updateQuantity(item.productId, 1)}
                                            className="w-6 h-6 bg-white rounded items-center justify-center shadow-xs"
                                        >
                                            <Ionicons name="add" size={14} color="#334155" />
                                        </Pressable>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </View>

                {/* Footer: Discounts & Checkout Button */}
                <View className="border-t border-slate-200 pt-3">
                    {/* SC / PWD Toggle */}
                    <View className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 mb-3">
                        <Pressable
                            onPress={() => setIsScPwd(!isScPwd)}
                            className="flex-row items-center justify-between"
                        >
                            <View className="flex-row items-center">
                                <Ionicons
                                    name={isScPwd ? 'checkbox' : 'square-outline'}
                                    size={20}
                                    color={isScPwd ? '#047857' : '#64748b'}
                                />
                                <Text className="text-slate-800 font-bold text-xs ml-2">Senior / PWD (20% Off + VAT Exempt)</Text>
                            </View>
                        </Pressable>
                        {isScPwd && (
                            <TextInput
                                value={scPwdId}
                                onChangeText={setScPwdId}
                                placeholder="Enter Senior Citizen / PWD ID #"
                                placeholderTextColor="#9CA3AF"
                                className="mt-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-900 text-xs"
                            />
                        )}
                    </View>

                    {/* Subtotals breakdown */}
                    <View className="space-y-1 mb-3">
                        <View className="flex-row justify-between">
                            <Text className="text-slate-500 text-xs">Subtotal</Text>
                            <Text className="text-slate-700 text-xs font-semibold">{formatPHP(totals.grossTotal)}</Text>
                        </View>
                        {totals.discountAmount > 0 && (
                            <View className="flex-row justify-between">
                                <Text className="text-emerald-700 text-xs">20% SC/PWD Discount</Text>
                                <Text className="text-emerald-700 text-xs font-bold">-{formatPHP(totals.discountAmount)}</Text>
                            </View>
                        )}
                        <View className="flex-row justify-between border-t border-slate-200 pt-1">
                            <Text className="text-slate-900 font-black text-base">Total Payable</Text>
                            <Text className="text-emerald-700 font-black text-lg">{formatPHP(totals.netPayable)}</Text>
                        </View>
                    </View>

                    {/* Pay Button */}
                    <Pressable
                        disabled={cart.length === 0}
                        onPress={() => {
                            setCashTender(String(totals.netPayable));
                            setIsCheckoutOpen(true);
                        }}
                        className={`w-full py-3.5 rounded-xl items-center justify-center shadow-sm ${
                            cart.length === 0 ? 'bg-slate-300' : 'bg-emerald-600 active:bg-emerald-700'
                        }`}
                    >
                        <Text className="text-white font-extrabold text-base">Charge {formatPHP(totals.netPayable)}</Text>
                    </Pressable>
                </View>
            </View>

            {/* CHECKOUT MODAL */}
            <Modal visible={isCheckoutOpen} transparent animationType="slide">
                <View className="flex-1 bg-slate-900/60 justify-center items-center p-4">
                    <View className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl">
                        <View className="flex-row justify-between items-center border-b border-slate-200 pb-3 mb-4">
                            <Text className="text-slate-900 font-extrabold text-xl">Payment Checkout</Text>
                            <Pressable onPress={() => setIsCheckoutOpen(false)}>
                                <Ionicons name="close" size={24} color="#64748b" />
                            </Pressable>
                        </View>

                        {/* Amount Due Banner */}
                        <View className="bg-slate-100 p-4 rounded-xl items-center mb-4">
                            <Text className="text-slate-500 text-xs font-bold uppercase tracking-wider">Amount Due</Text>
                            <Text className="text-slate-900 font-black text-3xl mt-1">{formatPHP(totals.netPayable)}</Text>
                        </View>

                        {/* Payment Method Selector */}
                        <View className="flex-row justify-between mb-4">
                            {[
                                { key: 'cash', label: 'Cash', icon: 'cash' },
                                { key: 'gcash', label: 'GCash', icon: 'phone-portrait' },
                                { key: 'maya', label: 'Maya', icon: 'card' },
                                { key: 'split', label: 'Split', icon: 'git-branch' },
                            ].map((m) => (
                                <Pressable
                                    key={m.key}
                                    onPress={() => setPaymentMethod(m.key as any)}
                                    className={`flex-1 mx-1 py-2.5 items-center rounded-xl border ${
                                        paymentMethod === m.key
                                            ? 'bg-emerald-700 border-emerald-700'
                                            : 'bg-white border-slate-300'
                                    }`}
                                >
                                    <Ionicons
                                        name={m.icon as any}
                                        size={18}
                                        color={paymentMethod === m.key ? '#ffffff' : '#334155'}
                                    />
                                    <Text
                                        className={`text-xs font-bold mt-1 ${
                                            paymentMethod === m.key ? 'text-white' : 'text-slate-700'
                                        }`}
                                    >
                                        {m.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>

                        {/* Tender Inputs */}
                        {(paymentMethod === 'cash' || paymentMethod === 'split') && (
                            <View className="mb-4">
                                <Text className="text-slate-700 font-bold text-xs mb-1.5">Cash Tendered (₱)</Text>
                                <TextInput
                                    keyboardType="numeric"
                                    value={cashTender}
                                    onChangeText={setCashTender}
                                    placeholder="0.00"
                                    placeholderTextColor="#9CA3AF"
                                    className="bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-lg font-bold"
                                />

                                {/* Cash Presets */}
                                <View className="flex-row justify-between mt-2">
                                    {[totals.netPayable, 100, 200, 500, 1000].map((preset, idx) => (
                                        <Pressable
                                            key={idx}
                                            onPress={() => setCashTender(String(preset))}
                                            className="px-2.5 py-1.5 bg-slate-200 active:bg-slate-300 rounded-lg"
                                        >
                                            <Text className="text-slate-800 text-xs font-bold">
                                                {idx === 0 ? 'Exact' : `₱${preset}`}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        )}

                        {(paymentMethod === 'gcash' || paymentMethod === 'maya' || paymentMethod === 'split') && (
                            <View className="mb-4">
                                <Text className="text-slate-700 font-bold text-xs mb-1.5">
                                    {paymentMethod === 'split' ? 'E-Wallet Portion Amount (₱)' : 'Reference Number'}
                                </Text>
                                {paymentMethod === 'split' && (
                                    <TextInput
                                        keyboardType="numeric"
                                        value={eWalletTender}
                                        onChangeText={setEWalletTender}
                                        placeholder="0.00"
                                        placeholderTextColor="#9CA3AF"
                                        className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-300 text-slate-900 text-sm font-bold mb-2"
                                    />
                                )}
                                <TextInput
                                    value={eWalletRef}
                                    onChangeText={setEWalletRef}
                                    placeholder="Enter reference # (e.g. 102938475)"
                                    placeholderTextColor="#9CA3AF"
                                    className="bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm"
                                />
                            </View>
                        )}

                        {/* Change Display */}
                        {tenderAmount >= totals.netPayable && (
                            <View className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 flex-row justify-between items-center mb-4">
                                <Text className="text-emerald-800 font-bold text-sm">Change to Customer</Text>
                                <Text className="text-emerald-700 font-black text-xl">
                                    {formatPHP(paymentValidation.change)}
                                </Text>
                            </View>
                        )}

                        {/* Confirmation Button */}
                        <Pressable
                            disabled={!paymentValidation.isValid}
                            onPress={handleCompleteCheckout}
                            className={`w-full py-3.5 rounded-xl items-center justify-center ${
                                paymentValidation.isValid ? 'bg-emerald-600 active:bg-emerald-700' : 'bg-slate-300'
                            }`}
                        >
                            <Text className="text-white font-extrabold text-base">Complete Transaction</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* RECEIPT MODAL */}
            {completedReceipt && (
                <Modal visible={!!completedReceipt} transparent animationType="fade">
                    <View className="flex-1 bg-slate-900/60 justify-center items-center p-4">
                        <View className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                            <View className="items-center border-b border-dashed border-slate-300 pb-4 mb-4">
                                <View className="w-12 h-12 bg-emerald-100 rounded-full items-center justify-center mb-2">
                                    <Ionicons name="checkmark-done" size={28} color="#047857" />
                                </View>
                                <Text className="text-slate-900 font-black text-xl">CRISPY KING</Text>
                                <Text className="text-slate-500 text-xs">ERT-Crispy King Ventures Inc.</Text>
                                <Text className="text-slate-600 text-xs font-semibold mt-1">
                                    {branchId || 'Bagacay Branch'}
                                </Text>
                                <Text className="text-slate-400 text-xs">Receipt #{completedReceipt.orderNumber}</Text>
                            </View>

                            {/* Line items */}
                            <View className="space-y-1.5 mb-4 max-h-48">
                                <ScrollView>
                                    {completedReceipt.items.map((i, idx) => (
                                        <View key={idx} className="flex-row justify-between py-1">
                                            <Text className="text-slate-700 text-xs font-medium">
                                                {i.quantity}x {i.name}
                                            </Text>
                                            <Text className="text-slate-900 text-xs font-bold">
                                                {formatPHP(i.price * i.quantity)}
                                            </Text>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Totals */}
                            <View className="border-t border-dashed border-slate-300 pt-3 space-y-1 mb-4">
                                <View className="flex-row justify-between">
                                    <Text className="text-slate-500 text-xs">Gross Sales</Text>
                                    <Text className="text-slate-700 text-xs">
                                        {formatPHP(completedReceipt.totals.grossTotal)}
                                    </Text>
                                </View>
                                {completedReceipt.totals.discountAmount > 0 && (
                                    <View className="flex-row justify-between">
                                        <Text className="text-emerald-700 text-xs">Senior / PWD 20%</Text>
                                        <Text className="text-emerald-700 text-xs font-bold">
                                            -{formatPHP(completedReceipt.totals.discountAmount)}
                                        </Text>
                                    </View>
                                )}
                                <View className="flex-row justify-between border-t border-slate-200 pt-1">
                                    <Text className="text-slate-900 font-bold text-sm">Total Paid</Text>
                                    <Text className="text-slate-900 font-bold text-sm">
                                        {formatPHP(completedReceipt.paid)}
                                    </Text>
                                </View>
                                <View className="flex-row justify-between">
                                    <Text className="text-slate-500 text-xs">Change</Text>
                                    <Text className="text-emerald-700 font-bold text-xs">
                                        {formatPHP(completedReceipt.change)}
                                    </Text>
                                </View>
                            </View>

                            <Pressable
                                onPress={() => setCompletedReceipt(null)}
                                className="w-full bg-emerald-700 py-3 rounded-xl items-center"
                            >
                                <Text className="text-white font-bold text-sm">Done / Next Customer</Text>
                            </Pressable>
                        </View>
                    </View>
                </Modal>
            )}

            {/* SUPERVISOR VOID APPROVAL MODAL */}
            <SupervisorApprovalModal
                visible={isVoidApprovalOpen}
                onClose={() => setIsVoidApprovalOpen(false)}
                onApproved={handleVoidApproved}
                branchId={branchId || 'branch-bagacay'}
                actionTitle="Void Active Order"
                actionDescription="Supervisor PIN required to cancel/void order items."
            />
        </View>
    );
}
