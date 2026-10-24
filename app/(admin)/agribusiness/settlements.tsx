import React, { useState, useCallback } from 'react';
import { usePageContentStyle } from '../../../src/hooks/useResponsiveLayout';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, Modal, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import AgriCropCycle from '../../../src/database/models/AgriCropCycle';
import AgriParcel from '../../../src/database/models/AgriParcel';
import AgriLandOwner from '../../../src/database/models/AgriLandOwner';
import AgriWeeklySettlement from '../../../src/database/models/AgriWeeklySettlement';
import { LandSettlementEngine } from '../../../src/services/LandSettlementEngine';
import { formatPHP } from '../../../src/utils/currency';
import { Q } from '@nozbe/watermelondb';
import { TransactionConfirmationBanner } from '../../../src/components/TransactionConfirmationBanner';
import Toast from '../../../src/components/AppToast';

export default function WeeklySettlementsScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();

    const pageContentStyle = usePageContentStyle();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

    const [cycles, setCycles] = useState<AgriCropCycle[]>([]);
    const [selectedCycleId, setSelectedCycleId] = useState<string>(params.cropCycleId as string || '');
    const [settlements, setSettlements] = useState<Array<{ settlement: AgriWeeklySettlement; landOwnerName: string; cycleCode: string }>>([]);

    // Week selector for computation
    const [weekNumber, setWeekNumber] = useState('1');

    // Settlement Slip Modal
    const [slipModalVisible, setSlipModalVisible] = useState(false);
    const [activeSlipText, setActiveSlipText] = useState('');

    // Disburse modal
    const [disburseModalVisible, setDisburseModalVisible] = useState(false);
    const [activeSettlementId, setActiveSettlementId] = useState('');
    const [receiptRef, setReceiptRef] = useState('');
    const [savingDisbursement, setSavingDisbursement] = useState(false);

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

            const clauses: any[] = [Q.where('deleted_at', null), Q.sortBy('week_number', Q.desc)];
            if (cycleId) {
                clauses.push(Q.where('crop_cycle_id', cycleId));
            }

            const rawSettlements = await database
                .get<AgriWeeklySettlement>('agri_weekly_settlements')
                .query(...clauses)
                .fetch();

            const formatted: any[] = [];
            for (const s of rawSettlements) {
                let ownerName = 'Land Owner';
                let cycleCode = 'Cycle';
                let parcelName = 'Assigned Parcel';
                try {
                    const owner = await database.get<AgriLandOwner>('agri_land_owners').find(s.landOwnerId);
                    ownerName = owner.name;
                } catch {
                    ownerName = 'Land Owner';
                }

                try {
                    const c = await database.get<AgriCropCycle>('agri_crop_cycles').find(s.cropCycleId);
                    cycleCode = c.cycleCode;
                    try {
                        const p = await database.get<AgriParcel>('agri_parcels').find(c.parcelId);
                        parcelName = p.name;
                    } catch {
                        parcelName = 'Assigned Parcel';
                    }
                } catch {
                    cycleCode = 'Cycle';
                }

                formatted.push({ settlement: s, landOwnerName: ownerName, cycleCode, parcelName });
            }
            setSettlements(formatted);

            // Suggest next week number
            if (rawSettlements.length > 0) {
                const maxWeek = Math.max(...rawSettlements.map(s => s.weekNumber));
                setWeekNumber((maxWeek + 1).toString());
            } else {
                setWeekNumber('1');
            }
        } catch (err) {
            console.error('[WeeklySettlements] Error:', err);
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

    const handleComputeSettlement = async () => {
        if (!selectedCycleId) {
            Alert.alert('Error', 'Please select a crop cycle.');
            return;
        }

        const wk = parseInt(weekNumber);
        if (isNaN(wk) || wk < 1) {
            Alert.alert('Error', 'Please enter a valid week number.');
            return;
        }

        setCalculating(true);
        try {
            const now = new Date();
            const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const weekEnd = now;

            const settlement = await LandSettlementEngine.computeWeeklySettlement(
                selectedCycleId,
                wk,
                weekStart,
                weekEnd
            );

            loadData();
            const msg = `Week ${wk} settlement computed: ${formatPHP(settlement.netPayoutDueThisWeek)} net due (Cumulative target: ${formatPHP(settlement.targetCumulativePayout)}).`;
            setConfirmationMessage(msg);
            Toast.show({
                type: 'success',
                text1: 'Settlement Computed',
                text2: msg,
            });
            Alert.alert('Settlement Computed', msg);
        } catch (error: any) {
            Alert.alert('Computation Error', error?.message || 'Failed to compute settlement.');
        } finally {
            setCalculating(false);
        }
    };

    const handleApprove = async (settlementId: string) => {
        try {
            await LandSettlementEngine.approveSettlement(settlementId, false);
            loadData();
            const msg = 'Settlement approved and authorized for weekly disbursement.';
            setConfirmationMessage(msg);
            Toast.show({
                type: 'success',
                text1: 'Settlement Approved',
                text2: msg,
            });
            Alert.alert('Approved', msg);
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to approve');
        }
    };

    const handleDeleteSettlement = (item: any) => {
        const { settlement, weekNumber } = item;
        Alert.alert(
            'Confirm Delete',
            `Are you sure you want to remove the Week ${settlement.weekNumber} settlement (${formatPHP(settlement.netPayoutDueThisWeek)})?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await LandSettlementEngine.deleteSettlement(settlement.id, 'admin-user');
                            const msg = `Week ${settlement.weekNumber} settlement removed and GL entries reversed.`;
                            setConfirmationMessage(msg);
                            Toast.show({
                                type: 'success',
                                text1: 'Settlement Removed',
                                text2: msg,
                            });
                            loadData();
                        } catch (err: any) {
                            Alert.alert('Error', err?.message || 'Failed to delete settlement');
                        }
                    },
                },
            ]
        );
    };

    const handleOpenDisburse = (settlementId: string) => {
        setActiveSettlementId(settlementId);
        setReceiptRef(`CHK-${Date.now().toString().slice(-6)}`);
        setDisburseModalVisible(true);
    };

    const handleConfirmDisbursement = async () => {
        if (!activeSettlementId) return;

        setSavingDisbursement(true);
        try {
            await LandSettlementEngine.approveSettlement(
                activeSettlementId,
                true,
                new Date(),
                receiptRef.trim() || undefined
            );

            setDisburseModalVisible(false);
            loadData();
            const msg = `Settlement marked as paid and disbursed to Land Owner (Ref: ${receiptRef || 'Check/Cash'})!`;
            setConfirmationMessage(msg);
            Toast.show({
                type: 'success',
                text1: 'Disbursement Complete',
                text2: msg,
            });
            Alert.alert('Success', msg);
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to record disbursement');
        } finally {
            setSavingDisbursement(false);
        }
    };

    const handleViewSlip = (item: any) => {
        const { settlement, landOwnerName, cycleCode, parcelName } = item;
        const slip = LandSettlementEngine.generateSettlementSlip({
            settlementId: settlement.id,
            cropCycleCode: cycleCode,
            landOwnerName,
            parcelName: parcelName || 'Assigned Parcel',
            weekNumber: settlement.weekNumber,
            weekStartDate: new Date(settlement.weekStartDate),
            weekEndDate: new Date(settlement.weekEndDate),
            cumulativeKilos: settlement.cumulativeKilos,
            ratePerKilo: settlement.ratePerKilo,
            rawKiloEarnings: settlement.rawKiloEarnings,
            guaranteedMinimum: settlement.guaranteedMinimum,
            targetCumulativePayout: settlement.targetCumulativePayout,
            previousCumulativePayout: settlement.previousCumulativePayout,
            netPayoutDueThisWeek: settlement.netPayoutDueThisWeek,
            paymentStatus: settlement.paymentStatus,
            disbursementDate: settlement.disbursementDate ? new Date(settlement.disbursementDate) : null,
            receiptReference: settlement.receiptReference,
        });

        setActiveSlipText(slip);
        setSlipModalVisible(true);
    };

    const selectedCycle = cycles.find(c => c.id === selectedCycleId);

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            contentContainerStyle={pageContentStyle}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Header */}
            <View className="mb-6">
                <Text className="text-2xl font-black text-gray-900">Land Owner Settlement Engine</Text>
                <Text className="text-sm text-gray-500 mt-0.5">
                    Guarantee-aware weekly payouts: ₱1.00/kg harvested vs ₱25,000 guaranteed minimum per cycle
                </Text>
            </View>

            {/* Inline Confirmation Banner */}
            {confirmationMessage && (
                <TransactionConfirmationBanner
                    title="Settlement Updated Successfully"
                    message={confirmationMessage}
                    onDismiss={() => setConfirmationMessage(null)}
                />
            )}

            {/* Formula Explanation Card */}
            <View className="bg-emerald-900 rounded-3xl p-5 mb-6 shadow-md text-white">
                <View className="flex-row items-center gap-2 mb-2">
                    <MaterialIcons name="shield" size={24} color="#34D399" />
                    <Text className="text-white text-base font-black">Guaranteed Minimum Audit Rule</Text>
                </View>
                <Text className="text-emerald-100 text-xs leading-5">
                    Target Cumulative Payout = <Text className="font-bold text-white">max(Cumulative Kilos × ₱1.00, ₱25,000.00)</Text>
                    {'\n'}Net Payout Due This Week = <Text className="font-bold text-white">Target Cumulative - Previously Paid</Text>
                </Text>
                <View className="mt-3 pt-3 border-t border-emerald-800 flex-row justify-between items-center">
                    <Text className="text-emerald-200 text-xs font-semibold">
                        Early weeks payout ramps up to ₱25k. All excess kilos earn incremental ₱1.00/kg.
                    </Text>
                </View>
            </View>

            {/* Cycle Selector & Week Computation Card */}
            <View className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm mb-6">
                <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Select Crop Cycle to Compute
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mb-4">
                    {cycles.map(c => (
                        <Pressable
                            key={c.id}
                            onPress={() => setSelectedCycleId(c.id)}
                            className={`px-4 py-2 rounded-xl border ${
                                selectedCycleId === c.id
                                    ? 'bg-emerald-800 border-emerald-800'
                                    : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                            }`}
                        >
                            <Text
                                className={`text-xs font-bold ${
                                    selectedCycleId === c.id ? 'text-white' : 'text-gray-800'
                                }`}
                            >
                                {c.cycleCode}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>

                {selectedCycle && (
                    <View className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-4">
                        <View className="flex-row justify-between mb-1">
                            <Text className="text-xs text-gray-500">Total Harvest Logged:</Text>
                            <Text className="text-xs font-bold text-gray-900">
                                {(selectedCycle.totalActualYieldKg || 0).toLocaleString()} kg
                            </Text>
                        </View>
                        <View className="flex-row justify-between mb-1">
                            <Text className="text-xs text-gray-500">Rate per Kilo:</Text>
                            <Text className="text-xs font-bold text-gray-900">
                                {formatPHP(selectedCycle.landOwnerRatePerKg || 1.0)} / kg
                            </Text>
                        </View>
                        <View className="flex-row justify-between">
                            <Text className="text-xs text-gray-500">Cycle Guaranteed Minimum:</Text>
                            <Text className="text-xs font-bold text-emerald-800">
                                {formatPHP(selectedCycle.landOwnerGuaranteedMin || 25000.0)}
                            </Text>
                        </View>
                    </View>
                )}

                <View className="flex-row items-center gap-3">
                    <View className="w-28">
                        <Text className="text-xs font-bold text-gray-700 mb-1">Week #</Text>
                        <TextInput
                            value={weekNumber}
                            onChangeText={setWeekNumber}
                            placeholder="1"
                            keyboardType="numeric"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 font-bold text-center text-sm text-gray-900"
                        />
                    </View>
                    <View className="flex-1 pt-4">
                        <Pressable
                            onPress={handleComputeSettlement}
                            disabled={calculating}
                            className="bg-emerald-700 p-3.5 rounded-xl items-center active:bg-emerald-800 shadow-sm"
                        >
                            {calculating ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text className="text-white font-bold text-sm">
                                    Calculate Week {weekNumber} Settlement
                                </Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </View>

            {/* Settlements History Table */}
            <Text className="text-lg font-black text-gray-900 mb-3">Weekly Settlement Records</Text>
            {settlements.length === 0 ? (
                <View className="bg-white p-8 rounded-2xl border border-gray-200 items-center justify-center">
                    <MaterialIcons name="receipt-long" size={48} color="#9CA3AF" />
                    <Text className="text-gray-900 font-bold text-base mt-2">No Settlements Created</Text>
                    <Text className="text-gray-500 text-xs text-center mt-1">
                        Use the calculation engine above to generate weekly payouts for your Land Owners.
                    </Text>
                </View>
            ) : (
                <View className="gap-3">
                    {settlements.map((item) => {
                        const { settlement: s, landOwnerName, cycleCode } = item;
                        return (
                            <View
                                key={s.id}
                                className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm"
                            >
                                <View className="flex-row justify-between items-start mb-3">
                                    <View>
                                        <View className="flex-row items-center gap-2">
                                            <Text className="text-base font-black text-gray-900">
                                                Week {s.weekNumber} Settlement
                                            </Text>
                                            <View
                                                className={`px-2.5 py-0.5 rounded-full ${
                                                    s.paymentStatus === 'paid'
                                                        ? 'bg-emerald-100'
                                                        : s.paymentStatus === 'approved'
                                                        ? 'bg-blue-100'
                                                        : 'bg-amber-100'
                                                }`}
                                            >
                                                <Text
                                                    className={`text-xs font-bold capitalize ${
                                                        s.paymentStatus === 'paid'
                                                            ? 'text-emerald-800'
                                                            : s.paymentStatus === 'approved'
                                                            ? 'text-blue-800'
                                                            : 'text-amber-800'
                                                    }`}
                                                >
                                                    {s.paymentStatus}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text className="text-xs text-gray-600 mt-1">
                                            Owner: <Text className="font-bold text-gray-900">{landOwnerName}</Text> • Cycle: {cycleCode}
                                        </Text>
                                        <Text className="text-[10px] text-gray-400">
                                            Cumulative Harvest: {s.cumulativeKilos.toLocaleString()} kg • Target Payout: {formatPHP(s.targetCumulativePayout)}
                                        </Text>
                                    </View>

                                    <View className="items-end">
                                        <Text className="text-xl font-black text-emerald-800">
                                            {formatPHP(s.netPayoutDueThisWeek)}
                                        </Text>
                                        <Text className="text-xs text-gray-500">Newly Owed This Week</Text>
                                    </View>
                                </View>

                                {/* Action Buttons */}
                                <View className="mt-3 pt-3 border-t border-gray-100 flex-row gap-2">
                                    <Pressable
                                        onPress={() => handleViewSlip(item)}
                                        className="flex-1 bg-gray-100 py-2.5 rounded-xl flex-row items-center justify-center gap-1 active:bg-gray-200"
                                    >
                                        <MaterialIcons name="description" size={16} color="#4B5563" />
                                        <Text className="text-gray-700 font-bold text-xs">View Slip</Text>
                                    </Pressable>

                                    {s.paymentStatus === 'draft' && (
                                        <Pressable
                                            onPress={() => handleApprove(s.id)}
                                            className="flex-1 bg-blue-50 border border-blue-200 py-2.5 rounded-xl flex-row items-center justify-center gap-1 active:bg-blue-100"
                                        >
                                            <MaterialIcons name="check" size={16} color="#1D4ED8" />
                                            <Text className="text-blue-800 font-bold text-xs">Approve</Text>
                                        </Pressable>
                                    )}

                                    {s.paymentStatus !== 'paid' && (
                                        <Pressable
                                            onPress={() => handleOpenDisburse(s.id)}
                                            className="flex-1 bg-emerald-700 py-2.5 rounded-xl flex-row items-center justify-center gap-1 active:bg-emerald-800"
                                        >
                                            <MaterialIcons name="payments" size={16} color="#FFFFFF" />
                                            <Text className="text-white font-bold text-xs">Disburse Pay</Text>
                                        </Pressable>
                                    )}

                                    <Pressable
                                        onPress={() => handleDeleteSettlement(item)}
                                        className="px-3 bg-red-50 border border-red-200 py-2.5 rounded-xl flex-row items-center justify-center gap-1 active:bg-red-100"
                                    >
                                        <MaterialIcons name="delete-outline" size={16} color="#DC2626" />
                                        <Text className="text-red-700 font-bold text-xs">Delete</Text>
                                    </Pressable>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Printable Settlement Slip Modal */}
            <Modal visible={slipModalVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-lg font-black text-gray-900">Settlement Slip (Audit Trail)</Text>
                            <Pressable onPress={() => setSlipModalVisible(false)} className="p-1">
                                <MaterialIcons name="close" size={24} color="#6B7280" />
                            </Pressable>
                        </View>

                        <ScrollView className="bg-gray-900 p-4 rounded-2xl max-h-[60vh] mb-4">
                            <Text className="text-emerald-400 font-mono text-xs leading-5">
                                {activeSlipText}
                            </Text>
                        </ScrollView>

                        <Pressable
                            onPress={() => setSlipModalVisible(false)}
                            className="w-full py-3 bg-emerald-700 rounded-xl items-center"
                        >
                            <Text className="text-white font-bold text-sm">Close Slip</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* Disburse Payout Modal */}
            <Modal visible={disburseModalVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl">
                        <Text className="text-lg font-black text-gray-900 mb-2">Disburse Land Owner Payout</Text>
                        <Text className="text-xs text-gray-500 mb-4">
                            Confirm disbursement and record check number or bank transfer receipt.
                        </Text>

                        <Text className="text-xs font-bold text-gray-700 mb-1">Receipt / Reference Number</Text>
                        <TextInput
                            value={receiptRef}
                            onChangeText={setReceiptRef}
                            placeholder="e.g. CHK-123456"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-4"
                        />

                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={() => setDisburseModalVisible(false)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl items-center"
                            >
                                <Text className="font-bold text-gray-700 text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleConfirmDisbursement}
                                disabled={savingDisbursement}
                                className="flex-1 py-3 bg-emerald-700 rounded-xl items-center active:bg-emerald-800"
                            >
                                {savingDisbursement ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text className="font-bold text-white text-sm">Confirm Payout</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}
