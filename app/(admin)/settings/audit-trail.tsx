import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
    View, 
    Text, 
    ScrollView, 
    Pressable, 
    ActivityIndicator, 
    RefreshControl, 
    LayoutAnimation, 
    Platform, 
    UIManager,
    TextInput,
    Alert
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import ActionLogService from '../../../src/services/ActionLogService';
import ActionLog from '../../../src/database/models/ActionLog';
import { SyncService } from '../../../src/services/SyncService';
import { supabase } from '../../../src/database/supabase';
import { formatDateTime, formatRelative, startOfToday } from '../../../src/utils/dates';
import { 
    resolveOperator, 
    formatEntityInfo, 
    generateActionNarrative, 
    formatFieldChanges,
    buildAuditExportData,
    OperatorInfo,
    EntityInfo,
    FieldChange
} from '../../../src/utils/auditTrailFormatter';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MODULE_FILTERS = [
    'All',
    'Crispy King POS',
    'Inventory & Bodega',
    'Lending & Loans',
    'Accounting & Finance',
    'HR & Staff',
    'System & Config',
];

const ACTION_FILTERS = [
    { id: 'ALL', label: 'All Actions' },
    { id: 'CREATE', label: 'Created' },
    { id: 'UPDATE', label: 'Updated' },
    { id: 'DELETE', label: 'Deleted' },
    { id: 'RESTORE', label: 'Restored' },
];

const TIME_FILTERS = [
    { id: 'ALL', label: 'All Time' },
    { id: 'TODAY', label: 'Today' },
    { id: '7DAYS', label: 'Past 7 Days' },
];

