import React from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchBarProps {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    onClear?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChangeText, placeholder = "Search...", onClear }) => {
    const handleClear = () => {
        onChangeText('');
        if (onClear) onClear();
    };

    return (
        <View className="flex-row items-center bg-white border border-gray-200 rounded-2xl px-4 py-2 my-2 shadow-sm">
            <Ionicons name="search" size={20} color="#94a3b8" />
            <TextInput
                className="flex-1 ml-2 text-gray-700 h-10"
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#94a3b8"
                clearButtonMode="while-editing"
            />
            {Boolean(value && value.length > 0) && (
                <Pressable
                    onPress={handleClear}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    className="p-1 ml-1"
                    testID="clear-search-button"
                    accessibilityLabel="Clear search text"
                >
                    <Ionicons name="close-circle" size={20} color="#94a3b8" />
                </Pressable>
            )}
        </View>
    );
};

