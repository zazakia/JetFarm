import React, { useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSyncStore, SyncLogEntry } from '../src/stores/syncStore';
import { SyncService } from '../src/services/SyncService';
import { syncAuditLogService } from '../src/services/SyncAuditLogService';
import { format, formatDistanceToNow } from 'date-fns';
import { StateView } from '../src/components/StateView';

function LogIcon({ type }: { type: SyncLogEntry['type'] }) {
    switch (type) {
        case 'success':
            return <MaterialIcons name="check-circle" size={16} color="#47734B" />;
        case 'error':
            return <MaterialIcons name="error" size={16} color="#EF4444" />;
        case 'table':
            return <MaterialIcons name="table-chart" size={16} color="#6366F1" />;
        default:
            return <MaterialIcons name="info" size={16} color="#60A5FA" />;
    }
}

function LogRow({ log }: { log: SyncLogEntry }) {
    return (
        <View className="flex-row items-start py-3 border-b border-gray-100">
            <View className="mt-0.5 mr-3">
                <LogIcon type={log.type} />
            </View>
            <View className="flex-1">
                <Text className="text-gray-900 text-sm font-semibold">{log.message}</Text>
                {log.detail ? (
                    <Text className="text-gray-700 text-xs mt-0.5">{log.detail}</Text>
                ) : null}
                <View className="flex-row items-center mt-1 gap-3">
                    <Text className="text-gray-700 text-[11px]">
                        {format(log.timestamp, 'HH:mm:ss')}
                    </Text>
                    {log.duration !== undefined && (
                        <Text className="text-gray-700 text-[11px]">{log.duration}ms</Text>
                    )}
                    {log.rowCount !== undefined && log.rowCount > 0 && (
                        <Text className="text-gray-700 text-[11px]">{log.rowCount} rows</Text>
                    )}
                </View>
            </View>
        </View>
    );
}

