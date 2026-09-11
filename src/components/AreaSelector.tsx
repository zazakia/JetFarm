import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { groupService } from '../services/GroupService';
import Area from '../database/models/Area';

interface AreaSelectorProps {
    selectedAreaId: string | null;
    onSelect: (areaId: string) => void;
}

export const AreaSelector: React.FC<AreaSelectorProps> = ({ selectedAreaId, onSelect }) => {
    const [areas, setAreas] = useState<Area[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAreas = async () => {
            try {
                const data = await groupService.getAreas();
                setAreas(data);
                if (data.length > 0 && !selectedAreaId) {
                    onSelect(data[0].id);
                }
            } catch (error) {
                console.error('Error fetching areas for selector:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAreas();
    }, []);

    if (loading) {
        return <ActivityIndicator size="small" color="#0000ff" />;
    }

    if (areas.length === 0) {
        return <Text className="text-red-500 text-sm">No areas found. Ask an admin to add one.</Text>;
    }

    return (
        <View className="border border-gray-300 rounded p-2">
            <Text className="text-gray-700 text-sm mb-1">Select Area (Picker Placeholder)</Text>
            <Text className="text-black font-semibold">
                {areas.find(a => a.id === selectedAreaId)?.name || 'Select an area'}
            </Text>
        </View>
    );
};
