import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { AccountsPayableService, APAgingSummary } from '../../../src/services/AccountsPayableService';
import AccountsPayableVoucher from '../../../src/database/models/AccountsPayableVoucher';
import Supplier from '../../../src/database/models/Supplier';
import { formatPHP } from '../../../src/utils/currency';

export default function AccountsPayableJournal() {
    const [vouchers, setVouchers] = useState<AccountsPayableVoucher[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [aging, setAging] = useState<APAgingSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Create Voucher Modal State
    const [createVisible, setCreateVisible] = useState(false);
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [expenseAccountCode, setExpenseAccountCode] = useState('5100');
    const [saving, setSaving] = useState(false);

    // Payment Modal State
    const [payVisible, setPayVisible] = useState(false);
    const [payingVoucher, setPayingVoucher] = useState<AccountsPayableVoucher | null>(null);
    const [payAmount, setPayAmount] = useState('');
    const [payProcessing, setPayProcessing] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [vList, sList, agingSummary] = await Promise.all([
                AccountsPayableService.getVouchers(statusFilter === 'all' ? {} : { status: statusFilter }),
                AccountsPayableService.getSuppliers(true),
                AccountsPayableService.getAgingSummary(new Date()),
            ]);
            setVouchers(vList);
            setSuppliers(sList);
            setAging(agingSummary);
            if (sList.length > 0 && !selectedSupplierId) {
                setSelectedSupplierId(sList[0].id);
            }
        } catch (err) {
            console.error('Failed to load AP data:', err);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [statusFilter])
    );

    const handleCreateVoucher = async () => {
        if (!selectedSupplierId) {
            Alert.alert('Error', 'Please select a supplier.');
            return;
        }
        if (!description.trim()) {
            Alert.alert('Error', 'Please enter a description or particulars.');
            return;
        }
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            Alert.alert('Error', 'Please enter a valid amount.');
            return;
        }

        setSaving(true);
        try {
            await AccountsPayableService.createVoucher({
                supplierId: selectedSupplierId,
                invoiceNumber: invoiceNumber.trim() || undefined,
                invoiceDate: new Date(),
                description: description.trim(),
                amount: parsedAmount,
                expenseAccountCode,
                postedBy: 'Admin',
            });

            Alert.alert('Success', 'AP Voucher posted and journal entry created.');
            setCreateVisible(false);
            // Reset
            setInvoiceNumber('');
            setDescription('');
            setAmount('');
            await loadData();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to create AP voucher.');
        } finally {
            setSaving(false);
        }
    };

    const handleOpenPayment = (voucher: AccountsPayableVoucher) => {
        setPayingVoucher(voucher);
        setPayAmount(String(voucher.balance));
        setPayVisible(true);
    };

    const handleRecordPayment = async () => {
        if (!payingVoucher) return;
        const parsedAmount = parseFloat(payAmount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            Alert.alert('Error', 'Please enter a valid payment amount.');
            return;
        }

        setPayProcessing(true);
        try {
            await AccountsPayableService.recordPayment({
                voucherId: payingVoucher.id,
                amount: parsedAmount,
                paymentDate: new Date(),
                postedBy: 'Admin',
            });

            Alert.alert('Success', 'Payment recorded and AP balance updated.');
            setPayVisible(false);
            setPayingVoucher(null);
            await loadData();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to process payment.');
        } finally {
            setPayProcessing(false);
        }
    };

    const supplierMap = new Map(suppliers.map(s => [s.id, s]));

    return (
        <View className="flex-1 bg-gray-50">
            {/* Action Bar */}
            <View className="bg-white border-b border-gray-100 p-4">
                <View className="flex-row justify-between items-center mb-3">
                    <View>
                        <Text className="text-gray-900 font-black text-xl">Accounts Payable Journal</Text>
                        <Text className="text-gray-600 text-xs font-medium">Credit Purchases & Supplier Liabilities</Text>
                    </View>
                    <Pressable
                        onPress={() => setCreateVisible(true)}
                        className="bg-blue-900 px-4 py-2.5 rounded-xl active:bg-blue-800 flex-row items-center"
                    >
                        <MaterialIcons name="add" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text className="text-white font-bold text-xs">New Voucher</Text>
                    </Pressable>
                </View>

                {/* Status Filter */}
                <View className="flex-row">
                    {['all', 'open', 'partial', 'paid'].map(st => (
                        <Pressable
                            key={st}
                            onPress={() => setStatusFilter(st)}
                            className={`px-3 py-1.5 rounded-full mr-2 border ${
                                statusFilter === st
                                    ? 'bg-blue-900 border-blue-900'
                                    : 'bg-gray-50 border-gray-200'
                            }`}
                        >
                            <Text className={`text-xs font-bold uppercase ${
                                statusFilter === st ? 'text-white' : 'text-gray-700'
                            }`}>
                                {st}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#1E3A8A" />
                    <Text className="text-gray-600 text-xs font-bold mt-2">Computing Payables...</Text>
                </View>
            ) : (
                <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
                    {/* Total Payables Card */}
                    <View className="bg-amber-950 p-6 rounded-3xl mb-4 shadow-sm">
                        <Text className="text-amber-200 text-xs font-bold uppercase tracking-wider mb-1">
                            Total Accounts Payable (Cr 2030)
                        </Text>
                        <Text className="text-white font-black text-3xl">
                            {formatPHP(aging?.grandTotal ?? 0)}
                        </Text>
                        <View className="flex-row justify-between mt-3 pt-3 border-t border-amber-800/40">
                            <Text className="text-amber-300 text-[10px]">Current: {formatPHP(aging?.totalCurrent ?? 0)}</Text>
                            <Text className="text-amber-300 text-[10px]">1-30d: {formatPHP(aging?.total1to30 ?? 0)}</Text>
                            <Text className="text-amber-300 text-[10px]">31-60d: {formatPHP(aging?.total31to60 ?? 0)}</Text>
                            <Text className="text-amber-300 text-[10px]">&gt;60d: {formatPHP(aging?.totalOver60 ?? 0)}</Text>
                        </View>
                    </View>

                    {/* Vouchers List */}
                    <Text className="text-gray-900 font-black text-xs uppercase tracking-wider mb-3">
                        Vouchers List ({vouchers.length})
                    </Text>

                    {vouchers.length === 0 ? (
                        <View className="bg-white p-8 rounded-3xl border border-gray-100 items-center justify-center py-16">
                            <MaterialIcons name="check-circle" size={40} color="#059669" />
                            <Text className="text-gray-700 font-bold text-sm mt-3">No Open AP Vouchers</Text>
                            <Text className="text-gray-600 text-xs text-center mt-1">Tap "New Voucher" to record a credit purchase from a supplier.</Text>
                        </View>
                    ) : (
                        vouchers.map(v => {
                            const supplier = supplierMap.get(v.supplierId);
                            const canPay = v.status === 'open' || v.status === 'partial';
                            return (
                                <View
                                    key={v.id}
                                    className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-3"
                                >
                                    <View className="flex-row justify-between items-start mb-2">
                                        <View className="flex-1 mr-3">
                                            <View className="flex-row items-center">
                                                <Text className="text-gray-900 font-black text-sm">{v.voucherNumber}</Text>
                                                <View className={`px-2 py-0.5 rounded-full ml-2 ${
                                                    v.status === 'paid' ? 'bg-emerald-100' : v.status === 'partial' ? 'bg-amber-100' : 'bg-blue-100'
                                                }`}>
                                                    <Text className={`text-[8px] font-bold uppercase ${
                                                        v.status === 'paid' ? 'text-emerald-800' : v.status === 'partial' ? 'text-amber-800' : 'text-blue-900'
                                                    }`}>
                                                        {v.status}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text className="text-gray-700 font-bold text-xs mt-1">
                                                {supplier?.name ?? 'Unknown Supplier'}
                                            </Text>
                                            <Text className="text-gray-600 text-xs mt-0.5">{v.description}</Text>
                                        </View>
                                        <View className="items-end">
                                            <Text className="text-gray-900 font-black text-sm">{formatPHP(v.amount)}</Text>
                                            <Text className="text-amber-700 font-bold text-xs mt-0.5">Bal: {formatPHP(v.balance)}</Text>
                                        </View>
                                    </View>

                                    <View className="flex-row justify-between items-center pt-3 border-t border-gray-50 mt-2">
                                        <Text className="text-gray-600 text-[10px]">
                                            Inv: {v.invoiceNumber || 'N/A'} • {format(new Date(v.invoiceDate), 'MMM d, yyyy')}
                                        </Text>

                                        {canPay && (
                                            <Pressable
                                                onPress={() => handleOpenPayment(v)}
                                                className="bg-emerald-700 px-3 py-1.5 rounded-xl active:bg-emerald-800 flex-row items-center"
                                            >
                                                <MaterialIcons name="payments" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                                                <Text className="text-white font-bold text-xs">Record Payment</Text>
                                            </Pressable>
                                        )}
                                    </View>
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            )}

            {/* Create Voucher Modal */}
            <Modal
                visible={createVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setCreateVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-3xl p-6 h-[90%]">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-gray-900 font-black text-lg">New Accounts Payable Voucher</Text>
                            <Pressable onPress={() => setCreateVisible(false)} className="p-1">
                                <MaterialIcons name="close" size={24} color="#6B7280" />
                            </Pressable>
                        </View>

                        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                            {/* Supplier Picker */}
                            <Text className="text-gray-600 text-xs font-bold uppercase mb-1.5">Supplier *</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                                <View className="flex-row">
                                    {suppliers.map(s => (
                                        <Pressable
                                            key={s.id}
                                            onPress={() => setSelectedSupplierId(s.id)}
                                            className={`px-3 py-2 rounded-xl mr-2 border ${
                                                selectedSupplierId === s.id
                                                    ? 'bg-blue-900 border-blue-900'
                                                    : 'bg-gray-50 border-gray-200'
                                            }`}
                                        >
                                            <Text className={`text-xs font-bold ${
                                                selectedSupplierId === s.id ? 'text-white' : 'text-gray-800'
                                            }`}>
                                                {s.name}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </ScrollView>

                            <Text className="text-gray-600 text-xs font-bold uppercase mb-1">Invoice / DR Reference No.</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-sm mb-3 text-gray-900"
                                placeholder="e.g. INV-2026-987"
                                placeholderTextColor="#9CA3AF"
                                value={invoiceNumber}
                                onChangeText={setInvoiceNumber}
                            />

                            <Text className="text-gray-600 text-xs font-bold uppercase mb-1">Description / Particulars *</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-sm mb-3 text-gray-900"
                                placeholder="e.g. Purchase of 50 bags fertilizer on 30-day term"
                                placeholderTextColor="#9CA3AF"
                                value={description}
                                onChangeText={setDescription}
                            />

                            <Text className="text-gray-600 text-xs font-bold uppercase mb-1">Voucher Amount (₱) *</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-sm mb-3 text-gray-900 font-bold"
                                placeholder="0.00"
                                placeholderTextColor="#9CA3AF"
                                value={amount}
                                onChangeText={setAmount}
                                keyboardType="numeric"
                            />

                            <Text className="text-gray-600 text-xs font-bold uppercase mb-1.5">Debit Account Code</Text>
                            <View className="flex-row flex-wrap mb-6">
                                {[
                                    { code: '5100', name: 'Other Operating Expenses' },
                                    { code: '1210', name: 'Agri-Store Inventory' },
                                    { code: '1246', name: 'Agricultural Supplies (Inputs)' },
                                    { code: '5020', name: 'Office Supplies' },
                                ].map(a => (
                                    <Pressable
                                        key={a.code}
                                        onPress={() => setExpenseAccountCode(a.code)}
                                        className={`px-3 py-1.5 rounded-full mr-2 mb-2 border ${
                                            expenseAccountCode === a.code
                                                ? 'bg-blue-900 border-blue-900'
                                                : 'bg-gray-50 border-gray-200'
                                        }`}
                                    >
                                        <Text className={`text-[10px] font-bold ${
                                            expenseAccountCode === a.code ? 'text-white' : 'text-gray-700'
                                        }`}>
                                            {a.code} — {a.name}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            <View className="flex-row">
                                <Pressable
                                    onPress={() => setCreateVisible(false)}
                                    className="flex-1 bg-gray-100 py-3.5 rounded-xl mr-2 items-center"
                                >
                                    <Text className="text-gray-700 font-bold text-sm">Cancel</Text>
                                </Pressable>
                                <Pressable
                                    onPress={handleCreateVoucher}
                                    disabled={saving}
                                    className="flex-1 bg-blue-900 py-3.5 rounded-xl ml-2 items-center active:bg-blue-800"
                                >
                                    <Text className="text-white font-bold text-sm">
                                        {saving ? 'Posting...' : 'Post AP Voucher'}
                                    </Text>
                                </Pressable>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Payment Modal */}
            <Modal
                visible={payVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setPayVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-3xl p-6">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-gray-900 font-black text-lg">Pay Supplier Voucher</Text>
                            <Pressable onPress={() => setPayVisible(false)} className="p-1">
                                <MaterialIcons name="close" size={24} color="#6B7280" />
                            </Pressable>
                        </View>

                        <View className="bg-gray-50 p-4 rounded-2xl mb-4 border border-gray-100">
                            <Text className="text-gray-600 text-xs font-bold uppercase">Voucher: {payingVoucher?.voucherNumber}</Text>
                            <Text className="text-gray-900 font-bold text-sm mt-1">{payingVoucher?.description}</Text>
                            <Text className="text-amber-700 font-black text-base mt-2">Remaining Balance: {formatPHP(payingVoucher?.balance ?? 0)}</Text>
                        </View>

                        <Text className="text-gray-600 text-xs font-bold uppercase mb-1">Payment Amount (₱) *</Text>
                        <TextInput
                            className="bg-gray-100 rounded-xl px-4 py-3 text-sm mb-6 text-gray-900 font-bold"
                            placeholder="0.00"
                            placeholderTextColor="#9CA3AF"
                            value={payAmount}
                            onChangeText={setPayAmount}
                            keyboardType="numeric"
                        />

                        <View className="flex-row">
                            <Pressable
                                onPress={() => setPayVisible(false)}
                                className="flex-1 bg-gray-100 py-3.5 rounded-xl mr-2 items-center"
                            >
                                <Text className="text-gray-700 font-bold text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleRecordPayment}
                                disabled={payProcessing}
                                className="flex-1 bg-emerald-700 py-3.5 rounded-xl ml-2 items-center active:bg-emerald-800"
                            >
                                <Text className="text-white font-bold text-sm">
                                    {payProcessing ? 'Processing...' : 'Disburse & Clear'}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
