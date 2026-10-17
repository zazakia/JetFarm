import React, { useState, useEffect, useCallback } from 'react';
import { usePageContentStyle } from '../../../src/hooks/useResponsiveLayout';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, Platform, Modal, Alert, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import AgriCropCycle from '../../../src/database/models/AgriCropCycle';
import { formatPHP } from '../../../src/utils/currency';
import { Q } from '@nozbe/watermelondb';
import {
    AgriImplementationReportService,
    BacalsoFarmReportData,
    BACALSO_BENCHMARK_HA,
} from '../../../src/services/AgriImplementationReportService';

export default function AgriImplementationReportScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    const pageContentStyle = usePageContentStyle();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [cycles, setCycles] = useState<AgriCropCycle[]>([]);
    const [selectedCycleId, setSelectedCycleId] = useState<string>(
        typeof params.cycleId === 'string' ? params.cycleId : 'benchmark'
    );
    const [areaInput, setAreaInput] = useState<string>(
        typeof params.area === 'string' ? params.area : String(BACALSO_BENCHMARK_HA)
    );
    const [reportData, setReportData] = useState<BacalsoFarmReportData | null>(null);
    const [activeSection, setActiveSection] = useState<'summary' | 'matrix' | 'resources'>('summary');
    const [htmlModalVisible, setHtmlModalVisible] = useState(false);
    const [generatedHtml, setGeneratedHtml] = useState('');

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const cycleList = await database
                .get<AgriCropCycle>('agri_crop_cycles')
                .query(Q.where('deleted_at', null), Q.sortBy('planting_date', Q.desc))
                .fetch();
            setCycles(cycleList);

            const areaHa = parseFloat(areaInput) > 0 ? parseFloat(areaInput) : BACALSO_BENCHMARK_HA;

            if (selectedCycleId === 'benchmark' || !selectedCycleId) {
                // Use the standard Bacalso Farm benchmark template
                const benchmarkReport = AgriImplementationReportService.buildReportData({
                    farmName: 'BACALSO FARM',
                    location: 'ALAE, BUKIDNON',
                    areaHa,
                    cropCycleName: '1ST CROP',
                    grossHarvest: Math.round(550000 * (areaHa / BACALSO_BENCHMARK_HA)),
                    expenses: [],
                });
                setReportData(benchmarkReport);
            } else {
                // Load from real cycle and its linked expenses
                const liveReport = await AgriImplementationReportService.generateReportForCycle(
                    selectedCycleId,
                    database
                );
                // If user customized area, apply it
                if (areaHa !== liveReport.areaHa) {
                    liveReport.areaHa = areaHa;
                }
                setReportData(liveReport);
            }
        } catch (err) {
            console.error('[AgriImplementationReport] Error loading report:', err);
            Alert.alert('Error', 'Failed to load implementation report.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedCycleId, areaInput]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handlePrintOrExport = () => {
        if (!reportData) return;
        const html = AgriImplementationReportService.generateBacalsoFarmReportHtml(reportData);
        setGeneratedHtml(html);

        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(html);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                }, 400);
                return;
            }
        }
        setHtmlModalVisible(true);
    };

    if (loading && !reportData) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#059669" />
                <Text className="text-gray-500 font-medium mt-3">Loading Implementation &amp; P&amp;L Report...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            contentContainerStyle={pageContentStyle}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Top Navigation Bar */}
            <View className="flex-row flex-wrap items-center justify-between gap-y-2 mb-4">
                <Pressable
                    onPress={() => router.back()}
                    className="flex-row items-center gap-1.5 px-3 py-2 bg-white rounded-xl border border-gray-200 shadow-sm active:bg-gray-100"
                >
                    <MaterialIcons name="arrow-back" size={18} color="#374151" />
                    <Text className="text-gray-700 font-bold text-xs">Back to Hub</Text>
                </Pressable>

                <View className="flex-row flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                    <Pressable
                        onPress={() => router.push('/(admin)/agribusiness/expenses?view=steps' as any)}
                        className="flex-row items-center gap-1.5 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-200 active:bg-emerald-100"
                    >
                        <MaterialIcons name="receipt-long" size={16} color="#047857" />
                        <Text className="text-emerald-800 font-bold text-xs">Farm Expenses</Text>
                    </Pressable>

                    <Pressable
                        onPress={handlePrintOrExport}
                        className="flex-row items-center gap-1.5 px-4 py-2 bg-emerald-700 rounded-xl shadow-sm active:bg-emerald-800"
                    >
                        <MaterialIcons name="print" size={18} color="#FFFFFF" />
                        <Text className="text-white font-black text-xs uppercase tracking-wider">Print / Export</Text>
                    </Pressable>
                </View>
            </View>

            {/* Farm Banner matching physical report */}
            <View className="bg-lime-500 rounded-2xl p-5 mb-5 shadow-sm border border-lime-600">
                <View className="items-center text-center">
                    <Text className="text-emerald-950 font-black text-xl tracking-wide uppercase text-center">
                        {reportData?.farmName || 'BACALSO FARM'}
                    </Text>
                    <Text className="text-emerald-900 font-bold text-sm tracking-wider mt-0.5 text-center">
                        {reportData?.areaHa.toFixed(2)} HA IN {reportData?.location || 'ALAE, BUKIDNON'}
                    </Text>
                    <View className="bg-emerald-900/10 px-3 py-0.5 rounded-full mt-1.5 border border-emerald-900/20">
                        <Text className="text-emerald-950 font-black text-xs tracking-widest uppercase">
                            {reportData?.cropCycleName || '1ST CROP'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Cycle Selector & Parcel Controls */}
            <View className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm mb-5">
                <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Report Parameters &amp; Cycle Selector
                </Text>
                <View className="flex-row flex-wrap items-center gap-3">
                    <View className="flex-1 min-w-[200px]">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
                            <Pressable
                                onPress={() => setSelectedCycleId('benchmark')}
                                className={`px-3 py-1.5 rounded-xl border ${selectedCycleId === 'benchmark' ? 'bg-emerald-800 border-emerald-800' : 'bg-gray-100 border-gray-200'}`}
                            >
                                <Text className={`text-xs font-bold ${selectedCycleId === 'benchmark' ? 'text-white' : 'text-gray-700'}`}>
                                    Bacalso Farm (3.45 Ha)
                                </Text>
                            </Pressable>

                            {cycles.map((c) => (
                                <Pressable
                                    key={c.id}
                                    onPress={() => setSelectedCycleId(c.id)}
                                    className={`px-3 py-1.5 rounded-xl border ${selectedCycleId === c.id ? 'bg-emerald-800 border-emerald-800' : 'bg-gray-100 border-gray-200'}`}
                                >
                                    <Text className={`text-xs font-bold ${selectedCycleId === c.id ? 'text-white' : 'text-gray-700'}`}>
                                        {c.cycleCode}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>

                    <View className="flex-row items-center gap-2">
                        <Text className="text-xs font-bold text-gray-600">Area (Ha):</Text>
                        <TextInput
                            value={areaInput}
                            onChangeText={setAreaInput}
                            keyboardType="numeric"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-900 w-16 text-center"
                        />
                        <Pressable
                            onPress={loadData}
                            className="bg-emerald-600 px-3 py-1.5 rounded-lg active:bg-emerald-700"
                        >
                            <Text className="text-white text-xs font-bold">Apply</Text>
                        </Pressable>
                    </View>
                </View>
            </View>

            {/* Financial Overview Cards */}
            {reportData && (
                <View className="flex-row flex-wrap gap-3 mb-5">
                    <View className="flex-1 min-w-[150px] bg-amber-50 p-4 rounded-2xl border border-amber-200 shadow-sm">
                        <Text className="text-xs font-bold text-amber-800 uppercase tracking-wider">Total Planned Cost</Text>
                        <Text className="text-xl font-black text-amber-950 mt-1">{formatPHP(reportData.totalPlannedCost)}</Text>
                        <Text className="text-xs text-amber-700 mt-0.5">
                            {formatPHP(reportData.totalPlannedCost / reportData.areaHa)} / ha
                        </Text>
                    </View>

                    <View className="flex-1 min-w-[150px] bg-blue-50 p-4 rounded-2xl border border-blue-200 shadow-sm">
                        <Text className="text-xs font-bold text-blue-800 uppercase tracking-wider">Gross Harvest Value</Text>
                        <Text className="text-xl font-black text-blue-950 mt-1">{formatPHP(reportData.totalCassavaHarvestGross)}</Text>
                        <Text className="text-xs text-blue-700 mt-0.5">Estimated gross tuber yield</Text>
                    </View>

                    <View className="flex-1 min-w-[150px] bg-emerald-50 p-4 rounded-2xl border border-emerald-300 shadow-sm">
                        <Text className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Projected Net Income</Text>
                        <Text className="text-2xl font-black text-emerald-900 mt-1">{formatPHP(reportData.netIncomePlanned)}</Text>
                        <Text className="text-xs text-emerald-700 mt-0.5">Gross less total input cost</Text>
                    </View>

                    <View className="flex-1 min-w-[150px] bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Actual Cost</Text>
                        <Text className="text-xl font-black text-gray-900 mt-1">{formatPHP(reportData.totalActualCost)}</Text>
                        <Text className={`text-xs font-bold mt-0.5 ${reportData.netCostVariance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {reportData.netCostVariance > 0 ? `Over by ${formatPHP(reportData.netCostVariance)}` : `Under by ${formatPHP(Math.abs(reportData.netCostVariance))}`}
                        </Text>
                    </View>
                </View>
            )}

            {/* Section Switcher Tabs */}
            <View className="flex-row bg-gray-200 p-1 rounded-2xl mb-4">
                {[
                    { id: 'summary', label: 'Summary Table & P&L', icon: 'format-list-bulleted' },
                    { id: 'matrix', label: 'Implementation Schedule (Gantt)', icon: 'calendar-view-month' },
                    { id: 'resources', label: 'Resource Inputs Matrix', icon: 'inventory' },
                ].map((tab) => (
                    <Pressable
                        key={tab.id}
                        onPress={() => setActiveSection(tab.id as any)}
                        className={`flex-1 py-2 rounded-xl flex-row items-center justify-center gap-1.5 ${activeSection === tab.id ? 'bg-white shadow-sm' : ''}`}
                    >
                        <MaterialIcons
                            name={tab.icon as any}
                            size={16}
                            color={activeSection === tab.id ? '#047857' : '#6B7280'}
                        />
                        <Text className={`text-xs font-bold ${activeSection === tab.id ? 'text-gray-900' : 'text-gray-600'}`}>
                            {tab.label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* TAB 1: Summary Table & P&L (Replica of paper report top-left) */}
            {activeSection === 'summary' && reportData && (
                <View className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                    <View className="bg-orange-100 p-3 border-b border-orange-200">
                        <Text className="text-orange-950 font-black text-sm text-center uppercase tracking-wider">
                            Summary of Expenses &amp; Net Income
                        </Text>
                    </View>

                    <View className="p-3">
                        <View className="flex-row justify-between pb-2 border-b border-gray-200 mb-2">
                            <Text className="text-xs font-bold text-gray-500 uppercase flex-1">Operational Stage</Text>
                            <Text className="text-xs font-bold text-gray-500 uppercase w-28 text-right">Planned (₱)</Text>
                            <Text className="text-xs font-bold text-gray-500 uppercase w-28 text-right">Actual (₱)</Text>
                        </View>

                        {reportData.activities.map((act, idx) => (
                            <View
                                key={act.id}
                                className={`flex-row justify-between py-2 border-b border-gray-100 ${idx % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'}`}
                            >
                                <View className="flex-1 pr-2">
                                    <Text className="text-gray-900 font-bold text-xs uppercase">{act.name}</Text>
                                    <Text className="text-gray-400 text-xs mt-0.5">
                                        Target: Day {act.theoreticalDaysLabel}
                                        {act.actualDatesLabel ? ` • Recorded: ${act.actualDatesLabel}` : ''}
                                    </Text>
                                </View>
                                <Text className="text-gray-900 font-bold text-xs font-mono w-28 text-right">
                                    {formatPHP(act.plannedCost)}
                                </Text>
                                <Text className={`font-bold text-xs font-mono w-28 text-right ${act.actualCost > act.plannedCost ? 'text-rose-600' : 'text-emerald-700'}`}>
                                    {formatPHP(act.actualCost)}
                                </Text>
                            </View>
                        ))}

                        {/* Total Cost Row (Yellow Highlight) */}
                        <View className="flex-row justify-between py-3 px-2 bg-yellow-100 rounded-xl my-2 border border-yellow-300">
                            <Text className="text-yellow-950 font-black text-sm uppercase">TOTAL COST</Text>
                            <Text className="text-yellow-950 font-black text-sm font-mono w-28 text-right">
                                {formatPHP(reportData.totalPlannedCost)}
                            </Text>
                            <Text className="text-yellow-950 font-black text-sm font-mono w-28 text-right">
                                {formatPHP(reportData.totalActualCost)}
                            </Text>
                        </View>

                        {/* Revenue & Net Income */}
                        <View className="pt-2 border-t border-gray-200">
                            <View className="flex-row justify-between py-1.5">
                                <Text className="text-gray-700 font-bold text-xs uppercase">Total Cassava Harvest (Gross)</Text>
                                <Text className="text-gray-900 font-bold text-xs font-mono w-28 text-right">
                                    {formatPHP(reportData.totalCassavaHarvestGross)}
                                </Text>
                                <Text className="text-gray-900 font-bold text-xs font-mono w-28 text-right">
                                    {formatPHP(reportData.totalCassavaHarvestGross)}
                                </Text>
                            </View>

                            <View className="flex-row justify-between py-1.5">
                                <Text className="text-gray-500 text-xs">Less Total Cost</Text>
                                <Text className="text-rose-600 text-xs font-mono w-28 text-right">
                                    -{formatPHP(reportData.totalPlannedCost)}
                                </Text>
                                <Text className="text-rose-600 text-xs font-mono w-28 text-right">
                                    -{formatPHP(reportData.totalActualCost)}
                                </Text>
                            </View>

                            {/* Net Income Row (Green Highlight) */}
                            <View className="flex-row justify-between py-3 px-2 bg-emerald-100 rounded-xl mt-2 border border-emerald-300">
                                <Text className="text-emerald-950 font-black text-sm uppercase">NET INCOME</Text>
                                <Text className="text-emerald-950 font-black text-sm font-mono w-28 text-right">
                                    {formatPHP(reportData.netIncomePlanned)}
                                </Text>
                                <Text className="text-emerald-950 font-black text-sm font-mono w-28 text-right">
                                    {formatPHP(reportData.netIncomeActual)}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            )}

            {/* TAB 2: Implementation Schedule Gantt Matrix */}
            {activeSection === 'matrix' && reportData && (
                <View className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
                    <View className="flex-row justify-between items-center mb-3">
                        <Text className="text-gray-900 font-black text-sm">
                            Implementation Schedule Matrix (Planned vs Actual)
                        </Text>
                        <Text className="text-gray-500 text-xs font-medium">13-Month Cassava Crop Progression</Text>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={true} className="border border-gray-200 rounded-xl">
                        <View>
                            {/* Column Headers */}
                            <View className="flex-row bg-gray-100 border-b border-gray-300">
                                <View className="w-16 p-2 border-r border-gray-300 justify-center items-center">
                                    <Text className="text-[10px] font-black text-gray-700 uppercase">Month</Text>
                                </View>
                                {reportData.activities.map((act) => (
                                    <View key={act.id} className="w-24 p-2 border-r border-gray-200 items-center justify-center">
                                        <Text className="text-[10px] font-black text-gray-800 text-center uppercase">{act.code}</Text>
                                        <Text className="text-[8px] text-gray-500 mt-0.5">Day {act.theoreticalDaysLabel}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Section A: Theoretical */}
                            <View className="bg-sky-100 px-3 py-1.5 border-b border-sky-200">
                                <Text className="text-xs font-black text-sky-900 uppercase">
                                    A. THEORETICAL SCHEDULE (TARGET TIMELINE DAYS)
                                </Text>
                            </View>
                            {reportData.months.map((m) => {
                                const cells = reportData.theoreticalMatrix[m] || new Array(12).fill('');
                                return (
                                    <View key={`theor-${m}`} className="flex-row border-b border-gray-100">
                                        <View className="w-16 p-1.5 bg-gray-50 border-r border-gray-200 justify-center items-center">
                                            <Text className="text-[10px] font-bold text-gray-600">{m}</Text>
                                        </View>
                                        {cells.map((cell, cIdx) => (
                                            <View
                                                key={cIdx}
                                                className={`w-24 p-1.5 border-r border-gray-100 items-center justify-center ${cell ? 'bg-sky-50' : ''}`}
                                            >
                                                <Text className={`text-[10px] font-bold ${cell ? 'text-sky-800' : 'text-gray-300'}`}>
                                                    {cell || '-'}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                );
                            })}

                            {/* Section B: Actual */}
                            <View className="bg-emerald-100 px-3 py-1.5 border-b border-emerald-200">
                                <Text className="text-xs font-black text-emerald-900 uppercase">
                                    B. ACTUAL SCHEDULE (RECORDED FIELD EXECUTION DATES)
                                </Text>
                            </View>
                            {reportData.months.map((m) => {
                                const cells = reportData.actualMatrix[m] || new Array(12).fill('');
                                return (
                                    <View key={`act-${m}`} className="flex-row border-b border-gray-100">
                                        <View className="w-16 p-1.5 bg-gray-50 border-r border-gray-200 justify-center items-center">
                                            <Text className="text-[10px] font-bold text-gray-600">{m}</Text>
                                        </View>
                                        {cells.map((cell, cIdx) => (
                                            <View
                                                key={cIdx}
                                                className={`w-24 p-1.5 border-r border-gray-100 items-center justify-center ${cell ? 'bg-emerald-50' : ''}`}
                                            >
                                                <Text className={`text-[10px] font-bold ${cell ? 'text-emerald-800' : 'text-gray-300'}`}>
                                                    {cell || '-'}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
                </View>
            )}

            {/* TAB 3: Resource Inputs Matrix */}
            {activeSection === 'resources' && reportData && (
                <View className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
                    <Text className="text-gray-900 font-black text-sm mb-1">
                        Resource Inputs &amp; Quantities Matrix
                    </Text>
                    <Text className="text-gray-500 text-xs mb-4">
                        Scaled for {reportData.areaHa.toFixed(2)} Hectares Commercial Cassava Field
                    </Text>

                    <View className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <View className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                            <Text className="text-xs font-bold text-gray-500 uppercase">Diesel Total Usage</Text>
                            <Text className="text-xl font-black text-gray-900 mt-1">
                                {reportData.resources.dieselTotalLiters.toLocaleString()} L
                            </Text>
                            <Text className="text-xs text-gray-500 mt-0.5">
                                {formatPHP(reportData.resources.dieselCost)} total fuel
                            </Text>
                        </View>

                        <View className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                            <Text className="text-xs font-bold text-gray-500 uppercase">Seed Stalks</Text>
                            <Text className="text-xl font-black text-gray-900 mt-1">
                                {reportData.resources.seedStalkBundles.toLocaleString()} Bundles
                            </Text>
                            <Text className="text-xs text-gray-500 mt-0.5">₱25.00 / bundle benchmark</Text>
                        </View>

                        <View className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                            <Text className="text-xs font-bold text-gray-500 uppercase">Urea (46-0-0)</Text>
                            <Text className="text-xl font-black text-gray-900 mt-1">
                                {reportData.resources.ureaBags} Bags
                            </Text>
                            <Text className="text-xs text-gray-500 mt-0.5">₱2,500.00 / bag</Text>
                        </View>

                        <View className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                            <Text className="text-xs font-bold text-gray-500 uppercase">DAP (18-46-0)</Text>
                            <Text className="text-xl font-black text-gray-900 mt-1">
                                {reportData.resources.dapBags} Bags
                            </Text>
                            <Text className="text-xs text-gray-500 mt-0.5">₱3,100.00 / bag</Text>
                        </View>

                        <View className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                            <Text className="text-xs font-bold text-gray-500 uppercase">Potash (0-0-60)</Text>
                            <Text className="text-xl font-black text-gray-900 mt-1">
                                {reportData.resources.potashBags} Bags
                            </Text>
                            <Text className="text-xs text-gray-500 mt-0.5">₱1,600.00 / bag (Bulking)</Text>
                        </View>

                        <View className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                            <Text className="text-xs font-bold text-gray-500 uppercase">Herbicides &amp; Surfactant</Text>
                            <Text className="text-lg font-black text-gray-900 mt-1">
                                {reportData.resources.interlineUnits} Interline
                            </Text>
                            <Text className="text-xs text-gray-500 mt-0.5">
                                + {reportData.resources.amineUnits} 2,4-D + {reportData.resources.hoestickUnits} Hoestick
                            </Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Print / HTML Preview Modal (Mobile Fallback) */}
            <Modal visible={htmlModalVisible} animationType="slide" transparent={true}>
                <View className="flex-1 justify-center items-center bg-black/60 p-4">
                    <View className="bg-white w-full max-w-2xl rounded-3xl p-6 shadow-2xl max-h-[85%]">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-gray-900 font-black text-lg">Report HTML Generated</Text>
                            <Pressable onPress={() => setHtmlModalVisible(false)} className="p-1">
                                <MaterialIcons name="close" size={24} color="#6B7280" />
                            </Pressable>
                        </View>
                        <Text className="text-xs text-gray-500 mb-3">
                            The Bacalso Farm Implementation Report was compiled in landscape format. You can copy the HTML or use a browser to print directly.
                        </Text>
                        <ScrollView className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
                            <Text className="text-xs font-mono text-gray-800" numberOfLines={30}>
                                {generatedHtml}
                            </Text>
                        </ScrollView>
                        <Pressable
                            onPress={() => setHtmlModalVisible(false)}
                            className="bg-emerald-700 py-3 rounded-xl items-center"
                        >
                            <Text className="text-white font-bold text-sm">Close</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}
