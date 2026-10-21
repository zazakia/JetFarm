import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, Switch, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { safeBack } from '../../../src/utils/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { database } from '../../../src/database';
import UserProfile from '../../../src/database/models/UserProfile';
import BusinessUnit from '../../../src/database/models/BusinessUnit';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import { ROLES, ROLE_LABELS } from '../../../src/constants/roles';
import ActionLogService from '../../../src/services/ActionLogService';
import { handleFormValidationError, handleSaveError } from '../../../src/utils/errorAlerts';
import { supabase } from '../../../src/database/supabase';
import { SyncService } from '../../../src/services/SyncService';


const schema = z.object({
    fullName: z.string().min(2, "Name is required"),
    email: z.string().email("Invalid email address"),
    role: z.string().min(1, "Role is required"),
    isActive: z.boolean(),
    branchId: z.string().optional(),
    areaId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewUserScreen() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [businessUnits, setBusinessUnits] = useState<{ id: string; name: string }[]>([]);

    const { control, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            fullName: '',
            email: '',
            role: ROLES.admin,
            isActive: true,
            branchId: 'branch-bagacay',
            areaId: '',
        }
    });

    useEffect(() => {
        loadBranches();
    }, []);

    const loadBranches = async () => {
        try {
            const fetched = await database.collections.get<BusinessUnit>('business_units')
                .query(Q.where('deleted_at', null))
                .fetch();
            if (fetched.length > 0) {
                setBusinessUnits(fetched.map(b => ({ id: b.id, name: b.name })));
            } else {
                setBusinessUnits([
                    { id: 'branch-bagacay', name: 'Bagacay (Benchmark)' },
                    { id: 'branch-locsin', name: 'Locsin (Dumaguete)' },
                    { id: 'branch-daro', name: 'Daro Crossing' },
                    { id: 'branch-noph', name: 'NOPH Main Gate' },
                    { id: 'branch-batinguel', name: 'Batinguel Highway' },
                ]);
            }
        } catch (error) {
            console.warn('Failed to load branches:', error);
            setBusinessUnits([
                { id: 'branch-bagacay', name: 'Bagacay (Benchmark)' },
                { id: 'branch-locsin', name: 'Locsin (Dumaguete)' },
                { id: 'branch-daro', name: 'Daro Crossing' },
                { id: 'branch-noph', name: 'NOPH Main Gate' },
                { id: 'branch-batinguel', name: 'Batinguel Highway' },
            ]);
        }
    };

    const onSubmit = async (data: FormData) => {
        setSaving(true);
        try {
            let newUserId = '';
            await database.write(async () => {
                const batchOps: any[] = [];
                const logs: any[] = [];

                const newUser = database.collections.get<UserProfile>('user_profiles').prepareCreate(u => {
                    u.fullName = data.fullName.trim();
                    u.email = data.email.toLowerCase().trim();
                    u.role = data.role;
                    u.isActive = data.isActive;
                    u.branchId = data.branchId ? data.branchId.trim() : undefined;
                    u.areaId = data.areaId ? data.areaId.trim() : undefined;
                });
                newUserId = newUser.id;
                batchOps.push(newUser);

                logs.push({
                    entityType: 'user_profiles',
                    entityId: newUser.id,
                    action: 'CREATE',
                    newData: {
                        fullName: data.fullName,
                        email: data.email,
                        role: data.role,
                        isActive: data.isActive,
                        branchId: data.branchId,
                        areaId: data.areaId,
                    }
                });

                const auditLogs = await ActionLogService.prepareLogActions(logs);
                await database.batch(...batchOps, ...auditLogs);
            });

            // Upsert directly to Supabase user_profiles table
            try {
                if (newUserId) {
                    await supabase
                        .from('user_profiles')
                        .upsert({
                            id: newUserId,
                            full_name: data.fullName.trim(),
                            email: data.email.toLowerCase().trim(),
                            role: data.role,
                            is_active: data.isActive,
                            branch_id: data.branchId ? data.branchId.trim() : null,
                            area_id: data.areaId ? data.areaId.trim() : null,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        });
                }
            } catch (spErr) {
                console.warn('[NewUserScreen] Direct Supabase profile creation failed:', spErr);
            }

            // Trigger SyncService to sync changes immediately
            SyncService.checkAndSync({ force: true, localChange: true }).catch(syncErr => {
                console.warn('[NewUserScreen] Sync trigger failed:', syncErr);
            });

            if (Platform.OS === 'web') {
                window.alert("User profile created.");
            } else {
                Alert.alert("Success", "User profile created.");
            }
            safeBack(router, '/(admin)');
        } catch (error) {
            handleSaveError(error, 'User', 'save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 20 }}>
            <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                <Text className="text-2xl font-black text-gray-900 mb-6">Create New User</Text>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-widest">Full Name</Text>
                    <Controller
                        control={control}
                        name="fullName"
                        render={({ field: { onChange, value } }) => (
                            <TextInput
                                className={`bg-gray-50 p-4 rounded-xl border ${errors.fullName ? 'border-red-500' : 'border-gray-200'} text-gray-900`}
                                placeholder="Enter full name"
                                onChangeText={onChange}
                                value={value}
                                editable={!saving}
                             placeholderTextColor="#9CA3AF"/>
                        )}
                    />
                    {errors.fullName && <Text className="text-red-500 text-xs mt-1 font-bold">{errors.fullName.message}</Text>}
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-widest">Email Address</Text>
                    <Controller
                        control={control}
                        name="email"
                        render={({ field: { onChange, value } }) => (
                            <TextInput
                                className={`bg-gray-50 p-4 rounded-xl border ${errors.email ? 'border-red-500' : 'border-gray-200'} text-gray-900`}
                                placeholder="user@example.com"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                onChangeText={onChange}
                                value={value}
                                editable={!saving}
                             placeholderTextColor="#9CA3AF"/>
                        )}
                    />
                    {errors.email && <Text className="text-red-500 text-xs mt-1 font-bold">{errors.email.message}</Text>}
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-widest">Assigned Role</Text>
                    <Controller
                        control={control}
                        name="role"
                        render={({ field: { onChange, value } }) => (
                            <View className="flex-row flex-wrap">
                                {Object.entries(ROLES).map(([key, roleValue]) => (
                                    <Pressable
                                        key={roleValue}
                                        onPress={() => onChange(roleValue)}
                                        className={`mr-2 mb-2 px-4 py-2 rounded-full border ${value === roleValue ? 'bg-blue-900 border-blue-900' : 'bg-gray-100 border-gray-200'}`}
                                    >
                                        <Text className={`text-xs font-bold ${value === roleValue ? 'text-white' : 'text-gray-600'}`}>
                                            {ROLE_LABELS[roleValue as keyof typeof ROLE_LABELS]}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    />
                    {errors.role && <Text className="text-red-500 text-xs mt-1 font-bold">{errors.role.message}</Text>}
                </View>

                {/* Branch / Store Location Assignment */}
                <View className="mb-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                            Assigned Branch / Store
                        </Text>
                    </View>
                    <Text className="text-xs text-slate-500 mb-3">
                        Locks this user's shifts, inventory, and sync records to their store location.
                    </Text>
                    <Controller
                        control={control}
                        name="branchId"
                        render={({ field: { onChange, value } }) => (
                            <View className="flex-row flex-wrap">
                                {businessUnits.map((branch) => {
                                    const isSelected = value === branch.id;
                                    return (
                                        <Pressable
                                            key={branch.id}
                                            onPress={() => onChange(branch.id)}
                                            className={`mr-2 mb-2 px-3.5 py-2.5 rounded-xl border flex-row items-center ${
                                                isSelected
                                                    ? 'bg-emerald-700 border-emerald-700'
                                                    : 'bg-white border-slate-200'
                                            }`}
                                        >
                                            <MaterialIcons
                                                name="storefront"
                                                size={16}
                                                color={isSelected ? '#ffffff' : '#64748b'}
                                                className="mr-1.5"
                                            />
                                            <Text
                                                className={`text-xs font-bold ${
                                                    isSelected ? 'text-white' : 'text-slate-800'
                                                }`}
                                            >
                                                {branch.name}
                                            </Text>
                                            {isSelected && (
                                                <MaterialIcons name="check" size={14} color="#ffffff" className="ml-1" />
                                            )}
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}
                    />
                </View>

                <View className="flex-row items-center justify-between mb-8 p-4 bg-gray-50 rounded-2xl">
                    <View>
                        <Text className="text-sm font-bold text-gray-900">Active Status</Text>
                        <Text className="text-xs text-gray-700">Allow user to log in</Text>
                    </View>
                    <Controller
                        control={control}
                        name="isActive"
                        render={({ field: { onChange, value } }) => (
                            <Switch
                                value={value}
                                onValueChange={onChange}
                                trackColor={{ false: '#D1D5DB', true: '#1E3A8A' }}
                            />
                        )}
                    />
                </View>

                <Pressable
                    className={`w-full py-4 rounded-2xl items-center shadow-lg ${saving ? 'bg-blue-400' : 'bg-blue-900 active:bg-blue-900'}`}
                    onPress={handleSubmit(onSubmit, (errs) => handleFormValidationError(errs, 'User'))}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text className="text-white font-black text-lg uppercase tracking-widest">Create Profile</Text>
                    )}
                </Pressable>

                <View className="mt-4 p-4 bg-orange-50 rounded-2xl border border-orange-100 flex-row items-start">
                    <MaterialIcons name="info-outline" size={20} color="#F57C00" className="mr-2 mt-0.5" />
                    <Text className="text-[10px] items-center text-orange-800 flex-1 font-medium leading-4">
                        Note: This creates a local profile. The user must still have a valid authentication account in Supabase with the same email address.
                    </Text>
                </View>
            </View>
        </ScrollView>
    );
}
