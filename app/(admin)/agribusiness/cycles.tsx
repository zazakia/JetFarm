import React, { useState, useCallback } from 'react';
import { usePageContentStyle } from '../../../src/hooks/useResponsiveLayout';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, Modal, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import AgriCropCycle from '../../../src/database/models/AgriCropCycle';
import AgriParcel from '../../../src/database/models/AgriParcel';
import AgriInvestor from '../../../src/database/models/AgriInvestor';
import AgriGrowthCheckin from '../../../src/database/models/AgriGrowthCheckin';
import { AgriCropCycleService } from '../../../src/services/AgriCropCycleService';
import { formatPHP, parsePHP } from '../../../src/utils/currency';
import { Q } from '@nozbe/watermelondb';
import { CropHealthGrowthChart } from '../../../src/components/CropHealthGrowthChart';
import ConfirmDialog from '../../../src/components/ConfirmDialog';
import Toast from '../../../src/components/AppToast';

export default function CropCyclesScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();

    const pageContentStyle = usePageContentStyle();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
    const [cycles, setCycles] = useState<any[]>([]);
    const [parcels, setParcels] = useState<AgriParcel[]>([]);
    const [investors, setInvestors] = useState<AgriInvestor[]>([]);

    // Create Cycle Modal
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [savingCycle, setSavingCycle] = useState(false);
    const [selectedParcelId, setSelectedParcelId] = useState(params.parcelId as string || '');
    const [selectedInvestorId, setSelectedInvestorId] = useState('');
    const [variety, setVariety] = useState('Golden Yellow');
    const [areaPlantedHa, setAreaPlantedHa] = useState('');
    const [offtakePrice, setOfftakePrice] = useState('4.00');

    // Edit Cycle Modal
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingCycle, setEditingCycle] = useState<AgriCropCycle | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);
    const [editVariety, setEditVariety] = useState('');
    const [editAreaHa, setEditAreaHa] = useState('');
    const [editOfftakePrice, setEditOfftakePrice] = useState('');
    const [editStatus, setEditStatus] = useState('planted');
    const [editNotes, setEditNotes] = useState('');

    // Growth Check-in Modal
    const [checkinModalVisible, setCheckinModalVisible] = useState(false);
    const [activeCycleId, setActiveCycleId] = useState('');
    const [savingCheckin, setSavingCheckin] = useState(false);
    const [checkinStage, setCheckinStage] = useState('vegetative');
    const [healthStatus, setHealthStatus] = useState('good');
    const [plantHeightCm, setPlantHeightCm] = useState('85');
    const [checkinNotes, setCheckinNotes] = useState('');

    // Delete confirmation (Alert.alert is a no-op on react-native-web).
    // One dialog instance is reused for confirm + error so two RN modals
    // never overlap while one is mid-close.
    const [cycleToDelete, setCycleToDelete] = useState<AgriCropCycle | null>(null);
    const [dialog, setDialog] = useState<{
        mode: 'confirm' | 'alert';
        title: string;
        message: string;
        confirmLabel?: string;
    } | null>(null);

    const loadData = async () => {
        try {
            const list = await AgriCropCycleService.listCycles();
            const enriched = await Promise.all(
                list.map(async item => {
                    try {
                        const checkins = await database
                            .get<AgriGrowthCheckin>('agri_growth_checkins')
                            .query(
                                Q.where('crop_cycle_id', item.cycle.id),
                                Q.where('deleted_at', null),
                                Q.sortBy('checkin_date', Q.asc)
                            )
                            .fetch();
                        return { ...item, checkins };
                    } catch {
                        return { ...item, checkins: [] };
                    }
                })
            );
            setCycles(enriched);

            const pclList = await database
                .get<AgriParcel>('agri_parcels')
                .query(Q.where('deleted_at', null))
                .fetch();
            setParcels(pclList);
            if (!selectedParcelId && pclList.length > 0) {
                setSelectedParcelId(pclList[0].id);
                setAreaPlantedHa(pclList[0].areaHectares.toString());
            }

            const invList = await database
                .get<AgriInvestor>('agri_investors')
                .query(Q.where('deleted_at', null))
                .fetch();
            setInvestors(invList);
            if (invList.length > 0) {
                setSelectedInvestorId(invList[0].id);
            }
        } catch (err) {
            console.error('[CropCycles] Error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleCreateCycle = async () => {
        if (!selectedParcelId || !areaPlantedHa) {
            Alert.alert('Validation Error', 'Please select a parcel and specify planted hectares.');
            return;
        }

        const ha = parseFloat(areaPlantedHa);
        if (isNaN(ha) || ha <= 0) {
            Alert.alert('Validation Error', 'Invalid area in hectares.');
            return;
        }

        setSavingCycle(true);
        try {
            await AgriCropCycleService.createCropCycle({
                parcelId: selectedParcelId,
                investorId: selectedInvestorId || undefined,
                cropType: 'Cassava',
                variety,
                plantingDate: new Date(),
                areaPlantedHa: ha,
                offtakePricePerKg: parsePHP(offtakePrice) || 4.0,
                landOwnerRatePerKg: 1.0,
                landOwnerGuaranteedMin: 25000.0,
            });

            setCreateModalVisible(false);
            loadData();
            const msg = `Cassava crop cycle (${variety}, ${ha} ha) started successfully!`;
            setConfirmationMessage(msg);
            Toast.show({
                type: 'success',
                text1: 'Crop Cycle Started',
                text2: msg,
            });
            Alert.alert('Success', msg);
        } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to start crop cycle.');
        } finally {
            setSavingCycle(false);
        }
    };

    const handleOpenEdit = (cycle: AgriCropCycle) => {
        setEditingCycle(cycle);
        setEditVariety(cycle.variety || 'Golden Yellow');
        setEditAreaHa(String(cycle.areaPlantedHa ?? ''));
        setEditOfftakePrice(String(cycle.offtakePricePerKg ?? ''));
        setEditStatus(cycle.status || 'planted');
        setEditNotes(cycle.notes || '');
        setEditModalVisible(true);
    };

    const handleSaveEdit = async () => {
        if (!editingCycle) return;

        const ha = parseFloat(editAreaHa);
        if (isNaN(ha) || ha <= 0) {
            Alert.alert('Validation Error', 'Please enter a valid positive number for planted hectares.');
            return;
        }
        const price = parsePHP(editOfftakePrice);
        if (price <= 0) {
            Alert.alert('Validation Error', 'Please enter a valid off-take price in ₱/kg.');
            return;
        }

        setSavingEdit(true);
        try {
            await AgriCropCycleService.updateCropCycle(editingCycle.id, {
                variety: editVariety.trim() || undefined,
                areaPlantedHa: ha,
                offtakePricePerKg: price,
                status: editStatus,
                notes: editNotes.trim() || undefined,
            });

            setEditModalVisible(false);
            loadData();
            const msg = `Cycle ${editingCycle.cycleCode} updated successfully!`;
            setConfirmationMessage(msg);
            Toast.show({ type: 'success', text1: 'Cycle Updated', text2: msg });
            Alert.alert('Success', msg);
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to update crop cycle.');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDeleteCycle = (cycle: AgriCropCycle) => {
        setCycleToDelete(cycle);
        setDialog({
            mode: 'confirm',
            title: 'Delete Crop Cycle',
            message: `Are you sure you want to remove cycle ${cycle.cycleCode}? This records a deletion in the audit log and hides it from the registry.`,
            confirmLabel: 'Delete',
        });
    };

    const closeDialog = () => {
        setDialog(null);
        setCycleToDelete(null);
    };

    const handleDialogConfirm = async () => {
        if (dialog?.mode !== 'confirm' || !cycleToDelete) return;

        const target = cycleToDelete;
        try {
            await AgriCropCycleService.deleteCropCycle(target.id);
            closeDialog();
            const msg = `Cycle ${target.cycleCode} deleted and logged in the audit trail.`;
            setConfirmationMessage(msg);
            Toast.show({ type: 'success', text1: 'Cycle Deleted', text2: msg });
            loadData();
        } catch (err: any) {
            setCycleToDelete(null);
            setDialog({
                mode: 'alert',
                title: 'Cannot Delete Cycle',
                message: err?.message || 'Failed to delete cycle.',
            });
        }
    };

    const handleAddCheckin = async () => {
        if (!activeCycleId) return;

        setSavingCheckin(true);
        try {
            await AgriCropCycleService.addGrowthCheckin({
                cropCycleId: activeCycleId,
                stage: checkinStage,
                healthStatus,
                plantHeightCm: parseFloat(plantHeightCm) || undefined,
                notes: checkinNotes.trim() || undefined,
            });

            setCheckinModalVisible(false);
            setCheckinNotes('');
            loadData();
            const stageLabel = checkinStage.replace('_', ' ').toUpperCase();
            const msg = `Growth stage checkin recorded: ${stageLabel} evaluated with ${healthStatus.toUpperCase()} health!`;
            setConfirmationMessage(msg);
            Toast.show({
                type: 'success',
                text1: 'Growth Checkin Saved',
                text2: msg,
            });
            Alert.alert('Success', msg);
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to record checkin');
        } finally {
            setSavingCheckin(false);
        }
    };

    const getStageColor = (stage: string) => {
        switch (stage) {
            case 'planted': return 'bg-blue-100 text-blue-800';
            case 'growing': return 'bg-emerald-100 text-emerald-800';
            case 'harvesting': return 'bg-amber-100 text-amber-800';
            case 'completed': return 'bg-gray-100 text-gray-800';
            default: return 'bg-green-100 text-green-800';
        }
    };

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            contentContainerStyle={pageContentStyle}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Header */}
            <View className="flex-row flex-wrap justify-between items-center mb-6">
                <View className="flex-1 min-w-0 mr-3">
                    <Text className="text-2xl font-black text-gray-900">Cassava Planting Cycles</Text>
                    <Text className="text-sm text-gray-500 mt-0.5">
                        Manage 9-month crop cycles, varieties, growth stages & yield targets
                    </Text>
                </View>
                <Pressable
                    onPress={() => setCreateModalVisible(true)}
                    className="bg-emerald-700 px-4 py-2.5 rounded-xl flex-row items-center gap-1.5 shadow-sm active:bg-emerald-800"
                >
                    <MaterialIcons name="add" size={20} color="#FFFFFF" />
                    <Text className="text-white font-bold text-sm">Start New Cycle</Text>
                </Pressable>
            </View>

            {/* Inline Confirmation Banner */}
            {confirmationMessage && (
                <View className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 mb-6 flex-row items-center justify-between shadow-sm">
                    <View className="flex-row items-center gap-3 flex-1">
                        <View className="w-8 h-8 rounded-full bg-emerald-100 items-center justify-center">
                            <MaterialIcons name="check-circle" size={20} color="#047857" />
                        </View>
                        <Text className="text-emerald-900 font-bold text-xs flex-1">
                            {confirmationMessage}
                        </Text>
                    </View>
                    <Pressable onPress={() => setConfirmationMessage(null)} className="p-1">
                        <MaterialIcons name="close" size={18} color="#047857" />
                    </Pressable>
                </View>
            )}

            {/* Cycles List */}
            {loading ? (
                <View className="p-8 items-center">
                    <ActivityIndicator size="small" color="#047857" />
                    <Text className="text-gray-500 text-xs mt-2">Loading cycles...</Text>
                </View>
            ) : cycles.length === 0 ? (
                <View className="bg-white p-8 rounded-2xl border border-gray-200 items-center justify-center">
                    <MaterialIcons name="grass" size={48} color="#9CA3AF" />
                    <Text className="text-gray-900 font-bold text-base mt-2">No Active Cycles</Text>
                    <Text className="text-gray-500 text-xs text-center mt-1 mb-4">
                        Plant a new Cassava crop on any registered land parcel.
                    </Text>
                    <Pressable
                        onPress={() => setCreateModalVisible(true)}
                        className="bg-emerald-700 px-5 py-2.5 rounded-xl active:bg-emerald-800"
                    >
                        <Text className="text-white font-bold text-sm">Start First Cycle</Text>
                    </Pressable>
                </View>
            ) : (
                <View className="flex-row flex-wrap justify-between gap-4">
                    {cycles.map(({ cycle, parcel, investor, checkins }) => (
                        <View
                            key={cycle.id}
                            className="w-full md:w-[48%] bg-white p-5 rounded-3xl border border-gray-200 shadow-sm"
                        >
                            <View className="flex-row justify-between items-start mb-3">
                                <View>
                                    <View className="flex-row items-center gap-2">
                                        <Text className="text-lg font-black text-gray-900">{cycle.cycleCode}</Text>
                                        <View className={`px-2.5 py-0.5 rounded-full ${getStageColor(cycle.status).split(' ')[0]}`}>
                                            <Text className={`text-xs font-bold capitalize ${getStageColor(cycle.status).split(' ')[1]}`}>
                                                {cycle.status}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text className="text-xs text-gray-600 mt-1">
                                        Parcel: <Text className="font-bold text-gray-900">{parcel?.name || 'Unassigned'}</Text>
                                        {investor ? ` • Investor: ${investor.companyName}` : ''}
                                    </Text>
                                    <Text className="text-xs text-gray-500 mt-0.5">
                                        Variety: {cycle.variety || 'Golden Yellow'} • Planted: {new Date(cycle.plantingDate).toISOString().split('T')[0]}
                                    </Text>
                                </View>

                                <View className="items-end">
                                    <Text className="text-xl font-black text-gray-900">
                                        {cycle.areaPlantedHa} <Text className="text-xs font-semibold text-gray-500">ha</Text>
                                    </Text>
                                    <Text className="text-xs text-emerald-700 font-bold">
                                        Off-take: {formatPHP(cycle.offtakePricePerKg)}/kg
                                    </Text>
                                </View>
                            </View>

                            {/* Progress bar / Yield stats */}
                            <View className="bg-gray-50 p-3 rounded-2xl border border-gray-100 mb-3">
                                <View className="flex-row justify-between text-xs mb-1">
                                    <Text className="text-xs text-gray-500">Actual Harvest vs Projected Target</Text>
                                    <Text className="text-xs font-bold text-gray-900">
                                        {(cycle.totalActualYieldKg || 0).toLocaleString()} / {(cycle.expectedYieldKg || 0).toLocaleString()} kg
                                    </Text>
                                </View>
                                <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <View
                                        className="h-full bg-emerald-600 rounded-full"
                                        style={{
                                            width: `${Math.min(
                                                100,
                                                ((cycle.totalActualYieldKg || 0) / (cycle.expectedYieldKg || 1)) * 100
                                            )}%`,
                                        }}
                                    />
                                </View>
                            </View>

                            {/* Growth Stage Crop Health Status Line Graph */}
                            <View className="mb-4">
                                <CropHealthGrowthChart
                                    checkins={checkins || []}
                                    variety={cycle.variety}
                                    currentStage={cycle.status}
                                />
                            </View>

                            {/* Action Buttons */}
                            <View className="flex-row gap-2">
                                <Pressable
                                    onPress={() => {
                                        setActiveCycleId(cycle.id);
                                        setCheckinModalVisible(true);
                                    }}
                                    className="flex-1 bg-emerald-50 border border-emerald-200 py-2.5 rounded-xl flex-row items-center justify-center gap-1.5 active:bg-emerald-100"
                                >
                                    <MaterialIcons name="eco" size={16} color="#047857" />
                                    <Text className="text-emerald-800 font-bold text-xs">Record Growth Checkin</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => router.push(`/(admin)/agribusiness/harvest?cropCycleId=${cycle.id}` as any)}
                                    className="flex-1 bg-amber-50 border border-amber-200 py-2.5 rounded-xl flex-row items-center justify-center gap-1.5 active:bg-amber-100"
                                >
                                    <MaterialIcons name="scale" size={16} color="#B45309" />
                                    <Text className="text-amber-800 font-bold text-xs">Log Weigh-in Batch</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => router.push(`/(admin)/agribusiness/settlements?cropCycleId=${cycle.id}` as any)}
                                    className="bg-blue-50 border border-blue-200 px-3 py-2.5 rounded-xl flex-row items-center justify-center active:bg-blue-100"
                                >
                                    <MaterialIcons name="handshake" size={16} color="#1D4ED8" />
                                </Pressable>
                            </View>

                            {/* Registry Maintenance Actions */}
                            <View className="flex-row gap-2 mt-2">
                                <Pressable
                                    onPress={() => handleOpenEdit(cycle)}
                                    testID={`cycle-edit-${cycle.id}`}
                                    className="flex-row items-center gap-1 bg-gray-100 px-3 py-2 rounded-xl active:bg-gray-200"
                                >
                                    <MaterialIcons name="edit" size={14} color="#374151" />
                                    <Text className="text-gray-700 font-bold text-xs">Edit Cycle</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => handleDeleteCycle(cycle)}
                                    testID={`cycle-delete-${cycle.id}`}
                                    className="flex-row items-center gap-1 bg-red-50 border border-red-200 px-3 py-2 rounded-xl active:bg-red-100"
                                >
                                    <MaterialIcons name="delete-outline" size={14} color="#DC2626" />
                                    <Text className="text-red-700 font-bold text-xs">Delete Cycle</Text>
                                </Pressable>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Create Cycle Modal */}
            <Modal visible={createModalVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-xl font-black text-gray-900">Start Cassava Crop Cycle</Text>
                            <Pressable onPress={() => setCreateModalVisible(false)} className="p-1">
                                <MaterialIcons name="close" size={24} color="#6B7280" />
                            </Pressable>
                        </View>

                        <ScrollView className="max-h-[70vh]">
                            <Text className="text-xs font-bold text-gray-700 mb-1">Target Land Parcel *</Text>
                            <View className="flex-row flex-wrap gap-2 mb-3">
                                {parcels.map(p => (
                                    <Pressable
                                        key={p.id}
                                        onPress={() => {
                                            setSelectedParcelId(p.id);
                                            setAreaPlantedHa(p.areaHectares.toString());
                                        }}
                                        className={`px-3 py-2 rounded-xl border ${
                                            selectedParcelId === p.id
                                                ? 'bg-emerald-800 border-emerald-800'
                                                : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                                        }`}
                                    >
                                        <Text
                                            className={`text-xs font-bold ${
                                                selectedParcelId === p.id ? 'text-white' : 'text-gray-800'
                                            }`}
                                        >
                                            {p.name} ({p.areaHectares} ha)
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            <Text className="text-xs font-bold text-gray-700 mb-1">Investor Partner</Text>
                            <View className="flex-row flex-wrap gap-2 mb-3">
                                {investors.length === 0 ? (
                                    <Text className="text-xs text-gray-400">No investor registered (Optional)</Text>
                                ) : (
                                    investors.map(inv => (
                                        <Pressable
                                            key={inv.id}
                                            onPress={() => {
                                                setSelectedInvestorId(inv.id);
                                                setOfftakePrice(inv.defaultOfftakePricePerKg.toString());
                                            }}
                                            className={`px-3 py-2 rounded-xl border ${
                                                selectedInvestorId === inv.id
                                                    ? 'bg-indigo-800 border-indigo-800'
                                                    : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                                            }`}
                                        >
                                            <Text
                                                className={`text-xs font-bold ${
                                                    selectedInvestorId === inv.id ? 'text-white' : 'text-gray-800'
                                                }`}
                                            >
                                                {inv.companyName}
                                            </Text>
                                        </Pressable>
                                    ))
                                )}
                            </View>

                            <Text className="text-xs font-bold text-gray-700 mb-1">Cassava Variety *</Text>
                            <TextInput
                                value={variety}
                                onChangeText={setVariety}
                                placeholder="Golden Yellow, KU-50, Lakan"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Planted Hectares *</Text>
                            <TextInput
                                value={areaPlantedHa}
                                onChangeText={setAreaPlantedHa}
                                placeholder="e.g. 3.0"
                                keyboardType="numeric"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Investor Off-Take Price (₱/kg) *</Text>
                            <TextInput
                                value={offtakePrice}
                                onChangeText={setOfftakePrice}
                                placeholder="4.00"
                                keyboardType="numeric"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-5"
                            />

                            <View className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 mb-4">
                                <Text className="text-emerald-900 font-bold text-xs">Standard Settlement Guarantee:</Text>
                                <Text className="text-emerald-700 text-xs mt-0.5">
                                    Land Owner earns ₱1.00/kg with ₱25,000 guaranteed minimum per cycle evaluated weekly.
                                </Text>
                            </View>
                        </ScrollView>

                        <View className="flex-row gap-3 mt-4">
                            <Pressable
                                onPress={() => setCreateModalVisible(false)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl items-center"
                            >
                                <Text className="font-bold text-gray-700 text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleCreateCycle}
                                disabled={savingCycle}
                                className="flex-1 py-3 bg-emerald-700 rounded-xl items-center active:bg-emerald-800"
                            >
                                {savingCycle ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text className="font-bold text-white text-sm">Start Cycle</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Growth Checkin Modal */}
            <Modal visible={checkinModalVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-xl font-black text-gray-900">Record Growth Stage</Text>
                            <Pressable onPress={() => setCheckinModalVisible(false)} className="p-1">
                                <MaterialIcons name="close" size={24} color="#6B7280" />
                            </Pressable>
                        </View>

                        <ScrollView className="max-h-[70vh]">
                            <Text className="text-xs font-bold text-gray-700 mb-1">Growth Stage</Text>
                            <View className="flex-row flex-wrap gap-2 mb-3">
                                {[
                                    { id: 'land_prep', label: 'Land Prep' },
                                    { id: 'germination', label: 'Germination (Mo 1)' },
                                    { id: 'vegetative', label: 'Vegetative (Mo 2-4)' },
                                    { id: 'root_bulking', label: 'Root Bulking (Mo 5-7)' },
                                    { id: 'maturity', label: 'Maturity (Mo 8-9)' },
                                ].map(st => (
                                    <Pressable
                                        key={st.id}
                                        onPress={() => setCheckinStage(st.id)}
                                        className={`px-3 py-2 rounded-xl border ${
                                            checkinStage === st.id
                                                ? 'bg-emerald-800 border-emerald-800'
                                                : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                                        }`}
                                    >
                                        <Text
                                            className={`text-xs font-bold ${
                                                checkinStage === st.id ? 'text-white' : 'text-gray-800'
                                            }`}
                                        >
                                            {st.label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            <Text className="text-xs font-bold text-gray-700 mb-1">Crop Health Status</Text>
                            <View className="flex-row flex-wrap gap-2 mb-3">
                                {[
                                    { id: 'excellent', label: 'Excellent' },
                                    { id: 'good', label: 'Good' },
                                    { id: 'fair', label: 'Fair' },
                                    { id: 'pest_risk', label: 'Pest Risk' },
                                    { id: 'diseased', label: 'Diseased' },
                                ].map(hl => (
                                    <Pressable
                                        key={hl.id}
                                        onPress={() => setHealthStatus(hl.id)}
                                        className={`px-3 py-2 rounded-xl border ${
                                            healthStatus === hl.id
                                                ? 'bg-blue-800 border-blue-800'
                                                : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                                        }`}
                                    >
                                        <Text
                                            className={`text-xs font-bold ${
                                                healthStatus === hl.id ? 'text-white' : 'text-gray-800'
                                            }`}
                                        >
                                            {hl.label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            <Text className="text-xs font-bold text-gray-700 mb-1">Average Plant Height (cm)</Text>
                            <TextInput
                                value={plantHeightCm}
                                onChangeText={setPlantHeightCm}
                                placeholder="e.g. 85"
                                keyboardType="numeric"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Supervisor Field Notes</Text>
                            <TextInput
                                value={checkinNotes}
                                onChangeText={setCheckinNotes}
                                placeholder="Weeding status, canopy density, root thickness..."
                                placeholderTextColor="#9CA3AF"
                                multiline
                                numberOfLines={3}
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-4"
                            />
                        </ScrollView>

                        <View className="flex-row gap-3 mt-4">
                            <Pressable
                                onPress={() => setCheckinModalVisible(false)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl items-center"
                            >
                                <Text className="font-bold text-gray-700 text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleAddCheckin}
                                disabled={savingCheckin}
                                className="flex-1 py-3 bg-emerald-700 rounded-xl items-center active:bg-emerald-800"
                            >
                                {savingCheckin ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text className="font-bold text-white text-sm">Save Checkin</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Edit Cycle Modal */}
            <Modal visible={editModalVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-xl font-black text-gray-900">
                                Edit Cycle {editingCycle?.cycleCode || ''}
                            </Text>
                            <Pressable onPress={() => setEditModalVisible(false)} className="p-1">
                                <MaterialIcons name="close" size={24} color="#6B7280" />
                            </Pressable>
                        </View>

                        <ScrollView className="max-h-[70vh]">
                            <Text className="text-xs font-bold text-gray-700 mb-1">Cassava Variety</Text>
                            <TextInput
                                value={editVariety}
                                onChangeText={setEditVariety}
                                placeholder="Golden Yellow, KU-50, Lakan"
                                placeholderTextColor="#9CA3AF"
                                testID="edit-cycle-variety-input"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Planted Hectares</Text>
                            <TextInput
                                value={editAreaHa}
                                onChangeText={setEditAreaHa}
                                placeholder="e.g. 3.0"
                                keyboardType="numeric"
                                placeholderTextColor="#9CA3AF"
                                testID="edit-cycle-area-input"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Investor Off-Take Price (₱/kg)</Text>
                            <TextInput
                                value={editOfftakePrice}
                                onChangeText={setEditOfftakePrice}
                                placeholder="4.00"
                                keyboardType="numeric"
                                placeholderTextColor="#9CA3AF"
                                testID="edit-cycle-offtake-input"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Cycle Status</Text>
                            <View className="flex-row flex-wrap gap-2 mb-3">
                                {['planning', 'land_prep', 'planted', 'growing', 'harvesting', 'completed', 'closed'].map(st => (
                                    <Pressable
                                        key={st}
                                        onPress={() => setEditStatus(st)}
                                        testID={`edit-cycle-status-${st}`}
                                        className={`px-3 py-2 rounded-xl border ${
                                            editStatus === st
                                                ? 'bg-emerald-800 border-emerald-800'
                                                : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                                        }`}
                                    >
                                        <Text
                                            className={`text-xs font-bold capitalize ${
                                                editStatus === st ? 'text-white' : 'text-gray-800'
                                            }`}
                                        >
                                            {st.replace('_', ' ')}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            <Text className="text-xs font-bold text-gray-700 mb-1">Cycle Notes</Text>
                            <TextInput
                                value={editNotes}
                                onChangeText={setEditNotes}
                                placeholder="Corrections, replanting, typhoon damage..."
                                placeholderTextColor="#9CA3AF"
                                multiline
                                numberOfLines={3}
                                testID="edit-cycle-notes-input"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-4"
                            />
                        </ScrollView>

                        <View className="flex-row gap-3 mt-4">
                            <Pressable
                                onPress={() => setEditModalVisible(false)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl items-center"
                            >
                                <Text className="font-bold text-gray-700 text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleSaveEdit}
                                disabled={savingEdit}
                                testID="save-cycle-edit-button"
                                className="flex-1 py-3 bg-emerald-700 rounded-xl items-center active:bg-emerald-800"
                            >
                                {savingEdit ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text className="font-bold text-white text-sm">Update Cycle</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Delete Confirmation (web-safe: Alert.alert is a no-op on react-native-web) */}
            <ConfirmDialog
                visible={!!dialog}
                mode={dialog?.mode || 'confirm'}
                title={dialog?.title || ''}
                message={dialog?.message || ''}
                confirmLabel={dialog?.confirmLabel}
                onConfirm={handleDialogConfirm}
                onCancel={closeDialog}
                isDestructive={dialog?.mode !== 'alert'}
            />
        </ScrollView>
    );
}
