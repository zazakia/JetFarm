import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator , Linking, Pressable } from 'react-native';
import { MfiKpiService, MfiKpiData } from '../../../src/services/MfiKpiService';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { ReminderService } from '../../../src/services/ReminderService';

import { ReportInfoModal, InfoModalContent, InfoIcon } from '../../../src/components/ReportInfoModal';

export default function MfiKpisScreen() {
    const [kpis, setKpis] = useState<MfiKpiData | null>(null);
    const [advancedKpis, setAdvancedKpis] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [infoContent, setInfoContent] = useState<InfoModalContent | null>(null);

    useEffect(() => {
        const load = async () => {
            const data = await MfiKpiService.getKpiSummary();
            setKpis(data);
            const advData = await MfiKpiService.getAdvancedKpis();
            setAdvancedKpis(advData);
            setLoading(false);
        };
        load();
    }, []);

    if (loading || !kpis || !advancedKpis) return <ActivityIndicator className="mt-20" color="#1E3A8A" />;

    return (
        <View className="flex-1 bg-gray-50">
            {/* ── Top controls (Static) ── */}
            <View className="p-6 pb-2 bg-gray-50 border-b border-gray-100">
                <Text className="text-2xl font-black text-gray-900">MFI Efficiency KPIs</Text>
                <Text className="text-gray-700 font-medium tracking-wide text-xs">Industry Standard Microfinance Indicators</Text>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>

            <MetricSection title="Portfolio Quality">
                <MetricRow
                    label="Portfolio At Risk (PAR > 30)"
                    value={`${(kpis.portfolioAtRisk * 100).toFixed(2)}%`}
                    hint="Standard: < 5%. Measures risk in loan portfolio."
                    status={kpis.portfolioAtRisk < 0.05 ? 'good' : 'bad'}
                    onInfoPress={() => setInfoContent({
                        title: 'Portfolio At Risk > 30 Days',
                        question: 'What percentage of our funds are tied up in seriously overdue loans?',
                        formula: 'Outstanding Balance of Loans with Arrears > 30 Days / Total Gross Loan Portfolio',
                        explanation: 'PAR > 30 is the most widely accepted measure of portfolio quality. It shows the portion of the portfolio that is contaminated by arrears and at risk of not being repaid.'
                    })}
                />
            </MetricSection>

            <MetricSection title="Financial Sustainability">
                <MetricRow
                    label="Operational Self-Sufficiency (OSS)"
                    value={`${(kpis.oss * 100).toFixed(1)}%`}
                    hint="Standard: > 100%. Operating Income / Operating Expenses."
                    status={kpis.oss >= 1 ? 'good' : 'warning'}
                    onInfoPress={() => setInfoContent({
                        title: 'Operational Self-Sufficiency (OSS)',
                        question: 'Do our operating revenues cover our operating expenses?',
                        formula: 'Financial Revenue / (Financial Expense + Impairment Loss + Operating Expenses)',
                        explanation: 'An OSS > 100% means the institution generates enough income to cover its costs. Below 100% means it relies on subsidies or equity to survive.'
                    })}
                />
                <MetricRow
                    label="Financial Self-Sufficiency (FSS)"
                    value={`${(kpis.fss * 100).toFixed(1)}%`}
                    hint="OSS adjusted for subsidies and inflation."
                    status={kpis.fss >= 1 ? 'good' : 'warning'}
                    onInfoPress={() => setInfoContent({
                        title: 'Financial Self-Sufficiency (FSS)',
                        question: 'Could the business survive without any outside subsidies?',
                        formula: 'Adjusted Financial Revenue / Adjusted Financial & Operating Expenses',
                        explanation: 'FSS adjusts the OSS ratio by accounting for inflation and removing any subisidized costs (like free rent or artificially low interest capital), showing true commercial viability.'
                    })}
                />
            </MetricSection>

            <MetricSection title="Operating Efficiency">
                <MetricRow
                    label="Collection Efficiency"
                    value={`${(kpis.collectionEfficiency * 100).toFixed(1)}%`}
                    hint="Total Collected / Total Due. Measures field effectiveness."
                    status={kpis.collectionEfficiency > 0.9 ? 'good' : 'warning'}
                    onInfoPress={() => setInfoContent({
                        title: 'Collection Efficiency',
                        question: 'Are we collecting what we are supposed to collect?',
                        formula: 'Cash Collected from Amortizations / Total Amortizations Due for the Period'
                    })}
                />
                <MetricRow
                    label="Operating Expense Ratio"
                    value={`${(kpis.oer * 100).toFixed(1)}%`}
                    hint="Standard: 10-15%. Total Expenses / Average Portolio."
                    status={kpis.oer < 0.15 ? 'good' : 'warning'}
                    onInfoPress={() => setInfoContent({
                        title: 'Operating Expense Ratio (OER)',
                        question: 'How efficiently are we running the lending operations?',
                        formula: 'Operating Expenses / Average Gross Loan Portfolio',
                        explanation: 'A lower ratio indicates better efficiency, meaning you are spending less to manage a larger portfolio.'
                    })}
                />
            </MetricSection>

            <MetricSection title="Profitability & Stability">
                <MetricRow
                    label="Return on Assets (ROA)"
                    value={`${(advancedKpis.roa * 100).toFixed(1)}%`}
                    hint="Standard: > 2%. Net Income / Total Assets."
                    status={advancedKpis.roa > 0.02 ? 'good' : advancedKpis.roa < 0 ? 'bad' : 'warning'}
                    onInfoPress={() => setInfoContent({
                        title: 'Return on Assets (ROA)',
                        question: 'How well are we using our assets to generate profit?',
                        formula: 'Net Income / Average Total Assets',
                        explanation: 'Measures how efficiently the MFI uses its total assets (loans, cash, buildings) to generate income.'
                    })}
                />
                <MetricRow
                    label="Return on Equity (ROE)"
                    value={`${(advancedKpis.roe * 100).toFixed(1)}%`}
                    hint="Standard: > 10%. Net Income / Total Equity."
                    status={advancedKpis.roe > 0.1 ? 'good' : advancedKpis.roe < 0 ? 'bad' : 'warning'}
                    onInfoPress={() => setInfoContent({
                        title: 'Return on Equity (ROE)',
                        question: 'What return are the investors getting on their money?',
                        formula: 'Net Income / Average Total Equity'
                    })}
                />
                <MetricRow
                    label="Debt-to-Equity Ratio"
                    value={`${advancedKpis.debtToEquity.toFixed(2)}x`}
                    hint="Standard: < 3x. Total Liabilities / Total Equity."
                    status={advancedKpis.debtToEquity < 3 ? 'good' : advancedKpis.debtToEquity > 5 ? 'bad' : 'warning'}
                    onInfoPress={() => setInfoContent({
                        title: 'Debt To Equity Ratio',
                        question: 'How leveraged is the institution?',
                        formula: 'Total Liabilities / Total Equity'
                    })}
                />
                <MetricRow
                    label="Capital Adequacy Ratio (CAR)"
                    value={`${(advancedKpis.car * 100).toFixed(1)}%`}
                    hint="Standard: > 10%. Equity / Risk-Weighted Assets."
                    status={advancedKpis.car >= 0.1 ? 'good' : advancedKpis.car < 0.08 ? 'bad' : 'warning'}
                    onInfoPress={() => setInfoContent({
                        title: 'Capital Adequacy Ratio (CAR)',
                        question: 'Do we have enough capital buffer to absorb potential losses?',
                        formula: 'Total Equity / Risk-Weighted Assets'
                    })}
                />
            </MetricSection>

            <MetricSection title="Social & Governance">
                <MetricRow
                    label="Women Borrower Ratio"
                    value={`${(advancedKpis.womenRatio * 100).toFixed(1)}%`}
                    hint="Percentage of total active borrowers who are women."
                    status={advancedKpis.womenRatio > 0.5 ? 'good' : 'warning'}
                    onInfoPress={() => setInfoContent({
                        title: 'Women Borrower Ratio',
                        question: 'Are we reaching female demographics?',
                        formula: 'Number of Active Female Borrowers / Total Active Borrowers'
                    })}
                />
                <MetricRow
                    label="Borrowers per Loan Officer"
                    value={`${Math.round(advancedKpis.borrowersPerLo)}`}
                    hint="Active Borrowers / Number of Collectors. Standard: 150-300."
                    status={advancedKpis.borrowersPerLo > 100 && advancedKpis.borrowersPerLo < 400 ? 'good' : 'warning'}
                    onInfoPress={() => setInfoContent({
                        title: 'Borrowers per Loan Officer',
                        question: 'Is the caseload for collectors manageable?',
                        formula: 'Total Active Borrowers / Total Number of Collectors'
                    })}
                />
                <MetricRow
                    label="Average Loan Size"
                    value={`₱${Math.round(advancedKpis.avgLoanSize).toLocaleString()}`}
                    hint="Gross Loan Portfolio / Active Borrowers."
                    status="good"
                    onInfoPress={() => setInfoContent({
                        title: 'Average Loan Size',
                        question: 'What is the typical amount we lend out?',
                        formula: 'Total Gross Loan Portfolio / Active Borrowers'
                    })}
                />
            </MetricSection>

            <WatchlistSection />

            <View className="h-20" />

            <ReportInfoModal 
                visible={!!infoContent}
                content={infoContent}
                onClose={() => setInfoContent(null)}
            />
            </ScrollView>
        </View>
    );
}

