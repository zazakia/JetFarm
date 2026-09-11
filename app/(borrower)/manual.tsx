import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/store/AuthContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

function Accordion({ title, icon, children, defaultOpen = false }: any) {
    const { sunlightMode } = useAuth();
    const [expanded, setExpanded] = useState(defaultOpen);

    const toggle = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    return (
        <View className={`rounded-3xl overflow-hidden mb-4 border ${
            sunlightMode ? 'bg-white border-black border-2' : 'bg-white border-gray-100 shadow-sm'
        }`}>
            <Pressable onPress={toggle} className="flex-row items-center p-5 active:bg-gray-50">
                <View className={`w-10 h-10 rounded-2xl items-center justify-center mr-4 ${
                    sunlightMode ? 'bg-black' : 'bg-blue-900'
                }`}>
                    <MaterialIcons name={icon} size={20} color="#FFFFFF" />
                </View>
                <Text className="flex-1 font-bold text-gray-900 text-lg">{title}</Text>
                <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={24} color="#9CA3AF" />
            </Pressable>
            {expanded && (
                <View className="px-5 pb-5 pt-2 border-t border-gray-50">
                    {children}
                </View>
            )}
        </View>
    );
}

function ManualCard({ title, value, unit, description }: { title: string; value: string; unit?: string; description: string }) {
    const { sunlightMode } = useAuth();
    return (
        <View className={`p-4 rounded-2xl mb-3 border ${
            sunlightMode ? 'bg-white border-black' : 'bg-slate-50 border-slate-100'
        }`}>
            <Text className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-1">{title}</Text>
            <View className="flex-row items-baseline mb-2">
                <Text className="text-blue-900 font-black text-2xl">{value}</Text>
                {unit && <Text className="text-gray-500 font-bold text-sm ml-1">{unit}</Text>}
            </View>
            <Text className="text-gray-700 text-xs font-semibold leading-4">{description}</Text>
        </View>
    );
}

