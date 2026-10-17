import React, { useState, useCallback } from 'react';
import { usePageContentStyle } from '../../../src/hooks/useResponsiveLayout';
import {
    View,
    Text,
    ScrollView,
    Pressable,
    ActivityIndicator,
    TextInput,
    Modal,
    Alert,
    RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import AgriFarmWorker from '../../../src/database/models/AgriFarmWorker';
import AgriLaborLog from '../../../src/database/models/AgriLaborLog';
import { AgriWorkerService } from '../../../src/services/AgriWorkerService';
import { formatPHP } from '../../../src/utils/currency';
import { Q } from '@nozbe/watermelondb';
import Toast from '../../../src/components/AppToast';
import { BlockTaskDirectory } from '../../../src/components/ParcelMap/BlockTaskDirectory';

const SPECIALIZATION_OPTIONS = [
    'General Field Crew',
    'Harvester',
    'Tractor Operator',
    'Planting Crew',
    'Weeding & Land Prep',
    'Hauling & Logistics',
    'Farm Supervisor / Staff',
    'Quality Inspector',
];

export default function FarmWorkersScreen() {
    const router = useRouter();
    const pageContentStyle = usePageContentStyle();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [workers, setWorkers] = useState<AgriFarmWorker[]>([]);
    const [laborLogs, setLaborLogs] = useState<AgriLaborLog[]>([]);

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

    // Add Worker Modal
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [specialization, setSpecialization] = useState(SPECIALIZATION_OPTIONS[0]);
    const [dailyRate, setDailyRate] = useState('450');
    const [status, setStatus] = useState('active');
    const [saving, setSaving] = useState(false);

    // Edit Worker Modal
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingWorker, setEditingWorker] = useState<AgriFarmWorker | null>(null);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editSpecialization, setEditSpecialization] = useState('');
    const [editDailyRate, setEditDailyRate] = useState('');
    const [editStatus, setEditStatus] = useState('active');

    // Inline confirmation message
    const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

    const loadData = async () => {
        try {
            const workerList = await database
                .get<AgriFarmWorker>('agri_farm_workers')
                .query(
                    Q.where('deleted_at', null),
                    Q.sortBy('name', Q.asc)
                )
                .fetch();
            setWorkers(workerList);

            const logs = await database
                .get<AgriLaborLog>('agri_labor_logs')
                .query(Q.where('deleted_at', null))
                .fetch();
            setLaborLogs(logs);
        } catch (error) {
            console.error('[FarmWorkers] Error loading data:', error);
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

    const handleCreateWorker = async () => {
        if (!name.trim()) {
            Alert.alert('Validation Error', 'Please enter the worker or staff member name.');
            return;
        }

        const rate = parseFloat(dailyRate);
        if (isNaN(rate) || rate <= 0) {
            Alert.alert('Validation Error', 'Please enter a valid daily wage rate.');
            return;
        }

        setSaving(true);
        try {
            await AgriWorkerService.createWorker({
                name: name.trim(),
                contactNumber: phone.trim() || undefined,
                specialization,
                dailyRate: rate,
                status,
            });

            setAddModalVisible(false);
            setName('');
            setPhone('');
            setDailyRate('450');
            setSpecialization(SPECIALIZATION_OPTIONS[0]);

            const msg = `Worker "${name.trim()}" registered successfully!`;
            setConfirmationMessage(msg);
            Toast.show({
                type: 'success',
                text1: 'Worker Registered',
                text2: msg,
            });

            loadData();
        } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to register worker');
        } finally {
            setSaving(false);
        }
    };

    const handleOpenEdit = (worker: AgriFarmWorker) => {
        setEditingWorker(worker);
        setEditName(worker.name);
        setEditPhone(worker.contactNumber || '');
        setEditSpecialization(worker.specialization || SPECIALIZATION_OPTIONS[0]);
        setEditDailyRate(worker.dailyRate.toString());
        setEditStatus(worker.status);
        setEditModalVisible(true);
    };

    const handleUpdateWorker = async () => {
        if (!editingWorker) return;
        if (!editName.trim()) {
            Alert.alert('Validation Error', 'Please enter worker name.');
            return;
        }

        const rate = parseFloat(editDailyRate);
        if (isNaN(rate) || rate <= 0) {
            Alert.alert('Validation Error', 'Please enter a valid daily rate.');
            return;
        }

        setSaving(true);
        try {
            await AgriWorkerService.updateWorker(editingWorker, {
                name: editName.trim(),
                contactNumber: editPhone.trim() || null,
                specialization: editSpecialization,
                dailyRate: rate,
                status: editStatus,
            });

            setEditModalVisible(false);
            const msg = `Worker "${editName.trim()}" updated successfully!`;
            setConfirmationMessage(msg);
            Toast.show({
                type: 'success',
                text1: 'Worker Record Updated',
                text2: msg,
            });

            loadData();
        } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to update worker record');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (worker: AgriFarmWorker) => {
        const nextStatus = worker.status === 'active' ? 'inactive' : 'active';
        try {
            await AgriWorkerService.updateWorker(worker, { status: nextStatus });
            const msg = `${worker.name} marked as ${nextStatus}.`;
            setConfirmationMessage(msg);
            Toast.show({
                type: 'info',
                text1: 'Status Changed',
                text2: msg,
            });
            loadData();
        } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to toggle status');
        }
    };

    const handleDeleteWorker = (worker: AgriFarmWorker) => {
        Alert.alert(
            'Confirm Delete',
            `Are you sure you want to remove worker "${worker.name}"? This will soft-delete their profile from active records.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await AgriWorkerService.deleteWorker(worker);
                            const msg = `Worker "${worker.name}" removed from records.`;
                            setConfirmationMessage(msg);
                            Toast.show({
                                type: 'success',
                                text1: 'Worker Removed',
                                text2: msg,
                            });
                            loadData();
                        } catch (err: any) {
                            Alert.alert('Error', err?.message || 'Failed to delete worker');
                        }
                    },
                },
            ]
        );
    };

    const filteredWorkers = AgriWorkerService.filterWorkers(workers, {
        search: searchQuery,
        status: statusFilter,
    });

    const stats = AgriWorkerService.computeWorkerStats(workers, laborLogs);

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            contentContainerStyle={pageContentStyle}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Top Navigation & Header */}
            <View className="flex-row flex-wrap justify-between items-start mb-6">
                <View className="flex-1 min-w-0 mr-3">
                    <Pressable
                        onPress={() => router.back()}
                        className="flex-row items-center gap-1 mb-2 active:opacity-70"
                    >
                        <MaterialIcons name="arrow-back" size={20} color="#047857" />
                        <Text className="text-emerald-700 font-bold text-xs uppercase tracking-wider">
                            Back to Farm Labor
                        </Text>
                    </Pressable>
                    <Text className="text-2xl font-black text-gray-900">Farm Laborers & Staff</Text>
                    <Text className="text-sm text-gray-500 mt-0.5">
                        Records of agricultural laborers, harvesting crew, tractor operators & field supervisors
                    </Text>
                </View>

                <View className="flex-row flex-wrap gap-2 shrink-0">
                    <Pressable
                        onPress={() => router.push('/(admin)/agribusiness/labor' as any)}
                        className="bg-gray-100 border border-gray-300 px-3.5 py-2.5 rounded-xl flex-row items-center gap-1.5 active:bg-gray-200"
                    >
                        <MaterialIcons name="assignment" size={18} color="#374151" />
                        <Text className="text-gray-700 font-bold text-xs">Labor Logs</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setAddModalVisible(true)}
                        className="bg-emerald-700 px-4 py-2.5 rounded-xl flex-row items-center gap-1.5 shadow-sm active:bg-emerald-800"
                    >
                        <MaterialIcons name="person-add" size={18} color="#FFFFFF" />
                        <Text className="text-white font-bold text-xs">Register Worker</Text>
                    </Pressable>
                </View>
            </View>

            <BlockTaskDirectory />

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

            {/* KPI Metric Cards */}
            <View className="flex-row flex-wrap gap-4 mb-6">
                <View className="flex-1 min-w-[140px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Staff & Laborers</Text>
                        <MaterialIcons name="groups" size={20} color="#047857" />
                    </View>
                    <Text className="text-2xl font-black text-gray-900">{stats.totalWorkers}</Text>
                    <Text className="text-xs text-gray-500 mt-0.5">{stats.activeWorkers} currently active</Text>
                </View>

                <View className="flex-1 min-w-[140px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">Average Daily Rate</Text>
                        <MaterialIcons name="payments" size={20} color="#2563EB" />
                    </View>
                    <Text className="text-2xl font-black text-gray-900">{formatPHP(stats.averageDailyRate)}</Text>
                    <Text className="text-xs text-gray-500 mt-0.5">Per 8-hour farm day</Text>
                </View>

                <View className="flex-1 min-w-[140px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Wages Paid</Text>
                        <MaterialIcons name="check-circle" size={20} color="#059669" />
                    </View>
                    <Text className="text-2xl font-black text-emerald-800">{formatPHP(stats.totalWagesPaid)}</Text>
                    <Text className="text-xs text-gray-500 mt-0.5">{stats.totalTasksCompleted} completed tasks</Text>
                </View>

                <View className="flex-1 min-w-[140px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pending Payouts</Text>
                        <MaterialIcons name="pending" size={20} color="#D97706" />
                    </View>
                    <Text className="text-2xl font-black text-amber-700">{formatPHP(stats.totalWagesPending)}</Text>
                    <Text className="text-xs text-gray-500 mt-0.5">Awaiting wage disbursement</Text>
                </View>
            </View>

            {/* Search and Filters */}
            <View className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm mb-6">
                <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-3">
                    <MaterialIcons name="search" size={20} color="#9CA3AF" />
                    <TextInput
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search workers by name, role, specialization, or phone..."
                        placeholderTextColor="#9CA3AF"
                        className="flex-1 ml-2 text-sm text-gray-900"
                    />
                    {searchQuery.length > 0 && (
                        <Pressable onPress={() => setSearchQuery('')}>
                            <MaterialIcons name="clear" size={18} color="#9CA3AF" />
                        </Pressable>
                    )}
                </View>

                {/* Filter Chips */}
                <View className="flex-row flex-wrap gap-2">
                    {[
                        { id: 'all', label: `All (${workers.length})` },
                        { id: 'active', label: `Active (${stats.activeWorkers})` },
                        { id: 'inactive', label: `Inactive (${stats.inactiveWorkers})` },
                    ].map(f => (
                        <Pressable
                            key={f.id}
                            onPress={() => setStatusFilter(f.id as any)}
                            className={`px-3 py-1.5 rounded-full border ${
                                statusFilter === f.id
                                    ? 'bg-emerald-700 border-emerald-700'
                                    : 'bg-gray-100 border-gray-200 active:bg-gray-200'
                            }`}
                        >
                            <Text
                                className={`text-xs font-bold ${
                                    statusFilter === f.id ? 'text-white' : 'text-gray-700'
                                }`}
                            >
                                {f.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </View>

            {/* Workers Roster List */}
            <View className="flex-row justify-between items-center mb-3">
                <Text className="text-lg font-black text-gray-900">
                    Farm Labor & Staff Directory ({filteredWorkers.length})
                </Text>
            </View>

            {loading ? (
                <View className="p-8 items-center">
                    <ActivityIndicator size="small" color="#047857" />
                    <Text className="text-gray-500 text-xs mt-2">Loading worker records...</Text>
                </View>
            ) : filteredWorkers.length === 0 ? (
                <View className="bg-white p-8 rounded-2xl border border-gray-200 items-center justify-center">
                    <MaterialIcons name="engineering" size={48} color="#9CA3AF" />
                    <Text className="text-gray-900 font-bold text-base mt-2">No Workers Found</Text>
                    <Text className="text-gray-500 text-xs text-center mt-1 mb-4">
                        {searchQuery
                            ? 'No farm laborers or staff match your current search query.'
                            : 'Register your first agricultural crew member or supervisor to begin tracking labor.'}
                    </Text>
                    <Pressable
                        onPress={() => setAddModalVisible(true)}
                        className="bg-emerald-700 px-5 py-2.5 rounded-xl active:bg-emerald-800"
                    >
                        <Text className="text-white font-bold text-sm">Register First Worker</Text>
                    </Pressable>
                </View>
            ) : (
                <View className="gap-3">
                    {filteredWorkers.map(worker => {
                        const metrics = AgriWorkerService.aggregateWorkerMetrics(worker.id, laborLogs);
                        const isActive = worker.status === 'active';

                        return (
                            <View
                                key={worker.id}
                                className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm"
                            >
                                <View className="flex-row justify-between items-start mb-3">
                                    <View className="flex-row items-center gap-3">
                                        <View
                                            className={`w-12 h-12 rounded-2xl items-center justify-center ${
                                                isActive ? 'bg-emerald-100' : 'bg-gray-100'
                                            }`}
                                        >
                                            <MaterialIcons
                                                name="person"
                                                size={24}
                                                color={isActive ? '#047857' : '#9CA3AF'}
                                            />
                                        </View>
                                        <View>
                                            <View className="flex-row items-center gap-2">
                                                <Text className="text-base font-black text-gray-900">
                                                    {worker.name}
                                                </Text>
                                                <View
                                                    className={`px-2 py-0.5 rounded-full ${
                                                        isActive ? 'bg-emerald-100' : 'bg-gray-100'
                                                    }`}
                                                >
                                                    <Text
                                                        className={`text-[10px] font-bold uppercase ${
                                                            isActive ? 'text-emerald-800' : 'text-gray-600'
                                                        }`}
                                                    >
                                                        {worker.status}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View className="flex-row items-center gap-2 mt-1">
                                                <View className="bg-blue-100 px-2.5 py-0.5 rounded-md">
                                                    <Text className="text-blue-800 text-xs font-semibold">
                                                        {worker.specialization || 'Field Crew'}
                                                    </Text>
                                                </View>
                                                {worker.contactNumber && (
                                                    <View className="flex-row items-center gap-1">
                                                        <MaterialIcons name="phone" size={12} color="#6B7280" />
                                                        <Text className="text-xs text-gray-500">
                                                            {worker.contactNumber}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </View>

                                    <View className="items-end">
                                        <Text className="text-xs text-gray-500">Standard Daily Rate</Text>
                                        <Text className="text-base font-black text-gray-900">
                                            {formatPHP(worker.dailyRate)}
                                        </Text>
                                    </View>
                                </View>

                                {/* Work summary bar */}
                                <View className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex-row justify-between items-center mb-3">
                                    <View>
                                        <Text className="text-[10px] text-gray-500 uppercase font-bold">Tasks Recorded</Text>
                                        <Text className="text-sm font-black text-gray-900">{metrics.tasksCount} log(s)</Text>
                                    </View>
                                    <View>
                                        <Text className="text-[10px] text-gray-500 uppercase font-bold">Total Earnings</Text>
                                        <Text className="text-sm font-black text-emerald-800">{formatPHP(metrics.totalEarned)}</Text>
                                    </View>
                                    <View>
                                        <Text className="text-[10px] text-gray-500 uppercase font-bold">Pending Payout</Text>
                                        <Text className="text-sm font-black text-amber-700">{formatPHP(metrics.pendingAmount)}</Text>
                                    </View>
                                </View>

                                {/* Worker Action Buttons */}
                                <View className="flex-row gap-2">
                                    <Pressable
                                        onPress={() => handleOpenEdit(worker)}
                                        className="flex-1 bg-gray-100 border border-gray-200 py-2 rounded-xl flex-row items-center justify-center gap-1 active:bg-gray-200"
                                    >
                                        <MaterialIcons name="edit" size={14} color="#374151" />
                                        <Text className="text-gray-700 font-bold text-xs">Edit Record</Text>
                                    </Pressable>

                                    <Pressable
                                        onPress={() => handleDeleteWorker(worker)}
                                        className="px-3 bg-red-50 border border-red-200 py-2 rounded-xl flex-row items-center justify-center gap-1 active:bg-red-100"
                                    >
                                        <MaterialIcons name="delete-outline" size={14} color="#DC2626" />
                                        <Text className="text-red-700 font-bold text-xs">Delete</Text>
                                    </Pressable>

                                    <Pressable
                                        onPress={() => handleToggleStatus(worker)}
                                        className={`px-3 py-2 rounded-xl border flex-row items-center justify-center gap-1 ${
                                            isActive
                                                ? 'bg-amber-50 border-amber-200 active:bg-amber-100'
                                                : 'bg-emerald-50 border-emerald-200 active:bg-emerald-100'
                                        }`}
                                    >
                                        <MaterialIcons
                                            name={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                                            size={14}
                                            color={isActive ? '#B45309' : '#047857'}
                                        />
                                        <Text
                                            className={`font-bold text-xs ${
                                                isActive ? 'text-amber-800' : 'text-emerald-800'
                                            }`}
                                        >
                                            {isActive ? 'Deactivate' : 'Activate'}
                                        </Text>
                                    </Pressable>

                                    <Pressable
                                        onPress={() => router.push('/(admin)/agribusiness/labor' as any)}
                                        className="bg-emerald-700 px-3.5 py-2 rounded-xl flex-row items-center justify-center gap-1 active:bg-emerald-800 shadow-sm"
                                    >
                                        <MaterialIcons name="add-task" size={14} color="#FFFFFF" />
                                        <Text className="text-white font-bold text-xs">Log Task</Text>
                                    </Pressable>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Register Worker Modal */}
            <Modal visible={addModalVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-lg font-black text-gray-900">Register Farm Worker & Staff</Text>
                            <Pressable onPress={() => setAddModalVisible(false)} className="p-1">
                                <MaterialIcons name="close" size={22} color="#6B7280" />
                            </Pressable>
                        </View>

                        <ScrollView className="max-h-[70vh]">
                            <Text className="text-xs font-bold text-gray-700 mb-1">Full Name *</Text>
                            <TextInput
                                value={name}
                                onChangeText={setName}
                                placeholder="e.g. Juan dela Cruz"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Contact Phone</Text>
                            <TextInput
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="e.g. 0917-123-4567"
                                keyboardType="phone-pad"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Role / Specialization *</Text>
                            <View className="flex-row flex-wrap gap-2 mb-3">
                                {SPECIALIZATION_OPTIONS.map(opt => (
                                    <Pressable
                                        key={opt}
                                        onPress={() => setSpecialization(opt)}
                                        className={`px-3 py-1.5 rounded-xl border ${
                                            specialization === opt
                                                ? 'bg-emerald-800 border-emerald-800'
                                                : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                                        }`}
                                    >
                                        <Text
                                            className={`text-xs font-bold ${
                                                specialization === opt ? 'text-white' : 'text-gray-800'
                                            }`}
                                        >
                                            {opt}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            <Text className="text-xs font-bold text-gray-700 mb-1">Daily Wage Rate (₱) *</Text>
                            <TextInput
                                value={dailyRate}
                                onChangeText={setDailyRate}
                                placeholder="450"
                                keyboardType="numeric"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Status</Text>
                            <View className="flex-row gap-2 mb-4">
                                {['active', 'inactive'].map(st => (
                                    <Pressable
                                        key={st}
                                        onPress={() => setStatus(st)}
                                        className={`flex-1 py-2 rounded-xl border items-center ${
                                            status === st
                                                ? 'bg-emerald-800 border-emerald-800'
                                                : 'bg-gray-50 border-gray-200'
                                        }`}
                                    >
                                        <Text
                                            className={`text-xs font-bold capitalize ${
                                                status === st ? 'text-white' : 'text-gray-700'
                                            }`}
                                        >
                                            {st}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </ScrollView>

                        <View className="flex-row gap-3 mt-4">
                            <Pressable
                                onPress={() => setAddModalVisible(false)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl items-center"
                            >
                                <Text className="font-bold text-gray-700 text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleCreateWorker}
                                disabled={saving}
                                className="flex-1 py-3 bg-emerald-700 rounded-xl items-center active:bg-emerald-800"
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text className="font-bold text-white text-sm">Register Worker</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Edit Worker Modal */}
            <Modal visible={editModalVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-lg font-black text-gray-900">Edit Worker & Staff Record</Text>
                            <Pressable onPress={() => setEditModalVisible(false)} className="p-1">
                                <MaterialIcons name="close" size={22} color="#6B7280" />
                            </Pressable>
                        </View>

                        <ScrollView className="max-h-[70vh]">
                            <Text className="text-xs font-bold text-gray-700 mb-1">Full Name *</Text>
                            <TextInput
                                value={editName}
                                onChangeText={setEditName}
                                placeholder="e.g. Juan dela Cruz"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Contact Phone</Text>
                            <TextInput
                                value={editPhone}
                                onChangeText={setEditPhone}
                                placeholder="e.g. 0917-123-4567"
                                keyboardType="phone-pad"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Role / Specialization *</Text>
                            <View className="flex-row flex-wrap gap-2 mb-3">
                                {SPECIALIZATION_OPTIONS.map(opt => (
                                    <Pressable
                                        key={opt}
                                        onPress={() => setEditSpecialization(opt)}
                                        className={`px-3 py-1.5 rounded-xl border ${
                                            editSpecialization === opt
                                                ? 'bg-emerald-800 border-emerald-800'
                                                : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                                        }`}
                                    >
                                        <Text
                                            className={`text-xs font-bold ${
                                                editSpecialization === opt ? 'text-white' : 'text-gray-800'
                                            }`}
                                        >
                                            {opt}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>

                            <Text className="text-xs font-bold text-gray-700 mb-1">Daily Wage Rate (₱) *</Text>
                            <TextInput
                                value={editDailyRate}
                                onChangeText={setEditDailyRate}
                                placeholder="450"
                                keyboardType="numeric"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <Text className="text-xs font-bold text-gray-700 mb-1">Status</Text>
                            <View className="flex-row gap-2 mb-4">
                                {['active', 'inactive'].map(st => (
                                    <Pressable
                                        key={st}
                                        onPress={() => setEditStatus(st)}
                                        className={`flex-1 py-2 rounded-xl border items-center ${
                                            editStatus === st
                                                ? 'bg-emerald-800 border-emerald-800'
                                                : 'bg-gray-50 border-gray-200'
                                        }`}
                                    >
                                        <Text
                                            className={`text-xs font-bold capitalize ${
                                                editStatus === st ? 'text-white' : 'text-gray-700'
                                            }`}
                                        >
                                            {st}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </ScrollView>

                        <View className="flex-row gap-3 mt-4">
                            <Pressable
                                onPress={() => setEditModalVisible(false)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl items-center"
                            >
                                <Text className="font-bold text-gray-700 text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleUpdateWorker}
                                disabled={saving}
                                className="flex-1 py-3 bg-emerald-700 rounded-xl items-center active:bg-emerald-800"
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text className="font-bold text-white text-sm">Save Changes</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}
