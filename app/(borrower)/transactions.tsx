import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useAuth } from '../../src/store/AuthContext';
import { BorrowerPortalService, BorrowerProfile, BorrowerPayment } from '../../src/services/BorrowerPortalService';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPHP } from '../../src/utils/currency';
import { format } from 'date-fns';
import Animated, { FadeInUp } from 'react-native-reanimated';

export default function BorrowerTransactionsScreen() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [profile, setProfile] = useState<BorrowerProfile | null>(null);
    const [payments, setPayments] = useState<BorrowerPayment[]>([]);

    const loadData = useCallback(async () => {
        if (!user) return;
        try {
            let currentProfile = profile;
            if (!currentProfile) {
                currentProfile = await BorrowerPortalService.getBorrowerProfile(user.id);
                if (!currentProfile) {
                    setLoading(false);
                    return;
                }
                setProfile(currentProfile);
            }

            const p = await BorrowerPortalService.getPayments(currentProfile.id);
            setPayments(p);
        } catch (error) {
            console.error('[BorrowerTransactionsScreen] Failed to load transactions:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user, profile]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const renderItem = ({ item, index }: { item: BorrowerPayment, index: number }) => (
        <Animated.View entering={FadeInUp.duration(400).delay(index * 50)}>
            <View className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm mb-3 flex-row items-center">
                <View className="w-12 h-12 rounded-2xl bg-green-50 items-center justify-center mr-4">
                    <MaterialIcons name="call-received" size={24} color="#2E7D32" />
                </View>
                <View className="flex-1">
                    <Text className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-0.5">
                        {item.loanNumber ? `Payment (Loan ${item.loanNumber})` : 'Payment Received'}
                    </Text>
                    <Text className="text-base font-black text-gray-900">{formatPHP(item.amount)}</Text>
                    <Text className="text-xs text-gray-700 font-medium mt-1">
                        {format(new Date(item.paymentDate), 'MMM d, yyyy h:mm a')}
                    </Text>
                </View>
                <View className="items-end">
                    <View className="bg-gray-100 px-3 py-1 rounded-full">
                        <Text className="text-[9px] font-black text-gray-600 uppercase tracking-tighter">
                            {item.receiptNumber || 'Payment'}
                        </Text>
                    </View>
                    {!!item.notes && (
                        <Text className="text-[8px] text-gray-700 mt-1 font-bold">{item.notes}</Text>
                    )}
                </View>
            </View>
        </Animated.View>
    );

    if (loading && !refreshing) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#1E3A8A" />
            </View>
        );
    }

    if (!profile && !loading) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 p-6">
                <MaterialIcons name="error-outline" size={64} color="#D1D5DB" />
                <Text className="text-xl font-bold text-gray-900 mt-4 text-center">Profile Not Linked</Text>
                <Text className="text-gray-700 text-center mt-2">
                    Your account is not linked to a borrower profile.
                </Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50 p-4">
            <FlatList
                data={payments}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                ListHeaderComponent={() => (
                    <Animated.View entering={FadeInUp.duration(400)} className="mb-6">
                        <Text className="text-2xl font-black text-gray-900">Payments</Text>
                        <Text className="text-gray-700 font-medium">History of your payments</Text>
                    </Animated.View>
                )}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1E3A8A"]} />}
                ListEmptyComponent={
                    <View className="items-center justify-center py-20">
                        <MaterialIcons name="receipt-long" size={64} color="#E5E7EB" />
                        <Text className="text-gray-700 font-bold mt-4">No payments found.</Text>
                    </View>
                }
            />
        </View>
    );
}
