import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import CollectionGroup from '../../../src/database/models/CollectionGroup';
import { database } from '../../../src/database';

export default function GroupDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [group, setGroup] = useState<CollectionGroup | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchGroup = async () => {
            try {
                if (id) {
                    const data = await database.get<CollectionGroup>('collection_groups').find(id);
                    setGroup(data);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchGroup();
    }, [id]);

    if (loading) {
        return <ActivityIndicator size="large" color="#0000ff" className="flex-1 mt-10" />;
    }

    if (!group) {
        return (
            <View className="flex-1 justify-center items-center">
                <Text className="text-gray-500">Group not found.</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-100 p-4">
            <View className="bg-white p-6 rounded-lg shadow">
                <Text className="text-2xl font-bold mb-2">{group.name}</Text>
                <View className="h-px bg-gray-200 my-2" />
                <Text className="text-gray-700 font-bold mt-2">Center Meeting Schedule</Text>
                <Text className="text-gray-600">Day: {group.centerDayName || 'Not Set'}</Text>
                <Text className="text-gray-600">Time: {group.centerTime || 'Not Set'}</Text>
                <View className="h-px bg-gray-200 my-2" />
                <Text className="text-gray-700 font-bold mt-2">Location & Area</Text>
                <Text className="text-gray-600">Area ID: {group.areaId || 'None'}</Text>
                <Text className="text-gray-500 italic mt-4 text-sm">Center Meeting features such as member attendance and mass collection will be integrated in subsequent phases.</Text>
            </View>
        </View>
    );
}
