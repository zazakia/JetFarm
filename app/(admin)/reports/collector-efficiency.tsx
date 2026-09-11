import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MfiKpiService } from '../../../src/services/MfiKpiService';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPHP } from '../../../src/utils/currency';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ReportInfoModal, InfoModalContent, InfoIcon } from '../../../src/components/ReportInfoModal';

export default function CollectorEfficiencyScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [collectors, setCollectors] = useState<any[]>([]);
    const [infoContent, setInfoContent] = useState<InfoModalContent | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await MfiKpiService.getCollectorEfficiency();
            setCollectors(data);
        } catch (error) {
            console.error('Failed to load collector efficiency:', error);
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

    if (loading && !refreshing) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#7B1FA2" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            <View className="p-6 pb-2 bg-gray-50 border-b border-gray-100">
                <View className="flex-row items-center mb-2">
                    <Text className="text-2xl font-black text-gray-900">Collector Ranking</Text>
                    <InfoIcon onPress={() => setInfoContent({
                        title: 'Collector Efficiency Ranking',
                        question: 'How well are our collectors performing against their expected collections?',
                        formula: 'Total Collected Amount / Total Assigned Target Collections',
                        explanation: 'This metric compares each collector\'s actual cash collected against the scheduled payments they were assigned to collect that month.'
                    })} />
                </View>
                <Text className="text-gray-700 font-bold uppercase tracking-widest text-[10px]">
                    Monthly Efficiency (Collected vs Target)
                </Text>
            </View>

            <ScrollView 
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ padding: 24 }}
            >

                {collectors.map((collector, index) => (
                    <Animated.View 
                        key={collector.userId} 
                        entering={FadeInDown.delay(index * 100).springify()}
                        className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-4"
                    >
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 rounded-full bg-purple-50 items-center justify-center mr-4">
                                    <Text className="text-purple-700 font-black text-lg">{index + 1}</Text>
                                </View>
                                <View>
                                    <Text className="text-white font-bold text-lg">{collector.name}</Text>
                                    <Text className="text-gray-700 text-xs font-bold uppercase">Collector</Text>
                                </View>
                            </View>
                            <View className="items-end">
                                <Text className="text-gray-900 font-black text-2xl">{collector.efficiency.toFixed(1)}%</Text>
                                <Text className="text-gray-700 text-[10px] font-bold uppercase">Efficiency</Text>
                            </View>
                        </View>
                        
                        {/* Progress Bar */}
                        <View className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mb-4">
                            <LinearGradient
                                colors={['#7C3AED', '#2563EB']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{ width: `${Math.min(collector.efficiency, 100)}%`, height: '100%' }}
                            />
                        </View>

                        <View className="flex-row justify-between pt-2 border-t border-gray-50">
                            <View>
                                <Text className="text-[10px] text-gray-700 font-bold uppercase">Collected</Text>
                                <Text className="text-gray-900 font-black">{formatPHP(collector.collected)}</Text>
                            </View>
                            <View className="items-center">
                                <View className="flex-row items-center">
                                    <Text className="text-[10px] text-orange-600 font-bold uppercase">Cash Held</Text>
                                    <InfoIcon color="#EA580C" onPress={() => setInfoContent({
                                        title: 'Cash Held',
                                        question: 'How much cash is physically with the collector right now?',
                                        formula: 'Total Collected - Total Remitted to Admin',
                                        explanation: 'This represents "in transit" cash that the collector has collected from borrowers but has not yet remitted or surrendered to the admin.'
                                    })} />
                                </View>
                                <Text className="text-orange-700 font-black">{formatPHP(collector.cashHeld)}</Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-[10px] text-gray-700 font-bold uppercase">Target</Text>
                                <Text className="text-gray-900 font-black">{formatPHP(collector.target)}</Text>
                            </View>
                        </View>
                    </Animated.View>
                ))}

                {collectors.length === 0 && (
                    <View className="p-10 items-center">
                        <MaterialIcons name="people-outline" size={40} color="#D1D5DB" />
                        <Text className="text-gray-700 font-semibold mt-3">No collector data found</Text>
                    </View>
                )}
            </ScrollView>

            <ReportInfoModal 
                visible={!!infoContent}
                content={infoContent}
                onClose={() => setInfoContent(null)}
            />
        </View>
    );
}
