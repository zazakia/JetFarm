import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    FlatList,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useCollectors } from '../hooks/useCollectors';

interface CollectorSelectorProps {
    selectedCollectorId?: string;
    onSelect: (collectorId: string, collectorName: string) => void;
    onClose?: () => void;
    visible: boolean;
    error?: string;
}

interface CollectorItem {
    id: string;
    name: string;
    email?: string;
}

/**
 * Modal component for selecting a collector to assign to a borrower
 * Fetches collectors from WatermelonDB (local cache) with Supabase fallback
 * Displays collector name and email if available
 */
export const CollectorSelector: React.FC<CollectorSelectorProps> = ({
    selectedCollectorId,
    onSelect,
    onClose,
    visible,
    error,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const { collectors, loading } = useCollectors();

    // Filter collectors based on search query
    const filteredCollectors = useMemo(() => {
        if (!collectors) return [];
        const query = searchQuery.toLowerCase();
        return collectors.filter((c) =>
            c.name.toLowerCase().includes(query) ||
            (c.email && c.email.toLowerCase().includes(query))
        );
    }, [collectors, searchQuery]);

    const handleSelect = (collector: CollectorItem) => {
        onSelect(collector.id, collector.name);
        if (onClose) onClose();
        setSearchQuery('');
    };

    const handleClose = () => {
        if (onClose) onClose();
        setSearchQuery('');
    };

    const renderCollectorItem = ({ item }: { item: CollectorItem }) => (
        <Pressable
            onPress={() => handleSelect(item)}
            className={`flex-row items-center px-4 py-3 border-b border-gray-100 ${
                selectedCollectorId === item.id ? 'bg-blue-50' : 'bg-white'
            } active:bg-gray-50`}
        >
            <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
                {item.email && (
                    <Text className="text-xs text-gray-700 mt-1">{item.email}</Text>
                )}
            </View>
            {selectedCollectorId === item.id && (
                <MaterialIcons name="check-circle" size={24} color="#1E3A8A" />
            )}
        </Pressable>
    );

    const renderEmptyState = () => (
        <View className="flex-1 justify-center items-center py-20">
            <MaterialIcons name="person-off" size={48} color="#D1D5DB" />
            <Text className="text-gray-700 mt-4 text-center">
                {loading ? 'Loading collectors...' : 'No collectors found'}
            </Text>
        </View>
    );

    return (
        <Modal
            testID="collector-modal"
            visible={visible}
            animationType="slide"
            onRequestClose={handleClose}
        >
            <View className="flex-1 bg-white">
                {/* Header */}
                <View className="px-6 pt-12 pb-6 border-b border-gray-100">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-2xl font-extrabold text-gray-900">
                            Select Collector
                        </Text>
                        <Pressable
                            testID="close-collector-modal"
                            onPress={handleClose}
                            className="bg-gray-100 p-2 rounded-full active:bg-gray-200"
                        >
                            <MaterialIcons name="close" size={24} color="#4B5563" />
                        </Pressable>
                    </View>

                    {/* Search Bar */}
                    <View className="flex-row items-center bg-gray-50 rounded-xl px-4 border border-gray-200">
                        <MaterialIcons name="search" size={20} color="#9CA3AF" />
                        <TextInput
                            className="flex-1 ml-2 h-12 text-gray-900"
                            placeholder="Search by name or email..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>
                </View>

                {/* Collectors List */}
                {loading ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#1E3A8A" />
                    </View>
                ) : (
                    <FlatList
                        data={filteredCollectors}
                        renderItem={renderCollectorItem}
                        keyExtractor={(item) => item.id}
                        ListEmptyComponent={renderEmptyState}
                    />
                )}

                {/* Footer Info */}
                {collectors && collectors.length > 0 && (
                    <View className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                        <Text className="text-xs text-gray-700">
                            {filteredCollectors.length} of {collectors.length} collectors
                        </Text>
                    </View>
                )}
            </View>
        </Modal>
    );
};
