import React, { useState, useCallback } from 'react';
import { usePageContentStyle } from '../../../src/hooks/useResponsiveLayout';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, Modal, Alert, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import AgriParcel from '../../../src/database/models/AgriParcel';
import AgriLandOwner from '../../../src/database/models/AgriLandOwner';
import { AgriParcelService } from '../../../src/services/AgriParcelService';
import { LookupDataService } from '../../../src/services/LookupDataService';
import { DynamicSearchBar } from '../../../src/components/DynamicSearchBar';
import { useDynamicSearch } from '../../../src/hooks/useDynamicSearch';
import { TransactionConfirmationBanner } from '../../../src/components/TransactionConfirmationBanner';
import ConfirmDialog from '../../../src/components/ConfirmDialog';
import Toast from '../../../src/components/AppToast';

export default function ParcelsRegistryScreen() {
    const router = useRouter();
    const { mapRegistration } = useLocalSearchParams<{ mapRegistration?: string }>();
    const pageContentStyle = usePageContentStyle();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [parcelsList, setParcelsList] = useState<any[]>([]);
    const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
    const [confirmationTitle, setConfirmationTitle] = useState('Parcel Registered Successfully');

    const {
        query: searchQuery,
        setQuery: setSearchQuery,
        filteredData: filteredParcels,
    } = useDynamicSearch({
        data: parcelsList,
        searchKeys: [
            'parcel.name',
            'parcel.code',
            'parcel.locationAddress',
            'parcel.soilType',
            'parcel.status',
            'landOwner.name',
        ],
        debounceMs: 150,
    });

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingParcelId, setEditingParcelId] = useState<string | null>(null);
    const [editingOwnerName, setEditingOwnerName] = useState<string | null>(null);
    const [parcelName, setParcelName] = useState('');
    const [parcelCode, setParcelCode] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [ownerPhone, setOwnerPhone] = useState('');
    const [areaHectares, setAreaHectares] = useState('');
    const [locationAddress, setLocationAddress] = useState('');
    const [soilType, setSoilType] = useState('Loam');
    const [soilTypeOptions, setSoilTypeOptions] = useState<string[]>([]);

    // Delete confirmation (Alert.alert is a no-op on react-native-web).
    // A single dialog instance is reused for confirm + error so two RN modals
    // never overlap while one is mid-close.
    const [parcelToDelete, setParcelToDelete] = useState<any | null>(null);
    const [dialog, setDialog] = useState<{
        mode: 'confirm' | 'alert';
        title: string;
        message: string;
        confirmLabel?: string;
    } | null>(null);

    const loadParcels = async () => {
        try {
            const list = await AgriParcelService.listParcels(statusFilter);
            setParcelsList(list);
            const soils = await LookupDataService.getActiveOptions('soil_type');
            if (soils.length > 0) setSoilTypeOptions(soils);
        } catch (error) {
            console.error('[ParcelsRegistry] Error loading parcels:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadParcels();
        }, [statusFilter])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadParcels();
    };

    const resetForm = () => {
        setParcelName('');
        setParcelCode('');
        setOwnerName('');
        setOwnerPhone('');
        setAreaHectares('');
        setLocationAddress('');
        setSoilType('Loam');
        setEditingParcelId(null);
        setEditingOwnerName(null);
    };

    const openCreateModal = () => {
        resetForm();
        setModalVisible(true);
    };

    const handleOpenEdit = (parcel: any, landOwner: any) => {
        setEditingParcelId(parcel.id);
        setEditingOwnerName(landOwner?.name || null);
        setParcelName(parcel.name || '');
        setParcelCode(parcel.code || '');
        setOwnerName(landOwner?.name || '');
        setOwnerPhone(landOwner?.contactNumber || '');
        setAreaHectares(String(parcel.areaHectares ?? ''));
        setLocationAddress(parcel.locationAddress || '');
        setSoilType(parcel.soilType || 'Loam');
        setModalVisible(true);
    };

    const measureOnMap = mapRegistration === '1' && !editingParcelId;
    const handleSaveParcel = async () => {
        if (!parcelName.trim() || (!measureOnMap && !areaHectares.trim())) {
            Alert.alert('Validation Error', 'Please enter parcel name and area in hectares.');
            return;
        }
        if (!editingParcelId && !ownerName.trim()) {
            Alert.alert('Validation Error', 'Please enter landowner name.');
            return;
        }

        // Zero means explicitly unmeasured in the mapping registration flow only.
        const ha = measureOnMap ? 0 : parseFloat(areaHectares);
        if (!measureOnMap && (isNaN(ha) || ha <= 0)) {
            Alert.alert('Validation Error', 'Please enter a valid positive number for area in hectares.');
            return;
        }

        setSaving(true);
        try {
            if (editingParcelId) {
                await AgriParcelService.updateParcel(editingParcelId, {
                    name: parcelName.trim(),
                    code: parcelCode.trim() || undefined,
                    areaHectares: ha,
                    locationAddress: locationAddress.trim() || undefined,
                    soilType: soilType || 'Loam',
                });

                setModalVisible(false);
                const msg = `Parcel "${parcelName.trim()}" updated successfully${editingOwnerName ? ` (landowner ${editingOwnerName} and contract terms unchanged)` : ''}.`;
                setConfirmationTitle('Parcel Updated Successfully');
                setConfirmationMessage(msg);
                Toast.show({ type: 'success', text1: 'Parcel Updated', text2: msg });
                resetForm();
                loadParcels();
                Alert.alert('Success', msg);
                return;
            }

            // 1. Create Land Owner first
            let landOwner: AgriLandOwner | null = null;
            await database.write(async () => {
                landOwner = await database.get<AgriLandOwner>('agri_land_owners').create(record => {
                    record.name = ownerName.trim();
                    record.contactNumber = ownerPhone.trim() || null;
                    record.defaultPerKiloRate = 1.0;
                    record.defaultGuaranteedMinimum = 25000.0;
                });
            });

            if (!landOwner) throw new Error('Failed to create landowner');

            // 2. Create Parcel
            const registeredParcel = await AgriParcelService.createParcel({
                name: parcelName.trim(),
                code: parcelCode.trim() || undefined,
                landOwnerId: (landOwner as AgriLandOwner).id,
                areaHectares: ha,
                locationAddress: locationAddress.trim() || undefined,
                soilType: soilType || 'Loam',
                status: 'available',
            });

            setModalVisible(false);
            const msg = measureOnMap
                ? `Parcel "${parcelName.trim()}" registered. Area is unmeasured until you review and save its mapped boundary.`
                : `Parcel "${parcelName.trim()}" (${ha} ha) registered successfully with standard ₱1.00/kg & ₱25k minimum guarantee!`;
            setConfirmationTitle('Parcel Registered Successfully');
            setConfirmationMessage(msg);
            Toast.show({
                type: 'success',
                text1: 'Parcel Registered',
                text2: msg,
            });

            resetForm();
            loadParcels();
            if (measureOnMap) {
                router.push({ pathname: '/(admin)/agribusiness/mapping', params: { parcelId: registeredParcel.id } });
            } else Alert.alert('Success', msg);
        } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to save parcel');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteParcel = (parcel: any) => {
        setParcelToDelete(parcel);
        setDialog({
            mode: 'confirm',
            title: 'Delete Land Parcel',
            message: `Are you sure you want to remove parcel "${parcel.name}" (${parcel.code || 'no code'})? This records a deletion in the audit log and hides it from the registry.`,
            confirmLabel: 'Delete',
        });
    };

    const closeDialog = () => {
        setDialog(null);
        setParcelToDelete(null);
    };

    const handleDialogConfirm = async () => {
        if (dialog?.mode !== 'confirm' || !parcelToDelete) return;

        const target = parcelToDelete;
        try {
            await AgriParcelService.deleteParcel(target.id);
            closeDialog();
            const msg = `Parcel "${target.name}" deleted and logged in the audit trail.`;
            setConfirmationTitle('Parcel Deleted');
            setConfirmationMessage(msg);
            Toast.show({ type: 'success', text1: 'Parcel Deleted', text2: msg });
            loadParcels();
        } catch (error: any) {
            setParcelToDelete(null);
            setDialog({
                mode: 'alert',
                title: 'Cannot Delete Parcel',
                message: error?.message || 'Failed to delete parcel. The attempt was logged.',
            });
        }
    };

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            contentContainerStyle={pageContentStyle}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Header */}
            <View className="flex-row justify-between items-center mb-6">
                <View className="flex-1 min-w-0 mr-3">
                    <Text className="text-2xl font-black text-gray-900" numberOfLines={2}>Land Parcels Registry</Text>
                    <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={2}>
                        Track land parcels, acreage, soil quality, and landowners
                    </Text>
                </View>
                <Pressable
                    onPress={openCreateModal}
                    testID="register-parcel-button"
                    className="bg-emerald-700 px-4 py-2.5 rounded-xl flex-row items-center gap-1.5 shadow-sm active:bg-emerald-800 shrink-0"
                >
                    <MaterialIcons name="add" size={20} color="#FFFFFF" />
                    <Text className="text-white font-bold text-sm">Register Parcel</Text>
                </Pressable>
            </View>

            {/* Inline Confirmation Banner */}
            {confirmationMessage && (
                <TransactionConfirmationBanner
                    title={confirmationTitle}
                    message={confirmationMessage}
                    onDismiss={() => setConfirmationMessage(null)}
                />
            )}

            {/* Dynamic and Flexible Search */}
            <DynamicSearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search parcels by name, code, owner, or location..."
                className="mb-3"
            />

            {/* Filter Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mb-5">
                {[
                    { id: 'all', label: 'All Parcels' },
                    { id: 'available', label: 'Available' },
                    { id: 'planted', label: 'Planted' },
                    { id: 'harvesting', label: 'Harvesting' },
                    { id: 'fallow', label: 'Fallow' },
                ].map(tab => (
                    <Pressable
                        key={tab.id}
                        onPress={() => setStatusFilter(tab.id)}
                        className={`px-4 py-2 rounded-xl border shrink-0 ${
                            statusFilter === tab.id
                                ? 'bg-emerald-800 border-emerald-800'
                                : 'bg-white border-gray-200 active:bg-gray-100'
                        }`}
                    >
                        <Text
                            className={`text-xs font-bold ${
                                statusFilter === tab.id ? 'text-white' : 'text-gray-700'
                            }`}
                        >
                            {tab.label}
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>

            {/* Parcels List */}
            {loading ? (
                <View className="p-8 items-center">
                    <ActivityIndicator size="small" color="#047857" />
                    <Text className="text-gray-500 text-xs mt-2">Loading parcels...</Text>
                </View>
            ) : filteredParcels.length === 0 ? (
                <View className="bg-white p-8 rounded-2xl border border-gray-200 items-center justify-center">
                    <MaterialIcons name="landscape" size={48} color="#9CA3AF" />
                    <Text className="text-gray-900 font-bold text-base mt-2">
                        {searchQuery ? 'No Matching Parcels' : 'No Parcels Found'}
                    </Text>
                    <Text className="text-gray-500 text-xs text-center mt-1 mb-4">
                        {searchQuery
                            ? `No parcels match your search for "${searchQuery}".`
                            : 'Register your first agricultural land parcel to start cropping.'}
                    </Text>
                    {searchQuery ? (
                        <Pressable
                            onPress={() => setSearchQuery('')}
                            className="bg-gray-100 px-4 py-2 rounded-xl active:bg-gray-200"
                        >
                            <Text className="text-emerald-800 font-bold text-xs">Clear Search</Text>
                        </Pressable>
                    ) : (
                        <Pressable
                            onPress={openCreateModal}
                            className="bg-emerald-700 px-5 py-2 rounded-xl"
                        >
                            <Text className="text-white font-bold text-sm">Add Parcel</Text>
                        </Pressable>
                    )}
                </View>
            ) : (
                <View className="flex-row flex-wrap justify-between gap-3">
                    {filteredParcels.map(({ parcel, landOwner, activeCycle }: any) => (
                        <View
                            key={parcel.id}
                            testID={`parcel-card-${parcel.id}`}
                            className="w-full md:w-[48%] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm"
                        >
                            <View className="flex-row justify-between items-start mb-2">
                                <View>
                                    <View className="flex-row items-center gap-2">
                                        <Text className="text-lg font-black text-gray-900">{parcel.name}</Text>
                                        <Text className="text-xs font-semibold text-gray-500">({parcel.code})</Text>
                                        <View className="bg-emerald-100 px-2.5 py-0.5 rounded-full">
                                            <Text className="text-emerald-800 text-xs font-bold capitalize">
                                                {parcel.status}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text className="text-xs text-gray-600 mt-1">
                                        Owner: <Text className="font-bold text-gray-900">{landOwner?.name || 'Unassigned'}</Text>
                                        {landOwner?.contactNumber ? ` • ${landOwner.contactNumber}` : ''}
                                    </Text>
                                    <Text className="text-xs text-gray-500 mt-0.5">
                                        Location: {parcel.locationAddress || 'Not specified'} • Soil: {parcel.soilType || 'Loam'}
                                    </Text>
                                </View>

                                <View className="items-end">
                                    <Text className="text-xl font-black text-emerald-800">
                                        {parcel.areaHectares} <Text className="text-xs font-semibold text-gray-500">ha</Text>
                                    </Text>
                                    <Text className="text-xs text-gray-500">
                                        {(parcel.areaHectares * 10000).toLocaleString()} m²
                                    </Text>
                                    <View className="flex-row gap-2 mt-2">
                                        <Pressable
                                            onPress={() => handleOpenEdit(parcel, landOwner)}
                                            testID={`parcel-edit-${parcel.id}`}
                                            className="flex-row items-center gap-1 bg-gray-100 px-2.5 py-1.5 rounded-lg active:bg-gray-200"
                                        >
                                            <MaterialIcons name="edit" size={14} color="#374151" />
                                            <Text className="text-gray-700 font-bold text-xs">Edit</Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={() => handleDeleteParcel(parcel)}
                                            testID={`parcel-delete-${parcel.id}`}
                                            className="flex-row items-center gap-1 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-lg active:bg-red-100"
                                        >
                                            <MaterialIcons name="delete-outline" size={14} color="#DC2626" />
                                            <Text className="text-red-700 font-bold text-xs">Delete</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            </View>

                            {/* Active Cycle Information */}
                            {activeCycle ? (
                                <View className="mt-3 pt-3 border-t border-gray-100 flex-row justify-between items-center">
                                    <View className="flex-row items-center gap-2">
                                        <MaterialIcons name="grass" size={18} color="#059669" />
                                        <Text className="text-xs font-bold text-gray-700">
                                            Cycle: {activeCycle.cycleCode} ({activeCycle.variety || 'Cassava'})
                                        </Text>
                                    </View>
                                    <Text className="text-xs text-emerald-700 font-bold">
                                        Yield: {(activeCycle.totalActualYieldKg || 0).toLocaleString()} kg
                                    </Text>
                                </View>
                            ) : (
                                <View className="mt-3 pt-3 border-t border-gray-100 flex-row justify-between items-center">
                                    <Text className="text-xs text-gray-400">Ready for planting cycle</Text>
                                    <Pressable
                                        onPress={() => router.push(`/(admin)/agribusiness/cycles?parcelId=${parcel.id}` as any)}
                                        className="bg-gray-100 px-3 py-1 rounded-lg active:bg-gray-200"
                                    >
                                        <Text className="text-gray-700 font-bold text-xs">Start Cycle</Text>
                                    </Pressable>
                                </View>
                            )}

                            {/* Action Buttons */}
                            <View className="mt-4 flex-row gap-2 pt-2">
                                <Pressable
                                    onPress={() => router.push(`/(admin)/agribusiness/mapping?parcelId=${parcel.id}` as any)}
                                    testID={`parcel-mapping-link-${parcel.id}`}
                                    className="flex-1 bg-emerald-50 border border-emerald-200 py-2 rounded-xl flex-row items-center justify-center gap-1.5 active:bg-emerald-100"
                                >
                                    <MaterialIcons name="map" size={16} color="#047857" />
                                    <Text className="text-emerald-800 font-bold text-xs">GPS Mapping</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => router.push(`/(admin)/agribusiness/harvest?parcelId=${parcel.id}` as any)}
                                    className="flex-1 bg-amber-50 border border-amber-200 py-2 rounded-xl flex-row items-center justify-center gap-1.5 active:bg-amber-100"
                                >
                                    <MaterialIcons name="scale" size={16} color="#B45309" />
                                    <Text className="text-amber-800 font-bold text-xs">Weigh-in Scale</Text>
                                </Pressable>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Register Parcel Modal */}
            <Modal visible={modalVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-xl font-black text-gray-900">
                                {editingParcelId ? 'Edit Land Parcel' : 'Register Land Parcel'}
                            </Text>
                            <Pressable onPress={() => setModalVisible(false)} className="p-1">
                                <MaterialIcons name="close" size={24} color="#6B7280" />
                            </Pressable>
                        </View>

                        <ScrollView className="max-h-[70vh]">
                            <Text className="text-xs font-bold text-gray-700 mb-1">Parcel Name *</Text>
                            <TextInput
                                value={parcelName}
                                onChangeText={setParcelName}
                                placeholder="e.g. Parcel Alpha North"
                                placeholderTextColor="#9CA3AF"
                                testID="parcel-name-input"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Parcel Code</Text>
                            <TextInput
                                value={parcelCode}
                                onChangeText={setParcelCode}
                                placeholder="e.g. PCL-001"
                                placeholderTextColor="#9CA3AF"
                                testID="parcel-code-input"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">
                                {editingParcelId ? 'Land Owner (unchanged)' : 'Land Owner Name *'}
                            </Text>
                            {editingParcelId && (
                                <Text className="text-xs text-amber-700 mb-1">
                                    Registered under {editingOwnerName || 'Unassigned'} — ₱1.00/kg and ₱25,000 guaranteed minimum stay locked.
                                </Text>
                            )}
                            <TextInput
                                value={ownerName}
                                onChangeText={setOwnerName}
                                placeholder="e.g. Don Ramon Valderrama"
                                placeholderTextColor="#9CA3AF"
                                editable={!editingParcelId}
                                testID="landowner-name-input"
                                className={`border border-gray-300 rounded-xl p-3 text-sm mb-3 ${
                                    editingParcelId ? 'bg-gray-100 text-gray-500' : 'bg-gray-50 text-gray-900'
                                }`}
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Land Owner Contact Phone</Text>
                            <TextInput
                                value={ownerPhone}
                                onChangeText={setOwnerPhone}
                                placeholder="0917-XXX-XXXX"
                                placeholderTextColor="#9CA3AF"
                                editable={!editingParcelId}
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            {measureOnMap ? <Text className="text-sm text-green-800 mb-3">Area will be measured from your mapped boundary. The parcel is explicitly unmeasured until review and Save.</Text> : <>
                                <Text className="text-xs font-bold text-gray-700 mb-1">Area (Hectares) *</Text>
                                <TextInput
                                    value={areaHectares}
                                    onChangeText={setAreaHectares}
                                    placeholder="e.g. 3.5"
                                    keyboardType="numeric"
                                    placeholderTextColor="#9CA3AF"
                                    testID="parcel-area-input"
                                    className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                                />
                            </>}

                            <Text className="text-xs font-bold text-gray-700 mb-1">Location Address</Text>
                            <TextInput
                                value={locationAddress}
                                onChangeText={setLocationAddress}
                                placeholder="Barangay, Municipality"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Soil Type</Text>
                            {soilTypeOptions.length > 0 && (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mb-2">
                                    {soilTypeOptions.map((st) => (
                                        <Pressable
                                            key={st}
                                            onPress={() => setSoilType(st)}
                                            className={`px-3 py-1.5 rounded-lg border ${
                                                soilType === st
                                                    ? 'bg-emerald-800 border-emerald-800'
                                                    : 'bg-gray-100 border-gray-200'
                                            }`}
                                        >
                                            <Text
                                                className={`text-xs font-bold ${
                                                    soilType === st ? 'text-white' : 'text-gray-700'
                                                }`}
                                            >
                                                {st}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            )}
                            <TextInput
                                value={soilType}
                                onChangeText={setSoilType}
                                placeholder="Loam, Clay Loam, Sandy Loam"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-5"
                            />

                            <View className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 mb-4">
                                <Text className="text-emerald-900 font-bold text-xs">Contract Terms Preserved:</Text>
                                <Text className="text-emerald-700 text-xs mt-0.5">
                                    Land Owner will receive ₱1.00 per net harvested kilo with a ₱25,000 guaranteed minimum per cycle paid weekly.
                                </Text>
                            </View>
                        </ScrollView>

                        <View className="flex-row gap-3 mt-4">
                            <Pressable
                                onPress={() => setModalVisible(false)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl items-center"
                            >
                                <Text className="font-bold text-gray-700 text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleSaveParcel}
                                disabled={saving}
                                testID="save-parcel-button"
                                className="flex-1 py-3 bg-emerald-700 rounded-xl items-center active:bg-emerald-800"
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text className="font-bold text-white text-sm">
                                        {editingParcelId ? 'Update Parcel' : 'Save Parcel'}
                                    </Text>
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
