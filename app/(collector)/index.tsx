import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, SafeAreaView, StatusBar, TextInput, useWindowDimensions, Pressable , Alert } from 'react-native';
import Animated, { FadeInRight, FadeInDown } from 'react-native-reanimated';
import { database } from '../../src/database';
import Borrower from '../../src/database/models/Borrower';
import Loan from '../../src/database/models/Loan';
import Payment from '../../src/database/models/Payment';
import PaymentSchedule from '../../src/database/models/PaymentSchedule';
import { useAuth } from '../../src/store/AuthContext';
import { SyncStatusBadge } from '../../src/components/SyncStatusBadge';
import { MaterialIcons } from '@expo/vector-icons';
import { Q } from '@nozbe/watermelondb';
import { SyncStatusIndicator } from '../../src/components/SyncStatusIndicator';
import { useRouter } from 'expo-router';
import { startOfDay, endOfDay } from 'date-fns';
import { AuthService } from '../../src/services/AuthService';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';

import { AnimatedPressable } from '../../src/components/AnimatedPressable';
import { CollectorKpiCard } from '../../src/components/CollectorKpiCard';
import { ReminderService } from '../../src/services/ReminderService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CollectorDashboard() {
    const { user, collectorId, sunlightMode, toggleSunlightMode, signOut } = useAuth();
    const router = useRouter();
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [borrowers, setBorrowers] = useState<Borrower[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({
        todayCollection: 0,
        outstanding: 0,
        activeClients: 0,
        efficiency: 0,
        targetToday: 0
    });

    const fetchData = async () => {
        if (!user) {
            console.log('[CollectorDashboard] No user yet, skipping fetch');
            setLoading(false);
            return;
        }
        
        try {
            const currentCollectorId = collectorId || user.id;

            const assignedBorrowers = await database.collections.get<Borrower>('borrowers')
                .query(Q.where('collector_id', currentCollectorId))
                .fetch();

            setBorrowers(assignedBorrowers);

            const borrowerIds = assignedBorrowers.map(b => b.id);
            if (borrowerIds.length === 0) {
                setStats({ todayCollection: 0, outstanding: 0, activeClients: 0, efficiency: 0, targetToday: 0 });
                return;
            }

            const activeLoans = await database.collections.get<Loan>('loans')
                .query(Q.where('borrower_id', Q.oneOf(borrowerIds)), Q.where('status', 'active'))
                .fetch();

            const activeLoanIds = activeLoans.map(l => l.id);

            const today = new Date();
            const start = startOfDay(today).getTime();
            const end = endOfDay(today).getTime();

            const todayPayments = await database.collections.get<Payment>('payments')
                .query(
                    Q.where('collector_id', currentCollectorId),
                    Q.where('payment_date', Q.between(start, end))
                )
                .fetch();

            const collectedToday = todayPayments.reduce((s, p) => s + p.amount, 0);

            const unpaidSchedules = await database.collections.get<PaymentSchedule>('payment_schedules')
                .query(
                    Q.where('loan_id', Q.oneOf(activeLoanIds)),
                    Q.where('status', Q.notEq('paid'))
                )
                .fetch();

            const totalOutstanding = unpaidSchedules.reduce((s, sch) => s + sch.scheduledAmount, 0);

            const dueTodaySchedules = await database.collections.get<PaymentSchedule>('payment_schedules')
                .query(
                    Q.where('loan_id', Q.oneOf(activeLoanIds)),
                    Q.where('due_date', Q.between(start, end))
                )
                .fetch();

            const targetToday = dueTodaySchedules.reduce((s, sch) => s + sch.scheduledAmount, 0);
            const efficiency = targetToday > 0 ? (collectedToday / targetToday) * 100 : 0;

            setStats({
                todayCollection: collectedToday,
                outstanding: totalOutstanding,
                activeClients: assignedBorrowers.length,
                efficiency: efficiency,
                targetToday: targetToday
            });
        } catch (error) {
            console.error('Failed to fetch collector data', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user, collectorId]);

    const filteredBorrowers = useMemo(() => {
        if (!searchQuery.trim()) return borrowers;
        return borrowers.filter(b => 
            b.fullName.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [borrowers, searchQuery]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const isSmallPhone = width < 390;
    const isCompactHeight = height < 780;
    const greetingName = user?.email?.split('@')[0] ?? 'Collector';

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-slate-50">
                <ActivityIndicator size="large" color="#0D9488" />
            </View>
        );
    }

    return (
        <SafeAreaView className={`flex-1 ${sunlightMode ? 'bg-white' : 'bg-slate-50'}`}>
            <StatusBar barStyle={sunlightMode ? 'dark-content' : 'light-content'} />
            <ScrollView
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={sunlightMode ? '#000' : '#FFF'} />}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 + insets.bottom + 76 }}
            >
                {/* Header Section with Gradient */}
                {sunlightMode ? (
                    <View
                        className="px-6 rounded-b-[48px] bg-white border-b-4 border-black shadow-none"
                        style={{
                            paddingTop: isCompactHeight ? 44 : 56,
                            paddingBottom: isCompactHeight ? 88 : 128,
                        }}
                    >
                        <View className="flex-row justify-between items-center mb-6">
                            <View className="flex-1 pr-3">
                                <Text className="text-black text-xs font-black uppercase tracking-[3px]">Collector Portal</Text>
                                <Text
                                    className="text-black font-black mt-1"
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.78}
                                    style={{ fontSize: isSmallPhone ? 36 : 40, lineHeight: isSmallPhone ? 42 : 46 }}
                                >
                                    {getGreeting()}, {greetingName}!
                                </Text>
                            </View>
                            <View className="flex-row items-center">
                                <AnimatedPressable
                                    onPress={toggleSunlightMode}
                                    className="p-3 bg-black rounded-2xl border-2 border-black"
                                >
                                    <MaterialIcons name="wb-sunny" size={20} color="#FFFFFF" />
                                </AnimatedPressable>
                                <AnimatedPressable
                                    testID="logout-button"
                                    onPress={signOut}
                                    className="ml-4 p-3 bg-white rounded-2xl border-2 border-black"
                                >
                                    <MaterialIcons name="logout" size={20} color="#000000" />
                                </AnimatedPressable>
                            </View>
                        </View>

                        {/* Progress Overview in Header */}
                        <View className="mt-4 bg-white rounded-[32px] border-4 border-black" style={{ padding: isSmallPhone ? 16 : 20 }}>
                            <View className="flex-row justify-between items-end mb-2">
                                <View className="flex-1 pr-2">
                                    <Text className="text-black text-[10px] font-black uppercase tracking-widest">Daily Goal</Text>
                                    <Text className="text-black font-black text-xl" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                                        ₱{stats.todayCollection.toLocaleString()} 
                                        <Text className="text-gray-700 text-sm font-black"> / ₱{stats.targetToday.toLocaleString()}</Text>
                                    </Text>
                                </View>
                                <View className="items-end">
                                    <Text className="text-black font-black text-xl">{Math.min(100, Math.round(stats.efficiency))}%</Text>
                                </View>
                            </View>
                            <View className="h-4 bg-gray-100 rounded-full overflow-hidden border-2 border-black">
                                <View 
                                    style={{ width: `${Math.min(100, stats.efficiency)}%` }} 
                                    className="h-full bg-black rounded-full"
                                />
                            </View>
                        </View>
                    </View>
                ) : (
                    <LinearGradient
                        colors={['#355E3B', '#064E3B']}
                        className="px-6 rounded-b-[48px] shadow-2xl"
                        style={{
                            paddingTop: isCompactHeight ? 44 : 56,
                            paddingBottom: isCompactHeight ? 88 : 128,
                        }}
                    >
                        <View className="flex-row justify-between items-center mb-6">
                            <View className="flex-1 pr-3">
                                <Text className="text-white text-xs font-black uppercase tracking-[3px]">Collector Portal</Text>
                                <Text
                                    className="text-white font-black mt-1"
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.78}
                                    style={{ fontSize: isSmallPhone ? 36 : 40, lineHeight: isSmallPhone ? 42 : 46 }}
                                >
                                    {getGreeting()}, {greetingName}!
                                </Text>
                            </View>
                            <View className="flex-row items-center">
                                <AnimatedPressable
                                    onPress={toggleSunlightMode}
                                    className="p-3 bg-white/10 rounded-2xl border border-white/10"
                                >
                                    <MaterialIcons name="wb-sunny" size={20} color="#FFFFFF" />
                                </AnimatedPressable>
                                <SyncStatusIndicator />
                                <AnimatedPressable
                                    testID="logout-button"
                                    onPress={signOut}
                                    className="ml-4 p-3 bg-white/10 rounded-2xl border border-white/10"
                                >
                                    <MaterialIcons name="logout" size={20} color="#FFFFFF" />
                                </AnimatedPressable>
                            </View>
                        </View>

                        {/* Progress Overview in Header */}
                        <View className="mt-4 bg-black/20 rounded-[32px] border border-white/10" style={{ padding: isSmallPhone ? 16 : 20 }}>
                            <View className="flex-row justify-between items-end mb-2">
                                <View className="flex-1 pr-2">
                                    <Text className="text-teal-100 text-[10px] font-black uppercase tracking-widest">Daily Goal</Text>
                                    <Text className="text-white font-black text-xl" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                                        ₱{stats.todayCollection.toLocaleString()} 
                                        <Text className="text-white text-sm font-bold"> / ₱{stats.targetToday.toLocaleString()}</Text>
                                    </Text>
                                </View>
                                <View className="items-end">
                                    <Text className="text-white font-black text-lg">{Math.min(100, Math.round(stats.efficiency))}%</Text>
                                </View>
                            </View>
                            <View className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <View 
                                    style={{ width: `${Math.min(100, stats.efficiency)}%` }} 
                                    className="h-full bg-teal-400 rounded-full"
                                />
                            </View>
                        </View>
                    </LinearGradient>
                )}
                
                {/* Main Action Cards */}
                <View className="px-6 mb-6" style={{ marginTop: isCompactHeight ? -20 : -48 }}>
                    <View className="flex-row gap-3 mb-3">
                        <AnimatedPressable 
                            onPress={() => router.push('/(collector)/collection-sheet')}
                            className={`flex-1 ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-slate-900 shadow-xl shadow-slate-900/40'} rounded-[30px]`}
                            style={{ padding: isSmallPhone ? 16 : 24 }}
                        >
                            <View className={`${sunlightMode ? 'bg-black' : 'bg-emerald-500/20'} w-12 h-12 rounded-2xl items-center justify-center mb-4`}>
                                <MaterialIcons name="assignment" size={26} color={sunlightMode ? "#FFF" : "#4F7F52"} />
                            </View>
                            <Text className={`${sunlightMode ? 'text-black' : 'text-white'} font-black text-lg leading-tight`}>Field List</Text>
                            <Text className={`${sunlightMode ? 'text-black font-black' : 'text-emerald-200'} text-[10px] font-bold uppercase tracking-wider mt-1`}>Daily Route</Text>
                        </AnimatedPressable>

                        <AnimatedPressable 
                            onPress={() => router.push('/(collector)/remittances')}
                            className={`flex-1 ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-emerald-600 shadow-xl shadow-emerald-600/40'} rounded-[30px]`}
                            style={{ padding: isSmallPhone ? 16 : 24 }}
                        >
                            <View className={`${sunlightMode ? 'bg-black' : 'bg-white/20'} w-12 h-12 rounded-2xl items-center justify-center mb-4`}>
                                <MaterialIcons name="account-balance-wallet" size={26} color="#FFF" />
                            </View>
                            <Text className={`${sunlightMode ? 'text-black' : 'text-white'} font-black text-lg leading-tight`}>Remit Cash</Text>
                            <Text className={`${sunlightMode ? 'text-black font-black' : 'text-white'} text-[10px] font-bold uppercase tracking-wider mt-1`}>Submit Funds</Text>
                        </AnimatedPressable>
                    </View>

                    <View className="flex-row gap-3">
                        <AnimatedPressable
                            onPress={() => router.push('/(collector)/collection-sheet-daily')}
                            className={`flex-1 ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-slate-800 shadow-lg shadow-slate-900/20'} rounded-[28px]`}
                            style={{ padding: isSmallPhone ? 14 : 20 }}
                        >
                            <View className="flex-row items-center gap-3">
                                <MaterialIcons name="today" size={20} color={sunlightMode ? "#000" : "#FFF"} />
                                <Text className={`${sunlightMode ? 'text-black' : 'text-white'} font-black text-sm`}>Daily Sheet</Text>
                            </View>
                        </AnimatedPressable>
                        <AnimatedPressable
                            onPress={() => router.push('/(collector)/collection-sheet-weekly')}
                            className={`flex-1 ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-slate-700 shadow-lg shadow-slate-900/20'} rounded-[28px]`}
                            style={{ padding: isSmallPhone ? 14 : 20 }}
                        >
                            <View className="flex-row items-center gap-3">
                                <MaterialIcons name="date-range" size={20} color={sunlightMode ? "#000" : "#FFF"} />
                                <Text className={`${sunlightMode ? 'text-black' : 'text-white'} font-black text-sm`}>Weekly Sheet</Text>
                            </View>
                        </AnimatedPressable>
                    </View>

                    <View className="flex-row gap-3 mt-3">
                        <AnimatedPressable
                            onPress={() => router.push('/(collector)/daily-log')}
                            className={`flex-1 ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-green-800 shadow-lg shadow-green-900/20'} rounded-[28px]`}
                            style={{ padding: isSmallPhone ? 14 : 20 }}
                        >
                            <View className="flex-row items-center gap-3">
                                <MaterialIcons name="fact-check" size={20} color={sunlightMode ? "#000" : "#A7F3D0"} />
                                <Text className={`${sunlightMode ? 'text-black' : 'text-white'} font-black text-sm`}>Submit Daily Log</Text>
                            </View>
                        </AnimatedPressable>
                    </View>
                </View>

                {/* KPI Grid */}
                <View className="px-6 mb-12">
                    <View className="flex-row flex-wrap justify-between">
                        <CollectorKpiCard 
                            sunlightMode={sunlightMode}
                            title="Active Cases"
                            value={stats.activeClients}
                            icon="people"
                            color="#2563EB"
                            gradient={['#E0E7FF', '#C7D2FE']}
                            description="Assigned Borrowers"
                        />
                        <CollectorKpiCard 
                            sunlightMode={sunlightMode}
                            title="Efficiency"
                            value={`${stats.efficiency.toFixed(0)}%`}
                            icon="trending-up"
                            color="#9333EA"
                            gradient={['#F3E8FF', '#E9D5FF']}
                            progress={stats.efficiency / 100}
                            description="Collection Rate"
                        />
                        <CollectorKpiCard 
                            sunlightMode={sunlightMode}
                            title="Outstanding"
                            value={stats.outstanding}
                            icon="account-balance-wallet"
                            color="#D97706"
                            gradient={['#FEF3C7', '#FDE68A']}
                            isCurrency
                            description="Total Balance Due"
                        />
                        <CollectorKpiCard 
                            sunlightMode={sunlightMode}
                            title="Collected"
                            value={stats.todayCollection}
                            icon="payments"
                            color="#355E3B"
                            gradient={['#DCFCE7', '#BBF7D0']}
                            isCurrency
                            description="Handled Today"
                        />
                    </View>
                </View>

                {/* Borrower Section */}
                <View className="px-6 mb-4 flex-row justify-between items-center">
                    <View>
                        <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-2xl`}>My Borrowers</Text>
                        <View className={`h-1.5 w-12 ${sunlightMode ? 'bg-black' : 'bg-teal-500'} rounded-full mt-1`} />
                    </View>
                    <View className={`${sunlightMode ? 'bg-black' : 'bg-teal-50'} px-4 py-1.5 rounded-full border ${sunlightMode ? 'border-black' : 'border-teal-100'}`}>
                        <Text className={`${sunlightMode ? 'text-white' : 'text-teal-700'} text-[10px] font-black uppercase tracking-wider`}>{borrowers.length} Assigned</Text>
                    </View>
                </View>

                {/* Premium Search Bar */}
                <View className="px-6 mb-8">
                    <Animated.View 
                        entering={FadeInDown.delay(300)}
                        className={`px-5 py-4 rounded-[24px] flex-row items-center ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-white shadow-xl shadow-emerald-900/5 border border-emerald-50'}`}
                    >
                        <MaterialIcons name="search" size={22} color={sunlightMode ? "#000" : "#355E3B"} />
                        <TextInput
                            placeholder="Search active borrowers..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            className={`flex-1 ml-3 font-bold text-base ${sunlightMode ? 'text-black placeholder:text-gray-700' : 'text-slate-900 placeholder:text-slate-600'}`}
                            placeholderTextColor={sunlightMode ? "#4B5563" : "#64748B"}
                        />
                        {searchQuery.length > 0 && (
                            <Pressable onPress={() => setSearchQuery('')}>
                                <MaterialIcons name="cancel" size={20} color={sunlightMode ? "#000" : "#94A3B8"} />
                            </Pressable>
                        )}
                    </Animated.View>
                </View>

                {/* Borrower List Cards */}
                <View className="px-6 pb-12">
                    {filteredBorrowers.length === 0 ? (
                        <View className={`p-12 rounded-[40px] items-center ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-white border border-gray-100 shadow-sm'}`}>
                            <View className={`p-6 rounded-full mb-4 ${sunlightMode ? 'bg-gray-100' : 'bg-gray-50'}`}>
                                <MaterialIcons name="person-off" size={48} color={sunlightMode ? "#000" : "#D1D5DB"} />
                            </View>
                            <Text className={`${sunlightMode ? 'text-black' : 'text-gray-900'} font-black text-lg`}>
                                {searchQuery ? "No matches found" : "No assignments yet"}
                            </Text>
                        </View>
                    ) : (
                        filteredBorrowers.map((b, i) => (
                            <Animated.View 
                                key={b.id}
                                entering={FadeInRight.delay(i * 100)}
                            >
                                <AnimatedPressable
                                    onPress={() => router.push(`/(collector)/borrowers/${b.id}`)}
                                    className={`${sunlightMode ? 'bg-white border-4 border-black mb-6' : 'bg-white border border-emerald-50/50 shadow-xl shadow-emerald-900/5 mb-4'} p-5 rounded-[32px] flex-row items-center active:scale-[0.98] transition-all`}
                                >
                                    <View 
                                        className={`w-16 h-16 rounded-[24px] items-center justify-center mr-5 border ${sunlightMode ? 'bg-black border-black' : 'bg-emerald-50 border-emerald-100/50'}`}
                                    >
                                        <Text className={`${sunlightMode ? 'text-white' : 'text-emerald-700'} font-black text-2xl`}>{b.fullName.charAt(0)}</Text>
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`${sunlightMode ? 'text-black' : 'text-slate-900'} font-black text-lg leading-tight`} numberOfLines={1}>{b.fullName}</Text>
                                        <View className="flex-row items-center mt-1.5">
                                            <MaterialIcons name="place" size={14} color={sunlightMode ? "#000" : "#4F7F52"} />
                                            <Text className={`${sunlightMode ? 'text-black' : 'text-slate-700'} text-xs font-bold ml-1 uppercase tracking-tight`}>{b.area || 'General Area'}</Text>
                                        </View>
                                    </View>
                                    <View className="flex-row gap-2">
                                        <View className={`${sunlightMode ? 'bg-black' : 'bg-emerald-600 shadow-lg shadow-emerald-200'} w-10 h-10 rounded-2xl items-center justify-center`}>
                                            <MaterialIcons name="chevron-right" size={20} color="#FFF" />
                                        </View>
                                    </View>
                                </AnimatedPressable>
                            </Animated.View>
                        ))
                    )}
                </View>

                {/* Footer Guide Access */}
                <View className="px-6 mb-12">
                    <AnimatedPressable 
                        onPress={() => router.push('/(collector)/help')}
                        className={`${sunlightMode ? 'bg-white border-4 border-black' : 'bg-gray-900 shadow-xl shadow-gray-900/40'} p-6 rounded-[36px] flex-row items-center justify-between`}
                    >
                        <View className="flex-row items-center">
                            <View className={`${sunlightMode ? 'bg-black' : 'bg-white/10'} p-3 rounded-2xl mr-4 border ${sunlightMode ? 'border-black' : 'border-white/5'}`}>
                                <MaterialIcons name="auto-awesome" size={24} color={sunlightMode ? "#FFF" : "#FFF"} />
                            </View>
                            <View>
                                <Text className={`${sunlightMode ? 'text-black' : 'text-white'} font-black text-lg`}>System Guide</Text>
                                <Text className={`${sunlightMode ? 'text-black' : 'text-white'} text-xs font-bold`}>Learn tips for efficient collection</Text>
                            </View>
                        </View>
                        <MaterialIcons name="chevron-right" size={24} color={sunlightMode ? "#000" : "#FFF"} />
                    </AnimatedPressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
