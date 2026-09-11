import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { deviceSecurityService } from '../services/DeviceSecurityService';

export function DeviceLockOverlay() {
    const [isLocked, setIsLocked] = useState(false);
    const [deviceId, setDeviceId] = useState<string>('');
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        void deviceSecurityService.getDeviceId().then(setDeviceId);

        const unsubscribe = deviceSecurityService.onLockChange((locked) => {
            setIsLocked(locked);
        });

        return unsubscribe;
    }, []);

    const handleRetry = async () => {
        setChecking(true);
        try {
            const status = await deviceSecurityService.checkAndReportStatus();
            if (!status.isLocked) {
                setIsLocked(false);
            }
        } finally {
            setChecking(false);
        }
    };

    if (!isLocked) {
        return null;
    }

    return (
        <View className="absolute inset-0 z-50 bg-slate-900 justify-center items-center p-6">
            <View className="bg-slate-800 border-2 border-red-600 rounded-3xl p-8 max-w-lg w-full items-center shadow-2xl">
                <View className="w-20 h-20 rounded-full bg-red-900/50 border border-red-500 items-center justify-center mb-6">
                    <MaterialIcons name="lock" size={44} color="#EF4444" />
                </View>

                <Text className="text-2xl font-black text-white text-center tracking-wide uppercase">
                    Device Locked
                </Text>

                <Text className="text-red-400 text-xs font-bold uppercase tracking-widest mt-1 mb-4">
                    POS Terminal Disabled
                </Text>

                <View className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 w-full mb-6">
                    <Text className="text-slate-400 text-xs text-center leading-relaxed">
                        This terminal has been placed on administrative hold by Viterbo Foods OPC Security.
                        All local sales transactions and sync operations are suspended.
                    </Text>
                </View>

                <View className="bg-slate-950 px-4 py-3 rounded-lg border border-slate-800 w-full mb-6 items-center">
                    <Text className="text-slate-500 text-xs uppercase font-semibold">Terminal Identifier</Text>
                    <Text className="text-slate-200 text-sm font-mono font-bold mt-0.5 select-all">
                        {deviceId || 'Loading...'}
                    </Text>
                </View>

                <Pressable
                    onPress={handleRetry}
                    disabled={checking}
                    className="w-full bg-red-600 active:bg-red-700 py-3.5 rounded-xl items-center flex-row justify-center"
                >
                    {checking ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <>
                            <MaterialIcons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text className="text-white font-bold text-sm">Check Unlock Status</Text>
                        </>
                    )}
                </Pressable>
            </View>
        </View>
    );
}
