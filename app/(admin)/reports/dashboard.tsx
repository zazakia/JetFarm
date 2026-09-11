import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { MfiKpiService, MfiKpiData } from '../../../src/services/MfiKpiService';
import { formatPHP } from '../../../src/utils/currency';
import { StatCard } from '../../../src/components/StatCard';
import { ReportInfoModal, InfoModalContent } from '../../../src/components/ReportInfoModal';
import { useFeatureFlags } from '../../../src/hooks/useSettingsConfig';

export default function ReportsDashboardScreen() {
    const router = useRouter();
    const { isEnabled } = useFeatureFlags();
    const isLendingEnabled = isEnabled('system.lending');
    const [kpis, setKpis] = useState<MfiKpiData | null>(null);
    const [loading, setLoading] = useState(true);
    const [infoContent, setInfoContent] = useState<InfoModalContent | null>(null);

    const loadData = async () => {
        try {
            const data = await MfiKpiService.getKpiSummary();
            setKpis(data);
        } catch (error) {
            console.error('Failed to load KPIs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    if (loading || !kpis) {
        return <ActivityIndicator size="large" color="#1E3A8A" className="flex-1 bg-gray-50 pt-20" />;
    }

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="mb-8">
                <Text className="text-2xl font-black text-gray-900">Standard Reports</Text>
                <Text className="text-gray-700 font-medium">Performance and risk analytics</Text>
            </View>

            {/* Top Row Metrics */}
            {isLendingEnabled && (
                <View className="flex-row flex-wrap justify-between mb-8">
                    <View className="w-[48%] mb-4">
                        <StatCard
                            title="Portfolio At Risk"
                            value={`${(kpis.portfolioAtRisk * 100).toFixed(2)}%`}
                            icon="warning" color="#D32F2F"
                            onPress={() => router.push('/(admin)/reports/portfolio-aging')}
                            onInfoPress={() => setInfoContent({
                                title: 'Portfolio At Risk (PAR)',
                                question: 'What percentage of our outstanding loan balance is currently delayed or at risk of default?',
                                formula: 'Outstanding balance of loans with arrears / Total Outstanding Principal',
                                explanation: 'PAR measures the risk level of the active loan portfolio. A lower percentage indicates a healthier portfolio.'
                            })}
                        />
                    </View>
                    <View className="w-[48%] mb-4">
                        <StatCard
                            title="Collection Eff."
                            value={`${(kpis.collectionEfficiency * 100).toFixed(1)}%`}
                            icon="trending-up" color="#EAB308"
                            onPress={() => router.push('/(admin)/reports/collection')}
                            onInfoPress={() => setInfoContent({
                                title: 'Collection Efficiency',
                                question: 'How much of the total expected payments have we successfully collected?',
                                formula: 'Total Collected Amount / Total Expected Amount Due',
                                explanation: 'This measures how effective the collection process is. It looks at the actual amount of money collected versus what was scheduled to be collected over a period.'
                            })}
                        />
                    </View>
                    <View className="w-[48%] mb-4">
                        <StatCard
                            title="Active Loans"
                            value={kpis.totalActiveLoans.toString()}
                            icon="receipt-long" color="#1E3A8A"
                            onInfoPress={() => setInfoContent({
                                title: 'Active Loans',
                                question: 'How many loans are currently ongoing and not yet fully paid or closed?',
                                formula: 'Count of all loans where status = "active"',
                                explanation: 'Simply represents the total volume of borrowers currently managing a loan with the institution.'
                            })}
                        />
                    </View>
                    <View className="w-[48%] mb-4">
                        <StatCard
                            title="Portfolio Size"
                            value={formatPHP(kpis.totalOutstandingPrincipal)}
                            icon="account-balance" color="#F9A825"
                            onInfoPress={() => setInfoContent({
                                title: 'Portfolio Size',
                                question: 'What is the total monetary value of all active loans combined?',
                                formula: 'Sum of the outstanding principal balance across all active loans',
                                explanation: 'Also known as the Total Loan Portfolio, this represents the total capital currently entrusted to borrowers.'
                            })}
                        />
                    </View>
                </View>
            )}

            {/* Report Categories */}
            
            {/* Official CDA Financial Statements */}
            <Text className="text-[10px] font-black text-gray-700 uppercase tracking-[2px] mb-4 mt-2 ml-2">Official CDA Financial Statements</Text>
            <ReportLink
                title="Statement of Financial Condition"
                desc="Audited Balance Sheet (Note 5 to 12)"
                icon="account-balance" color="#0F172A"
                onPress={() => router.push('/(admin)/reports/balance-sheet')}
            />
            <ReportLink
                title="Statement of Operations"
                desc="Audited Income Statement & distributed surplus"
                icon="receipt" color="#0F172A"
                onPress={() => router.push('/(admin)/reports/income-statement')}
            />
            <ReportLink
                title="Statement of Changes in Equity"
                desc="Cooperative Statutory Funds & share capital movements"
                icon="show-chart" color="#0F172A"
                onPress={() => router.push('/(admin)/reports/changes-in-equity')}
            />
            <ReportLink
                title="Statement of Cash Flows"
                desc="Quarterly operating, investing, and financing cash flows (CDA-compliant)"
                icon="waterfall-chart" color="#0F172A"
                onPress={() => router.push('/(admin)/reports/cash-flows')}
            />
            <ReportLink
                title="Notes to Financial Statements"
                desc="Quantitative disclosures (Note 5 to 16) for audit compliance"
                icon="description" color="#0F172A"
                onPress={() => router.push('/(admin)/reports/notes-to-fs')}
            />
            <ReportLink
                title="Period Config & Comparatives"
                desc="Set authorized capital and prior year comparative figures"
                icon="settings" color="#1D4ED8"
                onPress={() => router.push('/(admin)/reports/period-settings')}
            />
            <ReportLink
                title="Surplus Allocation Wizard"
                desc="Distribute net surplus to statutory funds & post closing journals"
                icon="pie-chart" color="#059669"
                onPress={() => router.push('/(admin)/reports/surplus-allocation')}
            />

            {/* Segment comparative report */}
            <Text className="text-[10px] font-black text-gray-700 uppercase tracking-[2px] mb-4 mt-6 ml-2">Cooperative Segments & Business Units</Text>
            <ReportLink
                title="Segment Comparative Statements"
                desc="Side-by-side comparative table of Cooperative Base and active business segments"
                icon="compare" color="#0E7490"
                onPress={() => router.push('/(admin)/reports/segment-comparison')}
            />

            {/* Daily / Overview */}
            <Text className="text-[10px] font-black text-gray-700 uppercase tracking-[2px] mb-4 mt-6 ml-2">Daily & Real-time</Text>
            <ReportLink
                title="Other Receipts Statement"
                desc="Summary statement of non-loan collections, service charges, and misc income (Daily/Monthly/Yearly)"
                icon="receipt" color="#059669"
                onPress={() => router.push('/(admin)/reports/other-receipts')}
            />
            <ReportLink
                title="Expense Breakdown"
                desc="Pie chart summary of operational expenses by category"
                icon="pie-chart" color="#7B1FA2"
                onPress={() => router.push('/(admin)/reports/expenses')}
            />
            {isLendingEnabled && (
                <ReportLink
                    title="Collection Report"
                    desc="Actual payments received with collector and date-range filters"
                    icon="event-note" color="#1E3A8A"
                    onPress={() => router.push('/(admin)/reports/collection')}
                />
            )}

            {/* Monthly Operations */}
            <Text className="text-[10px] font-black text-gray-700 uppercase tracking-[2px] mb-4 mt-6 ml-2">Monthly Operations</Text>
            <ReportLink
                title="Financial Summary"
                desc="Net monthly performance and cash flow status"
                icon="assessment" color="#355E3B"
                onPress={() => router.push('/(admin)/reports/financial-summary')}
            />
            {isLendingEnabled && (
                <ReportLink
                    title="Collector Efficiency"
                    desc="Ranking and performance metrics per collector"
                    icon="trending-up" color="#355E3B"
                    onPress={() => router.push('/(admin)/reports/collector-efficiency')}
                />
            )}
            {isLendingEnabled && (
                <ReportLink
                    title="Portfolio Aging (PAR)"
                    desc="Detailed breakdown of late and defaulted accounts"
                    icon="assignment-late" color="#D32F2F"
                    onPress={() => router.push('/(admin)/reports/portfolio-aging')}
                />
            )}
            <ReportLink
                title="Cash Advances"
                desc="Issue #10: cash advance releases, payments, and outstanding balances"
                icon="payments" color="#EA580C"
                onPress={() => router.push('/(admin)/reports/cash-advances')}
            />
            {isLendingEnabled && (
                <ReportLink
                    title="Disbursement History"
                    desc="Chronological list of released loans by period"
                    icon="outbox" color="#F9A825"
                    onPress={() => router.push('/(admin)/reports/disbursements')}
                />
            )}

            {/* Cooperative */}
            <Text className="text-[10px] font-black text-gray-700 uppercase tracking-[2px] mb-4 mt-6 ml-2">Cooperative</Text>
            {isLendingEnabled && (
                <ReportLink
                    title="CBU Report"
                    desc="Capital Build-Up ledger — paid-up shares and amounts per member"
                    icon="account-balance" color="#1E3A8A"
                    onPress={() => router.push('/(admin)/reports/cbu')}
                />
            )}
            <ReportLink
                title="Membership Registry"
                desc="Full roster with PMES status, share subscriptions, and membership type"
                icon="groups" color="#1E3A8A"
                onPress={() => router.push('/(admin)/reports/membership')}
            />
            <ReportLink
                title="Share Capital"
                desc="Portfolio-level share capital with member breakdown and recent contributions"
                icon="pie-chart" color="#7C3AED"
                onPress={() => router.push('/(admin)/reports/share-capital')}
            />
            <ReportLink
                title="Dividends & Refunds"
                desc="Net income-derived ISC 70% and Patronage Refund 30% with GA absentee penalty"
                icon="redeem" color="#D97706"
                onPress={() => router.push('/(admin)/reports/dividends')}
            />
            <ReportLink
                title="Statutory Reserves"
                desc="Net income allocation details and reserve movements"
                icon="table-chart" color="#059669"
                onPress={() => router.push('/(admin)/reports/statutory-reserves')}
            />

            <View className="h-20" />

            <ReportInfoModal 
                visible={!!infoContent}
                content={infoContent}
                onClose={() => setInfoContent(null)}
            />
        </ScrollView>
    );
}

function ReportLink({ title, desc, icon, color, onPress }: { title: string, desc: string, icon: any, color: string, onPress: () => void }) {
    return (
        <Pressable
            onPress={onPress}
            className="flex-row items-center bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mb-3 active:bg-gray-50"
        >
            <View className="p-3 rounded-xl mr-4" style={{ backgroundColor: `${color}15` }}>
                <MaterialIcons name={icon} size={24} color={color} />
            </View>
            <View className="flex-1">
                <Text className="text-base font-bold text-gray-900">{title}</Text>
                <Text className="text-xs text-gray-700 mt-0.5">{desc}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#E5E7EB" />
        </Pressable>
    );
}
