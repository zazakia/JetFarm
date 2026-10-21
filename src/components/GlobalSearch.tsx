import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, TextInput, Text, Pressable, FlatList, Keyboard, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import BaseModelService from '../services/BaseModelService';
import {
    AGRIBUSINESS_MENU,
    FINANCIAL_REPORTS_MENU,
    MAIN_MENU,
    ADMIN_MENU,
    FINANCIALS_MENU,
    ACCOUNTING_MENU,
    BOOKS_OF_ACCOUNTS_MENU,
    SUPPORT_MENU
} from './SidebarContent';
import { flexibleSearch, highlightMatches } from '../utils/flexibleSearch';
import { formatPHP } from '../utils/currency';

// Borrower and loan search went with those tables; the two entity categories left are the ones
// with a WatermelonDB model on this branch.
export type SearchCategoryType = 'all' | 'menu' | 'parcel' | 'expense';

export interface SearchResultItem {
    id: string;
    title: string;
    subtitle?: string;
    type: 'menu' | 'parcel' | 'expense';
    route: string;
    icon?: string;
    badge?: string;
    amount?: number;
    metadata?: string;
}

export interface GlobalSearchProps {
    onNavigate?: () => void;
    placeholder?: string;
    showCategoryChips?: boolean;
    initialCategory?: SearchCategoryType;
    modalMode?: boolean;
    autoFocus?: boolean;
}

