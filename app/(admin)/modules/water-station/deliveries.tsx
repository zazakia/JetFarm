import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, Modal , Switch } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { WsDeliveryService } from '../../../../src/modules/water-station/services/WsDeliveryService';
import { WsCustomerService } from '../../../../src/modules/water-station/services/WsCustomerService';
import WsDelivery from '../../../../src/database/models/WsDelivery';
import WsCustomer from '../../../../src/database/models/WsCustomer';



export default function WaterStationDeliveries() {
    const router = useRouter();
    const [deliveries, setDeliveries] = useState<WsDelivery[]>([]);
    const [customers, setCustomers] = useState<WsCustomer[]>([]);
    const [loading, setLoading] = useState(true);
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);

    // Form fields
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [gallons, setGallons] = useState('5');
    const [pricePerGallon, setPricePerGallon] = useState('35'); // standard PHP rate
    const [isPaid, setIsPaid] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash'>('cash');

    const loadData = async () => {
        setLoading(true);
        try {
            const list = await WsDeliveryService.getAll();
            const customersList = await WsCustomerService.getAll();
            
            setDeliveries(list.sort((a, b) => b.deliveryDate - a.deliveryDate));
            setCustomers(customersList);
            if (customersList.length > 0) {
                setSelectedCustomerId(customersList[0].id);
            }
        } catch (error) {
            console.error('Failed to load deliveries data:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            void loadData();
        }, [])
    );

    const handleCreateDelivery = async () => {
        if (!selectedCustomerId) {
            Alert.alert('Validation Error', 'Please select a customer.');
            return;
        }

        const galsNum = parseFloat(gallons);
        const priceNum = parseFloat(pricePerGallon);

        if (isNaN(galsNum) || galsNum <= 0) {
            Alert.alert('Validation Error', 'Please enter a valid amount of gallons.');
            return;
        }

        if (isNaN(priceNum) || priceNum <= 0) {
            Alert.alert('Validation Error', 'Please enter a valid price.');
            return;
        }

        try {
            await WsDeliveryService.createDelivery({
                customerId: selectedCustomerId,
                deliveryDate: new Date(),
                gallons: galsNum,
                pricePerGallon: priceNum,
                isPaidOnDelivery: isPaid,
                paymentMethod: isPaid ? paymentMethod : undefined
            });

            Alert.alert('Success', 'Delivery recorded.');
            setAddModalVisible(false);
            await loadData();
        } catch (error: any) {
            Alert.alert('Error', `Failed to record delivery: ${error.message}`);
        }
    };

    const handleCompleteDelivery = async (method: 'cash' | 'gcash') => {
        if (!selectedDeliveryId) return;

        try {
            await WsDeliveryService.completeDelivery(selectedDeliveryId, method);
            Alert.alert('Success', 'Delivery completed and payment posted to Journal.');
            setPaymentModalVisible(false);
            setSelectedDeliveryId(null);
            await loadData();
        } catch (error: any) {
            Alert.alert('Error', `Failed to complete delivery: ${error.message}`);
        }
    };

    const getCustomerName = (id: string) => {
        const found = customers.find(c => c.id === id);
        return found ? found.name : 'Unknown Customer';
    };

    return (
        <View className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="flex-row items-center justify-between p-4 bg-white border-b border-gray-200">
                <View className="flex-row items-center">
                    <Pressable onPress={() => router.back()} className="mr-3 bg-gray-50 p-2 rounded-lg active:bg-gray-150">
                        <MaterialIcons name="arrow-back" size={20} color="#1E3A8A" />
                    </Pressable>
                    <Text className="text-lg font-bold text-gray-900">WS Deliveries</Text>
                </View>
                <Pressable 
                    onPress={() => setAddModalVisible(true)}
                    className="bg-blue-900 px-3 py-2 rounded-lg flex-row items-center active:bg-blue-800"
                >
                    <MaterialIcons name="add" size={18} color="#FFFFFF" />
                    <Text className="text-white text-xs font-bold ml-1">New Delivery</Text>
                </Pressable>
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#1E3A8A" />
                </View>
            ) : (
                <ScrollView className="flex-1 p-4">
                    {deliveries.length === 0 ? (
                        <Text className="text-gray-500 text-center mt-10">No deliveries recorded.</Text>
                    ) : (
                        deliveries.map(delivery => (
                            <View key={delivery.id} className="bg-white p-4 rounded-xl mb-3 border border-gray-150 shadow-xs">
                                <View className="flex-row justify-between items-start">
                                    <View className="flex-1 pr-2">
                                        <Text className="text-sm font-bold text-gray-950">{getCustomerName(delivery.customerId)}</Text>
                                        <Text className="text-xs text-gray-500 mt-1">
                                            {delivery.gallons} gal @ ₱{delivery.pricePerGallon.toFixed(2)}/gal
                                        </Text>
                                        <Text className="text-[10px] text-gray-400 mt-1">
                                            {new Date(delivery.deliveryDate).toLocaleString()}
                                        </Text>
                                    </View>

                                    <View className="items-end">
                                        <Text className="text-base font-bold text-gray-900">₱{delivery.totalAmount.toFixed(2)}</Text>
                                        
                                        {delivery.status === 'pending' ? (
                                            <Pressable
                                                onPress={() => {
                                                    setSelectedDeliveryId(delivery.id);
                                                    setPaymentModalVisible(true);
                                                }}
                                                className="bg-amber-100 px-3 py-1 rounded-full mt-2 active:bg-amber-200"
                                            >
                                                <Text className="text-amber-800 text-[10px] font-bold">COLLECT PAYMENT</Text>
                                            </Pressable>
                                        ) : (
                                            <View className="bg-green-50 px-3 py-1 rounded-full mt-2">
                                                <Text className="text-green-700 text-[10px] font-bold">PAID & DELIVERED</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            )}

            {/* Add Delivery Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={addModalVisible}
                onRequestClose={() => setAddModalVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white rounded-t-3xl p-6 h-[85%]">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-lg font-bold text-gray-900">Record WS Delivery</Text>
                            <Pressable onPress={() => setAddModalVisible(false)} className="bg-gray-100 p-1 rounded-full">
                                <MaterialIcons name="close" size={20} color="#64748B" />
                            </Pressable>
                        </View>

                        <ScrollView className="space-y-4">
                            <View>
                                <Text className="text-sm font-bold text-gray-700 mb-1">Customer</Text>
                                <View className="border border-gray-250 bg-gray-50 rounded-lg p-1">
                                    {customers.length === 0 ? (
                                        <Text className="text-gray-500 p-2">Create a customer first</Text>
                                    ) : (
                                        <View className="bg-white rounded-lg p-2">
                                            {customers.map(c => (
                                                <Pressable
                                                    key={c.id}
                                                    onPress={() => setSelectedCustomerId(c.id)}
                                                    className={`p-3 rounded-lg border mb-1 ${selectedCustomerId === c.id ? 'border-blue-900 bg-blue-50/50' : 'border-gray-100 bg-white'}`}
                                                >
                                                    <Text className="text-sm font-bold text-gray-900">{c.name}</Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            </View>

                            <View className="flex-row justify-between space-x-2">
                                <View className="flex-1">
                                    <Text className="text-sm font-bold text-gray-700 mb-1">Gallons</Text>
                                    <TextInput
                                        className="border border-gray-205 rounded-lg p-3 bg-gray-50 text-gray-900"
                                        placeholder="5"
                                        value={gallons}
                                        onChangeText={setGallons}
                                        keyboardType="numeric"
                                     placeholderTextColor="#9CA3AF"/>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-sm font-bold text-gray-700 mb-1">Price / Gal</Text>
                                    <TextInput
                                        className="border border-gray-205 rounded-lg p-3 bg-gray-50 text-gray-900"
                                        placeholder="35"
                                        value={pricePerGallon}
                                        onChangeText={setPricePerGallon}
                                        keyboardType="numeric"
                                     placeholderTextColor="#9CA3AF"/>
                                </View>
                            </View>

                            <View className="flex-row items-center justify-between py-2 border-t border-gray-100 mt-4">
                                <View>
                                    <Text className="text-sm font-bold text-gray-700">Collect Payment Now?</Text>
                                    <Text className="text-xs text-gray-400">Paid on delivery or Charge sale</Text>
                                </View>
                                <Switch
                                    value={isPaid}
                                    onValueChange={setIsPaid}
                                    trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                                    thumbColor={isPaid ? '#1E3A8A' : '#F3F4F6'}
                                />
                            </View>

                            {isPaid && (
                                <View className="flex-row justify-around py-3 border border-gray-150 rounded-xl bg-gray-50/50">
                                    <Pressable 
                                        onPress={() => setPaymentMethod('cash')}
                                        className={`px-6 py-2 rounded-lg border ${paymentMethod === 'cash' ? 'border-blue-900 bg-blue-900/10' : 'border-gray-200 bg-white'}`}
                                    >
                                        <Text className={`text-xs font-bold ${paymentMethod === 'cash' ? 'text-blue-900' : 'text-gray-500'}`}>CASH</Text>
                                    </Pressable>
                                    <Pressable 
                                        onPress={() => setPaymentMethod('gcash')}
                                        className={`px-6 py-2 rounded-lg border ${paymentMethod === 'gcash' ? 'border-blue-900 bg-blue-900/10' : 'border-gray-200 bg-white'}`}
                                    >
                                        <Text className={`text-xs font-bold ${paymentMethod === 'gcash' ? 'text-blue-900' : 'text-gray-500'}`}>GCASH</Text>
                                    </Pressable>
                                </View>
                            )}

                            <Pressable
                                onPress={handleCreateDelivery}
                                className="bg-blue-900 py-3 rounded-lg mt-6 active:bg-blue-800 items-center justify-center"
                            >
                                <Text className="text-white font-bold">Post Delivery</Text>
                            </Pressable>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Collect Payment Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={paymentModalVisible}
                onRequestClose={() => setPaymentModalVisible(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/50 p-6">
                    <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
                        <Text className="text-lg font-bold text-gray-900 mb-2">Collect Payment</Text>
                        <Text className="text-sm text-gray-500 mb-6">Select the payment method to complete the delivery.</Text>
                        
                        <View className="space-y-3">
                            <Pressable
                                onPress={() => handleCompleteDelivery('cash')}
                                className="bg-blue-900 py-3 rounded-lg items-center active:bg-blue-800"
                            >
                                <Text className="text-white font-bold">CASH PAYMENT</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => handleCompleteDelivery('gcash')}
                                className="bg-green-600 py-3 rounded-lg items-center active:bg-green-700 mt-2"
                            >
                                <Text className="text-white font-bold">GCASH PAYMENT</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => setPaymentModalVisible(false)}
                                className="bg-gray-100 py-3 rounded-lg items-center active:bg-gray-200 mt-2"
                            >
                                <Text className="text-gray-600 font-bold">CANCEL</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
