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
    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            <LinearGradient colors={['#1E3A8A', '#065F46']} className="pt-12 pb-6 px-6 rounded-b-[40px] shadow-sm">
                <Text className="text-white/90 text-xs font-bold uppercase tracking-[3px] mb-1">Agri-One</Text>
                <Text className="text-white text-3xl font-black">Operations Manual</Text>
                <Text className="text-white/70 text-sm font-medium mt-2">
                    Official operating rules: parcel setup, crop cycles, harvest settlement math, capital partners, and auto-posting.
                </Text>
            </LinearGradient>

            <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                <Accordion title="1. Parcel & Land Owner Setup" icon="landscape" defaultOpen={true}>
                    <Text className="text-gray-600 mb-4 leading-6">
                        Every farm lot is registered as a Parcel with a unique code, measured area and mapped boundary. Boundaries are versioned — an edit never overwrites the previous drawing.
                    </Text>
                    <ManualCard
                        title="Parcel Identity"
                        value="Code + area"
                        description="Each parcel carries a code (e.g. PRC-014), area in hectares, soil type and GPS boundary. Boundary and layout changes bump boundary_revision / layout_revision."
                    />
                    <ManualCard
                        title="Land Owner Terms"
                        value="Per-kilo rate"
                        description="The land owner is paid by weight harvested. Their profile stores the default per-kilo rate and the guaranteed minimum payout used by every cycle on their land."
                    />
                    <ManualCard
                        title="Blocks & Assignments"
                        value="Parcel → Blocks"
                        description="Large parcels are split into blocks; block assignments and block progress track which areas are planted, growing, harvested or resting."
                    />
                </Accordion>

                <Accordion title="2. Crop Cycle & Inputs" icon="agriculture">
                    <Text className="text-gray-600 mb-4 leading-6">
                        A crop cycle links one parcel to one capital partner and one planting event. All yield, cost and settlement math hangs off the cycle.
                    </Text>
                    <View className="mb-4">
                        <Text className="text-blue-900 font-extrabold text-sm mb-2">Required at cycle start:</Text>
                        <Text className="text-gray-600 text-xs font-bold mb-1">• Cycle code, parcel, crop type and variety</Text>
                        <Text className="text-gray-600 text-xs font-bold mb-1">• Planting date and target harvest date</Text>
                        <Text className="text-gray-600 text-xs font-bold mb-1">• Area planted (ha) and expected yield (kg)</Text>
                        <Text className="text-gray-600 text-xs font-bold mb-1">• Capital allocated, land-owner per-kilo rate and guaranteed minimum</Text>
                        <Text className="text-gray-600 text-xs font-bold mb-1">• Offtake price per kilo agreed with the buyer</Text>
                    </View>
                    <ManualCard
                        title="Input Stocks"
                        value="1246 / 1240"
                        description="Fertilizer, pesticides and seeds post to Agricultural Supplies Inventory (1246); standing crops post to Biological Assets (1240) and harvested tubers to Agricultural Produce Inventory (1245)."
                    />
                    <View className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                        <View className="flex-row items-center mb-1">
                            <MaterialIcons name="warning" size={16} color="#B45309" className="mr-2" />
                            <Text className="text-amber-800 font-black text-xs uppercase tracking-wider">Farm expenses must name a cycle</Text>
                        </View>
                        <Text className="text-amber-700 text-xs leading-5 font-semibold">
                            Every farm expense is tied to a crop cycle (and optionally a parcel) so per-cycle cost of production and yield analytics stay correct.
                        </Text>
                    </View>
                </Accordion>

                <Accordion title="3. Weekly Harvest Settlement Math" icon="event-note">
                    <Text className="text-gray-600 mb-4 leading-6">
                        Settlements run weekly per cycle. Weight comes from harvest logs; the engine derives the land owner's payout and the amount due for the week.
                    </Text>
                    <View className="bg-slate-100 p-4 rounded-2xl mb-4">
                        <Text className="text-gray-800 font-bold text-xs mb-2">Order of computation</Text>
                        <Text className="text-gray-700 text-xs leading-5">
                            1. Net kilos = gross weight − tare weight{'\n'}
                            2. Cumulative kilos = running total for the cycle{'\n'}
                            3. Raw kilo earnings = cumulative kilos × rate per kilo{'\n'}
                            4. Target cumulative payout = max(raw kilo earnings, guaranteed minimum){'\n'}
                            5. Net payout due this week = target cumulative payout − previous cumulative payout
                        </Text>
                    </View>
                    <ManualCard
                        title="Guaranteed Minimum"
                        value="Floor payout"
                        description="If the per-kilo earnings fall short of the agreed guarantee, the guarantee sets the target cumulative payout. The shortfall is a company cost, never a deduction from the land owner."
                    />
                    <ManualCard
                        title="Settlement Status"
                        value="Unpaid → Paid"
                        description="A settlement stays open until the disbursement date and receipt reference are recorded; the payout then posts Dr 2035 (Land Owner Crop Share Payable) against cash."
                    />
                </Accordion>

                <Accordion title="4. Capital Partners & Equity" icon="groups">
                    <Text className="text-gray-600 mb-4 leading-6">
                        Farming operations are funded by capital partners (BioGreen fund). Partner equity is tracked per cycle in the investor ledger.
                    </Text>
                    <ManualCard
                        title="Project Equity Account"
                        value="3015"
                        description="Agribusiness Project Equity / BioGreen Fund (3015) carries partner investment and partner equity in farming operations, separate from ordinary share capital (3010)."
                    />
                    <ManualCard
                        title="Partner Ledger"
                        value="Per cycle"
                        description="Each ledger row records the transaction date, type, kilos received, price per kilo, amount and the running balance for that partner and cycle."
                    />
                    <ManualCard
                        title="Offtake Revenue"
                        value="4140 / 4145"
                        description="Harvest and offtake sales credit Crop Harvest Sales & Offtake Revenue (4140); stalks, cuttings and by-products credit By-Product Sales Revenue (4145)."
                    />
                </Accordion>

                <Accordion title="5. Accounting & Auto-Posting" icon="menu-book">
                    <Text className="text-gray-600 mb-4 leading-6">
                        Operations post automatically to the General Ledger. Every entry is balanced; unbalanced entries are rejected.
                    </Text>
                    <View className="bg-slate-100 p-4 rounded-2xl">
                        <View className="flex-row justify-between mb-2 border-b border-gray-200 pb-1">
                            <Text className="text-gray-800 font-bold text-xs flex-1">Transaction Type</Text>
                            <Text className="text-gray-800 font-bold text-xs w-16 text-center">Debit</Text>
                            <Text className="text-gray-800 font-bold text-xs w-16 text-center">Credit</Text>
                        </View>
                        <Text className="text-gray-700 text-xs py-1 border-b border-gray-100">Farm expense paid: DR 5xxx (Expense) / CR 1010 (Cash)</Text>
                        <Text className="text-gray-700 text-xs py-1 border-b border-gray-100">Settlement payout: DR 2035 (Crop Share Payable) / CR 1010 (Cash)</Text>
                        <Text className="text-gray-700 text-xs py-1 border-b border-gray-100">Field wages paid: DR 2036 (Wages Payable) / CR 1010 (Cash)</Text>
                        <Text className="text-gray-700 text-xs py-1 border-b border-gray-100">Offtake collection: DR 1010 (Cash) / CR 4140 (Harvest Revenue)</Text>
                        <Text className="text-gray-700 text-xs py-1">Partner funding in: DR 1020 (Cash in Bank) / CR 3015 (Project Equity)</Text>
                    </View>
                </Accordion>

                <View className="h-10" />
            </ScrollView>
        </SafeAreaView>
    );
}
