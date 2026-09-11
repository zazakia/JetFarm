import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CoopFinancialReportService, PriorYearData } from '../../../src/services/CoopFinancialReportService';
import { FinancialDataSeed } from '../../../src/services/FinancialDataSeedService';
import { formatPHP } from '../../../src/utils/currency';
import { MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export default function PeriodSettingsScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [isSeeded, setIsSeeded] = useState(false);
    const [year, setYear] = useState(2025);
    const [activeTab, setActiveTab] = useState<'current' | 'priorAssets' | 'priorLiab' | 'priorOps'>('current');

    // Current Year fields
    const [authCapital, setAuthCapital] = useState('280000');
    const [subCapital, setSubCapital] = useState('250000');
    const [subReceivable, setSubReceivable] = useState('18092.73');
    const [sundryAssets, setSundryAssets] = useState('121399.90');

    // Prior Year fields
    const [priorData, setPriorData] = useState<PriorYearData>({});

    const loadData = async () => {
        setLoading(true);
        try {
            const settings = await CoopFinancialReportService.getPeriodSettings(year);
            if (settings) {
                setAuthCapital(settings.authorizedShareCapital.toString());
                setSubCapital(settings.subscribedCapital.toString());
                setSubReceivable(settings.subscriptionReceivable.toString());
                setSundryAssets(settings.sundryAssets.toString());
                setPriorData(JSON.parse(settings.priorYearData));
            } else {
                // Set default empty settings or defaults from audited 2024 columns
                setAuthCapital('280000');
                setSubCapital('250000');
                setSubReceivable('18092.73');
                setSundryAssets('121399.90');
                setPriorData({
                    cashOnHand: 39902.93,
                    cashInBank: 53011.35,
                    loanReceivable: 164622.70,
                    sundryAssets: 117411.91,
                    depositLiabilities: 116384.50,
                    interestShareCapitalPayable: 559.15,
                    patronageRefundPayable: 559.15,
                    dueToUnion: 186.38,
                    subscribedCapital: 250000.00,
                    subscriptionReceivable: 18092.73,
                    reserveFund: 17094.76,
                    educationFund: 1366.41,
                    communityDevFund: 1647.38,
                    optionalFund: 5243.88,
                    retainedSurplus: 0.00,
                    authorizedShareCapital: 280000.00,
                    interestOnLoans: 16260.00,
                    serviceCharges: 3620.00,
                    penalties: 0.00,
                    membershipFees: 0.00,
                    interestOnInvestments: 0.00,
                    miscellaneousIncome: 0.00,
                    financingCosts: 6814.31,
                    salaries: 0.00,
                    office: 0.00,
                    communication: 0.00,
                    transportation: 0.00,
                    depreciation: 0.00,
                    taxes: 0.00,
                    repairs: 0.00,
                    training: 0.00,
                    professional: 0.00,
                    otherExpenses: 9338.00
                });
            }
            // Check if historical data is already seeded
            const seeded = await FinancialDataSeed.isAlreadySeeded();
            setIsSeeded(seeded);
        } catch (error) {
            console.error('Failed to load period settings:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [year])
    );

    const handleSave = async () => {
        setSaving(true);
        try {
            await CoopFinancialReportService.savePeriodSettings(year, {
                authorizedShareCapital: parseFloat(authCapital) || 0,
                subscribedCapital: parseFloat(subCapital) || 0,
                subscriptionReceivable: parseFloat(subReceivable) || 0,
                sundryAssets: parseFloat(sundryAssets) || 0,
                priorYearData: priorData,
            }, 'Admin');

            Toast.show({
                type: 'success',
                text1: 'Settings Saved',
                text2: `Successfully updated financial settings for FY ${year}.`,
            });
            router.back();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleSeedHistorical = () => {
        Alert.alert(
            'Migrate Historical Data',
            'This will seed audited FY2024 and FY2025 financial statements directly into the local database via double-entry journal postings. Are you sure you want to proceed?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    onPress: async () => {
                        setSeeding(true);
                        try {
                            const res = await FinancialDataSeed.seedHistoricalData('Admin');
                            if (res.success) {
                                Toast.show({
                                    type: 'success',
                                    text1: 'Migration Successful',
                                    text2: res.message,
                                });
                                await loadData();
                            } else {
                                Alert.alert('Migration Failed', res.message);
                            }
                        } catch (err: any) {
                            Alert.alert('Error', err.message || 'An unexpected error occurred during seeding');
                        } finally {
                            setSeeding(false);
                        }
                    }
                }
            ]
        );
    };

    const updatePriorField = (key: keyof PriorYearData, value: string) => {
        setPriorData(prev => ({
            ...prev,
            [key]: parseFloat(value) || 0,
        }));
    };

    const renderInput = (
        label: string,
        value: string,
        onChange: (text: string) => void,
        placeholder = '0.00'
    ) => (
        <View className="mb-4">
            <Text className="text-gray-700 font-semibold text-xs mb-1.5">{label}</Text>
            <TextInput
                value={value}
                onChangeText={onChange}
                keyboardType="numeric"
                placeholder={placeholder}
                className="bg-gray-150 rounded-xl px-4 py-3 text-sm text-gray-900 border border-gray-200 focus:border-blue-500"
             placeholderTextColor="#9CA3AF"/>
        </View>
    );

    const renderPriorInput = (label: string, fieldKey: keyof PriorYearData) => {
        const val = priorData[fieldKey]?.toString() || '';
        return renderInput(label, val, (txt) => updatePriorField(fieldKey, txt));
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#0F172A" />
                <Text className="text-gray-500 font-medium text-xs mt-3">Loading settings...</Text>
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
                    <Text className="text-lg font-black text-gray-900">Period Config</Text>
                </View>
                
                <View className="flex-row items-center">
                    <Pressable 
                        onPress={() => setYear(y => y - 1)}
                        className="p-1.5 bg-slate-100 rounded-lg active:bg-slate-200 mr-1"
                    >
                        <MaterialIcons name="chevron-left" size={16} color="#1E293B" />
                    </Pressable>
                    <Text className="font-black text-slate-800 px-2 text-xs">FY {year}</Text>
                    <Pressable 
                        onPress={() => setYear(y => y + 1)}
                        className="p-1.5 bg-slate-100 rounded-lg active:bg-slate-200"
                    >
                        <MaterialIcons name="chevron-right" size={16} color="#1E293B" />
                    </Pressable>
                </View>
            </View>

            {/* Tab Selectors */}
            <View className="flex-row bg-white border-b border-gray-200 py-1.5 px-2">
                {[
                    { id: 'current', label: `FY ${year} Capital` },
                    { id: 'priorAssets', label: 'Prior Assets' },
                    { id: 'priorLiab', label: 'Prior Liab/Eq' },
                    { id: 'priorOps', label: 'Prior Ops' },
                ].map(t => (
                    <Pressable
                        key={t.id}
                        onPress={() => setActiveTab(t.id as any)}
                        className={`flex-1 py-2 mx-1 items-center rounded-lg ${
                            activeTab === t.id ? 'bg-slate-900 shadow' : 'bg-transparent'
                        }`}
                    >
                        <Text 
                            className={`text-[10px] font-black text-center ${
                                activeTab === t.id ? 'text-white' : 'text-slate-600'
                            }`}
                        >
                            {t.label}
                        </Text>
                    </Pressable>
                ))}
            </View>

            <ScrollView className="flex-1 p-5">
                {activeTab === 'current' && (
                    <View>
                        <View className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-6">
                            <Text className="text-slate-900 font-black text-sm uppercase mb-4 border-b border-gray-100 pb-2">
                                FY {year} Share Capital & Sundry
                            </Text>
                            {renderInput('Authorized Share Capital (PHP)', authCapital, setAuthCapital)}
                            {renderInput('Subscribed Capital (PHP)', subCapital, setSubCapital)}
                            {renderInput('Less: Subscription Receivable (PHP)', subReceivable, setSubReceivable)}
                            {renderInput('Other Non-Current Assets (Sundry) (PHP)', sundryAssets, setSundryAssets)}
                        </View>

                        <View className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-6">
                            <Text className="text-slate-900 font-black text-sm uppercase mb-2 border-b border-gray-100 pb-2">
                                Historical Audit Data
                            </Text>
                            <Text className="text-gray-500 text-xs mb-4 leading-relaxed">
                                Automatically seed and migrate 2024 and 2025 audited financial statements (Statement of Financial Condition, Statement of Operations, Surplus Allocations) into the local database.
                            </Text>
                            {isSeeded ? (
                                <View className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex-row items-center justify-center">
                                    <MaterialIcons name="check-circle" size={18} color="#059669" style={{ marginRight: 6 }} />
                                    <Text className="text-emerald-700 font-bold text-xs">Historical Data Migrated</Text>
                                </View>
                            ) : (
                                <Pressable
                                    onPress={handleSeedHistorical}
                                    disabled={seeding}
                                    className={`bg-blue-600 py-3.5 rounded-xl items-center flex-row justify-center active:bg-blue-700 ${
                                        seeding ? 'opacity-55' : ''
                                    }`}
                                >
                                    {seeding ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <>
                                            <MaterialIcons name="cloud-download" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                                            <Text className="text-white font-bold text-xs">Migrate Audited 2024 & 2025 Data</Text>
                                        </>
                                    )}
                                </Pressable>
                            )}
                        </View>
                    </View>
                )}

                {activeTab === 'priorAssets' && (
                    <View className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-6">
                        <Text className="text-slate-900 font-black text-sm uppercase mb-4 border-b border-gray-100 pb-2">
                            FY {year - 1} Comparative Assets
                        </Text>
                        {renderPriorInput('Cash on Hand (PHP)', 'cashOnHand')}
                        {renderPriorInput('Cash in Bank (PHP)', 'cashInBank')}
                        {renderPriorInput('Loans and Receivables (PHP)', 'loanReceivable')}
                        {renderPriorInput('Other Non-Current Assets (Sundry) (PHP)', 'sundryAssets')}
                    </View>
                )}

                {activeTab === 'priorLiab' && (
                    <View className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-6">
                        <Text className="text-slate-900 font-black text-sm uppercase mb-4 border-b border-gray-100 pb-2">
                            FY {year - 1} Comparative Liabilities & Equity
                        </Text>
                        {renderPriorInput('Deposit Liabilities (PHP)', 'depositLiabilities')}
                        {renderPriorInput('Interest on Share Capital Payable (PHP)', 'interestShareCapitalPayable')}
                        {renderPriorInput('Patronage Refund Payable (PHP)', 'patronageRefundPayable')}
                        {renderPriorInput('Due to Union / Federation (PHP)', 'dueToUnion')}
                        {renderPriorInput('Authorized Share Capital (PHP)', 'authorizedShareCapital')}
                        {renderPriorInput('Subscribed Capital (PHP)', 'subscribedCapital')}
                        {renderPriorInput('Subscription Receivable (PHP)', 'subscriptionReceivable')}
                        {renderPriorInput('Reserve Fund (PHP)', 'reserveFund')}
                        {renderPriorInput('Education and Training Fund (PHP)', 'educationFund')}
                        {renderPriorInput('Community Development Fund (PHP)', 'communityDevFund')}
                        {renderPriorInput('Optional Fund (PHP)', 'optionalFund')}
                        {renderPriorInput('Retained Surplus / (Deficit) (PHP)', 'retainedSurplus')}
                    </View>
                )}

                {activeTab === 'priorOps' && (
                    <View className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-6">
                        <Text className="text-slate-900 font-black text-sm uppercase mb-4 border-b border-gray-100 pb-2">
                            FY {year - 1} Comparative Operations
                        </Text>
                        {renderPriorInput('Interest Income from Loans (PHP)', 'interestOnLoans')}
                        {renderPriorInput('Service Fees (PHP)', 'serviceCharges')}
                        {renderPriorInput('Fines and penalties (PHP)', 'penalties')}
                        {renderPriorInput('Membership Fees (PHP)', 'membershipFees')}
                        {renderPriorInput('Interest on Investments (PHP)', 'interestOnInvestments')}
                        {renderPriorInput('Miscellaneous Income (PHP)', 'miscellaneousIncome')}
                        {renderPriorInput('Interest on Deposit Liabilities (PHP)', 'financingCosts')}
                        {renderPriorInput('Salaries and Wages (PHP)', 'salaries')}
                        {renderPriorInput('Office Expenses (PHP)', 'office')}
                        {renderPriorInput('Communication Expenses (PHP)', 'communication')}
                        {renderPriorInput('Transportation Expenses (PHP)', 'transportation')}
                        {renderPriorInput('Depreciation & Amortization (PHP)', 'depreciation')}
                        {renderPriorInput('Taxes & Licenses (PHP)', 'taxes')}
                        {renderPriorInput('Repairs & Maintenance (PHP)', 'repairs')}
                        {renderPriorInput('Training & Development (PHP)', 'training')}
                        {renderPriorInput('Professional Fees (PHP)', 'professional')}
                        {renderPriorInput('Other Operating Expenses (PHP)', 'otherExpenses')}
                    </View>
                )}
            </ScrollView>

            {/* Bottom Actions */}
            <View className="p-4 bg-white border-t border-gray-200">
                <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    className={`bg-slate-900 py-3.5 rounded-xl items-center flex-row justify-center active:bg-slate-800 ${
                        saving ? 'opacity-55' : ''
                    }`}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <MaterialIcons name="save" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text className="text-white font-bold text-sm">Save Config</Text>
                        </>
                    )}
                </Pressable>
            </View>
        </View>
    );
}
