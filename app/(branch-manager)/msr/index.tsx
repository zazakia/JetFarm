import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Share,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../src/store/AuthContext';
import { MSRService, MonthlyStoreReport } from '../../../src/services/MSRService';
import { formatPHP } from '../../../src/utils/currency';

export default function BranchMSRReportScreen() {
    const router = useRouter();
    const { branchId } = useAuth();
    const activeBranchId = branchId || 'branch-bagacay';

    const [year, setYear] = useState<number>(2026);
    const [month, setMonth] = useState<number>(7); // July 2026 Benchmark
    const [report, setReport] = useState<MonthlyStoreReport | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [exporting, setExporting] = useState<boolean>(false);

    const loadMSR = useCallback(async () => {
        try {
            setLoading(true);
            const data = await MSRService.generateMonthlyStoreReport(activeBranchId, year, month);
            setReport(data);
        } catch (err) {
            console.error('Failed to load MSR:', err);
            Alert.alert('Error', 'Failed to generate Monthly Store Report.');
        } finally {
            setLoading(false);
        }
    }, [activeBranchId, year, month]);

    useEffect(() => {
        loadMSR();
    }, [loadMSR]);

    const handleExportCSV = async () => {
        try {
            setExporting(true);
            const csv = await MSRService.exportMSRToCSV(activeBranchId, year, month);

            if (Platform.OS === 'web') {
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', `MSR_${activeBranchId}_${year}_${month}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                Alert.alert('Export Complete', 'CSV report downloaded successfully.');
            } else {
                await Share.share({
                    title: `MSR Report - ${activeBranchId}`,
                    message: csv,
                });
            }
        } catch (err: any) {
            Alert.alert('Export Failed', err.message || 'Could not export CSV.');
        } finally {
            setExporting(false);
        }
    };

    const isFoodCostHealthy = (report?.cogsRatio || 0) <= 65.0;

    return (
        <View className="flex-1 bg-slate-50">
            {/* Header */}
            <View className="bg-slate-900 px-4 py-3 flex-row justify-between items-center">
                <View>
                    <Text className="text-white text-lg font-bold">Monthly Store Report (MSR)</Text>
                    <Text className="text-slate-400 text-xs">
                        Branch: <Text className="text-white font-semibold">{activeBranchId}</Text> • Period: {year}-{String(month).padStart(2, '0')}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={handleExportCSV}
                    disabled={exporting || loading}
                    className="bg-emerald-600 px-3 py-1.5 rounded-lg flex-row items-center shadow-sm"
                >
                    {exporting ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                        <Text className="text-white font-bold text-xs">⬇ Export CSV</Text>
                    )}
                </TouchableOpacity>
            </View>

            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#0f172a" />
                    <Text className="text-slate-500 mt-2 text-sm">Computing 31-day store rollup...</Text>
                </View>
            ) : !report ? (
                <View className="flex-1 justify-center items-center p-6">
                    <Text className="text-slate-400 text-base font-semibold">No report generated</Text>
                </View>
            ) : (
                <ScrollView className="flex-1 p-3">
                    {/* Top KPI Summary Card */}
                    <View className="bg-white rounded-xl p-4 border border-slate-200 mb-3 shadow-sm">
                        <View className="flex-row justify-between items-start mb-2">
                            <View>
                                <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                    Gross Monthly Sales
                                </Text>
                                <Text className="text-slate-900 text-2xl font-black mt-0.5">
                                    {formatPHP(report.grossSales)}
                                </Text>
                            </View>
                            <View
                                className={`px-2.5 py-1 rounded-full ${
                                    isFoodCostHealthy ? 'bg-emerald-100' : 'bg-rose-100'
                                }`}
                            >
                                <Text
                                    className={`text-xs font-bold ${
                                        isFoodCostHealthy ? 'text-emerald-800' : 'text-rose-800'
                                    }`}
                                >
                                    COGS: {report.cogsRatio.toFixed(2)}% (Target ≤65%)
                                </Text>
                            </View>
                        </View>

                        {/* Breakdown Grid */}
                        <View className="flex-row justify-between pt-3 border-t border-slate-100">
                            <View className="flex-1">
                                <Text className="text-slate-400 text-xs">Cost of Goods (COGS)</Text>
                                <Text className="text-slate-800 font-bold text-sm mt-0.5">
                                    {formatPHP(report.cogs)}
                                </Text>
                            </View>
                            <View className="flex-1">
                                <Text className="text-slate-400 text-xs">Operating Expenses</Text>
                                <Text className="text-slate-800 font-bold text-sm mt-0.5">
                                    {formatPHP(report.opex)}
                                </Text>
                            </View>
                            <View className="flex-1">
                                <Text className="text-slate-400 text-xs">Net Store Profit</Text>
                                <Text className="text-emerald-700 font-black text-sm mt-0.5">
                                    {formatPHP(report.netIncome)}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Benchmark Callout */}
                    <View className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
                        <Text className="text-blue-900 font-bold text-xs">
                            SPI Bagacay Ground-Truth Benchmark Anchor:
                        </Text>
                        <Text className="text-blue-800 text-xs mt-0.5">
                            Gross: ₱512,383.00 | COGS: ₱332,893.88 (64.97%) | OPEX: ₱160,446.22 (31.31%) | Net: ₱19,042.91 (3.72%)
                        </Text>
                    </View>

                    {/* 31-Day Rollup Table */}
                    <View className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                        <View className="bg-slate-100 px-3 py-2.5 flex-row justify-between border-b border-slate-200">
                            <Text className="text-slate-700 font-bold text-xs w-12">Day</Text>
                            <Text className="text-slate-700 font-bold text-xs flex-1">Gross Sales</Text>
                            <Text className="text-slate-700 font-bold text-xs flex-1 text-center">COGS</Text>
                            <Text className="text-slate-700 font-bold text-xs flex-1 text-right">Net Profit</Text>
                        </View>

                        {report.dailyRecords.map((d) => (
                            <View
                                key={d.day}
                                className={`px-3 py-2 flex-row justify-between items-center border-b border-slate-100 ${
                                    d.day % 2 === 0 ? 'bg-slate-50' : 'bg-white'
                                }`}
                            >
                                <Text className="text-slate-600 text-xs font-semibold w-12">
                                    Day {d.day}
                                </Text>
                                <Text className="text-slate-900 text-xs font-medium flex-1">
                                    {formatPHP(d.grossSales)}
                                </Text>
                                <Text className="text-slate-600 text-xs flex-1 text-center">
                                    {formatPHP(d.cogs)}
                                </Text>
                                <Text
                                    className={`text-xs font-bold flex-1 text-right ${
                                        d.netIncome >= 0 ? 'text-emerald-700' : 'text-rose-600'
                                    }`}
                                >
                                    {formatPHP(d.netIncome)}
                                </Text>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            )}
        </View>
    );
}
