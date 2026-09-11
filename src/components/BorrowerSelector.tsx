import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../database';
import Borrower from '../database/models/Borrower';
import { Q } from '@nozbe/watermelondb';


interface BorrowerSelectorProps {
    selectedBorrowerId?: string;
    onSelect: (borrower: Borrower) => void;
    error?: string;
    role?: string | null;
    collectorId?: string | null;
    disabled?: boolean;
}

export const BorrowerSelector: React.FC<BorrowerSelectorProps> = ({ selectedBorrowerId, onSelect, error, role, collectorId, disabled = false }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isQuickAddVisible, setIsQuickAddVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [borrowers, setBorrowers] = useState<Borrower[]>([]);
    const [selectedName, setSelectedName] = useState('Select a Member');

    useEffect(() => {
        const loadSelected = async () => {
            if (selectedBorrowerId) {
                try {
                    const borrower = await database.collections.get<Borrower>('borrowers').find(selectedBorrowerId);
                    if (borrower) setSelectedName(borrower.fullName);
                } catch (e) {
                    console.error("Failed to load selected borrower", e);
                }
            } else {
                setSelectedName('Select a Member');
            }
        };
        loadSelected();
    }, [selectedBorrowerId]);

    const loadBorrowers = async () => {
        try {
            const collection = database.collections.get<Borrower>('borrowers');
            const query = role === 'collector' && collectorId
                ? collection.query(Q.where('collector_id', collectorId), Q.where('deleted_at', Q.eq(null)))
                : collection.query(Q.where('deleted_at', Q.eq(null)));
            const data = await query.fetch();
            setBorrowers(data);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (isVisible) loadBorrowers();
    }, [isVisible]);

    const filteredBorrowers = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return borrowers.filter(b =>
            b.fullName.toLowerCase().includes(query)
        );
    }, [borrowers, searchQuery]);

    const handleSelect = (borrower: Borrower) => {
        onSelect(borrower);
        setSelectedName(borrower.fullName);
        setIsVisible(false);
        setSearchQuery('');
    };

    return (
        <View className="mb-4">
            <Text className="text-xs font-black text-gray-700 mb-2 uppercase">Member *</Text>
            <Pressable
                testID="borrower-selector"
                onPress={() => !disabled && setIsVisible(true)}
                disabled={disabled}
                className={`bg-gray-50 p-4 rounded-xl border ${error ? 'border-red-400' : 'border-gray-200'} flex-row justify-between items-center ${disabled ? 'opacity-60' : ''}`}
            >
                <Text className={`text-base ${selectedBorrowerId ? 'text-gray-900 font-bold' : 'text-gray-700 font-semibold'}`}>
                    {selectedName}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color="#9CA3AF" />
            </Pressable>
            {!!error && <Text className="text-red-500 text-xs mt-1">{error}</Text>}

            <Modal testID="borrower-modal" visible={isVisible} animationType="slide" onRequestClose={() => setIsVisible(false)}>
                <View className="flex-1 bg-white p-6 pt-12">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-2xl font-extrabold text-gray-900">Select Member</Text>
                        <Pressable testID="close-modal" onPress={() => setIsVisible(false)} className="bg-gray-100 p-2 rounded-full">
                            <MaterialIcons name="close" size={24} color="#4B5563" />
                        </Pressable>
                    </View>

                    <View className="flex-row mb-6">
                        <View className="flex-1 flex-row items-center bg-gray-50 rounded-xl px-4 mr-3 border border-gray-200">
                            <MaterialIcons name="search" size={20} color="#4B5563" />
                            <TextInput
                                testID="borrower-search-input"
                                className="flex-1 ml-2 h-12 text-gray-900"
                                placeholder="Search by name..."
                                placeholderTextColor="#6B7280"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                        <Pressable
                            testID="person-add"
                            className="bg-blue-900 px-4 rounded-xl flex-row items-center justify-center active:bg-blue-900 shadow-sm"
                            onPress={() => setIsQuickAddVisible(true)}
                        >
                            <MaterialIcons name="person-add" size={20} color="white" className="mr-2" />
                            <Text className="text-white font-bold">New</Text>
                        </Pressable>
                    </View>

                    <FlatList
                        data={filteredBorrowers}
                        keyExtractor={item => item.id}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <Pressable
                                testID={`borrower-option-${item.id}`}
                                className="py-4 border-b border-gray-100 flex-row items-center active:bg-gray-50"
                                onPress={() => handleSelect(item)}
                            >
                                <View className="bg-blue-50 w-12 h-12 rounded-full mr-4 items-center justify-center">
                                    <Text className="text-blue-700 font-bold text-lg">{item.fullName.charAt(0)}</Text>
                                </View>
                                <View>
                                    <Text className="text-base font-bold text-gray-900">{item.fullName}</Text>
                                    {!!item.phone && <Text className="text-gray-700 text-xs mt-0.5">{item.phone}</Text>}
                                </View>
                            </Pressable>
                        )}
                        ListEmptyComponent={
                            <View className="items-center mt-20">
                                <MaterialIcons name="group-off" size={64} color="#E5E7EB" />
                                <Text className="text-gray-700 font-bold mt-4">No members found.</Text>
                            </View>
                        }
                    />
                </View>

                {/* Quick Add removed */}
            </Modal>
        </View>
    );
};
