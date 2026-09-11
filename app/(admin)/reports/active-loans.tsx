import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable, Alert , Platform } from 'react-native';
import { DatePicker } from '../../../src/components/DatePicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { MfiKpiService } from '../../../src/services/MfiKpiService';
import { formatPHP } from '../../../src/utils/currency';
import { formatDate } from '../../../src/utils/dates';
import { MaterialIcons } from '@expo/vector-icons';
import ExcelJS from 'exceljs';
import * as FileSystem from 'expo-file-system';

import * as Sharing from 'expo-sharing';

export default function ActiveLoansReportScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [selectedCollector, setSelectedCollector] = useState<string | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const collectors = useMemo(() => {
        const unique = Array.from(new Set(data.map(item => item.collectorName).filter(Boolean)));
        return (unique as string[]).sort();
    }, [data]);

    const filteredData = useMemo(() => {
        return data.filter(item => {
            const matchesCollector = !selectedCollector || item.collectorName === selectedCollector;
            
            let matchesDate = true;
            if (startDate || endDate) {
                if (!item.endDate) {
                    matchesDate = false;
                } else {
                    if (startDate) {
                        const sDate = new Date(startDate).getTime();
                        if (!isNaN(sDate) && item.endDate < sDate) matchesDate = false;
                    }
                    if (endDate) {
                        const eDate = new Date(endDate).getTime();
                        if (!isNaN(eDate)) {
                            const endOfDay = new Date(eDate);
                            endOfDay.setHours(23, 59, 59, 999);
                            if (item.endDate > endOfDay.getTime()) matchesDate = false;
                        }
                    }
                }
            }
            
            return matchesCollector && matchesDate;
        });
    }, [data, selectedCollector, startDate, endDate]);

    const loadData = async () => {
        setLoading(true);
        try {
            const reportData = await MfiKpiService.getActiveLoansReportData();
            setData(reportData);
        } catch (error) {
            console.error('Failed to load active loans:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, []));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    // ─── Totals ──────────────────────────────────────────────────────────────
    const totals = useMemo(() => {
        let loanAmount = 0;
        let loanBalance = 0;
        let notDue = 0;
        let day1_45 = 0;
        let day46_60 = 0;
        let day61_90 = 0;
        let day91_180 = 0;
        let expectedCollected = 0;
        let totalCollected = 0;

        filteredData.forEach(item => {
            loanAmount    += item.loanAmount;
            loanBalance   += item.totalLoanBalance;
            notDue        += item.agings.notDue;
            day1_45       += item.agings.day1_45;
            day46_60      += item.agings.day46_60;
            day61_90      += item.agings.day61_90;
            day91_180     += item.agings.day91_180;
            expectedCollected += item.efficiency.expectedCollected;
            totalCollected    += item.efficiency.totalCollected;
        });

        // Aging grand total — should equal loanBalance
        const agingTotal = notDue + day1_45 + day46_60 + day61_90 + day91_180;

        return { loanAmount, loanBalance, notDue, day1_45, day46_60, day61_90, day91_180, agingTotal, expectedCollected, totalCollected };
    }, [filteredData]);

    const collectionEfficiency = totals.expectedCollected > 0
        ? Math.round((totals.totalCollected / totals.expectedCollected) * 100)
        : 100;

    const bufferToBase64 = (buffer: ArrayBuffer) => {
        const bytes = new Uint8Array(buffer);
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let base64 = '';

        for (let i = 0; i < bytes.length; i += 3) {
            const byte1 = bytes[i];
            const byte2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
            const byte3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
            const triplet = (byte1 << 16) | (byte2 << 8) | byte3;

            base64 += alphabet[(triplet >> 18) & 0x3f];
            base64 += alphabet[(triplet >> 12) & 0x3f];
            base64 += i + 1 < bytes.length ? alphabet[(triplet >> 6) & 0x3f] : '=';
            base64 += i + 2 < bytes.length ? alphabet[triplet & 0x3f] : '=';
        }

        return base64;
    };

    const downloadWebWorkbook = (buffer: ExcelJS.Buffer) => {
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Active_Loans_Collection.xlsx';
        link.click();
        URL.revokeObjectURL(url);
    };

    // ─── Excel Export ─────────────────────────────────────────────────────────
    const handleExport = async () => {
        try {
            const excelData = filteredData.map(item => ({
                'Name Of Client': item.clientName,
                'Address': item.address,
                'Collector': item.collectorName,
                'Loan Amount': item.loanAmount,
                'Total Loan Balance': item.totalLoanBalance,
                'DAY COLLECTION OUTSTANDING': item.dayCollectionOutstanding,
                'Date Release': item.dateRelease ? formatDate(new Date(item.dateRelease)) : '',
                'End date': item.endDate ? formatDate(new Date(item.endDate)) : '',
                'Not Due': item.agings.notDue || '',
                '1-45 Day': item.agings.day1_45 || '',
                '46-60 Day': item.agings.day46_60 || '',
                '61-90 Day': item.agings.day61_90 || '',
                '91-180+ Day': item.agings.day91_180 || '',
                'Aging Total': (item.agings.notDue + item.agings.day1_45 + item.agings.day46_60 + item.agings.day61_90 + item.agings.day91_180) || '',
            }));

            excelData.push({
                'Name Of Client': '',
                'Address': '',
                'Collector': 'GRAND TOTAL',
                'Loan Amount': totals.loanAmount,
                'Total Loan Balance': totals.loanBalance,
                'DAY COLLECTION OUTSTANDING': '',
                'Date Release': '',
                'End date': '',
                'Not Due': totals.notDue,
                '1-45 Day': totals.day1_45,
                '46-60 Day': totals.day46_60,
                '61-90 Day': totals.day61_90,
                '91-180+ Day': totals.day91_180,
                'Aging Total': totals.agingTotal,
            });

            excelData.push({
                'Name Of Client': 'COL EFFICIENCY',
                'Address': '',
                'Collector': '',
                'Loan Amount': '' as any,
                'Total Loan Balance': '' as any,
                'DAY COLLECTION OUTSTANDING': '' as any,
                'Date Release': '',
                'End date': '',
                'Not Due': `${collectionEfficiency}%` as any,
                '1-45 Day': '' as any,
                '46-60 Day': '' as any,
                '61-90 Day': '' as any,
                '91-180+ Day': '' as any,
                'Aging Total': '' as any,
            });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Active Loans');
            worksheet.columns = Object.keys(excelData[0] || {}).map(key => ({
                header: key,
                key,
                width: Math.max(14, key.length + 2),
            }));
            excelData.forEach(row => worksheet.addRow(row));

            if (Platform.OS === 'web') {
                const buffer = await workbook.xlsx.writeBuffer();
                downloadWebWorkbook(buffer);
            } else {
                const wbout = bufferToBase64(await workbook.xlsx.writeBuffer() as ArrayBuffer);
                const uri = (FileSystem as any).cacheDirectory + 'Active_Loans_Collection.xlsx';
                await FileSystem.writeAsStringAsync(uri, wbout, { encoding: (FileSystem as any).EncodingType.Base64 });
                await Sharing.shareAsync(uri, {
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    dialogTitle: 'Export Active Loans Report',
                });
            }
        } catch (error) {
            console.error('Export failed:', error);
            Alert.alert('Export Failed', 'There was an error generating the excel file.');
        }
    };

    if (loading && !refreshing) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50" testID="loading-indicator">
                <ActivityIndicator size="large" color="#D32F2F" />
            </View>
        );
    }

    // ─── Helper to render an aging cell ──────────────────────────────────────
    const AgingCell = ({ value, color = 'text-gray-700', width = 'w-20' }: { value: number; color?: string; width?: string }) => (
        <View className={`${width} p-3 justify-center items-end border-r border-gray-100`}>
            <Text className={`text-xs font-semibold ${color}`}>
                {value > 0 ? formatPHP(value).replace('₱', '') : ''}
            </Text>
        </View>
    );

    const AgingTotalCell = ({ value, color = 'text-gray-900', width = 'w-20', last = false }: { value: number; color?: string; width?: string; last?: boolean }) => (
        <View className={`${width} p-3 justify-center items-end ${last ? '' : 'border-r border-gray-200'}`}>
            <Text className={`text-xs font-black ${color}`}>
                {formatPHP(value).replace('₱', '')}
            </Text>
        </View>
    );

    return (
        <View className="flex-1 bg-gray-50">
            <View className="p-6 pb-2">
                <View className="flex-row justify-between items-center mb-6">
                    <View>
                        <Text className="text-2xl font-black text-gray-900">Active Loans Collection</Text>
                        <Text className="text-gray-700 font-bold uppercase tracking-widest text-[10px] mt-1">
                            Portfolio Collection Overview
                        </Text>
                    </View>
                    <Pressable
                        onPress={handleExport}
                        testID="export-excel"
                        className="bg-green-600 flex-row items-center px-4 py-2 rounded-xl active:bg-green-700 shadow-sm"
                    >
                        <MaterialIcons name="file-download" size={18} color="#fff" className="mr-2" />
                        <Text className="text-white font-bold text-xs uppercase tracking-wider">Export Excel</Text>
                    </Pressable>
                </View>

                {/* Collector filter pills */}
                <View className="mb-4">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                        <Pressable
                            onPress={() => setSelectedCollector(null)}
                            testID="collector-pill-all"
                            className={`px-4 py-2 rounded-full mr-2 border ${!selectedCollector ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-300'}`}
                        >
                            <Text className={`text-xs font-bold ${!selectedCollector ? 'text-white' : 'text-gray-600'}`}>All Collectors</Text>
                        </Pressable>
                        {collectors.map(collector => (
                            <Pressable
                                key={collector}
                                onPress={() => setSelectedCollector(collector)}
                                testID={`collector-pill-${collector}`}
                                className={`px-4 py-2 rounded-full mr-2 border ${selectedCollector === collector ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-300'}`}
                            >
                                <Text className={`text-xs font-bold ${selectedCollector === collector ? 'text-white' : 'text-gray-600'}`}>{collector}</Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>

                {/* Date Range Filter */}
                <View className="flex-row items-center mb-4 space-x-2">
                    <View className="flex-1">
                        <Text className="text-[10px] font-bold text-gray-700 uppercase mb-1 ml-1">End Date From</Text>
                        <DatePicker value={startDate} onChange={setStartDate} placeholder="Select Start Date" onClear={() => setStartDate('')} />
                    </View>
                    <View className="flex-1">
                        <Text className="text-[10px] font-bold text-gray-700 uppercase mb-1 ml-1">End Date To</Text>
                        <DatePicker value={endDate} onChange={setEndDate} placeholder="Select End Date" onClear={() => setEndDate('')} />
                    </View>
                </View>
            </View>

            {/* ── Table ── */}
            <View className="flex-1 px-6 mb-6">
                <View className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden flex-1">
                    <ScrollView horizontal showsHorizontalScrollIndicator={true} bounces={false}>
                        <View className="flex-1">

                            {/* ── Header ── */}
                            <View className="flex-row bg-orange-500 border-b border-gray-200">
                                <View className="w-40 p-3 justify-center border-r border-orange-400"><Text className="text-[10px] font-bold text-white uppercase text-center">Name Of Client</Text></View>
                                <View className="w-56 p-3 justify-center border-r border-orange-400"><Text className="text-[10px] font-bold text-white uppercase text-center">Address</Text></View>
                                <View className="w-32 p-3 justify-center border-r border-orange-400"><Text className="text-[10px] font-bold text-white uppercase text-center">Collector</Text></View>
                                <View className="w-24 p-3 justify-center border-r border-orange-400"><Text className="text-[10px] font-bold text-white uppercase text-center">Loan Amount</Text></View>
                                <View className="w-24 p-3 justify-center border-r border-orange-400"><Text className="text-[10px] font-bold text-white uppercase text-center">Total Loan Balance</Text></View>
                                <View className="w-24 p-2 justify-center border-r border-orange-400"><Text className="text-[9px] font-bold text-white uppercase text-center">Day Collection Outstanding</Text></View>
                                <View className="w-24 p-3 justify-center border-r border-orange-400"><Text className="text-[10px] font-bold text-white uppercase text-center">Date Release</Text></View>
                                <View className="w-24 p-3 justify-center border-r border-orange-400"><Text className="text-[10px] font-bold text-white uppercase text-center">End date</Text></View>
                                {/* ── Aging Columns (mutually exclusive — sum = Total Loan Balance) ── */}
                                <View className="w-24 p-3 justify-center border-r border-orange-400"><Text className="text-[10px] font-bold text-white uppercase text-center">Not Due</Text></View>
                                <View className="w-20 p-3 justify-center border-r border-orange-400"><Text className="text-[10px] font-bold text-white uppercase text-center">1-45 Day</Text></View>
                                <View className="w-20 p-3 justify-center border-r border-orange-400"><Text className="text-[10px] font-bold text-white uppercase text-center">46-60 Day</Text></View>
                                <View className="w-20 p-3 justify-center border-r border-orange-400"><Text className="text-[10px] font-bold text-white uppercase text-center">61-90 Day</Text></View>
                                <View className="w-20 p-3 justify-center border-r border-orange-400"><Text className="text-[10px] font-bold text-white uppercase text-center">91-180+ Day</Text></View>
                                <View className="w-24 p-3 justify-center"><Text className="text-[10px] font-bold text-white uppercase text-center">Aging Total</Text></View>
                            </View>

                            {/* ── Body ── */}
                            <ScrollView
                                className="flex-1"
                                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                            >
                                {filteredData.map((item, idx) => {
                                    const agingTotal = item.agings.notDue + item.agings.day1_45 + item.agings.day46_60 + item.agings.day61_90 + item.agings.day91_180;
                                    return (
                                        <View key={item.id ?? `${item.clientName}-${idx}`} className={`flex-row border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                            <View className="w-40 p-3 justify-center border-r border-gray-100">
                                                <Pressable onPress={() => item.borrowerId && router.push(`/(admin)/borrowers/${item.borrowerId}`)}>
                                                    <Text className="text-xs text-blue-700 underline leading-tight" numberOfLines={2}>{item.clientName}</Text>
                                                </Pressable>
                                            </View>
                                            <View className="w-56 p-3 justify-center border-r border-gray-100"><Text className="text-xs text-gray-600 leading-tight" numberOfLines={2}>{item.address}</Text></View>
                                            <View className="w-32 p-3 justify-center border-r border-gray-100"><Text className="text-xs font-bold text-gray-900 tracking-tight" numberOfLines={1}>{item.collectorName}</Text></View>
                                            <View className="w-24 p-3 justify-center items-end border-r border-gray-100"><Text className="text-xs font-bold text-gray-900">{formatPHP(item.loanAmount).replace('₱', '')}</Text></View>
                                            <View className="w-24 p-3 justify-center items-end border-r border-gray-100"><Text className="text-xs font-bold text-gray-900">{formatPHP(item.totalLoanBalance).replace('₱', '')}</Text></View>
                                            <View className="w-24 p-3 justify-center items-center border-r border-gray-100"><Text className="text-xs text-gray-900 font-medium">{item.dayCollectionOutstanding}</Text></View>
                                            <View className="w-24 p-3 justify-center items-center border-r border-gray-100"><Text className="text-[11px] text-gray-600 font-bold">{item.dateRelease ? formatDate(new Date(item.dateRelease)) : '—'}</Text></View>
                                            <View className="w-24 p-3 justify-center items-center border-r border-gray-100"><Text className="text-[11px] text-gray-600 font-bold">{item.endDate ? formatDate(new Date(item.endDate)) : '—'}</Text></View>
                                            {/* Aging — 5 mutually exclusive buckets */}
                                            <View className="w-24 p-3 justify-center items-end border-r border-gray-100"><Text className="text-xs font-semibold text-green-700">{item.agings.notDue > 0 ? formatPHP(item.agings.notDue).replace('₱', '') : ''}</Text></View>
                                            <AgingCell value={item.agings.day1_45} color="text-yellow-700" />
                                            <AgingCell value={item.agings.day46_60} color="text-orange-600" />
                                            <AgingCell value={item.agings.day61_90} color="text-red-600" />
                                            <AgingCell value={item.agings.day91_180} color="text-red-900" />
                                            {/* Aging Total — should equal Total Loan Balance */}
                                            <View className="w-24 p-3 justify-center items-end">
                                                <Text className="text-xs font-bold text-indigo-700">{agingTotal > 0 ? formatPHP(agingTotal).replace('₱', '') : ''}</Text>
                                            </View>
                                        </View>
                                    );
                                })}

                                {filteredData.length === 0 && (
                                    <View className="p-10 justify-center items-center w-full">
                                        <MaterialIcons name="grid-off" size={32} color="#D1D5DB" />
                                        <Text className="text-gray-700 font-medium mt-3">No active loans found</Text>
                                    </View>
                                )}

                                {/* ── Grand Totals Row ── */}
                                {filteredData.length > 0 && (
                                    <>
                                        <View className="flex-row bg-gray-50 border-t-2 border-gray-300">
                                            <View className="w-40 p-3 justify-center border-r border-gray-200"><Text className="text-[10px] font-black text-gray-700 uppercase">Grand Total</Text></View>
                                            <View className="w-56 p-3 justify-center border-r border-gray-200" />
                                            <View className="w-32 p-3 justify-center border-r border-gray-200" />
                                            {/* Loan Amount */}
                                            <View className="w-24 p-3 justify-center items-end border-r border-gray-200"><Text className="text-xs font-black text-gray-900">{formatPHP(totals.loanAmount).replace('₱', '')}</Text></View>
                                            {/* Total Loan Balance */}
                                            <View className="w-24 p-3 justify-center items-end border-r border-gray-200"><Text className="text-xs font-black text-gray-900">{formatPHP(totals.loanBalance).replace('₱', '')}</Text></View>
                                            <View className="w-24 p-3 justify-center border-r border-gray-200" />
                                            <View className="w-24 p-3 justify-center border-r border-gray-200" />
                                            <View className="w-24 p-3 justify-center border-r border-gray-200" />
                                            {/* Aging totals */}
                                            <View className="w-24 p-3 justify-center items-end border-r border-gray-200"><Text className="text-xs font-black text-green-700">{formatPHP(totals.notDue).replace('₱', '')}</Text></View>
                                            <AgingTotalCell value={totals.day1_45} color="text-yellow-700" />
                                            <AgingTotalCell value={totals.day46_60} color="text-orange-600" />
                                            <AgingTotalCell value={totals.day61_90} color="text-red-600" />
                                            <AgingTotalCell value={totals.day91_180} color="text-red-900" />
                                            {/* Aging Grand Total */}
                                            <View className="w-24 p-3 justify-center items-end">
                                                <Text className="text-xs font-black text-indigo-700">{formatPHP(totals.agingTotal).replace('₱', '')}</Text>
                                            </View>
                                        </View>

                                        {/* Collection Efficiency Row */}
                                        <View className="flex-row bg-white border-t border-gray-100">
                                            <View className="w-40 p-3 justify-center border-r border-gray-100" />
                                            <View className="w-56 p-3 justify-center border-r border-gray-100" />
                                            <View className="w-32 p-3 justify-center border-r border-gray-100" />
                                            <View className="w-24 p-3 justify-center border-r border-gray-100"><Text className="text-[10px] font-bold text-gray-900 uppercase">COL EFFICIEN</Text></View>
                                            <View className="w-24 p-3 justify-center border-r border-gray-100" />
                                            <View className="w-24 p-3 justify-center border-r border-gray-100" />
                                            <View className="w-24 p-3 justify-center border-r border-gray-100" />
                                            <View className="w-24 p-3 justify-center border-r border-gray-100" />
                                            <View className="w-24 p-3 justify-center items-center border-r border-gray-100 bg-yellow-300">
                                                <Text className="text-sm font-black text-gray-900 text-center">{collectionEfficiency}%</Text>
                                            </View>
                                            <View className="w-20 p-3 justify-center border-r border-gray-100" />
                                            <View className="w-20 p-3 justify-center border-r border-gray-100" />
                                            <View className="w-20 p-3 justify-center border-r border-gray-100" />
                                            <View className="w-20 p-3 justify-center border-r border-gray-100" />
                                            <View className="w-24 p-3 justify-center" />
                                        </View>
                                    </>
                                )}
                            </ScrollView>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </View>
    );
}
