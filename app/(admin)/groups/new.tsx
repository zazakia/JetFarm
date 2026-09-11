import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { groupService } from '../../../src/services/GroupService';
import Area from '../../../src/database/models/Area';
import { Button } from '../../../src/components/Button';

export default function NewGroupScreen() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [centerDayName, setCenterDayName] = useState('');
    const [centerTime, setCenterTime] = useState('');
    const [areas, setAreas] = useState<Area[]>([]);
    const [selectedAreaId, setSelectedAreaId] = useState('');
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    useEffect(() => {
        const loadAreas = async () => {
            try {
                const data = await groupService.getAreas();
                setAreas(data);
                if (data.length > 0) setSelectedAreaId(data[0].id);
            } catch (e) {
                console.error(e);
            } finally {
                setInitialLoading(false);
            }
        };
        loadAreas();
    }, []);

    const handleCreate = async () => {
        if (!name || !centerDayName || !centerTime || !selectedAreaId) {
            alert('Please fill out all fields.');
            return;
        }

        try {
            setLoading(true);
            await groupService.createSolidarityGroup({
                name,
                collectorId: 'placeholder-collector-id', // In a real app, pick from a dropdown
                areaId: selectedAreaId,
                centerDayName,
                centerTime
            });
            alert('Group created successfully!');
            router.back();
        } catch (error) {
            console.error('Failed to create group:', error);
            alert('Error creating group.');
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return <ActivityIndicator size="large" color="#0000ff" className="mt-10" />;
    }

    return (
        <ScrollView className="flex-1 bg-white p-4">
            <Text className="text-xl font-bold mb-4">Create Solidarity Group</Text>

            <Text className="mb-1 text-gray-700">Group Name</Text>
            <TextInput
                className="border border-gray-300 rounded p-2 mb-4 text-gray-900"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Center A - San Jose"
             placeholderTextColor="#9CA3AF"/>

            <Text className="mb-1 text-gray-700">Center Meeting Day</Text>
            <TextInput
                className="border border-gray-300 rounded p-2 mb-4 text-gray-900"
                value={centerDayName}
                onChangeText={setCenterDayName}
                placeholder="e.g. Monday"
             placeholderTextColor="#9CA3AF"/>

            <Text className="mb-1 text-gray-700">Center Meeting Time</Text>
            <TextInput
                className="border border-gray-300 rounded p-2 mb-4 text-gray-900"
                value={centerTime}
                onChangeText={setCenterTime}
                placeholder="e.g. 09:00 AM"
             placeholderTextColor="#9CA3AF"/>

            <Text className="mb-1 text-gray-700">Area</Text>
            {areas.length === 0 ? (
                <Text className="text-red-500 mb-4">No areas defined. Please create an area first.</Text>
            ) : (
                <View className="mb-4">
                    <Text className="text-gray-500 mb-2">Selected Area ID: {selectedAreaId}</Text>
                    {/* Placeholder for a Picker component */}
                </View>
            )}

            <View className="flex-row justify-end space-x-2 mt-4">
                <Button title="Cancel" onPress={() => router.back()} variant="outline" disabled={loading} />
                <Button title={loading ? 'Creating...' : 'Create Group'} onPress={handleCreate} disabled={loading || areas.length === 0} />
            </View>
        </ScrollView>
    );
}
