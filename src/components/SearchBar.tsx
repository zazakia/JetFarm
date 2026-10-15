import React, { useEffect, useRef } from 'react';
import { View, TextInput, Pressable, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface SearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    onClear?: () => void;
    categories?: string[];
    selectedCategory?: string;
    onSelectCategory?: (category: string) => void;
    debounceMs?: number;
    onDebouncedChangeText?: (text: string) => void;
    testID?: string;
    className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    value,
    onChangeText,
    placeholder = 'Search...',
    onClear,
    categories,
    selectedCategory = 'All',
    onSelectCategory,
    debounceMs = 0,
    onDebouncedChangeText,
    testID = 'search-bar',
    className = '',
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
        if (onClear) onClear();
    };

    return (
        <View testID={testID} className={`my-2 ${className}`}>
            <View className="flex-row items-center bg-white border border-gray-200 rounded-2xl px-4 py-2 shadow-sm">
                <Ionicons name="search" size={20} color="#94A3B8" />
                <TextInput
                    className="flex-1 ml-2 text-gray-900 h-10 font-medium text-sm"
                    value={value}
                    onChangeText={handleChangeText}
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    clearButtonMode="while-editing"
                    accessibilityLabel={placeholder}
                />
                {Boolean(value && value.length > 0) && (
                    <Pressable
                        onPress={handleClear}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        className="p-1 ml-1"
                        testID="clear-search-button"
                        accessibilityLabel="Clear search text"
                    >
                        <Ionicons name="close-circle" size={20} color="#94A3B8" />
                    </Pressable>
                )}
            </View>

            {/* Optional category pills */}
            {categories && categories.length > 0 && (
                <View className="mt-2">
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {categories.map((category) => {
                            const isSelected =
                                (selectedCategory || 'All').toLowerCase() === category.toLowerCase();
                            return (
                                <Pressable
                                    key={category}
                                    onPress={() => onSelectCategory && onSelectCategory(category)}
                                    className={`mr-2 px-3 py-1 rounded-full border ${
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
