import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../src/store/AuthContext';
import { BorrowerPortalService, BorrowerProfile, LoanDetail } from '../../../src/services/BorrowerPortalService';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPHP } from '../../../src/utils/currency';
import { format } from 'date-fns';
import Animated, { FadeInUp } from 'react-native-reanimated';

type TabType = 'schedule' | 'ledger';

export default function LoanDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { user } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [profile, setProfile] = useState<BorrowerProfile | null>(null);
    const [loanDetail, setLoanDetail] = useState<LoanDetail | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('schedule');

    const loadData = useCallback(async () => {
        if (!user || !id) return;
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

            const details = await BorrowerPortalService.getLoanDetail(id as string, currentProfile.id);
            setLoanDetail(details);
        } catch (error) {
            console.error('[LoanDetailsScreen] Failed to load loan details:', error);
            router.back();
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user, id, profile, router]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (loading && !refreshing) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#1E3A8A" />
            </View>
        );
    }

    if (!loanDetail) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 p-6">
                <MaterialIcons name="error-outline" size={64} color="#D1D5DB" />
                <Text className="text-xl font-bold text-gray-900 mt-4 text-center">Loan Not Found</Text>
                <Text className="text-gray-700 text-center mt-2">This loan could not be loaded or you do not have permission to view it.</Text>
            </View>
        );
    }

    const renderSchedule = () => {
        if (loanDetail.schedules.length === 0) {
            return (
                <View className="bg-white p-8 rounded-3xl border border-dashed border-gray-200 items-center">
                    <MaterialIcons name="calendar-today" size={40} color="#E5E7EB" />
                    <Text className="text-gray-700 font-bold mt-2">No schedule generated yet.</Text>
                </View>
            );
        }

        return loanDetail.schedules.map((s, index) => (
            <Animated.View key={s.id} entering={FadeInUp.duration(400).delay(index * 50)} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-3 flex-row items-center">
                <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                    s.status === 'paid' ? 'bg-green-50' : 
                    s.status === 'late' ? 'bg-red-50' : 'bg-blue-50'
                }`}>
                    <MaterialIcons 
                        name={s.status === 'paid' ? 'check' : s.status === 'late' ? 'warning' : 'schedule'} 
                        size={20} 
                        color={s.status === 'paid' ? '#2E7D32' : s.status === 'late' ? '#C62828' : '#1565C0'} 
                    />
                </View>
                <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-900">{formatPHP(s.scheduledAmount)}</Text>
                    <Text className={`text-[10px] font-medium ${s.status === 'late' ? 'text-red-600' : 'text-gray-700'}`}>
                        Due: {format(new Date(s.dueDate), 'MMM d, yyyy')}
                    </Text>
                    {(s.principalAmount > 0 || s.interestAmount > 0) && (
                        <Text className="text-[10px] text-gray-500 mt-0.5">
                            P: {formatPHP(s.principalAmount)} • I: {formatPHP(s.interestAmount)}
                        </Text>
                    )}
                </View>
                <View className={`px-2 py-1 rounded-md ${
                    s.status === 'paid' ? 'bg-green-100' : 
                    s.status === 'late' ? 'bg-red-100' : 'bg-gray-100'
                }`}>
                    <Text className={`text-[8px] font-black uppercase ${
                        s.status === 'paid' ? 'text-green-700' : 
                        s.status === 'late' ? 'text-red-700' : 'text-gray-600'
                    }`}>{s.status}</Text>
                </View>
            </Animated.View>
        ));
    };

    const renderLedger = () => {
        if (loanDetail.payments.length === 0) {
            return (
                <View className="bg-white p-8 rounded-3xl border border-dashed border-gray-200 items-center">
                    <MaterialIcons name="history" size={40} color="#E5E7EB" />
                    <Text className="text-gray-700 font-bold mt-2">No payments recorded yet.</Text>
                </View>
            );
        }

        return loanDetail.payments.map((p, index) => (
            <Animated.View key={p.id} entering={FadeInUp.duration(400).delay(index * 50)} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-3 flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-green-50 items-center justify-center mr-3">
                    <MaterialIcons name="payments" size={20} color="#2E7D32" />
                </View>
                <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-900">{formatPHP(p.amount)}</Text>
                    <Text className="text-[10px] text-gray-700 font-medium">{format(new Date(p.paymentDate), 'MMM d, yyyy')}</Text>
                </View>
                <View className="bg-gray-50 px-2 py-1 rounded-md">
                    <Text className="text-[8px] font-black text-gray-700 uppercase">{p.receiptNumber || 'Payment'}</Text>
                </View>
            </Animated.View>
        ));
    };

    return (
        <ScrollView 
            className="flex-1 bg-gray-50" 
            contentContainerStyle={{ padding: 20 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={["#1E3A8A"]} />}
        >
            {/* Header Card */}
            <Animated.View entering={FadeInUp.duration(500)} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                <View className="flex-row justify-between items-start mb-6">
                    <View className="flex-1 pr-3">
                        <Text className="text-gray-700 text-[10px] font-bold uppercase tracking-widest mb-1">Loan Number</Text>
                        <Text className="text-2xl font-black text-gray-900">{loanDetail.loanNumber}</Text>
                    </View>
                    <View className={`px-3 py-1 rounded-full ${
                        loanDetail.status === 'paid' || loanDetail.status === 'completed' ? 'bg-green-100' :
                        loanDetail.status === 'defaulted' ? 'bg-red-100' : 'bg-blue-100'
                    }`}>
                        <Text className={`text-[10px] font-black uppercase ${
                            loanDetail.status === 'paid' || loanDetail.status === 'completed' ? 'text-green-700' :
                            loanDetail.status === 'defaulted' ? 'text-red-700' : 'text-blue-700'
                        }`}>{loanDetail.status}</Text>
                    </View>
                </View>

                <View className="mb-6">
                    <View className="flex-row justify-between items-end mb-2">
                        <Text className="text-gray-600 text-xs font-bold">Repayment Progress</Text>
                        <Text className="text-gray-900 font-black">{Math.round(loanDetail.progress)}%</Text>
                    </View>
                    <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <View className="h-full bg-blue-900 rounded-full" style={{ width: `${loanDetail.progress}%` }} />
                    </View>
                </View>

                <View className="flex-row justify-between">
                    <View className="flex-1 pr-3">
                        <Text className="text-gray-700 text-[10px] font-bold uppercase mb-1">Total Loan</Text>
                        <Text className="text-lg font-black text-gray-900">{formatPHP(loanDetail.totalAmount)}</Text>
                    </View>
                    <View className="items-end flex-1 pl-3">
                        <Text className="text-gray-700 text-[10px] font-bold uppercase mb-1">Remaining</Text>
                        <Text className="text-lg font-black text-blue-700">{formatPHP(loanDetail.balance)}</Text>
                    </View>
                </View>
            </Animated.View>

            {/* Loan Details Grid */}
            <Animated.View entering={FadeInUp.duration(500).delay(100)} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-8">
                <Text className="text-sm font-black text-gray-900 mb-4 uppercase tracking-widest">Loan Overview</Text>
                <View className="flex-row flex-wrap">
                    <View className="w-1/2 mb-4 pr-2">
                        <Text className="text-[10px] font-bold text-gray-700 uppercase mb-1">Release Date</Text>
                        <Text className="text-sm font-bold text-gray-900">{loanDetail.releaseDate ? format(new Date(loanDetail.releaseDate), 'MMM d, yyyy') : '--'}</Text>
                    </View>
                    <View className="w-1/2 mb-4 pl-2">
                        <Text className="text-[10px] font-bold text-gray-700 uppercase mb-1">Interest Rate</Text>
                        <Text className="text-sm font-bold text-gray-900">{loanDetail.interestRate}%</Text>
                    </View>
                    <View className="w-1/2 mb-4 pr-2">
                        <Text className="text-[10px] font-bold text-gray-700 uppercase mb-1">Installment</Text>
                        <Text className="text-sm font-bold text-gray-900">{formatPHP(loanDetail.installmentAmount)}</Text>
                    </View>
                    <View className="w-1/2 mb-4 pl-2">
                        <Text className="text-[10px] font-bold text-gray-700 uppercase mb-1">Frequency</Text>
                        <Text className="text-sm font-bold text-gray-900 uppercase">{loanDetail.frequency}</Text>
                    </View>
                </View>
            </Animated.View>

            {/* Tabs for Schedule vs Ledger */}
            <Animated.View entering={FadeInUp.duration(500).delay(200)} className="flex-row bg-gray-200 p-1 rounded-2xl mb-6">
                <Pressable 
                    onPress={() => setActiveTab('schedule')}
                    className={`flex-1 py-3 rounded-xl items-center ${activeTab === 'schedule' ? 'bg-white shadow-sm' : ''}`}
                >
                    <Text className={`font-bold text-xs tracking-wider uppercase ${activeTab === 'schedule' ? 'text-blue-900' : 'text-gray-700'}`}>
                        Payment Schedule
                    </Text>
                </Pressable>
                <Pressable 
                    onPress={() => setActiveTab('ledger')}
                    className={`flex-1 py-3 rounded-xl items-center ${activeTab === 'ledger' ? 'bg-white shadow-sm' : ''}`}
                >
                    <Text className={`font-bold text-xs tracking-wider uppercase ${activeTab === 'ledger' ? 'text-blue-900' : 'text-gray-700'}`}>
                        Payment Ledger
                    </Text>
                </Pressable>
            </Animated.View>

            {/* List Content */}
            <View>
                {activeTab === 'schedule' ? renderSchedule() : renderLedger()}
            </View>

            <View className="h-10" />
        </ScrollView>
    );
}
