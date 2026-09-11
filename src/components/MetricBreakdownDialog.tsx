import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPHP } from '../utils/currency';

export interface BreakdownItem {
    id: string;
    label: string;
    sublabel?: string;
    value: number | string;
    isCurrency?: boolean;
    onPress?: () => void;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    title: string;
    total: number | string;
    isTotalCurrency?: boolean;
    items: BreakdownItem[];
    color: string;
}

export function MetricBreakdownDialog({ visible, onClose, title, total, isTotalCurrency = true, items, color }: Props) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredItems = items.filter(item => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return item.label.toLowerCase().includes(q) || (item.sublabel && item.sublabel.toLowerCase().includes(q));
    });

    const textColorClass = color.includes('text-') ? color : color.replace('bg-', 'text-');

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View className="flex-1 justify-end bg-black/40">
                <Pressable className="absolute inset-0" onPress={onClose} />

                <View className="bg-white rounded-t-3xl min-h-[50%] max-h-[85%] pt-6 pb-8 px-6 shadow-2xl">
                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-1 mr-3">
                            <Text className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">{title}</Text>
                            <View className="flex-row items-baseline">
                                <Text className={`text-3xl font-extrabold ${textColorClass}`}>
                                    {isTotalCurrency && typeof total === 'number' ? formatPHP(total) : total}
                                </Text>
                                <Text className="text-gray-400 text-xs font-semibold ml-3">
                                    ({items.length} {items.length === 1 ? 'item' : 'items'})
                                </Text>
                            </View>
                        </View>
                        <Pressable onPress={onClose} className="bg-gray-100 p-2.5 rounded-full active:bg-gray-200">
                            <MaterialIcons name="close" size={22} color="#4B5563" />
                        </Pressable>
                    </View>

                    {items.length > 5 && (
                        <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2 mb-4 border border-gray-200">
                            <MaterialIcons name="search" size={18} color="#9CA3AF" className="mr-2" />
                            <TextInput
                                className="flex-1 text-xs text-gray-900 font-semibold p-0"
                                placeholder="Search items..."
                                placeholderTextColor="#9CA3AF"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <Pressable onPress={() => setSearchQuery('')}>
                                    <MaterialIcons name="cancel" size={16} color="#9CA3AF" />
                                </Pressable>
                            )}
                        </View>
                    )}

                    <View className="h-px bg-gray-100 mb-2" />

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                        {filteredItems.length === 0 ? (
                            <View className="py-12 items-center justify-center">
                                <MaterialIcons name="inbox" size={36} color="#D1D5DB" />
                                <Text className="text-gray-400 font-medium text-xs mt-2">
                                    {searchQuery ? 'No matching items found.' : 'No data available for this metric.'}
                                </Text>
                            </View>
                        ) : (
                            filteredItems.map((item, idx) => {
                                const ItemWrapper = item.onPress ? Pressable : View;
                                return (
                                    <ItemWrapper
                                        key={item.id}
                                        onPress={item.onPress}
                                        className={`flex-row justify-between items-center py-3.5 px-2 rounded-xl ${
                                            idx < filteredItems.length - 1 ? 'border-b border-gray-100' : ''
                                        } ${item.onPress ? 'active:bg-gray-50' : ''}`}
                                    >
                                        <View className="flex-1 mr-4">
                                            <Text className="text-gray-900 font-bold text-sm">{item.label}</Text>
                                            {!!item.sublabel && <Text className="text-gray-500 text-xs mt-0.5">{item.sublabel}</Text>}
                                        </View>
                                        <View className="flex-row items-center">
                                            <Text className="text-gray-900 font-extrabold text-sm">
                                                {item.isCurrency && typeof item.value === 'number' ? formatPHP(item.value) : item.value}
                                            </Text>
                                            {item.onPress && (
                                                <MaterialIcons name="chevron-right" size={18} color="#9CA3AF" style={{ marginLeft: 4 }} />
                                            )}
                                        </View>
                                    </ItemWrapper>
                                );
                            })
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
