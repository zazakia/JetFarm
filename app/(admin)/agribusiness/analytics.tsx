import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import AgriCropCycle from '../../../src/database/models/AgriCropCycle';
import AgriParcel from '../../../src/database/models/AgriParcel';
import { AgriFinanceAnalyticsService, CyclePnLResult, YieldForecastResult } from '../../../src/services/AgriFinanceAnalyticsService';
import { formatPHP } from '../../../src/utils/currency';
import { Q } from '@nozbe/watermelondb';

export default function AgriAnalyticsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [cycles, setCycles] = useState<Array<{ cycle: AgriCropCycle; parcelName: string }>>([]);
    const [selectedCycleId, setSelectedCycleId] = useState<string>('');
    const [activeCycle, setActiveCycle] = useState<AgriCropCycle | null>(null);
    const [pnl, setPnl] = useState<CyclePnLResult | null>(null);

    // Yield Forecasting Engine state
    const [forecastArea, setForecastArea] = useState('2.5');
    const [forecastHealth, setForecastHealth] = useState('good');
    const [forecastVariety, setForecastVariety] = useState('Golden Yellow');
    const [forecastPrice, setForecastPrice] = useState('4.00');
    const [forecastResult, setForecastResult] = useState<YieldForecastResult | null>(null);

    const loadData = async () => {
        try {
            const rawCycles = await database
                .get<AgriCropCycle>('agri_crop_cycles')
                .query(Q.where('deleted_at', null), Q.sortBy('planting_date', Q.desc))
                .fetch();

            const formatted: Array<{ cycle: AgriCropCycle; parcelName: string }> = [];
            for (const c of rawCycles) {
                let pName = 'Parcel';
                try {
                    const p = await database.get<AgriParcel>('agri_parcels').find(c.parcelId);
                    pName = p.name;
                } catch {
                    pName = 'Parcel';
                }
                formatted.push({ cycle: c, parcelName: pName });
            }
            setCycles(formatted);

            let activeId = selectedCycleId;
            if (!activeId && rawCycles.length > 0) {
                activeId = rawCycles[0].id;
                setSelectedCycleId(activeId);
            }

            if (activeId) {
                const cy = rawCycles.find((c) => c.id === activeId);
                setActiveCycle(cy || null);
                const pnlData = await AgriFinanceAnalyticsService.getCropCyclePnL(activeId);
                setPnl(pnlData);
            }
        } catch (err) {
            console.error('[AgriAnalytics] Error loading:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [selectedCycleId])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    // Recalculate forecast whenever input parameters change
    useEffect(() => {
        const area = parseFloat(forecastArea) || 0;
        const price = parseFloat(forecastPrice) || 4.0;
        const res = AgriFinanceAnalyticsService.forecastYield(area, forecastHealth, price, forecastVariety);
        setForecastResult(res);
    }, [forecastArea, forecastHealth, forecastVariety, forecastPrice]);

    const handleSelectCycle = async (id: string) => {
        setSelectedCycleId(id);
        setLoading(true);
        try {
            const cy = cycles.find((c) => c.cycle.id === id)?.cycle || null;
            setActiveCycle(cy);
            const pnlData = await AgriFinanceAnalyticsService.getCropCyclePnL(id);
            setPnl(pnlData);
        } catch (err) {
            console.error('[AgriAnalytics] Error selecting cycle:', err);
        } finally {
            setLoading(false);
        }
    };

    const isProfitable = (pnl?.netMargin || 0) >= 0;

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#047857']} />}
        >
            {/* Header */}
            <View className="bg-emerald-800 p-6 pb-8">
                <View className="flex-row items-center justify-between mb-4">
                    <Pressable
                        onPress={() => router.push('/(admin)/agribusiness' as any)}
                        className="flex-row items-center bg-emerald-900/60 px-3 py-1.5 rounded-lg active:bg-emerald-900"
                    >
                        <MaterialIcons name="arrow-back" size={18} color="#FFFFFF" />
                        <Text className="text-white text-xs font-semibold ml-1">Command Center</Text>
                    </Pressable>
                    <View className="bg-emerald-700/70 px-3 py-1.5 rounded-lg flex-row items-center">
                        <MaterialIcons name="insights" size={16} color="#A7F3D0" className="mr-1" />
                        <Text className="text-emerald-100 text-xs font-bold">Real-Time BI Engine</Text>
                    </View>
                </View>

                <View className="flex-row items-center mb-1">
                    <MaterialIcons name="analytics" size={26} color="#FDE68A" className="mr-2" />
                    <Text className="text-white text-2xl font-black tracking-tight">P&L & Unit Economics</Text>
                </View>
                <Text className="text-emerald-100 text-xs mt-1">
                    Comprehensive crop cycle financial profitability, cost-per-hectare & yield forecasting
                </Text>
            </View>

            {/* Cycle Selector Carousel */}
            <View className="p-4 -mt-5">
                <View className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Select Crop Cycle to Analyze
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row pb-1">
                        {cycles.map(({ cycle, parcelName }) => {
                            const isSelected = selectedCycleId === cycle.id;
                            return (
                                <Pressable
                                    key={cycle.id}
                                    onPress={() => handleSelectCycle(cycle.id)}
                                    className={`px-4 py-2.5 rounded-xl mr-3 border ${
                                        isSelected
                                            ? 'bg-emerald-800 border-emerald-800 shadow-sm'
                                            : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                                    }`}
                                >
                                    <View className="flex-row items-center justify-between gap-3">
                                        <View>
                                            <Text
                                                className={`text-xs font-black ${
                                                    isSelected ? 'text-white' : 'text-gray-900'
                                                }`}
                                            >
                                                {cycle.cycleCode}
                                            </Text>
                                            <Text
                                                className={`text-[10px] ${
                                                    isSelected ? 'text-emerald-100' : 'text-gray-500'
                                                }`}
                                            >
                                                {parcelName} • {cycle.variety}
                                            </Text>
                                        </View>
                                        <View
                                            className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                                isSelected ? 'bg-emerald-700 text-white' : 'bg-gray-200 text-gray-700'
                                            }`}
                                        >
                                            <Text
                                                className={`text-[9px] font-bold ${
                                                    isSelected ? 'text-white' : 'text-gray-700'
                                                }`}
                                            >
                                                {(cycle.status || 'planted').toUpperCase()}
                                            </Text>
                                        </View>
                                    </View>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>
            </View>

            {loading ? (
                <View className="py-16 items-center">
                    <ActivityIndicator size="large" color="#047857" />
                    <Text className="text-gray-500 text-xs mt-2">Computing cycle economics...</Text>
                </View>
            ) : !pnl ? (
                <View className="p-4">
                    <View className="bg-white p-8 rounded-2xl border border-gray-200 items-center">
                        <MaterialIcons name="eco" size={48} color="#D1D5DB" />
                        <Text className="text-gray-700 font-bold text-base mt-2">No Active Cycle Selected</Text>
                        <Text className="text-gray-500 text-xs text-center mt-1">
                            Plant a cassava cycle first to calculate operational P&L and metrics.
                        </Text>
                    </View>
                </View>
            ) : (
                <View className="px-4 pb-12">
                    {/* Top Net Margin Banner */}
                    <View
                        className={`p-5 rounded-2xl border mb-4 shadow-sm ${
                            isProfitable
                                ? 'bg-emerald-900 border-emerald-700'
                                : 'bg-red-900 border-red-700'
                        }`}
                    >
                        <View className="flex-row items-center justify-between mb-1">
                            <View className="flex-row items-center">
                                <MaterialIcons
                                    name={isProfitable ? 'trending-up' : 'trending-down'}
                                    size={22}
                                    color="#FDE68A"
                                    className="mr-2"
                                />
                                <Text className="text-xs font-bold uppercase tracking-wider text-emerald-100">
                                    Cycle Net Margin ({activeCycle?.cycleCode})
                                </Text>
                            </View>
                            <View className="bg-white/20 px-2 py-0.5 rounded-full">
                                <Text className="text-[11px] font-black text-white">
                                    {pnl.profitMarginPercent.toFixed(1)}% Return
                                </Text>
                            </View>
                        </View>
                        <Text className="text-3xl font-black text-white">{formatPHP(pnl.netMargin)}</Text>
                        <Text className="text-xs text-emerald-200 mt-1">
                            Gross Offtake {formatPHP(pnl.grossRevenue)} less Total Expenses {formatPHP(pnl.totalExpenses)}
                        </Text>
                    </View>

                    {/* Financial P&L Breakdown Card */}
                    <View className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-4">
                        <View className="flex-row items-center justify-between mb-4 border-b border-gray-100 pb-3">
                            <View className="flex-row items-center">
                                <MaterialIcons name="receipt-long" size={20} color="#047857" className="mr-2" />
                                <Text className="text-sm font-black text-gray-900 uppercase tracking-wider">
                                    Crop Cycle Statement of P&L
                                </Text>
                            </View>
                            <Text className="text-xs font-semibold text-gray-500">
                                {pnl.totalYieldKg.toLocaleString()} kg Harvested @ {formatPHP(pnl.offtakePricePerKg)}/kg
                            </Text>
                        </View>

                        {/* Gross Offtake Revenue */}
                        <View className="flex-row items-center justify-between py-2 border-b border-gray-100">
                            <View className="flex-row items-center">
                                <MaterialIcons name="add-circle" size={16} color="#047857" className="mr-2" />
                                <Text className="text-sm font-bold text-gray-800">Gross Off-take Revenue (BioGreen)</Text>
                            </View>
                            <Text className="text-sm font-black text-emerald-700">{formatPHP(pnl.grossRevenue)}</Text>
                        </View>

                        {/* Deductions: Land Owner Settlements */}
                        <View className="flex-row items-center justify-between py-2 border-b border-gray-100">
                            <View className="flex-row items-center ml-4">
                                <MaterialIcons name="remove-circle-outline" size={14} color="#DC2626" className="mr-2" />
                                <Text className="text-xs font-semibold text-gray-700">Land Owner Payouts (₱1/kg or ₱25k min)</Text>
                            </View>
                            <Text className="text-xs font-bold text-red-600">
                                - {formatPHP(pnl.landOwnerSettlementCost)}
                            </Text>
                        </View>

                        {/* Deductions: Farm Labor */}
                        <View className="flex-row items-center justify-between py-2 border-b border-gray-100">
                            <View className="flex-row items-center ml-4">
                                <MaterialIcons name="remove-circle-outline" size={14} color="#DC2626" className="mr-2" />
                                <Text className="text-xs font-semibold text-gray-700">Field Labor & Harvesting Wages</Text>
                            </View>
                            <Text className="text-xs font-bold text-red-600">- {formatPHP(pnl.laborCost)}</Text>
                        </View>

                        {/* Deductions: Farm Input Expenses */}
                        <View className="flex-row items-center justify-between py-2 border-b border-gray-200">
                            <View className="flex-row items-center ml-4">
                                <MaterialIcons name="remove-circle-outline" size={14} color="#DC2626" className="mr-2" />
                                <Text className="text-xs font-semibold text-gray-700">
                                    Farm Input Expenses (Fertilizer, Tractor, etc.)
                                </Text>
                            </View>
                            <Text className="text-xs font-bold text-red-600">- {formatPHP(pnl.farmExpenses)}</Text>
                        </View>

                        {/* Total Expenses Row */}
                        <View className="flex-row items-center justify-between py-2.5 bg-gray-50 px-3 rounded-lg mt-2 mb-2">
                            <Text className="text-xs font-black text-gray-700 uppercase tracking-wider">
                                Total Production Costs
                            </Text>
                            <Text className="text-sm font-black text-gray-900">{formatPHP(pnl.totalExpenses)}</Text>
                        </View>

                        {/* Net Operating Profit */}
                        <View className="flex-row items-center justify-between pt-3 border-t-2 border-gray-900">
                            <Text className="text-sm font-black text-gray-900 uppercase tracking-wider">
                                Net Operator Return (Jet)
                            </Text>
                            <Text
                                className={`text-base font-black ${
                                    isProfitable ? 'text-emerald-700' : 'text-red-600'
                                }`}
                            >
                                {formatPHP(pnl.netMargin)}
                            </Text>
                        </View>
                    </View>

                    {/* Unit Economics 4-Grid Matrix */}
                    <Text className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                        Unit Economics Performance
                    </Text>
                    <View className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                        <View className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                Cost per Hectare
                            </Text>
                            <Text className="text-base font-black text-gray-900">{formatPHP(pnl.costPerHectare)}</Text>
                            <Text className="text-[10px] text-gray-500 mt-0.5">₱ / ha cultivated</Text>
                        </View>

                        <View className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                Cost per Kilo
                            </Text>
                            <Text className="text-base font-black text-amber-700">{formatPHP(pnl.costPerKilo)}</Text>
                            <Text className="text-[10px] text-gray-500 mt-0.5">₱ / kg produced</Text>
                        </View>

                        <View className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                Revenue / Hectare
                            </Text>
                            <Text className="text-base font-black text-blue-700">{formatPHP(pnl.revenuePerHectare)}</Text>
                            <Text className="text-[10px] text-gray-500 mt-0.5">₱ / ha gross yield</Text>
                        </View>

                        <View className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                Yield Density
                            </Text>
                            <Text className="text-base font-black text-emerald-700">
                                {pnl.yieldPerHectareTons.toFixed(2)} Tons/ha
                            </Text>
                            <Text className="text-[10px] text-gray-500 mt-0.5">Commercial benchmark</Text>
                        </View>
                    </View>

                    {/* Yield Forecasting & Scenario Simulator */}
                    <View className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                        <View className="flex-row items-center justify-between mb-3 border-b border-gray-100 pb-3">
                            <View className="flex-row items-center">
                                <MaterialIcons name="auto-graph" size={20} color="#2563EB" className="mr-2" />
                                <Text className="text-sm font-black text-gray-900 uppercase tracking-wider">
                                    Cassava Yield & Revenue Forecasting
                                </Text>
                            </View>
                            <View className="bg-blue-50 px-2 py-0.5 rounded">
                                <Text className="text-[10px] font-bold text-blue-700">Predictive Engine</Text>
                            </View>
                        </View>

                        <Text className="text-xs text-gray-500 mb-4">
                            Simulate harvest yield and revenue projections based on cultivated acreage, crop health, and variety.
                        </Text>

                        {/* Forecast Inputs */}
                        <View className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                            <View>
                                <Text className="text-[11px] font-bold text-gray-700 uppercase mb-1">
                                    Land Area (Hectares)
                                </Text>
                                <TextInput
                                    className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 font-bold"
                                    placeholder="2.5"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="numeric"
                                    value={forecastArea}
                                    onChangeText={setForecastArea}
                                />
                            </View>

                            <View>
                                <Text className="text-[11px] font-bold text-gray-700 uppercase mb-1">
                                    Cassava Variety
                                </Text>
                                <TextInput
                                    className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 font-bold"
                                    placeholder="Golden Yellow"
                                    placeholderTextColor="#9CA3AF"
                                    value={forecastVariety}
                                    onChangeText={setForecastVariety}
                                />
                            </View>

                            <View>
                                <Text className="text-[11px] font-bold text-gray-700 uppercase mb-1">
                                    Offtake Price / kg (₱)
                                </Text>
                                <TextInput
                                    className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 font-bold"
                                    placeholder="4.00"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="numeric"
                                    value={forecastPrice}
                                    onChangeText={setForecastPrice}
                                />
                            </View>
                        </View>

                        {/* Health Condition Chips */}
                        <Text className="text-[11px] font-bold text-gray-700 uppercase mb-1.5">
                            Observed Field Health Condition
                        </Text>
                        <View className="flex-row flex-wrap gap-2 mb-4">
                            {[
                                { id: 'excellent', label: 'Excellent (30 t/ha)', color: 'border-emerald-600 text-emerald-800' },
                                { id: 'good', label: 'Good (25 t/ha)', color: 'border-blue-600 text-blue-800' },
                                { id: 'fair', label: 'Fair (18 t/ha)', color: 'border-amber-600 text-amber-800' },
                                { id: 'pest_risk', label: 'Pest Risk (12 t/ha)', color: 'border-rose-600 text-rose-800' },
                            ].map((cond) => (
                                <Pressable
                                    key={cond.id}
                                    onPress={() => setForecastHealth(cond.id)}
                                    className={`px-3 py-1.5 rounded-lg border ${
                                        forecastHealth === cond.id
                                            ? 'bg-gray-900 border-gray-900'
                                            : 'bg-white border-gray-200'
                                    }`}
                                >
                                    <Text
                                        className={`text-xs font-bold ${
                                            forecastHealth === cond.id ? 'text-white' : 'text-gray-700'
                                        }`}
                                    >
                                        {cond.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>

                        {/* Forecast Results Display */}
                        {forecastResult && (
                            <View className="bg-emerald-50/80 border border-emerald-200 p-4 rounded-xl">
                                <View className="flex-row items-center justify-between mb-2">
                                    <Text className="text-xs font-black text-emerald-900 uppercase tracking-wider">
                                        Forecasted Output ({forecastResult.variety})
                                    </Text>
                                    <Text className="text-xs font-bold text-emerald-700">
                                        Benchmark: {forecastResult.expectedTonsPerHa} t/ha
                                    </Text>
                                </View>

                                <View className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-emerald-200">
                                    <View>
                                        <Text className="text-[10px] text-emerald-800 font-bold uppercase">Projected Net Yield</Text>
                                        <Text className="text-lg font-black text-emerald-950">
                                            {(forecastResult.projectedYieldKg / 1000).toFixed(1)} Metric Tons
                                        </Text>
                                        <Text className="text-[10px] text-emerald-700 font-mono">
                                            {forecastResult.projectedYieldKg.toLocaleString()} kg
                                        </Text>
                                    </View>

                                    <View>
                                        <Text className="text-[10px] text-emerald-800 font-bold uppercase">Gross Offtake Value</Text>
                                        <Text className="text-lg font-black text-emerald-950">
                                            {formatPHP(forecastResult.projectedGrossRevenue)}
                                        </Text>
                                        <Text className="text-[10px] text-emerald-700">
                                            @ {formatPHP(parseFloat(forecastPrice) || 4.0)}/kg
                                        </Text>
                                    </View>

                                    <View>
                                        <Text className="text-[10px] text-emerald-800 font-bold uppercase">Land Owner Est. Cost</Text>
                                        <Text className="text-lg font-black text-emerald-950">
                                            {formatPHP(Math.max(forecastResult.projectedYieldKg * 1.0, 25000))}
                                        </Text>
                                        <Text className="text-[10px] text-emerald-700">₱1/kg or ₱25k minimum</Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            )}
        </ScrollView>
    );
}