export default function MemberManualScreen() {
    const { sunlightMode } = useAuth();

    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            <LinearGradient colors={['#1E3A8A', '#065F46']} className="pt-12 pb-6 px-6 rounded-b-[40px] shadow-sm">
                <Text className="text-white/90 text-xs font-bold uppercase tracking-[3px] mb-1">POS Cursor</Text>
                <Text className="text-white text-3xl font-black">Member Manual</Text>
                <Text className="text-white/70 text-sm font-medium mt-2">
                    Official operational manual, business rules, interest rates, and member benefits policy.
                </Text>
            </LinearGradient>

            <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                <Accordion title="1. Capital Build-Up (CBU) & Shares" icon="pie-chart" defaultOpen={true}>
                    <Text className="text-gray-600 mb-4 leading-6">
                        Capital Build-Up (CBU) represents a member's ownership and equity in the cooperative. It forms the base for dividends and loan eligibility.
                    </Text>
                    <ManualCard
                        title="Share Value"
                        value="₱100.00"
                        unit="per share"
                        description="The fixed nominal value of one share in POS Cursor. All CBU purchases must be multiples of this value."
                    />
                    <ManualCard
                        title="Min Shares for Petty Cash"
                        value="10 shares"
                        unit="(₱1,000.00)"
                        description="A member must hold at least 10 fully paid-up shares to be eligible to apply for a Petty Cash Loan."
                    />
                </Accordion>

                <Accordion title="2. Surplus & Member Benefits" icon="redeem">
                    <Text className="text-gray-600 mb-4 leading-6">
                        Pursuant to Philippine Cooperative Law (R.A. 9520), net income is allocated to reserves and member benefits at the end of each fiscal year.
                    </Text>
                    <View className="mb-4">
                        <Text className="text-blue-900 font-extrabold text-sm mb-2">Statutory Reserves (30% of Net Income):</Text>
                        <Text className="text-gray-600 text-xs font-bold mb-1">• General Reserve Fund: 10% (Operational protection)</Text>
                        <Text className="text-gray-600 text-xs font-bold mb-1">• Education & Training Fund (CETF): 10%</Text>
                        <Text className="text-gray-600 text-xs font-bold mb-1">• Optional Fund: 7%</Text>
                        <Text className="text-gray-600 text-xs font-bold mb-1">• Community Development Fund (CDF): 3%</Text>
                    </View>
                    <ManualCard
                        title="Member Benefit Pool"
                        value="70%"
                        unit="of Net Income"
                        description="The remaining 70% of the cooperative's net income is distributed back to regular members."
                    />
                    <ManualCard
                        title="Interest on Share Capital (ISC)"
                        value="70%"
                        unit="of Member Pool"
                        description="Distributed to regular members based on their daily average paid-up share capital balance."
                    />
                    <ManualCard
                        title="Patronage Refund (PR)"
                        value="30%"
                        unit="of Member Pool"
                        description="Refunded to members in proportion to their volume of business / loan payments done with the cooperative."
                    />
                    <View className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                        <View className="flex-row items-center mb-1">
                            <MaterialIcons name="warning" size={16} color="#B45309" className="mr-2" />
                            <Text className="text-amber-800 font-black text-xs uppercase tracking-wider">Annual GA Attendance Penalty</Text>
                        </View>
                        <Text className="text-amber-700 text-xs leading-5 font-semibold">
                            If a member is absent from the Annual General Assembly (GA) without BOD-approved excuse, their entire Patronage Refund is automatically plowed back (converted) to their CBU / Share Capital instead of cash.
                        </Text>
                    </View>
                </Accordion>

                <Accordion title="3. Savings Deposits Program" icon="savings">
                    <Text className="text-gray-600 mb-4 leading-6">
                        Members can build personal savings with the cooperative. Savings balances earn competitive interest compounded quarterly.
                    </Text>
                    <ManualCard
                        title="Annual Interest Rate"
                        value="4.0%"
                        unit="per annum"
                        description="Competitive annual interest rate credited to member savings accounts."
                    />
                    <ManualCard
                        title="Min Maintaining Balance"
                        value="₱100.00"
                        description="Interest is calculated and applied quarterly only if the member's Average Monthly Balance (AMB) is at least ₱100.00."
                    />
                    <View className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl">
                        <Text className="text-indigo-900 font-extrabold text-xs uppercase tracking-wider mb-1">Quarterly Calculation Formula</Text>
                        <Text className="text-indigo-700 text-xs leading-5 font-semibold">
                            Interest = Average Monthly Balance (AMB) × (4.0% / 4){'\n'}
                            Where AMB is the average daily balance (ADB) of the 3 months in the quarter.
                        </Text>
                    </View>
                </Accordion>

                <Accordion title="4. Lending & Credit Policies" icon="payments">
                    <Text className="text-gray-600 mb-4 leading-6">
                        Loans are extended under strict rules to ensure cooperative sustainability and member protection.
                    </Text>
                    <ManualCard
                        title="One Active Loan Limit"
                        value="1 Loan"
                        unit="per Member"
                        description="A member can only have one active loan at a time. Previous outstanding balances must be cleared upon loan renewal/reloan."
                    />
                    <ManualCard
                        title="Petty Cash Loan Limit"
                        value="75%"
                        unit="of Share Capital"
                        description="Petty Cash loans are strictly capped at 75% of the member's paid-up CBU balance."
                    />
                    <ManualCard
                        title="Standard Loan Limit"
                        value="₱5,000.00"
                        unit="maximum"
                        description="Livelihood, Salary, and Emergency loans are capped at ₱5,000.00 and require Credit Investigation (CI) & BOD approval."
                    />
                    <View className="mb-4">
                        <Text className="text-blue-900 font-extrabold text-sm mb-2">Standard Deductions from Release Proceeds:</Text>
                        <Text className="text-gray-600 text-xs font-bold mb-1">• Association Reserve Fund (ARF): 2% of principal</Text>
                        <Text className="text-gray-600 text-xs font-bold mb-1">• Cooperative Project Fund / CBU (CPF): 4% of principal</Text>
                        <Text className="text-gray-600 text-xs font-bold mb-1">• Membership Fee (MEM): ₱100.00</Text>
                        <Text className="text-gray-600 text-xs font-bold mb-1">• Loan Handling/Mutual Fee (LHF): ₱100.00</Text>
                        <Text className="text-gray-600 text-xs font-bold mb-1">• Risk Share Fund (RSF): ₱60.00</Text>
                        <Text className="text-gray-600 text-xs font-bold mb-1">• Documentary Stamp Tax (DST): ₱45.00 flat (or 0.75% of principal)</Text>
                    </View>
                    <View className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl">
                        <Text className="text-indigo-900 font-extrabold text-xs uppercase tracking-wider mb-1">Repayment Schedule Rule</Text>
                        <Text className="text-indigo-700 text-xs leading-5 font-semibold">
                            Repayment schedules start the next calendar day after release and automatically skip Sundays to avoid Sunday collections.
                        </Text>
                    </View>
                </Accordion>

                <Accordion title="5. Accounting & Auto-Posting (CDA Aligned)" icon="menu-book">
                    <Text className="text-gray-600 mb-4 leading-6">
                        Transactions auto-post to the General Ledger based on Cooperative Development Authority (CDA) standards.
                    </Text>
                    <View className="bg-slate-100 p-4 rounded-2xl">
                        <View className="flex-row justify-between mb-2 border-b border-gray-200 pb-1">
                            <Text className="text-gray-800 font-bold text-xs flex-1">Transaction Type</Text>
                            <Text className="text-gray-800 font-bold text-xs w-16 text-center">Debit</Text>
                            <Text className="text-gray-800 font-bold text-xs w-16 text-center">Credit</Text>
                        </View>
                        <Text className="text-gray-700 text-xs py-1 border-b border-gray-100">Disbursement: DR 1100 (Loans Rec) / CR 1010 (Cash)</Text>
                        <Text className="text-gray-700 text-xs py-1 border-b border-gray-100">Savings Deposit: DR 1010 (Cash) / CR 2010 (Savings Payable)</Text>
                        <Text className="text-gray-700 text-xs py-1 border-b border-gray-100">Share Capital Paid: DR 1010 (Cash) / CR 3010 (Share Capital)</Text>
                        <Text className="text-gray-700 text-xs py-1">Payment: DR 1010 (Cash) / CR 1100 (Principal) & CR 4010 (Interest)</Text>
                    </View>
                </Accordion>

                <View className="h-10" />
            </ScrollView>
        </SafeAreaView>
    );
}
