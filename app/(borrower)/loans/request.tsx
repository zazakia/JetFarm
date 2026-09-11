import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import { database } from '../../../src/database';
import LoanApplication from '../../../src/database/models/LoanApplication';
import LoanProduct from '../../../src/database/models/LoanProduct';
import { Q } from '@nozbe/watermelondb';
import { useAuth } from '../../../src/store/AuthContext';
import { BorrowerPortalService } from '../../../src/services/BorrowerPortalService';
import uuid from 'react-native-uuid';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatPHP } from '../../../src/utils/currency';
import { handleSaveError } from '../../../src/utils/errorAlerts';

export default function LoanRequestScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [products, setProducts] = useState<LoanProduct[]>([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [amount, setAmount] = useState('');
    const [purpose, setPurpose] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [borrowerId, setBorrowerId] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            if (user) {
                const profile = await BorrowerPortalService.getBorrowerProfile(user.id);
                if (profile) setBorrowerId(profile.id);
            }
            
            const activeProducts = await database.get<LoanProduct>('loan_products')
                .query(Q.where('is_active', true), Q.sortBy('sort_order', Q.asc))
                .fetch();
            setProducts(activeProducts);
            if (activeProducts.length > 0) {
                setSelectedProductId(activeProducts[0].id);
            }
        };
        init();
    }, [user]);

    const handleSubmit = async () => {
        if (!borrowerId) {
            Alert.alert('Error', 'Borrower profile not linked.');
            return;
        }
        
        const reqAmount = parseFloat(amount);
        if (isNaN(reqAmount) || reqAmount <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid loan amount.');
            return;
        }

        const product = products.find(p => p.id === selectedProductId);
        if (product && product.maxPrincipal && reqAmount > product.maxPrincipal) {
            Alert.alert('Amount too high', `Maximum allowed for this product is ${formatPHP(product.maxPrincipal)}`);
            return;
        }

        setIsSubmitting(true);
        try {
            await database.write(async () => {
                await database.get<LoanApplication>('loan_applications').create(record => {
                    record._raw.id = uuid.v4().toString();
                    record.borrowerId = borrowerId;
                    record.productId = selectedProductId;
                    record.amountApplied = reqAmount;
                    record.purpose = purpose.trim() || null;
                    record.status = 'pending';
                    record.applicationDate = Date.now();
                });
            });
            Alert.alert('Success', 'Your loan application has been submitted for review.', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error) {
            handleSaveError(error, 'Loan Request', 'save');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <View className="px-6 pt-10 pb-4 bg-white border-b border-gray-200 shadow-sm flex-row items-center">
                <Pressable onPress={() => router.back()} className="mr-4 p-2 rounded-full active:bg-gray-100">
                    <MaterialIcons name="arrow-back" size={24} color="#111827" />
                </Pressable>
                <View>
                    <Text className="text-2xl font-black text-gray-900">Request Loan</Text>
                    <Text className="text-gray-500 text-sm mt-1">Apply for a new loan</Text>
                </View>
            </View>

            <ScrollView className="flex-1 p-6">
                <Text className="font-bold text-gray-700 uppercase text-xs mb-3">Select Loan Product</Text>
                <View className="flex-row flex-wrap mb-6">
                    {products.map(p => (
                        <Pressable 
                            key={p.id}
                            onPress={() => setSelectedProductId(p.id)}
                            className={`p-4 rounded-xl border mr-3 mb-3 flex-1 min-w-[45%] ${
                                selectedProductId === p.id 
                                    ? 'bg-purple-50 border-purple-400' 
                                    : 'bg-white border-gray-200'
                            }`}
                        >
                            <Text className={`font-black text-sm mb-1 ${selectedProductId === p.id ? 'text-purple-900' : 'text-gray-800'}`}>
                                {p.label}
                            </Text>
                            <Text className="text-xs text-gray-500">
                                {p.defaultFrequency} • {p.defaultRatePercent}% int
                            </Text>
                        </Pressable>
                    ))}
                </View>

                <View className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mb-6">
                    <Text className="font-bold text-gray-700 uppercase text-xs mb-2">Loan Amount (₱)</Text>
                    <TextInput 
                        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-xl font-black text-gray-900 mb-4"
                        placeholder="0.00"
                        keyboardType="numeric"
                        value={amount}
                        onChangeText={setAmount}
                        editable={!isSubmitting}
                     placeholderTextColor="#9CA3AF"/>

                    <Text className="font-bold text-gray-700 uppercase text-xs mb-2">Purpose of Loan</Text>
                    <TextInput 
                        className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-gray-900 min-h-[100px]"
                        placeholder="e.g. Business expansion, Medical expenses..."
                        multiline
                        textAlignVertical="top"
                        value={purpose}
                        onChangeText={setPurpose}
                        editable={!isSubmitting}
                     placeholderTextColor="#9CA3AF"/>
                </View>

                <Pressable 
                    onPress={handleSubmit}
                    disabled={isSubmitting || !amount}
                    className={`py-4 rounded-xl items-center shadow-sm ${
                        isSubmitting || !amount ? 'bg-purple-300' : 'bg-purple-700 active:bg-purple-800'
                    }`}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text className="text-white font-black uppercase text-base">Submit Application</Text>
                    )}
                </Pressable>
                
                <View className="h-10" />
            </ScrollView>
        </SafeAreaView>
    );
}
