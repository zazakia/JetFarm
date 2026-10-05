import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator, SafeAreaView, StatusBar, Alert, TextInput, Modal } from 'react-native';
import { database } from '../../src/database';
import Payment from '../../src/database/models/Payment';
import Collector from '../../src/database/models/Collector';
import { useAuth } from '../../src/store/AuthContext';
import { SyncStatusIndicator } from '../../src/components/SyncStatusIndicator';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { formatPHP } from '../../src/utils/currency';
import { useRouter } from 'expo-router';
import { isPast, isToday, format, parseISO, startOfDay } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { safeBack } from '../../src/utils/navigation';
import { PhpCurrencyText } from '../../src/components/PhpCurrencyText';
import uuid from 'react-native-uuid';
import Animated, { FadeInDown, FadeOut, Layout } from 'react-native-reanimated';
import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import { DatePicker } from '../../src/components/DatePicker';
import { PaymentService } from '../../src/services/PaymentService';
import * as Linking from 'expo-linking';
import { useCollectionSheet, CollectionItem } from '../../src/hooks/useCollectionSheet';
import { SyncService } from '../../src/services/SyncService';

export default function CollectionSheetScreen() {
    const { user, collectorId, sunlightMode } = useAuth();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [collectionDate, setCollectionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [selectedItemForPayment, setSelectedItemForPayment] = useState<CollectionItem | null>(null);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [referenceNumber, setReferenceNumber] = useState('');

    const { items, loading, refreshing, refresh } = useCollectionSheet({
        collectorId: collectorId || user?.id,
        asOfDate: parseISO(collectionDate),
        searchQuery,
        onRefresh: () => SyncService.sync(),
    });

    const sheetTotals = useMemo(() => {
        const selectedDate = parseISO(collectionDate);
        return items.reduce(
            (totals, item) => {
                const dueDate = new Date(item.schedule.dueDate);
                const overdue = isPast(dueDate) && !isToday(dueDate) && dueDate.getTime() < startOfDay(selectedDate).getTime();
                totals.amount += item.schedule.scheduledAmount;
                totals.count += 1;
                if (overdue) totals.overdue += 1;
                return totals;
            },
            { amount: 0, count: 0, overdue: 0 }
        );
    }, [items, collectionDate]);

    const handleQuickCollect = async (item: CollectionItem, pType: string = 'cash', rNumber: string = '') => {
        setProcessingId(item.schedule.id);
        try {
            await PaymentService.postPayment({
                loanId: item.loan.id,
                amount: item.schedule.scheduledAmount,
                paymentDate: parseISO(collectionDate),
                paymentType: pType,
                receiptNumber: rNumber || null,
                notes: pType === 'cash' ? 'Quick Collect' : `Paid via ${pType}`,
                collectorId: collectorId || user?.id || '',
                encodedBy: user?.id || collectorId || '',
                database,
            });

            
            // Success Haptic is handled by AnimatedPressable if used, 
            // but we can add an extra flourish or just rely on state update
            // The settled schedule drops out of the reactive sheet on its own.
            setPaymentModalVisible(false);
            setReferenceNumber('');
            setPaymentMethod('cash');
        } catch (error) {
            console.error('Quick collect failed', error);
            Alert.alert("Error", "Failed to record payment.");
        } finally {
            setProcessingId(null);
        }
    };

    const openPaymentModal = (item: CollectionItem) => {
        setSelectedItemForPayment(item);
        setPaymentMethod('cash');
        setReferenceNumber('');
        setPaymentModalVisible(true);
    };

    const contactBorrower = (item: CollectionItem, mode: 'call' | 'sms') => {
        const phone = item.borrower.decryptedPhone || item.borrower.phone;
        if (!phone) {
            Alert.alert('No phone number', `${item.borrower.fullName} has no phone number on file.`);
            return;
        }
        Linking.openURL(`${mode === 'call' ? 'tel' : 'sms'}:${phone}`);
    };

    return (
        <SafeAreaView className={`flex-1 ${sunlightMode ? 'bg-white' : 'bg-slate-50'}`}>
            <StatusBar barStyle={sunlightMode ? 'dark-content' : 'light-content'} />
            {sunlightMode ? (
                <View className="pt-12 pb-14 px-6 rounded-b-[48px] bg-white border-b-4 border-black">
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center">
                            <AnimatedPressable 
                                onPress={() => safeBack(router, '/(collector)')} 
                                className="bg-black w-11 h-11 rounded-2xl items-center justify-center mr-4 border-2 border-black"
                            >
                                <MaterialIcons name="arrow-back" size={24} color="#FFF" />
                            </AnimatedPressable>
                            <View>
                                <Text className="text-black text-[10px] font-black uppercase tracking-[3px]">Daily Operations</Text>
                                <Text testID="page-title" className="text-black text-2xl font-black mt-0.5">Collection Sheet</Text>
                            </View>
                        </View>
                        <SyncStatusIndicator />
                    </View>
                    
                    <View className="bg-white p-4 rounded-3xl border-4 border-black mb-4">
                        <View className="flex-row items-center mb-3">
                            <View className="bg-black p-2.5 rounded-2xl mr-4 border-2 border-black">
                                <Ionicons name="calendar" size={20} color="#FFF" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-black font-black text-xs uppercase tracking-widest mb-1">Sheet Date</Text>
                                <DatePicker value={collectionDate} onChange={setCollectionDate} />
                            </View>
                        </View>
                        <View className="flex-row justify-between items-center bg-gray-100 p-3 rounded-2xl">
                            <Text className="text-black text-xs font-black">{items.length} collections pending</Text>
                            {items.length > 0 && (
                                <View className="bg-black px-3 py-1 rounded-full">
                                    <Text className="text-white text-[10px] font-black uppercase tracking-wider">Active</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    <View className="bg-white px-4 py-3 rounded-2xl flex-row items-center border-4 border-black">
                        <Ionicons name="search" size={20} color="#000" />
                        <View className="flex-1 ml-3">
                            <TextInput
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                returnKeyType="search"
                                placeholder="Find borrower..."
                                placeholderTextColor="#333"
                                style={{ color: '#000', fontSize: 16 }}
                                className="font-black h-8"
                                autoCorrect={false}
                            />
                        </View>
                        {searchQuery.length > 0 ? (
                            <Pressable onPress={() => setSearchQuery('')} className="p-1">
                                <Ionicons name="close-circle" size={20} color="#000" />
                            </Pressable>
                        ) : null}
                    </View>
                </View>
            ) : (
                <LinearGradient
                    colors={['#0D9488', '#115E59']}
                    className="pt-12 pb-14 px-6 rounded-b-[48px] shadow-2xl"
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
                                <Text className="text-teal-100 text-[10px] font-bold uppercase tracking-[3px]">Daily Operations</Text>
                                <Text testID="page-title" className="text-white text-2xl font-black mt-0.5">Collection Sheet</Text>
                            </View>
                        </View>
                        <SyncStatusIndicator />
                    </View>
                    
                    <View className="bg-white/10 p-4 rounded-3xl border border-white/10 mb-4">
                        <View className="flex-row items-center mb-3">
                            <View className="bg-white/20 p-2.5 rounded-2xl mr-4">
                                <Ionicons name="calendar" size={20} color="#FFF" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-teal-100 text-[10px] font-bold uppercase tracking-widest mb-1">Sheet Date</Text>
                                <DatePicker value={collectionDate} onChange={setCollectionDate} />
                            </View>
                        </View>
                        <View className="flex-row justify-between items-center bg-white/5 p-3 rounded-2xl">
                            <Text className="text-teal-100/70 text-xs font-medium">{items.length} collections pending</Text>
                            {items.length > 0 && (
                                <View className="bg-orange-500 px-3 py-1 rounded-full shadow-sm">
                                    <Text className="text-white text-[10px] font-black uppercase tracking-wider">Active</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Search Bar Integrated into Header */}
                    <View className="bg-white/20 px-4 py-3 rounded-2xl flex-row items-center border border-white/20 shadow-sm">
                        <Ionicons name="search" size={20} color="#FFF" />
                        <View className="flex-1 ml-3">
                            <TextInput
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                returnKeyType="search"
                                placeholder="Find borrower..."
                                placeholderTextColor="#CCFBF1"
                                style={{ color: '#FFF', fontSize: 16 }}
                                className="font-medium h-8"
                                autoCorrect={false}
                            />
                        </View>
                        {searchQuery.length > 0 ? (
                            <Pressable onPress={() => setSearchQuery('')} className="p-1">
                                <Ionicons name="close-circle" size={20} color="#CCFBF1" />
                            </Pressable>
                        ) : null}
                    </View>
                </LinearGradient>
            )}

            <ScrollView
                className="flex-1 -mt-6"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={sunlightMode ? "#000" : "#0D9488"} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, paddingTop: 10 }}
            >
                <Animated.View
                    testID="collector-route-summary"
                    entering={FadeInDown}
                    className={`p-5 rounded-[32px] mb-4 border ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-white border-emerald-50 shadow-sm'}`}
                >
                    <View className="flex-row justify-between items-start mb-4">
                        <View className="flex-1 pr-4">
                            <Text className={`${sunlightMode ? 'text-black' : 'text-gray-700'} text-[10px] font-black uppercase tracking-widest`}>Route Summary</Text>
                            <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} text-2xl font-black mt-1`}>
                                {format(parseISO(collectionDate), 'MMM d, yyyy')}
                            </Text>
                        </View>
                        <View className={`${sunlightMode ? 'bg-black' : 'bg-emerald-50'} px-3 py-1.5 rounded-full`}>
                            <Text className={`${sunlightMode ? 'text-white' : 'text-emerald-700'} text-[10px] font-black uppercase`}>
                                {sheetTotals.count} stops
                            </Text>
                        </View>
                    </View>
                    <View className="flex-row gap-3">
                        <View className={`flex-1 p-4 rounded-2xl ${sunlightMode ? 'bg-white border-2 border-black' : 'bg-emerald-50'}`}>
                            <Text className={`${sunlightMode ? 'text-black' : 'text-emerald-700'} text-[9px] font-black uppercase tracking-widest`}>Expected</Text>
                            <Text className={`${sunlightMode ? 'text-black' : 'text-emerald-900'} text-lg font-black mt-1`}>
                                {formatPHP(sheetTotals.amount)}
                            </Text>
                        </View>
                        <View className={`flex-1 p-4 rounded-2xl ${sunlightMode ? 'bg-white border-2 border-black' : sheetTotals.overdue ? 'bg-red-50' : 'bg-slate-50'}`}>
                            <Text className={`${sunlightMode ? 'text-black' : sheetTotals.overdue ? 'text-red-700' : 'text-slate-700'} text-[9px] font-black uppercase tracking-widest`}>Overdue</Text>
                            <Text className={`${sunlightMode ? 'text-black' : sheetTotals.overdue ? 'text-red-700' : 'text-slate-900'} text-lg font-black mt-1`}>
                                {sheetTotals.overdue}
                            </Text>
                        </View>
                    </View>
                </Animated.View>

                {items.length === 0 ? (
                    <Animated.View entering={FadeInDown} className="bg-white p-12 rounded-[40px] items-center border border-gray-100 shadow-sm mt-4">
                        <View className="w-20 h-20 bg-teal-50 rounded-full items-center justify-center mb-6">
                            <MaterialIcons name={searchQuery ? "search-off" : "check-circle"} size={48} color="#0D9488" />
                        </View>
                        <Text className="text-gray-900 font-black text-xl text-center">
                            {searchQuery ? "No matches found" : "All collections done!"}
                        </Text>
                        <Text className="text-gray-700 text-sm text-center mt-2 px-6">
                            {searchQuery 
                                ? `Couldn't find any pending collections for "${searchQuery}"` 
                                : "You've processed all scheduled collections for today. Great job!"}
                        </Text>
                    </Animated.View>
                ) : (
                    <View>
                        {items.map((item, idx) => {
                            const isOverdue = isPast(new Date(item.schedule.dueDate)) && !isToday(new Date(item.schedule.dueDate));
                            const isProcessing = processingId === item.schedule.id;

                            return (
                                <Animated.View 
                                    key={item.schedule.id}
                                    entering={FadeInDown.delay(idx * 50).springify().damping(15)}
                                    layout={Layout.springify()}
                                    className={`bg-white p-5 rounded-[32px] mb-4 border ${sunlightMode ? 'border-4 border-black' : isOverdue ? 'border-red-100 bg-red-50/30 shadow-sm' : 'border-gray-50 shadow-sm'}`}
                                >
                                    <View className="flex-row items-center mb-5">
                                        <View className={`w-14 h-14 rounded-2xl items-center justify-center mr-4 border ${sunlightMode ? 'bg-black border-black' : isOverdue ? 'bg-red-500 border-red-500' : 'bg-teal-500 border-teal-500'}`}>
                                            <Text className="text-white font-black text-xl">
                                                {item.borrower.fullName.charAt(0)}
                                            </Text>
                                        </View>
                                        <View className="flex-1">
                                            <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-lg leading-tight`} numberOfLines={1}>
                                                {item.borrower.fullName}
                                            </Text>
                                            <View className="flex-row flex-wrap items-center mt-1.5 gap-2">
                                                <View className={`px-2 py-0.5 rounded-full ${sunlightMode ? 'bg-black' : isOverdue ? 'bg-red-100' : 'bg-gray-100'}`}>
                                                    <Text className={`text-[9px] font-black uppercase tracking-tighter ${sunlightMode ? 'text-white' : isOverdue ? 'text-red-600' : 'text-gray-700'}`}>
                                                        {isOverdue ? 'Overdue' : 'Due Today'}
                                                    </Text>
                                                </View>
                                                <View className="flex-row items-center">
                                                    <Ionicons name="navigate-circle" size={14} color={sunlightMode ? "#000" : "#9CA3AF"} />
                                                    <Text className={`${sunlightMode ? 'text-black' : 'text-gray-700'} text-[10px] font-bold uppercase ml-1`} numberOfLines={1}>
                                                        {item.borrower.area || 'Field'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text className={`${sunlightMode ? 'text-black' : isOverdue ? 'text-red-600' : 'text-gray-500'} text-[10px] font-black mt-1.5`}>
                                                Due {format(new Date(item.schedule.dueDate), 'MMM d, yyyy')}
                                            </Text>
                                        </View>
                                        <View className="items-end">
                                            <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-xl tracking-tighter`}>
                                                {formatPHP(item.schedule.scheduledAmount)}
                                            </Text>
                                            <View className="flex-row items-center">
                                                <Text className={`${sunlightMode ? 'text-black' : 'text-gray-700'} text-[9px] font-bold mr-1`}>Loan #:</Text>
                                                <Text className={`${sunlightMode ? 'text-black' : 'text-teal-600'} text-[10px] font-black`}>
                                                    {item.loan.loanNumber}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View className="flex-row gap-3">
                                        <AnimatedPressable
                                            testID={`collector-call-${item.borrower.id}`}
                                            onPress={() => contactBorrower(item, 'call')}
                                            className={`${sunlightMode ? 'bg-white border-4 border-black' : 'bg-emerald-50 border-emerald-100'} h-14 w-14 rounded-2xl items-center justify-center border`}
                                        >
                                            <Ionicons name="call" size={20} color={sunlightMode ? "#000" : "#1E3A8A"} />
                                        </AnimatedPressable>
                                        <AnimatedPressable
                                            testID={`collector-sms-${item.borrower.id}`}
                                            onPress={() => contactBorrower(item, 'sms')}
                                            className={`${sunlightMode ? 'bg-white border-4 border-black' : 'bg-blue-50 border-blue-100'} h-14 w-14 rounded-2xl items-center justify-center border`}
                                        >
                                            <Ionicons name="chatbubble-ellipses" size={20} color={sunlightMode ? "#000" : "#2563EB"} />
                                        </AnimatedPressable>
                                        <AnimatedPressable
                                            onPress={() => router.push(`/(collector)/borrowers/${item.borrower.id}`)}
                                            className={`${sunlightMode ? 'bg-white border-4 border-black' : 'bg-gray-100 border-gray-200'} h-14 w-14 rounded-2xl items-center justify-center border`}
                                        >
                                            <Ionicons name="person" size={22} color={sunlightMode ? "#000" : "#4B5563"} />
                                        </AnimatedPressable>
                                        
                                        <AnimatedPressable
                                            onPress={() => handleQuickCollect(item, 'cash', '')}
                                            disabled={isProcessing}
                                            className={`flex-1 h-14 flex-row items-center justify-center rounded-2xl ${sunlightMode ? 'bg-black border-4 border-black' : isOverdue ? 'bg-red-600' : 'bg-teal-600 shadow-sm'} mr-2`}
                                        >
                                            {isProcessing ? (
                                                <ActivityIndicator size="small" color="#FFF" />
                                            ) : (
                                                <>
                                                    <Ionicons name="cash" size={18} color="#FFF" />
                                                    <Text className="text-white font-black uppercase tracking-[2px] text-[10px] ml-1">Cash</Text>
                                                </>
                                            )}
                                        </AnimatedPressable>

                                        <AnimatedPressable
                                            onPress={() => openPaymentModal(item)}
                                            disabled={isProcessing}
                                            className={`h-14 px-4 flex-row items-center justify-center rounded-2xl ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-blue-600 shadow-sm'}`}
                                        >
                                            <Ionicons name="card" size={18} color={sunlightMode ? "#000" : "#FFF"} />
                                            <Text className={`${sunlightMode ? 'text-black' : 'text-white'} font-black uppercase tracking-[1px] text-[10px] ml-1`}>Other</Text>
                                        </AnimatedPressable>
                                    </View>
                                </Animated.View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            <Modal visible={paymentModalVisible} transparent animationType="slide">
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-white p-6 rounded-t-[32px]">
                        <Text className="text-xl font-black mb-4">Record Payment</Text>
                        {selectedItemForPayment && (
                            <Text className="text-sm font-bold text-gray-700 mb-4">
                                {selectedItemForPayment.borrower.fullName} - {formatPHP(selectedItemForPayment.schedule.scheduledAmount)}
                            </Text>
                        )}
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Payment Method</Text>
                        <View className="flex-row rounded-xl border border-gray-200 overflow-hidden mb-4">
                            {['cash', 'gcash', 'bank'].map((type) => (
                                <Pressable
                                    key={type}
                                    onPress={() => setPaymentMethod(type)}
                                    className={`flex-1 p-3 items-center justify-center ${paymentMethod === type ? 'bg-blue-900' : 'bg-gray-50'}`}
                                >
                                    <Text className={`font-bold uppercase text-[11px] ${paymentMethod === type ? 'text-white' : 'text-gray-700'}`}>
                                        {type}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                        {paymentMethod !== 'cash' && (
                            <View className="mb-4">
                                <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Reference Number *</Text>
                                <TextInput
                                    className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 font-bold tracking-wider uppercase"
                                    value={referenceNumber} onChangeText={setReferenceNumber}
                                    placeholder="REF-000000"
                                 placeholderTextColor="#9CA3AF"/>
                            </View>
                        )}
                        <View className="flex-row gap-3 mt-4">
                            <Pressable onPress={() => setPaymentModalVisible(false)} className="flex-1 p-4 rounded-xl bg-gray-200 items-center">
                                <Text className="font-black uppercase text-gray-700">Cancel</Text>
                            </Pressable>
                            <Pressable 
                                disabled={processingId !== null}
                                onPress={() => {
                                    if (paymentMethod !== 'cash' && (!referenceNumber || !String(referenceNumber).trim())) {
                                        Alert.alert("Error", "Reference Number is required for GCash/Bank transfers.");
                                        return;
                                    }
                                    if (selectedItemForPayment) {
                                        handleQuickCollect(selectedItemForPayment, paymentMethod, referenceNumber);
                                    }
                                }} 
                                className={`flex-1 p-4 rounded-xl items-center ${processingId !== null ? 'bg-gray-400' : 'bg-blue-900'}`}
                            >
                                <Text className="font-black uppercase text-white">
                                    {processingId !== null ? 'Processing...' : 'Confirm'}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

