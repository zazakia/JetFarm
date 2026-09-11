import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, Pressable, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function BorrowerDocumentsScreen() {
    const router = useRouter();
    const [documents, setDocuments] = useState<{ id: string, name: string, status: string, type: string }[]>([
        { id: '1', name: 'Valid Government ID', status: 'verified', type: 'id' },
        { id: '2', name: 'Proof of Billing', status: 'pending', type: 'billing' },
    ]);

    const handleUpload = () => {
        Alert.alert(
            "Upload Document", 
            "Device file picker would open here. This feature is pending Supabase Storage integration.",
            [{ text: "OK" }]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <View className="px-6 pt-10 pb-4 bg-white border-b border-gray-200 shadow-sm flex-row items-center">
                <Pressable onPress={() => router.back()} className="mr-4 p-2 rounded-full active:bg-gray-100">
                    <MaterialIcons name="arrow-back" size={24} color="#111827" />
                </Pressable>
                <View>
                    <Text className="text-2xl font-black text-gray-900">Documents</Text>
                    <Text className="text-gray-500 text-sm mt-1">Manage your uploaded requirements</Text>
                </View>
            </View>

            <ScrollView className="flex-1 p-6">
                <Pressable 
                    onPress={handleUpload}
                    className="bg-orange-50 border border-dashed border-orange-300 rounded-2xl p-8 items-center justify-center mb-8 active:bg-orange-100"
                >
                    <View className="w-16 h-16 bg-white rounded-full items-center justify-center mb-4 shadow-sm">
                        <MaterialIcons name="cloud-upload" size={32} color="#C2410C" />
                    </View>
                    <Text className="text-orange-900 font-bold text-lg mb-1">Upload New Document</Text>
                    <Text className="text-orange-700 text-xs text-center">
                        Tap to browse files or take a photo of your ID or proof of income.
                    </Text>
                </Pressable>

                <Text className="font-bold text-gray-700 uppercase text-xs mb-4">My Files</Text>
                
                {documents.map(doc => (
                    <View key={doc.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-3 flex-row items-center">
                        <View className="w-12 h-12 bg-gray-50 rounded-xl items-center justify-center mr-4">
                            <MaterialIcons 
                                name={doc.type === 'id' ? 'badge' : 'receipt'} 
                                size={24} 
                                color="#6B7280" 
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="font-bold text-gray-900 text-base">{doc.name}</Text>
                            <View className="flex-row items-center mt-1">
                                <View className={`w-2 h-2 rounded-full mr-1.5 ${
                                    doc.status === 'verified' ? 'bg-green-500' : 'bg-yellow-500'
                                }`} />
                                <Text className="text-xs text-gray-600 capitalize">{doc.status}</Text>
                            </View>
                        </View>
                        <Pressable className="p-2 active:bg-gray-100 rounded-full">
                            <MaterialIcons name="more-vert" size={20} color="#9CA3AF" />
                        </Pressable>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}
