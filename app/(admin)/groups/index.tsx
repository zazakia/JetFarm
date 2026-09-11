import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { groupService } from '../../../src/services/GroupService';
import CollectionGroup from '../../../src/database/models/CollectionGroup';
import { Button } from '../../../src/components/Button';

export default function GroupsScreen() {
    const router = useRouter();
    const [groups, setGroups] = useState<CollectionGroup[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchGroups = async () => {
        try {
            setLoading(true);
            const data = await groupService.getSolidarityGroups();
            setGroups(data);
        } catch (error) {
            console.error('Failed to load groups:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    const renderItem = ({ item }: { item: CollectionGroup }) => (
        <View className="bg-white p-4 rounded-lg shadow mb-3">
            <Text className="font-bold text-lg">{item.name}</Text>
            <Text className="text-gray-600">Meeting: {item.centerDayName || 'TBD'} at {item.centerTime || 'TBD'}</Text>
            <Button 
                title="Manage Group" 
                onPress={() => router.push(`/(admin)/groups/${item.id}`)} 
                className="mt-3" 
            />
        </View>
    );

    return (
        <View className="flex-1 bg-gray-100 p-4">
            <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-gray-800">Solidarity Groups</Text>
                <Button 
                    title="Create Group" 
                    onPress={() => router.push('/(admin)/groups/new')}
                />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#0000ff" />
            ) : groups.length === 0 ? (
                <View className="flex-1 justify-center items-center">
                    <Text className="text-gray-500">No solidarity groups found.</Text>
                </View>
            ) : (
                <FlatList
                    data={groups}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                />
            )}
        </View>
    );
}
