import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { AccountsPayableService } from '../../../src/services/AccountsPayableService';
import Supplier from '../../../src/database/models/Supplier';

export default function Suppliers() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [createVisible, setCreateVisible] = useState(false);

    // Form states
    const [name, setName] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [tin, setTin] = useState('');
    const [paymentTermsDays, setPaymentTermsDays] = useState('30');
    const [saving, setSaving] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const list = await AccountsPayableService.getSuppliers(false);
            setSuppliers(list);
        } catch (err) {
            console.error('Failed to load suppliers:', err);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const handleCreateSupplier = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter a supplier name.');
            return;
        }

        setSaving(true);
        try {
            await AccountsPayableService.createSupplier({
                name: name.trim(),
                contactPerson: contactPerson.trim() || undefined,
                phone: phone.trim() || undefined,
                email: email.trim() || undefined,
                address: address.trim() || undefined,
                tin: tin.trim() || undefined,
                paymentTermsDays: parseInt(paymentTermsDays, 10) || 30,
            });

            Alert.alert('Success', 'Supplier registered successfully.');
            setCreateVisible(false);
            // Reset form
            setName('');
            setContactPerson('');
            setPhone('');
            setEmail('');
            setAddress('');
            setTin('');
            setPaymentTermsDays('30');
            await loadData();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to create supplier.');
        } finally {
            setSaving(false);
        }
    };

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.contactPerson ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.tin ?? '').includes(searchQuery)
    );

    return (
        <View className="flex-1 bg-gray-50">
            {/* Action Bar */}
            <View className="bg-white border-b border-gray-100 p-4">
                <View className="flex-row justify-between items-center mb-3">
                    <View>
                        <Text className="text-gray-900 font-black text-xl">Suppliers & Vendors</Text>
                        <Text className="text-gray-600 text-xs font-medium">Approved Vendor Masterlist & Terms</Text>
                    </View>
                    <Pressable
                        onPress={() => setCreateVisible(true)}
                        className="bg-blue-900 px-4 py-2.5 rounded-xl active:bg-blue-800 flex-row items-center"
                    >
                        <MaterialIcons name="add" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text className="text-white font-bold text-xs">Add Supplier</Text>
                    </Pressable>
                </View>

                {/* Search Bar */}
                <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2">
                    <MaterialIcons name="search" size={20} color="#9CA3AF" />
                    <TextInput
                        className="flex-1 ml-2 text-sm text-gray-900"
                        placeholder="Search by vendor name, contact person, or TIN..."
                        placeholderTextColor="#9CA3AF"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#1E3A8A" />
                    <Text className="text-gray-600 text-xs font-bold mt-2">Loading Suppliers...</Text>
                </View>
            ) : (
                <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
                    {filteredSuppliers.length === 0 ? (
                        <View className="bg-white p-8 rounded-3xl border border-gray-100 items-center justify-center py-16">
                            <MaterialIcons name="business" size={40} color="#9CA3AF" />
                            <Text className="text-gray-700 font-bold text-sm mt-3">No Suppliers Found</Text>
                            <Text className="text-gray-600 text-xs text-center mt-1">Tap "Add Supplier" to register a supplier for purchase vouchers.</Text>
                        </View>
                    ) : (
                        filteredSuppliers.map(s => (
                            <View
                                key={s.id}
                                className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-3 flex-row justify-between items-center"
                            >
                                <View className="flex-1 mr-4">
                                    <View className="flex-row items-center">
                                        <Text className="text-gray-900 font-bold text-sm">{s.name}</Text>
                                        <View className={`px-2 py-0.5 rounded-full ml-2 ${s.isActive ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                                            <Text className={`text-[8px] font-bold uppercase ${s.isActive ? 'text-emerald-800' : 'text-gray-600'}`}>
                                                {s.isActive ? 'Active' : 'Inactive'}
                                            </Text>
                                        </View>
                                    </View>
                                    {s.contactPerson && (
                                        <Text className="text-gray-600 text-xs mt-1">Contact: {s.contactPerson}</Text>
                                    )}
                                    <View className="flex-row items-center mt-1.5 flex-wrap">
                                        {s.phone && (
                                            <Text className="text-gray-600 text-[10px] mr-3">📞 {s.phone}</Text>
                                        )}
                                        {s.tin && (
                                            <Text className="text-gray-600 text-[10px] mr-3">TIN: {s.tin}</Text>
                                        )}
                                        <Text className="text-gray-600 text-[10px]">Terms: {s.paymentTermsDays ?? 30} days</Text>
                                    </View>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            )}

            {/* Create Supplier Modal */}
            <Modal
                visible={createVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setCreateVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-3xl p-6 h-[85%]">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-gray-900 font-black text-lg">Register New Supplier</Text>
                            <Pressable onPress={() => setCreateVisible(false)} className="p-1">
                                <MaterialIcons name="close" size={24} color="#6B7280" />
                            </Pressable>
                        </View>

                        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                            <Text className="text-gray-600 text-xs font-bold uppercase mb-1">Company / Vendor Name *</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-sm mb-3 text-gray-900"
                                placeholder="e.g. San Miguel Feeds Corp."
                                placeholderTextColor="#9CA3AF"
                                value={name}
                                onChangeText={setName}
                            />

                            <Text className="text-gray-600 text-xs font-bold uppercase mb-1">Contact Person</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-sm mb-3 text-gray-900"
                                placeholder="e.g. Maria Santos"
                                placeholderTextColor="#9CA3AF"
                                value={contactPerson}
                                onChangeText={setContactPerson}
                            />

                            <View className="flex-row justify-between mb-3">
                                <View className="w-[48%]">
                                    <Text className="text-gray-600 text-[10px] font-bold uppercase mb-1">Phone Number</Text>
                                    <TextInput
                                        className="bg-gray-100 rounded-xl px-3 py-2.5 text-xs text-gray-900"
                                        placeholder="0917-000-0000"
                                        placeholderTextColor="#9CA3AF"
                                        value={phone}
                                        onChangeText={setPhone}
                                    />
                                </View>
                                <View className="w-[48%]">
                                    <Text className="text-gray-600 text-[10px] font-bold uppercase mb-1">TIN</Text>
                                    <TextInput
                                        className="bg-gray-100 rounded-xl px-3 py-2.5 text-xs text-gray-900"
                                        placeholder="000-000-000-000"
                                        placeholderTextColor="#9CA3AF"
                                        value={tin}
                                        onChangeText={setTin}
                                    />
                                </View>
                            </View>

                            <Text className="text-gray-600 text-xs font-bold uppercase mb-1">Email Address</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-sm mb-3 text-gray-900"
                                placeholder="vendor@example.com"
                                placeholderTextColor="#9CA3AF"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                            />

                            <Text className="text-gray-600 text-xs font-bold uppercase mb-1">Business Address</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-sm mb-3 text-gray-900"
                                placeholder="Street, Barangay, Municipality/City"
                                placeholderTextColor="#9CA3AF"
                                value={address}
                                onChangeText={setAddress}
                            />

                            <Text className="text-gray-600 text-xs font-bold uppercase mb-1">Payment Terms (Days)</Text>
                            <TextInput
                                className="bg-gray-100 rounded-xl px-4 py-3 text-sm mb-6 text-gray-900"
                                placeholder="30"
                                placeholderTextColor="#9CA3AF"
                                value={paymentTermsDays}
                                onChangeText={setPaymentTermsDays}
                                keyboardType="numeric"
                            />

                            {/* Submit */}
                            <View className="flex-row">
                                <Pressable
                                    onPress={() => setCreateVisible(false)}
                                    className="flex-1 bg-gray-100 py-3.5 rounded-xl mr-2 items-center"
                                >
                                    <Text className="text-gray-700 font-bold text-sm">Cancel</Text>
                                </Pressable>
                                <Pressable
                                    onPress={handleCreateSupplier}
                                    disabled={saving}
                                    className="flex-1 bg-blue-900 py-3.5 rounded-xl ml-2 items-center active:bg-blue-800"
                                >
                                    <Text className="text-white font-bold text-sm">
                                        {saving ? 'Saving...' : 'Save Supplier'}
                                    </Text>
                                </Pressable>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
