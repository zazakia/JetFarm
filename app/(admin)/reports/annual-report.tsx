import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Platform,
} from 'react-native';
import { Stack , useFocusEffect } from 'expo-router';

import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import { formatPHP } from '../../../src/utils/currency';
import { FinancialStatementService, AnnualReportData } from '../../../src/services/FinancialStatementService';
import { buildAnnualReportHtml } from '../../../src/services/annualReportHtml';
import { COMPANY_NAME } from '../../../src/constants/brand';

const CURRENT_YEAR = new Date().getFullYear();

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
    return (
        <View className="flex-row items-center mb-4 mt-2">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-3">
                {label}
            </Text>
            <View className="flex-1 h-px bg-gray-200" />
        </View>
    );
}

function ComparativeRow({ label, current, prior, bold, indent, highlight }: {
    label: string;
    current: number;
    prior: number;
    bold?: boolean;
    indent?: boolean;
    highlight?: 'blue' | 'green' | 'red' | 'purple';
}) {
    const currColor = current >= 0 ? '#111' : '#DC2626';
    const priorColor = prior >= 0 ? '#6B7280' : '#DC2626';
    const labelStyle = bold ? 'font-black text-gray-900' : 'text-gray-600';
    const bgColor = highlight === 'blue' ? 'bg-blue-50' : highlight === 'green' ? 'bg-green-50' : highlight === 'red' ? 'bg-red-50' : highlight === 'purple' ? 'bg-purple-50' : '';

    return (
        <View className={`flex-row items-center py-2 ${bgColor} ${bgColor ? 'px-3 rounded-xl mb-1' : 'border-b border-gray-50'}`}>
            <Text className={`flex-1 text-xs ${labelStyle} ${indent ? 'pl-4' : ''}`}>{label}</Text>
            <View className="items-end ml-4 w-32">
                <Text className={`text-xs ${bold ? 'font-black' : 'font-semibold'}`} style={{ color: currColor }}>
                    {formatPHP(current)}
                </Text>
            </View>
            <View className="items-end ml-2 w-28">
                <Text className="text-xs font-medium text-gray-400" style={{ color: priorColor }}>
                    {formatPHP(prior)}
                </Text>
            </View>
        </View>
    );
}

