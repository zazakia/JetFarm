import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import AgriParcel from '../../../src/database/models/AgriParcel';
import { AgriParcelService, GPSCoordinate } from '../../../src/services/AgriParcelService';
import { Q } from '@nozbe/watermelondb';

export default function GPSMappingScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();

    const [parcels, setParcels] = useState<AgriParcel[]>([]);
    const [selectedParcelId, setSelectedParcelId] = useState<string>(params.parcelId as string || '');
    const [coordinates, setCoordinates] = useState<GPSCoordinate[]>([
        { latitude: 8.3512, longitude: 124.8621 },
        { latitude: 8.3545, longitude: 124.8624 },
        { latitude: 8.3542, longitude: 124.8668 },
        { latitude: 8.3508, longitude: 124.8662 },
    ]);
    const [newLat, setNewLat] = useState('');
    const [newLon, setNewLon] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadParcels = async () => {
            try {
                const list = await database
                    .get<AgriParcel>('agri_parcels')
                    .query(Q.where('deleted_at', null))
                    .fetch();
                setParcels(list);
                if (!selectedParcelId && list.length > 0) {
                    setSelectedParcelId(list[0].id);
                    if (list[0].gpsCoordinates) {
                        try {
                            const parsed = JSON.parse(list[0].gpsCoordinates);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                setCoordinates(parsed);
                            }
                        } catch {
                            // default remains
                        }
                    }
                }
            } catch (err) {
                console.error('[GPSMapping] Error:', err);
            }
        };
        loadParcels();
    }, []);

    const handleSelectParcel = (id: string) => {
        setSelectedParcelId(id);
        const p = parcels.find(item => item.id === id);
        if (p && p.gpsCoordinates) {
            try {
                const parsed = JSON.parse(p.gpsCoordinates);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setCoordinates(parsed);
                }
            } catch {
                // keep current
            }
        }
    };

    const areaHectares = AgriParcelService.calculatePolygonAreaHectares(coordinates);

    const handleAddPoint = () => {
        const lat = parseFloat(newLat);
        const lon = parseFloat(newLon);
        if (isNaN(lat) || isNaN(lon)) {
            Alert.alert('Invalid Coordinate', 'Please enter valid decimal degrees for Latitude and Longitude.');
            return;
        }
        setCoordinates(prev => [...prev, { latitude: lat, longitude: lon }]);
        setNewLat('');
        setNewLon('');
    };

    const handleRemovePoint = (index: number) => {
        setCoordinates(prev => prev.filter((_, i) => i !== index));
    };

    const handleSimulateGPS = () => {
        // Generates realistic coordinates around Bukidnon / Mindanao cassava belts
        const baseLat = 8.3500 + Math.random() * 0.01;
        const baseLon = 124.8600 + Math.random() * 0.01;
        const offset = 0.0035;

        const simulated: GPSCoordinate[] = [
            { latitude: Number((baseLat).toFixed(4)), longitude: Number((baseLon).toFixed(4)) },
            { latitude: Number((baseLat + offset).toFixed(4)), longitude: Number((baseLon + 0.0005).toFixed(4)) },
            { latitude: Number((baseLat + offset + 0.001).toFixed(4)), longitude: Number((baseLon + offset).toFixed(4)) },
            { latitude: Number((baseLat - 0.0005).toFixed(4)), longitude: Number((baseLon + offset - 0.0005).toFixed(4)) },
        ];
        setCoordinates(simulated);
    };

    const handleSaveBoundary = async () => {
        if (!selectedParcelId) {
            Alert.alert('Error', 'Please select a parcel to save boundary coordinates.');
            return;
        }

        if (coordinates.length < 3) {
            Alert.alert('Error', 'A valid parcel boundary requires at least 3 GPS vertices.');
            return;
        }

        setSaving(true);
        try {
            await AgriParcelService.updateParcel(selectedParcelId, {
                gpsCoordinates: coordinates,
                areaHectares: areaHectares > 0 ? areaHectares : undefined,
            });
            Alert.alert(
                'Boundary Saved',
                `Successfully saved ${coordinates.length} GPS vertices. Calculated Area: ${areaHectares} ha.`
            );
        } catch (error: any) {
            Alert.alert('Save Failed', error?.message || 'Failed to update parcel boundary.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 20 }}>
            {/* Header */}
            <View className="mb-6">
                <Text className="text-2xl font-black text-gray-900">GPS Boundary Mapping</Text>
                <Text className="text-sm text-gray-500 mt-0.5">
                    Capture perimeter GPS points and auto-calculate acreage in hectares
                </Text>
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
                        {parcels.map(p => (
                            <Pressable
                                key={p.id}
                                onPress={() => handleSelectParcel(p.id)}
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
            <View className="bg-teal-800 rounded-3xl p-6 mb-6 shadow-md text-white">
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
                    <Pressable
                        onPress={handleSimulateGPS}
                        className="bg-teal-600/80 px-3 py-1.5 rounded-lg active:bg-teal-600"
                    >
                        <Text className="text-white font-bold text-xs">Simulate Field Walk</Text>
                    </Pressable>
                </View>
            </View>

            {/* Visual Boundary Simulation Canvas (Mock Polygon) */}
            <View className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm mb-6 items-center justify-center">
                <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 w-full">
                    Boundary Shape Preview (Projected)
                </Text>
                <View className="w-full h-48 bg-emerald-50 rounded-2xl border-2 border-dashed border-emerald-300 items-center justify-center relative overflow-hidden">
                    <MaterialIcons name="terrain" size={64} color="#A7F3D0" />
                    <View className="absolute inset-0 items-center justify-center">
                        <View className="w-28 h-28 border-2 border-emerald-600 bg-emerald-500/20 rounded-lg transform rotate-12 items-center justify-center">
                            <Text className="text-emerald-900 font-black text-xs">
                                {areaHectares.toFixed(2)} ha
                            </Text>
                        </View>
                    </View>
                    <View className="absolute bottom-2 right-3 bg-white/90 px-2.5 py-1 rounded-md border border-gray-200">
                        <Text className="text-gray-700 font-bold text-[10px]">Shoelace Geodesic Projection</Text>
                    </View>
                </View>
            </View>

            {/* GPS Vertices Table */}
            <View className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-6">
                <Text className="text-sm font-bold text-gray-900 mb-3">Boundary Coordinates List</Text>
                {coordinates.map((coord, idx) => (
                    <View
                        key={idx}
                        className="flex-row justify-between items-center py-2.5 border-b border-gray-100 last:border-b-0"
                    >
                        <View className="flex-row items-center gap-2.5">
                            <View className="w-6 h-6 rounded-full bg-teal-100 items-center justify-center">
                                <Text className="text-teal-900 font-bold text-xs">{idx + 1}</Text>
                            </View>
                            <Text className="text-gray-900 font-semibold text-xs">
                                Lat: {coord.latitude.toFixed(5)}, Lon: {coord.longitude.toFixed(5)}
                            </Text>
                        </View>
                        <Pressable onPress={() => handleRemovePoint(idx)} className="p-1">
                            <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                        </Pressable>
                    </View>
                ))}

                {/* Add Point Inputs */}
                <View className="mt-4 pt-4 border-t border-gray-100 flex-row gap-2">
                    <TextInput
                        value={newLat}
                        onChangeText={setNewLat}
                        placeholder="Latitude (e.g. 8.3512)"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900"
                    />
                    <TextInput
                        value={newLon}
                        onChangeText={setNewLon}
                        placeholder="Longitude (e.g. 124.8621)"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900"
                    />
                    <Pressable
                        onPress={handleAddPoint}
                        className="bg-teal-700 px-4 py-2 rounded-xl justify-center items-center active:bg-teal-800"
                    >
                        <MaterialIcons name="add" size={20} color="#FFFFFF" />
                    </Pressable>
                </View>
            </View>

            {/* Save Button */}
            <Pressable
                onPress={handleSaveBoundary}
                disabled={saving}
                className="bg-teal-800 p-4 rounded-2xl items-center shadow-sm active:bg-teal-900 mb-8"
            >
                {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                    <Text className="text-white font-bold text-base">Save Boundary to Parcel</Text>
                )}
            </Pressable>
        </ScrollView>
    );
}
