import React from 'react';
import { View, Text, Modal, Pressable, ScrollView, SafeAreaView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export function InfoIcon({ onPress, color = '#9CA3AF' }: { onPress: () => void, color?: string }) {
    return (
        <Pressable 
            onPress={onPress} 
            className="ml-1.5 p-1 active:opacity-50"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
            <MaterialIcons name="info-outline" size={16} color={color} />
        </Pressable>
    );
}

export interface InfoModalContent {
    title: string;
    question: string;
    formula?: string;
    explanation?: string;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    content: InfoModalContent | null;
}

export function ReportInfoModal({ visible, onClose, content }: Props) {
    if (!content) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <SafeAreaView className="flex-1 bg-slate-50">
                <View className="flex-1">
                    {/* Header */}
                    <LinearGradient colors={['#0F172A', '#1E293B']} className="pt-6 pb-6 px-6 rounded-b-[40px] shadow-lg">
                        <View className="flex-row items-center justify-between">
                            <Text className="text-white text-2xl font-black flex-1 mr-4" numberOfLines={2}>
                                {content.title}
                            </Text>
                            <Pressable 
                                onPress={onClose} 
                                className="w-10 h-10 bg-white/10 rounded-full items-center justify-center border border-white/20 active:bg-white/20"
                            >
                                <MaterialIcons name="close" size={24} color="#FFF" />
                            </Pressable>
                        </View>
                    </LinearGradient>

                    <ScrollView className="flex-1 px-6 pt-8 pb-12" showsVerticalScrollIndicator={false}>
                        
                        {/* Question Section */}
                        <View className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6">
                            <View className="flex-row items-center mb-4">
                                <View className="bg-blue-100 w-10 h-10 rounded-2xl items-center justify-center mr-3">
                                    <MaterialIcons name="help-outline" size={20} color="#2563EB" />
                                </View>
                                <Text className="text-slate-900 font-bold text-lg">What does this answer?</Text>
                            </View>
                            <Text className="text-slate-600 leading-6 text-base">{content.question}</Text>
                        </View>

                        {/* Formula Section */}
                        {!!content.formula && (
                            <View className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6">
                                <View className="flex-row items-center mb-4">
                                    <View className="bg-emerald-100 w-10 h-10 rounded-2xl items-center justify-center mr-3">
                                        <MaterialIcons name="calculate" size={20} color="#355E3B" />
                                    </View>
                                    <Text className="text-slate-900 font-bold text-lg">Formula</Text>
                                </View>
                                
                                <View className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mt-2">
                                    <Text className="text-slate-800 font-mono text-sm leading-6">
                                        {content.formula}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Additional Explanation */}
                        {!!content.explanation && (
                            <View className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6">
                                <View className="flex-row items-center mb-4">
                                    <View className="bg-purple-100 w-10 h-10 rounded-2xl items-center justify-center mr-3">
                                        <MaterialIcons name="info-outline" size={20} color="#7C3AED" />
                                    </View>
                                    <Text className="text-slate-900 font-bold text-lg">Detailed Explanation</Text>
                                </View>
                                <Text className="text-slate-600 leading-6 text-base">{content.explanation}</Text>
                            </View>
                        )}

                        <View className="h-20" />
                    </ScrollView>
                </View>
            </SafeAreaView>
        </Modal>
    );
}
