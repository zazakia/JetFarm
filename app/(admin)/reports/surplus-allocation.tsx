import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CoopFinancialReportService } from '../../../src/services/CoopFinancialReportService';
import { formatPHP } from '../../../src/utils/currency';
import { MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export default function SurplusAllocationScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const year = params.year ? parseInt(params.year as string) : 2025;

    const [loading, setLoading] = useState(true);
    const [allocating, setAllocating] = useState(false);
    const [netSurplus, setNetSurplus] = useState(0);

    // Distribution percentages from POS Cursor policy:
    // 30% statutory funds, 70% member distribution split 70/30 into ISC/PR.
    const [pctReserve, setPctReserve] = useState('10');
    const [pctEducation, setPctEducation] = useState('10');
    const [pctUnion, setPctUnion] = useState('0');
    const [pctCommunity, setPctCommunity] = useState('3');
    const [pctOptional, setPctOptional] = useState('7');
    const [pctInterestCapital, setPctInterestCapital] = useState('49');
    const [pctPatronage, setPctPatronage] = useState('21');

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await CoopFinancialReportService.getStatementOfOperations(year);
            setNetSurplus(data.netSurplus.current);
        } catch (error) {
            console.error('Failed to load Net Surplus:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [year])
    );

    // Dynamic calculations
    const parsePct = (val: string) => parseFloat(val) || 0;

    const reserveAmt = Math.round(netSurplus * (parsePct(pctReserve) / 100) * 100) / 100;
    const educationAmt = Math.round(netSurplus * (parsePct(pctEducation) / 100) * 100) / 100;
    const unionAmt = Math.round(netSurplus * (parsePct(pctUnion) / 100) * 100) / 100;
    const communityAmt = Math.round(netSurplus * (parsePct(pctCommunity) / 100) * 100) / 100;
    const optionalAmt = Math.round(netSurplus * (parsePct(pctOptional) / 100) * 100) / 100;
    const interestCapitalAmt = Math.round(netSurplus * (parsePct(pctInterestCapital) / 100) * 100) / 100;
    const patronageAmt = Math.round(netSurplus * (parsePct(pctPatronage) / 100) * 100) / 100;

    const totalAllocated = reserveAmt + educationAmt + unionAmt + communityAmt + optionalAmt + interestCapitalAmt + patronageAmt;
    const totalPercentage = parsePct(pctReserve) + parsePct(pctEducation) + parsePct(pctUnion) + parsePct(pctCommunity) + parsePct(pctOptional) + parsePct(pctInterestCapital) + parsePct(pctPatronage);
    const isBalanced = Math.abs(totalPercentage - 100) < 0.01;

    const handleAllocate = async () => {
        if (!isBalanced) {
            Alert.alert('Error', 'Total distribution percentage must equal exactly 100%.');
            return;
        }

        Alert.alert(
            'Confirm Distribution',
            `Are you sure you want to distribute ₱${netSurplus.toFixed(2)} of Net Surplus? This will post closing journal entries for Statutory Funds.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Allocate',
                    onPress: async () => {
                        setAllocating(true);
                        try {
                            const allocations = [
                                { type: 'reserve', percentage: parsePct(pctReserve), amount: reserveAmt },
                                { type: 'education', percentage: parsePct(pctEducation), amount: educationAmt },
                                { type: 'union_federation', percentage: parsePct(pctUnion), amount: unionAmt },
                                { type: 'community_dev', percentage: parsePct(pctCommunity), amount: communityAmt },
                                { type: 'optional', percentage: parsePct(pctOptional), amount: optionalAmt },
                                { type: 'interest_on_capital', percentage: parsePct(pctInterestCapital), amount: interestCapitalAmt },
                                { type: 'patronage_refund', percentage: parsePct(pctPatronage), amount: patronageAmt },
                            ];
                            await CoopFinancialReportService.allocateSurplus(year, netSurplus, allocations, 'Admin');

                            Toast.show({
                                type: 'success',
                                text1: 'Surplus Distributed',
                                text2: 'Closing journal entries posted successfully.',
                            });
                            router.back();
                        } catch (error: any) {
                            Alert.alert('Allocation Failed', error.message || 'An error occurred.');
                        } finally {
                            setAllocating(false);
                        }
                    }
                }
            ]
        );
    };

    const renderFundRow = (
        label: string,
        pctValue: string,
        setPct: (val: string) => void,
        amount: number
    ) => (
        <View className="flex-row items-center justify-between border-b border-gray-100 py-3">
            <Text className="text-gray-700 text-xs flex-[2.5] font-semibold">{label}</Text>
            <View className="flex-row items-center flex-[1.5] justify-end mr-3">
                <TextInput
                    value={pctValue}
                    onChangeText={setPct}
                    keyboardType="numeric"
                    className="bg-gray-100 rounded px-2 py-1 text-xs text-right font-black text-slate-800 w-12 border border-gray-200"
                />
                <Text className="text-gray-500 text-xs ml-1">%</Text>
            </View>
            <Text className="text-slate-900 font-bold text-xs flex-[1.25] text-right">
                {formatPHP(amount).replace('PHP ', '')}
            </Text>
        </View>
    );

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#059669" />
                <Text className="text-gray-500 font-medium text-xs mt-3">Computing surplus metrics...</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            {/* Toolbar */}
            <View className="flex-row justify-between items-center px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
                <View className="flex-row items-center">
                    <Pressable onPress={() => router.back()} className="p-2 mr-2 rounded-full active:bg-gray-150">
                        <MaterialIcons name="arrow-back" size={20} color="#334155" />
                    </Pressable>
                    <Text className="text-lg font-black text-gray-900">Surplus Distribution</Text>
                </View>
                <Text className="font-black text-slate-500 text-sm">FY {year}</Text>
            </View>

            <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Net Surplus Card */}
                <View className="bg-emerald-900 p-6 rounded-2xl shadow-sm border border-emerald-800 mb-6">
                    <Text className="text-emerald-100 font-bold uppercase tracking-wider text-[10px]">Computed Net Surplus for {year}</Text>
                    <Text className="text-white font-black text-3xl mt-1">{formatPHP(netSurplus)}</Text>
                    <Text className="text-emerald-200 text-[10px] mt-1.5 italic">
                        Derived dynamically from Credit Operations & Administrative Expenses.
                    </Text>
                </View>

                {/* Distribution Form */}
                <View className="bg-white p-5 rounded-2xl border border-gray-250 shadow-sm mb-6">
                    <Text className="text-slate-900 font-black text-sm uppercase mb-4 border-b border-gray-100 pb-2">
                        RA 9520 Statutory Split Config
                    </Text>
                    
                    {renderFundRow('Reserve Fund', pctReserve, setPctReserve, reserveAmt)}
                    {renderFundRow('Education & Training Fund', pctEducation, setPctEducation, educationAmt)}
                    {renderFundRow('Due to Union / Federation', pctUnion, setPctUnion, unionAmt)}
                    {renderFundRow('Community Development Fund', pctCommunity, setPctCommunity, communityAmt)}
                    {renderFundRow('Optional Fund', pctOptional, setPctOptional, optionalAmt)}
                    {renderFundRow('Interest on Share Capital Payable', pctInterestCapital, setPctInterestCapital, interestCapitalAmt)}
                    {renderFundRow('Patronage Refund Payable', pctPatronage, setPctPatronage, patronageAmt)}

                    {/* Summary Row */}
                    <View className="flex-row items-center justify-between mt-4 py-3 bg-slate-50 px-2 rounded">
                        <Text className="text-slate-900 font-bold text-xs flex-[2.5]">Total Allocated</Text>
                        <Text className={`text-xs font-black text-right flex-[1.5] mr-4 ${isBalanced ? 'text-emerald-700' : 'text-red-600'}`}>
                            {totalPercentage}%
                        </Text>
                        <Text className="text-slate-900 font-black text-xs flex-[1.25] text-right">
                            {formatPHP(totalAllocated).replace('PHP ', '')}
                        </Text>
                    </View>
                </View>

                {/* Information Callout */}
                <View className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex-row items-start">
                    <MaterialIcons name="info" size={18} color="#1D4ED8" style={{ marginTop: 2, marginRight: 8 }} />
                    <Text className="text-blue-800 text-[11px] leading-relaxed flex-1">
                        Allocating surplus will debit <Text className="font-bold">Retained Surplus (3060)</Text> and credit the respective statutory liability and fund balance accounts at the end of the year.
                    </Text>
                </View>
            </ScrollView>

            {/* Bottom Actions */}
            <View className="p-4 bg-white border-t border-gray-200">
                <Pressable
                    onPress={handleAllocate}
                    disabled={allocating || !isBalanced}
                    className={`bg-emerald-800 py-3.5 rounded-xl items-center flex-row justify-center active:bg-emerald-700 ${
                        allocating || !isBalanced ? 'opacity-50' : ''
                    }`}
                >
                    {allocating ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <MaterialIcons name="done-all" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text className="text-white font-bold text-sm">Post Surplus Allocation</Text>
                        </>
                    )}
                </Pressable>
            </View>
        </View>
    );
}
