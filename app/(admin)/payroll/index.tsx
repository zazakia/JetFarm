import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, Pressable,
    ActivityIndicator, Alert, SafeAreaView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PayrollService } from '../../../src/services/PayrollService';
import PayrollRun from '../../../src/database/models/PayrollRun';
import PayrollLine from '../../../src/database/models/PayrollLine';
import Employee from '../../../src/database/models/Employee';
import { Q } from '@nozbe/watermelondb';
import { safeBack } from '../../../src/utils/navigation';
import { database } from '../../../src/database';
import { formatPHP } from '../../../src/utils/currency';
import BusinessUnit from '../../../src/database/models/BusinessUnit';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_COLOR: Record<string, string> = {
    draft: 'bg-yellow-50',
    computed: 'bg-blue-50',
    approved: 'bg-green-50',
    posted: 'bg-green-100',
    reversed: 'bg-red-50',
};
const STATUS_TEXT_COLOR: Record<string, string> = {
    draft: 'text-yellow-800',
    computed: 'text-blue-800',
    approved: 'text-green-800',
    posted: 'text-green-900',
    reversed: 'text-red-800',
};

export default function PayrollDashboardScreen() {
    const router = useRouter();

    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth()); // 0-indexed

    const [runs, setRuns] = useState<PayrollRun[]>([]);
    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
    const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
    const [lines, setLines] = useState<PayrollLine[]>([]);
    const [empMap, setEmpMap] = useState<Record<string, Employee>>({});
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const periodStart = new Date(year, month, 1);
    const periodEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const loadBranches = async () => {
        try {
            const fetched = await database.collections.get<BusinessUnit>('business_units')
                .query(Q.where('deleted_at', null))
                .fetch();
            if (fetched.length > 0) {
                setBranches(fetched.map(b => ({ id: b.id, name: b.name })));
                setSelectedBranchId(fetched[0].id);
            } else {
                const defaults = [
                    { id: 'branch-bagacay', name: 'Bagacay (Benchmark)' },
                    { id: 'branch-locsin', name: 'Locsin (Dumaguete)' },
                    { id: 'branch-daro', name: 'Daro Crossing' },
                    { id: 'branch-noph', name: 'NOPH Main Gate' },
                    { id: 'branch-batinguel', name: 'Batinguel Highway' },
                ];
                setBranches(defaults);
                setSelectedBranchId(defaults[0].id);
            }
        } catch {
            const defaults = [
                { id: 'branch-bagacay', name: 'Bagacay (Benchmark)' },
                { id: 'branch-locsin', name: 'Locsin (Dumaguete)' },
            ];
            setBranches(defaults);
            setSelectedBranchId(defaults[0].id);
        }
    };

    useEffect(() => {
        loadBranches();
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const allRuns = await PayrollService.getPayrollRuns();
            // Filter client-side for the selected month and branch
            const filtered = allRuns.filter(r => {
                const start = new Date(r.periodStart as any);
                const matchesDate = start.getFullYear() === year && start.getMonth() === month;
                const matchesBranch = selectedBranchId === 'all' || r.branchId === selectedBranchId;
                return matchesDate && matchesBranch;
            });
            setRuns(filtered);

            // Build employee lookup
            const employees = await database.get<Employee>('employees')
                .query(Q.where('deleted_at', null))
                .fetch();
            const map: Record<string, Employee> = {};
            employees.forEach(e => { map[e.id] = e; });
            setEmpMap(map);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [year, month, selectedBranchId]);

    useEffect(() => { loadData(); }, [loadData]);

    const changeMonth = (dir: 'next' | 'prev') => {
        if (dir === 'next') {
            if (month === 11) { setMonth(0); setYear(y => y + 1); }
            else setMonth(m => m + 1);
        } else {
            if (month === 0) { setMonth(11); setYear(y => y - 1); }
            else setMonth(m => m - 1);
        }
    };

    const handleRunPayroll = async () => {
        setGenerating(true);
        try {
            const targetBranchId = selectedBranchId === 'all' ? (branches[0]?.id ?? 'BAGACAY') : selectedBranchId;
            const run = await PayrollService.createPayrollRun({
                branchId: targetBranchId,
                periodStart,
                periodEnd,
            });
            Alert.alert('Payroll Created', `Draft run created for branch with ${run.totalNet > 0 ? 'employees' : 'no employees'}. Review and approve.`);
            loadData();
        } catch (err: any) {
            Alert.alert('Error', err.message ?? 'Failed to create payroll run');
        } finally {
            setGenerating(false);
        }
    };

    const handleExpand = async (run: PayrollRun) => {
        if (expandedRunId === run.id) {
            setExpandedRunId(null);
            setLines([]);
            return;
        }
        setExpandedRunId(run.id);
        const fetchedLines = await PayrollService.getPayrollLines(run.id);
        setLines(fetchedLines);
    };

    const handleApprove = (run: PayrollRun) => {
        Alert.alert(
            'Approve Payroll Run',
            `Approve payroll for ${MONTH_NAMES[month]} ${year}? This locks it for posting.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve',
                    onPress: async () => {
                        try {
                            await PayrollService.approveRun(run.id, 'admin');
                            Alert.alert('Approved', 'Payroll run approved.');
                            loadData();
                        } catch (e: any) {
                            Alert.alert('Error', e.message);
                        }
                    },
                },
            ]
        );
    };

    const handlePost = (run: PayrollRun) => {
        Alert.alert(
            'Post Payroll',
            `Post this run? This will auto-generate the journal entry and mark as POSTED. This action is irreversible.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Post',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await PayrollService.postRun(run.id);
                            Alert.alert('Posted', 'Payroll run posted and journal entry created.');
                            loadData();
                        } catch (e: any) {
                            Alert.alert('Error', e.message);
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="flex-row items-center p-4 bg-white border-b border-gray-100">
                <Pressable onPress={() => safeBack(router, '/(admin)')} className="p-2 -ml-2">
                    <MaterialIcons name="arrow-back" size={24} color="#1E3A8A" />
                </Pressable>
                <Text className="text-xl font-black text-gray-900 ml-2">Payroll Module</Text>
            </View>

            {/* Period Picker & Branch Filter */}
            <View className="bg-white p-4 border-b border-gray-100 shadow-sm">
                <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center">
                        <Pressable onPress={() => changeMonth('prev')} className="p-2 bg-gray-100 rounded-xl mr-2">
                            <MaterialIcons name="chevron-left" size={20} color="#1E3A8A" />
                        </Pressable>
                        <Text className="font-black text-base text-blue-900">
                            {MONTH_NAMES[month]} {year}
                        </Text>
                        <Pressable onPress={() => changeMonth('next')} className="p-2 bg-gray-100 rounded-xl ml-2">
                            <MaterialIcons name="chevron-right" size={20} color="#1E3A8A" />
                        </Pressable>
                    </View>

                    <Pressable
                        onPress={handleRunPayroll}
                        disabled={generating}
                        className="bg-blue-900 px-4 py-2 rounded-2xl flex-row items-center active:bg-blue-800"
                    >
                        {generating ? (
                            <ActivityIndicator color="white" size="small" />
                        ) : (
                            <>
                                <MaterialIcons name="refresh" size={16} color="white" />
                                <Text className="text-white font-bold text-xs ml-1">Run Payroll</Text>
                            </>
                        )}
                    </Pressable>
                </View>

                {/* Branch Selection Pills */}
                {branches.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row pt-1">
                        <Pressable
                            onPress={() => setSelectedBranchId('all')}
                            className={`px-3 py-1.5 rounded-full mr-2 border ${selectedBranchId === 'all' ? 'bg-blue-900 border-blue-900' : 'bg-gray-100 border-gray-200'}`}
                        >
                            <Text className={`text-xs font-bold ${selectedBranchId === 'all' ? 'text-white' : 'text-gray-700'}`}>
                                All Branches
                            </Text>
                        </Pressable>
                        {branches.map(b => (
                            <Pressable
                                key={b.id}
                                onPress={() => setSelectedBranchId(b.id)}
                                className={`px-3 py-1.5 rounded-full mr-2 border ${selectedBranchId === b.id ? 'bg-blue-900 border-blue-900' : 'bg-gray-100 border-gray-200'}`}
                            >
                                <Text className={`text-xs font-bold ${selectedBranchId === b.id ? 'text-white' : 'text-gray-700'}`}>
                                    {b.name}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                )}
            </View>

            {/* Run List */}
            <ScrollView className="flex-1 p-4">
                {loading ? (
                    <View className="py-20 items-center">
                        <ActivityIndicator color="#1E3A8A" />
                        <Text className="text-gray-700 font-bold mt-4">Loading payroll runs...</Text>
                    </View>
                ) : runs.length === 0 ? (
                    <View className="bg-white p-12 rounded-3xl border border-gray-100 items-center shadow-sm">
                        <MaterialIcons name="monetization-on" size={48} color="#E5E7EB" />
                        <Text className="text-gray-900 font-black mt-4 text-base">No payroll run for this period</Text>
                        <Text className="text-gray-700 font-medium text-xs mt-1 text-center">
                            Tap "Run Payroll" to generate a draft for staff at the selected branch.
                        </Text>
                    </View>
                ) : (
                    <View className="mb-8">
                        {runs.map(run => {
                            const isExpanded = expandedRunId === run.id;
                            const statusBg = STATUS_COLOR[run.status] ?? 'bg-gray-50';
                            const statusTxt = STATUS_TEXT_COLOR[run.status] ?? 'text-gray-700';
                            const start = new Date(run.periodStart as any);
                            const end = new Date(run.periodEnd as any);

                            return (
                                <View key={run.id} className="bg-white rounded-3xl border border-gray-100 mb-4 overflow-hidden shadow-sm">
                                    {/* Summary Card */}
                                    <Pressable
                                        onPress={() => handleExpand(run)}
                                        className="p-5 flex-row justify-between items-center active:bg-gray-50"
                                    >
                                        <View className="flex-1">
                                            <View className="flex-row items-center mb-1">
                                                <View className={`px-2.5 py-0.5 rounded-full mr-2 ${statusBg}`}>
                                                    <Text className={`text-[10px] font-black uppercase tracking-widest ${statusTxt}`}>
                                                        {run.status}
                                                    </Text>
                                                </View>
                                                <Text className="text-xs font-black text-gray-700">
                                                    {run.branchId ? `Branch: ${run.branchId}` : 'All Staff'}
                                                </Text>
                                            </View>
                                            <Text className="text-xs text-gray-500 font-medium">
                                                {start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – {end.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </Text>
                                        </View>

                                        <View className="items-end ml-4">
                                            <Text className="text-lg font-black text-blue-900">
                                                {formatPHP(run.totalNet)}
                                            </Text>
                                            <Text className="text-[10px] text-gray-700">
                                                Tap to {isExpanded ? 'collapse' : 'view breakdown'}
                                            </Text>
                                        </View>
                                    </Pressable>

                                    {/* Totals row */}
                                    <View className="flex-row border-t border-gray-50 px-5 py-3">
                                        <View className="items-center flex-1">
                                            <Text className="text-[10px] text-gray-700 uppercase font-black tracking-wider">Gross</Text>
                                            <Text className="font-bold text-gray-900 text-sm">{formatPHP(run.totalGross)}</Text>
                                        </View>
                                        <View className="items-center flex-1 border-l border-r border-gray-100">
                                            <Text className="text-[10px] text-red-700 uppercase font-black tracking-wider">Deductions</Text>
                                            <Text className="font-bold text-red-800 text-sm">-{formatPHP(run.totalDeductions)}</Text>
                                        </View>
                                        <View className="items-center flex-1">
                                            <Text className="text-[10px] text-green-700 uppercase font-black tracking-wider">Net Pay</Text>
                                            <Text className="font-bold text-green-800 text-sm">{formatPHP(run.totalNet)}</Text>
                                        </View>
                                    </View>

                                    {/* Expanded: per-employee lines */}
                                    {isExpanded && (
                                        <View className="border-t border-gray-100 px-5 pb-4">
                                            <Text className="text-[10px] font-black text-gray-700 uppercase tracking-widest mt-3 mb-2">
                                                Employee Breakdown
                                            </Text>
                                            {lines.length === 0 ? (
                                                <Text className="text-xs text-gray-500">No lines found.</Text>
                                            ) : (
                                                lines.map(line => {
                                                    const emp = empMap[line.employeeId];
                                                    const name = emp ? emp.fullName : line.employeeId.slice(0, 8);
                                                    return (
                                                        <View key={line.id} className="flex-row justify-between items-center py-2 border-b border-gray-50">
                                                            <View className="flex-1">
                                                                <Text className="font-bold text-gray-900 text-xs">{name}</Text>
                                                                <Text className="text-[10px] text-gray-700">{line.daysWorked}d × {emp?.dailyRate ? formatPHP(emp.dailyRate) : '—'}</Text>
                                                            </View>
                                                            <View className="items-end">
                                                                <Text className="font-black text-xs text-green-800">{formatPHP(line.netPay)}</Text>
                                                                {line.totalDeductions > 0 && (
                                                                    <Text className="text-[10px] text-red-600">-{formatPHP(line.totalDeductions)}</Text>
                                                                )}
                                                            </View>
                                                        </View>
                                                    );
                                                })
                                            )}
                                        </View>
                                    )}

                                    {/* Action buttons */}
                                    {(run.status === 'draft' || run.status === 'computed' || run.status === 'approved') && (
                                        <View className="flex-row justify-end px-5 pb-4 mt-1">
                                            {run.status !== 'approved' && (
                                                <Pressable
                                                    onPress={() => handleApprove(run)}
                                                    className="border border-blue-900 px-4 py-2 rounded-2xl mr-2 flex-row items-center active:bg-blue-50"
                                                >
                                                    <MaterialIcons name="check-circle" size={14} color="#1E3A8A" />
                                                    <Text className="text-blue-900 font-bold text-xs ml-1">Approve</Text>
                                                </Pressable>
                                            )}
                                            {run.status === 'approved' && (
                                                <Pressable
                                                    onPress={() => handlePost(run)}
                                                    className="bg-green-700 px-4 py-2 rounded-2xl flex-row items-center active:bg-green-800"
                                                >
                                                    <MaterialIcons name="send" size={14} color="white" />
                                                    <Text className="text-white font-bold text-xs ml-1">Post & Journal</Text>
                                                </Pressable>
                                            )}
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
