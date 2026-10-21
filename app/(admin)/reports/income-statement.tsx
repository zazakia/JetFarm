import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable, Modal } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CoopFinancialReportService, CdaOperationsStatement } from '../../../src/services/CoopFinancialReportService';
import { BusinessUnitService } from '../../../src/services/BusinessUnitService';
import { formatPHP } from '../../../src/utils/currency';
import { format } from 'date-fns';
import { COMPANY_NAME_FULL } from '../../../src/constants/brand';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function IncomeStatementScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [year, setYear] = useState(2025);
    const [reportData, setReportData] = useState<CdaOperationsStatement | null>(null);
    const [selectedNote, setSelectedNote] = useState<number | null>(null);
    const [businessUnits, setBusinessUnits] = useState<any[]>([]);
    const [selectedBu, setSelectedBu] = useState<string | undefined>(undefined);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await CoopFinancialReportService.getStatementOfOperations(year, selectedBu);
            setReportData(data);

            const buList = await BusinessUnitService.getAll();
            setBusinessUnits(buList.filter(bu => bu.isActive));
        } catch (error) {
            console.error('Failed to load Statement of Operations:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [year, selectedBu])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const formatRowAmount = (val: number) => {
        if (val < 0) return `(${formatPHP(Math.abs(val)).replace('PHP ', '')})`;
        if (val === 0) return '-';
        return formatPHP(val).replace('PHP ', '');
    };

    const renderHeader = () => (
        <View className="items-center bg-white p-6 border-b border-gray-150 mb-4 shadow-sm">
            <Text className="text-center font-black text-gray-900 tracking-wider text-xs uppercase">
                {COMPANY_NAME_FULL}
            </Text>
            <Text className="text-center text-[10px] text-gray-600 mt-0.5">
                Purok 2, CCT Village, Linao, Ormoc City
            </Text>
            
            <View className="h-px bg-gray-200 w-full my-3" />
            
            <Text className="font-bold text-gray-950 text-base uppercase tracking-widest text-center">
                Statement of Operations
            </Text>
            <Text className="text-[11px] font-semibold text-gray-600 mt-0.5">
                For the year ended December 31, {year}
            </Text>
            <Text className="text-[10px] text-gray-500 italic mt-0.5">
                (Amounts in Philippine Pesos) • (With comparative figures of {year - 1})
            </Text>
        </View>
    );

    const renderTableHeader = () => (
        <View className="flex-row bg-slate-900 px-4 py-3 rounded-t-xl">
            <Text className="flex-[2.5] text-left text-white font-bold text-[10px] uppercase">Particulars</Text>
            <Text className="flex-[0.5] text-center text-white font-bold text-[10px] uppercase">Notes</Text>
            <Text className="flex-[1] text-right text-white font-bold text-[10px] uppercase">{year}</Text>
            <Text className="flex-[1] text-right text-white font-bold text-[10px] uppercase">{year - 1}</Text>
            <Text className="flex-[1] text-right text-white font-bold text-[10px] uppercase">Variance</Text>
        </View>
    );

    const renderRow = (
        label: string,
        noteNum: number | null,
        current: number,
        prior: number,
        variance: number,
        isHeader = false,
        isSubtotal = false,
        indent = false
    ) => {
        const textStyle = isHeader
            ? 'font-black text-gray-900 text-xs'
            : isSubtotal
            ? 'font-bold text-gray-950 text-xs'
            : 'text-gray-700 text-[11px]';

        return (
            <View 
                className={`flex-row px-4 py-2.5 border-b border-gray-100 items-center ${
                    isSubtotal ? 'bg-slate-50 border-t border-slate-200' : ''
                }`}
            >
                <Text className={`flex-[2.5] ${textStyle} ${indent ? 'pl-4' : ''}`} numberOfLines={2}>
                    {label}
                </Text>
                
                {noteNum ? (
                    <Pressable 
                        onPress={() => setSelectedNote(noteNum)}
                        className="flex-[0.5] items-center justify-center bg-blue-50 py-0.5 rounded"
                    >
                        <Text className="text-[10px] font-black text-blue-800">{noteNum}</Text>
                    </Pressable>
                ) : (
                    <View className="flex-[0.5]" />
                )}
                
                <Text className={`flex-[1] text-right ${textStyle}`}>
                    {formatRowAmount(current)}
                </Text>
                <Text className={`flex-[1] text-right ${textStyle} text-gray-500`}>
                    {formatRowAmount(prior)}
                </Text>
                <Text 
                    className={`flex-[1] text-right ${textStyle} ${
                        variance > 0 ? 'text-emerald-700' : variance < 0 ? 'text-red-700' : 'text-gray-500'
                    }`}
                >
                    {formatRowAmount(variance)}
                </Text>
            </View>
        );
    };

    // The allocation rows only appropriate the statutory percentages, so the surplus they leave
    // behind is displayed rather than implied — otherwise "Net Surplus as Distributed" would not
    // equal the rows above it.
    const allocatedCurrent = reportData?.allocations.reduce((s, a) => s + a.amount, 0) ?? 0;
    const allocatedPrior = reportData?.allocations.reduce((s, a) => s + a.priorAmount, 0) ?? 0;
    const unallocatedSurplus = (reportData?.netSurplus.current ?? 0) - allocatedCurrent;
    const priorUnallocated = (reportData?.netSurplus.prior ?? 0) - allocatedPrior;

    if (loading && !refreshing && !reportData) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#0F172A" />
                <Text className="text-gray-500 font-medium text-xs mt-3">Computing statement of operations...</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            {/* Top Toolbar */}
            <View className="flex-row justify-between items-center px-4 py-3 bg-white border-b border-gray-200">
                <View className="flex-row items-center">
                    <Pressable onPress={() => router.back()} className="p-2 mr-2 rounded-full active:bg-gray-150">
                        <MaterialIcons name="arrow-back" size={20} color="#334155" />
                    </Pressable>
                    <Text className="text-lg font-black text-gray-900">Statement of Operations</Text>
                </View>
                <View className="flex-row items-center">
                    <Pressable 
                        onPress={() => setYear(y => y - 1)}
                        className="p-2 bg-slate-100 rounded-lg active:bg-slate-200 mr-1"
                    >
                        <MaterialIcons name="chevron-left" size={18} color="#1E293B" />
                    </Pressable>
                    <Text className="font-black text-slate-800 px-2 text-sm">{year}</Text>
                    <Pressable 
                        onPress={() => setYear(y => y + 1)}
                        className="p-2 bg-slate-100 rounded-lg active:bg-slate-200 mr-2"
                    >
                        <MaterialIcons name="chevron-right" size={18} color="#1E293B" />
                    </Pressable>
                    <Pressable 
                        onPress={() => router.push('/(admin)/reports/period-settings')}
                        className="p-2 bg-blue-50 rounded-lg active:bg-blue-100"
                    >
                        <MaterialIcons name="settings" size={18} color="#1D4ED8" />
                    </Pressable>
                </View>
            </View>

            {/* Segment Selector */}
            <View className="bg-white border-b border-gray-200 px-4 py-2 flex-row">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Pressable
                        onPress={() => setSelectedBu(undefined)}
                        className={`px-3 py-1.5 rounded-full mr-2 ${selectedBu === undefined ? 'bg-blue-900' : 'bg-gray-100'}`}
                    >
                        <Text className={`text-xs font-bold ${selectedBu === undefined ? 'text-white' : 'text-gray-600'}`}>
                            Consolidated
                        </Text>
                    </Pressable>
                    {businessUnits.map(bu => (
                        <Pressable
                            key={bu.id}
                            onPress={() => setSelectedBu(bu.slug)}
                            className={`px-3 py-1.5 rounded-full mr-2 ${selectedBu === bu.slug ? 'bg-blue-900' : 'bg-gray-100'}`}
                        >
                            <Text className={`text-xs font-bold ${selectedBu === bu.slug ? 'text-white' : 'text-gray-600'}`}>
                                {bu.name}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            <ScrollView 
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {renderHeader()}

                {reportData ? (
                    <Animated.View entering={FadeInDown.springify()} className="px-4">
                        <View className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {renderTableHeader()}

                            {/* REVENUES */}
                            <View className="bg-slate-100 px-4 py-1.5 border-b border-gray-200">
                                <Text className="font-black text-[10px] uppercase text-slate-800 tracking-wider">Revenues</Text>
                            </View>
                            {renderRow('Harvest Revenue', 13, reportData.revenues.offtakeRevenue.current + reportData.revenues.byproductRevenue.current, reportData.revenues.offtakeRevenue.prior + reportData.revenues.byproductRevenue.prior, reportData.revenues.offtakeRevenue.variance + reportData.revenues.byproductRevenue.variance, true)}
                            {renderRow('Off-take delivered to buyer', null, reportData.revenues.offtakeRevenue.current, reportData.revenues.offtakeRevenue.prior, reportData.revenues.offtakeRevenue.variance, false, false, true)}
                            {renderRow('By-product & residue sales', null, reportData.revenues.byproductRevenue.current, reportData.revenues.byproductRevenue.prior, reportData.revenues.byproductRevenue.variance, false, false, true)}

                            {renderRow('Other Revenue', 14, reportData.revenues.otherRevenue.current, reportData.revenues.otherRevenue.prior, reportData.revenues.otherRevenue.variance, true)}

                            {renderRow('TOTAL REVENUES', null, reportData.revenues.totalRevenues.current, reportData.revenues.totalRevenues.prior, reportData.revenues.totalRevenues.variance, true, true)}

                            {/* EXPENSES */}
                            <View className="bg-slate-100 px-4 py-1.5 border-b border-gray-200 border-t border-gray-200">
                                <Text className="font-black text-[10px] uppercase text-slate-800 tracking-wider">Expenses</Text>
                            </View>
                            {renderRow('Farm Production Costs', 15, reportData.expenses.farmProductionCosts.current, reportData.expenses.farmProductionCosts.prior, reportData.expenses.farmProductionCosts.variance, true)}
                            {renderRow('Land-owner settlements', null, reportData.expenses.landOwnerSettlements.current, reportData.expenses.landOwnerSettlements.prior, reportData.expenses.landOwnerSettlements.variance, false, false, true)}
                            {renderRow('Field labor', null, reportData.expenses.farmLabor.current, reportData.expenses.farmLabor.prior, reportData.expenses.farmLabor.variance, false, false, true)}
                            {renderRow('Farm inputs', null, reportData.expenses.farmInputs.current, reportData.expenses.farmInputs.prior, reportData.expenses.farmInputs.variance, false, false, true)}
                            {renderRow('Machinery & logistics', null, reportData.expenses.machineryAndLogistics.current, reportData.expenses.machineryAndLogistics.prior, reportData.expenses.machineryAndLogistics.variance, false, false, true)}
                            {renderRow('Other farm costs', null, reportData.expenses.otherFarmCosts.current, reportData.expenses.otherFarmCosts.prior, reportData.expenses.otherFarmCosts.variance, false, false, true)}

                            {renderRow('Administrative Costs', 16, reportData.expenses.totalAdminCosts.current, reportData.expenses.totalAdminCosts.prior, reportData.expenses.totalAdminCosts.variance, true)}
                            {renderRow('Salaries and Wages', null, reportData.expenses.salaries.current, reportData.expenses.salaries.prior, reportData.expenses.salaries.variance, false, false, true)}
                            {renderRow('Office Expenses', null, reportData.expenses.office.current, reportData.expenses.office.prior, reportData.expenses.office.variance, false, false, true)}
                            {renderRow('Communication Expenses', null, reportData.expenses.communication.current, reportData.expenses.communication.prior, reportData.expenses.communication.variance, false, false, true)}
                            {renderRow('Transportation Expenses', null, reportData.expenses.transportation.current, reportData.expenses.transportation.prior, reportData.expenses.transportation.variance, false, false, true)}
                            {renderRow('Depreciation & Amortization', null, reportData.expenses.depreciation.current, reportData.expenses.depreciation.prior, reportData.expenses.depreciation.variance, false, false, true)}
                            {renderRow('Taxes & Licenses', null, reportData.expenses.taxes.current, reportData.expenses.taxes.prior, reportData.expenses.taxes.variance, false, false, true)}
                            {renderRow('Repairs & Maintenance', null, reportData.expenses.repairs.current, reportData.expenses.repairs.prior, reportData.expenses.repairs.variance, false, false, true)}
                            {renderRow('Training & Development', null, reportData.expenses.training.current, reportData.expenses.training.prior, reportData.expenses.training.variance, false, false, true)}
                            {renderRow('Professional Fees', null, reportData.expenses.professional.current, reportData.expenses.professional.prior, reportData.expenses.professional.variance, false, false, true)}
                            {renderRow('Other Operating Expenses', null, reportData.expenses.otherExpenses.current, reportData.expenses.otherExpenses.prior, reportData.expenses.otherExpenses.variance, false, false, true)}
                            
                            {renderRow('TOTAL EXPENSES', null, reportData.expenses.totalExpenses.current, reportData.expenses.totalExpenses.prior, reportData.expenses.totalExpenses.variance, true, true)}

                            {renderRow('NET SURPLUS (LOSS) FOR THE YEAR', null, reportData.netSurplus.current, reportData.netSurplus.prior, reportData.netSurplus.variance, true, true)}

                            {/* DISTRIBUTIONS SECTION */}
                            <View className="bg-slate-900 px-4 py-2 border-b border-gray-200 border-t border-gray-200">
                                <Text className="font-bold text-[10px] uppercase text-white tracking-wider">Distributed as follows:</Text>
                            </View>
                            {reportData.allocations.map((alloc, idx) => (
                                <View key={idx} className="flex-row px-4 py-2.5 border-b border-gray-100 items-center">
                                    <Text className="flex-[2] text-gray-700 text-[11px] font-semibold">{alloc.fundType}</Text>
                                    <Text className="flex-[0.5] text-center text-slate-500 text-[10px]">{alloc.percentage}%</Text>
                                    <Text className="flex-[1.25] text-right text-gray-900 text-[11px] font-bold">{formatRowAmount(alloc.amount)}</Text>
                                    <Text className="flex-[1.25] text-right text-gray-500 text-[11px]">{formatRowAmount(alloc.priorAmount)}</Text>
                                </View>
                            ))}
                            {renderRow('Retained — not appropriated', null, unallocatedSurplus, priorUnallocated, unallocatedSurplus - priorUnallocated, false, false, true)}

                            <View className="flex-row px-4 py-3 bg-emerald-50 border-t border-emerald-100 items-center">
                                <Text className="flex-[2.5] text-emerald-900 font-bold text-xs uppercase">Net Surplus as Distributed</Text>
                                <Text className="flex-[1.25] text-right text-emerald-950 font-black text-xs">{formatRowAmount(reportData.netSurplus.current)}</Text>
                                <Text className="flex-[1.25] text-right text-emerald-800 font-bold text-xs">{formatRowAmount(reportData.netSurplus.prior)}</Text>
                            </View>
                        </View>

                        <Pressable 
                            onPress={() => router.push({ pathname: '/(admin)/reports/notes-to-fs', params: { year } })}
                            className="mt-6 bg-slate-800 p-4 rounded-xl items-center flex-row justify-center active:bg-slate-700"
                        >
                            <MaterialIcons name="description" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text className="text-white font-bold text-xs">See Accompanying Notes to Financial Statements</Text>
                        </Pressable>
                    </Animated.View>
                ) : (
                    <View className="p-10 items-center">
                        <MaterialIcons name="error-outline" size={40} color="#D1D5DB" />
                        <Text className="text-gray-700 font-semibold mt-3">No report data found</Text>
                    </View>
                )}
            </ScrollView>

            {/* Note Detail Modal */}
            <Modal
                visible={selectedNote !== null}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setSelectedNote(null)}
            >
                <View className="flex-1 bg-black/50 justify-center items-center px-6">
                    <View className="bg-white rounded-2xl w-full max-h-[80%] overflow-hidden shadow-2xl">
                        <View className="flex-row justify-between items-center p-4 border-b border-gray-200 bg-slate-50">
                            <Text className="font-bold text-slate-900 text-sm">Note Details — Note {selectedNote}</Text>
                            <Pressable onPress={() => setSelectedNote(null)} className="p-1 rounded-full active:bg-gray-200">
                                <MaterialIcons name="close" size={20} color="#475569" />
                            </Pressable>
                        </View>
                        
                        <ScrollView className="p-5">
                            {selectedNote === 13 && (
                                <View>
                                    <Text className="text-slate-900 font-black text-xs uppercase mb-3">Harvest Revenue</Text>
                                    <Text className="text-xs text-gray-600 leading-relaxed mb-4">
                                        Revenue recognized when the delivered kilos are weighed in and the off-take price per kilo is agreed. By-product and residue sales from the same cycle are shown alongside it.
                                    </Text>
                                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                                        <Text className="text-[11px] text-gray-700">Off-take revenue (4140)</Text>
                                        <Text className="text-[11px] font-bold text-slate-800">{formatPHP(reportData?.revenues.offtakeRevenue.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                                        <Text className="text-[11px] text-gray-700">By-product revenue (4145)</Text>
                                        <Text className="text-[11px] font-bold text-slate-800">{formatPHP(reportData?.revenues.byproductRevenue.current)}</Text>
                                    </View>
                                </View>
                            )}

                            {selectedNote === 14 && (
                                <View>
                                    <Text className="text-slate-900 font-black text-xs uppercase mb-3">Other Revenue</Text>
                                    <Text className="text-xs text-gray-600 leading-relaxed mb-4">
                                        Every 4xxx account the presentation above does not name. It is computed as the whole revenue class less the harvest codes, so a new or legacy income account cannot be left out of TOTAL REVENUES.
                                    </Text>
                                    <View className="flex-row justify-between py-3 bg-slate-50 px-2 rounded">
                                        <Text className="text-xs font-bold text-slate-900">Balance</Text>
                                        <Text className="text-xs font-bold text-slate-900">{formatPHP(reportData?.revenues.otherRevenue.current)}</Text>
                                    </View>
                                </View>
                            )}

                            {selectedNote === 15 && (
                                <View>
                                    <Text className="text-slate-900 font-black text-xs uppercase mb-3">Farm Production Costs</Text>
                                    <Text className="text-xs text-gray-600 leading-relaxed mb-4">
                                        Direct cost of the crop cycles: the land-owner settlement payout for the kilos weighed in, field labor for work performed, inputs applied to the parcels, and machinery and haulage charged to the cycle.
                                    </Text>
                                    <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                                        <Text className="text-[10px] text-gray-700">Land-owner settlements (5160)</Text>
                                        <Text className="text-[10px] font-bold text-slate-800">{formatPHP(reportData?.expenses.landOwnerSettlements.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                                        <Text className="text-[10px] text-gray-700">Field labor (5161)</Text>
                                        <Text className="text-[10px] font-bold text-slate-800">{formatPHP(reportData?.expenses.farmLabor.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                                        <Text className="text-[10px] text-gray-700">Farm inputs (5162, 5163, 5165)</Text>
                                        <Text className="text-[10px] font-bold text-slate-800">{formatPHP(reportData?.expenses.farmInputs.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                                        <Text className="text-[10px] text-gray-700">Machinery &amp; logistics (5164, 5167, 5168)</Text>
                                        <Text className="text-[10px] font-bold text-slate-800">{formatPHP(reportData?.expenses.machineryAndLogistics.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                                        <Text className="text-[10px] text-gray-700">Other farm costs (5169)</Text>
                                        <Text className="text-[10px] font-bold text-slate-800">{formatPHP(reportData?.expenses.otherFarmCosts.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-3 bg-slate-50 px-2 rounded mt-2">
                                        <Text className="text-xs font-bold text-slate-900">Total Farm Production Costs</Text>
                                        <Text className="text-xs font-bold text-slate-900">{formatPHP(reportData?.expenses.farmProductionCosts.current)}</Text>
                                    </View>
                                </View>
                            )}

                            {selectedNote === 16 && (
                                <View>
                                    <Text className="text-slate-900 font-black text-xs uppercase mb-3">Administrative Costs</Text>
                                    <Text className="text-xs text-gray-600 leading-relaxed mb-4">
                                        Regular operating and administrative disbursements incurred in managing the cooperative.
                                    </Text>
                                    <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                                        <Text className="text-[10px] text-gray-700">Salaries and Wages</Text>
                                        <Text className="text-[10px] font-bold text-slate-800">{formatPHP(reportData?.expenses.salaries.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                                        <Text className="text-[10px] text-gray-700">Office Expenses</Text>
                                        <Text className="text-[10px] font-bold text-slate-800">{formatPHP(reportData?.expenses.office.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                                        <Text className="text-[10px] text-gray-700">Communication Expenses</Text>
                                        <Text className="text-[10px] font-bold text-slate-800">{formatPHP(reportData?.expenses.communication.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                                        <Text className="text-[10px] text-gray-700">Transportation Expenses</Text>
                                        <Text className="text-[10px] font-bold text-slate-800">{formatPHP(reportData?.expenses.transportation.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                                        <Text className="text-[10px] text-gray-700">Depreciation & Amortization</Text>
                                        <Text className="text-[10px] font-bold text-slate-800">{formatPHP(reportData?.expenses.depreciation.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                                        <Text className="text-[10px] text-gray-700">Taxes & Licenses</Text>
                                        <Text className="text-[10px] font-bold text-slate-800">{formatPHP(reportData?.expenses.taxes.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                                        <Text className="text-[10px] text-gray-700">Repairs & Maintenance</Text>
                                        <Text className="text-[10px] font-bold text-slate-800">{formatPHP(reportData?.expenses.repairs.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                                        <Text className="text-[10px] text-gray-700">Training & Development</Text>
                                        <Text className="text-[10px] font-bold text-slate-800">{formatPHP(reportData?.expenses.training.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                                        <Text className="text-[10px] text-gray-700">Professional Fees</Text>
                                        <Text className="text-[10px] font-bold text-slate-800">{formatPHP(reportData?.expenses.professional.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                                        <Text className="text-[10px] text-gray-700">Other Operating Expenses</Text>
                                        <Text className="text-[10px] font-bold text-slate-800">{formatPHP(reportData?.expenses.otherExpenses.current)}</Text>
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                        
                        <Pressable 
                            onPress={() => setSelectedNote(null)}
                            className="bg-slate-800 py-3.5 items-center justify-center active:bg-slate-700"
                        >
                            <Text className="text-white font-bold text-xs">Close Note</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
