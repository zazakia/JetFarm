import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import AgriParcel from '../../../src/database/models/AgriParcel';
import { AgriParcelService } from '../../../src/services/AgriParcelService';
import { GPSCoordinate, isValidCoordinate, parseGpsCoordinates } from '../../../src/utils/coordinates';
import {
    appendVertexIfMoved,
    DEFAULT_WALK_SETTINGS,
    GPSFix,
    isFixAccepted,
    WalkSettings,
} from '../../../src/services/BoundaryWalkService';
import { locationProvider, LocationWatchHandle } from '../../../src/services/LocationService';
import { ErrorService, ErrorType } from '../../../src/services/ErrorService';
import { ParcelMap } from '../../../src/components/ParcelMap';
import { ConfirmDialog } from '../../../src/components/ConfirmDialog';
import { Q } from '@nozbe/watermelondb';

/**
 * Cross-platform dialog spec. `Alert.alert` from react-native is a no-op on
 * web (react-native-web stubs it), so every confirmation and message here
 * goes through ConfirmDialog instead.
 */
interface DialogSpec {
    title: string;
    message: string;
    mode: 'confirm' | 'alert';
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm?: () => void;
}

export default function GPSMappingScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();

    const [parcels, setParcels] = useState<AgriParcel[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedParcelId, setSelectedParcelId] = useState<string>((params.parcelId as string) || '');
    const [coordinates, setCoordinates] = useState<GPSCoordinate[]>([]);
    const [dirty, setDirty] = useState(false);
    const [newLat, setNewLat] = useState('');
    const [newLon, setNewLon] = useState('');
    const [inputError, setInputError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [dialog, setDialog] = useState<DialogSpec | null>(null);

    const closeDialog = useCallback(() => setDialog(null), []);
    const showDialog = useCallback((spec: DialogSpec) => setDialog(spec), []);

    // Boundary-walk state
    const [walkActive, setWalkActive] = useState(false);
    const [liveFix, setLiveFix] = useState<GPSFix | null>(null);
    const walkSettings: WalkSettings = DEFAULT_WALK_SETTINGS;
    const watchRef = useRef<LocationWatchHandle | null>(null);

    const stopWalk = useCallback(() => {
        watchRef.current?.remove();
        watchRef.current = null;
        setWalkActive(false);
        setLiveFix(null);
    }, []);

    const applyParcel = useCallback(
        (id: string, list: AgriParcel[]) => {
            const parcel = list.find((p) => p.id === id) || null;
            stopWalk();
            setSelectedParcelId(id);
            setCoordinates(parcel ? parseGpsCoordinates(parcel.gpsCoordinates) : []);
            setDirty(false);
            setNewLat('');
            setNewLon('');
            setInputError(null);
        },
        [stopWalk]
    );

    useEffect(() => {
        let cancelled = false;
        const loadParcels = async () => {
            try {
                const list = await database
                    .get<AgriParcel>('agri_parcels')
                    .query(Q.where('deleted_at', null))
                    .fetch();
                if (cancelled) return;
                setParcels(list);
                const initialId = selectedParcelId || (list.length > 0 ? list[0].id : '');
                if (initialId) applyParcel(initialId, list);
            } catch (err) {
                ErrorService.handleError(err, 'GPSMapping.loadParcels', ErrorType.DATABASE);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        loadParcels();
        return () => {
            cancelled = true;
            watchRef.current?.remove();
            watchRef.current = null;
        };
         
    }, []);

    const handleSelectParcel = (id: string) => {
        if (id === selectedParcelId) return;
        const commit = () => applyParcel(id, parcels);
        if (!dirty) {
            commit();
            return;
        }
        showDialog({
            title: 'Unsaved Changes',
            message: 'Discard the unsaved boundary edits for the current parcel?',
            mode: 'confirm',
            confirmLabel: 'Discard',
            cancelLabel: 'Keep Editing',
            destructive: true,
            onConfirm: commit,
        });
    };

    const selectedParcel = parcels.find((p) => p.id === selectedParcelId) || null;
    const areaHectares = AgriParcelService.calculatePolygonAreaHectares(coordinates);

    const handleMapChange = useCallback((next: GPSCoordinate[]) => {
        setCoordinates(next);
        setDirty(true);
    }, []);

    const handleAddPoint = () => {
        const lat = parseFloat(newLat);
        const lon = parseFloat(newLon);
        if (!isValidCoordinate(lat, lon)) {
            setInputError('Enter valid decimal degrees: latitude −90…90, longitude −180…180.');
            return;
        }
        setInputError(null);
        handleMapChange([...coordinates, { latitude: lat, longitude: lon }]);
        setNewLat('');
        setNewLon('');
    };

    const handleRemovePoint = (index: number) => {
        handleMapChange(coordinates.filter((_, i) => i !== index));
    };

    const handleClearBoundary = () => {
        if (coordinates.length === 0) return;
        showDialog({
            title: 'Clear Boundary',
            message: 'Remove all boundary vertices for this parcel?',
            mode: 'confirm',
            confirmLabel: 'Clear',
            destructive: true,
            onConfirm: () => handleMapChange([]),
        });
    };

    const handleSimulateGPS = () => {
        // Dev-only helper: generates a realistic quadrilateral in the Bukidnon cassava belt.
        const baseLat = 8.35 + Math.random() * 0.01;
        const baseLon = 124.86 + Math.random() * 0.01;
        const offset = 0.0035;
        handleMapChange([
            { latitude: Number(baseLat.toFixed(6)), longitude: Number(baseLon.toFixed(6)) },
            { latitude: Number((baseLat + offset).toFixed(6)), longitude: Number((baseLon + 0.0005).toFixed(6)) },
            { latitude: Number((baseLat + offset + 0.001).toFixed(6)), longitude: Number((baseLon + offset).toFixed(6)) },
            { latitude: Number((baseLat - 0.0005).toFixed(6)), longitude: Number((baseLon + offset - 0.0005).toFixed(6)) },
        ]);
    };

    const handleStartWalk = async () => {
        try {
            const permission = await locationProvider.requestPermission();
            if (permission !== 'granted') {
                showDialog({
                    title: 'Location Permission Required',
                    message:
                        'Enable location access to capture the parcel boundary by walking its perimeter.',
                    mode: 'alert',
                });
                return;
            }
            const handle = await locationProvider.watchPosition(
                (fix) => {
                    if (!isFixAccepted(fix, walkSettings)) return;
                    setLiveFix(fix);
                    setCoordinates((prev) => {
                        const next = appendVertexIfMoved(prev, fix, walkSettings);
                        if (next !== prev) setDirty(true);
                        return next;
                    });
                },
                (err) => ErrorService.handleError(err, 'GPSMapping.walk', ErrorType.UNKNOWN)
            );
            watchRef.current = handle;
            setWalkActive(true);
        } catch (err) {
            ErrorService.handleError(err, 'GPSMapping.startWalk', ErrorType.UNKNOWN);
        }
    };

    const handleStopWalk = () => stopWalk();

    const handleSaveBoundary = async () => {
        if (!selectedParcelId) {
            showDialog({
                title: 'No Parcel Selected',
                message: 'Select a parcel before saving boundary coordinates.',
                mode: 'alert',
            });
            return;
        }

        if (coordinates.length === 0) {
            showDialog({
                title: 'Clear Boundary',
                message: 'Save an empty boundary? This removes all GPS data for this parcel.',
                mode: 'confirm',
                confirmLabel: 'Clear Boundary',
                destructive: true,
                onConfirm: () => performSave(true),
            });
            return;
        }

        if (coordinates.length < 3) {
            showDialog({
                title: 'Boundary Incomplete',
                message:
                    'A valid parcel boundary requires at least 3 GPS vertices. Add more points, or clear the boundary entirely.',
                mode: 'alert',
            });
            return;
        }

        await performSave(false);
    };

    const performSave = async (clearing: boolean) => {
        setSaving(true);
        try {
            await AgriParcelService.updateParcel(selectedParcelId, {
                gpsCoordinates: coordinates,
                areaHectares: !clearing && areaHectares > 0 ? areaHectares : undefined,
            });
            setDirty(false);
            showDialog({
                title: 'Boundary Saved',
                message: clearing
                    ? 'Boundary cleared for this parcel.'
                    : `Successfully saved ${coordinates.length} GPS vertices. Calculated Area: ${areaHectares.toFixed(4)} ha.`,
                mode: 'alert',
            });
        } catch (error: any) {
            ErrorService.handleError(error, 'GPSMapping.saveBoundary', ErrorType.DATABASE);
            showDialog({
                title: 'Save Failed',
                message: error?.message || 'Failed to update parcel boundary.',
                mode: 'alert',
                destructive: true,
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 bg-gray-50 items-center justify-center">
                <ActivityIndicator size="large" color="#0F766E" />
            </View>
        );
    }

    return (
        <>
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 20 }}>
            {/* Header */}
            <View className="mb-6">
                <View className="flex-row items-center justify-between">
                    <Pressable onPress={() => router.back()} className="mr-3 p-1" testID="mapping-back">
                        <MaterialIcons name="arrow-back" size={24} color="#111827" />
                    </Pressable>
                    <View className="flex-1">
                        <Text className="text-2xl font-black text-gray-900">GPS Boundary Mapping</Text>
                        <Text className="text-sm text-gray-500 mt-0.5">
                            Walk or tap the parcel perimeter and auto-calculate acreage in hectares
                        </Text>
                    </View>
                    {dirty && (
                        <View className="bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg" testID="unsaved-badge">
                            <Text className="text-amber-800 font-bold text-[10px]">UNSAVED</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Parcel Selector */}
            <View className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6">
                <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                    Select Target Parcel
                </Text>
                {parcels.length === 0 ? (
                    <Text className="text-xs text-gray-400">No parcels registered yet.</Text>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                        {parcels.map((p) => (
                            <Pressable
                                key={p.id}
                                onPress={() => handleSelectParcel(p.id)}
                                testID={`parcel-chip-${p.id}`}
                                className={`px-4 py-2 rounded-xl border ${
                                    selectedParcelId === p.id
                                        ? 'bg-teal-800 border-teal-800'
                                        : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                                }`}
                            >
                                <Text
                                    className={`text-xs font-bold ${
                                        selectedParcelId === p.id ? 'text-white' : 'text-gray-800'
                                    }`}
                                >
                                    {p.name} ({p.code || 'No Code'})
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                )}
            </View>

            {/* Calculated Acreage Card */}
            <View className="bg-teal-800 rounded-3xl p-6 mb-6 shadow-md">
                <View className="flex-row justify-between items-center">
                    <View>
                        <Text className="text-teal-200 text-xs font-bold uppercase tracking-wider">
                            Auto-Calculated Perimeter Area
                        </Text>
                        <Text className="text-white text-3xl font-black mt-1">
                            {areaHectares.toFixed(4)} <Text className="text-lg font-semibold text-teal-100">ha</Text>
                        </Text>
                        <Text className="text-teal-200 text-xs mt-0.5">
                            {(areaHectares * 10000).toLocaleString(undefined, { maximumFractionDigits: 1 })} m² (Square Meters)
                        </Text>
                    </View>
                    <View className="bg-teal-900/60 p-3 rounded-2xl border border-teal-700">
                        <MaterialIcons name="square-foot" size={32} color="#5EEAD4" />
                    </View>
                </View>

                <View className="mt-4 pt-4 border-t border-teal-700/50 flex-row justify-between items-center">
                    <Text className="text-teal-100 text-xs">
                        {coordinates.length} Boundary GPS Vertices Registered
                    </Text>
                    {__DEV__ && (
                        <Pressable
                            onPress={handleSimulateGPS}
                            testID="simulate-walk"
                            className="bg-teal-600/80 px-3 py-1.5 rounded-lg active:bg-teal-600"
                        >
                            <Text className="text-white font-bold text-xs">Simulate Field Walk</Text>
                        </Pressable>
                    )}
                </View>
            </View>

            {/* Live Map */}
            <View className="mb-6">
                <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Parcel Boundary Map
                    </Text>
                    <Text className="text-[10px] text-gray-400">OpenStreetMap</Text>
                </View>
                <ParcelMap
                    coordinates={coordinates}
                    onChange={handleMapChange}
                    editable
                    liveCoordinate={liveFix?.coordinate ?? null}
                />
                {coordinates.length === 0 && (
                    <View
                        className="bg-white border border-dashed border-gray-300 rounded-2xl mt-2 p-4 items-center"
                        testID="empty-boundary-state"
                    >
                        <MaterialIcons name="add-location-alt" size={28} color="#9CA3AF" />
                        <Text className="text-gray-500 text-xs font-semibold mt-2 text-center">
                            No boundary captured yet for {selectedParcel ? selectedParcel.name : 'this parcel'}.
                        </Text>
                        <Text className="text-gray-400 text-[11px] mt-1 text-center">
                            Tap the map, walk the perimeter with GPS, or enter coordinates manually below.
                        </Text>
                    </View>
                )}
                {coordinates.length > 0 && (
                    <Text className="text-[10px] text-gray-400 mt-2">
                        Tap the map to add a vertex · drag a pin to move it · tap a pin to remove it
                    </Text>
                )}
            </View>

            {/* Boundary Walk Capture */}
            <View className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-6">
                <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-sm font-bold text-gray-900">GPS Boundary Walk</Text>
                    {walkActive && liveFix?.accuracyMeters != null && (
                        <Text className="text-[10px] text-gray-500" testID="walk-accuracy">
                            Accuracy ±{Math.round(liveFix.accuracyMeters)} m
                        </Text>
                    )}
                </View>
                {walkActive ? (
                    <View className="flex-row items-center gap-3">
                        <View className="flex-1 flex-row items-center gap-2">
                            <View className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                            <Text className="text-gray-700 text-xs font-semibold">
                                Recording… {coordinates.length} vertices captured
                            </Text>
                        </View>
                        <Pressable
                            onPress={handleStopWalk}
                            testID="stop-walk"
                            className="bg-red-600 px-4 py-2 rounded-xl active:bg-red-700"
                        >
                            <Text className="text-white font-bold text-xs">Stop & Finish</Text>
                        </Pressable>
                    </View>
                ) : (
                    <View>
                        <Text className="text-gray-500 text-xs mb-3">
                            Walk around the parcel perimeter. A vertex is captured automatically every{' '}
                            {DEFAULT_WALK_SETTINGS.minDistanceMeters} m once the GPS accuracy is within{' '}
                            {DEFAULT_WALK_SETTINGS.maxAccuracyMeters} m.
                        </Text>
                        <Pressable
                            onPress={handleStartWalk}
                            disabled={!selectedParcelId}
                            testID="start-walk"
                            className="bg-blue-700 px-4 py-2.5 rounded-xl items-center active:bg-blue-800"
                        >
                            <Text className="text-white font-bold text-xs">Start Walking Boundary</Text>
                        </Pressable>
                    </View>
                )}
            </View>

            {/* GPS Vertices Table */}
            <View className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-6">
                <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-sm font-bold text-gray-900">Boundary Coordinates List</Text>
                    {coordinates.length > 0 && (
                        <Pressable onPress={handleClearBoundary} testID="clear-boundary">
                            <Text className="text-red-600 font-bold text-[11px]">Clear all</Text>
                        </Pressable>
                    )}
                </View>
                {coordinates.length === 0 ? (
                    <Text className="text-gray-400 text-xs">No vertices recorded.</Text>
                ) : (
                    coordinates.map((coord, idx) => (
                        <View
                            key={idx}
                            className="flex-row justify-between items-center py-2.5 border-b border-gray-100"
                        >
                            <View className="flex-row items-center gap-2.5">
                                <View className="w-6 h-6 rounded-full bg-teal-100 items-center justify-center">
                                    <Text className="text-teal-900 font-bold text-xs">{idx + 1}</Text>
                                </View>
                                <Text className="text-gray-900 font-semibold text-xs">
                                    Lat: {coord.latitude.toFixed(5)}, Lon: {coord.longitude.toFixed(5)}
                                </Text>
                            </View>
                            <Pressable onPress={() => handleRemovePoint(idx)} testID={`remove-vertex-${idx}`} className="p-1">
                                <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                            </Pressable>
                        </View>
                    ))
                )}

                {/* Add Point Inputs */}
                <View className="mt-4 pt-4 border-t border-gray-100 flex-row gap-2">
                    <TextInput
                        value={newLat}
                        onChangeText={(t) => {
                            setNewLat(t);
                            if (inputError) setInputError(null);
                        }}
                        placeholder="Latitude (e.g. 8.3512)"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900"
                    />
                    <TextInput
                        value={newLon}
                        onChangeText={(t) => {
                            setNewLon(t);
                            if (inputError) setInputError(null);
                        }}
                        placeholder="Longitude (e.g. 124.8621)"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900"
                    />
                    <Pressable
                        onPress={handleAddPoint}
                        testID="add-vertex"
                        className="bg-teal-700 px-4 py-2 rounded-xl justify-center items-center active:bg-teal-800"
                    >
                        <MaterialIcons name="add" size={20} color="#FFFFFF" />
                    </Pressable>
                </View>
                {inputError && (
                    <View className="flex-row items-center gap-1.5 mt-2" testID="vertex-input-error">
                        <MaterialIcons name="error-outline" size={14} color="#DC2626" />
                        <Text className="text-red-700 text-[11px] flex-1">{inputError}</Text>
                    </View>
                )}
            </View>

            {/* Save Button */}
            <Pressable
                onPress={handleSaveBoundary}
                disabled={saving}
                testID="save-boundary"
                className="bg-teal-800 p-4 rounded-2xl items-center shadow-sm active:bg-teal-900 mb-8"
            >
                {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                    <Text className="text-white font-bold text-base">Save Boundary to Parcel</Text>
                )}
            </Pressable>
        </ScrollView>
        <ConfirmDialog
            visible={dialog !== null}
            title={dialog?.title ?? ''}
            message={dialog?.message ?? ''}
            mode={dialog?.mode ?? 'confirm'}
            confirmLabel={dialog?.confirmLabel}
            cancelLabel={dialog?.cancelLabel}
            isDestructive={dialog?.destructive}
            onConfirm={() => {
                const commit = dialog?.onConfirm;
                setDialog(null);
                commit?.();
            }}
            onCancel={closeDialog}
        />
        </>
    );
}