function StatementCard({ title, icon, color, children }: {
    title: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    color: string;
    children: React.ReactNode;
}) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <Animated.View entering={FadeInDown.springify()} className="bg-white rounded-3xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
            <Pressable
                onPress={() => setCollapsed(c => !c)}
                className="flex-row items-center px-5 py-4"
                style={{ backgroundColor: `${color}10` }}
            >
                <View className="w-9 h-9 rounded-2xl items-center justify-center mr-3" style={{ backgroundColor: color }}>
                    <MaterialIcons name={icon} size={18} color="#fff" />
                </View>
                <Text className="flex-1 text-sm font-black text-gray-900">{title}</Text>
                <MaterialIcons
                    name={collapsed ? 'expand-more' : 'expand-less'}
                    size={20}
                    color="#9CA3AF"
                />
            </Pressable>

            {!collapsed && (
                <View className="px-5 py-4">
                    {/* Column headers */}
                    <View className="flex-row items-center pb-2 border-b border-gray-100 mb-3">
                        <Text className="flex-1 text-[9px] font-black text-gray-400 uppercase tracking-widest">Particulars</Text>
                        <Text className="text-[9px] font-black uppercase tracking-widest w-32 text-right" style={{ color }}>Current Year</Text>
                        <Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest w-28 text-right ml-2">Prior Year</Text>
                    </View>
                    {children}
                </View>
            )}
        </Animated.View>
    );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function AnnualReportScreen() {
    const [year, setYear] = useState(CURRENT_YEAR);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [data, setData] = useState<AnnualReportData | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await FinancialStatementService.getAnnualReportData(year);
            setData(result);
        } catch (err) {
            console.error('[AnnualReport] Failed to load:', err);
            Alert.alert('Error', 'Could not generate the financial report. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, [year]));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleExportPdf = async () => {
        if (!data) return;
        setExporting(true);
        try {
            const html = buildAnnualReportHtml(data);
            const { uri } = await Print.printToFileAsync({
                html,
                base64: false,
            });

            if (Platform.OS === 'web') {
                Alert.alert('PDF Generated', 'The report has been generated.');
            } else {
                const canShare = await Sharing.isAvailableAsync();
                if (canShare) {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'application/pdf',
                        dialogTitle: `Annual Financial Report ${year} — ${COMPANY_NAME}`,
                    });
                } else {
                    Alert.alert('PDF Saved', `Report saved to: ${uri}`);
                }
            }
        } catch (err) {
            console.error('[AnnualReport] PDF export failed:', err);
            Alert.alert('Export Failed', 'Could not generate PDF. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    const fc = data?.financialCondition;
    const act = data?.activities;
    const chg = data?.changesInFundBalance;
    const cf = data?.cashFlows;
    const notes = data?.notes;

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingBottom: 48 }}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Hero Header ── */}
                <View className="bg-blue-900 pt-24 pb-10 px-6 rounded-b-[40px] shadow-xl mb-6">
                    <Text className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">
                        Annual Financial Report
                    </Text>
                    <Text className="text-white text-xl font-black leading-tight mb-1">
                        {COMPANY_NAME}
                    </Text>
                    <Text className="text-white/50 text-[10px] mb-6">
                        P-2, Barangay Linao, Ormoc City, Leyte
                    </Text>

                    {/* Year Navigator */}
                    <View className="flex-row items-center justify-center mb-5">
                        <Pressable
                            onPress={() => setYear(y => y - 1)}
                            className="bg-white/10 rounded-full p-3 mr-4 active:bg-white/20"
                        >
                            <MaterialIcons name="chevron-left" size={20} color="#FFF" />
                        </Pressable>
                        <View className="items-center">
                            <Text className="text-white font-black text-3xl">{year}</Text>
                            <Text className="text-white/50 text-[10px]">
                                vs. {year - 1} (comparative)
                            </Text>
                        </View>
                        <Pressable
                            onPress={() => setYear(y => Math.min(y + 1, CURRENT_YEAR))}
                            className={`bg-white/10 rounded-full p-3 ml-4 active:bg-white/20 ${year >= CURRENT_YEAR ? 'opacity-30' : ''}`}
                            disabled={year >= CURRENT_YEAR}
                        >
                            <MaterialIcons name="chevron-right" size={20} color="#FFF" />
                        </Pressable>
                    </View>

                    <Text className="text-white/50 text-[10px] text-center">
                        As of and for the year ended December 31, {year}
                    </Text>
                    <Text className="text-white/30 text-[9px] text-center mt-1">
                        (With comparative figures as of and for the year ended December 31, {year - 1})
                    </Text>

                    {/* KPI Summary Bar */}
                    {!loading && data && (
                        <Animated.View entering={FadeInDown.springify()} className="flex-row mt-6 gap-2">
                            <View className="flex-1 bg-white/10 rounded-2xl p-3 items-center border border-white/10">
                                <Text className="text-white/60 text-[9px] font-bold uppercase tracking-wider mb-1">Total Assets</Text>
                                <Text className="text-white font-black text-base">
                                    {formatPHP(fc?.assets.totalAssets.current ?? 0)}
                                </Text>
                            </View>
                            <View className="flex-1 bg-white/10 rounded-2xl p-3 items-center border border-white/10">
                                <Text className="text-white/60 text-[9px] font-bold uppercase tracking-wider mb-1">Net Surplus</Text>
                                <Text className={`font-black text-base ${(act?.netSurplus.current ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {formatPHP(act?.netSurplus.current ?? 0)}
                                </Text>
                            </View>
                        </Animated.View>
                    )}
                </View>

                {loading && !refreshing ? (
                    <View className="flex-1 items-center justify-center py-20">
                        <ActivityIndicator size="large" color="#1E3A8A" />
                        <Text className="text-gray-400 text-xs mt-3">Computing financial statements…</Text>
                    </View>
                ) : data ? (
                    <View className="px-4">

                        {/* ── Table of Contents ── */}
                        <Animated.View entering={FadeInDown.delay(50).springify()} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-6">
                            <Text className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Table of Contents</Text>
                            {[
                                { pg: '2–3', label: "Auditor's Opinion" },
                                { pg: '4', label: 'Supplemental Written Statement' },
                                { pg: '5', label: 'Report of Independent CPA' },
                                { pg: '6', label: 'Statement of Financial Condition' },
                                { pg: '7', label: 'Statement of Activities' },
                                { pg: '8', label: 'Statement of Changes in Fund Balance' },
                                { pg: '9', label: 'Statement of Cash Flows' },
                                { pg: '10–21', label: 'Notes to Financial Statements' },
                                { pg: '', label: 'Statement of Management Responsibility' },
                            ].map((item, idx) => (
                                <View key={idx} className="flex-row items-center py-2 border-b border-gray-50">
                                    <Text className="text-[10px] font-black text-blue-900 w-10">{item.pg}</Text>
                                    <Text className="text-xs text-gray-600 italic flex-1">{item.label}</Text>
                                </View>
                            ))}
                        </Animated.View>

                        {/* ── 1. Statement of Financial Condition ── */}
                        <SectionDivider label="Statement of Financial Condition" />
                        {fc && (
                            <StatementCard title="Statement of Financial Condition" icon="account-balance" color="#1E3A8A">
                                <Text className="text-[10px] font-black text-blue-500 uppercase tracking-wider mb-2">Assets</Text>
                                <ComparativeRow label="Cash on Hand" current={fc.assets.cashOnHand.current} prior={fc.assets.cashOnHand.prior} indent />
                                <ComparativeRow label="Cash in Bank" current={fc.assets.cashInBank.current} prior={fc.assets.cashInBank.prior} indent />
                                <ComparativeRow label="Standing Crops, Produce & Farm Inputs" current={fc.assets.farmAssets.current} prior={fc.assets.farmAssets.prior} indent />
                                <ComparativeRow label="Other Receivables" current={fc.assets.otherReceivables.current} prior={fc.assets.otherReceivables.prior} indent />
                                <ComparativeRow label="TOTAL CURRENT ASSETS" current={fc.assets.totalCurrentAssets.current} prior={fc.assets.totalCurrentAssets.prior} bold />
                                <ComparativeRow label="Sundry Assets (Non-Current)" current={fc.assets.sundryAssets.current} prior={fc.assets.sundryAssets.prior} indent />
                                <ComparativeRow label="TOTAL ASSETS" current={fc.assets.totalAssets.current} prior={fc.assets.totalAssets.prior} bold highlight="blue" />

                                <View className="h-px bg-gray-100 my-3" />
                                <Text className="text-[10px] font-black text-red-500 uppercase tracking-wider mb-2">Liabilities</Text>
                                <ComparativeRow label="Land-Owner Settlements Payable" current={fc.liabilities.settlementsPayable.current} prior={fc.liabilities.settlementsPayable.prior} indent />
                                <ComparativeRow label="Field Labor Payable" current={fc.liabilities.laborPayable.current} prior={fc.liabilities.laborPayable.prior} indent />
                                <ComparativeRow label="Accounts Payable" current={fc.liabilities.accountsPayable.current} prior={fc.liabilities.accountsPayable.prior} indent />
                                <ComparativeRow label="Other Payables" current={fc.liabilities.otherPayables.current} prior={fc.liabilities.otherPayables.prior} indent />
                                <ComparativeRow label="TOTAL LIABILITIES" current={fc.liabilities.totalLiabilities.current} prior={fc.liabilities.totalLiabilities.prior} bold highlight="red" />

                                <View className="h-px bg-gray-100 my-3" />
                                <Text className="text-[10px] font-black text-green-600 uppercase tracking-wider mb-2">Fund Balance (Equity)</Text>
                                <ComparativeRow label="Share Capital" current={fc.fundBalance.shareCapital.current} prior={fc.fundBalance.shareCapital.prior} indent />
                                <ComparativeRow label="Project & Partner Equity" current={fc.fundBalance.projectEquity.current} prior={fc.fundBalance.projectEquity.prior} indent />
                                <ComparativeRow label="General Reserve Fund" current={fc.fundBalance.reserveFund.current} prior={fc.fundBalance.reserveFund.prior} indent />
                                <ComparativeRow label="Education & Training Fund" current={fc.fundBalance.educationFund.current} prior={fc.fundBalance.educationFund.prior} indent />
                                <ComparativeRow label="Community Dev. Fund" current={fc.fundBalance.communityDevFund.current} prior={fc.fundBalance.communityDevFund.prior} indent />
                                <ComparativeRow label="Optional Fund" current={fc.fundBalance.optionalFund.current} prior={fc.fundBalance.optionalFund.prior} indent />
                                <ComparativeRow label="Retained Surplus / (Deficit)" current={fc.fundBalance.retainedSurplus.current} prior={fc.fundBalance.retainedSurplus.prior} indent />
                                <ComparativeRow label="TOTAL FUND BALANCE" current={fc.fundBalance.totalFundBalance.current} prior={fc.fundBalance.totalFundBalance.prior} bold highlight="green" />

                                <View className="h-px bg-gray-100 my-3" />
                                <ComparativeRow label="TOTAL LIABILITIES + FUND BALANCE" current={fc.totalLiabilitiesAndFundBalance.current} prior={fc.totalLiabilitiesAndFundBalance.prior} bold highlight="blue" />
                            </StatementCard>
                        )}

                        {/* ── 2. Statement of Activities ── */}
                        <SectionDivider label="Statement of Activities" />
                        {act && (
                            <StatementCard title="Statement of Activities" icon="bar-chart" color="#059669">
                                <Text className="text-[10px] font-black text-green-600 uppercase tracking-wider mb-2">Revenues</Text>
                                <ComparativeRow label="Harvest Off-take Revenue" current={act.revenues.offtakeRevenue.current} prior={act.revenues.offtakeRevenue.prior} indent />
                                <ComparativeRow label="By-product Revenue" current={act.revenues.byproductRevenue.current} prior={act.revenues.byproductRevenue.prior} indent />
                                <ComparativeRow label="Other Income" current={act.revenues.otherIncome.current} prior={act.revenues.otherIncome.prior} indent />
                                <ComparativeRow label="TOTAL REVENUES" current={act.revenues.totalRevenues.current} prior={act.revenues.totalRevenues.prior} bold highlight="green" />

                                <View className="h-px bg-gray-100 my-3" />
                                <Text className="text-[10px] font-black text-red-500 uppercase tracking-wider mb-2">Expenses</Text>
                                <ComparativeRow label="Farm Production Costs" current={act.expenses.farmProductionCosts.current} prior={act.expenses.farmProductionCosts.prior} indent />
                                <ComparativeRow label="Salaries and Wages" current={act.expenses.salariesAndWages.current} prior={act.expenses.salariesAndWages.prior} indent />
                                <ComparativeRow label="Office & Admin Expenses" current={act.expenses.officeExpenses.current} prior={act.expenses.officeExpenses.prior} indent />
                                <ComparativeRow label="Depreciation & Amortization" current={act.expenses.depreciationAndAmortization.current} prior={act.expenses.depreciationAndAmortization.prior} indent />
                                <ComparativeRow label="Other Administrative Expenses" current={act.expenses.otherExpenses.current} prior={act.expenses.otherExpenses.prior} indent />
                                <ComparativeRow label="TOTAL EXPENSES" current={act.expenses.totalExpenses.current} prior={act.expenses.totalExpenses.prior} bold highlight="red" />

                                <View className="h-px bg-gray-100 my-3" />
                                <ComparativeRow
                                    label="NET SURPLUS / (DEFICIT)"
                                    current={act.netSurplus.current}
                                    prior={act.netSurplus.prior}
                                    bold
                                    highlight={act.netSurplus.current >= 0 ? 'green' : 'red'}
                                />
                            </StatementCard>
                        )}

                        {/* ── 3. Statement of Changes in Fund Balance ── */}
                        <SectionDivider label="Changes in Fund Balance" />
                        {chg && (
                            <StatementCard title="Statement of Changes in Fund Balance" icon="show-chart" color="#7C3AED">
                                <ComparativeRow label="Fund Balance, Beginning of Year" current={chg.opening.current} prior={chg.opening.prior} bold />
                                <View className="h-px bg-gray-100 my-2" />

                                <Text className="text-[10px] font-black text-purple-600 uppercase tracking-wider mb-2">Statutory Allocations</Text>
                                <ComparativeRow label="Net Surplus for the Year" current={chg.netSurplusForYear.current} prior={chg.netSurplusForYear.prior} indent />
                                <ComparativeRow label="General Reserve Fund (10%)" current={chg.statutoryAllocations.reserveFund.current} prior={chg.statutoryAllocations.reserveFund.prior} indent />
                                <ComparativeRow label="Education & Training Fund (10%)" current={chg.statutoryAllocations.educationFund.current} prior={chg.statutoryAllocations.educationFund.prior} indent />
                                <ComparativeRow label="Community Dev. Fund (3%)" current={chg.statutoryAllocations.communityDevFund.current} prior={chg.statutoryAllocations.communityDevFund.prior} indent />
                                <ComparativeRow label="Optional Fund (7%)" current={chg.statutoryAllocations.optionalFund.current} prior={chg.statutoryAllocations.optionalFund.prior} indent />
                                <ComparativeRow label="Total Statutory Appropriations" current={chg.statutoryAllocations.totalAllocations.current} prior={chg.statutoryAllocations.totalAllocations.prior} indent />
                                <ComparativeRow label="Surplus Not Appropriated (Retained)" current={chg.unallocatedSurplus.current} prior={chg.unallocatedSurplus.prior} indent />

                                <View className="h-px bg-gray-100 my-2" />
                                <ComparativeRow label="FUND BALANCE, END OF YEAR" current={chg.closing.current} prior={chg.closing.prior} bold highlight="purple" />
                            </StatementCard>
                        )}

                        {/* ── 4. Statement of Cash Flows ── */}
                        <SectionDivider label="Statement of Cash Flows" />
                        {cf && (
                            <StatementCard title="Statement of Cash Flows" icon="waterfall-chart" color="#0F172A">
                                <Text className="text-[10px] font-black text-blue-700 uppercase tracking-wider mb-2">Operating Activities</Text>
                                {cf.operating.items.map((item, idx) => (
                                    <ComparativeRow key={idx} label={item.label} current={item.inflow ? item.current : -item.current} prior={item.inflow ? item.prior : -item.prior} indent />
                                ))}
                                <ComparativeRow label="Net Operating Activities" current={cf.operating.netOperating.current} prior={cf.operating.netOperating.prior} bold />

                                <View className="h-px bg-gray-100 my-2" />
                                <Text className="text-[10px] font-black text-green-600 uppercase tracking-wider mb-2">Investing Activities</Text>
                                {cf.investing.items.map((item, idx) => (
                                    <ComparativeRow key={idx} label={item.label} current={item.inflow ? item.current : -item.current} prior={item.inflow ? item.prior : -item.prior} indent />
                                ))}
                                <ComparativeRow label="Net Investing Activities" current={cf.investing.netInvesting.current} prior={cf.investing.netInvesting.prior} bold />

                                <View className="h-px bg-gray-100 my-2" />
                                <Text className="text-[10px] font-black text-purple-600 uppercase tracking-wider mb-2">Financing Activities</Text>
                                {cf.financing.items.map((item, idx) => (
                                    <ComparativeRow key={idx} label={item.label} current={item.inflow ? item.current : -item.current} prior={item.inflow ? item.prior : -item.prior} indent />
                                ))}
                                <ComparativeRow label="Net Financing Activities" current={cf.financing.netFinancing.current} prior={cf.financing.netFinancing.prior} bold />

                                <View className="h-px bg-gray-100 my-2" />
                                <ComparativeRow label="NET CHANGE IN CASH" current={cf.netChange.current} prior={cf.netChange.prior} bold highlight={cf.netChange.current >= 0 ? 'green' : 'red'} />
                                <ComparativeRow label="Cash, Beginning of Year" current={cf.beginningCash.current} prior={cf.beginningCash.prior} indent />
                                <ComparativeRow label="CASH, END OF YEAR" current={cf.endingCash.current} prior={cf.endingCash.prior} bold highlight="blue" />
                            </StatementCard>
                        )}

                        {/* ── 5. Notes Summary ── */}
                        <SectionDivider label="Notes to Financial Statements" />
                        {notes && (
                            <Animated.View entering={FadeInDown.delay(100).springify()} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4">
                                <Text className="text-xs font-black text-gray-900 mb-4">Key Disclosures — {year}</Text>

                                {/* Farm Operations */}
                                <Text className="text-[10px] font-black text-green-700 uppercase tracking-wider mb-2">Farm Operations</Text>
                                <View className="flex-row justify-between py-1.5 border-b border-gray-50">
                                    <Text className="text-xs text-gray-600">Parcels Under Management</Text>
                                    <Text className="text-xs font-bold text-gray-900">{notes.farmOperations.numberOfParcels.toLocaleString()}</Text>
                                </View>
                                <View className="flex-row justify-between py-1.5 border-b border-gray-50">
                                    <Text className="text-xs text-gray-600">Active Crop Cycles</Text>
                                    <Text className="text-xs font-bold text-gray-900">{notes.farmOperations.activeCropCycles.toLocaleString()}</Text>
                                </View>
                                <View className="flex-row justify-between py-1.5 border-b border-gray-50">
                                    <Text className="text-xs text-gray-600">Actual Harvest (kg)</Text>
                                    <Text className="text-xs font-bold text-gray-900">{notes.farmOperations.actualYieldKg.toLocaleString()}</Text>
                                </View>
                                <View className="flex-row justify-between py-1.5 mb-4 border-b border-gray-50">
                                    <Text className="text-xs text-gray-600">Total Production Cost</Text>
                                    <Text className="text-xs font-bold text-gray-900">{formatPHP(notes.productionCosts.totalProductionCost)}</Text>
                                </View>

                                {/* Investor Participation */}
                                <Text className="text-[10px] font-black text-purple-700 uppercase tracking-wider mb-2">Investor Participation</Text>
                                <View className="flex-row justify-between py-1.5 border-b border-gray-50">
                                    <Text className="text-xs text-gray-600">Capital Injected</Text>
                                    <Text className="text-xs font-bold text-gray-900">{formatPHP(notes.investorParticipation.capitalInjected)}</Text>
                                </View>
                                <View className="flex-row justify-between py-1.5 border-b border-gray-50">
                                    <Text className="text-xs text-gray-600">Off-take Deductions</Text>
                                    <Text className="text-xs font-bold text-gray-900">{formatPHP(notes.investorParticipation.offtakeDeductions)}</Text>
                                </View>
                                <View className="flex-row justify-between py-1.5 mb-4 border-b border-gray-50">
                                    <Text className="text-xs text-gray-600">Net Investor Balance</Text>
                                    <Text className="text-xs font-bold text-gray-900">{formatPHP(notes.investorParticipation.netInvestorBalance)}</Text>
                                </View>

                                {/* Statutory Funds */}
                                <Text className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-2">Statutory Funds</Text>
                                <View className="flex-row justify-between py-1.5 border-b border-gray-50">
                                    <Text className="text-xs text-gray-600">General Reserve Fund (10%)</Text>
                                    <Text className="text-xs font-bold text-gray-900">{formatPHP(notes.statutoryFunds.reserveFund)}</Text>
                                </View>
                                <View className="flex-row justify-between py-1.5 border-b border-gray-50">
                                    <Text className="text-xs text-gray-600">CETF (10%)</Text>
                                    <Text className="text-xs font-bold text-gray-900">{formatPHP(notes.statutoryFunds.educationFund)}</Text>
                                </View>
                                <View className="flex-row justify-between py-1.5 border-b border-gray-50">
                                    <Text className="text-xs text-gray-600">Community Dev. Fund (3%)</Text>
                                    <Text className="text-xs font-bold text-gray-900">{formatPHP(notes.statutoryFunds.communityDevFund)}</Text>
                                </View>
                                <View className="flex-row justify-between py-1.5">
                                    <Text className="text-xs text-gray-600">Optional Fund (7%)</Text>
                                    <Text className="text-xs font-bold text-gray-900">{formatPHP(notes.statutoryFunds.optionalFund)}</Text>
                                </View>

                                <View className="mt-4 bg-gray-50 rounded-2xl p-3">
                                    <Text className="text-[9px] text-gray-400 leading-4">
                                        Full Notes to Financial Statements including accounting policies, related party disclosures, and events after the reporting period are included in the PDF export.
                                    </Text>
                                </View>
                            </Animated.View>
                        )}

                        {/* ── Auditor's Opinion Preview ── */}
                        <SectionDivider label="Auditor's Opinion" />
                        <Animated.View entering={FadeInDown.delay(120).springify()} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-4">
                            <View className="flex-row items-center mb-3">
                                <View className="w-9 h-9 rounded-2xl items-center justify-center mr-3 bg-red-100">
                                    <MaterialIcons name="verified" size={18} color="#C0392B" />
                                </View>
                                <View>
                                    <Text className="text-sm font-black text-gray-900">Independent Auditor's Report</Text>
                                    <Text className="text-[10px] text-gray-400">CDA-compliant boilerplate — customizable in PDF</Text>
                                </View>
                            </View>
                            <Text className="text-xs text-gray-600 leading-5">
                                In our opinion, the accompanying financial statements present fairly, in all material respects, the financial position of <Text className="font-bold">{COMPANY_NAME}</Text> as of December 31, {year}, and its financial performance and cash flows for the year then ended in accordance with PFRS for SMEs and R.A. 9520.
                            </Text>
                            <View className="mt-3 bg-amber-50 rounded-2xl p-3 border border-amber-100">
                                <Text className="text-[9px] text-amber-700 font-bold">
                                    💡 Full Auditor's Opinion with CPA signature lines is included in the PDF export. Have your CPA review and sign the printed copy.
                                </Text>
                            </View>
                        </Animated.View>

                        {/* ── Management Responsibility Preview ── */}
                        <SectionDivider label="Management Responsibility" />
                        <Animated.View entering={FadeInDown.delay(140).springify()} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 mb-6">
                            <View className="flex-row items-center mb-3">
                                <View className="w-9 h-9 rounded-2xl items-center justify-center mr-3 bg-blue-100">
                                    <MaterialIcons name="gavel" size={18} color="#1E3A8A" />
                                </View>
                                <View>
                                    <Text className="text-sm font-black text-gray-900">Statement of Management Responsibility</Text>
                                    <Text className="text-[10px] text-gray-400">For the Year Ended December 31, {year}</Text>
                                </View>
                            </View>
                            <Text className="text-xs text-gray-600 leading-5">
                                Management is responsible for the preparation and fair presentation of these financial statements. The Statement of Management Responsibility with officer signature lines is included in the PDF export.
                            </Text>
                        </Animated.View>

                        {/* ── Export Button ── */}
                        <Pressable
                            onPress={handleExportPdf}
                            disabled={exporting}
                            className="bg-blue-900 rounded-3xl py-5 px-6 flex-row items-center justify-center active:bg-blue-900 mb-4"
                        >
                            {exporting ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <MaterialIcons name="picture-as-pdf" size={22} color="#fff" />
                            )}
                            <Text className="text-white font-black text-base ml-3">
                                {exporting ? 'Generating PDF…' : `Export Full Report as PDF`}
                            </Text>
                        </Pressable>

                        <View className="bg-blue-50 rounded-2xl p-4 mb-4 border border-blue-100">
                            <Text className="text-[10px] text-blue-700 font-bold leading-4">
                                📄 The PDF includes: Cover Page · Auditor's Opinion · Supplemental Written Statement · Report of Independent CPA · All 4 Financial Statements · Notes to Financial Statements (10 pages) · Statement of Management Responsibility
                            </Text>
                        </View>

                        <Text className="text-[10px] text-gray-400 text-center mb-4">
                            Generated {format(data.generatedAt, 'MMMM d, yyyy · h:mm a')} · POS Cursor
                        </Text>
                    </View>
                ) : null}
            </ScrollView>
        </View>
    );
}
