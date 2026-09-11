import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { useAuth } from '../../src/store/AuthContext';
import { formatPHP } from '../../src/utils/currency';
import { Ionicons } from '@expo/vector-icons';

// Area Jumar 16 Stores Ground Truth
const JUMAR_BRANCHES = [
    { name: 'Locsin (Dumaguete)', target: 800000, actual: 884000, foodCost: 63.8, spoilage: 420 },
    { name: 'NOPH Main Gate', target: 750000, actual: 812000, foodCost: 64.1, spoilage: 650 },
    { name: 'Dumaguete Port Terminal', target: 700000, actual: 745000, foodCost: 64.9, spoilage: 380 },
    { name: 'Zamboanga St. (Zambo)', target: 650000, actual: 690000, foodCost: 64.5, spoilage: 510 },
    { name: 'Daro Crossing', target: 600000, actual: 620000, foodCost: 65.0, spoilage: 490 },
    { name: 'Bagacay (Benchmark)', target: 500000, actual: 512383, foodCost: 64.97, spoilage: 490 },
    { name: 'Batinguel Highway', target: 500000, actual: 485000, foodCost: 65.4, spoilage: 580 },
    { name: 'Junob Poblacion', target: 450000, actual: 440000, foodCost: 65.1, spoilage: 410 },
    { name: 'Bacong 1 Highway', target: 450000, actual: 430000, foodCost: 65.8, spoilage: 720 },
    { name: 'Bacong 2 Market', target: 400000, actual: 390000, foodCost: 65.6, spoilage: 430 },
    { name: 'Sta. Rosa Commercial', target: 400000, actual: 395000, foodCost: 64.7, spoilage: 350 },
    { name: 'Dalaguete Town', target: 380000, actual: 375000, foodCost: 65.2, spoilage: 460 },
    { name: 'Tinago Seaside', target: 350000, actual: 340000, foodCost: 65.9, spoilage: 590 },
    { name: 'Lilo-an Pier', target: 350000, actual: 335000, foodCost: 65.5, spoilage: 480 },
    { name: 'Santander Port', target: 320000, actual: 310000, foodCost: 66.1, spoilage: 840 },
    { name: 'Larena (Siquijor)', target: 300000, actual: 280000, foodCost: 66.8, spoilage: 920 },
];

