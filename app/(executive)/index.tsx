import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useAuth } from '../../src/store/AuthContext';
import { RoyaltyService } from '../../src/services/RoyaltyService';
import RoyaltyCalculation from '../../src/database/models/RoyaltyCalculation';
import { formatPHP } from '../../src/utils/currency';
import { Ionicons } from '@expo/vector-icons';

// 39 Branches across 4 Supervisors
const AREA_BREAKDOWNS = [
    {
        name: 'Area Jumar (Dumaguete Cluster)',
        supervisor: 'Jumar',
        storeCount: 16,
        monthlySales: 10450000,
        cogsRatio: 64.8,
        stores: 'Locsin, NOPH, Zambo, Daro, Sta. Rosa, Dalaguete, Bacong 1, Batinguel, Junob, Bagacay, Larena, Bacong 2, Lilo-an, Tinago, Santander, Dumaguete Port',
    },
    {
        name: 'Area Baby Ann (North Oriental Cluster)',
        supervisor: 'Baby Ann',
        storeCount: 8,
        monthlySales: 5320000,
        cogsRatio: 65.2,
        stores: 'Tayasan, Ayungon 1, Ayungon 2, Bindoy 1, Bindoy 2, Guihulngan, Jimalalud, Manjuyod',
    },
    {
        name: 'Area Christian (South/Central Cluster)',
        supervisor: 'Christian',
        storeCount: 7,
        monthlySales: 4780000,
        cogsRatio: 65.5,
        stores: 'Bayawan, Mabinay 1, Mabinay 2, Pamplona, Sta. Agueda, Tanjay 1, Tanjay 2',
    },
    {
        name: 'Area Renor (Occidental Cluster)',
        supervisor: 'Renor',
        storeCount: 8,
        monthlySales: 5306162,
        cogsRatio: 65.1,
        stores: 'Sagay 1, San Carlos 2, Sagay 2, San Carlos 1, Quezon, San Carlos 5, San Carlos 7, Canla-on',
    },
];

const TOP_BRANCHES = [
    { name: 'Locsin (Dumaguete)', sales: 884000, margin: 8.2 },
    { name: 'NOPH Main Gate', sales: 812000, margin: 7.9 },
    { name: 'Dumaguete Port Terminal', sales: 745000, margin: 7.4 },
    { name: 'Zamboanga St. (Zambo)', sales: 690000, margin: 7.1 },
    { name: 'Bagacay (Benchmark)', sales: 512383, margin: 3.72 },
];

const BOTTOM_BRANCHES = [
    { name: 'Canla-on Mountain', sales: 295000, margin: 2.1 },
    { name: 'Larena (Siquijor)', sales: 280000, margin: 1.8 },
    { name: 'Bindoy 2 Sub', sales: 265000, margin: 1.4 },
    { name: 'Mabinay 2 Highway', sales: 250000, margin: 1.1 },
    { name: 'Ayungon 2 Poblacion', sales: 235000, margin: 0.8 },
];

