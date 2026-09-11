import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Modal, Switch } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { WsCustomerService } from '../../../../src/modules/water-station/services/WsCustomerService';
import WsCustomer from '../../../../src/database/models/WsCustomer';
import { SearchBar } from '../../../../src/components/SearchBar';

export default function WaterStationCustomers() {
    const router = useRouter();
    const [customers, setCustomers] = useState<WsCustomer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [addModalVisible, setAddModalVisible] = useState(false);
    
    // Form fields
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [isMember, setIsMember] = useState(false);
    const [memberId, setMemberId] = useState('');

    const loadCustomers = async () => {
        setLoading(true);
        try {
            const list = await WsCustomerService.getAll();
            setCustomers(list);
        } catch (error) {
            console.error('Failed to load water station customers:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            void loadCustomers();
        }, [])
    );

    const handleAddCustomer = async () => {
        if (!name.trim()) {
            Alert.alert('Validation Error', 'Name is required.');
            return;
        }

        try {
            await WsCustomerService.create({
                name,
                phone: phone.trim() || undefined,
                address: address.trim() || undefined,
                isMember,
                memberId: memberId.trim() || undefined
            });
            Alert.alert('Success', 'Customer added successfully.');
            setAddModalVisible(false);
            
            // Clear inputs
            setName('');
            setPhone('');
            setAddress('');
            setIsMember(false);
            setMemberId('');
            
            await loadCustomers();
        } catch (error: any) {
            Alert.alert('Error', `Failed to create customer: ${error.message}`);
        }
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.phone || '').includes(searchQuery) ||
        (c.address || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <View className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-200">
                <View className="flex-row items-center">
                    <Pressable onPress={() => router.back()} className="mr-3 bg-gray-50 p-2 rounded-lg active:bg-gray-150">
                        <MaterialIcons name="arrow-back" size={20} color="#1E3A8A" />
                    </Pressable>
                    <Text className="text-lg font-bold text-gray-900">WS Customers</Text>
                </View>
                <Pressable 
                    onPress={() => setAddModalVisible(true)}
                    className="bg-blue-900 px-3 py-2 rounded-lg flex-row items-center active:bg-blue-800"
                >
                    <MaterialIcons name="add" size={18} color="#FFFFFF" />
                    <Text className="text-white text-xs font-bold ml-1">New Customer</Text>
                </Pressable>
            </View>

            {/* Search Bar */}
            <View className="p-4">
                <SearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search customers by name, phone, address..."
                />
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#1E3A8A" />
                </View>
            ) : (
                <ScrollView className="flex-1 px-4">
                    {filteredCustomers.length === 0 ? (
                        <Text className="text-gray-500 text-center mt-10">No customers found.</Text>
                    ) : (
                        filteredCustomers.map(customer => (
                            <View key={customer.id} className="bg-white p-4 rounded-xl mb-3 border border-gray-150 flex-row justify-between items-center shadow-xs">
                                <View className="flex-1 pr-2">
                                    <View className="flex-row items-center">
                                        <Text className="text-base font-bold text-gray-900">{customer.name}</Text>
                                        <View className={`ml-2 px-2 py-0.5 rounded-full ${customer.isMember ? 'bg-blue-50' : 'bg-gray-100'}`}>
                                            <Text className={`text-[10px] font-semibold ${customer.isMember ? 'text-blue-700' : 'text-gray-600'}`}>
                                                {customer.isMember ? 'COOP MEMBER' : 'RETAIL'}
                                            </Text>
                                        </View>
                                    </View>
                                    {customer.phone && (
                                        <View className="flex-row items-center mt-1">
                                            <MaterialIcons name="phone" size={14} color="#64748B" />
                                            <Text className="text-xs text-gray-500 ml-1">{customer.phone}</Text>
                                        </View>
                                    )}
                                    {customer.address && (
                                        <View className="flex-row items-center mt-1">
                                            <MaterialIcons name="location-on" size={14} color="#64748B" />
                                            <Text className="text-xs text-gray-500 ml-1">{customer.address}</Text>
                                        </View>
                                    )}
                                </View>
                                <Pressable
                                    onPress={() => Alert.alert('Actions', `Edit info for ${customer.name}`)}
                                    className="bg-gray-50 p-2 rounded-lg border border-gray-200 active:bg-gray-100"
                                >
                                    <MaterialIcons name="edit" size={18} color="#475569" />
                                </Pressable>
                            </View>
                        ))
                    )}
                </ScrollView>
            )}

            {/* Add Customer Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={addModalVisible}
                onRequestClose={() => setAddModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-3xl p-6 h-[80%]">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-lg font-bold text-gray-900">Add New WS Customer</Text>
                            <Pressable onPress={() => setAddModalVisible(false)} className="bg-gray-100 p-1 rounded-full">
                                <MaterialIcons name="close" size={20} color="#64748B" />
                            </Pressable>
                        </View>

                        <ScrollView className="space-y-4">
                            <View>
                                <Text className="text-sm font-bold text-gray-700 mb-1">Full Name</Text>
                                <TextInput
                                    className="border border-gray-200 rounded-lg p-3 bg-gray-50 text-gray-900"
                                    placeholder="Enter full name"
                                    value={name}
                                    onChangeText={setName}
                                 placeholderTextColor="#9CA3AF"/>
                            </View>

                            <View>
                                <Text className="text-sm font-bold text-gray-700 mb-1">Phone Number</Text>
                                <TextInput
                                    className="border border-gray-200 rounded-lg p-3 bg-gray-50 text-gray-900"
                                    placeholder="e.g. 09123456789"
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                 placeholderTextColor="#9CA3AF"/>
                            </View>

                            <View>
                                <Text className="text-sm font-bold text-gray-700 mb-1">Address</Text>
                                <TextInput
                                    className="border border-gray-200 rounded-lg p-3 bg-gray-50 text-gray-900"
                                    placeholder="Enter delivery address"
                                    value={address}
                                    onChangeText={setAddress}
                                 placeholderTextColor="#9CA3AF"/>
                            </View>

                            <View className="flex-row items-center justify-between py-2">
                                <View>
                                    <Text className="text-sm font-bold text-gray-700">Is Cooperative Member?</Text>
                                    <Text className="text-xs text-gray-400">Links account with coop statistics</Text>
                                </View>
                                <Switch
                                    value={isMember}
                                    onValueChange={setIsMember}
                                    trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                                    thumbColor={isMember ? '#1E3A8A' : '#F3F4F6'}
                                />
                            </View>

                            {isMember && (
                                <View>
                                    <Text className="text-sm font-bold text-gray-700 mb-1">Coop Member ID</Text>
                                    <TextInput
                                        className="border border-gray-200 rounded-lg p-3 bg-gray-50 text-gray-900"
                                        placeholder="Enter Member database ID"
                                        value={memberId}
                                        onChangeText={setMemberId}
                                     placeholderTextColor="#9CA3AF"/>
                                </View>
                            )}

                            <Pressable
                                onPress={handleAddCustomer}
                                className="bg-blue-900 py-3 rounded-lg mt-6 active:bg-blue-800 items-center justify-center"
                            >
                                <Text className="text-white font-bold">Save Customer</Text>
                            </Pressable>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
