import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, Pressable, ScrollView,
    ActivityIndicator, Alert, Modal, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../../src/store/AuthContext';
import { database } from '../../../src/database';
import Borrower from '../../../src/database/models/Borrower';
import BankAccount from '../../../src/database/models/BankAccount';
import { Q } from '@nozbe/watermelondb';
import { BorrowerSelector } from '../../../src/components/BorrowerSelector';
import { DatePicker } from '../../../src/components/DatePicker';
import { formatPHP } from '../../../src/utils/currency';
import { formatDate } from '../../../src/utils/dates';
import { SeriesService } from '../../../src/services/SeriesService';
import {
    OtherReceiptService,
    OtherReceiptCategory,
    OTHER_RECEIPT_CATEGORIES,
    OtherReceiptItem
} from '../../../src/services/OtherReceiptService';
import { format } from 'date-fns';
import { safeBack } from '../../../src/utils/navigation';

export default function NewOtherReceiptScreen() {
    const router = useRouter();
    const { user, role, collectorId } = useAuth();

    const [isMemberPayor, setIsMemberPayor] = useState(true);
    const [borrowerId, setBorrowerId] = useState<string>('');
    const [borrowerName, setBorrowerName] = useState<string>('');
    const [customPayorName, setCustomPayorName] = useState<string>('');

    const [receiptNumber, setReceiptNumber] = useState<string>(SeriesService.generateReceiptNumber());
    const [category, setCategory] = useState<OtherReceiptCategory>('service_charge');
    const [amount, setAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [selectedBankId, setSelectedBankId] = useState<string>('');
    const [transactionDate, setTransactionDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [notes, setNotes] = useState<string>('');
    const [saving, setSaving] = useState(false);

    // Receipt Dialog / Modal after saving
    const [savedReceipt, setSavedReceipt] = useState<OtherReceiptItem | null>(null);
    const [receiptModalVisible, setReceiptModalVisible] = useState(false);

    useEffect(() => {
        const fetchBankAccounts = async () => {
            try {
                const accounts = await database.get<BankAccount>('bank_accounts')
                    .query(Q.where('deleted_at', null))
                    .fetch();
                setBankAccounts(accounts);
                if (accounts.length > 0) {
                    setSelectedBankId(accounts[0].id);
                }
            } catch (err) {
                console.error('Failed to load bank accounts:', err);
            }
        };
        fetchBankAccounts();
    }, []);

    const handleBorrowerSelect = (borrower: Borrower) => {
        setBorrowerId(borrower.id);
        setBorrowerName(borrower.fullName);
    };

    const handleSave = async () => {
        const payor = isMemberPayor ? borrowerName.trim() : customPayorName.trim();
        if (!payor) {
            Alert.alert('Required Field', isMemberPayor ? 'Please select a member / borrower.' : 'Please enter payor name.');
            return;
        }

        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid positive payment amount.');
            return;
        }

        if (paymentMethod === 'bank' && !selectedBankId) {
            Alert.alert('Select Bank', 'Please select the receiving bank account.');
            return;
        }

        setSaving(true);
        try {
            const receipt = await OtherReceiptService.createReceipt({
                receiptNumber: receiptNumber.trim() || undefined,
                payorName: payor,
                borrowerId: isMemberPayor ? borrowerId : undefined,
                category,
                amount: val,
                paymentMethod,
                bankAccountId: paymentMethod === 'bank' ? selectedBankId : undefined,
                transactionDate: new Date(transactionDate),
                notes,
                recordedBy: user?.id,
            });

            setSavedReceipt(receipt);
            setReceiptModalVisible(true);
        } catch (error: any) {
            console.error('Failed to record other receipt:', error);
            Alert.alert('Error', error?.message || 'Failed to record other receipt.');
        } finally {
            setSaving(false);
        }
    };

    const handleResetForm = () => {
        setReceiptModalVisible(false);
        setSavedReceipt(null);
        setAmount('');
        setNotes('');
        setCustomPayorName('');
        setBorrowerId('');
        setBorrowerName('');
        setReceiptNumber(SeriesService.generateReceiptNumber());
    };

    const categoryList = Object.values(OTHER_RECEIPT_CATEGORIES);

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
            {/* Header Title Card */}
            <View className="bg-emerald-700 p-6 rounded-3xl mb-6 shadow-md">
                <View className="flex-row items-center justify-between">
                    <View>
                        <Text className="text-emerald-100 text-xs font-black uppercase tracking-widest">Receipt Management</Text>
                        <Text className="text-white font-black text-2xl mt-1">Official Other Receipt</Text>
                    </View>
                    <Pressable
                        onPress={() => router.push('/(admin)/reports/other-receipts')}
                        className="bg-white/10 px-3 py-2 rounded-xl flex-row items-center border border-white/20 active:bg-white/20"
                    >
                        <MaterialIcons name="assessment" size={18} color="#FFF" />
                        <Text className="text-white font-bold text-xs ml-1.5">View Report</Text>
                    </Pressable>
                </View>
                <Text className="text-emerald-100/90 text-xs mt-2 font-medium">
                    Issue non-loan receipts for service charges, fees, misc income, and other collections with automated accounting auto-posting.
                </Text>
            </View>

            <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                {/* Payor Type Toggle */}
                <View className="mb-6">
                    <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Payor Type</Text>
                    <View className="flex-row bg-gray-100 p-1 rounded-2xl">
                        <Pressable
                            onPress={() => setIsMemberPayor(true)}
                            className={`flex-1 py-3 items-center rounded-xl ${isMemberPayor ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Text className={`text-xs font-black uppercase ${isMemberPayor ? 'text-emerald-800' : 'text-gray-600'}`}>
                                Cooperative Member
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setIsMemberPayor(false)}
                            className={`flex-1 py-3 items-center rounded-xl ${!isMemberPayor ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Text className={`text-xs font-black uppercase ${!isMemberPayor ? 'text-emerald-800' : 'text-gray-600'}`}>
                                Non-Member / Other
                            </Text>
                        </Pressable>
                    </View>
                </View>

                {/* Member Selector or Manual Name */}
                {isMemberPayor ? (
                    <View className="mb-6">
                        <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Select Member / Payor *</Text>
                        <BorrowerSelector
                            selectedBorrowerId={borrowerId}
                            onSelect={handleBorrowerSelect}
                            role={role}
                            collectorId={collectorId}
                        />
                        {borrowerName ? (
                            <View className="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex-row items-center justify-between">
                                <Text className="text-emerald-900 font-bold text-xs">Selected: {borrowerName}</Text>
                                <MaterialIcons name="check-circle" size={16} color="#059669" />
                            </View>
                        ) : null}
                    </View>
                ) : (
                    <View className="mb-6">
                        <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Payor Full Name *</Text>
                        <TextInput
                            className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 font-bold text-base"
                            value={customPayorName}
                            onChangeText={setCustomPayorName}
                            placeholder="Enter customer / payor full name"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>
                )}

                {/* Receipt Category Chips */}
                <View className="mb-6">
                    <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Receipt / Transaction Category *</Text>
                    <View className="flex-row flex-wrap gap-2">
                        {categoryList.map(cat => {
                            const isSelected = category === cat.key;
                            return (
                                <Pressable
                                    key={cat.key}
                                    onPress={() => setCategory(cat.key)}
                                    className={`px-3 py-2.5 rounded-xl border flex-row items-center ${
                                        isSelected 
                                            ? 'bg-emerald-50 border-emerald-600' 
                                            : 'bg-gray-50 border-gray-200'
                                    }`}
                                >
                                    <MaterialIcons 
                                        name={cat.icon as any} 
                                        size={16} 
                                        color={isSelected ? '#059669' : '#6B7280'} 
                                        className="mr-1.5" 
                                    />
                                    <Text className={`text-xs font-black ${isSelected ? 'text-emerald-900' : 'text-gray-700'}`}>
                                        {cat.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                    <View className="mt-2 flex-row items-center">
                        <MaterialIcons name="account-tree" size={14} color="#6B7280" className="mr-1" />
                        <Text className="text-[11px] text-gray-500 font-medium">
                            Auto-posted to: <Text className="font-bold text-gray-800">{OTHER_RECEIPT_CATEGORIES[category]?.accountCode} - {OTHER_RECEIPT_CATEGORIES[category]?.accountName}</Text>
                        </Text>
                    </View>
                </View>

                {/* Amount and Receipt Series in 2-column on desktop / stacked on mobile */}
                <View className="flex-row flex-wrap gap-4 mb-6">
                    <View className="flex-1 min-w-[200px]">
                        <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Amount (₱) *</Text>
                        <TextInput
                            className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 font-extrabold text-2xl"
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="numeric"
                            placeholder="0.00"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    <View className="flex-1 min-w-[200px]">
                        <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Official Receipt # (OR)</Text>
                        <TextInput
                            className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 font-bold text-base"
                            value={receiptNumber}
                            onChangeText={setReceiptNumber}
                            placeholder="OR-000000"
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>
                </View>

                {/* Transaction Date */}
                <View className="mb-6">
                    <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Transaction Date *</Text>
                    <DatePicker value={transactionDate} onChange={setTransactionDate} />
                </View>

                {/* Payment Method */}
                <View className="mb-6">
                    <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Payment Channel</Text>
                    <View className="flex-row bg-gray-100 p-1 rounded-2xl mb-3">
                        <Pressable
                            onPress={() => setPaymentMethod('cash')}
                            className={`flex-1 py-3 items-center rounded-xl flex-row justify-center ${paymentMethod === 'cash' ? 'bg-white shadow-sm' : ''}`}
                        >
                            <MaterialIcons name="payments" size={18} color={paymentMethod === 'cash' ? '#059669' : '#6B7280'} className="mr-1.5" />
                            <Text className={`text-xs font-black uppercase ${paymentMethod === 'cash' ? 'text-emerald-800' : 'text-gray-600'}`}>
                                Cash on Hand
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setPaymentMethod('bank')}
                            className={`flex-1 py-3 items-center rounded-xl flex-row justify-center ${paymentMethod === 'bank' ? 'bg-white shadow-sm' : ''}`}
                        >
                            <MaterialIcons name="account-balance" size={18} color={paymentMethod === 'bank' ? '#2563EB' : '#6B7280'} className="mr-1.5" />
                            <Text className={`text-xs font-black uppercase ${paymentMethod === 'bank' ? 'text-blue-800' : 'text-gray-600'}`}>
                                Bank Deposit
                            </Text>
                        </Pressable>
                    </View>

                    {/* Bank Account Picker */}
                    {paymentMethod === 'bank' && bankAccounts.length > 0 && (
                        <View className="p-3 bg-blue-50 rounded-2xl border border-blue-100">
                            <Text className="text-[10px] font-black text-blue-800 uppercase mb-2">Select Receiving Bank Account</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                                {bankAccounts.map((acc) => (
                                    <Pressable
                                        key={acc.id}
                                        onPress={() => setSelectedBankId(acc.id)}
                                        className={`p-3 mr-2 rounded-xl border ${selectedBankId === acc.id ? 'bg-white border-blue-500 shadow-sm' : 'bg-blue-100/50 border-blue-200'}`}
                                    >
                                        <Text className="font-bold text-xs text-gray-900">{acc.bankName}</Text>
                                        <Text className="text-[10px] text-gray-600">{acc.accountNumber}</Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>
                    )}
                </View>

                {/* Particulars / Remarks */}
                <View className="mb-8">
                    <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Particulars / Description</Text>
                    <TextInput
                        className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 h-24"
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        textAlignVertical="top"
                        placeholder="Additional details, purpose, or reference..."
                        placeholderTextColor="#9CA3AF"
                    />
                </View>

                {/* Submit Button */}
                <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    className={`w-full py-4 rounded-2xl items-center flex-row justify-center shadow-md ${
                        saving ? 'bg-emerald-400' : 'bg-emerald-600 active:bg-emerald-700'
                    }`}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <MaterialIcons name="check-circle" size={22} color="#fff" className="mr-2" />
                            <Text className="text-white font-black text-lg uppercase tracking-wider">Issue Official Receipt</Text>
                        </>
                    )}
                </Pressable>
            </View>

            {/* Official Receipt Modal / Dialog */}
            <Modal
                visible={receiptModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setReceiptModalVisible(false)}
            >
                <View className="flex-1 bg-black/60 items-center justify-center p-4">
                    <View className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-gray-100">
                        {/* Header Badge */}
                        <View className="items-center mb-4">
                            <View className="w-14 h-14 bg-emerald-100 rounded-full items-center justify-center mb-2">
                                <MaterialIcons name="done-all" size={32} color="#059669" />
                            </View>
                            <Text className="text-gray-900 font-black text-xl">Official Receipt Issued</Text>
                            <Text className="text-gray-500 text-xs mt-0.5">Recorded & Auto-posted to Accounting</Text>
                        </View>

                        {/* Printable Receipt Paper Mock */}
                        <View className="bg-gray-50 rounded-2xl p-4 border border-gray-200 mb-6">
                            <View className="border-b border-dashed border-gray-300 pb-3 mb-3">
                                <Text className="font-black text-center text-sm text-gray-900 uppercase">POSCURSOR COOPERATIVE</Text>
                                <Text className="text-[10px] text-center text-gray-500">Official Non-Loan Receipt</Text>
                            </View>

                            <View className="flex-row justify-between mb-1.5">
                                <Text className="text-xs text-gray-500 font-medium">Receipt No:</Text>
                                <Text className="text-xs text-gray-900 font-black">{savedReceipt?.receiptNumber}</Text>
                            </View>

                            <View className="flex-row justify-between mb-1.5">
                                <Text className="text-xs text-gray-500 font-medium">Date:</Text>
                                <Text className="text-xs text-gray-900 font-bold">{formatDate(new Date(savedReceipt?.transactionDate || Date.now()))}</Text>
                            </View>

                            <View className="flex-row justify-between mb-1.5">
                                <Text className="text-xs text-gray-500 font-medium">Received From:</Text>
                                <Text className="text-xs text-gray-900 font-bold">{savedReceipt?.payorName}</Text>
                            </View>

                            <View className="flex-row justify-between mb-1.5">
                                <Text className="text-xs text-gray-500 font-medium">Category:</Text>
                                <Text className="text-xs text-emerald-800 font-black">{savedReceipt?.categoryLabel}</Text>
                            </View>

                            <View className="flex-row justify-between mb-2">
                                <Text className="text-xs text-gray-500 font-medium">Channel:</Text>
                                <Text className="text-xs text-gray-700 font-bold uppercase">{savedReceipt?.paymentMethod === 'bank' ? 'Bank Deposit' : 'Cash on Hand'}</Text>
                            </View>

                            {savedReceipt?.notes ? (
                                <View className="mb-2 p-2 bg-white rounded-lg border border-gray-100">
                                    <Text className="text-[10px] text-gray-500">Particulars: {savedReceipt.notes}</Text>
                                </View>
                            ) : null}

                            <View className="border-t border-dashed border-gray-300 pt-3 flex-row justify-between items-center">
                                <Text className="text-sm font-black text-gray-900">Total Amount:</Text>
                                <Text className="text-xl font-black text-emerald-600">{formatPHP(savedReceipt?.amount || 0)}</Text>
                            </View>
                        </View>

                        {/* Modal Action Buttons */}
                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={handleResetForm}
                                className="flex-1 py-3.5 bg-gray-100 rounded-xl items-center justify-center active:bg-gray-200"
                            >
                                <Text className="text-gray-800 font-bold text-xs uppercase">New Receipt</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    setReceiptModalVisible(false);
                                    router.push('/(admin)/reports/other-receipts');
                                }}
                                className="flex-1 py-3.5 bg-emerald-600 rounded-xl items-center justify-center active:bg-emerald-700"
                            >
                                <Text className="text-white font-black text-xs uppercase">View All Receipts</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}
