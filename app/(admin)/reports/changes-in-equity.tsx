import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CoopFinancialReportService, CdaEquityChanges } from '../../../src/services/CoopFinancialReportService';
import { formatPHP } from '../../../src/utils/currency';
import { COMPANY_NAME_FULL } from '../../../src/constants/brand';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function ChangesInEquityScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [year, setYear] = useState(2025);
    const [reportData, setReportData] = useState<CdaEquityChanges | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await CoopFinancialReportService.getStatementOfChangesInEquity(year);
            setReportData(data);
        } catch (error) {
            console.error('Failed to load Statement of Changes in Equity:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [year])
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
                Statement of Changes in Equity
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
            <Text className="flex-[3] text-left text-white font-bold text-[10px] uppercase">Particulars</Text>
            <Text className="flex-[1.5] text-right text-white font-bold text-[10px] uppercase">{year}</Text>
            <Text className="flex-[1.5] text-right text-white font-bold text-[10px] uppercase">{year - 1}</Text>
        </View>
    );

    const renderSectionHeader = (label: string) => (
        <View className="bg-slate-100 px-4 py-1.5 border-b border-gray-200">
            <Text className="font-black text-[10px] uppercase text-slate-800 tracking-wider">{label}</Text>
        </View>
    );

    const renderRow = (
        label: string,
        current: number,
        prior: number,
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
                className={`flex-row px-4 py-2 border-b border-gray-100 items-center ${
                    isSubtotal ? 'bg-slate-50 border-t border-slate-200' : ''
                }`}
            >
                <Text className={`flex-[3] ${textStyle} ${indent ? 'pl-4' : ''}`} numberOfLines={2}>
                    {label}
                </Text>
                <Text className={`flex-[1.5] text-right ${textStyle}`}>
                    {formatRowAmount(current)}
                </Text>
                <Text className={`flex-[1.5] text-right ${textStyle} text-gray-500`}>
                    {formatRowAmount(prior)}
                </Text>
            </View>
        );
    };

    if (loading && !refreshing && !reportData) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#0F172A" />
                <Text className="text-gray-500 font-medium text-xs mt-3">Computing statement of changes in equity...</Text>
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
                    <Text className="text-lg font-black text-gray-900">Changes in Equity</Text>
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

                            {/* SHARE CAPITAL-COMMON */}
                            {renderSectionHeader('SHARE CAPITAL-COMMON')}
                            {renderRow('Beginning Balance', reportData.shareCapital.beginning, reportData.shareCapital.priorBeginning, false, false, true)}
                            {renderRow('Add: Additional Capital, net of drawings', reportData.shareCapital.additions, reportData.shareCapital.priorAdditions, false, false, true)}
                            {renderRow('Ending balance', reportData.shareCapital.ending, reportData.shareCapital.priorEnding, false, true, true)}

                            {/* STATUTORY FUNDS */}
                            {renderSectionHeader('STATUTORY FUNDS')}

                            {reportData.funds.map((fund, idx) => (
                                <View key={idx}>
                                    <View className="bg-slate-50 px-4 py-1 border-b border-gray-150">
                                        <Text className="font-bold text-[9px] text-slate-700 uppercase tracking-wide">{fund.name}</Text>
                                    </View>
                                    {renderRow('Beginning Balance', fund.beginning, fund.priorBeginning, false, false, true)}
                                    {renderRow('Add: Provisions', fund.additions, fund.priorAdditions, false, false, true)}
                                    {renderRow(fund.fundType === 'education' ? 'Less: Payments for education program' : 'Less: Deductions', -fund.deductions, -fund.priorDeductions, false, false, true)}
                                    {renderRow('Ending Balance', fund.ending, fund.priorEnding, false, true, true)}
                                </View>
                            ))}

                            {renderSectionHeader('TOTAL STATUTORY FUNDS')}
                            {renderRow('TOTAL STATUTORY FUNDS', reportData.totalStatutoryFunds.ending, reportData.totalStatutoryFunds.priorEnding, true, true)}

                            {renderSectionHeader('TOTAL EQUITY')}
                            {renderRow('TOTAL EQUITY', reportData.totalEquity.ending, reportData.totalEquity.priorEnding, true, true)}
                        </View>
                    </Animated.View>
                ) : (
                    <View className="p-10 items-center">
                        <MaterialIcons name="error-outline" size={40} color="#D1D5DB" />
                        <Text className="text-gray-700 font-semibold mt-3">No report data found</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
