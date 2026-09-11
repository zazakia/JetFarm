import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { database } from '../../../src/database';
import CollectionLog from '../../../src/database/models/CollectionLog';
import Collector from '../../../src/database/models/Collector';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { formatPHP } from '../../../src/utils/currency';
import { Q } from '@nozbe/watermelondb';
import { format } from 'date-fns';
import { safeBack } from '../../../src/utils/navigation';

type LogWithCollector = {
    log: CollectionLog;
    collector: Collector | undefined;
};

export default function CollectionLogsScreen() {
    const router = useRouter();
    const [logs, setLogs] = useState<LogWithCollector[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            const fetchedLogs = await database.get<CollectionLog>('collection_logs').query(
                Q.where('deleted_at', Q.eq(null)),
                Q.sortBy('log_date', Q.desc)
            ).fetch();

            const collectors = await database.get<Collector>('collectors').query().fetch();
            
            const combined = fetchedLogs.map(log => ({
                log,
                collector: collectors.find(c => c.id === log.collectorId || c.authId === log.collectorId)
            }));
            
            setLogs(combined);
        } catch (error) {
            console.error('Failed to load collection logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const renderItem = ({ item }: { item: LogWithCollector }) => (
        <View className="bg-white p-6 rounded-3xl mb-4 border border-gray-100 shadow-sm">
            <View className="flex-row justify-between items-start mb-4">
                <View>
                    <Text className="text-lg font-black text-gray-900">{item.collector?.fullName || 'Unknown Collector'}</Text>
                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest">{format(new Date(item.log.logDate), 'MMM dd, yyyy')}</Text>
                </View>
                <View className="bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                    <Text className="text-green-800 font-black text-xs uppercase tracking-wider">Collected: {formatPHP(item.log.totalCollected)}</Text>
                </View>
            </View>

            <View className="flex-row justify-between mb-2">
                <Text className="text-xs font-bold text-gray-500 uppercase">Starting Cash</Text>
                <Text className="text-sm font-black text-gray-700">{formatPHP(item.log.cashOnHandStart)}</Text>
            </View>
            <View className="flex-row justify-between mb-3 pb-3 border-b border-gray-100">
                <Text className="text-xs font-bold text-gray-500 uppercase">Ending Cash</Text>
                <Text className="text-sm font-black text-gray-700">{formatPHP(item.log.cashOnHandEnd)}</Text>
            </View>
            
            {item.log.notes && (
                <View className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <Text className="text-[10px] font-bold text-gray-500 uppercase mb-1">Notes</Text>
                    <Text className="text-xs font-bold text-gray-700">{item.log.notes}</Text>
                </View>
            )}
        </View>
    );

    return (
        <View className="flex-1 bg-gray-50 p-4">
            <View className="flex-row items-center mb-6">
                <Pressable onPress={() => safeBack(router, '/(admin)')} className="bg-white p-2 rounded-full mr-4 shadow-sm border border-gray-100">
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </Pressable>
                <View>
                    <Text className="text-2xl font-black text-gray-900">Collection Logs</Text>
                    <Text className="text-gray-700 font-medium">Daily End-of-Day Summaries</Text>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#1E3A8A" className="mt-10" />
            ) : (
                <FlatList
                    data={logs}
                    keyExtractor={(item) => item.log.id}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View className="items-center justify-center py-20">
                            <MaterialIcons name="fact-check" size={64} color="#E5E7EB" />
                            <Text className="text-gray-700 font-medium mt-4 text-base">No collection logs submitted yet</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}
