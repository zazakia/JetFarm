import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { database } from '../../src/database';
import Remittance from '../../src/database/models/Remittance';
import Payment from '../../src/database/models/Payment';
import { useAuth } from '../../src/store/AuthContext';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { formatPHP } from '../../src/utils/currency';
import { Q } from '@nozbe/watermelondb';
import { LinearGradient } from 'expo-linear-gradient';
import { SyncStatusIndicator } from '../../src/components/SyncStatusIndicator';
import uuid from 'react-native-uuid';
import { startOfDay, endOfDay, format } from 'date-fns';
import Animated, { FadeInDown, FadeInRight, FadeInUp, Layout } from 'react-native-reanimated';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';

import { CashService } from '../../src/services/CashService';
import { safeBack } from '../../src/utils/navigation';
import { handleSaveError } from '../../src/utils/errorAlerts';

export default function CollectorRemittanceScreen() {
    const { user, collectorId, sunlightMode } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [totalCollectedToday, setTotalCollectedToday] = useState(0);
    const [collectorBalance, setCollectorBalance] = useState(0);
    const [pastRemittances, setPastRemittances] = useState<Remittance[]>([]);

    useEffect(() => {
        const loadCollectionData = async () => {
            if (!user) return;
            try {
                const currentCollectorId = collectorId || user.id;
                const today = new Date();
                const start = startOfDay(today).getTime();
                const end = endOfDay(today).getTime();

                // Get today's payments to suggest remittance amount
                const todayPayments = await database.collections.get<Payment>('payments')
                    .query(
                        Q.where('collector_id', currentCollectorId),
                        Q.where('payment_date', Q.between(start, end))
                    ).fetch();

                const total = todayPayments.reduce((sum, p) => sum + p.amount, 0);
                setTotalCollectedToday(total);

                // Get total cash held (payments - approved remittances)
                const balance = await CashService.getCollectorBalance(currentCollectorId);
                setCollectorBalance(balance);
                setAmount((balance > 0 ? balance : total).toString());

                // Get past remittances
                const past = await database.collections.get<Remittance>('remittances')
                    .query(Q.where('collector_id', currentCollectorId), Q.sortBy('remittance_date', Q.desc), Q.take(10))
                    .fetch();
                setPastRemittances(past);

            } catch (error) {
                console.error('Failed to load collection data', error);
            } finally {
                setLoading(false);
            }
        };
        loadCollectionData();
    }, [user, collectorId]);

    const handleSubmit = async () => {
        const remitAmount = parseFloat(amount);
        if (isNaN(remitAmount) || remitAmount <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid amount to remit.");
            return;
        }
        if (collectorBalance > 0 && remitAmount > collectorBalance) {
            Alert.alert("Amount Too High", `You currently hold ${formatPHP(collectorBalance)}. Enter that amount or less.`);
            return;
        }

        Alert.alert(
            "Confirm Remittance",
            `Are you sure you want to remit ${formatPHP(remitAmount)}?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Confirm", 
                    onPress: async () => {
                        setSubmitting(true);
                        try {
                            await database.write(async () => {
                                await database.collections.get<Remittance>('remittances').create(r => {
                                    r._raw.id = uuid.v4().toString();
                                    r.collectorId = collectorId || user?.id || '';
                                    r.amount = remitAmount;
                                    r.remittanceDate = new Date().getTime();
                                    r.status = 'pending';
                                    r.notes = notes;
                                });
                            });
                            Alert.alert("Success", "Remittance submitted for approval.");
                            safeBack(router, '/(collector)');
                        } catch (error) {
                            handleSaveError(error, 'Remittance', 'save');
                        } finally {
                            setSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading) return (
        <View className={`flex-1 justify-center items-center ${sunlightMode ? 'bg-white' : 'bg-white'}`}>
            <ActivityIndicator size="large" color={sunlightMode ? "#000" : "#0D9488"} />
            <Text className={`${sunlightMode ? 'text-black' : 'text-gray-700'} font-black uppercase tracking-widest mt-4`}>Preparing Ledger...</Text>
        </View>
    );

    return (
        <SafeAreaView className={`flex-1 ${sunlightMode ? 'bg-white' : 'bg-slate-50'}`}>
            <StatusBar barStyle={sunlightMode ? 'dark-content' : 'light-content'} />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    {sunlightMode ? (
                        <View className="pt-12 pb-24 px-6 rounded-b-[48px] bg-white border-b-4 border-black">
                            <View className="flex-row justify-between items-center mb-6">
                                <View className="flex-row items-center">
                                    <AnimatedPressable 
                                        onPress={() => safeBack(router, '/(collector)')} 
                                        className="bg-black w-11 h-11 rounded-2xl items-center justify-center mr-4 border-2 border-black"
                                    >
                                        <MaterialIcons name="arrow-back" size={24} color="#FFF" />
                                    </AnimatedPressable>
                                    <View>
                                        <Text className="text-black text-xs font-black uppercase tracking-[2px]">Financials</Text>
                                        <Text className="text-black text-xl font-black">Submit Cash</Text>
                                    </View>
                                </View>
                                <SyncStatusIndicator />
                            </View>
                            <Animated.View entering={FadeInUp}>
                                <Text className="text-black text-[10px] font-black uppercase tracking-[3px]">Financial Remittance</Text>
                                <Text className="text-black text-3xl font-black mt-1">End of Day Reporting</Text>
                            </Animated.View>
                        </View>
                    ) : (
                        <LinearGradient
                            colors={['#0D9488', '#115E59']}
                            className="pt-12 pb-24 px-6 rounded-b-[48px] shadow-2xl"
                        >
                            <View className="flex-row justify-between items-center mb-6">
                                <View className="flex-row items-center">
                                    <AnimatedPressable 
                                        onPress={() => safeBack(router, '/(collector)')} 
                                        className="bg-white/10 w-11 h-11 rounded-2xl items-center justify-center mr-4"
                                    >
                                        <MaterialIcons name="arrow-back" size={24} color="#FFF" />
                                    </AnimatedPressable>
                                    <View>
                                        <Text className="text-teal-100 text-[10px] font-black uppercase tracking-[2px]">Financials</Text>
                                        <Text className="text-white text-xl font-black">Submit Cash</Text>
                                    </View>
                                </View>
                                <SyncStatusIndicator />
                            </View>
                            <Animated.View entering={FadeInUp}>
                                <Text className="text-teal-100 text-[10px] font-black uppercase tracking-[3px]">Financial Remittance</Text>
                                <Text className="text-white text-3xl font-black mt-1">End of Day Reporting</Text>
                            </Animated.View>
                        </LinearGradient>
                    )}

                    <View className="px-6 -mt-10 mb-10">
                        {/* Summary Cards */}
                        <Animated.View entering={FadeInDown.delay(100)} className={`p-6 rounded-[40px] mb-8 border ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-white shadow-sm border-gray-100'}`}>
                            <View className="flex-row items-center mb-10">
                                <View className="flex-1">
                                    <View className="flex-row items-center mb-1">
                                        <View className={`w-1.5 h-1.5 rounded-full mr-2 ${sunlightMode ? 'bg-black' : 'bg-teal-500'}`} />
                                        <Text className={`${sunlightMode ? 'text-black font-black uppercase tracking-tighter' : 'text-gray-700 text-[10px]'} font-black uppercase tracking-wider`}>Collected Today</Text>
                                    </View>
                                    <Text className={`text-2xl font-black ${sunlightMode ? 'text-black' : 'text-teal-900'}`}>{formatPHP(totalCollectedToday)}</Text>
                                </View>
                                <View className={`w-[1px] h-10 mx-4 ${sunlightMode ? 'bg-black border-l-2' : 'bg-gray-100'}`} />
                                <View className="flex-1 items-end">
                                    <View className="flex-row items-center mb-1">
                                        <Text className={`${sunlightMode ? 'text-black font-black uppercase tracking-tighter' : 'text-gray-700 text-[10px]'} font-black uppercase tracking-wider`}>Total Cash Held</Text>
                                        <View className={`w-1.5 h-1.5 rounded-full ml-2 ${sunlightMode ? 'bg-black' : 'bg-orange-500'}`} />
                                    </View>
                                    <Text className={`text-2xl font-black ${sunlightMode ? 'text-black' : 'text-orange-700'}`}>{formatPHP(collectorBalance)}</Text>
                                </View>
                            </View>

                            <View className="space-y-6">
                                <View className="mb-6">
                                    <View className="flex-row justify-between items-center mb-3 px-1">
                                        <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-sm`}>Amount to Remit</Text>
                                        <Pressable onPress={() => setAmount(collectorBalance.toString())}>
                                            <Text className={`${sunlightMode ? 'text-black' : 'text-teal-600'} text-[10px] font-black uppercase border-b-2 ${sunlightMode ? 'border-black' : 'border-transparent'}`}>Max Amount</Text>
                                        </Pressable>
                                    </View>
                                    <View className={`h-16 rounded-[20px] flex-row items-center px-5 border ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-gray-50 border-gray-100'}`}>
                                        <Text className={`${sunlightMode ? 'text-black' : 'text-gray-700'} font-black mr-3 text-xl`}>₱</Text>
                                        <TextInput
                                            testID="collector-remittance-amount-input"
                                            value={amount}
                                            onChangeText={setAmount}
                                            keyboardType="numeric"
                                            placeholder="0.00"
                                            placeholderTextColor={sunlightMode ? "#000" : "#9CA3AF"}
                                            className={`flex-1 font-black text-xl p-0 ${sunlightMode ? 'text-black' : 'text-gray-900'}`}
                                        />
                                    </View>
                                    {collectorBalance > 0 && parseFloat(amount || '0') > collectorBalance && (
                                        <Text testID="collector-remittance-overage-warning" className="text-red-600 text-xs font-black mt-2 px-1">
                                            Amount exceeds current cash held ({formatPHP(collectorBalance)}).
                                        </Text>
                                    )}
                                </View>

                                <View className="mt-4">
                                    <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-sm mb-3 px-1`}>Notes (Optional)</Text>
                                    <View className={`rounded-[24px] p-4 border ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-gray-50 border-gray-100'}`}>
                                        <TextInput
                                            testID="collector-remittance-notes-input"
                                            value={notes}
                                            onChangeText={setNotes}
                                            placeholder="Batch number, discrepancy details, etc."
                                            placeholderTextColor={sunlightMode ? "#000" : "#9CA3AF"}
                                            multiline
                                            numberOfLines={4}
                                            className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black p-0 h-24`}
                                            style={{ textAlignVertical: 'top' }}
                                        />
                                    </View>
                                </View>
                            </View>

                            <AnimatedPressable
                                testID="collector-remittance-submit-button"
                                onPress={handleSubmit}
                                disabled={submitting}
                                className={`h-16 rounded-2xl mt-8 flex-row items-center justify-center border-2 ${
                                    sunlightMode 
                                        ? (submitting ? 'bg-gray-200 border-gray-200' : 'bg-black border-black') 
                                        : (submitting ? 'bg-teal-300 border-teal-300' : 'bg-teal-600 shadow-lg shadow-teal-600/30 border-teal-600')
                                }`}
                            >
                                {submitting ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <>
                                        <Ionicons name="send" size={20} color="#FFF" />
                                        <Text className="text-white font-black uppercase tracking-[2px] text-xs ml-3">Submit Report</Text>
                                    </>
                                )}
                            </AnimatedPressable>
                        </Animated.View>

                        {/* History */}
                        <View className="flex-row justify-between items-end mb-6 px-1">
                            <View>
                                <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-xl`}>Recent History</Text>
                                <Text className={`${sunlightMode ? 'text-black font-black uppercase text-[10px]' : 'text-gray-700 text-xs font-medium'}`}>Last 10 transactions</Text>
                            </View>
                            <Ionicons name="time-outline" size={20} color={sunlightMode ? "#000" : "#9CA3AF"} />
                        </View>

                        {pastRemittances.length === 0 ? (
                            <Animated.View entering={FadeInUp.delay(200)} className={`p-12 rounded-[40px] items-center border border-dashed ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-white border-gray-200'}`}>
                                <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${sunlightMode ? 'bg-black' : 'bg-gray-50'}`}>
                                    <MaterialIcons name="history" size={32} color={sunlightMode ? "#FFF" : "#D1D5DB"} />
                                </View>
                                <Text className={`${sunlightMode ? 'text-black' : 'text-gray-700'} font-black italic`}>No recent remittances</Text>
                            </Animated.View>
                        ) : (
                            pastRemittances.map((r, i) => (
                                <Animated.View 
                                    key={r.id} 
                                    entering={FadeInRight.delay(i * 100)}
                                    layout={Layout.springify()}
                                    className={`p-5 rounded-[32px] mb-4 flex-row justify-between items-center border ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-white shadow-sm border-gray-50'}`}
                                >
                                    <View className="flex-row items-center flex-1">
                                        <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 border ${
                                            sunlightMode ? 'bg-black border-black' : (
                                                r.status === 'approved' ? 'bg-teal-500 border-teal-500' : 
                                                r.status === 'rejected' ? 'bg-red-500 border-red-500' : 'bg-orange-500 border-orange-500'
                                            )
                                        }`}>
                                            <MaterialIcons 
                                                name={r.status === 'approved' ? 'check' : r.status === 'rejected' ? 'close' : 'access-time'} 
                                                size={22} 
                                                color="#FFF" 
                                            />
                                        </View>
                                        <View className="flex-1">
                                            <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-lg`}>{formatPHP(r.amount)}</Text>
                                            <Text className={`${sunlightMode ? 'text-black font-black uppercase' : 'text-gray-700 text-bold uppercase tracking-tighter'} text-[10px] mt-0.5`}>{format(new Date(r.remittanceDate), 'MMM d, yyyy · p')}</Text>
                                        </View>
                                    </View>
                                    <View className={`px-3 py-1.5 rounded-full border ${
                                        sunlightMode ? 'bg-black border-black' : (
                                            r.status === 'approved' ? 'bg-teal-50 border-teal-50' : 
                                            r.status === 'rejected' ? 'bg-red-50 border-red-50' : 'bg-orange-50 border-orange-50'
                                        )
                                    }`}>
                                        <Text className={`text-[9px] font-black uppercase tracking-wider ${
                                            sunlightMode ? 'text-white' : (
                                                r.status === 'approved' ? 'text-teal-700' : 
                                                r.status === 'rejected' ? 'text-red-700' : 'text-orange-700'
                                            )
                                        }`}>{r.status}</Text>
                                    </View>
                                </Animated.View>
                            ))
                        )}
                    </View>
                    <View className="h-20" />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

