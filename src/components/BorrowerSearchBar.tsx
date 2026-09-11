import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, TextInput, Text, Pressable, FlatList, Keyboard, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import Borrower from '../database/models/Borrower';
import BaseModelService from '../services/BaseModelService';

interface BorrowerSearchBarProps {
    /** The current borrower ID, so we can highlight/exclude them */
    currentBorrowerId?: string;
    /** Placeholder text */
    placeholder?: string;
}

/**
 * A quick-jump search bar for borrower screens.
 * Tap to expand, type to search, tap a result to navigate.
 */
export const BorrowerSearchBar: React.FC<BorrowerSearchBarProps> = ({
    currentBorrowerId,
    placeholder = 'Jump to borrower...',
}) => {
    const router = useRouter();
    const [isExpanded, setIsExpanded] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Borrower[]>([]);
    const [allBorrowers, setAllBorrowers] = useState<Borrower[]>([]);
    const [loaded, setLoaded] = useState(false);
    const inputRef = useRef<TextInput>(null);

    // Load borrowers once when expanded
    const loadBorrowers = useCallback(async () => {
        if (loaded) return;
        try {
            const fetched = await BaseModelService.fetchActive<Borrower>('borrowers');
            setAllBorrowers(fetched);
            setLoaded(true);
        } catch (e) {
            console.error('[BorrowerSearchBar] Failed to load borrowers:', e);
        }
    }, [loaded]);

    useEffect(() => {
        if (isExpanded && !loaded) {
            loadBorrowers();
        }
    }, [isExpanded, loaded, loadBorrowers]);

    // Filter on query change
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }
        const q = query.toLowerCase();
        const filtered = allBorrowers
            .filter(b => b.id !== currentBorrowerId && b.fullName.toLowerCase().includes(q))
            .slice(0, 8);
        setResults(filtered);
    }, [query, allBorrowers, currentBorrowerId]);

    const handleSelect = (borrower: Borrower) => {
        setIsExpanded(false);
        setQuery('');
        setResults([]);
        Keyboard.dismiss();
        router.push(`/(admin)/borrowers/${borrower.id}`);
    };

    const handleToggle = () => {
        if (isExpanded) {
            setIsExpanded(false);
            setQuery('');
            setResults([]);
            Keyboard.dismiss();
        } else {
            setIsExpanded(true);
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    };

    if (!isExpanded) {
        return (
            <Pressable
                onPress={handleToggle}
                className="flex-row items-center bg-white/10 px-3 py-2 rounded-xl mb-4 border border-gray-200 bg-white"
                style={{ minHeight: 44 }}
            >
                <Ionicons name="search" size={18} color="#94a3b8" />
                <Text className="text-gray-700 ml-2 text-sm font-medium flex-1">{placeholder}</Text>
                <MaterialIcons name="swap-horiz" size={18} color="#94a3b8" />
            </Pressable>
        );
    }

    return (
        <View className="mb-4 z-50" style={{ zIndex: 999 }}>
            {/* Search Input */}
            <View className="flex-row items-center bg-white border-2 border-blue-400 rounded-xl px-3 py-1 shadow-sm">
                <Ionicons name="search" size={18} color="#3b82f6" />
                <TextInput
                    ref={inputRef}
                    className="flex-1 ml-2 text-gray-800 h-10 text-sm"
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Type borrower name..."
                    placeholderTextColor="#94a3b8"
                    autoFocus
                    clearButtonMode="while-editing"
                />
                <Pressable onPress={handleToggle} className="p-1">
                    <MaterialIcons name="close" size={20} color="#9CA3AF" />
                </Pressable>
            </View>

            {/* Results Dropdown */}
            {results.length > 0 && (
                <View
                    className="bg-white border border-gray-200 rounded-xl mt-1 shadow-lg overflow-hidden"
                    style={{ maxHeight: 280, elevation: 8, zIndex: 1000 }}
                >
                    <FlatList
                        data={results}
                        keyExtractor={(item) => item.id}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item, index }) => (
                            <Pressable
                                onPress={() => handleSelect(item)}
                                className={`flex-row items-center px-4 py-3 active:bg-blue-50 ${
                                    index < results.length - 1 ? 'border-b border-gray-50' : ''
                                }`}
                            >
                                <View className="w-9 h-9 rounded-full bg-blue-50 items-center justify-center mr-3">
                                    <Text className="text-blue-700 font-bold text-sm">
                                        {item.fullName.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-sm font-bold text-gray-900">{item.fullName}</Text>
                                    {item.group && (
                                        <Text className="text-[10px] text-gray-700 font-medium uppercase">{item.group}</Text>
                                    )}
                                </View>
                                <MaterialIcons name="arrow-forward" size={16} color="#D1D5DB" />
                            </Pressable>
                        )}
                    />
                </View>
            )}

            {/* No results hint */}
            {query.length > 0 && results.length === 0 && loaded && (
                <View className="bg-white border border-gray-200 rounded-xl mt-1 px-4 py-4 items-center">
                    <Text className="text-gray-700 text-sm font-medium">No borrowers matching "{query}"</Text>
                </View>
            )}
        </View>
    );
};
