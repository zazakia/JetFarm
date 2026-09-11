import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../src/store/AuthContext';
import { BorrowerPortalService, BorrowerProfile, BorrowerLoan } from '../../../src/services/BorrowerPortalService';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPHP } from '../../../src/utils/currency';
import { format } from 'date-fns';
import Animated, { FadeInUp } from 'react-native-reanimated';

type FilterTab = 'all' | 'active' | 'completed' | 'defaulted';

export default function LoansHistoryScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [profile, setProfile] = useState<BorrowerProfile | null>(null);
    const [loans, setLoans] = useState<BorrowerLoan[]>([]);
    const [filter, setFilter] = useState<FilterTab>('all');

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

            const fetchedLoans = await BorrowerPortalService.getLoans(currentProfile.id, filter);
            setLoans(fetchedLoans);
        } catch (error) {
            console.error('[LoansHistoryScreen] Failed to load loans:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user, profile, filter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const renderFilterTab = (tab: FilterTab, label: string) => (
        <Pressable
            onPress={() => setFilter(tab)}
            className={`px-4 py-2 rounded-full mr-2 border ${
                filter === tab 
                    ? 'bg-blue-900 border-blue-900' 
                    : 'bg-white border-gray-200'
            }`}
        >
            <Text className={`font-bold text-xs uppercase tracking-wider ${
                filter === tab ? 'text-white' : 'text-gray-700'
            }`}>
                {label}
            </Text>
        </Pressable>
    );

    const renderLoanItem = ({ item, index }: { item: BorrowerLoan, index: number }) => (
        <Animated.View entering={FadeInUp.duration(400).delay(index * 50)}>
            <Pressable 
                onPress={() => router.push(`/(borrower)/loans/${item.id}`)}
                className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-4 flex-row items-center active:bg-gray-50"
            >
                <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${
                    item.status === 'active' ? 'bg-blue-50' : 
                    item.status === 'completed' ? 'bg-green-50' : 'bg-gray-50'
                }`}>
                    <MaterialIcons 
                        name={item.status === 'active' ? 'account-balance' : item.status === 'completed' ? 'check-circle' : 'hourglass-empty'} 
                        size={24} 
                        color={item.status === 'active' ? '#1E3A8A' : item.status === 'completed' ? '#2E7D32' : '#9CA3AF'} 
                    />
                </View>
                <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-900 mb-1">{item.loanNumber}</Text>
                    <Text className="text-[10px] text-gray-700 font-bold uppercase tracking-wider">
                        Released: {format(new Date(item.releaseDate), 'MMM d, yyyy')}
                    </Text>
                </View>
                <View className="items-end">
                    <Text className="text-base font-black text-gray-900">{formatPHP(item.totalAmount)}</Text>
                    <View className={`px-2 py-0.5 rounded-md mt-1 ${
                        item.status === 'active' ? 'bg-blue-100' : 
                        item.status === 'completed' ? 'bg-green-100' : 
                        item.status === 'defaulted' ? 'bg-red-100' : 'bg-gray-100'
                    }`}>
                        <Text className={`text-[8px] font-black uppercase ${
                            item.status === 'active' ? 'text-blue-700' : 
                            item.status === 'completed' ? 'text-green-700' : 
                            item.status === 'defaulted' ? 'text-red-700' : 'text-gray-600'
                        }`}>{item.status}</Text>
                    </View>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" className="ml-2" />
            </Pressable>
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
                data={loans}
                keyExtractor={(item) => item.id}
                renderItem={renderLoanItem}
                ListHeaderComponent={() => (
                    <View className="mb-6">
                        <Animated.View entering={FadeInUp.duration(400)}>
                            <Text className="text-2xl font-black text-gray-900">My Loans</Text>
                            <Text className="text-gray-700 font-medium mb-6">All your previous and active loans</Text>
                        </Animated.View>

                        {/* Filter Tabs */}
                        <Animated.View entering={FadeInUp.duration(400).delay(100)}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-2">
                                {renderFilterTab('all', 'All Loans')}
                                {renderFilterTab('active', 'Active')}
                                {renderFilterTab('completed', 'Completed')}
                                {renderFilterTab('defaulted', 'Defaulted')}
                            </ScrollView>
                        </Animated.View>

                        {/* Summary Stats */}
                        <Animated.View entering={FadeInUp.duration(400).delay(200)} className="bg-white rounded-2xl p-4 mt-4 border border-gray-100 flex-row justify-around">
                            <View className="items-center">
                                <Text className="text-[10px] text-gray-700 font-bold uppercase mb-1">Total count</Text>
                                <Text className="text-lg font-black text-gray-900">{loans.length}</Text>
                            </View>
                            <View className="w-[1px] h-full bg-gray-100" />
                            <View className="items-center">
                                <Text className="text-[10px] text-gray-700 font-bold uppercase mb-1">Total Amount</Text>
                                <Text className="text-lg font-black text-gray-900">
                                    {formatPHP(loans.reduce((sum, loan) => sum + loan.totalAmount, 0))}
                                </Text>
                            </View>
                        </Animated.View>
                    </View>
                )}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1E3A8A"]} />}
                ListEmptyComponent={
                    <View className="items-center justify-center py-20">
                        <MaterialIcons name="receipt" size={64} color="#E5E7EB" />
                        <Text className="text-gray-700 font-bold mt-4">No loans found.</Text>
                    </View>
                }
            />
        </View>
    );
}
