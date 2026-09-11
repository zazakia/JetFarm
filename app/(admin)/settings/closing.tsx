import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MonthlyClosingService } from '../../../src/services/MonthlyClosingService';
import { formatPHP } from '../../../src/utils/currency';
import { format, startOfMonth, subMonths } from 'date-fns';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function MonthlyClosingScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [isCurrentMonthClosed, setIsCurrentMonthClosed] = useState(false);
    const [closing, setClosing] = useState(false);

    const currentMonth = new Date();
    const prevMonth = subMonths(currentMonth, 1);

    const loadData = async () => {
        setLoading(true);
        try {
            const [hist, closed] = await Promise.all([
                MonthlyClosingService.getClosingHistory(),
                MonthlyClosingService.isMonthClosed(prevMonth) // We usually close the PREVIOUS month
            ]);
            setHistory(hist.sort((a, b) => b.snapshotDate - a.snapshotDate));
            setIsCurrentMonthClosed(closed);
        } catch (error) {
            console.error('Failed to load closing data:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, []));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleCloseMonth = async () => {
        Alert.alert(
            "Confirm Monthly Closing",
            `Are you sure you want to close the books for ${format(prevMonth, 'MMMM yyyy')}? This will capture a permanent financial snapshot.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Close Month",
                    onPress: async () => {
                        setClosing(true);
                        try {
                            const result = await MonthlyClosingService.closeMonth(prevMonth);
                            if (result) {
                                Alert.alert("Success", `Snapshot captured for ${format(prevMonth, 'MMMM yyyy')}`);
                                loadData();
                            } else {
                                Alert.alert("Error", "Failed to capture snapshot. Please try again.");
                            }
                        } catch (e) {
                            Alert.alert("Error", "An unexpected error occurred.");
                        } finally {
                            setClosing(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading && !refreshing) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#1E3A8A" />
            </View>
        );
    }

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View className="p-6">
                <Text className="text-2xl font-black text-gray-900 mb-2">Financial Closing</Text>
                <Text className="text-gray-700 font-bold uppercase tracking-widest text-[10px] mb-8">
                    Snapshot & Audit Management
                </Text>

                {/* Status Card */}
                <View className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm mb-8 items-center">
                    <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${isCurrentMonthClosed ? 'bg-green-100' : 'bg-orange-100'}`}>
                        <MaterialIcons 
                            name={isCurrentMonthClosed ? "beenhere" : "lock-open"} 
                            size={32} 
                            color={isCurrentMonthClosed ? "#16A34A" : "#EA580C"} 
                        />
                    </View>
                    <Text className="text-gray-700 text-[10px] font-black uppercase tracking-widest mb-1">Status for {format(prevMonth, 'MMMM yyyy')}</Text>
                    <Text className={`text-xl font-black ${isCurrentMonthClosed ? 'text-green-600' : 'text-orange-600'}`}>
                        {isCurrentMonthClosed ? 'COMPLETED' : 'PENDING CLOSURE'}
                    </Text>

                    {!isCurrentMonthClosed && (
                        <Pressable
                            onPress={handleCloseMonth}
                            disabled={closing}
                            className={`mt-6 w-full py-4 rounded-2xl items-center flex-row justify-center ${closing ? 'bg-gray-100' : 'bg-blue-900 active:bg-green-800'}`}
                        >
                            {closing ? <ActivityIndicator color="#1E3A8A" /> : (
                                <>
                                    <MaterialIcons name="lock" size={20} color="white" className="mr-2" />
                                    <Text className="text-white font-bold uppercase tracking-widest text-sm">Close {format(prevMonth, 'MMM')} Books</Text>
                                </>
                            )}
                        </Pressable>
                    )}
                </View>

                {/* History */}
                <Text className="text-gray-900 font-black text-xl mb-4 ml-1">Snapshot History</Text>
                <View className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden mb-10">
                    {history.length === 0 ? (
                        <View className="py-20 items-center">
                            <MaterialIcons name="inventory-2" size={48} color="#E5E7EB" />
                            <Text className="text-gray-700 mt-2 font-bold">No snapshots found</Text>
                        </View>
                    ) : (
                        history.map((snapshot, idx) => (
                            <View key={snapshot.id} className={`p-6 ${idx < history.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                <View className="flex-row justify-between items-center mb-4">
                                    <View>
                                        <Text className="text-gray-900 font-black text-lg">{format(snapshot.snapshotDate, 'MMMM yyyy')}</Text>
                                        <Text className="text-gray-700 text-[10px] font-bold uppercase tracking-widest">
                                            Closed on {format(snapshot.createdAt, 'MMM d, yyyy')}
                                        </Text>
                                    </View>
                                    <View className="bg-blue-50 px-3 py-1 rounded-full">
                                        <Text className="text-blue-700 font-bold text-[10px]">FIXED</Text>
                                    </View>
                                </View>
                                
                                <View className="flex-row justify-between">
                                    <View>
                                        <Text className="text-gray-700 text-[10px] font-bold uppercase">Net Portfolio</Text>
                                        <Text className="text-gray-900 font-bold">{formatPHP(snapshot.totalAssets)}</Text>
                                    </View>
                                    <View className="items-end">
                                        <Text className="text-gray-700 text-[10px] font-bold uppercase">Total Equity</Text>
                                        <Text className="text-green-600 font-bold">{formatPHP(snapshot.totalEquity)}</Text>
                                    </View>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </View>
            <View className="h-20" />
        </ScrollView>
    );
}
