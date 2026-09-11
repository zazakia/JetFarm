import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../../src/database/supabase';
import { format } from 'date-fns';

interface RegisteredDevice {
    id: string;
    device_id: string;
    branch_id: string;
    device_name: string | null;
    device_model: string | null;
    os_version: string | null;
    app_version: string | null;
    is_locked: boolean;
    wipe_requested: boolean;
    wipe_completed_at: string | null;
    last_heartbeat: string | null;
    last_ip_address: string | null;
    is_active: boolean;
    registered_at: string | null;
}

export default function DeviceManagementScreen() {
    const [devices, setDevices] = useState<RegisteredDevice[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [actioningId, setActioningId] = useState<string | null>(null);

    const loadDevices = async () => {
        if (!supabase) {
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('device_registry')
                .select('*')
                .order('last_heartbeat', { ascending: false });

            if (error) {
                console.error('[Devices] Fetch error:', error.message);
            } else {
                setDevices(data || []);
            }
        } catch (err) {
            console.error('[Devices] Error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            void loadDevices();
        }, [])
    );

    const handleToggleLock = async (device: RegisteredDevice) => {
        const newLockState = !device.is_locked;
        const actionText = newLockState ? 'Lock' : 'Unlock';

        Alert.alert(
            `${actionText} Device?`,
            `Are you sure you want to ${actionText.toLowerCase()} terminal ${device.device_name || device.device_id} assigned to branch ${device.branch_id}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: actionText,
                    style: newLockState ? 'destructive' : 'default',
                    onPress: async () => {
                        setActioningId(device.id);
                        try {
                            const { error } = await supabase
                                .from('device_registry')
                                .update({ is_locked: newLockState })
                                .eq('id', device.id);

                            if (error) {
                                Alert.alert('Error', error.message);
                            } else {
                                setDevices(prev =>
                                    prev.map(d => d.id === device.id ? { ...d, is_locked: newLockState } : d)
                                );
                            }
                        } finally {
                            setActioningId(null);
                        }
                    }
                }
            ]
        );
    };

    const handleRemoteWipe = async (device: RegisteredDevice) => {
        Alert.alert(
            '⚠️ CONFIRM REMOTE WIPE',
            `This will permanently erase all local offline data and cached POS transactions on terminal ${device.device_id}. This action CANNOT be undone!`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'ERASE DEVICE',
                    style: 'destructive',
                    onPress: async () => {
                        setActioningId(device.id);
                        try {
                            const { error } = await supabase
                                .from('device_registry')
                                .update({ wipe_requested: true, is_locked: true })
                                .eq('id', device.id);

                            if (error) {
                                Alert.alert('Error', error.message);
                            } else {
                                Alert.alert('Wipe Command Sent', 'Device will be erased on its next sync or heartbeat.');
                                setDevices(prev =>
                                    prev.map(d => d.id === device.id ? { ...d, wipe_requested: true, is_locked: true } : d)
                                );
                            }
                        } finally {
                            setActioningId(null);
                        }
                    }
                }
            ]
        );
    };

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadDevices(); }} />}
        >
            <View className="p-6 max-w-6xl mx-auto w-full">
                {/* Header */}
                <View className="flex-row items-center justify-between mb-6">
                    <View>
                        <Text className="text-2xl font-bold text-gray-900">Branch Device Registry</Text>
                        <Text className="text-sm text-gray-500 mt-0.5">
                            Monitor tablet heartbeats, lock stolen devices, or trigger remote wipes
                        </Text>
                    </View>
                    <View className="bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full flex-row items-center">
                        <View className="w-2 h-2 rounded-full bg-blue-600 mr-2" />
                        <Text className="text-xs font-semibold text-blue-900">
                            {devices.length} Registered Terminals
                        </Text>
                    </View>
                </View>

                {/* Device Cards */}
                {loading ? (
                    <View className="py-16 items-center">
                        <ActivityIndicator size="large" color="#1E3A8A" />
                        <Text className="text-sm text-gray-500 mt-3 font-medium">Scanning device network...</Text>
                    </View>
                ) : devices.length === 0 ? (
                    <View className="bg-white rounded-2xl p-12 border border-gray-200 items-center">
                        <MaterialIcons name="devices" size={48} color="#9CA3AF" />
                        <Text className="text-lg font-bold text-gray-800 mt-4">No Terminals Registered</Text>
                        <Text className="text-sm text-gray-500 text-center mt-1 max-w-sm">
                            When branch tablets open the POS app, they will automatically register here with their unique device ID.
                        </Text>
                    </View>
                ) : (
                    <View className="space-y-4">
                        {devices.map(device => {
                            const isBusy = actioningId === device.id;
                            const isOnline = device.last_heartbeat &&
                                (new Date().getTime() - new Date(device.last_heartbeat).getTime()) < 30 * 60 * 1000;

                            return (
                                <View
                                    key={device.id}
                                    className={`bg-white rounded-2xl border p-5 shadow-sm ${
                                        device.is_locked ? 'border-red-300 bg-red-50/20' : 'border-gray-200'
                                    }`}
                                >
                                    <View className="flex-row flex-wrap items-start justify-between gap-4">
                                        <View className="flex-row items-center">
                                            <View
                                                className={`w-12 h-12 rounded-xl items-center justify-center mr-4 ${
                                                    device.is_locked ? 'bg-red-100' : 'bg-blue-100'
                                                }`}
                                            >
                                                <MaterialIcons
                                                    name={device.is_locked ? 'lock' : 'tablet-android'}
                                                    size={24}
                                                    color={device.is_locked ? '#DC2626' : '#1E3A8A'}
                                                />
                                            </View>
                                            <View>
                                                <View className="flex-row items-center gap-2">
                                                    <Text className="text-base font-bold text-gray-900">
                                                        {device.device_name || 'Branch Terminal'}
                                                    </Text>
                                                    {device.is_locked && (
                                                        <View className="bg-red-100 px-2 py-0.5 rounded-md">
                                                            <Text className="text-[10px] font-bold text-red-700 uppercase">
                                                                LOCKED
                                                            </Text>
                                                        </View>
                                                    )}
                                                    {device.wipe_requested && (
                                                        <View className="bg-amber-100 px-2 py-0.5 rounded-md">
                                                            <Text className="text-[10px] font-bold text-amber-800 uppercase">
                                                                WIPE PENDING
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text className="text-xs text-gray-500 font-mono mt-0.5">
                                                    ID: {device.device_id}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Action buttons */}
                                        <View className="flex-row items-center gap-2">
                                            <Pressable
                                                onPress={() => handleToggleLock(device)}
                                                disabled={isBusy}
                                                className={`px-4 py-2 rounded-xl flex-row items-center border ${
                                                    device.is_locked
                                                        ? 'bg-emerald-600 border-emerald-600'
                                                        : 'bg-white border-red-300 active:bg-red-50'
                                                }`}
                                            >
                                                <MaterialIcons
                                                    name={device.is_locked ? 'lock-open' : 'lock'}
                                                    size={16}
                                                    color={device.is_locked ? '#FFFFFF' : '#DC2626'}
                                                    style={{ marginRight: 6 }}
                                                />
                                                <Text
                                                    className={`text-xs font-bold ${
                                                        device.is_locked ? 'text-white' : 'text-red-600'
                                                    }`}
                                                >
                                                    {device.is_locked ? 'Unlock' : 'Lock Terminal'}
                                                </Text>
                                            </Pressable>

                                            <Pressable
                                                onPress={() => handleRemoteWipe(device)}
                                                disabled={isBusy || device.wipe_requested}
                                                className="px-4 py-2 rounded-xl flex-row items-center bg-gray-100 border border-gray-200 active:bg-red-100"
                                            >
                                                <MaterialIcons name="delete-forever" size={16} color="#4B5563" style={{ marginRight: 6 }} />
                                                <Text className="text-xs font-semibold text-gray-700">Remote Wipe</Text>
                                            </Pressable>
                                        </View>
                                    </View>

                                    {/* Metadata Footer */}
                                    <View className="mt-4 pt-4 border-t border-gray-100 flex-row flex-wrap items-center justify-between text-xs text-gray-500 gap-y-2">
                                        <View className="flex-row items-center mr-6">
                                            <MaterialIcons name="store" size={14} color="#6B7280" style={{ marginRight: 4 }} />
                                            <Text className="text-xs text-gray-600 font-medium">
                                                Branch: <Text className="font-bold text-gray-900">{device.branch_id || 'Unassigned'}</Text>
                                            </Text>
                                        </View>

                                        <View className="flex-row items-center mr-6">
                                            <View className={`w-2 h-2 rounded-full mr-1.5 ${isOnline ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                                            <Text className="text-xs text-gray-600">
                                                {isOnline ? 'Online' : 'Offline'} • Last seen:{' '}
                                                {device.last_heartbeat ? format(new Date(device.last_heartbeat), 'MMM dd, HH:mm') : 'Never'}
                                            </Text>
                                        </View>

                                        <View className="flex-row items-center">
                                            <Text className="text-xs text-gray-400">
                                                OS: {device.os_version || 'N/A'} • v{device.app_version || '0.1.0'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            </View>
        </ScrollView>
    );
}
