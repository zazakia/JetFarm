import React, { useEffect, useRef } from 'react';
import { View, TextInput, Pressable, Text, ScrollView } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

export interface DynamicSearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    categories?: string[];
    selectedCategory?: string;
    onSelectCategory?: (category: string) => void;
    onClear?: () => void;
    debounceMs?: number;
    onDebouncedChangeText?: (text: string) => void;
    showFilterButton?: boolean;
    filterBadgeCount?: number;
    onFilterPress?: () => void;
    testID?: string;
    className?: string;
    autoFocus?: boolean;
}

export const DynamicSearchBar: React.FC<DynamicSearchBarProps> = ({
    value,
    onChangeText,
    placeholder = 'Search...',
    categories,
    selectedCategory = 'All',
    onSelectCategory,
    onClear,
    debounceMs = 0,
    onDebouncedChangeText,
    showFilterButton = false,
    filterBadgeCount = 0,
    onFilterPress,
    testID = 'dynamic-search-bar',
    className = '',
    autoFocus = false,
}) => {
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    const handleChangeText = (text: string) => {
        onChangeText(text);

        if (onDebouncedChangeText) {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            if (debounceMs <= 0 || text === '') {
                onDebouncedChangeText(text);
            } else {
                debounceTimerRef.current = setTimeout(() => {
                    onDebouncedChangeText(text);
                }, debounceMs);
            }
        }
    };

    const handleClear = () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        onChangeText('');
        if (onDebouncedChangeText) {
            onDebouncedChangeText('');
        }
        if (onClear) {
            onClear();
        }
    };

    return (
        <View testID={testID} className={`my-2 ${className}`}>
            {/* Search Input Container */}
            <View className="flex-row items-center bg-white border border-gray-200 rounded-2xl px-4 py-1.5 shadow-sm">
                <Ionicons name="search" size={20} color="#94A3B8" />
                <TextInput
                    className="flex-1 ml-2 text-gray-900 h-10 text-sm font-medium"
                    value={value}
                    onChangeText={handleChangeText}
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    clearButtonMode="never"
                    autoFocus={autoFocus}
                    accessibilityLabel={placeholder}
                />

                {/* Clear Button */}
                {Boolean(value && value.length > 0) && (
                    <Pressable
                        onPress={handleClear}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        className="p-1 ml-1 rounded-full active:bg-gray-100"
                        testID="dynamic-search-clear"
                        accessibilityLabel="Clear search text"
                    >
                        <Ionicons name="close-circle" size={20} color="#94A3B8" />
                    </Pressable>
                )}

                {/* Optional Filter Toggle Button */}
                {showFilterButton && (
                    <Pressable
                        onPress={onFilterPress}
                        testID="dynamic-search-filter-button"
                        accessibilityLabel="Filter options"
                        className={`flex-row items-center ml-2 pl-2 border-l border-gray-200 py-1 ${
                            filterBadgeCount > 0 ? 'bg-blue-50 px-2 rounded-lg' : ''
                        }`}
                    >
                        <MaterialIcons
                            name="tune"
                            size={18}
                            color={filterBadgeCount > 0 ? '#1E3A8A' : '#64748B'}
                        />
                        {filterBadgeCount > 0 && (
                            <View className="ml-1 bg-blue-900 rounded-full px-1.5 py-0.2 items-center justify-center">
                                <Text className="text-white text-[10px] font-bold">
                                    {filterBadgeCount}
                                </Text>
                            </View>
                        )}
                    </Pressable>
                )}
            </View>

            {/* Dynamic Category Chips Carousel */}
            {categories && categories.length > 0 && (
                <View className="mt-2.5">
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 2 }}
                    >
                        {categories.map((category) => {
                            const isSelected =
                                (selectedCategory || 'All').toLowerCase() === category.toLowerCase();
                            return (
                                <Pressable
                                    key={category}
                                    onPress={() => onSelectCategory && onSelectCategory(category)}
                                    className={`mr-2 px-3.5 py-1.5 rounded-full border ${
                                        isSelected
                                            ? 'bg-blue-900 border-blue-900'
                                            : 'bg-gray-100 border-gray-200 active:bg-gray-200'
                                    }`}
                                >
                                    <Text
                                        className={`text-xs font-semibold ${
                                            isSelected ? 'text-white' : 'text-gray-700'
                                        }`}
                                    >
                                        {category}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>
            )}
        </View>
    );
};
