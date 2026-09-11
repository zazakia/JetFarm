import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../../src/store/AuthContext';
import { BorrowerPortalService, BorrowerProfile } from '../../src/services/BorrowerPortalService';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';

export default function BorrowerProfileScreen() {
    const { user, signOut } = useAuth();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<BorrowerProfile | null>(null);

    useEffect(() => {
        const loadData = async () => {
            if (!user) return;
            try {
                const currentProfile = await BorrowerPortalService.getBorrowerProfile(user.id);
                setProfile(currentProfile);
            } catch (error) {
                console.error('[BorrowerProfileScreen] Failed to load profile:', error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [user]);

    const handleSignOut = () => {
        Alert.alert("Sign Out", "Are you sure you want to sign out?", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign Out", style: "destructive", onPress: signOut }
        ]);
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#1E3A8A" />
            </View>
        );
    }

    if (!profile) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 p-6">
                <MaterialIcons name="error-outline" size={64} color="#D1D5DB" />
                <Text className="text-xl font-bold text-gray-900 mt-4 text-center">Profile Not Linked</Text>
                <Text className="text-gray-700 text-center mt-2">
                    Your account is not linked to a borrower profile. Please contact administrators to link your account.
                </Text>
                <Pressable 
                    onPress={handleSignOut}
                    className="mt-8 px-6 py-3 rounded-xl bg-red-50 border border-red-100 flex-row items-center active:bg-red-100"
                >
                    <MaterialIcons name="logout" size={20} color="#EF4444" className="mr-2" />
                    <Text className="text-red-500 font-bold">Sign Out</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 20 }}>
            {/* Profile Header */}
            <Animated.View entering={FadeInUp.duration(400)} className="items-center mb-8">
                <View className="w-24 h-24 rounded-full bg-blue-900 items-center justify-center shadow-lg border-4 border-white mb-4">
                    <Text className="text-white text-3xl font-black">{profile.fullName.charAt(0)}</Text>
                </View>
                <Text className="text-2xl font-black text-gray-900">{profile.fullName}</Text>
                <View className="bg-blue-50 px-3 py-1 rounded-full mt-2">
                    <Text className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Borrower Account</Text>
                </View>
            </Animated.View>

            {/* Account Info */}
            <Animated.View entering={FadeInUp.duration(400).delay(100)} className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 mb-6">
                <Text className="text-xs font-black text-gray-700 uppercase tracking-widest mb-6">Account Information</Text>
                
                <View className="mb-6 flex-row items-center">
                    <View className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center mr-4">
                        <MaterialIcons name="email" size={20} color="#6B7280" />
                    </View>
                    <View>
                        <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest mb-0.5">Email Address</Text>
                        <Text className="text-sm font-bold text-gray-900">{user?.email}</Text>
                    </View>
                </View>

                <View className="mb-6 flex-row items-center">
                    <View className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center mr-4">
                        <MaterialIcons name="phone" size={20} color="#6B7280" />
                    </View>
                    <View>
                        <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest mb-0.5">Phone Number</Text>
                        <Text className="text-sm font-bold text-gray-900">{profile.phone}</Text>
                    </View>
                </View>

                <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center mr-4">
                        <MaterialIcons name="location-on" size={20} color="#6B7280" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest mb-0.5">Home Address</Text>
                        <Text className="text-sm font-bold text-gray-900">{profile.address || 'Not specified'}</Text>
                    </View>
                </View>
            </Animated.View>

            {/* Support Section */}
            <Animated.View entering={FadeInUp.duration(400).delay(200)} className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 mb-8">
                <Text className="text-xs font-black text-gray-700 uppercase tracking-widest mb-6">Support & Privacy</Text>
                
                <Pressable className="flex-row items-center mb-6 active:opacity-60">
                    <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center mr-4">
                        <MaterialIcons name="headset-mic" size={20} color="#1E3A8A" />
                    </View>
                    <Text className="text-sm font-bold text-gray-700 flex-1">Customer Support</Text>
                    <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />
                </Pressable>

                <Pressable className="flex-row items-center active:opacity-60">
                    <View className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center mr-4">
                        <MaterialIcons name="security" size={20} color="#6B7280" />
                    </View>
                    <Text className="text-sm font-bold text-gray-700 flex-1">Privacy Policy</Text>
                    <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />
                </Pressable>
            </Animated.View>

            {/* Logout Button */}
            <Animated.View entering={FadeInUp.duration(400).delay(300)}>
                <Pressable 
                    onPress={handleSignOut}
                    className="w-full py-4 rounded-2xl bg-red-50 border border-red-100 items-center mb-10 flex-row justify-center active:bg-red-100"
                >
                    <MaterialIcons name="logout" size={20} color="#EF4444" className="mr-2" />
                    <Text className="text-red-500 font-extrabold uppercase tracking-widest text-sm">Sign Out</Text>
                </Pressable>
            </Animated.View>
        </ScrollView>
    );
}