const CATEGORY_TABS: Array<{ id: SearchCategoryType; label: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
    { id: 'all', label: 'All', icon: 'search' },
    { id: 'menu', label: 'Menus', icon: 'menu' },
    { id: 'parcel', label: 'Parcels', icon: 'landscape' },
    { id: 'expense', label: 'Expenses', icon: 'receipt' },
];

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
    onNavigate,
    placeholder = 'Search menus & reports...',
    showCategoryChips = true,
    initialCategory = 'all',
    autoFocus = false,
}) => {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<SearchCategoryType>(initialCategory);
    const [isFocused, setIsFocused] = useState(false);

    // Dynamic data states
    const [parcels, setParcels] = useState<any[]>([]);
    const [expenses, setExpenses] = useState<any[]>([]);
    const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // All available system menus
    const allMenus = useMemo(() => {
        return [
            ...AGRIBUSINESS_MENU,
            ...FINANCIAL_REPORTS_MENU,
            ...MAIN_MENU,
            ...ADMIN_MENU,
            ...FINANCIALS_MENU,
            ...ACCOUNTING_MENU,
            ...BOOKS_OF_ACCOUNTS_MENU,
            ...SUPPORT_MENU
        ];
    }, []);

    // Load searchable entities from local database
    useEffect(() => {
        let isMounted = true;
        const loadAllEntities = async () => {
            // 1. Agribusiness Parcels
            try {
                const fetched = await BaseModelService.fetchActive<any>('agri_parcels');
                if (isMounted && Array.isArray(fetched)) {
                    setParcels(fetched.filter(p => p && (p.name && (p.areaHectares !== undefined || p.soilType !== undefined))));
                }
            } catch {
                // Table might be absent or empty in test environments
            }

            // 2. Farm Expenses
            try {
                const fetched = await BaseModelService.fetchActive<any>('agri_farm_expenses');
                if (isMounted && Array.isArray(fetched)) {
                    setExpenses(fetched.filter(e => e && (e.description && e.amount !== undefined)));
                }
            } catch {
                // Table might be absent or empty in test environments
            }
        };

        loadAllEntities();

        return () => {
            isMounted = false;
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
            }
        };
    }, []);

    // Build flattened search dataset
    const searchableItems = useMemo<SearchResultItem[]>(() => {
        const items: SearchResultItem[] = [];

        // Menus
        allMenus.forEach(m => {
            items.push({
                id: `menu_${m.route}`,
                title: m.label,
                subtitle: 'Menu / Report',
                type: 'menu',
                route: m.route,
                icon: m.icon,
                badge: 'Navigation',
            });
        });

        // Parcels
        parcels.forEach(p => {
            const haText = p.areaHectares ? `${p.areaHectares} ha` : '';
            items.push({
                id: `parcel_${p.id}`,
                title: p.name || 'Agri Parcel',
                subtitle: `Land Parcel • ${haText} ${p.soilType ? `• ${p.soilType}` : ''}`.trim(),
                type: 'parcel',
                route: `/(admin)/agribusiness/parcels`,
                icon: 'landscape',
                badge: p.status || 'Parcel',
                metadata: p.code ? `Code: ${p.code}` : undefined,
            });
        });

        // Farm Expenses
        expenses.forEach(e => {
            const amountStr = e.amount ? formatPHP(e.amount) : '';
            items.push({
                id: `expense_${e.id}`,
                title: e.description || 'Farm Expense',
                subtitle: `Expense • ${amountStr} • ${e.category || 'Farm Input'}`,
                type: 'expense',
                route: `/(admin)/agribusiness/expenses`,
                icon: 'receipt',
                badge: e.category || 'Expense',
                amount: e.amount,
            });
        });

        return items;
    }, [allMenus, parcels, expenses]);

    // Perform flexible multi-token search with scoring
    const searchResults = useMemo<SearchResultItem[]>(() => {
        if (!query.trim()) return [];

        const filtered = flexibleSearch(searchableItems, query, {
            keys: [
                { key: 'title', weight: 5 },
                { key: 'subtitle', weight: 2 },
                { key: 'badge', weight: 2 },
                { key: 'metadata', weight: 2 },
            ],
            matchMode: 'all',
            sortBy: 'relevance',
        }).map(res => res.item);

        return filtered;
    }, [searchableItems, query]);

    // Category Counts for Badges
    const categoryCounts = useMemo(() => {
        const counts: Record<SearchCategoryType, number> = {
            all: searchResults.length,
            menu: 0,
            parcel: 0,
            expense: 0,
        };

        searchResults.forEach(item => {
            if (counts[item.type] !== undefined) {
                counts[item.type]++;
            }
        });

        return counts;
    }, [searchResults]);

    // Displayed items filtered by selected category tab
    const displayedResults = useMemo(() => {
        if (selectedCategory === 'all') {
            return searchResults;
        }
        return searchResults.filter(item => item.type === selectedCategory);
    }, [searchResults, selectedCategory]);

    const handleSelect = (item: SearchResultItem) => {
        setQuery('');
        setIsFocused(false);
        Keyboard.dismiss();
        router.push(item.route as any);
        if (onNavigate) {
            onNavigate();
        }
    };

    const getTypeColor = (type: SearchResultItem['type']) => {
        switch (type) {
            case 'parcel':
                return { bg: 'bg-emerald-100', text: 'text-emerald-700', iconColor: '#047857' };
            case 'expense':
                return { bg: 'bg-purple-100', text: 'text-purple-700', iconColor: '#7E22CE' };
            case 'menu':
            default:
                return { bg: 'bg-green-100', text: 'text-green-700', iconColor: '#15803D' };
        }
    };

    return (
        <View className="mb-4 z-50 mx-4" style={{ zIndex: 1000 }}>
            {/* Search Input Box */}
            <View
                className={`flex-row items-center bg-black/20 rounded-xl px-3 py-2 border ${
                    isFocused ? 'border-white/30' : 'border-transparent'
                }`}
            >
                <Ionicons name="search" size={18} color="#9CA3AF" />
                <TextInput
                    className="flex-1 ml-2 text-white text-sm h-8 font-medium"
                    value={query}
                    onChangeText={setQuery}
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    autoFocus={autoFocus}
                    onFocus={() => {
                        if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
                        setIsFocused(true);
                    }}
                    onBlur={() => {
                        // Delay closing to allow tapping results
                        blurTimeoutRef.current = setTimeout(() => setIsFocused(false), 250);
                    }}
                    clearButtonMode="while-editing"
                    accessibilityLabel={placeholder}
                />
                {query.length > 0 && (
                    <Pressable
                        onPress={() => setQuery('')}
                        className="p-1 rounded-full active:bg-white/10"
                        testID="global-search-clear"
                        accessibilityLabel="Clear search"
                    >
                        <MaterialIcons name="close" size={16} color="#9CA3AF" />
                    </Pressable>
                )}
            </View>

            {/* Dropdown Results Window */}
            {isFocused && query.length > 0 && (
                <View className="absolute top-14 left-0 right-0 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-96 z-50">
                    {/* Category Filter Chips Carousel */}
                    {showCategoryChips && searchResults.length > 0 && (
                        <View className="bg-gray-50 border-b border-gray-100 py-2 px-2">
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {CATEGORY_TABS.map(tab => {
                                    const count = categoryCounts[tab.id];
                                    const isSelected = selectedCategory === tab.id;
                                    return (
                                        <Pressable
                                            key={tab.id}
                                            onPress={() => setSelectedCategory(tab.id)}
                                            className={`flex-row items-center px-2.5 py-1 rounded-lg mr-1.5 border ${
                                                isSelected
                                                    ? 'bg-blue-900 border-blue-900'
                                                    : 'bg-white border-gray-200 active:bg-gray-100'
                                            }`}
                                        >
                                            <MaterialIcons
                                                name={tab.icon}
                                                size={13}
                                                color={isSelected ? '#FFFFFF' : '#64748B'}
                                                className="mr-1"
                                            />
                                            <Text
                                                className={`text-[11px] font-bold ${
                                                    isSelected ? 'text-white' : 'text-gray-700'
                                                }`}
                                            >
                                                {tab.label}
                                            </Text>
                                            {count > 0 && (
                                                <View
                                                    className={`ml-1 px-1.5 py-0.2 rounded-full ${
                                                        isSelected ? 'bg-white/20' : 'bg-gray-200'
                                                    }`}
                                                >
                                                    <Text
                                                        className={`text-[9px] font-bold ${
                                                            isSelected ? 'text-white' : 'text-gray-600'
                                                        }`}
                                                    >
                                                        {count}
                                                    </Text>
                                                </View>
                                            )}
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    {/* Results List */}
                    {displayedResults.length > 0 ? (
                        <FlatList
                            data={displayedResults}
                            keyExtractor={item => item.id}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item, index }) => {
                                const colors = getTypeColor(item.type);
                                const titleSegments = highlightMatches(item.title, query);

                                return (
                                    <Pressable
                                        onPress={() => handleSelect(item)}
                                        className={`flex-row items-center px-4 py-3 active:bg-blue-50 ${
                                            index < displayedResults.length - 1
                                                ? 'border-b border-gray-100'
                                                : ''
                                        }`}
                                    >
                                        {/* Icon Avatar */}
                                        <View
                                            className={`w-9 h-9 rounded-xl items-center justify-center mr-3 ${colors.bg}`}
                                        >
                                            <MaterialIcons
                                                name={(item.icon as any) || 'chevron-right'}
                                                size={20}
                                                color={colors.iconColor}
                                            />
                                        </View>

                                        {/* Info */}
                                        <View className="flex-1 pr-2">
                                            <View className="flex-row items-center justify-between">
                                                <Text
                                                    className="text-sm font-bold text-gray-900 flex-1"
                                                    numberOfLines={1}
                                                >
                                                    {item.title}
                                                </Text>
                                                {item.badge && (
                                                    <View
                                                        className={`ml-2 px-1.5 py-0.5 rounded-md ${colors.bg}`}
                                                    >
                                                        <Text
                                                            className={`text-[10px] font-bold uppercase tracking-wider ${colors.text}`}
                                                        >
                                                            {item.badge}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            {item.subtitle && (
                                                <Text
                                                    className="text-xs text-gray-500 mt-0.5"
                                                    numberOfLines={1}
                                                >
                                                    {item.subtitle}
                                                </Text>
                                            )}
                                        </View>

                                        {/* Arrow Navigation Indicator */}
                                        <MaterialIcons
                                            name="arrow-forward-ios"
                                            size={12}
                                            color="#D1D5DB"
                                        />
                                    </Pressable>
                                );
                            }}
                        />
                    ) : (
                        <View className="px-4 py-6 items-center justify-center">
                            <MaterialIcons name="search-off" size={28} color="#9CA3AF" />
                            <Text className="text-gray-500 text-sm mt-1 font-medium">
                                No results found for "{query}"
                            </Text>
                            {selectedCategory !== 'all' && (
                                <Pressable
                                    onPress={() => setSelectedCategory('all')}
                                    className="mt-2 px-3 py-1 bg-gray-100 rounded-full"
                                >
                                    <Text className="text-xs text-blue-900 font-semibold">
                                        Search in All Categories
                                    </Text>
                                </Pressable>
                            )}
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};

export interface GlobalSearchModalProps {
    visible: boolean;
    onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ visible, onClose }) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/60 p-4 pt-12 items-center justify-start">
                <Pressable className="absolute inset-0" onPress={onClose} />
                <View className="w-full max-w-xl bg-blue-900 rounded-3xl p-4 shadow-2xl z-50 border border-blue-700/50">
                    <View className="flex-row items-center justify-between mb-3 px-2">
                        <View className="flex-row items-center">
                            <Ionicons name="sparkles" size={18} color="#60A5FA" />
                            <Text className="text-white font-black text-base ml-2">Quick Search</Text>
                        </View>
                        <Pressable
                            onPress={onClose}
                            className="p-1.5 rounded-full active:bg-white/10"
                            accessibilityLabel="Close search"
                        >
                            <MaterialIcons name="close" size={20} color="#9CA3AF" />
                        </Pressable>
                    </View>
                    <GlobalSearch onNavigate={onClose} autoFocus />
                </View>
            </View>
        </Modal>
    );
};

