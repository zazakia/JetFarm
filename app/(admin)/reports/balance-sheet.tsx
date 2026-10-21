import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable, Modal } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CoopFinancialReportService, CdaBalanceSheet } from '../../../src/services/CoopFinancialReportService';
import { BusinessUnitService } from '../../../src/services/BusinessUnitService';
import { formatPHP } from '../../../src/utils/currency';
import { format } from 'date-fns';
import { COMPANY_NAME_FULL } from '../../../src/constants/brand';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function BalanceSheetScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [year, setYear] = useState(2025);
    const [reportData, setReportData] = useState<CdaBalanceSheet | null>(null);
    const [selectedNote, setSelectedNote] = useState<number | null>(null);
    const [businessUnits, setBusinessUnits] = useState<any[]>([]);
    const [selectedBu, setSelectedBu] = useState<string | undefined>(undefined);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await CoopFinancialReportService.getStatementOfFinancialCondition(year, selectedBu);
            setReportData(data);

            const buList = await BusinessUnitService.getAll();
            setBusinessUnits(buList.filter(bu => bu.isActive));
        } catch (error) {
            console.error('Failed to load Balance Sheet:', error);
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
            <Text className="text-center text-[10px] text-gray-600">
                CDA Certificate of Registration No. 9520-1080000000036399
            </Text>
            <Text className="text-center text-[10px] text-gray-600">
                TAX IDENTIFICATION NUMBER 705-213-220-000
            </Text>
            
            <View className="h-px bg-gray-200 w-full my-3" />
            
            <Text className="font-bold text-gray-950 text-base uppercase tracking-widest">
                Statement of Financial Condition
            </Text>
            <Text className="text-[11px] font-semibold text-gray-600 mt-0.5">
                As of December 31, {year}
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
                <Text className="text-gray-500 font-medium text-xs mt-3">Computing balance sheet from ledger...</Text>
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
                    <Text className="text-lg font-black text-gray-900">Financial Reports</Text>
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

                            {/* ASSETS SECTION */}
                            <View className="bg-slate-100 px-4 py-1.5 border-b border-gray-200">
                                <Text className="font-black text-[10px] uppercase text-slate-800 tracking-wider">Assets</Text>
                            </View>
                            {renderRow('CURRENT ASSETS', null, 0, 0, 0, true)}
                            {renderRow('Cash and cash equivalents', 5, reportData.assets.cashOnHand.current + reportData.assets.cashInBank.current, reportData.assets.cashOnHand.prior + reportData.assets.cashInBank.prior, reportData.assets.cashOnHand.variance + reportData.assets.cashInBank.variance, false, false, true)}
                            {renderRow('Standing Crops, Produce & Farm Inputs', 6, reportData.assets.farmAssets.current, reportData.assets.farmAssets.prior, reportData.assets.farmAssets.variance, false, false, true)}
                            {renderRow('Other Receivables', 7, reportData.assets.otherReceivables.current, reportData.assets.otherReceivables.prior, reportData.assets.otherReceivables.variance, false, false, true)}
                            {renderRow('Total Current Assets', null, reportData.assets.totalCurrentAssets.current, reportData.assets.totalCurrentAssets.prior, reportData.assets.totalCurrentAssets.variance, false, true)}

                            {renderRow('NON-CURRENT ASSETS', null, 0, 0, 0, true)}
                            {renderRow('Other Non-Current Assets', 8, reportData.assets.sundryAssets.current, reportData.assets.sundryAssets.prior, reportData.assets.sundryAssets.variance, false, false, true)}
                            {renderRow('Total Non-Current Assets', null, reportData.assets.totalNonCurrentAssets.current, reportData.assets.totalNonCurrentAssets.prior, reportData.assets.totalNonCurrentAssets.variance, false, true)}
                            
                            {renderRow('TOTAL ASSETS', null, reportData.assets.totalAssets.current, reportData.assets.totalAssets.prior, reportData.assets.totalAssets.variance, true, true)}

                            {/* LIABILITIES AND EQUITY SECTION */}
                            <View className="bg-slate-100 px-4 py-1.5 border-b border-gray-200 border-t border-gray-200">
                                <Text className="font-black text-[10px] uppercase text-slate-800 tracking-wider">Liabilities and Equity</Text>
                            </View>
                            {renderRow('LIABILITIES', null, 0, 0, 0, true)}
                            {renderRow('CURRENT LIABILITIES', null, 0, 0, 0, true)}
                            {renderRow('Land-Owner Settlements Payable', 9, reportData.liabilities.settlementsPayable.current, reportData.liabilities.settlementsPayable.prior, reportData.liabilities.settlementsPayable.variance, false, false, true)}
                            {renderRow('Field Labor Payable', 10, reportData.liabilities.laborPayable.current, reportData.liabilities.laborPayable.prior, reportData.liabilities.laborPayable.variance, false, false, true)}
                            {renderRow('Accounts Payable', 11, reportData.liabilities.accountsPayable.current, reportData.liabilities.accountsPayable.prior, reportData.liabilities.accountsPayable.variance, false, false, true)}
                            {renderRow('Other Payables', null, reportData.liabilities.otherPayables.current, reportData.liabilities.otherPayables.prior, reportData.liabilities.otherPayables.variance, false, false, true)}
                            {renderRow('Total Current Liabilities', null, reportData.liabilities.totalCurrentLiabilities.current, reportData.liabilities.totalCurrentLiabilities.prior, reportData.liabilities.totalCurrentLiabilities.variance, false, true)}
                            {renderRow('TOTAL LIABILITIES', null, reportData.liabilities.totalLiabilities.current, reportData.liabilities.totalLiabilities.prior, reportData.liabilities.totalLiabilities.variance, true, true)}

                            {/* EQUITY SECTION */}
                            <View className="bg-slate-50 px-4 py-1.5 border-b border-gray-200 border-t border-gray-200">
                                <Text className="font-black text-[10px] uppercase text-slate-700 tracking-wider">Equity</Text>
                            </View>
                            {renderRow('Share Capital — Common', null, 0, 0, 0, true)}
                            
                            <View className="px-4 py-1.5 border-b border-gray-100 bg-slate-50/50">
                                <Text className="text-[10px] text-gray-500 italic">
                                    Auth. Capital, common @ P100 par: {formatPHP(reportData.equity.authorizedCapital).replace('PHP ', '')} (FY {year}) | {formatPHP(reportData.equity.priorAuthorizedCapital).replace('PHP ', '')} (FY {year - 1})
                                </Text>
                            </View>
                            
                            {renderRow('Subscribed capital', null, reportData.equity.subscribedCapital.current, reportData.equity.subscribedCapital.prior, reportData.equity.subscribedCapital.variance, false, false, true)}
                            {renderRow('Less: Subscription Receivable', null, -reportData.equity.subscriptionReceivable.current, -reportData.equity.subscriptionReceivable.prior, -reportData.equity.subscriptionReceivable.variance, false, false, true)}
                            {renderRow('Paid up capital', null, reportData.equity.paidUpCapital.current, reportData.equity.paidUpCapital.prior, reportData.equity.paidUpCapital.variance, false, true)}
                            {renderRow('Project & Partner Equity', null, reportData.equity.projectEquity.current, reportData.equity.projectEquity.prior, reportData.equity.projectEquity.variance, false, false, true)}
                            {renderRow('Statutory Funds', 12, reportData.equity.totalStatutoryFunds.current, reportData.equity.totalStatutoryFunds.prior, reportData.equity.totalStatutoryFunds.variance, false, false, true)}
                            {renderRow('Retained Surplus', null, reportData.equity.retainedSurplus.current, reportData.equity.retainedSurplus.prior, reportData.equity.retainedSurplus.variance, false, false, true)}
                            {renderRow('TOTAL EQUITY', null, reportData.equity.totalEquity.current, reportData.equity.totalEquity.prior, reportData.equity.totalEquity.variance, true, true)}
                            
                            {renderRow('TOTAL LIABILITIES AND EQUITY', null, reportData.totalLiabilitiesAndEquity.current, reportData.totalLiabilitiesAndEquity.prior, reportData.totalLiabilitiesAndEquity.variance, true, true)}
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
                            {selectedNote === 5 && (
                                <View>
                                    <Text className="text-slate-900 font-black text-xs uppercase mb-3">Cash and cash equivalents</Text>
                                    <Text className="text-xs text-gray-600 leading-relaxed mb-4">
                                        This account consists of cash holdings on hand and balances in bank accounts. Cash equivalents are measured at face value.
                                    </Text>
                                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                                        <Text className="text-[11px] text-gray-700">Cash on Hand</Text>
                                        <Text className="text-[11px] font-bold text-slate-800">{formatPHP(reportData?.assets.cashOnHand.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                                        <Text className="text-[11px] text-gray-700">Cash in Bank</Text>
                                        <Text className="text-[11px] font-bold text-slate-800">{formatPHP(reportData?.assets.cashInBank.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-3 bg-slate-50 px-2 rounded mt-2">
                                        <Text className="text-xs font-bold text-slate-900">Total Cash</Text>
                                        <Text className="text-xs font-bold text-slate-900">{formatPHP((reportData?.assets.cashOnHand.current ?? 0) + (reportData?.assets.cashInBank.current ?? 0))}</Text>
                                    </View>
                                </View>
                            )}

                            {selectedNote === 6 && (
                                <View>
                                    <Text className="text-slate-900 font-black text-xs uppercase mb-3">Standing Crops, Produce &amp; Farm Inputs</Text>
                                    <Text className="text-xs text-gray-600 leading-relaxed mb-4">
                                        Biological assets carried at the accumulated production cost of the crop cycles still in the ground, produce weighed in and not yet sold, and farm inputs issued to the parcels and not yet consumed.
                                    </Text>
                                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                                        <Text className="text-[11px] text-gray-700">Account codes 1240, 1245, 1246</Text>
                                        <Text className="text-[11px] font-bold text-slate-800">{formatPHP(reportData?.assets.farmAssets.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                                        <Text className="text-[11px] text-gray-700">Split by cycle</Text>
                                        <Text className="text-[11px] font-bold text-gray-500">See Notes to Financial Statements</Text>
                                    </View>
                                    <View className="flex-row justify-between py-3 bg-slate-50 px-2 rounded mt-2">
                                        <Text className="text-xs font-bold text-slate-900">Total Farm Assets</Text>
                                        <Text className="text-xs font-bold text-slate-900">{formatPHP(reportData?.assets.farmAssets.current)}</Text>
                                    </View>
                                </View>
                            )}

                            {selectedNote === 7 && (
                                <View>
                                    <Text className="text-slate-900 font-black text-xs uppercase mb-3">Other Receivables</Text>
                                    <Text className="text-xs text-gray-600 leading-relaxed mb-4">
                                        Amounts due to the enterprise from buyers, off-takers and other counterparties that are not harvest-related, together with advances to field operations awaiting settlement.
                                    </Text>
                                    <View className="flex-row justify-between py-3 bg-slate-50 px-2 rounded">
                                        <Text className="text-xs font-bold text-slate-900">Balance</Text>
                                        <Text className="text-xs font-bold text-slate-900">{formatPHP(reportData?.assets.otherReceivables.current)}</Text>
                                    </View>
                                </View>
                            )}

                            {selectedNote === 8 && (
                                <View>
                                    <Text className="text-slate-900 font-black text-xs uppercase mb-3">Other Non-Current Assets</Text>
                                    <Text className="text-xs text-gray-600 leading-relaxed mb-4">
                                        Sundry assets and adjustments held for long-term farm operations, including equipment and land-development outlays not yet expensed to a crop cycle.
                                    </Text>
                                    <View className="flex-row justify-between py-3 bg-slate-50 px-2 rounded">
                                        <Text className="text-xs font-bold text-slate-900">Sundry Assets</Text>
                                        <Text className="text-xs font-bold text-slate-900">{formatPHP(reportData?.assets.sundryAssets.current)}</Text>
                                    </View>
                                </View>
                            )}

                            {selectedNote === 12 && (
                                <View>
                                    <Text className="text-slate-900 font-black text-xs uppercase mb-3">Statutory Funds</Text>
                                    <Text className="text-xs text-gray-600 leading-relaxed mb-4">
                                        Mandatory cooperative allocations from Net Surplus as prescribed by Republic Act No. 9520 (Philippine Cooperative Code).
                                    </Text>
                                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                                        <Text className="text-[11px] text-gray-700">Reserve Fund</Text>
                                        <Text className="text-[11px] font-bold text-slate-800">{formatPHP(reportData?.equity.reserveFund.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                                        <Text className="text-[11px] text-gray-700">Education Fund</Text>
                                        <Text className="text-[11px] font-bold text-slate-800">{formatPHP(reportData?.equity.educationFund.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                                        <Text className="text-[11px] text-gray-700">Community Dev Fund</Text>
                                        <Text className="text-[11px] font-bold text-slate-800">{formatPHP(reportData?.equity.communityDevFund.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-2 border-b border-gray-100">
                                        <Text className="text-[11px] text-gray-700">Optional Fund</Text>
                                        <Text className="text-[11px] font-bold text-slate-800">{formatPHP(reportData?.equity.optionalFund.current)}</Text>
                                    </View>
                                    <View className="flex-row justify-between py-3 bg-slate-50 px-2 rounded mt-2">
                                        <Text className="text-xs font-bold text-slate-900">Total Statutory Funds</Text>
                                        <Text className="text-xs font-bold text-slate-900">{formatPHP(reportData?.equity.totalStatutoryFunds.current)}</Text>
                                    </View>
                                </View>
                            )}

                            {[9, 10, 11].includes(selectedNote!) && (
                                <View>
                                    <Text className="text-slate-900 font-black text-xs uppercase mb-3">
                                        {selectedNote === 9 ? 'Land-Owner Settlements Payable' : selectedNote === 10 ? 'Field Labor Payable' : 'Accounts Payable'}
                                    </Text>
                                    <Text className="text-xs text-gray-600 leading-relaxed mb-4">
                                        {selectedNote === 9
                                            ? 'The per-kilo payout due to land owners for the harvest weeks weighed in and settled, recognised at the computed payout for the week and discharged from the weekly settlement run.'
                                            : selectedNote === 10
                                            ? 'Wages earned by field workers for work performed and not yet disbursed at the reporting date.'
                                            : 'Supplies, machinery and logistics invoices approved for payment to third-party suppliers.'}
                                    </Text>
                                    <View className="flex-row justify-between py-3 bg-slate-50 px-2 rounded">
                                        <Text className="text-xs font-bold text-slate-900">Balance</Text>
                                        <Text className="text-xs font-bold text-slate-900">
                                            {formatPHP(
                                                selectedNote === 9
                                                    ? reportData?.liabilities.settlementsPayable.current
                                                    : selectedNote === 10
                                                    ? reportData?.liabilities.laborPayable.current
                                                    : reportData?.liabilities.accountsPayable.current
                                            )}
                                        </Text>
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
