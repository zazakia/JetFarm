import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert, Platform, Modal, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import BaseModelService from '../../../src/services/BaseModelService';
import { formatDate } from '../../../src/utils/dates';
import { formatPHP } from '../../../src/utils/currency';
import ConfirmDialog from '../../../src/components/ConfirmDialog';
import { PhpCurrencyText } from '../../../src/components/PhpCurrencyText';

type DeletedItem = {
    id: string;
    display_name: string;
    subtitle?: string;
    deleted_at: number;
    type: string;
    model: any;
    related_info?: Record<string, string>;
};

const CATEGORIES = [
    { id: 'borrowers', label: 'Members', icon: 'people' },
    { id: 'loans', label: 'Loans', icon: 'receipt-long' },
    { id: 'payments', label: 'Payments', icon: 'payments' },
    { id: 'expenses', label: 'Expenses', icon: 'account-balance-wallet' },
];

const HIDDEN_FIELDS = ['id', 'deletedAt', 'createdAt', 'updatedAt', '_status', '_changed', 'borrowerId', 'loanId', 'collectorId', 'authId', 'previousLoanId', 'borrower_id', 'loan_id', 'collector_id', 'schedule_id', 'scheduleId'];

const FIELD_LABELS: Record<string, string> = {
    fullName: 'Full Name',
    full_name: 'Full Name',
    firstName: 'First Name',
    first_name: 'First Name',
    lastName: 'Last Name',
    last_name: 'Last Name',
    loanNumber: 'Loan #',
    loan_number: 'Loan #',
    principalAmount: 'Principal',
    principal_amount: 'Principal',
    interestRate: 'Interest Rate',
    interest_rate: 'Interest Rate',
    interestType: 'Interest Type',
    interest_type: 'Interest Type',
    totalAmount: 'Total Amount',
    total_amount: 'Total Amount',
    installmentAmount: 'Installment',
    installment_amount: 'Installment',
    releaseDate: 'Release Date',
    release_date: 'Release Date',
    maturityDate: 'Maturity Date',
    maturity_date: 'Maturity Date',
    firstPaymentDate: 'First Payment',
    first_payment_date: 'First Payment',
    status: 'Status',
    amount: 'Amount',
    paymentDate: 'Payment Date',
    payment_date: 'Payment Date',
    description: 'Description',
    category: 'Category',
    date: 'Date',
    notes: 'Notes',
    address: 'Address',
    phone: 'Phone',
    area: 'Area',
    term: 'Term',
    termUnit: 'Unit',
    term_unit: 'Unit',
    frequency: 'Frequency',
    depositAmount: 'Deposit',
    deposit_amount: 'Deposit',
    insuranceAmount: 'Insurance',
    insurance_amount: 'Insurance',
    deductedAmount: 'Deducted',
    deducted_amount: 'Deducted',
    interestAmount: 'Interest Amount',
    interest_amount: 'Interest Amount',
    batch: 'Batch',
    cycle: 'Cycle',
    loanBatch: 'Batch',
    loanCycle: 'Cycle',
    loan_batch: 'Batch',
    loan_cycle: 'Cycle',
    paymentMethod: 'Method',
    payment_method: 'Method',
    referenceNumber: 'Ref #',
    reference_number: 'Ref #',
    encodedBy: 'Encoded By',
    encoded_by: 'Encoded By',
    createdBy: 'Created By',
    created_by: 'Created By',
    receiptNumber: 'Receipt #',
    receipt_number: 'Receipt #',
};

