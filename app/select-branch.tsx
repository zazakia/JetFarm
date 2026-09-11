import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../src/store/AuthContext';
import { ROLE_LABELS, UserRole } from '../src/constants/roles';
import { database } from '../src/database';
import Branch from '../src/database/models/Branch';

export default function SelectBranchScreen() {
    const router = useRouter();
    const { user, role, branchId, userBranchRoles, switchBranchContext } = useAuth();
    const [allBranches, setAllBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(false);
    const [switchingId, setSwitchingId] = useState<string | null>(null);

    const isAdminOrHQ = role === 'admin' || role === 'main_office' || role === 'executive';

    useEffect(() => {
        const loadBranches = async () => {
            if (!isAdminOrHQ) return;
            setLoading(true);
            try {
                if (database && database.collections) {
                    const branches = await database.get<Branch>('branches').query().fetch();
                    setAllBranches(branches);
                }
            } catch (err) {
                console.warn('[SelectBranchScreen] Error loading branches:', err);
            } finally {
                setLoading(false);
            }
        };
        loadBranches();
    }, [isAdminOrHQ]);

    const handleSelectBranch = async (targetBranchId: string, targetRole?: string) => {
        setSwitchingId(targetBranchId);
        try {
            await switchBranchContext(targetBranchId, targetRole);
        } finally {
            setSwitchingId(null);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <StatusBar barStyle="dark-content" />
            <View className="px-6 py-4 bg-white border-b border-gray-200 flex-row items-center justify-between">
                <View>
                    <Text className="text-xl font-bold text-gray-900">Switch Branch Context</Text>
                    <Text className="text-xs text-gray-500 mt-0.5">
                        Enterprise Multi-Branch Operations (39 Branches + HQ)
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="p-2 rounded-full bg-gray-100"
                    accessibilityLabel="Close"
                >
                    <MaterialIcons name="close" size={20} color="#4B5563" />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-4 py-4">
                <Text className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3 px-2">
                    {isAdminOrHQ ? 'All Authorized Locations' : 'Your Assigned Branches'}
                </Text>

                {loading ? (
                    <View className="py-12 items-center">
                        <ActivityIndicator size="large" color="#1E3A8A" />
                        <Text className="text-sm text-gray-500 mt-2">Loading branch network...</Text>
                    </View>
                ) : (
                    <View className="space-y-3">
                        {/* Assigned Multi-Roles */}
                        {userBranchRoles.map((assignment, index) => {
                            const isCurrent = assignment.branchId === branchId;
                            const isSwitching = switchingId === assignment.branchId;

                            return (
                                <TouchableOpacity
                                    key={`assignment-${assignment.branchId}-${index}`}
                                    onPress={() => handleSelectBranch(assignment.branchId, assignment.role)}
                                    disabled={isSwitching}
                                    className={`p-4 rounded-xl border flex-row items-center justify-between ${
                                        isCurrent
                                            ? 'bg-blue-50 border-blue-500'
                                            : 'bg-white border-gray-200'
                                    }`}
                                >
                                    <View className="flex-1">
                                        <View className="flex-row items-center gap-2">
                                            <Text className="text-base font-bold text-gray-900">
                                                {assignment.branchName || `Branch ${assignment.branchId.slice(0, 8)}`}
                                            </Text>
                                            {isCurrent && (
                                                <View className="bg-blue-600 px-2 py-0.5 rounded-full">
                                                    <Text className="text-xs font-semibold text-white">Active</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text className="text-sm text-gray-600 mt-1">
                                            Role: <Text className="font-medium text-gray-800">{ROLE_LABELS[assignment.role as UserRole] || assignment.role}</Text>
                                        </Text>
                                    </View>

                                    <View className="ml-3">
                                        {isSwitching ? (
                                            <ActivityIndicator size="small" color="#2563EB" />
                                        ) : (
                                            <MaterialIcons
                                                name={isCurrent ? 'radio-button-checked' : 'radio-button-unchecked'}
                                                size={24}
                                                color={isCurrent ? '#2563EB' : '#9CA3AF'}
                                            />
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}

                        {/* Admin Global List if Admin/HQ */}
                        {isAdminOrHQ && allBranches.length > 0 && (
                            <>
                                <Text className="text-sm font-semibold text-gray-700 uppercase tracking-wider mt-6 mb-3 px-2">
                                    HQ & Network Directory
                                </Text>
                                {allBranches.map((b) => {
                                    const isCurrent = b.id === branchId;
                                    const isSwitching = switchingId === b.id;

                                    return (
                                        <TouchableOpacity
                                            key={`branch-${b.id}`}
                                            onPress={() => handleSelectBranch(b.id, role || 'admin')}
                                            disabled={isSwitching}
                                            className={`p-4 rounded-xl border flex-row items-center justify-between mb-2 ${
                                                isCurrent
                                                    ? 'bg-blue-50 border-blue-500'
                                                    : 'bg-white border-gray-200'
                                            }`}
                                        >
                                            <View className="flex-1">
                                                <View className="flex-row items-center gap-2">
                                                    <Text className="text-base font-bold text-gray-900">
                                                        {b.name}
                                                    </Text>
                                                    {b.isHq && (
                                                        <View className="bg-purple-600 px-2 py-0.5 rounded-full">
                                                            <Text className="text-xs font-semibold text-white">HQ</Text>
                                                        </View>
                                                    )}
                                                    {isCurrent && (
                                                        <View className="bg-blue-600 px-2 py-0.5 rounded-full">
                                                            <Text className="text-xs font-semibold text-white">Active</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                {b.code && (
                                                    <Text className="text-xs text-gray-500 mt-1">Code: {b.code}</Text>
                                                )}
                                            </View>

                                            <View className="ml-3">
                                                {isSwitching ? (
                                                    <ActivityIndicator size="small" color="#2563EB" />
                                                ) : (
                                                    <MaterialIcons
                                                        name={isCurrent ? 'check-circle' : 'arrow-forward-ios'}
                                                        size={isCurrent ? 24 : 16}
                                                        color={isCurrent ? '#2563EB' : '#9CA3AF'}
                                                    />
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </>
                        )}

                        {userBranchRoles.length === 0 && allBranches.length === 0 && (
                            <View className="items-center justify-center p-8 bg-white rounded-2xl border border-gray-200 mt-4 shadow-sm">
                                <View className="w-14 h-14 rounded-full bg-blue-50 items-center justify-center mb-3">
                                    <MaterialIcons name="storefront" size={28} color="#2563EB" />
                                </View>
                                <Text className="text-base font-bold text-gray-900">No Branches Detected</Text>
                                <Text className="text-xs text-gray-500 text-center mt-1 leading-5">
                                    There are currently no branches registered in local storage or assigned to your user account. Once synced with Supabase HQ, all 39 branches will appear here.
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
