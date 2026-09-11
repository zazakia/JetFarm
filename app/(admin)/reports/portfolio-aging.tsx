import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MfiKpiService } from '../../../src/services/MfiKpiService';
import { formatPHP } from '../../../src/utils/currency';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { MetricBreakdownDialog, BreakdownItem } from '../../../src/components/MetricBreakdownDialog';

export default function PortfolioAgingScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [agingBuckets, setAgingBuckets] = useState<any[]>([]);

    // Drill-down State
    const [selectedBucket, setSelectedBucket] = useState<any | null>(null);
    const [bucketDetails, setBucketDetails] = useState<BreakdownItem[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [dialogVisible, setDialogVisible] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await MfiKpiService.getAgingClusters();
            setAgingBuckets(data);
        } catch (error) {
            console.error('Failed to load aging clusters:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, []));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleBucketPress = async (bucket: any) => {
        setSelectedBucket(bucket);
        setLoadingDetails(true);
        setDialogVisible(true);
        setBucketDetails([]);

        try {
            const details = await MfiKpiService.getAgingBucketDetails(bucket.min, bucket.max);
            const items: BreakdownItem[] = details.map(d => ({
                id: d.id,
                label: d.borrowerName,
                sublabel: `${d.overdueDays} days overdue • ${d.loanNumber || 'No Loan #'}`,
                value: d.loanBalance,
                isCurrency: true
            }));
            setBucketDetails(items);
        } catch (error) {
            console.error('Failed to load bucket details:', error);
        } finally {
            setLoadingDetails(false);
        }
    };

    if (loading && !refreshing) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#D32F2F" />
            </View>
        );
    }

    const totalOverdue = agingBuckets.reduce((sum, b) => sum + b.amount, 0);

    return (
        <View className="flex-1 bg-gray-50">
            {/* ── Top controls (Static) ── */}
            <View className="p-6 pb-2 bg-gray-50 border-b border-gray-100">
                <Text className="text-2xl font-black text-gray-900 mb-2">Portfolio Aging</Text>
                <Text className="text-gray-700 font-bold uppercase tracking-widest text-[10px] mb-6">
                    PAR Buckets Breakdown (Principal At Risk)
                </Text>

                {/* Summary Chart-like Bar */}
                <View className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                    <Text className="text-gray-700 text-[10px] font-black uppercase tracking-widest mb-4">Portfolio Risk Distribution</Text>
                    <View className="flex-row h-4 rounded-full overflow-hidden bg-gray-50 mb-6">
                        {agingBuckets.map((bucket) => {
                            const percentage = totalOverdue > 0 ? (bucket.amount / totalOverdue) * 100 : 0;
                            if (percentage === 0) return null;
                            return (
                                <View key={bucket.label} style={{ width: `${percentage}%`, backgroundColor: bucket.color }} />
                            );
                        })}
                    </View>
                    
                    <View className="items-center">
                        <Text className="text-gray-700 text-[10px] font-bold uppercase">Total Principal At Risk</Text>
                        <Text className="text-3xl font-black text-gray-900">{formatPHP(totalOverdue)}</Text>
                    </View>
                </View>
            </View>

            <ScrollView 
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ padding: 24 }}
            >

                {/* Aging Buckets Detailed */}
                {agingBuckets.map((bucket, index) => (
                    <Animated.View 
                        key={bucket.label} 
                        entering={FadeInDown.delay(index * 100).springify()}
                        className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-4"
                    >
                        <Pressable onPress={() => handleBucketPress(bucket)}>
                            <View className="flex-row items-center justify-between mb-2">
                                <View className="flex-row items-center">
                                    <View style={{ backgroundColor: bucket.color }} className="w-3 h-3 rounded-full mr-3" />
                                    <Text className="text-gray-900 font-black text-lg">{bucket.label}</Text>
                                </View>
                                <View className="bg-gray-50 px-3 py-1 rounded-full flex-row items-center">
                                    <Text className="text-gray-700 font-bold text-xs mr-1">{bucket.count} Loans</Text>
                                    <MaterialIcons name="chevron-right" size={14} color="#9CA3AF" />
                                </View>
                            </View>
                            
                            <View className="flex-row justify-between items-end">
                                <View>
                                    <Text className="text-[10px] text-gray-700 font-bold uppercase mb-1">Outstanding Balance</Text>
                                    <Text className="text-gray-900 font-black text-2xl">{formatPHP(bucket.amount)}</Text>
                                </View>
                                <View className="items-end">
                                    <Text className="text-[10px] text-gray-700 font-bold uppercase mb-1">Risk Weight</Text>
                                    <Text className="text-gray-900 font-bold">
                                        {totalOverdue > 0 ? ((bucket.amount / totalOverdue) * 100).toFixed(1) : '0.0'}%
                                    </Text>
                                </View>
                            </View>
                        </Pressable>
                    </Animated.View>
                ))}

                {/* Drill-down Dialog */}
                <MetricBreakdownDialog
                    visible={dialogVisible}
                    onClose={() => setDialogVisible(false)}
                    title={`Aging Detail: ${selectedBucket?.label || ''}`}
                    total={selectedBucket?.amount || 0}
                    items={bucketDetails}
                    color={selectedBucket?.color || '#000'}
                />

                {agingBuckets.length === 0 && (
                    <View className="p-10 items-center">
                        <MaterialIcons name="assignment-turned-in" size={40} color="#D1D5DB" />
                        <Text className="text-gray-700 font-semibold mt-3">Portfolio is healthy!</Text>
                        <Text className="text-gray-700 text-xs text-center">No overdue accounts detected.</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
