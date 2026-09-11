import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, TextInput, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { safeBack } from '../../../src/utils/navigation';
import ConfirmDialog from '../../../src/components/ConfirmDialog';
import { database } from '../../../src/database';
import Collector from '../../../src/database/models/Collector';
import { MaterialIcons } from '@expo/vector-icons';
import BaseModelService from '../../../src/services/BaseModelService';

export default function CollectorDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const [profile, setProfile] = useState<Collector | null>(null);
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isConfirmDeleteVisible, setIsConfirmDeleteVisible] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const p = await database.collections.get<Collector>('collectors').find(id);
                setProfile(p);
                setFullName(p.fullName);
            } catch (e) {
                safeBack(router, '/(admin)');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const handleUpdate = async () => {
        if (!profile || !fullName.trim()) return;
        setSaving(true);
        try {
            await BaseModelService.update(profile, p => {
                p.fullName = fullName.trim();
            });

            if (Platform.OS === 'web') {
                window.alert("Profile updated.");
            } else {
                Alert.alert("Success", "Profile updated.");
            }
        } catch (e) {
            if (Platform.OS === 'web') {
                window.alert("Failed to update profile.");
            } else {
                Alert.alert("Error", "Failed to update profile.");
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!profile) return;
        if (Platform.OS === 'web') {
            setIsConfirmDeleteVisible(true);
        } else {
            Alert.alert("Confirm Delete", "Are you sure you want to remove this profile?", [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: confirmDelete
                }
            ]);
        }
    };

    const confirmDelete = async () => {
        if (!profile) return;
        setIsConfirmDeleteVisible(false);
        try {
            await BaseModelService.softDelete(profile);

            safeBack(router, '/(admin)');
        } catch (e) {
            if (Platform.OS === 'web') {
                window.alert("Could not delete profile.");
            } else {
                Alert.alert("Error", "Could not delete profile.");
            }
        }
    };

    if (loading || !profile) return <ActivityIndicator className="flex-1" />;

    return (
        <ScrollView  className="flex-1 bg-gray-50"  contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <View className="items-center mb-8">
                    <View className="w-24 h-24 rounded-full bg-blue-100 items-center justify-center mb-4">
                        <Text className="text-blue-700 font-bold text-3xl">{profile.fullName.charAt(0)}</Text>
                    </View>
                    <Text className="text-2xl font-black text-gray-900">{profile.fullName}</Text>
                    <Text className="text-gray-700 font-bold uppercase tracking-widest text-xs mt-1">Field Agent</Text>
                </View>

                <View className="mb-6">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Full Name</Text>
                    <TextInput
                        className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 font-bold"
                        value={fullName} onChangeText={setFullName} editable={!saving}
                    />
                </View>

                <View className="flex-row items-center justify-between mb-8 bg-gray-50 p-4 rounded-xl">
                    <Text className="text-gray-700 font-medium">Status</Text>
                    <View className="flex-row items-center">
                        <View className={`w-2 h-2 rounded-full mr-2 ${profile.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                        <Text className="font-bold text-gray-900">{profile.isActive ? 'Active' : 'Inactive'}</Text>
                    </View>
                </View>

                <Pressable
                    className={`w-full py-4 rounded-xl items-center flex-row justify-center mb-4 ${saving ? 'bg-blue-300' : 'bg-blue-900'}`}
                    onPress={handleUpdate} disabled={saving}
                >
                    <MaterialIcons name="check" size={20} color="#fff" className="mr-2" />
                    <Text className="text-white font-bold text-lg uppercase">Update Profile</Text>
                </Pressable>

                <Pressable
                    className="w-full py-4 rounded-xl items-center flex-row justify-center"
                    onPress={handleDelete}
                >
                    <Text className="text-red-500 font-bold">Remove Collector</Text>
                </Pressable>
            </View>

            <ConfirmDialog
                visible={isConfirmDeleteVisible}
                title="Confirm Delete"
                message="Are you sure you want to remove this profile?"
                onConfirm={confirmDelete}
                onCancel={() => setIsConfirmDeleteVisible(false)}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                isDestructive
            />
        </ScrollView>
    );
}
