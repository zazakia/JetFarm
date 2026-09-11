import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MfiKpiService } from '../../../src/services/MfiKpiService';
import { formatPHP } from '../../../src/utils/currency';
import { startOfMonth, endOfMonth, addMonths, subMonths, format } from 'date-fns';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MetricBreakdownDialog, BreakdownItem } from '../../../src/components/MetricBreakdownDialog';

export default function DisbursementsScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loans, setLoans] = useState<any[]>([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [breakdownVisible, setBreakdownVisible] = useState(false);
    const [breakdownData, setBreakdownData] = useState<{ title: string; total: number; items: BreakdownItem[]; color: string }>({
        title: '', total: 0, items: [], color: 'text-blue-600'
    });

    const handleTotalDisbursedClick = () => {
        const items: BreakdownItem[] = loans.map(loan => ({
            id: loan.id,
            label: loan.borrowerName || 'Borrower',
            sublabel: `Loan #${loan.loanNumber} • Released ${format(loan.releaseDate, 'MMM d, yyyy')}`,
            value: loan.principalAmount,
            isCurrency: true,
        }));

        setBreakdownData({
            title: `Disbursements Breakdown: ${format(currentMonth, 'MMMM yyyy')}`,
            total: totalDisbursed,
            items,
            color: 'text-blue-600',
        });
        setBreakdownVisible(true);
    };

    const startDate = startOfMonth(currentMonth).getTime();
    const endDate = endOfMonth(currentMonth).getTime();

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await MfiKpiService.getDisbursements(startDate, endDate);
            setLoans(result);
        } catch (error) {
            console.error('Failed to load disbursements:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, [currentMonth]));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const goToPrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
    const goToNextMonth = () => {
        const next = addMonths(currentMonth, 1);
        if (next <= new Date()) setCurrentMonth(next);
    };
    const isCurrentMonth = format(currentMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

    const totalDisbursed = loans.reduce((sum, loan) => sum + loan.principalAmount, 0);
    const totalInsurance = loans.reduce((sum, loan) => sum + (loan.insuranceAmount || 0), 0);
    const netDisbursed = totalDisbursed - totalInsurance;

    return (
        <ScrollView 
            className="flex-1 bg-gray-50" 
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}  />}
            stickyHeaderIndices={[0]}
        >
            <View className="bg-gray-50 p-6 pb-2 z-10 border-b border-gray-100">
                <Text className="text-2xl font-black text-gray-900 mb-4">Disbursements</Text>

                {/* Month Navigator */}
                <View className="flex-row items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-4">
                    <Pressable
                        onPress={goToPrevMonth}
                        className="p-2 rounded-xl bg-gray-50 active:bg-gray-100"
                    >
                        <MaterialIcons name="chevron-left" size={24} color="#1E3A8A" />
                    </Pressable>
                    <View className="items-center">
                        <Text className="text-base font-black text-gray-900">{format(currentMonth, 'MMMM yyyy')}</Text>
                        <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">
                            {format(startDate, 'MMM d')} — {format(endDate, 'MMM d, yyyy')}
                        </Text>
                    </View>
                    <Pressable
                        onPress={goToNextMonth}
                        className={`p-2 rounded-xl ${isCurrentMonth ? 'opacity-30' : 'bg-gray-50 active:bg-gray-100'}`}
                        disabled={isCurrentMonth}
                    >
                        <MaterialIcons name="chevron-right" size={24} color="#1E3A8A" />
                    </Pressable>
                </View>

                {/* KPI Cards */}
                <View className="mb-4">
                    <Pressable onPress={handleTotalDisbursedClick} className="bg-blue-600 rounded-3xl p-6 shadow-sm mb-3 active:bg-blue-700">
                        <Text className="text-blue-100 font-bold uppercase tracking-widest text-xs mb-1">Total Principal Disbursed (Tap for details)</Text>
                        <Text className="text-white text-3xl font-black">{formatPHP(totalDisbursed)}</Text>
                        <Text className="text-blue-200 mt-2 font-semibold">{loans.length} Loans Released</Text>
                    </Pressable>
                    
                    <View className="flex-row gap-3">
                        <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                            <Text className="text-gray-700 font-bold uppercase tracking-widest text-[10px] mb-1">Total Insurance</Text>
                            <Text className="text-orange-600 text-lg font-black">{formatPHP(totalInsurance)}</Text>
                        </View>
                        <View className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                            <Text className="text-gray-700 font-bold uppercase tracking-widest text-[10px] mb-1">Net Disbursed</Text>
                            <Text className="text-green-600 text-lg font-black">{formatPHP(netDisbursed)}</Text>
                        </View>
                    </View>
                </View>
            </View>

            <View className="p-4 px-6">
                {loading && !refreshing ? (
                    <ActivityIndicator color="#3B82F6" className="mt-10" />
                ) : (
                    <>
                        {loans.map((loan, idx) => (
                            <Animated.View
                                key={loan.id}
                                entering={FadeInDown.delay(idx * 50).springify()}
                                className="bg-white p-4 rounded-2xl mb-3 border border-gray-100 shadow-sm"
                            >
                                <View className="flex-row items-center justify-between mb-3">
                                    <View className="flex-1 mr-4">
                                        <Text className="text-gray-900 font-bold text-base mb-1" numberOfLines={1}>{loan.borrowerName}</Text>
                                        <View className="flex-row items-center">
                                            <MaterialIcons name="tag" size={14} color="#9CA3AF" />
                                            <Text className="text-gray-700 text-xs ml-1 mr-3">{loan.loanNumber}</Text>
                                            <MaterialIcons name="event" size={14} color="#9CA3AF" />
                                            <Text className="text-gray-700 text-xs ml-1">{format(loan.releaseDate, 'MMM d')}</Text>
                                        </View>
                                    </View>
                                    <View className="items-end">
                                        <Text className="text-blue-600 font-black text-base">{formatPHP(loan.principalAmount)}</Text>
                                        <View className={`mt-1 px-2 py-0.5 rounded-full ${
                                            loan.status === 'active' ? 'bg-green-100' :
                                            loan.status === 'paid' ? 'bg-gray-100' : 'bg-red-100'
                                        }`}>
                                            <Text className={`text-[10px] font-bold uppercase ${
                                                loan.status === 'active' ? 'text-green-700' :
                                                loan.status === 'paid' ? 'text-gray-600' : 'text-red-700'
                                            }`}>{loan.status}</Text>
                                        </View>
                                    </View>
                                </View>
                                
                                <View className="h-px bg-gray-50 mb-3" />
                                
                                <View className="flex-row justify-between items-center">
                                    <View className="flex-row items-center">
                                        <MaterialIcons name="security" size={14} color="#F59E0B" />
                                        <Text className="text-gray-700 text-xs font-bold ml-1 uppercase">Insurance:</Text>
                                        <Text className="text-orange-600 text-xs font-black ml-1">{formatPHP(loan.insuranceAmount || 0)}</Text>
                                    </View>
                                    <View className="flex-row items-center">
                                        <Text className="text-gray-700 text-[10px] font-bold uppercase mr-1">Net:</Text>
                                        <Text className="text-gray-900 text-xs font-black">{formatPHP(loan.principalAmount - (loan.insuranceAmount || 0))}</Text>
                                    </View>
                                </View>
                            </Animated.View>
                        ))}

                        {loans.length === 0 && (
                            <View className="items-center justify-center p-10 opacity-50">
                                <MaterialIcons name="receipt-long" size={48} color="#9CA3AF" />
                                <Text className="text-gray-700 font-bold mt-4">No disbursements for this month</Text>
                            </View>
                        )}
                    </>
                )}
            </View>

            <View className="h-20" />

            <MetricBreakdownDialog
                visible={breakdownVisible}
                onClose={() => setBreakdownVisible(false)}
                {...breakdownData}
            />
        </ScrollView>
    );
}
