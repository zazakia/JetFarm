import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { areaService } from '../../../src/services/AreaService';
import { Button } from '../../../src/components/Button';

export default function NewAreaScreen() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!name) {
            alert('Area name is required.');
            return;
        }

        try {
            setLoading(true);
            await areaService.createArea(name, code);
            alert('Area added successfully!');
            router.back();
        } catch (error) {
            console.error('Failed to create area:', error);
            alert('Error adding area.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView className="flex-1 bg-white p-4">
            <Text className="text-xl font-bold mb-4">Add New Area</Text>

            <Text className="mb-1 text-gray-700">Area/Barangay Name</Text>
            <TextInput
                className="border border-gray-300 rounded p-2 mb-4 text-gray-900"
                value={name}
                onChangeText={setName}
                placeholder="e.g. San Agustin"
             placeholderTextColor="#9CA3AF"/>

            <Text className="mb-1 text-gray-700">Area Code (Optional)</Text>
            <TextInput
                className="border border-gray-300 rounded p-2 mb-4 text-gray-900"
                value={code}
                onChangeText={setCode}
                placeholder="e.g. SA"
             placeholderTextColor="#9CA3AF"/>

            <View className="flex-row justify-end space-x-2 mt-4">
                <Button title="Cancel" onPress={() => router.back()} variant="outline" disabled={loading} />
                <Button title={loading ? 'Adding...' : 'Add Area'} onPress={handleCreate} disabled={loading} />
            </View>
        </ScrollView>
    );
}