function WatchlistSection() {
    const [watchlist, setWatchlist] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const data = await MfiKpiService.getOverdueWatchlist();
            setWatchlist(data);
            setLoading(false);
        };
        load();
    }, []);

    if (loading) return <ActivityIndicator color="#7B1FA2" />;
    if (watchlist.length === 0) return null;

    const handleReminder = (type: 'sms' | 'whatsapp', item: any) => {
        const data = {
            borrowerName: item.borrowerName,
            amountDue: item.amountDue,
            dueDate: item.dueDate,
            phoneNumber: item.phoneNumber
        };
        const link = type === 'whatsapp' 
            ? ReminderService.generateWhatsAppLink('overdue', data)
            : ReminderService.generateSmsLink('overdue', data);
        
        if (link) {
            Linking.openURL(link).catch(err => console.error('Error opening link:', err));
        }
    };

    return (
        <MetricSection title="Overdue Watchlist (Top 10)">
            {watchlist.map((item, idx) => (
                <View key={item.scheduleId || idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mb-4">
                    <View className="flex-row justify-between items-start mb-3">
                        <View className="flex-1">
                            <Text className="text-gray-900 font-black text-base">{item.borrowerName}</Text>
                            <Text className="text-red-500 font-bold text-xs uppercase tracking-tighter">
                                {item.overdueDays} DAYS OVERDUE
                            </Text>
                        </View>
                        <View className="items-end">
                            <Text className="text-gray-900 font-black text-lg">₱{item.amountDue.toLocaleString()}</Text>
                            <Text className="text-gray-700 text-[10px] uppercase font-bold">Unpaid Amortization</Text>
                        </View>
                    </View>

                    <View className="flex-row items-center justify-between pt-3 border-t border-gray-50">
                        <View>
                            <Text className="text-[10px] text-gray-700 font-bold uppercase">Phone Number</Text>
                            <Text className="text-gray-700 font-medium">{item.phoneNumber || 'N/A'}</Text>
                        </View>
                        <View className="flex-row">
                            <Pressable 
                                onPress={() => handleReminder('sms', item)}
                                className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center mr-2 active:bg-blue-100"
                            >
                                <MaterialIcons name="sms" size={20} color="#2563EB" />
                            </Pressable>
                            <Pressable 
                                onPress={() => handleReminder('whatsapp', item)}
                                className="w-10 h-10 bg-green-50 rounded-full items-center justify-center active:bg-green-100"
                            >
                                <FontAwesome name="whatsapp" size={20} color="#16A34A" />
                            </Pressable>
                        </View>
                    </View>
                </View>
            ))}
        </MetricSection>
    );
}

function MetricSection({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <View className="mb-8">
            <Text className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-4 ml-1">{title}</Text>
            {children}
        </View>
    );
}

function MetricRow({ label, value, hint, status, onInfoPress }: { label: string, value: string, hint: string, status: 'good' | 'warning' | 'bad', onInfoPress?: () => void }) {
    const color = status === 'good' ? '#EAB308' : status === 'warning' ? '#F9A825' : '#D32F2F';
    const bgColor = status === 'good' ? '#E8F5E9' : status === 'warning' ? '#FFF9C4' : '#FFEBEE';

    return (
        <View className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mb-4">
            <View className="flex-row justify-between items-center mb-2">
                <View className="flex-row items-center">
                    <Text className="text-base font-bold text-gray-700">{label}</Text>
                    {onInfoPress && <InfoIcon onPress={onInfoPress} />}
                </View>
                <View className="px-3 py-1 rounded-full" style={{ backgroundColor: bgColor }}>
                    <Text className="text-sm font-black" style={{ color: color }}>{value}</Text>
                </View>
            </View>
            <Text className="text-xs text-gray-700 italic">{hint}</Text>
        </View>
    );
}
