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
                        className="p-2 bg-blue-50 rounded-lg active:bg-blue-100 mr-1"
                    >
                        <MaterialIcons name="settings" size={18} color="#1D4ED8" />
                    </Pressable>
                    <Pressable 
                        onPress={() => router.push({ pathname: '/(admin)/reports/surplus-allocation', params: { year } })}
                        className="p-2 bg-emerald-50 rounded-lg active:bg-emerald-100"
                    >
                        <MaterialIcons name="pie-chart" size={18} color="#059669" />
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
                            {renderRow('Income from Credit Operations', 13, reportData.revenues.totalCreditOps.current, reportData.revenues.totalCreditOps.prior, reportData.revenues.totalCreditOps.variance, true)}
                            {renderRow('Interest Income from Loans', null, reportData.revenues.interestOnLoans.current, reportData.revenues.interestOnLoans.prior, reportData.revenues.interestOnLoans.variance, false, false, true)}
                            {renderRow('Service Fees', null, reportData.revenues.serviceCharges.current, reportData.revenues.serviceCharges.prior, reportData.revenues.serviceCharges.variance, false, false, true)}
                            {renderRow('Fines and penalties', null, reportData.revenues.penalties.current, reportData.revenues.penalties.prior, reportData.revenues.penalties.variance, false, false, true)}
                            
                            {renderRow('Other Income', 14, reportData.revenues.totalOtherIncome.current, reportData.revenues.totalOtherIncome.prior, reportData.revenues.totalOtherIncome.variance, true)}
                            {renderRow('Membership Fees', null, reportData.revenues.membershipFees.current, reportData.revenues.membershipFees.prior, reportData.revenues.membershipFees.variance, false, false, true)}
                            {renderRow('Interest income on investments', null, reportData.revenues.interestOnInvestments.current, reportData.revenues.interestOnInvestments.prior, reportData.revenues.interestOnInvestments.variance, false, false, true)}
                            {renderRow('Miscellaneous Income', null, reportData.revenues.miscellaneousIncome.current, reportData.revenues.miscellaneousIncome.prior, reportData.revenues.miscellaneousIncome.variance, false, false, true)}

                            {renderRow('TOTAL REVENUES', null, reportData.revenues.totalRevenues.current, reportData.revenues.totalRevenues.prior, reportData.revenues.totalRevenues.variance, true, true)}

                            {/* EXPENSES */}
                            <View className="bg-slate-100 px-4 py-1.5 border-b border-gray-200 border-t border-gray-200">
                                <Text className="font-black text-[10px] uppercase text-slate-800 tracking-wider">Expenses</Text>
                            </View>
                            {renderRow('Financing Costs', 15, reportData.expenses.financingCosts.current, reportData.expenses.financingCosts.prior, reportData.expenses.financingCosts.variance, true)}
                            {renderRow('Interest on Deposit Liabilities', null, reportData.expenses.financingCosts.current, reportData.expenses.financingCosts.prior, reportData.expenses.financingCosts.variance, false, false, true)}

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

                            {renderRow('NET SURPLUS BEFORE OTHER ITEMS', null, reportData.netSurplus.current, reportData.netSurplus.prior, reportData.netSurplus.variance, true, true)}
                            {renderRow('Less: Loss on Robbery', null, 0, 0, 0, false, false, false)}
                            {renderRow('NET SURPLUS (LOSS) FOR ALLOCATION', null, reportData.netSurplus.current, reportData.netSurplus.prior, reportData.netSurplus.variance, true, true)}

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
                                    <Text className="text-slate-900 font-black text-xs uppercase mb-3">Income from Credit Operations</Text>
                                    <Text className="text-xs text-gray-600 leading-relaxed mb-4">
                                        Revenues generated from loan extensions, processing charges, and fines. Under cooperative rules, credit operations revenue is recognized upon collection (cash basis).
                                    </Text>
                                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                                        <Text className="text-[11px] text-gray-700">Interest Income from Loans</Text>
                                        <Text className="text-[11px] font-bold text-slate-800">{formatPHP(reportData?.revenues.interestOnLoans.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                                        <Text className="text-[11px] text-gray-700">Service Fees</Text>
                                        <Text className="text-[11px] font-bold text-slate-800">{formatPHP(reportData?.revenues.serviceCharges.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                                        <Text className="text-[11px] text-gray-700">Fines and penalties</Text>
                                        <Text className="text-[11px] font-bold text-slate-800">{formatPHP(reportData?.revenues.penalties.current)}</Text>
                                    </View>
                                </View>
                            )}

                            {selectedNote === 14 && (
                                <View>
                                    <Text className="text-slate-900 font-black text-xs uppercase mb-3">Other Income</Text>
                                    <Text className="text-xs text-gray-600 leading-relaxed mb-4">
                                        Income derived from non-lending sources such as member application fees, investments, and miscellaneous receipts.
                                    </Text>
                                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                                        <Text className="text-[11px] text-gray-700">Membership Fees</Text>
                                        <Text className="text-[11px] font-bold text-slate-800">{formatPHP(reportData?.revenues.membershipFees.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                                        <Text className="text-[11px] text-gray-700">Interest Income on Investments</Text>
                                        <Text className="text-[11px] font-bold text-slate-800">{formatPHP(reportData?.revenues.interestOnInvestments.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                                        <Text className="text-[11px] text-gray-700">Miscellaneous Income</Text>
                                        <Text className="text-[11px] font-bold text-slate-800">{formatPHP(reportData?.revenues.miscellaneousIncome.current)}</Text>
                                    </View>
                                </View>
                            )}

                            {selectedNote === 15 && (
                                <View>
                                    <Text className="text-slate-900 font-black text-xs uppercase mb-3">Financing Costs</Text>
                                    <Text className="text-xs text-gray-600 leading-relaxed mb-4">
                                        Cooperative funding costs, specifically interest allocations on member deposit liabilities.
                                    </Text>
                                    <View className="flex-row justify-between py-3 bg-slate-50 px-2 rounded">
                                        <Text className="text-xs font-bold text-slate-900">Interest on Deposit Liabilities</Text>
                                        <Text className="text-xs font-bold text-slate-900">{formatPHP(reportData?.expenses.financingCosts.current)}</Text>
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
