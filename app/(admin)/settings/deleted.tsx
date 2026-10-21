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
    { id: 'agri_parcels', label: 'Parcels', icon: 'landscape' },
    { id: 'agri_crop_cycles', label: 'Crop Cycles', icon: 'agriculture' },
    { id: 'agri_weekly_settlements', label: 'Settlements', icon: 'event-note' },
    { id: 'expenses', label: 'Expenses', icon: 'account-balance-wallet' },
    { id: 'journal_entries', label: 'Journal Entries', icon: 'book' },
    { id: 'suppliers', label: 'Suppliers', icon: 'business' },
];

/** Human label per soft-deletable table this build ships. */
const describeDeleted = (tableName: string, m: any): { title: string; subtitle: string } => {
    switch (tableName) {
        case 'agri_parcels':
            return { title: m.name || m.id, subtitle: m.code ? `Parcel ${m.code}` : '' };
        case 'agri_crop_cycles':
            return {
                title: m.cycle_code || m.id,
                subtitle: `${m.crop_type || 'Crop'} · ${m.area_planted_ha ?? 0} ha`,
            };
        case 'agri_weekly_settlements':
            return {
                title: `Week ${m.week_number ?? '?'} settlement`,
                subtitle: m.receipt_reference
                    ? `Receipt ${m.receipt_reference}`
                    : formatPHP(m.net_payout_due_this_week ?? 0),
            };
        case 'expenses':
            return {
                title: `${m.category || 'Expense'}: ${formatPHP(m.amount)}`,
                subtitle: m.description || m.payee || '',
            };
        case 'journal_entries':
            return { title: m.reference_number || 'Journal entry', subtitle: m.description || '' };
        case 'suppliers':
            return { title: m.name || m.id, subtitle: m.contact_person || '' };
        default:
            return { title: m.id, subtitle: '' };
    }
};

const HIDDEN_FIELDS = ['id', 'deletedAt', 'createdAt', 'updatedAt', '_status', '_changed', 'authId', 'auth_id'];

const FIELD_LABELS: Record<string, string> = {
    name: 'Name',
    code: 'Code',
    fullName: 'Full Name',
    full_name: 'Full Name',
    firstName: 'First Name',
    first_name: 'First Name',
    lastName: 'Last Name',
    last_name: 'Last Name',
    areaHectares: 'Area (ha)',
    area_hectares: 'Area (ha)',
    areaPlantedHa: 'Planted (ha)',
    area_planted_ha: 'Planted (ha)',
    cropType: 'Crop',
    crop_type: 'Crop',
    cycleCode: 'Cycle Code',
    cycle_code: 'Cycle Code',
    soilType: 'Soil Type',
    soil_type: 'Soil Type',
    locationAddress: 'Location',
    location_address: 'Location',
    status: 'Status',
    amount: 'Amount',
    description: 'Description',
    category: 'Category',
    date: 'Date',
    notes: 'Notes',
    address: 'Address',
    phone: 'Phone',
    email: 'Email',
    tin: 'TIN',
    area: 'Area',
    frequency: 'Frequency',
    paymentStatus: 'Payment Status',
    payment_status: 'Payment Status',
    cumulativeKilos: 'Cumulative Kilos',
    cumulative_kilos: 'Cumulative Kilos',
    ratePerKilo: 'Rate / kg',
    rate_per_kilo: 'Rate / kg',
    netPayoutDueThisWeek: 'Payout Due',
    net_payout_due_this_week: 'Payout Due',
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
    const [activeTab, setActiveTab] = useState('agri_parcels');
    const [items, setItems] = useState<DeletedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<DeletedItem | null>(null);
    const [isRestoreVisible, setIsRestoreVisible] = useState(false);
    const [isDetailsVisible, setIsDetailsVisible] = useState(false);

    const loadDeleted = async () => {
        setLoading(true);
        try {
            const fetched = await BaseModelService.fetchDeleted(activeTab);
            const mapped = fetched.map((m: any) => {
                const { title, subtitle } = describeDeleted(activeTab, m);
                return {
                    id: m.id,
                    display_name: title,
                    subtitle,
                    deleted_at: m.deletedAt,
                    type: activeTab,
                    model: m,
                    related_info: {} as Record<string, string>
                };
            });
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
