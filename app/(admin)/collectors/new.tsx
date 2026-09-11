import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { safeBack } from '../../../src/utils/navigation';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import UserProfile from '../../../src/database/models/UserProfile';
import Collector from '../../../src/database/models/Collector';
import { MaterialIcons } from '@expo/vector-icons';
import uuid from 'react-native-uuid';
import ActionLogService from '../../../src/services/ActionLogService';


export default function NewCollectorScreen() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!fullName.trim() || !email.trim()) {
            if (Platform.OS === 'web') {
                window.alert("Please enter both full name and email.");
            } else {
                Alert.alert("Error", "Please enter both full name and email.");
            }
            return;
        }

        setSaving(true);
        try {
            // Check for duplicate collector by normalized name
            const normalizedName = fullName.trim().toLowerCase().replace(/\s+/g, ' ');
            const existingCollectors = await database.collections.get<Collector>('collectors').query(
                Q.where('is_active', Q.notEq(false))
            ).fetch();
            const duplicate = existingCollectors.find(c =>
                (c.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ') === normalizedName
            );
            if (duplicate) {
                if (Platform.OS === 'web') {
                    window.alert(`A collector named "${duplicate.fullName}" already exists.`);
                } else {
                    Alert.alert("Duplicate", `A collector named "${duplicate.fullName}" already exists.`);
                }
                setSaving(false);
                return;
            }

            // Check for duplicate email in user_profiles
            const existingUsers = await database.collections.get<UserProfile>('user_profiles').query(
                Q.where('email', email.trim().toLowerCase())
            ).fetch();
            if (existingUsers.length > 0) {
                if (Platform.OS === 'web') {
                    window.alert(`A user with email "${email.trim().toLowerCase()}" already exists.`);
                } else {
                    Alert.alert("Duplicate", `A user with email "${email.trim().toLowerCase()}" already exists.`);
                }
                setSaving(false);
                return;
            }

            await database.write(async () => {
                const batchOps: any[] = [];
                const logs: any[] = [];

                const userId = uuid.v4().toString();
                const newUser = database.collections.get<UserProfile>('user_profiles').prepareCreate(p => {
                    p._raw.id = userId;
                    p.fullName = fullName.trim();
                    p.email = email.trim().toLowerCase();
                    p.role = 'collector';
                    p.isActive = true;
                });
                batchOps.push(newUser);

                logs.push({
                    entityType: 'user_profiles',
                    entityId: userId,
                    action: 'CREATE',
                    newData: { fullName, email: email.toLowerCase(), role: 'collector', isActive: true }
                });

                // Also create in collectors table for assignment logic
                const collectorId = uuid.v4().toString();
                const newCollector = database.collections.get<Collector>('collectors').prepareCreate(c => {
                    c._raw.id = collectorId;
                    c.fullName = fullName.trim();
                    c.authId = userId; // Important: link to user_profile
                    c.isActive = true;
                });
                batchOps.push(newCollector);

                logs.push({
                    entityType: 'collectors',
                    entityId: collectorId,
                    action: 'CREATE',
                    newData: { fullName, authId: userId, isActive: true }
                });

                const auditLogs = await ActionLogService.prepareLogActions(logs);
                await database.batch(...batchOps, ...auditLogs);
            });


            if (Platform.OS === 'web') {
                window.alert("Collector profile created.");
            } else {
                Alert.alert("Success", "Collector profile created.");
            }
            safeBack(router, '/(admin)');
        } catch (error) {
            console.error('Failed to create collector', error);
            if (Platform.OS === 'web') {
                window.alert("Failed to create profile.");
            } else {
                Alert.alert("Error", "Failed to create profile.");
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView  className="flex-1 bg-gray-50"  contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <Text className="text-xl font-extrabold text-gray-900 mb-6">Register New Collector</Text>

                <View className="mb-5">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Full Name *</Text>
                    <TextInput
                        className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 font-bold"
                        value={fullName} onChangeText={setFullName} editable={!saving}
                        placeholder="e.g. Juan De La Cruz"
                     placeholderTextColor="#9CA3AF"/>
                </View>

                <View className="mb-5">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Email Address *</Text>
                    <TextInput
                        className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 font-bold"
                        value={email} onChangeText={setEmail} editable={!saving}
                        placeholder="collector@poscursor.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                     placeholderTextColor="#9CA3AF"/>
                </View>

                <View className="mb-8">
                    <Text className="text-[10px] text-gray-700 mt-2 font-medium">
                        Note: This creates a database profile. The email will be used for Quick Login on the sign-in screen.
                    </Text>
                </View>

                <Pressable
                    className={`w-full py-4 rounded-xl items-center flex-row justify-center ${saving ? 'bg-blue-300' : 'bg-blue-900 active:bg-blue-900'}`}
                    onPress={handleSave} disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : (
                        <>
                            <MaterialIcons name="how-to-reg" size={24} color="#fff" className="mr-2" />
                            <Text className="text-white font-black text-xl uppercase tracking-wider">Register Agent</Text>
                        </>
                    )}
                </Pressable>
            </View>
        </ScrollView>
    );
}