export default function AreaSupervisorDashboard() {
    const { user, areaId } = useAuth();
    const activeArea = areaId || 'Area Jumar (Dumaguete Cluster)';

    const totalAreaSales = JUMAR_BRANCHES.reduce((sum, b) => sum + b.actual, 0);
    const totalAreaTarget = JUMAR_BRANCHES.reduce((sum, b) => sum + b.target, 0);
    const avgFoodCost = (JUMAR_BRANCHES.reduce((sum, b) => sum + b.foodCost, 0) / JUMAR_BRANCHES.length).toFixed(1);
    const totalSpoilage = JUMAR_BRANCHES.reduce((sum, b) => sum + b.spoilage, 0);

    const [verifiedCount, setVerifiedCount] = useState<number>(0);

    const handleAcknowledgeDelivery = () => {
        setVerifiedCount((prev) => prev + 1);
        Alert.alert('Delivery Verified', 'DSP-20260714-1042 verified and approved for Locsin branch.');
    };

    return (
        <ScrollView className="flex-1 bg-slate-50 p-4">
            {/* Area Header Card */}
            <View className="bg-amber-800 rounded-xl p-5 mb-4 shadow-sm">
                <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-amber-200 text-xs font-semibold uppercase tracking-wider">
                        Crispy King Area Supervision
                    </Text>
                    <View className="bg-amber-700 px-3 py-1 rounded-full">
                        <Text className="text-white text-xs font-medium">16 Stores Scoped</Text>
                    </View>
                </View>
                <Text className="text-white text-2xl font-bold">{activeArea}</Text>
                <Text className="text-amber-100 text-sm mt-1">
                    Supervisor: {user?.email || 'Jumar'}
                </Text>
            </View>

            {/* Quick KPI Row */}
            <View className="flex-row justify-between mb-4">
                <View className="flex-1 bg-white p-4 rounded-xl mr-2 shadow-sm border border-slate-200">
                    <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                        Area Monthly Sales
                    </Text>
                    <Text className="text-slate-900 text-xl font-extrabold mt-1">
                        {formatPHP(totalAreaSales)}
                    </Text>
                    <Text className="text-emerald-600 text-xs font-semibold mt-1">
                        Target: {formatPHP(totalAreaTarget)}
                    </Text>
                </View>
                <View className="flex-1 bg-white p-4 rounded-xl ml-2 shadow-sm border border-slate-200">
                    <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                        Average Food Cost
                    </Text>
                    <Text className="text-amber-700 text-xl font-extrabold mt-1">{avgFoodCost}%</Text>
                    <Text className="text-slate-500 text-xs mt-1">Benchmark Target ≤65%</Text>
                </View>
            </View>

            {/* Action Items & Variance Approvals */}
            <View className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-4">
                <Text className="text-slate-900 font-bold text-base mb-2">
                    Supervisor Action Items & Approvals
                </Text>

                {verifiedCount === 0 ? (
                    <View className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
                        <View className="flex-row items-center justify-between mb-1">
                            <Text className="text-amber-900 font-bold text-xs">
                                ⚠️ Shortage Variance Flag — Locsin Branch
                            </Text>
                            <TouchableOpacity
                                onPress={handleAcknowledgeDelivery}
                                className="bg-amber-800 px-2.5 py-1 rounded"
                            >
                                <Text className="text-white font-bold text-xs">Approve Adjustments</Text>
                            </TouchableOpacity>
                        </View>
                        <Text className="text-amber-800 text-xs">
                            Store reported -15 pcs S-Cut chicken on DSP-20260714-1042. Needs supervisor sign-off.
                        </Text>
                    </View>
                ) : (
                    <View className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 mb-2">
                        <Text className="text-emerald-800 text-xs font-semibold">
                            ✓ All pending delivery variances acknowledged and approved.
                        </Text>
                    </View>
                )}

                <View className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <Text className="text-slate-700 font-bold text-xs">
                        💰 Field Cash Remittances:
                    </Text>
                    <Text className="text-slate-600 text-xs mt-0.5">
                        16 of 16 stores submitted daily cash drop slips matching register Z-Readings.
                    </Text>
                </View>
            </View>

            {/* Store Targets vs Actuals Table */}
            <View className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
                <View className="bg-slate-100 p-3 border-b border-slate-200 flex-row justify-between items-center">
                    <Text className="text-slate-900 font-bold text-sm">
                        Store Performance Leaderboard (16 Stores)
                    </Text>
                    <Text className="text-slate-500 text-xs">Target vs Actual</Text>
                </View>

                {JUMAR_BRANCHES.map((b, idx) => {
                    const achieved = b.actual >= b.target;
                    const percent = Math.round((b.actual / b.target) * 100);

                    return (
                        <View
                            key={idx}
                            className={`p-3 border-b border-slate-100 flex-row justify-between items-center ${
                                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                            }`}
                        >
                            <View className="flex-1 mr-2">
                                <Text className="text-slate-900 font-bold text-xs">
                                    {idx + 1}. {b.name}
                                </Text>
                                <Text className="text-slate-500 text-xs">
                                    FC: <Text className={b.foodCost <= 65 ? 'text-emerald-700 font-semibold' : 'text-rose-600 font-bold'}>{b.foodCost}%</Text> • Spoilage: {formatPHP(b.spoilage)}
                                </Text>
                            </View>

                            <View className="items-end">
                                <Text className="text-slate-900 font-bold text-xs">
                                    {formatPHP(b.actual)}
                                </Text>
                                <Text
                                    className={`text-xs font-semibold ${
                                        achieved ? 'text-emerald-700' : 'text-amber-700'
                                    }`}
                                >
                                    {percent}% of target
                                </Text>
                            </View>
                        </View>
                    );
                })}
            </View>
        </ScrollView>
    );
}
