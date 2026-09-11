import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, RefreshControl, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AuditService, { AuditIssue, AuditReport } from '../../../src/services/AuditService';
import { database } from '../../../src/database';
import Loan from '../../../src/database/models/Loan';
import { AnimatedPressable } from '../../../src/components/AnimatedPressable';
import { format } from 'date-fns';

export default function SystemAuditScreen() {
    const router = useRouter();
    const [report, setReport] = useState<AuditReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [runningAction, setRunningAction] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const runAudit = useCallback(async () => {
        setLoading(true);
        try {
            const result = await AuditService.runFullAudit();
            setReport(result);
        } catch (error) {
            console.error('Audit failed:', error);
            Alert.alert('Error', 'Failed to run system audit.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        runAudit();
    }, [runAudit]);

    const onRefresh = () => {
        setRefreshing(true);
        runAudit();
    };

    const handleRecomputeAll = async () => {
        Alert.alert(
            "Recompute All Loans",
            "This will recalculate the balance and status for ALL loans in the database. This might take a moment. Proceed?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Recompute All",
                    onPress: async () => {
                        setRunningAction('recomputing');
                        try {
                            const loans = await database.get<Loan>('loans').query().fetch();
                            let successCount = 0;
                            let failCount = 0;

                            for (const loan of loans) {
                                const res = await AuditService.recalculateLoanTotals(loan.id);
                                if (res.success) successCount++;
                                else failCount++;
                            }

                            Alert.alert("Process Complete", `Successfully recomputed ${successCount} loans.${failCount > 0 ? ` Failed ${failCount}.` : ''}`);
                            runAudit();
                        } catch (error) {
                            Alert.alert("Error", "Bulk recomputation failed.");
                        } finally {
                            setRunningAction(null);
                        }
                    }
                }
            ]
        );
    };

    const handleFixIssue = async (issue: AuditIssue) => {
        if (issue.id.startsWith('recon_status_')) {
            setRunningAction(issue.id);
            try {
                const res = await AuditService.recalculateLoanTotals(issue.entityId);
                if (res.success) {
                    runAudit();
                } else {
                    Alert.alert('Error', res.message);
                }
            } finally {
                setRunningAction(null);
            }
        } else if (issue.entityType === 'Loan') {
            router.push(`/(admin)/loans/${issue.entityId}`);
        } else if (issue.entityType === 'Borrower') {
            router.push(`/(admin)/borrowers/${issue.entityId}`);
        }
    };

    const criticalIssues = report?.issues.filter(i => i.category === 'Critical') || [];
    const warningIssues = report?.issues.filter(i => i.category === 'Warning') || [];
    const infoIssues = report?.issues.filter(i => i.category === 'Info') || [];

    const renderIssueGroup = (title: string, issues: AuditIssue[], color: string, icon: keyof typeof MaterialIcons.glyphMap) => {
        if (issues.length === 0) return null;
        return (
            <View className="mb-8">
                <View className="flex-row items-center mb-4 px-2">
                    <MaterialIcons name={icon} size={20} color={color} className="mr-2" />
                    <Text style={{ color }} className="text-sm font-black uppercase tracking-widest">{title} ({issues.length})</Text>
                </View>
                {issues.map((issue) => (
                    <View key={issue.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mb-3">
                        <View className="flex-row justify-between items-start">
                            <View className="flex-1 pr-4">
                                <View className="flex-row items-center mb-1">
                                    <Text className="text-[10px] font-black uppercase text-gray-700 tracking-tighter mr-2">{issue.entityType}</Text>
                                    {!!issue.entityName && <Text className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{issue.entityName}</Text>}
                                </View>
                                <Text className="text-gray-900 font-bold text-sm leading-tight">{issue.message || ''}</Text>
                                {!!issue.suggestedFix && <Text className="text-gray-700 text-[11px] mt-1 italic">Suggestion: {issue.suggestedFix}</Text>}
                            </View>
                            <AnimatedPressable 
                                onPress={() => handleFixIssue(issue)}
                                disabled={!!runningAction}
                                className={`px-4 py-2 rounded-xl flex-row items-center ${runningAction === issue.id ? 'bg-gray-100' : 'bg-gray-50 border border-gray-100'}`}
                            >
                                {runningAction === issue.id ? (
                                    <ActivityIndicator size="small" color="#9CA3AF" />
                                ) : (
                                    <>
                                        <Text className="text-gray-700 font-black text-[10px] uppercase mr-1">
                                            {issue.id.startsWith('recon_status_') ? 'Fix Now' : 'Inspect'}
                                        </Text>
                                        <MaterialIcons 
                                            name={issue.id.startsWith('recon_status_') ? "auto-fix-high" : "chevron-right"} 
                                            size={14} 
                                            color="#4B5563" 
                                        />
                                    </>
                                )}
                            </AnimatedPressable>
                        </View>
                    </View>
                ))}
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            <StatusBar barStyle="light-content" />
            
            <ScrollView
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {/* Header Section */}
                <LinearGradient
                    colors={['#1E3A5F', '#0F2540']}
                    className="pt-14 pb-20 px-6 rounded-b-[40px]"
                >
                    <View className="flex-row items-center justify-between mb-6">
                        <Pressable onPress={() => router.back()} className="p-2 bg-white/10 rounded-full">
                            <MaterialIcons name="arrow-back" size={20} color="#FFF" />
                        </Pressable>
                        <Text className="text-white text-xl font-black">System Audit</Text>
                        <View className="w-10" />
                    </View>

                    <View className="flex-row justify-between items-center bg-white/10 p-5 rounded-[32px] border border-white/5">
                        <View className="items-center flex-1 border-r border-white/10">
                            <Text className="text-red-400 text-[10px] font-black uppercase mb-1">Critical</Text>
                            <Text className="text-white text-2xl font-black">{criticalIssues.length}</Text>
                        </View>
                        <View className="items-center flex-1 border-r border-white/10">
                            <Text className="text-amber-400 text-[10px] font-black uppercase mb-1">Warnings</Text>
                            <Text className="text-white text-2xl font-black">{warningIssues.length}</Text>
                        </View>
                        <View className="items-center flex-1">
                            <Text className="text-blue-400 text-[10px] font-black uppercase mb-1">Informational</Text>
                            <Text className="text-white text-2xl font-black">{infoIssues.length}</Text>
                        </View>
                    </View>

                    {report && (
                        <Text className="text-white/80 text-[10px] text-center mt-4 uppercase font-bold tracking-widest">
                            Last Run: {format(report.timestamp, 'MMM d, h:mm a')}
                        </Text>
                    )}
                </LinearGradient>

                {/* Operations Section */}
                <View className="px-6 -mt-8 flex-row justify-between mb-8">
                    <AnimatedPressable 
                        onPress={runAudit}
                        disabled={loading}
                        className="bg-white flex-1 mr-2 p-5 rounded-3xl shadow-sm border border-gray-100 flex-row items-center justify-center"
                    >
                        <MaterialIcons name="refresh" size={18} color="#2563EB" className="mr-2" />
                        <Text className="text-blue-600 font-black text-xs uppercase">Scan Health</Text>
                    </AnimatedPressable>
                    <AnimatedPressable 
                        onPress={handleRecomputeAll}
                        disabled={!!runningAction}
                        className="bg-white flex-1 ml-2 p-5 rounded-3xl shadow-sm border border-gray-100 flex-row items-center justify-center"
                    >
                        {runningAction === 'recomputing' ? (
                            <ActivityIndicator size="small" color="#355E3B" />
                        ) : (
                            <>
                                <MaterialIcons name="calculate" size={18} color="#355E3B" className="mr-2" />
                                <Text className="text-emerald-600 font-black text-xs uppercase">Recompute All</Text>
                            </>
                        )}
                    </AnimatedPressable>
                </View>

                {/* List of Issues */}
                <View className="px-6">
                    {loading ? (
                        <View className="py-20 items-center">
                            <ActivityIndicator size="large" color="#1E3A5F" />
                            <Text className="text-gray-700 font-bold mt-4 uppercase text-xs tracking-widest">Running full system scan...</Text>
                        </View>
                    ) : report?.issues && report.issues.length > 0 ? (
                        <>
                            {renderIssueGroup('Critical Issues', criticalIssues, '#DC2626', 'dangerous')}
                            {renderIssueGroup('Warnings', warningIssues, '#D97706', 'warning')}
                            {renderIssueGroup('Informational', infoIssues, '#2563EB', 'info')}
                        </>
                    ) : (
                        <View className="py-20 items-center bg-white rounded-[32px] border border-emerald-50 shadow-sm">
                            <View className="w-16 h-16 bg-emerald-50 rounded-full items-center justify-center mb-4">
                                <MaterialIcons name="check-circle" size={32} color="#355E3B" />
                            </View>
                            <Text className="text-gray-900 font-black text-lg">System Healthy</Text>
                            <Text className="text-gray-700 text-center px-10 mt-2 text-sm">No critical data discrepancies found in the current audit run.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
