import React from 'react';
import { View, Text, Modal, Pressable, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPHP } from '../utils/currency';

interface Props {
    visible: boolean;
    onClose: () => void;
    title: string;
    description: string;
    formula: string;
    value: number | string;
    isCurrency?: boolean;
}

export function MetricInfoDialog({ visible, onClose, title, description, formula, value, isCurrency = true }: Props) {
    return (
        <Modal 
            visible={visible} 
            animationType="fade" 
            transparent={true} 
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-center items-center bg-black/60 px-6">
                <Pressable className="absolute inset-0" onPress={onClose} />
                
                <View className="bg-white rounded-[32px] w-full max-h-[80%] shadow-2xl overflow-hidden">
                    {/* Header */}
                    <View className="bg-blue-50/50 px-6 py-5 flex-row justify-between items-center border-b border-blue-100">
                        <View className="flex-row items-center">
                            <View className="bg-blue-600 p-2 rounded-xl mr-3">
                                <MaterialIcons name="info-outline" size={20} color="#FFF" />
                            </View>
                            <Text className="text-blue-900 font-black text-lg">Metric Detail</Text>
                        </View>
                        <Pressable onPress={onClose} className="bg-white/80 p-2 rounded-full shadow-sm border border-blue-100">
                            <MaterialIcons name="close" size={20} color="#1E3A8A" />
                        </Pressable>
                    </View>

                    <ScrollView className="p-6" showsVerticalScrollIndicator={false}>
                        {/* Title & Value */}
                        <View className="mb-6">
                            <Text className="text-gray-700 font-bold uppercase text-[10px] tracking-widest mb-1">{title}</Text>
                            <Text className="text-gray-900 font-black text-3xl">
                                {isCurrency && typeof value === 'number' ? formatPHP(value) : value}
                            </Text>
                        </View>

                        {/* Description */}
                        <View className="mb-6 bg-gray-50 p-5 rounded-3xl border border-gray-100">
                            <Text className="text-gray-700 font-bold uppercase text-[10px] tracking-wider mb-2">Definition</Text>
                            <Text className="text-gray-700 leading-relaxed font-semibold text-sm">
                                {description}
                            </Text>
                        </View>

                        {/* Formula */}
                        <View className="mb-6 bg-blue-50/30 p-5 rounded-3xl border border-blue-100">
                            <View className="flex-row items-center mb-2">
                                <MaterialIcons name="functions" size={16} color="#2563EB" className="mr-2" />
                                <Text className="text-blue-600 font-bold uppercase text-[10px] tracking-wider">Computation Formula</Text>
                            </View>
                            <Text className="text-blue-900 font-mono text-sm bg-white/60 p-3 rounded-2xl border border-blue-100 overflow-hidden leading-5">
                                {formula}
                            </Text>
                        </View>

                        {/* Note */}
                        <View className="flex-row items-start bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                            <MaterialIcons name="tips-and-updates" size={16} color="#D97706" style={{ marginTop: 2, marginRight: 8 }} />
                            <Text className="text-amber-800 text-[11px] font-medium flex-1">
                                This data is based on the current synchronized state of your local database.
                            </Text>
                        </View>
                    </ScrollView>

                    {/* Footer Button */}
                    <View className="p-6 border-t border-gray-50">
                        <Pressable 
                            onPress={onClose}
                            className="bg-blue-600 py-4 rounded-2xl items-center shadow-lg active:bg-blue-700"
                        >
                            <Text className="text-white font-black uppercase tracking-widest">Understood</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
