import React, { useState, useCallback } from 'react';
import { usePageContentStyle } from '../../../src/hooks/useResponsiveLayout';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, Modal, Alert, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import AgriFarmWorker from '../../../src/database/models/AgriFarmWorker';
import AgriLaborLog from '../../../src/database/models/AgriLaborLog';
import AgriCropCycle from '../../../src/database/models/AgriCropCycle';
import { formatPHP, parsePHP } from '../../../src/utils/currency';
import { Q } from '@nozbe/watermelondb';
import { AutoPostingService } from '../../../src/services/AutoPostingService';
import Toast from '../../../src/components/AppToast';
import { BlockTaskDirectory } from '../../../src/components/ParcelMap/BlockTaskDirectory';

export default function FarmLaborScreen() {
    const router = useRouter();
    const pageContentStyle = usePageContentStyle();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

    const [workers, setWorkers] = useState<AgriFarmWorker[]>([]);
    const [laborLogs, setLaborLogs] = useState<Array<{ log: AgriLaborLog; workerName: string; cycleCode: string }>>([]);
    const [cycles, setCycles] = useState<AgriCropCycle[]>([]);

    // Worker Modal
    const [workerModal, setWorkerModal] = useState(false);
    const [workerName, setWorkerName] = useState('');
    const [workerPhone, setWorkerPhone] = useState('');
    const [specialization, setSpecialization] = useState('Harvester');
    const [dailyRate, setDailyRate] = useState('450');
    const [savingWorker, setSavingWorker] = useState(false);

    // Log / Edit Task Modal
    const [taskModal, setTaskModal] = useState(false);
    const [editingLaborLogId, setEditingLaborLogId] = useState<string | null>(null);
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [selectedCycleId, setSelectedCycleId] = useState('');
    const [task, setTask] = useState('Harvesting & Root Pulling');
    const [rateType, setRateType] = useState('daily');
    const [unitsCompleted, setUnitsCompleted] = useState('1');
    const [ratePerUnit, setRatePerUnit] = useState('450');
    const [taskNotes, setTaskNotes] = useState('');
    const [savingTask, setSavingTask] = useState(false);

    const loadData = async () => {
        try {
            const workerList = await database
                .get<AgriFarmWorker>('agri_farm_workers')
                .query(Q.where('deleted_at', null))
                .fetch();
            setWorkers(workerList);
            if (workerList.length > 0 && !selectedWorkerId) {
                setSelectedWorkerId(workerList[0].id);
                setRatePerUnit(workerList[0].dailyRate.toString());
            }

            const cycleList = await database
                .get<AgriCropCycle>('agri_crop_cycles')
                .query(Q.where('deleted_at', null))
                .fetch();
            setCycles(cycleList);
            if (cycleList.length > 0 && !selectedCycleId) {
                setSelectedCycleId(cycleList[0].id);
            }

            const logs = await database
                .get<AgriLaborLog>('agri_labor_logs')
                .query(
                    Q.where('deleted_at', null),
                    Q.sortBy('work_date', Q.desc)
                )
                .fetch();

            const formatted: any[] = [];
            for (const l of logs) {
                let wName = 'Worker';
                let cCode = 'Cycle';
                try {
                    const w = await database.get<AgriFarmWorker>('agri_farm_workers').find(l.workerId);
                    wName = w.name;
                } catch {
                    wName = 'Worker';
                }

                if (l.cropCycleId) {
                    try {
                        const c = await database.get<AgriCropCycle>('agri_crop_cycles').find(l.cropCycleId);
                        cCode = c.cycleCode;
                    } catch {
                        cCode = 'Cycle';
                    }
                }

                formatted.push({ log: l, workerName: wName, cycleCode: cCode });
            }
            setLaborLogs(formatted);
        } catch (err) {
            console.error('[FarmLabor] Error:', err);
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
        if (!workerName.trim()) {
            Alert.alert('Validation Error', 'Please enter worker name.');
            return;
        }

        setSavingWorker(true);
        try {
            await database.write(async () => {
                await database.get<AgriFarmWorker>('agri_farm_workers').create(record => {
                    record.name = workerName.trim();
                    record.contactNumber = workerPhone.trim() || null;
                    record.specialization = specialization;
                    record.dailyRate = parsePHP(dailyRate) || 450;
                    record.status = 'active';
                });
            });

            setWorkerModal(false);
            setWorkerName('');
            setWorkerPhone('');
            loadData();
            const msg = `Worker "${workerName.trim()}" registered successfully!`;
            setConfirmationMessage(msg);
            Toast.show({
                type: 'success',
                text1: 'Worker Registered',
                text2: msg,
            });
            Alert.alert('Success', msg);
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to save worker');
        } finally {
            setSavingWorker(false);
        }
    };

    const handleOpenCreateTask = () => {
        setEditingLaborLogId(null);
        setTask('Harvesting & Root Pulling');
        setRateType('daily');
        setUnitsCompleted('1');
        setTaskNotes('');
        if (workers.length > 0 && !selectedWorkerId) {
            setSelectedWorkerId(workers[0].id);
            setRatePerUnit(workers[0].dailyRate.toString());
        }
        setTaskModal(true);
    };

    const handleOpenEditTask = (log: AgriLaborLog) => {
        setEditingLaborLogId(log.id);
        setSelectedWorkerId(log.workerId);
        setSelectedCycleId(log.cropCycleId || '');
        setTask(log.task);
        setRateType(log.rateType || 'daily');
        setUnitsCompleted((log.unitsCompleted || 1).toString());
        setRatePerUnit((log.ratePerUnit || 0).toString());
        setTaskNotes(log.notes || '');
        setTaskModal(true);
    };

    const handleSaveTask = async () => {
        if (!selectedWorkerId) {
            Alert.alert('Validation Error', 'Please select a worker.');
            return;
        }

        const units = parseFloat(unitsCompleted) || 1;
        const rate = parsePHP(ratePerUnit) || 0;
        const totalPay = Number((units * rate).toFixed(2));

        setSavingTask(true);
        try {
            if (editingLaborLogId) {
                // Update existing task
                await database.write(async () => {
                    const record = await database.get<AgriLaborLog>('agri_labor_logs').find(editingLaborLogId);
                    await record.update(r => {
                        r.workerId = selectedWorkerId;
                        r.cropCycleId = selectedCycleId || null;
                        r.task = task;
                        r.rateType = rateType;
                        r.unitsCompleted = units;
                        r.ratePerUnit = rate;
                        r.totalPay = totalPay;
                        r.notes = taskNotes.trim() || null;
                    });
                });

                setTaskModal(false);
                setTaskNotes('');
                loadData();
                const msg = `Labor task updated: ${formatPHP(totalPay)} (${task}).`;
                setConfirmationMessage(msg);
                Toast.show({
                    type: 'success',
                    text1: 'Labor Task Updated',
                    text2: msg,
                });
                Alert.alert('Success', msg);
            } else {
                // Create new task
                await database.write(async () => {
                    await database.get<AgriLaborLog>('agri_labor_logs').create(record => {
                        record.workerId = selectedWorkerId;
                        record.cropCycleId = selectedCycleId || null;
                        record.workDate = new Date();
                        record.task = task;
                        record.rateType = rateType;
                        record.unitsCompleted = units;
                        record.ratePerUnit = rate;
                        record.totalPay = totalPay;
                        record.paymentStatus = 'pending';
                        record.notes = taskNotes.trim() || null;
                    });
                });

                setTaskModal(false);
                setTaskNotes('');
                loadData();
                const msg = `Labor task recorded: ${formatPHP(totalPay)} (${task}) added to labor ledger.`;
                setConfirmationMessage(msg);
                Toast.show({
                    type: 'success',
                    text1: 'Labor Task Recorded',
                    text2: msg,
                });
                Alert.alert('Success', msg);
            }
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to save task log');
        } finally {
            setSavingTask(false);
        }
    };

    const handleDeleteTask = (logId: string, taskName: string) => {
        Alert.alert(
            'Confirm Delete',
            `Are you sure you want to remove this labor log: "${taskName}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await database.write(async () => {
                                const log = await database.get<AgriLaborLog>('agri_labor_logs').find(logId);
                                await log.update(r => {
                                    r.deletedAt = new Date();
                                });
                            });
                            const msg = `Labor log "${taskName}" removed.`;
                            setConfirmationMessage(msg);
                            Toast.show({
                                type: 'success',
                                text1: 'Labor Log Removed',
                                text2: msg,
                            });
                            loadData();
                        } catch (err: any) {
                            Alert.alert('Error', err?.message || 'Failed to delete labor log');
                        }
                    },
                },
            ]
        );
    };

    const handleMarkPaid = async (logId: string) => {
        try {
            const log = await database.get<AgriLaborLog>('agri_labor_logs').find(logId);
            await database.write(async () => {
                await log.update(r => {
                    r.paymentStatus = 'paid';
                });
            });

            // Post to General Ledger
            try {
                let wName = '';
                try {
                    const worker = await database.get<AgriFarmWorker>('agri_farm_workers').find(log.workerId);
                    wName = worker.name;
                } catch {}

                await AutoPostingService.postAgriLaborLog({
                    laborLogId: log.id,
                    workerName: wName,
                    task: log.task,
                    totalPay: log.totalPay,
                    paymentStatus: 'paid',
                    workDate: new Date(),
                    cropCycleId: log.cropCycleId,
                    postedBy: 'Operator',
                });
            } catch (postErr) {
                console.warn('[FarmLabor] Auto-post labor log warning:', postErr);
            }

            loadData();
            const msg = `Labor wage payment of ${formatPHP(log.totalPay)} marked as paid and posted to General Ledger.`;
            setConfirmationMessage(msg);
            Toast.show({
                type: 'success',
                text1: 'Wage Payment Recorded',
                text2: msg,
            });
            Alert.alert('Success', msg);
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to update status');
        }
    };

    const totalLaborPaid = laborLogs
        .filter(l => l.log.paymentStatus === 'paid')
        .reduce((sum, l) => sum + (l.log.totalPay || 0), 0);

    const totalLaborPending = laborLogs
        .filter(l => l.log.paymentStatus === 'pending')
        .reduce((sum, l) => sum + (l.log.totalPay || 0), 0);

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            contentContainerStyle={pageContentStyle}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Header */}
            <View className="flex-row flex-wrap justify-between items-center mb-6">
                <View className="flex-1 min-w-0 mr-3">
                    <Text className="text-2xl font-black text-gray-900">Farm Labor & Field Workers</Text>
                    <Text className="text-sm text-gray-500 mt-0.5">
                        Track agricultural laborers, daily tasks, piece-rates & wage payouts
                    </Text>
                </View>
                <View className="flex-row flex-wrap gap-2 w-full sm:w-auto justify-end">
                    <Pressable
                        testID="btn-workers-directory"
                        onPress={() => router.push('/(admin)/agribusiness/workers' as any)}
                        className="bg-emerald-50 border border-emerald-300 px-3 py-2.5 rounded-xl flex-row items-center gap-1 active:bg-emerald-100"
                    >
                        <MaterialIcons name="groups" size={18} color="#047857" />
                        <Text className="text-emerald-800 font-bold text-xs">Staff Directory</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setWorkerModal(true)}
                        className="bg-gray-200 px-3 py-2.5 rounded-xl flex-row items-center gap-1 active:bg-gray-300"
                    >
                        <MaterialIcons name="person-add" size={18} color="#374151" />
                        <Text className="text-gray-800 font-bold text-xs">Add Worker</Text>
                    </Pressable>
                    <Pressable
                        onPress={handleOpenCreateTask}
                        className="bg-cyan-700 px-4 py-2.5 rounded-xl flex-row items-center gap-1 shadow-sm active:bg-cyan-800"
                    >
                        <MaterialIcons name="add-task" size={18} color="#FFFFFF" />
                        <Text className="text-white font-bold text-xs">Log Work Task</Text>
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

            {/* KPI Cards */}
            <View className="flex-row flex-wrap gap-4 mb-6">
                <Pressable
                    testID="field-workers-kpi-card"
                    onPress={() => router.push('/(admin)/agribusiness/workers' as any)}
                    className="flex-1 min-w-[140px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm active:bg-gray-50 hover:border-emerald-500 transition-colors"
                >
                    <View className="flex-row justify-between items-center">
                        <Text className="text-xs font-bold text-gray-500 uppercase">Field Workers</Text>
                        <MaterialIcons name="chevron-right" size={18} color="#047857" />
                    </View>
                    <Text className="text-2xl font-black text-gray-900 mt-1">{workers.length}</Text>
                    <View className="flex-row items-center gap-1 mt-0.5">
                        <Text className="text-xs text-emerald-700 font-semibold">View Records →</Text>
                    </View>
                </Pressable>
                <View className="flex-1 min-w-[140px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <Text className="text-xs font-bold text-gray-500 uppercase">Pending Wages</Text>
                    <Text className="text-2xl font-black text-amber-700 mt-1">{formatPHP(totalLaborPending)}</Text>
                    <Text className="text-xs text-gray-500">Awaiting disbursement</Text>
                </View>
                <View className="flex-1 min-w-[140px] bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                    <Text className="text-xs font-bold text-gray-500 uppercase">Total Paid</Text>
                    <Text className="text-2xl font-black text-emerald-800 mt-1">{formatPHP(totalLaborPaid)}</Text>
                    <Text className="text-xs text-gray-500">Disbursed labor costs</Text>
                </View>
            </View>

            {/* Labor Tasks Log */}
            <Text className="text-lg font-black text-gray-900 mb-3">Field Labor Logs</Text>
            {laborLogs.length === 0 ? (
                <View className="bg-white p-8 rounded-2xl border border-gray-200 items-center justify-center">
                    <MaterialIcons name="engineering" size={48} color="#9CA3AF" />
                    <Text className="text-gray-900 font-bold text-base mt-2">No Labor Logs Recorded</Text>
                    <Text className="text-gray-500 text-xs text-center mt-1">
                        Log field tasks for harvesting, weeding, planting, and tractor operations.
                    </Text>
                </View>
            ) : (
                <View className="gap-3">
                    {laborLogs.map(({ log, workerName, cycleCode }) => (
                        <View
                            key={log.id}
                            className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex-row justify-between items-center"
                        >
                            <View>
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-sm font-bold text-gray-900">{workerName}</Text>
                                    <View
                                        className={`px-2 py-0.5 rounded-full ${
                                            log.paymentStatus === 'paid' ? 'bg-emerald-100' : 'bg-amber-100'
                                        }`}
                                    >
                                        <Text
                                            className={`text-[10px] font-bold capitalize ${
                                                log.paymentStatus === 'paid' ? 'text-emerald-800' : 'text-amber-800'
                                            }`}
                                        >
                                            {log.paymentStatus}
                                        </Text>
                                    </View>
                                </View>
                                <Text className="text-xs text-gray-600 mt-0.5">
                                    Task: <Text className="font-semibold text-gray-900">{log.task}</Text> • Cycle: {cycleCode}
                                </Text>
                                <Text className="text-[10px] text-gray-400">
                                    {log.unitsCompleted} {log.rateType === 'daily' ? 'day(s)' : 'units'} @ {formatPHP(log.ratePerUnit)} • Date: {new Date(log.workDate).toISOString().split('T')[0]}
                                </Text>
                            </View>

                            <View className="items-end">
                                <Text className="text-base font-black text-gray-900">
                                    {formatPHP(log.totalPay)}
                                </Text>
                                <View className="flex-row items-center gap-1 mt-1">
                                    <Pressable
                                        onPress={() => handleOpenEditTask(log)}
                                        className="p-1 rounded hover:bg-gray-100 active:bg-gray-200"
                                    >
                                        <MaterialIcons name="edit" size={16} color="#4B5563" />
                                    </Pressable>
                                    <Pressable
                                        onPress={() => handleDeleteTask(log.id, log.task)}
                                        className="p-1 rounded hover:bg-red-50 active:bg-red-100"
                                    >
                                        <MaterialIcons name="delete-outline" size={16} color="#EF4444" />
                                    </Pressable>
                                    {log.paymentStatus === 'pending' && (
                                        <Pressable
                                            onPress={() => handleMarkPaid(log.id)}
                                            className="bg-emerald-700 px-2.5 py-1 rounded-lg active:bg-emerald-800 ml-1"
                                        >
                                            <Text className="text-white font-bold text-[10px]">Pay Wage</Text>
                                        </Pressable>
                                    )}
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Register Worker Modal */}
            <Modal visible={workerModal} transparent animationType="fade">
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl">
                        <Text className="text-lg font-black text-gray-900 mb-3">Register Farm Worker</Text>

                        <Text className="text-xs font-bold text-gray-700 mb-1">Full Name *</Text>
                        <TextInput
                            value={workerName}
                            onChangeText={setWorkerName}
                            placeholder="e.g. Juan dela Cruz"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                        />

                        <Text className="text-xs font-bold text-gray-700 mb-1">Contact Phone</Text>
                        <TextInput
                            value={workerPhone}
                            onChangeText={setWorkerPhone}
                            placeholder="0917-XXX-XXXX"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                        />

                        <Text className="text-xs font-bold text-gray-700 mb-1">Specialization</Text>
                        <TextInput
                            value={specialization}
                            onChangeText={setSpecialization}
                            placeholder="Harvester, Tractor Operator, Weeder"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                        />

                        <Text className="text-xs font-bold text-gray-700 mb-1">Standard Daily Rate (₱) *</Text>
                        <TextInput
                            value={dailyRate}
                            onChangeText={setDailyRate}
                            placeholder="450"
                            keyboardType="numeric"
                            placeholderTextColor="#9CA3AF"
                            className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-4"
                        />

                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={() => setWorkerModal(false)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl items-center"
                            >
                                <Text className="font-bold text-gray-700 text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleCreateWorker}
                                disabled={savingWorker}
                                className="flex-1 py-3 bg-cyan-700 rounded-xl items-center active:bg-cyan-800"
                            >
                                {savingWorker ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text className="font-bold text-white text-sm">Save Worker</Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Log Task Modal */}
            <Modal visible={taskModal} transparent animationType="fade">
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <View className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl">
                        <Text className="text-lg font-black text-gray-900 mb-3">
                            {editingLaborLogId ? 'Edit Field Labor Task' : 'Log Field Labor Task'}
                        </Text>

                        <ScrollView className="max-h-[70vh]">
                            <Text className="text-xs font-bold text-gray-700 mb-1">Assign Worker *</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mb-3">
                                {workers.map(w => (
                                    <Pressable
                                        key={w.id}
                                        onPress={() => {
                                            setSelectedWorkerId(w.id);
                                            setRatePerUnit(w.dailyRate.toString());
                                        }}
                                        className={`px-3 py-1.5 rounded-xl border ${
                                            selectedWorkerId === w.id
                                                ? 'bg-cyan-800 border-cyan-800'
                                                : 'bg-gray-50 border-gray-200'
                                        }`}
                                    >
                                        <Text
                                            className={`text-xs font-bold ${
                                                selectedWorkerId === w.id ? 'text-white' : 'text-gray-800'
                                            }`}
                                        >
                                            {w.name}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>

                            <Text className="text-xs font-bold text-gray-700 mb-1">Target Crop Cycle</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2 mb-3">
                                {cycles.map(c => (
                                    <Pressable
                                        key={c.id}
                                        onPress={() => setSelectedCycleId(c.id)}
                                        className={`px-3 py-1.5 rounded-xl border ${
                                            selectedCycleId === c.id
                                                ? 'bg-emerald-800 border-emerald-800'
                                                : 'bg-gray-50 border-gray-200'
                                        }`}
                                    >
                                        <Text
                                            className={`text-xs font-bold ${
                                                selectedCycleId === c.id ? 'text-white' : 'text-gray-800'
                                            }`}
                                        >
                                            {c.cycleCode}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>

                            <Text className="text-xs font-bold text-gray-700 mb-1">Task Description *</Text>
                            <TextInput
                                value={task}
                                onChangeText={setTask}
                                placeholder="e.g. Harvesting & Root Pulling"
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900 mb-3"
                            />

                            <View className="flex-row gap-3 mb-3">
                                <View className="flex-1">
                                    <Text className="text-xs font-bold text-gray-700 mb-1">Units Completed</Text>
                                    <TextInput
                                        value={unitsCompleted}
                                        onChangeText={setUnitsCompleted}
                                        placeholder="1"
                                        keyboardType="numeric"
                                        placeholderTextColor="#9CA3AF"
                                        className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-xs font-bold text-gray-700 mb-1">Rate per Unit (₱)</Text>
                                    <TextInput
                                        value={ratePerUnit}
                                        onChangeText={setRatePerUnit}
                                        placeholder="450"
                                        keyboardType="numeric"
                                        placeholderTextColor="#9CA3AF"
                                        className="bg-gray-50 border border-gray-300 rounded-xl p-3 text-sm text-gray-900"
                                    />
                                </View>
                            </View>

                            <View className="bg-cyan-50 p-3 rounded-xl border border-cyan-200 mb-4 flex-row justify-between items-center">
                                <Text className="text-xs font-bold text-cyan-900">Total Wage Pay:</Text>
                                <Text className="text-base font-black text-cyan-900">
                                    {formatPHP((parseFloat(unitsCompleted) || 1) * (parsePHP(ratePerUnit) || 0))}
                                </Text>
                            </View>
                        </ScrollView>

                        <View className="flex-row gap-3">
                            <Pressable
                                onPress={() => setTaskModal(false)}
                                className="flex-1 py-3 bg-gray-100 rounded-xl items-center"
                            >
                                <Text className="font-bold text-gray-700 text-sm">Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleSaveTask}
                                disabled={savingTask}
                                className="flex-1 py-3 bg-cyan-700 rounded-xl items-center active:bg-cyan-800"
                            >
                                {savingTask ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Text className="font-bold text-white text-sm">
                                        {editingLaborLogId ? 'Update Task' : 'Record Task'}
                                    </Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}