export default function AuditTrailScreen() {
    const params = useLocalSearchParams<{ userId?: string; operator?: string; query?: string }>();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [logs, setLogs] = useState<ActionLog[]>([]);
    const [userProfilesMap, setUserProfilesMap] = useState<Map<string, { id: string; fullName: string; role: string; email?: string }>>(new Map());
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
    const [activeInspectorTab, setActiveInspectorTab] = useState<Record<string, 'diff' | 'raw'>>({});
    
    // Filters & Search
    const [filterUserId, setFilterUserId] = useState<string | null>(params.userId || null);
    const [searchQuery, setSearchQuery] = useState(params.operator || params.query || '');
    const [selectedModule, setSelectedModule] = useState('All');
    const [selectedAction, setSelectedAction] = useState('ALL');
    const [selectedTimeFilter, setSelectedTimeFilter] = useState('ALL');
    
    // Feedback
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const realtimeSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (params.userId && params.userId !== filterUserId) {
            setFilterUserId(params.userId);
        }
        if (params.operator && !searchQuery) {
            setSearchQuery(params.operator);
        }
    }, [params.userId, params.operator]);

    const loadData = useCallback(async (isRefreshing = false) => {
        if (isRefreshing) setRefreshing(true);
        else setLoading(true);

        try {
            if (isRefreshing) {
                await SyncService.sync(true);
            }
            const [data, profilesMap] = await Promise.all([
                ActionLogService.getLogs(150),
                ActionLogService.getUserProfilesMap()
            ]);
            setLogs(data);
            setUserProfilesMap(profilesMap);
        } catch (error) {
            console.error('[AuditTrail] Error loading logs:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        const subscription = ActionLogService.observeLogs(150)?.subscribe({
            next: (data) => {
                if (!isMounted) return;
                setLogs(data);
                setLoading(false);
            },
            error: (error) => {
                console.error('[AuditTrail] Error observing logs:', error);
                if (isMounted) setLoading(false);
            },
        });

        // Load profiles once
        ActionLogService.getUserProfilesMap().then(map => {
            if (isMounted) setUserProfilesMap(map);
        });

        if (!subscription) {
            loadData();
        }

        return () => {
            isMounted = false;
            subscription?.unsubscribe();
        };
    }, [loadData]);

    useFocusEffect(
        useCallback(() => {
            const channel = supabase
                .channel('audit-trail-action-logs')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'app_action_logs' },
                    () => {
                        if (realtimeSyncTimer.current) {
                            clearTimeout(realtimeSyncTimer.current);
                        }

                        realtimeSyncTimer.current = setTimeout(() => {
                            SyncService.sync(true).catch(error => {
                                console.error('[AuditTrail] Realtime sync failed:', error);
                            });
                        }, 500);
                    }
                )
                .subscribe();

            return () => {
                if (realtimeSyncTimer.current) {
                    clearTimeout(realtimeSyncTimer.current);
                }
                supabase.removeChannel(channel).catch(() => {});
            };
        }, [])
    );

    const toggleExpand = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedLogId(expandedLogId === id ? null : id);
    };

    const copyToClipboard = async (text: string, key: string) => {
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            }
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 2000);
        } catch (e) {
            console.warn('Clipboard copy failed:', e);
        }
    };

    // Calculate KPI metrics
    const metrics = useMemo(() => {
        const todayStart = startOfToday().getTime();
        let todayCount = 0;
        let createCount = 0;
        let updateCount = 0;
        let deleteCount = 0;

        for (const log of logs) {
            if (log.timestamp >= todayStart) todayCount++;
            if (log.action === 'CREATE') createCount++;
            else if (log.action === 'UPDATE') updateCount++;
            else if (log.action === 'DELETE') deleteCount++;
        }

        return {
            total: logs.length,
            today: todayCount,
            creates: createCount,
            updates: updateCount,
            deletes: deleteCount,
        };
    }, [logs]);

    // Filter and search logs
    const filteredLogs = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        const todayStart = startOfToday().getTime();

        return logs.filter(log => {
            // User ID filter (if tracing specific user)
            if (filterUserId) {
                const operator = resolveOperator(log.performedBy, userProfilesMap);
                const targetProfile = userProfilesMap.get(filterUserId);
                const userAliases = [
                    filterUserId.toLowerCase(),
                    (targetProfile?.email || '').toLowerCase(),
                    (targetProfile?.fullName || '').toLowerCase()
                ].filter(Boolean);

                const logPerformedBy = (log.performedBy || '').toLowerCase();
                const opId = (operator.id || '').toLowerCase();
                const opName = (operator.name || '').toLowerCase();
                const opEmail = (operator.email || '').toLowerCase();

                const matchesUser = userAliases.some(alias => 
                    logPerformedBy.includes(alias) || 
                    opId.includes(alias) || 
                    opName.includes(alias) || 
                    opEmail.includes(alias)
                );

                if (!matchesUser) {
                    return false;
                }
            }

            // Action filter
            if (selectedAction !== 'ALL' && log.action !== selectedAction) {
                return false;
            }

            // Time filter
            if (selectedTimeFilter === 'TODAY' && log.timestamp < todayStart) {
                return false;
            }
            if (selectedTimeFilter === '7DAYS' && log.timestamp < sevenDaysAgo) {
                return false;
            }

            const entityInfo = formatEntityInfo(log.entityType, log.entityId, log.oldData, log.newData);

            // Module filter
            if (selectedModule !== 'All' && entityInfo.module !== selectedModule) {
                return false;
            }

            // Search query
            if (query) {
                const operator = resolveOperator(log.performedBy, userProfilesMap);
                const narrative = generateActionNarrative(log.action, log.entityType, log.entityId, log.oldData, log.newData);
                
                const matchesOperator = operator.name.toLowerCase().includes(query) || operator.role.toLowerCase().includes(query) || (operator.email || '').toLowerCase().includes(query);
                const matchesEntity = entityInfo.entityName.toLowerCase().includes(query) || entityInfo.title.toLowerCase().includes(query) || log.entityId.toLowerCase().includes(query) || log.entityType.toLowerCase().includes(query);
                const matchesNarrative = narrative.toLowerCase().includes(query);
                const matchesAction = log.action.toLowerCase().includes(query);

                if (!matchesOperator && !matchesEntity && !matchesNarrative && !matchesAction) {
                    return false;
                }
            }

            return true;
        });
    }, [logs, searchQuery, selectedModule, selectedAction, selectedTimeFilter, userProfilesMap, filterUserId]);

    // Handle CSV export
    const handleExportCSV = async () => {
        if (filteredLogs.length === 0) {
            Alert.alert('No Logs', 'There are no logs to export with current filters.');
            return;
        }

        setExporting(true);
        try {
            const csvContent = '\uFEFF' + buildAuditExportData(filteredLogs, userProfilesMap);
            const fileName = `Audit_Trail_${formatDateTime(Date.now()).replace(/[^a-zA-Z0-9]/g, '_')}.csv`;

            if (Platform.OS === 'web') {
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', fileName);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                const fileUri = FileSystem.documentDirectory + fileName;
                await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'text/csv',
                    dialogTitle: 'Export Audit Trail Logs',
                    UTI: 'public.comma-separated-values-text',
                });
            }
        } catch (error) {
            console.error('Failed to export audit logs:', error);
            Alert.alert('Export Error', 'Unable to generate CSV export file.');
        } finally {
            setExporting(false);
        }
    };

    const getActionBadgeStyle = (action: string) => {
        switch (action) {
            case 'CREATE':
                return { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200', icon: 'add-circle' as any, colorClass: 'text-emerald-600' };
            case 'UPDATE':
                return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', icon: 'edit' as any, colorClass: 'text-blue-600' };
            case 'DELETE':
                return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', icon: 'delete' as any, colorClass: 'text-red-600' };
            case 'RESTORE':
                return { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200', icon: 'restore' as any, colorClass: 'text-amber-600' };
            default:
                return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', icon: 'info' as any, colorClass: 'text-gray-600' };
        }
    };

    const getModuleBadgeStyle = (module: string) => {
        switch (module) {
            case 'Crispy King POS':
                return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
            case 'Inventory & Bodega':
                return { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' };
            case 'Lending & Loans':
                return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
            case 'Accounting & Finance':
                return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
            case 'HR & Staff':
                return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
            case 'System & Config':
                return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' };
            default:
                return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
        }
    };

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ 
                title: 'Audit Trail & Activity Log',
                headerShadowVisible: false,
                headerStyle: { backgroundColor: '#F9FAFB' },
                headerRight: () => (
                    <View className="flex-row items-center gap-x-2 mr-2">
                        <Pressable 
                            onPress={handleExportCSV} 
                            disabled={exporting}
                            className="flex-row items-center bg-blue-900 px-3 py-1.5 rounded-lg active:bg-blue-800 shadow-sm"
                        >
                            {exporting ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <MaterialIcons name="file-download" size={16} color="#FFFFFF" className="mr-1" />
                                    <Text className="text-white text-xs font-bold">Export CSV</Text>
                                </>
                            )}
                        </Pressable>
                        <Pressable 
                            onPress={() => loadData(true)} 
                            disabled={refreshing}
                            className="w-8 h-8 rounded-lg bg-gray-100 items-center justify-center active:bg-gray-200"
                        >
                            {refreshing ? (
                                <ActivityIndicator size="small" color="#1E3A8A" />
                            ) : (
                                <MaterialIcons name="refresh" size={20} color="#374151" />
                            )}
                        </Pressable>
                    </View>
                )
            }} />

            <ScrollView 
                className="flex-1" 
                contentContainerStyle={{ padding: 16 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={['#1E3A8A']} />
                }
            >
                {/* Header Title Section */}
                <View className="mb-4">
                    <View className="flex-row items-center justify-between">
                        <View>
                            <Text className="text-2xl font-black text-gray-900 tracking-tight">Audit Trail</Text>
                            <Text className="text-gray-600 text-xs mt-0.5">Understandable and traceable history of all actions and modifications</Text>
                        </View>
                        <View className="bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex-row items-center">
                            <View className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5" />
                            <Text className="text-[11px] font-bold text-emerald-800">Live Sync Active</Text>
                        </View>
                    </View>
                </View>

                {/* KPI Overview Metrics */}
                <View className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 flex-row flex-wrap">
                    <View className="flex-1 min-w-[130px] bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                        <View className="flex-row items-center justify-between">
                            <Text className="text-gray-500 text-[11px] font-bold uppercase">Total Events</Text>
                            <MaterialIcons name="history" size={18} color="#4B5563" />
                        </View>
                        <Text className="text-2xl font-black text-gray-900 mt-1">{metrics.total}</Text>
                        <Text className="text-[10px] text-gray-600 mt-0.5">{metrics.today} today</Text>
                    </View>

                    <View className="flex-1 min-w-[130px] bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                        <View className="flex-row items-center justify-between">
                            <Text className="text-emerald-700 text-[11px] font-bold uppercase">Created</Text>
                            <MaterialIcons name="add-circle" size={18} color="#059669" />
                        </View>
                        <Text className="text-2xl font-black text-emerald-700 mt-1">{metrics.creates}</Text>
                        <Text className="text-[10px] text-gray-600 mt-0.5">New additions</Text>
                    </View>

                    <View className="flex-1 min-w-[130px] bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                        <View className="flex-row items-center justify-between">
                            <Text className="text-blue-700 text-[11px] font-bold uppercase">Updated</Text>
                            <MaterialIcons name="edit" size={18} color="#2563EB" />
                        </View>
                        <Text className="text-2xl font-black text-blue-700 mt-1">{metrics.updates}</Text>
                        <Text className="text-[10px] text-gray-600 mt-0.5">Edits & modifications</Text>
                    </View>

                    <View className="flex-1 min-w-[130px] bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                        <View className="flex-row items-center justify-between">
                            <Text className="text-red-700 text-[11px] font-bold uppercase">Deleted</Text>
                            <MaterialIcons name="delete" size={18} color="#DC2626" />
                        </View>
                        <Text className="text-2xl font-black text-red-700 mt-1">{metrics.deletes}</Text>
                        <Text className="text-[10px] text-gray-600 mt-0.5">Removals</Text>
                    </View>
                </View>

                {/* Search & Filter Toolbar */}
                <View className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-4">
                    {/* User Tracing Filter Banner */}
                    {filterUserId && (
                        <View className="mb-3 bg-blue-50 border border-blue-200 rounded-xl p-3 flex-row items-center justify-between">
                            <View className="flex-row items-center flex-1 mr-2">
                                <MaterialIcons name="person-pin" size={20} color="#1D4ED8" />
                                <View className="ml-2 flex-1">
                                    <Text className="text-xs font-bold text-blue-900">
                                        Tracing Activity for: {userProfilesMap.get(filterUserId)?.fullName || params.operator || filterUserId}
                                    </Text>
                                    <Text className="text-[11px] text-blue-700">
                                        Showing actions recorded for this specific user account
                                    </Text>
                                </View>
                            </View>
                            <Pressable
                                onPress={() => {
                                    setFilterUserId(null);
                                    setSearchQuery('');
                                }}
                                className="bg-blue-200 px-2.5 py-1.5 rounded-lg active:bg-blue-300 flex-row items-center"
                            >
                                <MaterialIcons name="close" size={14} color="#1E3A8A" />
                                <Text className="text-xs font-bold text-blue-900 ml-1">Clear</Text>
                            </Pressable>
                        </View>
                    )}

                    {/* Search Input */}
                    <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                        <MaterialIcons name="search" size={20} color="#6B7280" className="mr-2" />
                        <TextInput 
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search by operator, entity, title, ID, or action..."
                            placeholderTextColor="#9CA3AF"
                            className="flex-1 text-gray-900 text-sm font-medium py-0"
                            clearButtonMode="while-editing"
                        />
                        {searchQuery.length > 0 && (
                            <Pressable onPress={() => setSearchQuery('')} className="p-1">
                                <MaterialIcons name="close" size={16} color="#6B7280" />
                            </Pressable>
                        )}
                    </View>

                    {/* Module Filter Pills */}
                    <View className="mt-3">
                        <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Filter by Module</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                            {MODULE_FILTERS.map(mod => {
                                const isSelected = selectedModule === mod;
                                return (
                                    <Pressable
                                        key={mod}
                                        onPress={() => setSelectedModule(mod)}
                                        className={`mr-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
                                            isSelected 
                                                ? 'bg-blue-900 border-blue-900 text-white' 
                                                : 'bg-gray-50 border-gray-200 text-gray-700 active:bg-gray-100'
                                        }`}
                                    >
                                        <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                                            {mod}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Action & Time Filters */}
                    <View className="mt-3 flex-row flex-wrap items-center justify-between gap-y-2 pt-3 border-t border-gray-100">
                        {/* Action buttons */}
                        <View className="flex-row items-center flex-wrap gap-1">
                            {ACTION_FILTERS.map(act => {
                                const isSelected = selectedAction === act.id;
                                return (
                                    <Pressable
                                        key={act.id}
                                        onPress={() => setSelectedAction(act.id)}
                                        className={`px-2.5 py-1 rounded-lg border ${
                                            isSelected 
                                                ? 'bg-gray-800 border-gray-800' 
                                                : 'bg-gray-50 border-gray-200'
                                        }`}
                                    >
                                        <Text className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                                            {act.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {/* Time buttons */}
                        <View className="flex-row items-center gap-1">
                            {TIME_FILTERS.map(t => {
                                const isSelected = selectedTimeFilter === t.id;
                                return (
                                    <Pressable
                                        key={t.id}
                                        onPress={() => setSelectedTimeFilter(t.id)}
                                        className={`px-2.5 py-1 rounded-lg border ${
                                            isSelected 
                                                ? 'bg-blue-700 border-blue-700' 
                                                : 'bg-gray-50 border-gray-200'
                                        }`}
                                    >
                                        <Text className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                                            {t.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                </View>

                {/* Filter Results Summary */}
                <View className="flex-row items-center justify-between mb-3 px-1">
                    <Text className="text-gray-600 text-xs font-semibold">
                        Showing <Text className="text-gray-900 font-bold">{filteredLogs.length}</Text> of {logs.length} events
                    </Text>
                    {(searchQuery || selectedModule !== 'All' || selectedAction !== 'ALL' || selectedTimeFilter !== 'ALL') && (
                        <Pressable 
                            onPress={() => {
                                setSearchQuery('');
                                setSelectedModule('All');
                                setSelectedAction('ALL');
                                setSelectedTimeFilter('ALL');
                            }}
                            className="flex-row items-center"
                        >
                            <MaterialIcons name="refresh" size={14} color="#2563EB" className="mr-1" />
                            <Text className="text-blue-600 text-xs font-bold">Reset Filters</Text>
                        </Pressable>
                    )}
                </View>

                {/* Loading State */}
                {loading && logs.length === 0 ? (
                    <View className="py-20 items-center justify-center">
                        <ActivityIndicator color="#1E3A8A" size="large" />
                        <Text className="text-gray-700 mt-4 font-medium">Fetching verified activity logs...</Text>
                    </View>
                ) : filteredLogs.length === 0 ? (
                    <View className="py-16 items-center justify-center bg-white rounded-3xl border border-gray-100 shadow-sm p-6 text-center">
                        <View className="w-16 h-16 rounded-full bg-gray-50 items-center justify-center mb-3">
                            <MaterialIcons name="search-off" size={32} color="#9CA3AF" />
                        </View>
                        <Text className="text-gray-900 font-bold text-base">No matching activity records</Text>
                        <Text className="text-gray-500 text-xs text-center mt-1 max-w-xs">
                            Try adjusting your search keywords, selecting another module, or clearing filters.
                        </Text>
                    </View>
                ) : (
                    <View className="gap-y-3">
                        {filteredLogs.map((log) => {
                            const isExpanded = expandedLogId === log.id;
                            const actionStyle = getActionBadgeStyle(log.action);
                            const operator = resolveOperator(log.performedBy, userProfilesMap);
                            const entity = formatEntityInfo(log.entityType, log.entityId, log.oldData, log.newData);
                            const narrative = generateActionNarrative(log.action, log.entityType, log.entityId, log.oldData, log.newData);
                            const moduleStyle = getModuleBadgeStyle(entity.module);
                            const inspectorTab = activeInspectorTab[log.id] || 'diff';

                            return (
                                <Pressable 
                                    key={log.id}
                                    onPress={() => toggleExpand(log.id)}
                                    className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all ${
                                        isExpanded ? 'border-blue-900/40 ring-2 ring-blue-900/10' : 'hover:border-gray-200'
                                    }`}
                                >
                                    <View className="p-4">
                                        {/* Top Row: Action Badge + Module + Time */}
                                        <View className="flex-row items-center justify-between mb-2">
                                            <View className="flex-row items-center flex-wrap gap-1.5">
                                                {/* Action Tag */}
                                                <View className={`flex-row items-center px-2 py-0.5 rounded-md border ${actionStyle.bg} ${actionStyle.border}`}>
                                                    <MaterialIcons name={actionStyle.icon} size={12} className={`mr-1 ${actionStyle.colorClass}`} />
                                                    <Text className={`text-[10px] font-black uppercase tracking-wider ${actionStyle.text}`}>
                                                        {log.action}
                                                    </Text>
                                                </View>

                                                {/* Module Badge */}
                                                <View className={`px-2 py-0.5 rounded-md border ${moduleStyle.bg} ${moduleStyle.border}`}>
                                                    <Text className={`text-[10px] font-bold ${moduleStyle.text}`}>
                                                        {entity.module}
                                                    </Text>
                                                </View>

                                                {/* Entity Type Label */}
                                                <View className="bg-gray-100 px-2 py-0.5 rounded-md">
                                                    <Text className="text-[10px] font-bold text-gray-700">
                                                        {entity.entityName}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View className="flex-row items-center">
                                                <Text className="text-gray-500 text-[10px] font-semibold">
                                                    {formatRelative(log.timestamp)}
                                                </Text>
                                                <MaterialIcons 
                                                    name={isExpanded ? "expand-less" : "expand-more"} 
                                                    size={20} 
                                                    color="#9CA3AF" 
                                                    className="ml-1" 
                                                />
                                            </View>
                                        </View>

                                        {/* Main Narrative & Entity Title */}
                                        <View className="mb-2.5">
                                            <Text className="text-base font-black text-gray-900 leading-5">
                                                {entity.title}
                                            </Text>
                                            <Text className="text-gray-600 text-xs mt-1 leading-4">
                                                {narrative}
                                            </Text>
                                        </View>

                                        {/* Footer Row: Operator Info & Exact Timestamp */}
                                        <View className="flex-row items-center justify-between pt-2.5 border-t border-gray-100">
                                            {/* Operator Badge */}
                                            <View className="flex-row items-center flex-1 pr-2">
                                                <View className={`w-6 h-6 rounded-full items-center justify-center mr-2 ${
                                                    operator.isSystem ? 'bg-gray-200' : 'bg-blue-100'
                                                }`}>
                                                    <Text className={`text-[10px] font-black ${
                                                        operator.isSystem ? 'text-gray-700' : 'text-blue-900'
                                                    }`}>
                                                        {operator.initials}
                                                    </Text>
                                                </View>
                                                <Text className="text-xs font-bold text-gray-800 mr-1.5">
                                                    {operator.name}
                                                </Text>
                                                <View className="bg-gray-100 px-1.5 py-0.5 rounded">
                                                    <Text className="text-[9px] font-bold text-gray-600 uppercase">
                                                        {operator.role}
                                                    </Text>
                                                </View>
                                            </View>

                                            {/* Timestamp Tooltip */}
                                            <Text className="text-[10px] text-gray-600 font-medium">
                                                {formatDateTime(log.timestamp)}
                                            </Text>
                                        </View>

                                        {/* Expanded Drawer: Details & Visual Field Diffs */}
                                        {isExpanded && (
                                            <View className="mt-4 pt-4 border-t border-gray-100">
                                                {/* Inspector Sub-Tabs */}
                                                <View className="flex-row items-center justify-between mb-3">
                                                    <View className="flex-row items-center bg-gray-100 p-0.5 rounded-lg">
                                                        <Pressable
                                                            onPress={() => setActiveInspectorTab(prev => ({ ...prev, [log.id]: 'diff' }))}
                                                            className={`px-3 py-1 rounded-md ${
                                                                inspectorTab === 'diff' ? 'bg-white shadow-sm' : ''
                                                            }`}
                                                        >
                                                            <Text className={`text-[11px] font-bold ${
                                                                inspectorTab === 'diff' ? 'text-gray-900' : 'text-gray-600'
                                                            }`}>
                                                                Field Changes
                                                            </Text>
                                                        </Pressable>
                                                        <Pressable
                                                            onPress={() => setActiveInspectorTab(prev => ({ ...prev, [log.id]: 'raw' }))}
                                                            className={`px-3 py-1 rounded-md ${
                                                                inspectorTab === 'raw' ? 'bg-white shadow-sm' : ''
                                                            }`}
                                                        >
                                                            <Text className={`text-[11px] font-bold ${
                                                                inspectorTab === 'raw' ? 'text-gray-900' : 'text-gray-600'
                                                            }`}>
                                                                Raw Data (JSON)
                                                            </Text>
                                                        </Pressable>
                                                    </View>

                                                    <Text className="text-[10px] text-gray-600 font-semibold uppercase">
                                                        Log ID: {log.id.substring(0, 8)}
                                                    </Text>
                                                </View>

                                                {/* Metadata Details Cards */}
                                                <View className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                                                    {/* Entity metadata */}
                                                    <View className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex-row items-center justify-between">
                                                        <View className="flex-1 pr-2">
                                                            <Text className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">Entity ID</Text>
                                                            <Text className="text-xs font-mono text-gray-800 font-semibold mt-0.5" numberOfLines={1}>
                                                                {log.entityId}
                                                            </Text>
                                                        </View>
                                                        <Pressable 
                                                            onPress={() => copyToClipboard(log.entityId, `entity-${log.id}`)}
                                                            className="px-2 py-1 bg-white border border-gray-200 rounded-md active:bg-gray-100 flex-row items-center"
                                                        >
                                                            <MaterialIcons 
                                                                name={copiedKey === `entity-${log.id}` ? "check" : "content-copy"} 
                                                                size={12} 
                                                                color={copiedKey === `entity-${log.id}` ? "#059669" : "#4B5563"} 
                                                                className="mr-1" 
                                                            />
                                                            <Text className={`text-[10px] font-bold ${copiedKey === `entity-${log.id}` ? 'text-emerald-700' : 'text-gray-700'}`}>
                                                                {copiedKey === `entity-${log.id}` ? 'Copied' : 'Copy'}
                                                            </Text>
                                                        </Pressable>
                                                    </View>

                                                    {/* Operator metadata */}
                                                    <View className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex-row items-center justify-between">
                                                        <View className="flex-1 pr-2">
                                                            <Text className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">Operator ID</Text>
                                                            <Text className="text-xs font-mono text-gray-800 font-semibold mt-0.5" numberOfLines={1}>
                                                                {operator.id}
                                                            </Text>
                                                        </View>
                                                        <Pressable 
                                                            onPress={() => copyToClipboard(operator.id, `user-${log.id}`)}
                                                            className="px-2 py-1 bg-white border border-gray-200 rounded-md active:bg-gray-100 flex-row items-center"
                                                        >
                                                            <MaterialIcons 
                                                                name={copiedKey === `user-${log.id}` ? "check" : "content-copy"} 
                                                                size={12} 
                                                                color={copiedKey === `user-${log.id}` ? "#059669" : "#4B5563"} 
                                                                className="mr-1" 
                                                            />
                                                            <Text className={`text-[10px] font-bold ${copiedKey === `user-${log.id}` ? 'text-emerald-700' : 'text-gray-700'}`}>
                                                                {copiedKey === `user-${log.id}` ? 'Copied' : 'Copy'}
                                                            </Text>
                                                        </Pressable>
                                                    </View>
                                                </View>

                                                {/* Visual Field Diff View */}
                                                {inspectorTab === 'diff' ? (
                                                    <FieldDiffView oldData={log.oldData} newData={log.newData} action={log.action} />
                                                ) : (
                                                    /* Raw JSON Inspector View */
                                                    <RawJsonView oldData={log.oldData} newData={log.newData} />
                                                )}
                                            </View>
                                        )}
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>
                )}
                <View className="h-20" />
            </ScrollView>
        </View>
    );
}

/**
 * Visual Field Changes Inspector Component
 */
function FieldDiffView({ oldData, newData, action }: { oldData: string; newData: string; action: string }) {
    let oldObj: any = null;
    let newObj: any = null;

    try {
        if (oldData && oldData !== '') oldObj = JSON.parse(oldData);
    } catch {}
    try {
        if (newData && newData !== '') newObj = JSON.parse(newData);
    } catch {}

    const changes = formatFieldChanges(oldObj, newObj);

    if (changes.length === 0) {
        if (action === 'CREATE') {
            return (
                <View className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                    <Text className="text-emerald-800 text-xs font-bold mb-1">New Record Initialized</Text>
                    <Text className="text-emerald-700 text-[11px]">All initial fields captured in record payload. Switch to Raw Data tab to view entire object.</Text>
                </View>
            );
        }
        if (action === 'DELETE') {
            return (
                <View className="bg-red-50 p-3 rounded-xl border border-red-100">
                    <Text className="text-red-800 text-xs font-bold mb-1">Record Removed / Archived</Text>
                    <Text className="text-red-700 text-[11px]">The entity has been removed from active view. Historical snapshot retained.</Text>
                </View>
            );
        }
        return (
            <View className="py-3 items-center">
                <Text className="text-gray-500 text-xs italic">No specific field-level modifications detected</Text>
            </View>
        );
    }

    return (
        <View className="gap-y-2 mt-1">
            <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">
                Modified Fields ({changes.length})
            </Text>
            {changes.map(change => (
                <View key={change.key} className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    <Text className="text-[11px] font-black text-gray-800 mb-1.5">{change.label}</Text>
                    <View className="flex-row items-center flex-wrap gap-2">
                        {/* Old Value */}
                        <View className="bg-red-50 px-2 py-1 rounded-md border border-red-100 flex-1 min-w-[100px]">
                            <Text className="text-[9px] font-bold text-red-600 uppercase mb-0.5">Previous</Text>
                            <Text className="text-red-700 text-xs font-semibold" numberOfLines={2}>
                                {change.oldValueFormatted}
                            </Text>
                        </View>

                        <MaterialIcons name="arrow-forward" size={16} color="#9CA3AF" />

                        {/* New Value */}
                        <View className="bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 flex-1 min-w-[100px]">
                            <Text className="text-[9px] font-bold text-emerald-600 uppercase mb-0.5">New Value</Text>
                            <Text className="text-emerald-800 text-xs font-bold" numberOfLines={2}>
                                {change.newValueFormatted}
                            </Text>
                        </View>
                    </View>
                </View>
            ))}
        </View>
    );
}

/**
 * Raw JSON Data Inspector Component
 */
function RawJsonView({ oldData, newData }: { oldData: string; newData: string }) {
    const parseOrNull = (raw: string) => {
        try {
            return raw ? JSON.stringify(JSON.parse(raw), null, 2) : null;
        } catch {
            return raw || null;
        }
    };

    const oldFormatted = parseOrNull(oldData);
    const newFormatted = parseOrNull(newData);

    return (
        <View className="gap-y-3 mt-1">
            {oldFormatted && (
                <View>
                    <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Previous Snapshot</Text>
                    <View className="bg-gray-900 p-3 rounded-xl overflow-hidden">
                        <Text className="text-red-300 font-mono text-[10px]" numberOfLines={25}>
                            {oldFormatted}
                        </Text>
                    </View>
                </View>
            )}
            {newFormatted && (
                <View>
                    <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">New State Snapshot</Text>
                    <View className="bg-gray-900 p-3 rounded-xl overflow-hidden">
                        <Text className="text-green-400 font-mono text-[10px]" numberOfLines={25}>
                            {newFormatted}
                        </Text>
                    </View>
                </View>
            )}
            {!oldFormatted && !newFormatted && (
                <Text className="text-gray-500 text-xs italic text-center py-2">No raw payload available</Text>
            )}
        </View>
    );
}