export default function DeletedItemsScreen() {
    const [activeTab, setActiveTab] = useState('borrowers');
    const [items, setItems] = useState<DeletedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<DeletedItem | null>(null);
    const [isRestoreVisible, setIsRestoreVisible] = useState(false);
    const [isDetailsVisible, setIsDetailsVisible] = useState(false);

    const loadDeleted = async () => {
        setLoading(true);
        try {
            const fetched = await BaseModelService.fetchDeleted(activeTab);
            const mapped = await Promise.all(fetched.map(async (m: any) => {
                let displayName = m.id;
                let subtitle = '';
                let relatedInfo: Record<string, string> = {};

                if (activeTab === 'borrowers') {
                    displayName = m.fullName || m.id;
                } else if (activeTab === 'loans') {
                    displayName = m.loanNumber ? `Loan #${m.loanNumber}` : m.id;
                    try {
                        const borrower = await m.borrower.fetch();
                        if (borrower) {
                            subtitle = `Borrower: ${borrower.fullName}`;
                            relatedInfo['Borrower'] = borrower.fullName;
                        }
                    } catch (e) {
                        console.log('Error fetching borrower for loan:', e);
                    }
                } else if (activeTab === 'payments') {
                    displayName = `Payment: ${formatPHP(m.amount)}`;
                    if (m.receiptNumber) displayName += ` (#${m.receiptNumber})`;
                    try {
                        const loan = await m.loan.fetch();
                        if (loan) {
                            const borrower = await loan.borrower.fetch();
                            subtitle = `Loan #${loan.loanNumber || loan.id} - ${borrower?.fullName || 'Unknown'}`;
                            relatedInfo['Loan Info'] = `Loan #${loan.loanNumber || loan.id}`;
                            if (borrower) relatedInfo['Borrower'] = borrower.fullName;
                        }
                    } catch (e) {
                        console.log('Error fetching relation for payment:', e);
                    }
                } else if (activeTab === 'expenses') {
                    displayName = `${m.category || 'Expense'}: ${formatPHP(m.amount)}`;
                }
                
                return {
                    id: m.id,
                    display_name: displayName,
                    subtitle,
                    deleted_at: m.deletedAt,
                    type: activeTab,
                    model: m,
                    related_info: relatedInfo
                };
            }));
            setItems(mapped);
        } catch (error) {
            console.error('Failed to load deleted items:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadDeleted();
        }, [activeTab])
    );

    const handleRestore = async () => {
        if (!selectedItem) return;
        try {
            await BaseModelService.restore(selectedItem.model);
            setIsRestoreVisible(false);
            loadDeleted();
            if (Platform.OS === 'web') {
                window.alert(`${selectedItem.display_name} has been restored.`);
            } else {
                Alert.alert("Success", "Record restored successfully.");
            }
        } catch (error) {
            console.error('Failed to restore:', error);
            Alert.alert("Error", "Could not restore the item.");
        }
    };

    const renderDetailRow = (key: string, value: any) => {
        if (value === null || value === undefined || value === '' || HIDDEN_FIELDS.includes(key)) return null;
        
        const label = FIELD_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ').replace(/([A-Z])/g, ' $1');
        let displayValue: React.ReactNode = String(value);

        const isAmount = key.toLowerCase().includes('amount') || key.toLowerCase().includes('balance') || key.toLowerCase().includes('principal');
        const isRate = key.toLowerCase().includes('rate');
        const isDate = key.toLowerCase().includes('date') || key === 'date';

        if (typeof value === 'number' && isAmount) {
            displayValue = <PhpCurrencyText amount={value} className="text-gray-900 font-medium" />;
        } else if (typeof value === 'number' && isRate) {
            displayValue = `${value}%`;
        } else if (isDate && (typeof value === 'number' || value instanceof Date)) {
            displayValue = formatDate(new Date(value));
        } else if (typeof value === 'boolean') {
            displayValue = value ? 'Yes' : 'No';
        }

        return (
            <View key={key} className="flex-row justify-between py-3 border-b border-gray-50">
                <Text className="text-gray-700 text-sm">{label}</Text>
                <View className="flex-1 items-end ml-4">
                    {typeof displayValue === 'string' ? (
                        <Text className="text-gray-900 font-medium text-sm text-right">{displayValue}</Text>
                    ) : (
                        displayValue
                    )}
                </View>
            </View>
        );
    };

    const renderItem = ({ item }: { item: DeletedItem }) => (
        <View className="bg-white p-4 rounded-xl mb-3 border border-gray-100 shadow-sm">
            <View className="flex-row items-center mb-3">
                <View className="flex-1">
                    <Text className="text-base font-bold text-gray-900">{item.display_name}</Text>
                    {item.subtitle ? (
                        <Text className="text-sm text-indigo-600 font-medium mt-0.5">{item.subtitle}</Text>
                    ) : null}
                    <Text className="text-xs text-gray-700 mt-1">
                        Deleted on {formatDate(new Date(item.deleted_at))}
                    </Text>
                </View>
                <Pressable 
                    onPress={() => {
                        setSelectedItem(item);
                        setIsDetailsVisible(true);
                    }}
                    className="p-2 bg-gray-50 rounded-full border border-gray-100 active:bg-gray-100"
                >
                    <MaterialIcons name="info-outline" size={20} color="#6366F1" />
                </Pressable>
            </View>
            
            <View className="flex-row space-x-2">
                <Pressable 
                    onPress={() => {
                        setSelectedItem(item);
                        setIsRestoreVisible(true);
                    }}
                    className="flex-1 bg-green-50 py-2.5 rounded-lg flex-row items-center justify-center border border-green-100 active:bg-green-100"
                >
                    <MaterialIcons name="restore" size={18} color="#355E3B" />
                    <Text className="text-green-700 font-bold ml-1.5 text-xs">Restore Record</Text>
                </Pressable>
            </View>
        </View>
    );

    return (
        <View className="flex-1 bg-gray-50">
            {/* Header Tabs */}
            <View className="bg-white border-b border-gray-200">
                <FlatList
                    horizontal
                    data={CATEGORIES}
                    keyExtractor={(c) => c.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ padding: 12 }}
                    renderItem={({ item }) => (
                        <Pressable
                            onPress={() => setActiveTab(item.id)}
                            className={`flex-row items-center px-4 py-2 rounded-full mr-2 ${
                                activeTab === item.id ? 'bg-blue-900' : 'bg-gray-100'
                            }`}
                        >
                            <MaterialIcons 
                                name={item.icon as any} 
                                size={18} 
                                color={activeTab === item.id ? 'white' : '#6B7280'} 
                            />
                            <Text className={`ml-2 font-bold text-sm ${
                                activeTab === item.id ? 'text-white' : 'text-gray-600'
                            }`}>
                                {item.label}
                            </Text>
                        </Pressable>
                    )}
                />
            </View>

            <View className="flex-1 p-4">
                <View className="flex-row items-center mb-4">
                    <Ionicons name="trash-outline" size={24} color="#6B7280" />
                    <Text className="text-lg font-bold text-gray-800 ml-2">Trash: {CATEGORIES.find(c => c.id === activeTab)?.label}</Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#1E3A8A" className="mt-10" />
                ) : (
                    <FlatList
                        data={items}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View className="items-center justify-center py-20">
                                <View className="bg-gray-100 p-6 rounded-full">
                                    <MaterialIcons name="delete-sweep" size={64} color="#D1D5DB" />
                                </View>
                                <Text className="text-gray-700 font-medium mt-4 text-base">No deleted {activeTab} found</Text>
                            </View>
                        }
                    />
                )}
            </View>

            <ConfirmDialog
                visible={isRestoreVisible}
                title="Restore Record?"
                message={`Are you sure you want to restore ${selectedItem?.display_name}? This will make it visible again in the main lists.`}
                confirmLabel="Restore"
                isDestructive={false}
                onConfirm={handleRestore}
                onCancel={() => setIsRestoreVisible(false)}
            />

            {/* Details Modal */}
            <Modal
                visible={isDetailsVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setIsDetailsVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-3xl h-[80%]">
                        <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
                            <View className="flex-row items-center">
                                <View className="bg-indigo-50 p-2 rounded-lg mr-3">
                                    <MaterialIcons name="info" size={20} color="#6366F1" />
                                </View>
                                <Text className="text-lg font-bold text-gray-900">Record Details</Text>
                            </View>
                            <Pressable 
                                onPress={() => setIsDetailsVisible(false)}
                                className="p-2 bg-gray-50 rounded-full"
                            >
                                <MaterialIcons name="close" size={24} color="#6B7280" />
                            </Pressable>
                        </View>

                        <ScrollView className="p-4">
                            {selectedItem?.related_info && Object.keys(selectedItem.related_info).length > 0 && (
                                <View className="mb-6 space-y-1">
                                    <Text className="text-xs font-bold text-indigo-400 uppercase mb-2 ml-1">Contextual Info</Text>
                                    {Object.entries(selectedItem.related_info).map(([label, val]) => (
                                        <View key={label} className="flex-row justify-between py-3 border-b border-indigo-50 bg-indigo-50/20 px-3 rounded-xl mb-1">
                                            <Text className="text-indigo-600 text-sm font-bold">{label}</Text>
                                            <Text className="text-indigo-900 font-bold text-sm text-right flex-1 ml-4">{val}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <View className="bg-gray-50 p-4 rounded-xl mb-4 border border-gray-100">
                                <Text className="text-xs font-bold text-gray-700 uppercase mb-1">Record ID</Text>
                                <Text className="text-sm font-mono text-gray-600 select-all">{selectedItem?.id}</Text>
                            </View>

                            <View className="space-y-1">
                                <Text className="text-xs font-bold text-gray-700 uppercase mb-2 ml-1">Database Fields</Text>
                                {selectedItem && Object.keys(selectedItem.model._raw).map(key => 
                                    renderDetailRow(key, selectedItem.model._raw[key])
                                )}
                            </View>

                            <View className="h-20" />
                        </ScrollView>

                        <View className="p-4 border-t border-gray-100 bg-white">
                            <Pressable
                                onPress={() => {
                                    setIsDetailsVisible(false);
                                    setIsRestoreVisible(true);
                                }}
                                className="bg-blue-900 py-4 rounded-xl items-center shadow-lg shadow-indigo-200"
                            >
                                <Text className="text-white font-bold text-base">Restore This Record</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
