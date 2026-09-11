import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, SafeAreaView, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { database } from '../../../src/database';
import Borrower from '../../../src/database/models/Borrower';
import Loan from '../../../src/database/models/Loan';
import Payment from '../../../src/database/models/Payment';
import { formatPHP } from '../../../src/utils/currency';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import * as Linking from 'expo-linking';
import { ReminderService } from '../../../src/services/ReminderService';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInRight, FadeInUp } from 'react-native-reanimated';
import { AnimatedPressable } from '../../../src/components/AnimatedPressable';
import { SyncStatusIndicator } from '../../../src/components/SyncStatusIndicator';
import { useAuth } from '../../../src/store/AuthContext';

export default function CollectorBorrowerPassbook() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { sunlightMode } = useAuth();
    const [loading, setLoading] = useState(true);
    const [borrower, setBorrower] = useState<Borrower | null>(null);
    const [activeLoan, setActiveLoan] = useState<Loan | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);

    useEffect(() => {
        const loadPassbook = async () => {
            try {
                const b = await database.get<Borrower>('borrowers').find(id);
                setBorrower(b);

                const l = await database.collections.get<Loan>('loans')
                    .query(Q.where('borrower_id', id), Q.where('status', 'active'))
                    .fetch();

                if (l.length > 0) {
                    const loan = l[0];
                    setActiveLoan(loan);

                    const p = await database.collections.get<Payment>('payments')
                        .query(Q.where('loan_id', loan.id), Q.sortBy('payment_date', Q.desc))
                        .fetch();
                    setPayments(p);
                }
            } catch (error) {
                console.error('Failed to load passbook', error);
                Alert.alert("Error", "Could not load borrower data.");
            } finally {
                setLoading(false);
            }
        };
        loadPassbook();
    }, [id]);

    const handleCall = () => {
        if (borrower?.decryptedPhone) Linking.openURL(`tel:${borrower.decryptedPhone}`);
    };

    const handleSms = () => {
        if (borrower?.decryptedPhone) Linking.openURL(`sms:${borrower.decryptedPhone}`);
    };

    const handleWhatsApp = () => {
        if (borrower?.decryptedPhone) {
            const url = ReminderService.generateWhatsAppLink('friendly', {
                borrowerName: borrower.fullName,
                phoneNumber: borrower.decryptedPhone,
                amountDue: activeLoan?.installmentAmount || 0,
                dueDate: Date.now()
            });
            if (url) Linking.openURL(url);
        }
    };

    if (loading) return (
        <View className={`flex-1 justify-center items-center ${sunlightMode ? 'bg-white' : 'bg-slate-50'}`}>
            <ActivityIndicator size="large" color="#355E3B" />
            <Text className={`${sunlightMode ? 'text-black' : 'text-slate-700'} font-black uppercase tracking-widest mt-4`}>Analyzing Passbook...</Text>
        </View>
    );

    if (!borrower) return (
        <View className="flex-1 justify-center items-center bg-white p-10">
            <MaterialIcons name="error-outline" size={64} color="#EF4444" />
            <Text className="text-gray-900 font-black text-xl mt-6">Borrower not found</Text>
            <Text className="text-gray-700 text-center mt-2">The record you are looking for does not exist or has been removed.</Text>
            <AnimatedPressable 
                onPress={() => router.canGoBack() ? router.back() : router.replace('/(collector)')} 
                className="bg-gray-900 px-8 py-3 rounded-2xl mt-8"
            >
                <Text className="text-white font-bold">Go Back</Text>
            </AnimatedPressable>
        </View>
    );

    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const balance = activeLoan ? (activeLoan.totalAmount || 0) - totalPaid : 0;
    const progress = activeLoan ? Math.min(100, (totalPaid / (activeLoan.totalAmount || 1)) * 100) : 0;

    return (
        <SafeAreaView className={`flex-1 ${sunlightMode ? 'bg-white' : 'bg-slate-50'}`}>
            <StatusBar barStyle={sunlightMode ? 'dark-content' : 'light-content'} />
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {sunlightMode ? (
                    <View className="pt-12 pb-24 px-6 rounded-b-[48px] bg-white border-b-4 border-black">
                        <View className="flex-row justify-between items-center mb-6">
                            <View className="flex-row items-center">
                                <AnimatedPressable 
                                    onPress={() => router.canGoBack() ? router.back() : router.replace('/(collector)')} 
                                    className="bg-black w-11 h-11 rounded-2xl items-center justify-center mr-4 border-2 border-black"
                                >
                                    <MaterialIcons name="arrow-back" size={24} color="#FFF" />
                                </AnimatedPressable>
                                <View>
                                    <Text className="text-black text-[10px] font-black uppercase tracking-[2px]">Portfolio</Text>
                                    <Text className="text-black text-xl font-black">Borrower Passbook</Text>
                                </View>
                            </View>
                            <SyncStatusIndicator />
                        </View>

                        <Animated.View entering={FadeInUp} className="flex-row items-center">
                            <View className="w-20 h-20 bg-white p-1 rounded-3xl border-4 border-black mr-5">
                                <View className="w-full h-full bg-black rounded-2xl items-center justify-center">
                                    <Text className="text-white font-black text-3xl">{borrower.fullName.charAt(0)}</Text>
                                </View>
                            </View>
                            <View className="flex-1">
                                <Text className="text-black text-3xl font-black leading-none" numberOfLines={1}>{borrower.fullName}</Text>
                                <View className="flex-row items-center mt-2">
                                    <View className="bg-black px-3 py-1 rounded-full mr-2">
                                        <Text className="text-white text-[10px] font-black uppercase tracking-wider">{borrower.area || 'No Area'}</Text>
                                    </View>
                                    {activeLoan && (
                                        <View className="bg-white border-2 border-black px-3 py-1 rounded-full">
                                            <Text className="text-black text-[10px] font-black uppercase tracking-wider">Active Loan</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </Animated.View>

                        <View className="flex-row mt-8 gap-3">
                            <AnimatedPressable
                                onPress={handleCall}
                                className="bg-white h-14 w-14 rounded-2xl items-center justify-center border-4 border-black active:bg-black active:border-black"
                            >
                                <Ionicons name="call" size={20} color="#000" />
                            </AnimatedPressable>
                            <AnimatedPressable
                                onPress={handleSms}
                                className="bg-white h-14 w-14 rounded-2xl items-center justify-center border-4 border-black active:bg-black active:border-black"
                            >
                                <Ionicons name="chatbubble-ellipses" size={20} color="#000" />
                            </AnimatedPressable>
                            <AnimatedPressable
                                onPress={handleWhatsApp}
                                className="bg-black h-14 flex-1 flex-row rounded-2xl items-center justify-center border-4 border-black active:bg-white active:border-black"
                            >
                                <FontAwesome5 name="whatsapp" size={20} color="#FFF" />
                                <Text className="text-white font-black text-sm ml-3 uppercase tracking-wider">Contact</Text>
                            </AnimatedPressable>
                        </View>
                    </View>
                ) : (
                    <LinearGradient
                        colors={['#355E3B', '#064E3B']}
                        className="pt-12 pb-24 px-6 rounded-b-[48px] shadow-2xl relative"
                    >
                        <View className="flex-row justify-between items-center mb-6">
                            <View className="flex-row items-center">
                                <AnimatedPressable 
                                    onPress={() => router.canGoBack() ? router.back() : router.replace('/(collector)')} 
                                    className="bg-white/10 w-11 h-11 rounded-2xl items-center justify-center mr-4"
                                >
                                    <MaterialIcons name="arrow-back" size={24} color="#FFF" />
                                </AnimatedPressable>
                                <View>
                                    <Text className="text-white text-[10px] font-black uppercase tracking-[2px]">Portfolio</Text>
                                    <Text className="text-white text-xl font-black">Borrower Passbook</Text>
                                </View>
                            </View>
                            <SyncStatusIndicator />
                        </View>

                        <Animated.View entering={FadeInUp} className="flex-row items-center">
                            <View className="w-20 h-20 bg-white/10 p-1 rounded-3xl border border-white/20 mr-5">
                                <View className="w-full h-full bg-teal-50 rounded-2xl items-center justify-center">
                                    <Text className="text-teal-700 font-black text-3xl">{borrower.fullName.charAt(0)}</Text>
                                </View>
                            </View>
                            <View className="flex-1">
                                <Text className="text-white text-3xl font-black leading-none" numberOfLines={1}>{borrower.fullName}</Text>
                                <View className="flex-row items-center mt-2">
                                    <View className="bg-white/20 px-3 py-1 rounded-full mr-2">
                                        <Text className="text-emerald-50 text-[10px] font-black uppercase tracking-wider">{borrower.area || 'No Area'}</Text>
                                    </View>
                                    {activeLoan && (
                                        <View className="bg-orange-500/80 px-3 py-1 rounded-full">
                                            <Text className="text-white text-[10px] font-black uppercase tracking-wider">Active Loan</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </Animated.View>

                        <View className="flex-row mt-8 gap-3">
                            <AnimatedPressable
                                onPress={handleCall}
                                className="bg-white/10 h-14 w-14 rounded-2xl items-center justify-center border border-white/20 active:bg-white/30"
                            >
                                <Ionicons name="call" size={20} color="#FFF" />
                            </AnimatedPressable>
                            <AnimatedPressable
                                onPress={handleSms}
                                className="bg-white/10 h-14 w-14 rounded-2xl items-center justify-center border border-white/20 active:bg-white/30"
                            >
                                <Ionicons name="chatbubble-ellipses" size={20} color="#FFF" />
                            </AnimatedPressable>
                            <AnimatedPressable
                                onPress={handleWhatsApp}
                                className="bg-white/10 h-14 flex-1 flex-row rounded-2xl items-center justify-center border border-white/20 active:bg-white/30"
                            >
                                <FontAwesome5 name="whatsapp" size={20} color="#FFF" />
                                <Text className="text-white font-black text-sm ml-3 uppercase tracking-wider">Contact</Text>
                            </AnimatedPressable>
                        </View>
                    </LinearGradient>
                )}

                {/* Financial Summary Content */}
                <View className="px-6 -mt-10 mb-10">
                    {activeLoan ? (
                        <Animated.View entering={FadeInDown.delay(100)} className={`${sunlightMode ? 'bg-white border-4 border-black' : 'bg-white shadow-sm border-gray-100'} p-6 rounded-[40px]`}>
                            <View className="flex-row justify-between items-center mb-6">
                                <View>
                                    <Text className={`${sunlightMode ? 'text-black' : 'text-slate-700'} text-[10px] font-black uppercase tracking-widest mb-1`}>Repayment Status</Text>
                                    <Text className={`text-3xl font-black ${sunlightMode ? 'text-black' : 'text-slate-900'}`}>{progress.toFixed(0)}%</Text>
                                </View>
                                <View className="items-end">
                                    <Text className={`${sunlightMode ? 'text-black' : 'text-slate-700'} text-[10px] font-black uppercase tracking-widest mb-1`}>Balance</Text>
                                    <Text className={`text-xl font-black ${sunlightMode ? 'text-black' : 'text-red-600'}`}>{formatPHP(balance)}</Text>
                                </View>
                            </View>

                            {/* Progress bar */}
                            <View className={`h-4 rounded-full mb-8 overflow-hidden ${sunlightMode ? 'bg-gray-200 border-2 border-black' : 'bg-gray-100'}`}>
                                <View 
                                    className={`h-full rounded-full ${sunlightMode ? 'bg-black' : 'bg-teal-500'}`} 
                                    style={{ width: `${progress}%` }} 
                                />
                            </View>

                             <View className="flex-row gap-4">
                                <View className={`flex-1 p-4 rounded-3xl items-center border ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-emerald-50 border-emerald-100'}`}>
                                    <Text className={`${sunlightMode ? 'text-black' : 'text-emerald-700'} text-[9px] font-black uppercase mb-1`}>Total Loan</Text>
                                    <Text className={`${sunlightMode ? 'text-black' : 'text-slate-900'} font-black text-base`}>{formatPHP(activeLoan.totalAmount)}</Text>
                                </View>
                                <View className={`flex-1 p-4 rounded-3xl items-center border ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-amber-50 border-amber-100'}`}>
                                    <Text className={`${sunlightMode ? 'text-black' : 'text-amber-700'} text-[9px] font-black uppercase mb-1`}>Daily Due</Text>
                                    <Text className={`${sunlightMode ? 'text-black' : 'text-slate-900'} font-black text-base`}>{formatPHP(activeLoan.installmentAmount)}</Text>
                                </View>
                            </View>
                        </Animated.View>
                    ) : (
                        <View className="bg-white p-10 rounded-[40px] items-center border border-gray-100 shadow-sm">
                            <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
                            <Text className="text-gray-700 font-bold mt-4 text-center">No active loan records found</Text>
                        </View>
                    )}

                    {activeLoan && (
                        <Animated.View entering={FadeInDown.delay(200)} className="mt-8">
                            <View className="flex-row justify-between items-center mb-6">
                                <View>
                                    <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-xl`}>Payment History</Text>
                                    <Text className={`${sunlightMode ? 'text-black font-black uppercase text-[10px]' : 'text-gray-700 text-xs font-bold'}`}>{payments.length} successful records</Text>
                                </View>
                                <AnimatedPressable
                                    onPress={() => router.push({ pathname: '/(payment-encoder)', params: { borrowerId: id, loanId: activeLoan.id } })}
                                    className={`${sunlightMode ? 'bg-black border-2 border-black' : 'bg-emerald-600 shadow-lg shadow-emerald-200'} px-6 py-3.5 rounded-2xl active:scale-95 transition-all`}
                                >
                                    <View className="flex-row items-center">
                                        <Ionicons name="add-circle" size={18} color="#FFF" />
                                        <Text className="text-white font-black text-xs ml-2 uppercase tracking-widest">Collect Payment</Text>
                                    </View>
                                </AnimatedPressable>
                            </View>

                            {payments.length === 0 ? (
                                <View className="bg-white p-12 rounded-[32px] items-center border border-dashed border-gray-200">
                                    <Text className="text-gray-700 font-bold italic">No payments recorded yet</Text>
                                </View>
                            ) : (
                                payments.map((p, i) => (
                                    <Animated.View 
                                        key={p.id} 
                                        entering={FadeInRight.delay(i * 100)}
                                        className={`p-5 rounded-3xl mb-4 flex-row justify-between items-center border ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-white shadow-sm border-gray-50'}`}
                                    >
                                        <View className="flex-row items-center">
                                            <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 border ${sunlightMode ? 'bg-black border-black' : 'bg-gray-50 border-gray-100'}`}>
                                                <Ionicons name="card-outline" size={24} color={sunlightMode ? "#FFF" : "#4B5563"} />
                                            </View>
                                            <View>
                                                <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-sm`}>#{p.receiptNumber || 'OFFLINE'}</Text>
                                                <Text className={`${sunlightMode ? 'text-black font-black tracking-tighter' : 'text-gray-700'} text-[10px] font-bold mt-0.5`}>{format(new Date(p.paymentDate), 'MMM d, yyyy · p')}</Text>
                                            </View>
                                        </View>
                                        <View className="items-end">
                                            <Text className={`font-black text-lg ${sunlightMode ? 'text-black' : 'text-teal-600'}`}>+{formatPHP(p.amount)}</Text>
                                            <View className={`px-2 py-0.5 rounded-md ${sunlightMode ? 'bg-black' : 'bg-teal-50'}`}>
                                                <Text className={`text-[8px] font-black uppercase ${sunlightMode ? 'text-white' : 'text-teal-600'}`}>Collected</Text>
                                            </View>
                                        </View>
                                    </Animated.View>
                                ))
                            )}
                        </Animated.View>
                    )}
                </View>

                {/* Additional Info Section */}
                <View className="px-6 pb-20">
                    <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-lg mb-4`}>Personal Details</Text>
                    <View className={`rounded-[32px] overflow-hidden border ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-white border-gray-100 shadow-sm'}`}>
                        <View className={`p-5 flex-row items-center border-b ${sunlightMode ? 'border-black' : 'border-gray-50'}`}>
                            <View className={`w-10 h-10 rounded-2xl items-center justify-center mr-4 border ${sunlightMode ? 'bg-black border-black' : 'bg-teal-50'}`}>
                                <Ionicons name="calendar" size={18} color={sunlightMode ? "#FFF" : "#0D9488"} />
                            </View>
                            <View>
                                <Text className={`${sunlightMode ? 'text-black' : 'text-gray-700'} text-[9px] font-black uppercase tracking-widest`}>Date of Birth</Text>
                                <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black`}>{borrower.dateOfBirth ? format(new Date(borrower.dateOfBirth), 'MMMM do, yyyy') : 'Not provided'}</Text>
                            </View>
                        </View>
                        <View className="p-5 flex-row items-center">
                            <View className={`w-10 h-10 rounded-2xl items-center justify-center mr-4 border ${sunlightMode ? 'bg-black border-black' : 'bg-teal-50'}`}>
                                <Ionicons name="location" size={18} color={sunlightMode ? "#FFF" : "#0D9488"} />
                            </View>
                            <View className="flex-1">
                                <Text className={`${sunlightMode ? 'text-black' : 'text-gray-700'} text-[9px] font-black uppercase tracking-widest`}>Home Address</Text>
                                <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black`} numberOfLines={2}>{borrower.decryptedAddress || 'No address provided'}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

