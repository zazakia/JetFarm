import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import AgriCropCycle from '../../../src/database/models/AgriCropCycle';
import AgriParcel from '../../../src/database/models/AgriParcel';
import AgriWeeklySettlement from '../../../src/database/models/AgriWeeklySettlement';
import AgriHarvestLog from '../../../src/database/models/AgriHarvestLog';
import { formatPHP } from '../../../src/utils/currency';
import { Q } from '@nozbe/watermelondb';
import { ModuleQuickGuide } from '../../../src/components/ModuleQuickGuide';
import { SampleDataService } from '../../../src/services/SampleDataService';

export default function AgribusinessDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Dashboard metrics
    const [totalHectares, setTotalHectares] = useState(0);
    const [activeCyclesCount, setActiveCyclesCount] = useState(0);
    const [totalYieldKg, setTotalYieldKg] = useState(0);
    const [totalSettlementsPaid, setTotalSettlementsPaid] = useState(0);
    const [pendingSettlementsCount, setPendingSettlementsCount] = useState(0);
    const [recentCycles, setRecentCycles] = useState<Array<{ cycle: AgriCropCycle; parcelName: string }>>([]);

    const loadData = async () => {
        try {
            // 1. Parcels & Land area
            const parcels = await database
                .get<AgriParcel>('agri_parcels')
                .query(Q.where('deleted_at', null))
                .fetch();

            const ha = parcels.reduce((sum, p) => sum + (p.areaHectares || 0), 0);
            setTotalHectares(ha);

            // 2. Active Crop Cycles
            const cycles = await database
                .get<AgriCropCycle>('agri_crop_cycles')
                .query(
                    Q.where('deleted_at', null),
                    Q.sortBy('planting_date', Q.desc)
                )
                .fetch();

            const active = cycles.filter(c => c.status !== 'completed' && c.status !== 'closed');
            setActiveCyclesCount(active.length);

            // 3. Harvest totals
            const harvests = await database
                .get<AgriHarvestLog>('agri_harvest_logs')
                .query(Q.where('deleted_at', null))
                .fetch();

            const yieldSum = harvests.reduce((sum, h) => sum + (h.netWeightKg || 0), 0);
            setTotalYieldKg(yieldSum);

            // 4. Settlements
            const settlements = await database
                .get<AgriWeeklySettlement>('agri_weekly_settlements')
                .query(Q.where('deleted_at', null))
                .fetch();

            const paidSum = settlements
                .filter(s => s.paymentStatus === 'paid')
                .reduce((sum, s) => sum + (s.netPayoutDueThisWeek || 0), 0);
            setTotalSettlementsPaid(paidSum);

            const pending = settlements.filter(s => s.paymentStatus === 'draft' || s.paymentStatus === 'approved');
            setPendingSettlementsCount(pending.length);

            // 5. Recent Cycles with Parcel name
            const cycleList: Array<{ cycle: AgriCropCycle; parcelName: string }> = [];
            for (const c of cycles.slice(0, 5)) {
                let pName = 'Unknown Parcel';
                try {
                    const p = await database.get<AgriParcel>('agri_parcels').find(c.parcelId);
                    pName = p.name;
                } catch {
                    pName = 'Unknown Parcel';
                }
                cycleList.push({ cycle: c, parcelName: pName });
            }
            setRecentCycles(cycleList);
        } catch (error) {
            console.error('[AgribusinessDashboard] Error loading dashboard:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#1E3A8A" />
                <Text className="text-gray-500 font-medium mt-3">Loading Operator Command Center...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            contentContainerStyle={{ padding: 20 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Operator Header */}
            <View className="bg-emerald-800 rounded-3xl p-6 text-white mb-6 shadow-md">
                <View className="flex-row justify-between items-start">
                    <View>
                        <View className="flex-row items-center gap-2 mb-1">
                            <MaterialIcons name="agriculture" size={28} color="#FFFFFF" />
                            <Text testID="admin-portal-title" className="text-white text-2xl font-black">JetFarm Agribusiness</Text>
                        </View>
                        <Text className="text-emerald-100 text-sm font-medium">
                            Agribusiness Dashboard • Operator Command Center • Managed by Mr. Jojet Montera (Jet)
                        </Text>
                    </View>
                    <View className="bg-emerald-900/60 px-3 py-1.5 rounded-full border border-emerald-600">
                        <Text className="text-emerald-200 text-xs font-semibold uppercase tracking-wider">
                            Cassava Outgrower System
                        </Text>
                    </View>
                </View>

                {/* Guarantee Policy Badge */}
                <View className="mt-5 bg-emerald-950/40 rounded-2xl p-4 border border-emerald-700/50 flex-row items-center gap-3">
                    <MaterialIcons name="verified-user" size={24} color="#34D399" />
                    <View className="flex-1">
                        <Text className="text-emerald-100 font-bold text-sm">
                            Land Owner Settlement Formula Active
                        </Text>
                        <Text className="text-emerald-200 text-xs mt-0.5">
                            ₱1.00/kg harvest rate • ₱25,000.00 guaranteed minimum per cycle • Weekly disbursements
                        </Text>
                    </View>
                </View>
            </View>

            {/* Pending Settlements Alert Banner */}
            {pendingSettlementsCount > 0 && (
                <Pressable
                    onPress={() => router.push('/(admin)/agribusiness/settlements' as any)}
                    className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex-row items-center justify-between shadow-sm active:bg-amber-100"
                >
                    <View className="flex-row items-center gap-3">
                        <View className="w-10 h-10 rounded-full bg-amber-100 items-center justify-center">
                            <MaterialIcons name="pending-actions" size={24} color="#D97706" />
                        </View>
                        <View>
                            <Text className="text-amber-900 font-bold text-sm">
                                {pendingSettlementsCount} Settlement{pendingSettlementsCount > 1 ? 's' : ''} Awaiting Approval
                            </Text>
                            <Text className="text-amber-700 text-xs">
                                Review weekly harvests and guarantee-protected disbursements
                            </Text>
                        </View>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color="#B45309" />
                </Pressable>
            )}

            {/* Agribusiness Quick Guide */}
            <ModuleQuickGuide
                moduleTitle="🌾 Agribusiness Quick Guide & Workflow"
                description="How to coordinate parcels, cycles, labor, scale weigh-in, and settlements"
                icon="agriculture"
                badgeColor="bg-emerald-700"
                showDemoDataButton={totalHectares === 0 && activeCyclesCount === 0}
                onLoadDemoData={async () => {
                    try {
                        await SampleDataService.enable(database);
                        Alert.alert('Demo Data Loaded', 'Sample farm parcels, crop cycles, labor logs, and harvest scale weigh-ins have been populated.');
                        loadData();
                    } catch (e: any) {
                        Alert.alert('Error', e.message || 'Failed to load demo data');
                    }
                }}
                steps={[
                    { title: '1. Land Parcels & Mapping', desc: 'Register farm parcels with hectares, soil types, and GPS boundary coordinates.' },
                    { title: '2. Launch Crop Cycles', desc: 'Schedule planting date, target harvest date, variety (KU50 Cassava, Yellow Corn), and offtake price.' },
                    { title: '3. Farm Labor & Input Costs', desc: 'Track daily/piece-rate farm tasks and log input expenses (fertilizer, plowing, seedlings).' },
                    { title: '4. Digital Harvest Scale & Settlements', desc: 'Record gross/tare weigh-ins at the terminal, then auto-calculate land owner and investor weekly payouts.' },
                ]}
            />

            {/* KPI Metric Cards */}
            <View className="flex-row flex-wrap gap-4 mb-6">
                <View className="flex-1 min-w-[150px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">Managed Land</Text>
                        <MaterialIcons name="landscape" size={20} color="#059669" />
                    </View>
                    <Text className="text-2xl font-black text-gray-900">{totalHectares.toFixed(1)} <Text className="text-sm font-semibold text-gray-500">ha</Text></Text>
                    <Text className="text-xs text-gray-500 mt-1">Across all active parcels</Text>
                </View>

                <View className="flex-1 min-w-[150px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Cycles</Text>
                        <MaterialIcons name="grass" size={20} color="#2563EB" />
                    </View>
                    <Text className="text-2xl font-black text-gray-900">{activeCyclesCount}</Text>
                    <Text className="text-xs text-gray-500 mt-1">Cassava planting crops</Text>
                </View>

                <View className="flex-1 min-w-[150px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Harvest</Text>
                        <MaterialIcons name="scale" size={20} color="#D97706" />
                    </View>
                    <Text className="text-2xl font-black text-gray-900">
                        {totalYieldKg >= 1000 ? `${(totalYieldKg / 1000).toFixed(1)} t` : `${totalYieldKg.toLocaleString()} kg`}
                    </Text>
                    <Text className="text-xs text-gray-500 mt-1">{totalYieldKg.toLocaleString()} net kg scale total</Text>
                </View>

                <View className="flex-1 min-w-[150px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">Settlements Paid</Text>
                        <MaterialIcons name="payments" size={20} color="#047857" />
                    </View>
                    <Text className="text-2xl font-black text-gray-900">{formatPHP(totalSettlementsPaid)}</Text>
                    <Text className="text-xs text-gray-500 mt-1">Disbursed to Land Owners</Text>
                </View>
            </View>

            {/* Quick Operations Grid */}
            <Text className="text-lg font-black text-gray-900 mb-3">Operational Hub</Text>
            <View className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Weigh-in Scale', route: '/(admin)/agribusiness/harvest', icon: 'scale', desc: 'Gross / tare scale terminal', color: 'bg-amber-600' },
                    { label: 'Weekly Settlements', route: '/(admin)/agribusiness/settlements', icon: 'handshake', desc: '₱1/kg vs ₱25k minimum', color: 'bg-emerald-600' },
                    { label: 'Land Parcels', route: '/(admin)/agribusiness/parcels', icon: 'landscape', desc: 'Registry & ownership', color: 'bg-blue-600' },
                    { label: 'GPS Mapping', route: '/(admin)/agribusiness/mapping', icon: 'map', desc: 'Boundary & polygon area', color: 'bg-teal-600' },
                    { label: 'Planting Cycles', route: '/(admin)/agribusiness/cycles', icon: 'grass', desc: 'Cassava crop check-ins', color: 'bg-green-700' },
                    { label: 'BioGreen Investor', route: '/(admin)/agribusiness/investors', icon: 'business-center', desc: 'Capital & off-take ledger', color: 'bg-indigo-600' },
                    { label: 'Farm Labor', route: '/(admin)/agribusiness/labor', icon: 'engineering', desc: 'Worker registry & tasks', color: 'bg-cyan-700' },
                    { label: 'Farm Expenses', route: '/(admin)/agribusiness/expenses', icon: 'receipt-long', desc: 'Fertilizer, tractor, seed costs', color: 'bg-rose-600' },
                    { label: 'Farm Accounting & GL', route: '/(admin)/agribusiness/accounting', icon: 'account-balance', desc: 'Double-entry books & P&L', color: 'bg-emerald-800' },
                    { label: 'Cycle P&L & Forecast', route: '/(admin)/agribusiness/analytics', icon: 'insights', desc: 'Margins, cost/ha, cost/kg', color: 'bg-purple-600' },
                ].map((item, idx) => (
                    <Pressable
                        key={idx}
                        onPress={() => router.push(item.route as any)}
                        className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm active:bg-gray-100"
                    >
                        <View className={`w-10 h-10 rounded-xl ${item.color} items-center justify-center mb-3`}>
                            <MaterialIcons name={item.icon as any} size={22} color="#FFFFFF" />
                        </View>
                        <Text className="text-gray-900 font-bold text-sm">{item.label}</Text>
                        <Text className="text-gray-500 text-xs mt-0.5">{item.desc}</Text>
                    </Pressable>
                ))}
            </View>

            {/* Active & Recent Crop Cycles */}
            <View className="flex-row justify-between items-center mb-3">
                <Text className="text-lg font-black text-gray-900">Active Crop Cycles</Text>
                <Pressable onPress={() => router.push('/(admin)/agribusiness/cycles' as any)}>
                    <Text className="text-emerald-700 text-sm font-bold">View All Cycles</Text>
                </Pressable>
            </View>

            {recentCycles.length === 0 ? (
                <View className="bg-white p-8 rounded-2xl border border-gray-200 items-center justify-center">
                    <MaterialIcons name="grass" size={48} color="#9CA3AF" />
                    <Text className="text-gray-900 font-bold text-base mt-2">No Crop Cycles Registered</Text>
                    <Text className="text-gray-500 text-xs text-center mt-1 mb-4">
                        Begin by registering a Land Parcel and starting a Cassava planting cycle.
                    </Text>
                    <Pressable
                        onPress={() => router.push('/(admin)/agribusiness/cycles' as any)}
                        className="bg-emerald-700 px-5 py-2.5 rounded-xl active:bg-emerald-800"
                    >
                        <Text className="text-white font-bold text-sm">Start First Crop Cycle</Text>
                    </Pressable>
                </View>
            ) : (
                <View className="gap-3">
                    {recentCycles.map(({ cycle, parcelName }) => (
                        <View
                            key={cycle.id}
                            className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex-row justify-between items-center"
                        >
                            <View>
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-gray-900 font-bold text-base">{cycle.cycleCode}</Text>
                                    <View className="bg-emerald-100 px-2.5 py-0.5 rounded-full">
                                        <Text className="text-emerald-800 text-xs font-bold capitalize">{cycle.status}</Text>
                                    </View>
                                </View>
                                <Text className="text-gray-500 text-xs mt-1">
                                    Parcel: {parcelName} • Variety: {cycle.variety || 'Golden Yellow'} • {cycle.areaPlantedHa} ha
                                </Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-gray-900 font-bold text-sm">
                                    {(cycle.totalActualYieldKg || 0).toLocaleString()} kg
                                </Text>
                                <Text className="text-gray-500 text-xs">
                                    Target: {(cycle.expectedYieldKg || 0).toLocaleString()} kg
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
    );
}