export default function SyncCenter() {
    const router = useRouter();
    const {
        status, progress, currentModel, lastSyncAt, isOnline, logs, errorMessage, clearLogs,
        latestAuditSessionId, auditPersistenceWarning, setSyncProgress,
    } = useSyncStore();

    const isSyncing = status === 'syncing';

    useEffect(() => {
        let mounted = true;
        syncAuditLogService.getLatestSession()
            .then((session) => {
                if (mounted && session && !latestAuditSessionId) {
                    setSyncProgress({ latestAuditSessionId: session.sessionId });
                }
            })
            .catch(() => undefined);
        return () => { mounted = false; };
    }, [latestAuditSessionId, setSyncProgress]);

    const handleSyncNow = async () => {
        await SyncService.checkAndSync({ force: true });
    };

    const handleClearLogs = () => {
        Alert.alert('Clear Logs', 'Are you sure you want to clear all sync logs?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: clearLogs },
        ]);
    };

    const handleExportDetailedLog = async () => {
        try {
            const destination = await syncAuditLogService.exportLatest();
            Alert.alert('Detailed log exported', destination);
        } catch (error: any) {
            Alert.alert('Export failed', error?.message || 'No detailed sync log is available yet.');
        }
    };

    const handleDeleteDetailedLogs = () => {
        Alert.alert(
            'Delete detailed logs',
            'Delete retained pull/push manifests from this device? This does not delete synced business data.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await syncAuditLogService.clearRetainedSessions();
                        setSyncProgress({ latestAuditSessionId: null, auditPersistenceWarning: null });
                    },
                },
            ],
        );
    };

    const progressPercent = Math.round(progress * 100);

    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <LinearGradient
                colors={['#1E293B', '#0F172A']}
                className="px-6 pt-12 pb-8 rounded-b-[32px]"
            >
                <View className="flex-row items-center justify-between mb-6">
                    <Pressable
                        onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                        className="p-2 bg-white/10 rounded-xl active:bg-white/20"
                    >
                        <MaterialIcons name="arrow-back" size={22} color="#FFF" />
                    </Pressable>
                    <Text className="text-white text-xl font-black">Sync Center</Text>
                    <Pressable
                        testID="sync-center-header-sync-button"
                        onPress={handleSyncNow}
                        disabled={isSyncing}
                        accessibilityRole="button"
                        accessibilityLabel={isSyncing ? 'Sync in progress' : 'Sync now'}
                        accessibilityState={{ disabled: isSyncing, busy: isSyncing }}
                        className="p-2 bg-white/10 rounded-xl active:bg-white/20"
                    >
                        {isSyncing ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <MaterialIcons name="sync" size={22} color="#FFF" />
                        )}
                    </Pressable>
                </View>

                {/* Status Row */}
                <View className="flex-row items-center gap-3 mb-5">
                    <View
                        className={`flex-row items-center px-3 py-1.5 rounded-full ${
                            isOnline ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
                        }`}
                    >
                        <View
                            className={`w-2 h-2 rounded-full mr-2 ${isOnline ? 'bg-green-400' : 'bg-red-400'}`}
                        />
                        <Text className={`text-xs font-bold ${isOnline ? 'text-green-300' : 'text-red-300'}`}>
                            {isOnline ? 'Online' : 'Offline'}
                        </Text>
                    </View>
                    {lastSyncAt && (
                        <Text className="text-white/90 text-xs">
                            Last sync {formatDistanceToNow(lastSyncAt, { addSuffix: true })}
                        </Text>
                    )}
                </View>

                {/* Progress Bar */}
                {isSyncing && (
                    <View>
                        <View className="flex-row justify-between mb-1">
                            <Text className="text-white/70 text-xs">{currentModel}</Text>
                            <Text className="text-white/70 text-xs">{progressPercent}%</Text>
                        </View>
                        <View className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <View
                                className="h-2 bg-teal-400 rounded-full"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </View>
                    </View>
                )}

                {/* Error Message */}
                {status === 'error' && !!errorMessage && (
                    <View className="bg-red-500/20 border border-red-500/30 p-3 rounded-2xl mt-2">
                        <Text className="text-red-300 text-xs font-semibold">⚠ Last sync failed</Text>
                        <Text className="text-red-200/80 text-xs mt-0.5">{errorMessage}</Text>
                    </View>
                )}
            </LinearGradient>

            <ScrollView  className="flex-1 px-6"  showsVerticalScrollIndicator={false} >
                {/* Sync Now Card */}
                <Pressable
                    testID="sync-now-button"
                    onPress={handleSyncNow}
                    disabled={isSyncing}
                    accessibilityRole="button"
                    accessibilityLabel={isSyncing ? 'Sync in progress' : 'Sync now'}
                    accessibilityState={{ disabled: isSyncing, busy: isSyncing }}
                    className="mt-6 bg-teal-600 p-5 rounded-3xl flex-row items-center justify-between active:bg-teal-700"
                    style={{ boxShadow: '0 10px 15px -3px rgba(15,78,100,0.2)' }}
                >
                    <View>
                        <Text className="text-white font-black text-lg">
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                        </Text>
                        <Text className="text-teal-100/70 text-xs mt-0.5">
                            {isSyncing ? currentModel : 'Pull latest data & push local changes'}
                        </Text>
                    </View>
                    {isSyncing ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <View className="bg-white/20 p-3 rounded-2xl">
                            <MaterialIcons name="sync" size={24} color="#FFF" />
                        </View>
                    )}
                </Pressable>

                <View className="mt-4 bg-white rounded-3xl p-5 border border-gray-100">
                    <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                            <Text className="text-gray-900 font-black text-base">Detailed pull/push audit</Text>
                            <Text className="text-gray-600 text-xs mt-1">
                                Records table, direction, operation, record IDs, result, attempts, and timing. Raw borrower and financial values are never logged.
                            </Text>
                        </View>
                        <MaterialIcons name="description" size={24} color="#0F766E" />
                    </View>

                    {auditPersistenceWarning ? (
                        <View className="mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-3">
                            <Text className="text-amber-800 text-xs font-semibold">{auditPersistenceWarning}</Text>
                        </View>
                    ) : null}

                    <View className="flex-row gap-3 mt-4">
                        <Pressable
                            testID="export-detailed-sync-log"
                            onPress={handleExportDetailedLog}
                            disabled={!latestAuditSessionId}
                            accessibilityRole="button"
                            accessibilityLabel="Export detailed sync log"
                            accessibilityState={{ disabled: !latestAuditSessionId }}
                            className={`flex-1 rounded-2xl px-4 py-3 ${latestAuditSessionId ? 'bg-teal-600 active:bg-teal-700' : 'bg-gray-300'}`}
                        >
                            <Text className="text-white text-center text-xs font-bold">Export detailed log</Text>
                        </Pressable>
                        <Pressable
                            testID="delete-detailed-sync-logs"
                            onPress={handleDeleteDetailedLogs}
                            disabled={!latestAuditSessionId}
                            accessibilityRole="button"
                            accessibilityLabel="Delete detailed sync logs"
                            accessibilityState={{ disabled: !latestAuditSessionId }}
                            className="rounded-2xl px-4 py-3 bg-red-50 border border-red-100 active:bg-red-100"
                        >
                            <Text className="text-red-600 text-xs font-bold">Delete</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Sync Logs */}
                <View className="mt-8 mb-4 flex-row items-center justify-between">
                    <Text className="text-gray-900 font-black text-xl">Sync Log</Text>
                    {logs.length > 0 && (
                        <Pressable
                            onPress={handleClearLogs}
                            accessibilityRole="button"
                            accessibilityLabel="Clear sync logs"
                            className="px-3 py-1.5 rounded-full bg-red-50 border border-red-100 active:bg-red-100"
                        >
                            <Text className="text-red-500 text-xs font-bold">Clear</Text>
                        </Pressable>
                    )}
                </View>

                {logs.length === 0 ? (
                    <View className="mb-10">
                        <StateView
                            testID="sync-log-empty-state"
                            title="No logs yet"
                            message="Sync activity will appear here after your first sync."
                            icon="history"
                        />
                    </View>
                ) : (
                    <View className="bg-white rounded-3xl px-4 border border-gray-100 mb-10">
                        {logs.map((log) => (
                            <LogRow key={log.id} log={log} />
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
