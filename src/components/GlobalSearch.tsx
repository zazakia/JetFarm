import React, { useState, useEffect } from 'react';
import { View, TextInput, Text, Pressable, FlatList, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Borrower from '../database/models/Borrower';
import BaseModelService from '../services/BaseModelService';
import {
    CRISPY_KING_OPERATIONS,
    FRANCHISE_MENU,
    LENDING_MENU,
    MAIN_MENU,
    ADMIN_MENU,
    DAILY_REPORTS,
    WEEKLY_REPORTS,
    MONTHLY_REPORTS,
    COOPERATIVE_REPORTS,
    FINANCIALS_MENU,
    ACCOUNTING_MENU,
    BOOKS_OF_ACCOUNTS_MENU,
    SUPPORT_MENU
} from './SidebarContent';

type SearchResultItem = {
    id: string;
    title: string;
    subtitle?: string;
    type: 'menu' | 'borrower';
    route: string;
    icon?: string;
};

export const GlobalSearch = ({ onNavigate }: { onNavigate?: () => void }) => {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResultItem[]>([]);
    const [borrowers, setBorrowers] = useState<Borrower[]>([]);
    const [isFocused, setIsFocused] = useState(false);

    // All available menus to search from
    const allMenus = [
        ...CRISPY_KING_OPERATIONS,
        ...FRANCHISE_MENU,
        ...LENDING_MENU,
        ...MAIN_MENU,
        ...ADMIN_MENU,
        ...DAILY_REPORTS,
        ...WEEKLY_REPORTS,
        ...MONTHLY_REPORTS,
        ...COOPERATIVE_REPORTS,
        ...FINANCIALS_MENU,
        ...ACCOUNTING_MENU,
        ...BOOKS_OF_ACCOUNTS_MENU,
        ...SUPPORT_MENU
    ];

    // Pre-fetch borrowers (only once)
    useEffect(() => {
        const fetchBorrowers = async () => {
            try {
                const fetched = await BaseModelService.fetchActive<Borrower>('borrowers');
                setBorrowers(fetched);
            } catch (e) {
                console.error('[GlobalSearch] Failed to load borrowers:', e);
            }
        };
        fetchBorrowers();
    }, []);

    // Filter results on query change
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }
        
        const q = query.toLowerCase();
        const matchedMenus: SearchResultItem[] = allMenus
            .filter(m => m.label.toLowerCase().includes(q))
            .map(m => ({
                id: `menu_${m.route}`,
                title: m.label,
                subtitle: 'Menu / Report',
                type: 'menu',
                route: m.route,
                icon: m.icon
            }));

        const matchedBorrowers: SearchResultItem[] = borrowers
            .filter(b => b.fullName.toLowerCase().includes(q))
            .slice(0, 5) // Limit borrowers to avoid overwhelming
            .map(b => ({
                id: `borrower_${b.id}`,
                title: b.fullName,
                subtitle: b.group ? `Borrower • ${b.group}` : 'Borrower',
                type: 'borrower',
                route: `/(admin)/borrowers/${b.id}`,
                icon: 'person'
            }));

        setResults([...matchedMenus, ...matchedBorrowers]);
    }, [query, borrowers]);

    const handleSelect = (item: SearchResultItem) => {
        setQuery('');
        setResults([]);
        setIsFocused(false);
        Keyboard.dismiss();
        router.push(item.route as any);
        if (onNavigate) {
            onNavigate();
        }
    };

    return (
        <View className="mb-4 z-50 mx-4" style={{ zIndex: 1000 }}>
            {/* Search Input Box */}
            <View className={`flex-row items-center bg-black/20 rounded-xl px-3 py-2 border ${isFocused ? 'border-white/30' : 'border-transparent'}`}>
                <Ionicons name="search" size={18} color="#9CA3AF" />
                <TextInput
                    className="flex-1 ml-2 text-white text-sm h-8"
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search menus & reports..."
                    placeholderTextColor="#9CA3AF"
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => {
                        // slight delay to allow pressing results before closing
                        setTimeout(() => setIsFocused(false), 200);
                    }}
                    clearButtonMode="while-editing"
                />
                {query.length > 0 && (
                    <Pressable onPress={() => setQuery('')} className="p-1">
                        <MaterialIcons name="close" size={16} color="#9CA3AF" />
                    </Pressable>
                )}
            </View>

            {/* Dropdown Results */}
            {isFocused && query.length > 0 && (
                <View className="absolute top-14 left-0 right-0 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden max-h-72">
                    {results.length > 0 ? (
                        <FlatList
                            data={results}
                            keyExtractor={item => item.id}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item, index }) => (
                                <Pressable
                                    onPress={() => handleSelect(item)}
                                    className={`flex-row items-center px-4 py-3 active:bg-blue-50 ${
                                        index < results.length - 1 ? 'border-b border-gray-100' : ''
                                    }`}
                                >
                                    <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${item.type === 'borrower' ? 'bg-blue-100' : 'bg-green-100'}`}>
                                        <MaterialIcons name={item.icon as any || 'chevron-right'} size={18} color={item.type === 'borrower' ? '#1D4ED8' : '#15803D'} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-sm font-bold text-gray-900">{item.title}</Text>
                                        <Text className="text-xs text-gray-500 mt-0.5">{item.subtitle}</Text>
                                    </View>
                                    <MaterialIcons name="arrow-forward-ios" size={12} color="#D1D5DB" />
                                </Pressable>
                            )}
                        />
                    ) : (
                        <View className="px-4 py-4 items-center">
                            <Text className="text-gray-500 text-sm">No results found for "{query}"</Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};