export default function ExecutiveDashboard() {
    const { user } = useAuth();
    const [settlementPending, setSettlementPending] = useState<boolean>(false);
    const [activeRoyalty, setActiveRoyalty] = useState<RoyaltyCalculation | null>(null);
    const [approving, setApproving] = useState<boolean>(false);

    // Baseline enterprise values
    const consolidatedGrossSales = 25856162.0; // ₱25.86M
    const consolidatedCOGS = 16806505.3;      // 65.00%
    const consolidatedOPEX = 7249725.36;      // 28.04%
    const consolidatedNet = 1800778.0;        // 6.96%
    const operatorShare80 = 1440622.4;
    const franchisorShare20 = 360155.6;

    useEffect(() => {
        // Load latest royalty record
        (async () => {
            try {
                const list = await RoyaltyService.getRoyalties(2026, 7);
                if (list.length > 0) {
                    setActiveRoyalty(list[0]);
                }
            } catch (err) {
                console.warn('Could not fetch royalty records:', err);
            }
        })();
    }, []);

    const handleApproveSettlement = async () => {
        try {
            setApproving(true);
            const approver = user?.email || 'Executive Viterbo';

            let royaltyToApprove = activeRoyalty;
            if (!royaltyToApprove) {
                royaltyToApprove = await RoyaltyService.calculateMonthlyRoyalty({
                    branchId: 'network-consolidated',
                    year: 2026,
                    month: 7,
                    grossSales: consolidatedGrossSales,
                    cogs: consolidatedCOGS,
                    opex: consolidatedOPEX,
                    notes: 'Consolidated 39-store network July 2026',
                });
            }

            const updated = await RoyaltyService.approveRoyaltySettlement(royaltyToApprove.id, approver);
            setActiveRoyalty(updated);
            Alert.alert(
                'Settlement Approved & Posted',
                `AP Voucher created for ${formatPHP(franchisorShare20)} to ERT-Crispy King Ventures Inc.`
            );
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to approve royalty settlement.');
        } finally {
            setApproving(false);
        }
    };

    return (
        <ScrollView className="flex-1 bg-slate-50 p-4">
            {/* Enterprise Header Banner */}
            <View className="bg-purple-900 rounded-xl p-5 mb-4 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-purple-200 text-xs font-semibold uppercase tracking-wider">
                        Crispy King Consolidated Network
                    </Text>
                    <View className="bg-purple-800 px-3 py-1 rounded-full">
                        <Text className="text-white text-xs font-medium">39 Active Branches</Text>
                    </View>
                </View>
                <Text className="text-white text-3xl font-extrabold">{formatPHP(consolidatedGrossSales)}</Text>
                <Text className="text-purple-200 text-sm mt-1">
                    Viterbo Foods OPC — Consolidated Monthly Revenue (31 Days)
                </Text>
            </View>

            {/* Key Efficiency Gauges */}
            <View className="flex-row justify-between mb-4">
                <View className="flex-1 bg-white p-4 rounded-xl mr-2 shadow-sm border border-slate-200">
                    <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                        Network COGS %
                    </Text>
                    <Text className="text-slate-900 text-xl font-extrabold mt-1">65.00%</Text>
                    <Text className="text-emerald-600 text-xs font-semibold mt-1">✓ On Target (≤65%)</Text>
                </View>
                <View className="flex-1 bg-white p-4 rounded-xl ml-2 shadow-sm border border-slate-200">
                    <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                        Chicken Heads Sold
                    </Text>
                    <Text className="text-amber-700 text-xl font-extrabold mt-1">48,125 hds</Text>
                    <Text className="text-slate-500 text-xs mt-1">385,000 S-Cuts</Text>
                </View>
            </View>

            {/* 80/20 Franchise Royalty Settlement Card */}
            <View className="bg-white p-4 rounded-xl border border-purple-200 shadow-sm mb-4">
                <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-slate-900 font-bold text-base">
                        80/20 Franchise Royalty Settlement
                    </Text>
                    <View className={`px-2.5 py-0.5 rounded-full ${activeRoyalty?.status === 'approved' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                        <Text className={`text-xs font-bold ${activeRoyalty?.status === 'approved' ? 'text-emerald-800' : 'text-amber-800'}`}>
                            {activeRoyalty?.status === 'approved' ? '✓ Settled & AP Posted' : 'Pending Approval'}
                        </Text>
                    </View>
                </View>

                <View className="flex-row justify-between border-b border-slate-100 pb-2 mb-2">
                    <Text className="text-slate-600 text-xs">Viterbo Foods OPC (80% Operator Share)</Text>
                    <Text className="text-slate-900 font-bold text-sm">{formatPHP(operatorShare80)}</Text>
                </View>
                <View className="flex-row justify-between border-b border-slate-100 pb-2 mb-3">
                    <Text className="text-slate-600 text-xs">ERT-Crispy King Ventures Inc. (20% Royalty)</Text>
                    <Text className="text-purple-900 font-bold text-sm">{formatPHP(franchisorShare20)}</Text>
                </View>

                <TouchableOpacity
                    onPress={handleApproveSettlement}
                    disabled={approving || activeRoyalty?.status === 'approved'}
                    className={`rounded-lg p-3 items-center justify-center ${
                        activeRoyalty?.status === 'approved'
                            ? 'bg-slate-100 border border-slate-200'
                            : 'bg-purple-900 shadow-sm'
                    }`}
                >
                    {approving ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <Text
                            className={`font-bold text-xs ${
                                activeRoyalty?.status === 'approved'
                                    ? 'text-slate-500'
                                    : 'text-white'
                            }`}
                        >
                            {activeRoyalty?.status === 'approved'
                                ? '✓ AP Voucher Posted to Books (ERT-Crispy King)'
                                : 'Approve & Post 20% Royalty AP Voucher'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* 4 Area Supervisor Networks */}
            <Text className="text-slate-800 text-base font-bold mb-3">
                Supervisory Networks (39 Stores)
            </Text>
            <View className="space-y-3 mb-4">
                {AREA_BREAKDOWNS.map((area, idx) => (
                    <View
                        key={idx}
                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-3"
                    >
                        <View className="flex-row justify-between items-center mb-1">
                            <Text className="text-slate-900 font-bold text-sm">{area.name}</Text>
                            <Text className="text-purple-900 font-bold text-sm">
                                {formatPHP(area.monthlySales)}
                            </Text>
                        </View>
                        <Text className="text-slate-500 text-xs mb-2">
                            Supervisor: <Text className="font-semibold text-slate-800">{area.supervisor}</Text> • {area.storeCount} Stores • Food Cost: {area.cogsRatio}%
                        </Text>
                        <View className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <Text className="text-slate-600 text-xs leading-4">{area.stores}</Text>
                        </View>
                    </View>
                ))}
            </View>

            {/* Store Performance Leaderboard */}
            <View className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-4">
                <Text className="text-slate-900 font-bold text-base mb-3">
                    Branch Sales & Margin Rankings
                </Text>

                <Text className="text-emerald-700 font-bold text-xs mb-2 uppercase tracking-wider">
                    Top 5 Revenue Stores
                </Text>
                {TOP_BRANCHES.map((b, i) => (
                    <View key={i} className="flex-row justify-between py-1.5 border-b border-slate-100">
                        <Text className="text-slate-800 text-xs font-medium">
                            {i + 1}. {b.name}
                        </Text>
                        <View className="flex-row items-center">
                            <Text className="text-slate-900 font-bold text-xs mr-3">
                                {formatPHP(b.sales)}
                            </Text>
                            <Text className="text-emerald-700 font-semibold text-xs">
                                {b.margin}% Net
                            </Text>
                        </View>
                    </View>
                ))}

                <Text className="text-rose-700 font-bold text-xs mt-4 mb-2 uppercase tracking-wider">
                    Bottom 5 Stores (Focus Areas)
                </Text>
                {BOTTOM_BRANCHES.map((b, i) => (
                    <View key={i} className="flex-row justify-between py-1.5 border-b border-slate-100">
                        <Text className="text-slate-800 text-xs font-medium">
                            {i + 1}. {b.name}
                        </Text>
                        <View className="flex-row items-center">
                            <Text className="text-slate-900 font-bold text-xs mr-3">
                                {formatPHP(b.sales)}
                            </Text>
                            <Text className="text-rose-600 font-semibold text-xs">
                                {b.margin}% Net
                            </Text>
                        </View>
                    </View>
                ))}
            </View>

            {/* Network Health Alerts */}
            <View className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-8">
                <Text className="text-slate-900 font-bold text-base mb-2">
                    Network Quality & Variance Alerts
                </Text>
                <View className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
                    <Text className="text-amber-900 font-bold text-xs">
                        ⚠️ Delivery Shortage in Area Jumar:
                    </Text>
                    <Text className="text-amber-800 text-xs mt-0.5">
                        Locsin store reported -15 pcs S-Cut chicken shortage on DSP-20260714-1042.
                    </Text>
                </View>
                <View className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                    <Text className="text-rose-900 font-bold text-xs">
                        🔥 High Spoilage Flag in Area Christian:
                    </Text>
                    <Text className="text-rose-800 text-xs mt-0.5">
                        Bayawan store logged ₱4,200 burnt chicken loss during deep fryer thermostat surge.
                    </Text>
                </View>
            </View>
        </ScrollView>
    );
}
