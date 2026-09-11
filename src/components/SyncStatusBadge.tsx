import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useSyncStore } from '../stores/syncStore';
import { SyncService } from '../services/SyncService';
import { useAuth } from '../store/AuthContext';

export function SyncStatusBadge() {
    const { isOnline, pendingChanges, status, setOnline } = useSyncStore();
    const { sunlightMode } = useAuth();

    useEffect(() => {
        // Subscribe to network state changes
        const unsubscribe = NetInfo.addEventListener(state => {
            setOnline(!!state.isConnected);
        });

        // Initial check for pending count
        SyncService.updatePendingCount();

        return () => unsubscribe();
    }, []);

    const handleSync = async () => {
        if (isOnline && status !== 'syncing') {
            await SyncService.checkAndSync({ force: true });
        }
    };

    if (status === 'syncing') {
        return (
            <View className={`flex-row items-center px-3 py-1.5 rounded-full border ${sunlightMode ? 'bg-white border-4 border-black' : 'bg-blue-50 border-blue-100'}`}>
                <View className="mr-2">
                    <MaterialIcons name="sync" size={14} color={sunlightMode ? "#000" : "#2563EB"} className="animate-spin" />
                </View>
                <Text className={`${sunlightMode ? 'text-black' : 'text-blue-700'} text-xs font-black uppercase tracking-tighter`}>Syncing</Text>
            </View>
        );
    }

    return (
        <TouchableOpacity 
            onPress={handleSync}
            disabled={!isOnline}
            className={`flex-row items-center px-3 py-1.5 rounded-full border ${
                sunlightMode 
                ? 'bg-white border-2 border-black' 
                : (
                    !isOnline 
                    ? 'bg-amber-50 border-amber-100' 
                    : pendingChanges > 0 
                        ? 'bg-blue-50 border-blue-100' 
                        : 'bg-green-50 border-green-100'
                )
            }`}
        >
            <View className="mr-2">
                <MaterialIcons 
                    name={!isOnline ? "cloud-off" : pendingChanges > 0 ? "cloud-upload" : "cloud-done"} 
                    size={14} 
                    color={sunlightMode ? "#000" : (!isOnline ? "#D97706" : pendingChanges > 0 ? "#2563EB" : "#16A34A")} 
                />
            </View>
            <Text 
                className={`text-xs font-black uppercase tracking-tighter ${
                    sunlightMode 
                    ? 'text-black' 
                    : (!isOnline ? 'text-amber-700' : pendingChanges > 0 ? 'text-blue-700' : 'text-green-700')
                }`}
            >
                {!isOnline 
                    ? 'Offline' 
                    : pendingChanges > 0 
                        ? `${pendingChanges} Pnd` 
                        : 'Synced'
                }
            </Text>
        </TouchableOpacity>
    );
}
