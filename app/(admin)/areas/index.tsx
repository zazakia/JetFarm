import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { groupService } from '../../../src/services/GroupService';
import Area from '../../../src/database/models/Area';
import { Button } from '../../../src/components/Button';

export default function AreasScreen() {
    const router = useRouter();
    const [areas, setAreas] = useState<Area[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAreas = async () => {
        try {
            setLoading(true);
            const data = await groupService.getAreas();
            setAreas(data);
        } catch (error) {
            console.error('Failed to load areas:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAreas();
    }, []);

    const renderItem = ({ item }: { item: Area }) => (
        <View className="bg-white p-4 rounded-lg shadow mb-3">
            <Text className="font-bold text-lg">{item.name}</Text>
            {item.code && <Text className="text-gray-600">Code: {item.code}</Text>}
            <Text className="text-gray-500 text-sm mt-1">Status: {item.isActive ? 'Active' : 'Inactive'}</Text>
            <Button 
                title="Edit Area" 
                onPress={() => alert('Editing Area ' + item.name)} 
                className="mt-3" 
                variant="outline"
            />
        </View>
    );

    return (
        <View className="flex-1 bg-gray-100 p-4">
            <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-gray-800">Areas & Barangays</Text>
                <Button 
                    title="Add Area" 
                    onPress={() => router.push('/(admin)/areas/new')}
                />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#0000ff" />
            ) : areas.length === 0 ? (
                <View className="flex-1 justify-center items-center">
                    <Text className="text-gray-500">No areas defined yet.</Text>
                </View>
            ) : (
                <FlatList
                    data={areas}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                />
            )}
        </View>
    );
}
