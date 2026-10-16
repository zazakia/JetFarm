import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import AgriCropCycle from '../../../src/database/models/AgriCropCycle';
import AgriParcel from '../../../src/database/models/AgriParcel';
import AgriHarvestLog from '../../../src/database/models/AgriHarvestLog';
import { AgriHarvestService, HarvestSummary } from '../../../src/services/AgriHarvestService';
import { formatPHP } from '../../../src/utils/currency';
import { Q } from '@nozbe/watermelondb';
import { TransactionConfirmationBanner } from '../../../src/components/TransactionConfirmationBanner';
import Toast from '../../../src/components/AppToast';

export default function HarvestWeighInScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [confirmation, setConfirmation] = useState<{
        title: string;
        message: string;
        batchNumber?: string;
    } | null>(null);

    // Form inputs
    const [cycles, setCycles] = useState<AgriCropCycle[]>([]);
    const [selectedCycleId, setSelectedCycleId] = useState<string>(params.cropCycleId as string || '');
    const [grossWeight, setGrossWeight] = useState('');
    const [tareWeight, setTareWeight] = useState('');
    const [truckPlate, setTruckPlate] = useState('');
    const [supervisorName, setSupervisorName] = useState('Mr. Jojet Montera');
    const [qualityGrade, setQualityGrade] = useState('Grade A');
    const [notes, setNotes] = useState('');

    // Harvest logs & summary
    const [harvestLogs, setHarvestLogs] = useState<AgriHarvestLog[]>([]);
    const [summary, setSummary] = useState<HarvestSummary>({
        totalBatches: 0,
        totalGrossKg: 0,
        totalTareKg: 0,
        totalNetKg: 0,
        averageNetPerBatch: 0,
        firstHarvestDate: null,
        latestHarvestDate: null,
    });

    const netKg = AgriHarvestService.calculateNetWeight(
        parseFloat(grossWeight) || 0,
        parseFloat(tareWeight) || 0
    );

    const loadData = async () => {
        try {
            const cycleList = await database
                .get<AgriCropCycle>('agri_crop_cycles')
                .query(
                    Q.where('deleted_at', null),
                    Q.sortBy('planting_date', Q.desc)
                )
                .fetch();
            setCycles(cycleList);

            let cycleId = selectedCycleId;
            if (!cycleId && cycleList.length > 0) {
                cycleId = cycleList[0].id;
                setSelectedCycleId(cycleId);
            }

            if (cycleId) {
                const logs = await database
                    .get<AgriHarvestLog>('agri_harvest_logs')
                    .query(
                        Q.where('crop_cycle_id', cycleId),
                        Q.where('deleted_at', null),
                        Q.sortBy('harvest_date', Q.desc)
                    )
                    .fetch();
                setHarvestLogs(logs);

                const sum = await AgriHarvestService.getCycleHarvestSummary(cycleId);
                setSummary(sum);
            }
        } catch (err) {
            console.error('[HarvestWeighIn] Error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [selectedCycleId])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleLogWeighIn = async () => {
        if (!selectedCycleId) {
            Alert.alert('Validation Error', 'Please select a crop cycle.');
            return;
        }

        const gross = parseFloat(grossWeight);
        const tare = parseFloat(tareWeight);

        if (isNaN(gross) || isNaN(tare) || gross <= 0 || tare < 0) {
            Alert.alert('Scale Error', 'Please enter valid numbers for Gross and Tare weights.');
            return;
        }

        if (netKg <= 0) {
            Alert.alert('Scale Error', 'Gross weight must be greater than tare weight.');
            return;
        }

        setSaving(true);
        try {
            const cycle = cycles.find(c => c.id === selectedCycleId);
            if (!cycle) throw new Error('Selected cycle not found');

            const savedLog = await AgriHarvestService.logWeighIn({
                cropCycleId: cycle.id,
                parcelId: cycle.parcelId,
                grossWeightKg: gross,
                tareWeightKg: tare,
                qualityGrade,
                truckPlateNumber: truckPlate.trim() || undefined,
                weighInSupervisor: supervisorName.trim() || undefined,
                notes: notes.trim() || undefined,
            });

            // Reset inputs
            setGrossWeight('');
            setTareWeight('');
            setTruckPlate('');
            setNotes('');
            loadData();

            const batchCode = savedLog.batchNumber;
            const message = `Recorded ${netKg.toLocaleString()} net kg (${qualityGrade}) for cycle ${cycle.cycleCode}. Total harvest and investor off-take ledger have been automatically updated.`;

            setConfirmation({
                title: 'Weigh-in Batch Saved Successfully',
                message,
                batchNumber: batchCode,
            });

            Toast.show({
                type: 'success',
                text1: 'Weigh-in Batch Saved',
                text2: `${batchCode} • ${netKg.toLocaleString()} net kg`,
            });

            Alert.alert('Weigh-In Saved', message);
        } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to log weigh-in');
        } finally {
            setSaving(false);
        }
    };

    const selectedCycle = cycles.find(c => c.id === selectedCycleId);

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            contentContainerStyle={{ padding: 20 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Header */}
            <View className="mb-6">
                <Text className="text-2xl font-black text-gray-900">Field Weigh-in Scale Terminal</Text>
                <Text className="text-sm text-gray-500 mt-0.5">
                    Live gross / tare truck scale logger with automatic off-take ledger linkage
                </Text>
            </View>

            {/* Cycle Selector */}
            <View className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6">
                <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Active Crop Cycle
                </Text>
                {cycles.length === 0 ? (
                    <Text className="text-xs text-gray-400">No active cycles available.</Text>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                        {cycles.map(c => (
                            <Pressable
                                key={c.id}
                                onPress={() => setSelectedCycleId(c.id)}
                                className={`px-4 py-2 rounded-xl border ${
                                    selectedCycleId === c.id
                                        ? 'bg-amber-800 border-amber-800'
                                        : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                                }`}
                            >
                                <Text
                                    className={`text-xs font-bold ${
                                        selectedCycleId === c.id ? 'text-white' : 'text-gray-800'
                                    }`}
                                >
                                    {c.cycleCode} ({c.variety || 'Cassava'})
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                )}
            </View>

            {/* Weigh-in Scale Terminal Card */}
            <View className="bg-white rounded-3xl p-6 border border-gray-200 shadow-md mb-6">
                <View className="flex-row items-center justify-between pb-4 border-b border-gray-100 mb-4">
                    <View className="flex-row items-center gap-2">
                        <View className="w-10 h-10 rounded-xl bg-amber-500 items-center justify-center">
                            <MaterialIcons name="scale" size={24} color="#FFFFFF" />
                        </View>
                        <View>
                            <Text className="text-lg font-black text-gray-900">Digital Scale Entry</Text>
                            <Text className="text-xs text-gray-500">Record truck scale weigh-in</Text>
                        </View>
                    </View>
                    {selectedCycle && (
                        <View className="bg-emerald-100 px-3 py-1 rounded-full">
                            <Text className="text-emerald-800 text-xs font-bold">
                                Off-take: {formatPHP(selectedCycle.offtakePricePerKg)}/kg
                            </Text>
                        </View>
                    )}
                </View>

                {/* Net Weight Display Box */}
                <View className="bg-amber-50 rounded-2xl p-4 border border-amber-200 mb-5 items-center justify-center">
                    <Text className="text-amber-800 text-xs font-bold uppercase tracking-wider">
                        Computed Net Weight
                    </Text>
                    <Text className="text-4xl font-black text-amber-900 my-1">
                        {netKg.toLocaleString()} <Text className="text-lg font-semibold text-amber-700">kg</Text>
                    </Text>
                    <Text className="text-xs text-amber-700">
                        {netKg >= 1000 ? `${(netKg / 1000).toFixed(2)} Metric Tons` : 'Single Batch Weigh-in'}
                        {selectedCycle && netKg > 0
                            ? ` • Delivery Value: ${formatPHP(netKg * selectedCycle.offtakePricePerKg)}`
                            : ''}
                    </Text>
                </View>

                {/* Gross and Tare Inputs */}
                <View className="flex-row gap-3 mb-4">
                    <View className="flex-1">
                        <Text className="text-xs font-bold text-gray-700 mb-1">Gross Weight (kg) *</Text>
                        <TextInput
                            value={grossWeight}
                            onChangeText={setGrossWeight}
                            placeholder="e.g. 14200"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3.5 text-base font-bold text-gray-900"
                        />
                    </View>
                    <View className="flex-1">
                        <Text className="text-xs font-bold text-gray-700 mb-1">Tare Weight (kg) *</Text>
                        <TextInput
                            value={tareWeight}
                            onChangeText={setTareWeight}
                            placeholder="e.g. 4100"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3.5 text-base font-bold text-gray-900"
                        />
                    </View>
                </View>

                {/* Truck Plate and Grade */}
                <View className="flex-row gap-3 mb-4">
                    <View className="flex-1">
                        <Text className="text-xs font-bold text-gray-700 mb-1">Truck Plate Number</Text>
                        <TextInput
                            value={truckPlate}
                            onChangeText={setTruckPlate}
                            placeholder="ABC-1234"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900"
                        />
                    </View>
                    <View className="flex-1">
                        <Text className="text-xs font-bold text-gray-700 mb-1">Quality Grade</Text>
                        <View className="flex-row gap-1">
                            {['Grade A', 'Grade B', 'Industrial'].map(grd => (
                                <Pressable
                                    key={grd}
                                    onPress={() => setQualityGrade(grd)}
                                    className={`flex-1 py-3 rounded-xl border items-center ${
                                        qualityGrade === grd
                                            ? 'bg-amber-800 border-amber-800'
                                            : 'bg-gray-50 border-gray-200'
                                    }`}
                                >
                                    <Text
                                        className={`text-[10px] font-bold ${
                                            qualityGrade === grd ? 'text-white' : 'text-gray-700'
                                        }`}
                                    >
                                        {grd}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>
                </View>

                <Text className="text-xs font-bold text-gray-700 mb-1">Weigh-in Scale Supervisor</Text>
                <TextInput
                    value={supervisorName}
                    onChangeText={setSupervisorName}
                    placeholder="Supervisor Name"
                    placeholderTextColor="#9CA3AF"
                    className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-4"
                />

                {/* Save Weigh-in Button */}
                <Pressable
                    onPress={handleLogWeighIn}
                    disabled={saving}
                    className="bg-amber-700 p-4 rounded-2xl items-center active:bg-amber-800 shadow-sm"
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Text className="text-white font-bold text-base">Record Weigh-in Batch</Text>
                    )}
                </Pressable>
            </View>

            {/* Confirmation Banner */}
            {confirmation && (
                <TransactionConfirmationBanner
                    title={confirmation.title}
                    message={confirmation.message}
                    transactionCode={confirmation.batchNumber}
                    onDismiss={() => setConfirmation(null)}
                />
            )}

            {/* Cycle Harvest Summary KPIs */}
            <View className="flex-row flex-wrap gap-3 mb-6">
                <View className="flex-1 min-w-[140px] bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                    <Text className="text-xs font-bold text-gray-500 uppercase">Batches Logged</Text>
                    <Text className="text-2xl font-black text-gray-900 mt-1">{summary.totalBatches}</Text>
                </View>
                <View className="flex-1 min-w-[140px] bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                    <Text className="text-xs font-bold text-gray-500 uppercase">Total Net Harvest</Text>
                    <Text className="text-2xl font-black text-emerald-800 mt-1">
                        {summary.totalNetKg.toLocaleString()} kg
                    </Text>
                </View>
                <View className="flex-1 min-w-[140px] bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                    <Text className="text-xs font-bold text-gray-500 uppercase">Avg per Truck</Text>
                    <Text className="text-2xl font-black text-gray-900 mt-1">
                        {summary.averageNetPerBatch.toLocaleString()} kg
                    </Text>
                </View>
            </View>

            {/* Harvest Logs History Table */}
            <Text className="text-lg font-black text-gray-900 mb-3">Logged Harvest Batches</Text>
            {harvestLogs.length === 0 ? (
                <View className="bg-white p-6 rounded-2xl border border-gray-200 items-center">
                    <Text className="text-gray-500 text-xs">No weigh-in batches recorded for this cycle yet.</Text>
                </View>
            ) : (
                <View className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    {harvestLogs.map((log, index) => (
                        <View
                            key={log.id}
                            className={`p-4 flex-row justify-between items-center ${
                                index !== harvestLogs.length - 1 ? 'border-b border-gray-100' : ''
                            }`}
                        >
                            <View>
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-sm font-bold text-gray-900">{log.batchNumber}</Text>
                                    <View className="bg-amber-100 px-2 py-0.5 rounded-full">
                                        <Text className="text-amber-800 text-[10px] font-bold">
                                            {log.qualityGrade || 'Grade A'}
                                        </Text>
                                    </View>
                                </View>
                                <Text className="text-xs text-gray-500 mt-0.5">
                                    Truck: {log.truckPlateNumber || 'Unassigned'} • Supervisor: {log.weighInSupervisor || 'Jet'}
                                </Text>
                                <Text className="text-[10px] text-gray-400">
                                    Gross: {log.grossWeightKg.toLocaleString()} kg | Tare: {log.tareWeightKg.toLocaleString()} kg
                                </Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-base font-black text-emerald-800">
                                    {log.netWeightKg.toLocaleString()} kg
                                </Text>
                                <Text className="text-[10px] text-gray-400">
                                    {new Date(log.harvestDate).toISOString().split('T')[0]}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
    );
}
