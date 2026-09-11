import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import Collector from '../../../src/database/models/Collector';
import { MaterialIcons } from '@expo/vector-icons';
import { SearchBar } from '../../../src/components/SearchBar';

export default function CollectorsListScreen() {
    const router = useRouter();
    const [collectors, setCollectors] = useState<Collector[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            const fetched = await database.collections.get<Collector>('collectors').query(
                Q.where('is_active', Q.notEq(false)),
                Q.where('full_name', Q.notLike('%Diagnostic%')),
                Q.where('full_name', Q.notLike('%Mock%'))
            ).fetch();

            // JS-level deduplication by normalized name + junk filtering
            const seen = new Map<string, Collector>();
            for (const c of fetched) {
                const name = (c.fullName || '').trim();
                const normalized = name.toLowerCase().replace(/\s+/g, ' ');
                // Skip junk/test names
                if (!normalized ||
                    normalized.includes('test') ||
                    normalized.includes('fix') ||
                    normalized.includes('diagnostic') ||
                    normalized.includes('mock') ||
                    /^collector\s*\d*$/.test(normalized)) {
                    continue;
                }
                // Keep the first occurrence (prefer records with isActive=true)
                if (!seen.has(normalized) || (c.isActive && !seen.get(normalized)!.isActive)) {
                    seen.set(normalized, c);
                }
            }
            setCollectors(Array.from(seen.values()));
        } catch (error) {
            console.error('Failed to load collectors:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const filtered = collectors.filter(c =>
        c.fullName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderItem = ({ item }: { item: Collector }) => (
        <Pressable
            className="bg-white p-4 rounded-2xl mb-3 border border-gray-100 shadow-sm flex-row items-center active:opacity-70"
            onPress={() => router.push(`/(admin)/collectors/${item.id}`)}
        >
            <View className="w-12 h-12 rounded-full bg-blue-50 items-center justify-center mr-4">
                <Text className="text-blue-700 font-bold text-lg">{item.fullName.charAt(0)}</Text>
            </View>
            <View className="flex-1">
                <Text className="text-base font-bold text-gray-900">{item.fullName}</Text>
                <Text className="text-xs text-gray-700 mt-0.5 uppercase tracking-wider">
                    Field Agent
                </Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#E5E7EB" />
        </Pressable>
    );

    return (
        <View className="flex-1 bg-gray-50 p-4">
            <View className="mb-4">
                <SearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search agents..."
                />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#1E3A8A" className="mt-10" />
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View className="items-center justify-center py-20">
                            <MaterialIcons name="person-off" size={64} color="#E5E7EB" />
                            <Text className="text-gray-700 font-medium mt-4 text-base">No field agents found</Text>
                        </View>
                    }
                />
            )}

            {/* FAB */}
            <Pressable
                className="absolute bottom-6 right-6 flex-row items-center bg-blue-900 px-6 py-4 rounded-full shadow-xl active:bg-blue-900"
                onPress={() => router.push('/(admin)/collectors/new')}
            >
                <MaterialIcons name="person-add" size={24} color="#FFFFFF" className="mr-2" />
                <Text className="text-white font-black uppercase tracking-wider">Add Collector</Text>
            </Pressable>
        </View>
    );
}
