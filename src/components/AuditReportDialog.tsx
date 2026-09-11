import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AuditIssue } from '../services/AuditService';

interface Props {
    visible: boolean;
    issues: AuditIssue[];
    onConfirm: () => void;
    onCancel: () => void;
    isSaving: boolean;
}

export function AuditReportDialog({ visible, issues, onConfirm, onCancel, isSaving }: Props) {
    const hasCritical = issues.some(i => i.category === 'Critical');
    const criticalIssues = issues.filter(i => i.category === 'Critical');
    const firstCriticalIssue = criticalIssues[0];
    
    const getCategoryStyles = (category: string) => {
        switch (category) {
            case 'Critical':
                return {
                    bg: 'bg-red-50',
                    border: 'border-red-200',
                    text: 'text-red-700',
                    icon: 'error-outline',
                    iconBg: 'bg-red-100'
                };
            case 'Warning':
                return {
                    bg: 'bg-amber-50',
                    border: 'border-amber-200',
                    text: 'text-amber-700',
                    icon: 'report-problem',
                    iconBg: 'bg-amber-100'
                };
            default:
                return {
                    bg: 'bg-blue-50',
                    border: 'border-blue-200',
                    text: 'text-blue-700',
                    icon: 'info-outline',
                    iconBg: 'bg-blue-100'
                };
        }
    };

    if (!visible) return null;

    return (
        <Modal 
            visible={visible} 
            animationType="fade" 
            transparent={true} 
            onRequestClose={onCancel}
        >
            <View className="flex-1 justify-center items-center bg-black/60 px-6">
                <Pressable className="absolute inset-0" onPress={onCancel} />
                
                <View className="bg-white rounded-[32px] w-full max-h-[85%] shadow-2xl overflow-hidden">
                    {/* Header */}
                    <View className={`px-6 py-5 flex-row items-center border-b ${hasCritical ? 'bg-red-50/50 border-red-100' : 'bg-amber-50/50 border-amber-100'}`}>
                        <View className={`${hasCritical ? 'bg-red-600' : 'bg-amber-500'} p-2.5 rounded-2xl mr-4 shadow-lg`}>
                            <MaterialIcons name={hasCritical ? "gpp-bad" : "fact-check"} size={24} color="#FFF" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-gray-900 font-black text-xl">Loan Auto-Audit</Text>
                            <Text className="text-gray-700 text-xs font-bold leading-tight">
                                {hasCritical ? "Critical issues must be resolved." : "Review flagged items before saving."}
                            </Text>
                        </View>
                        <Pressable onPress={onCancel} className="bg-white p-2 rounded-full border border-gray-100 shadow-sm active:bg-gray-50">
                            <MaterialIcons name="close" size={20} color="#64748B" />
                        </Pressable>
                    </View>

                    <ScrollView className="p-6" showsVerticalScrollIndicator={false}>
                        {issues.map((issue, index) => {
                            const styles = getCategoryStyles(issue.category);
                            return (
                                <View key={issue.id} className={`${styles.bg} ${styles.border} border rounded-2xl p-4 mb-4 shadow-sm`}>
                                    <View className="flex-row items-center mb-2">
                                        <View className={`${styles.iconBg} p-1.5 rounded-lg mr-2`}>
                                            <MaterialIcons name={styles.icon as any} size={16} color={hasCritical ? "#EF4444" : "#D97706"} />
                                        </View>
                                        <Text className={`${styles.text} font-black text-[10px] uppercase tracking-widest`}>
                                            {issue.category} Issue
                                        </Text>
                                    </View>
                                    <Text className="text-gray-900 font-bold text-sm leading-5">
                                        {issue.message}
                                    </Text>
                                    {issue.suggestedFix && (
                                        <View className="mt-3 bg-white/60 p-3 rounded-xl border border-white/80">
                                            <Text className="text-gray-700 text-[11px] leading-4">
                                                <Text className="text-gray-900 font-black uppercase tracking-tighter mr-1">Suggested Fix: </Text>
                                                {issue.suggestedFix}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </ScrollView>

                    {/* Footer */}
                    <View className="p-6 border-t border-gray-100 bg-gray-50/30">
                        <View className="flex-row gap-4">
                            <Pressable 
                                onPress={onCancel}
                                className="flex-1 bg-white border border-gray-200 py-4 rounded-2xl items-center shadow-sm active:bg-gray-50"
                                disabled={isSaving}
                            >
                                <Text className="text-gray-700 font-black uppercase tracking-widest text-xs">Back to Edit</Text>
                            </Pressable>
                            
                            {!hasCritical && (
                                <Pressable 
                                    onPress={onConfirm}
                                    className="flex-[1.5] bg-blue-600 py-4 rounded-2xl items-center shadow-lg active:bg-blue-700"
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <ActivityIndicator color="#FFF" size="small" />
                                    ) : (
                                        <Text className="text-white font-black uppercase tracking-widest text-xs">Proceed Anyway</Text>
                                    )}
                                </Pressable>
                            )}
                        </View>
                        {hasCritical && (
                            <View testID="audit-critical-save-blocker" className="mt-3 bg-red-50 border border-red-200 rounded-2xl p-3">
                                <Text className="text-red-700 text-xs font-black text-center">
                                    Cannot save loan until critical errors are resolved.
                                </Text>
                                {firstCriticalIssue && (
                                    <Text className="text-red-600 text-[11px] text-center mt-1 font-bold">
                                        {firstCriticalIssue.message}
                                    </Text>
                                )}
                                {firstCriticalIssue?.suggestedFix && (
                                    <Text className="text-red-500 text-[10px] text-center mt-1 italic">
                                        Suggested fix: {firstCriticalIssue.suggestedFix}
                                    </Text>
                                )}
                                {criticalIssues.length > 1 && (
                                    <Text className="text-red-500 text-[10px] text-center mt-1 font-bold">
                                        +{criticalIssues.length - 1} more critical issue{criticalIssues.length > 2 ? 's' : ''}
                                    </Text>
                                )}
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}
