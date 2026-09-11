import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AuditService, { AuditReport, AuditIssue, AuditCategory } from '../../../src/services/AuditService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function AuditScreen() {
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState<AuditReport | null>(null);
    const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

    const runAudit = async () => {
        setLoading(true);
        try {
            const result = await AuditService.runFullAudit();
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setReport(result);
        } catch (error) {
            console.error('Audit failed:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        runAudit();
    }, []);

    const getCategoryStyles = (category: AuditCategory) => {
        switch (category) {
            case 'Critical': return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: 'error' as any };
            case 'Warning': return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: 'warning' as any };
            default: return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: 'info' as any };
        }
    };

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ 
                title: 'Data Integrity Audit',
                headerRight: () => (
                    <Pressable onPress={runAudit} disabled={loading} className="mr-2">
                        {loading ? <ActivityIndicator size="small" color="#1E3A8A" /> : (
                            <MaterialIcons name="refresh" size={24} color="#1E3A8A" />
                        )}
                    </Pressable>
                )
            }} />

            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
                {!report && !loading && (
                    <View className="items-center justify-center py-20">
                        <MaterialIcons name="verified-user" size={64} color="#E5E7EB" />
                        <Text className="text-gray-700 font-bold mt-4">Start audit to check data health</Text>
                    </View>
                )}

                {report && (
                    <View className="mb-6">
                        <View className="flex-row items-center justify-between mb-4">
                            <View>
                                <Text className="text-2xl font-black text-gray-900">System Report</Text>
                                <Text className="text-gray-700 text-xs">Last run: {new Date(report.timestamp).toLocaleTimeString()}</Text>
                            </View>
                            <View className={`px-4 py-2 rounded-full ${report.totalIssues === 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                                <Text className={`font-black uppercase tracking-widest text-[10px] ${report.totalIssues === 0 ? 'text-green-700' : 'text-red-700'}`}>
                                    {report.totalIssues === 0 ? 'Clean' : `${report.totalIssues} Issues`}
                                </Text>
                            </View>
                        </View>

                        {report.totalIssues === 0 ? (
                            <View className="bg-green-50 p-8 rounded-3xl border border-green-200 items-center">
                                <View className="w-16 h-16 rounded-full bg-green-100 items-center justify-center mb-4">
                                    <MaterialIcons name="check-circle" size={40} color="#355E3B" />
                                </View>
                                <Text className="text-green-800 font-bold text-lg">Perfect Health!</Text>
                                <Text className="text-green-600 text-center mt-2">No data inconsistencies or orphans found.</Text>
                            </View>
                        ) : (
                            <View className="gap-y-3">
                                {report.issues.map((issue) => {
                                    const styles = getCategoryStyles(issue.category);
                                    const isExpanded = expandedIssue === issue.id;
                                    
                                    return (
                                        <Pressable 
                                            key={issue.id}
                                            onPress={() => {
                                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                setExpandedIssue(isExpanded ? null : issue.id);
                                            }}
                                            className={`${styles.bg} p-4 rounded-2xl border ${styles.border} shadow-sm`}
                                        >
                                            <View className="flex-row items-start">
                                                <MaterialIcons name={styles.icon} size={20} color={issue.category === 'Critical' ? '#DC2626' : (issue.category === 'Warning' ? '#D97706' : '#2563EB')} className="mr-3 mt-1" />
                                                <View className="flex-1">
                                                    <View className="flex-row justify-between items-center mb-1">
                                                        <Text className={`font-black uppercase tracking-widest text-[10px] ${styles.text}`}>
                                                            {issue.entityType}: {issue.entityName || issue.entityId.substring(0, 8)}
                                                        </Text>
                                                        <MaterialIcons name={isExpanded ? "expand-less" : "expand-more"} size={20} color="#9CA3AF" />
                                                    </View>
                                                    <Text className="text-gray-900 font-bold leading-5">{issue.message}</Text>
                                                    
                                                    {isExpanded && issue.suggestedFix && (
                                                        <View className="mt-4 pt-4 border-t border-gray-100">
                                                            <View className="flex-row items-center mb-2">
                                                                <MaterialIcons name="build" size={14} color="#4B5563" className="mr-2" />
                                                                <Text className="text-gray-700 font-bold text-xs uppercase tracking-widest">Recommended Action</Text>
                                                            </View>
                                                            <Text className="text-gray-600 text-sm leading-5">{issue.suggestedFix}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                )}

                <View className="h-10" />
            </ScrollView>
        </View>
    );
}
