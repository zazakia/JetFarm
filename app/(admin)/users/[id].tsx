import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, Switch, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '../../../src/utils/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { database } from '../../../src/database';
import UserProfile from '../../../src/database/models/UserProfile';
import Borrower from '../../../src/database/models/Borrower';
import BusinessUnit from '../../../src/database/models/BusinessUnit';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import { ROLES, ROLE_LABELS } from '../../../src/constants/roles';
import { ConfirmDialog } from '../../../src/components/ConfirmDialog';
import ActionLogService from '../../../src/services/ActionLogService';
import { AuthService } from '../../../src/services/AuthService';
import { handleFormValidationError, handleSaveError } from '../../../src/utils/errorAlerts';
import { supabase } from '../../../src/database/supabase';
import { SyncService } from '../../../src/services/SyncService';
import UserTracingService, { UserActivityEvent, UserDataRelationships } from '../../../src/services/UserTracingService';
import { formatPHP } from '../../../src/utils/currency';
import { formatDateTime, formatRelative } from '../../../src/utils/dates';

const schema = z.object({
    fullName: z.string().min(2, "Name is required"),
    email: z.string().email("Invalid email address"),
    role: z.string().min(1, "Role is required"),
    isActive: z.boolean(),
    branchId: z.string().optional(),
    areaId: z.string().optional(),
    borrowerId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;
type ActiveTab = 'profile' | 'history' | 'relationships';

export default function EditUserScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    
    // Core User State
    const [user, setUser] = useState<UserProfile | null>(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('profile');
    
    // Form Selectors State
    const [borrowers, setBorrowers] = useState<Borrower[]>([]);
    const [businessUnits, setBusinessUnits] = useState<{ id: string; name: string }[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loadingBorrowers, setLoadingBorrowers] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // Activity History State
    const [timeline, setTimeline] = useState<UserActivityEvent[]>([]);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [timelineLoaded, setTimelineLoaded] = useState(false);
    const [timelineSearch, setTimelineSearch] = useState('');
    const [timelineAction, setTimelineAction] = useState('ALL');
    const [expandedDiffId, setExpandedDiffId] = useState<string | null>(null);

    // Data Relationships State
    const [relationships, setRelationships] = useState<UserDataRelationships | null>(null);
    const [relationshipsLoading, setRelationshipsLoading] = useState(false);
    const [relationshipsLoaded, setRelationshipsLoaded] = useState(false);

    const { control, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
    });

    const selectedRole = watch('role');
    const isActiveValue = watch('isActive');

    const filteredBorrowers = borrowers.filter(b =>
        b.fullName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    useEffect(() => {
        const loadData = async () => {
            try {
                const u = await database.collections.get<UserProfile>('user_profiles').find(id);
                setUser(u);

                try {
                    const fetchedUnits = await database.collections.get<BusinessUnit>('business_units')
                        .query(Q.where('deleted_at', null))
                        .fetch();
                    if (fetchedUnits.length > 0) {
                        setBusinessUnits(fetchedUnits.map(b => ({ id: b.id, name: b.name })));
                    } else {
                        setBusinessUnits([
                            { id: 'branch-bagacay', name: 'Bagacay (Benchmark)' },
                            { id: 'branch-locsin', name: 'Locsin (Dumaguete)' },
                            { id: 'branch-daro', name: 'Daro Crossing' },
                            { id: 'branch-noph', name: 'NOPH Main Gate' },
                            { id: 'branch-batinguel', name: 'Batinguel Highway' },
                        ]);
                    }
                } catch {
                    setBusinessUnits([
                        { id: 'branch-bagacay', name: 'Bagacay (Benchmark)' },
                        { id: 'branch-locsin', name: 'Locsin (Dumaguete)' },
                        { id: 'branch-daro', name: 'Daro Crossing' },
                        { id: 'branch-noph', name: 'NOPH Main Gate' },
                        { id: 'branch-batinguel', name: 'Batinguel Highway' },
                    ]);
                }

                let bId = '';
                if (u.role === ROLES.borrower) {
                    const linkedBorrower = await database.collections.get<Borrower>('borrowers').query(Q.where('auth_id', id)).fetch();
                    if (linkedBorrower.length > 0) bId = linkedBorrower[0].id;
                }

                reset({
                    fullName: u.fullName,
                    email: u.email,
                    role: u.role,
                    isActive: u.isActive,
                    branchId: u.branchId || '',
                    areaId: u.areaId || '',
                    borrowerId: bId,
                });

                if (u.role === ROLES.borrower) {
                    loadBorrowers();
                }
            } catch (error) {
                console.error('Failed to load user:', error);
                safeBack(router, '/(admin)');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [id]);

    useEffect(() => {
        if (selectedRole === ROLES.borrower && borrowers.length === 0) {
            loadBorrowers();
        }
    }, [selectedRole]);

    // Lazy load timeline or relationships on tab activation
    useEffect(() => {
        if (activeTab === 'history' && !timelineLoaded) {
            loadTimeline();
        } else if (activeTab === 'relationships' && !relationshipsLoaded) {
            loadRelationships();
        }
    }, [activeTab, id, timelineLoaded, relationshipsLoaded]);

    const loadBorrowers = async () => {
        setLoadingBorrowers(true);
        try {
            const fetched = await database.collections.get<Borrower>('borrowers').query(Q.sortBy('full_name', Q.asc)).fetch();
            setBorrowers(fetched);
        } catch (error) {
            console.error('Failed to load borrowers:', error);
        } finally {
            setLoadingBorrowers(false);
        }
    };

    const loadTimeline = async () => {
        if (!id) return;
        setTimelineLoading(true);
        try {
            const events = await UserTracingService.getUserActivityTimeline(id, 100);
            setTimeline(events);
            setTimelineLoaded(true);
        } catch (error) {
            console.error('Failed to load user activity timeline:', error);
        } finally {
            setTimelineLoading(false);
        }
    };

    const loadRelationships = async () => {
        if (!id) return;
        setRelationshipsLoading(true);
        try {
            const rels = await UserTracingService.getUserDataRelationships(id);
            setRelationships(rels);
            setRelationshipsLoaded(true);
        } catch (error) {
            console.error('Failed to load user data relationships:', error);
        } finally {
            setRelationshipsLoading(false);
        }
    };

    const onSubmit = async (data: FormData) => {
        if (!user) return;
        setSaving(true);
        try {
            await database.write(async () => {
                const batchOps: any[] = [];
                const logs: any[] = [];

                // 1. Audit user profile update
                const oldUserProfile = {
                    fullName: user.fullName,
                    email: user.email,
                    role: user.role,
                    isActive: user.isActive,
                    branchId: user.branchId,
                    areaId: user.areaId,
                };
                const newUserProfile = {
                    fullName: data.fullName.trim(),
                    email: data.email.toLowerCase().trim(),
                    role: data.role,
                    isActive: data.isActive,
                    branchId: data.branchId ? data.branchId.trim() : undefined,
                    areaId: data.areaId ? data.areaId.trim() : undefined,
                };

                batchOps.push(user.prepareUpdate(u => {
                    u.fullName = newUserProfile.fullName;
                    u.email = newUserProfile.email;
                    u.role = newUserProfile.role;
                    u.isActive = newUserProfile.isActive;
                    u.branchId = newUserProfile.branchId;
                    u.areaId = newUserProfile.areaId;
                }));

                logs.push({
                    entityType: 'user_profiles',
                    entityId: user.id,
                    action: 'UPDATE',
                    oldData: oldUserProfile,
                    newData: newUserProfile
                });

                // 2. Collector Sync Logic
                const collectorColl = database.collections.get<any>('collectors');
                const existingCollector = await collectorColl.query(Q.where('auth_id', user.id)).fetch();

                if (data.role === ROLES.collector) {
                    if (existingCollector.length > 0) {
                        const coll = existingCollector[0];
                        const oldCollData = { fullName: coll.fullName, isActive: coll.isActive };
                        const newCollData = { fullName: data.fullName.trim(), isActive: data.isActive };

                        batchOps.push(coll.prepareUpdate((c: any) => {
                            c.fullName = newCollData.fullName;
                            c.isActive = newCollData.isActive;
                            c.deletedAt = null; 
                        }));

                        logs.push({
                            entityType: 'collectors',
                            entityId: coll.id,
                            action: 'UPDATE',
                            oldData: oldCollData,
                            newData: newCollData
                        });
                    } else {
                        const newColl = collectorColl.prepareCreate((c: any) => {
                            c.fullName = data.fullName.trim();
                            c.authId = user.id;
                            c.isActive = data.isActive;
                        });
                        batchOps.push(newColl);

                        logs.push({
                            entityType: 'collectors',
                            entityId: newColl.id,
                            action: 'CREATE',
                            newData: { fullName: data.fullName.trim(), authId: user.id, isActive: data.isActive }
                        });
                    }
                } else if (existingCollector.length > 0) {
                    for (const c of existingCollector) {
                        batchOps.push(c.prepareUpdate((collect: any) => {
                            collect.isActive = false;
                            collect.deletedAt = new Date().getTime();
                        }));

                        logs.push({
                            entityType: 'collectors',
                            entityId: c.id,
                            action: 'UPDATE',
                            oldData: { isActive: c.isActive },
                            newData: { isActive: false, deletedAt: 'Soft Deleted' }
                        });
                    }
                }

                // 3. Update borrower link
                const currentLinked = await database.collections.get<Borrower>('borrowers').query(Q.where('auth_id', user.id)).fetch();
                for (const b of currentLinked) {
                    if (data.role !== ROLES.borrower || b.id !== data.borrowerId) {
                        batchOps.push(b.prepareUpdate(borrower => {
                            borrower.authId = '';
                        }));

                        logs.push({
                            entityType: 'borrowers',
                            entityId: b.id,
                            action: 'UPDATE',
                            oldData: { authId: user.id },
                            newData: { authId: '' }
                        });
                    }
                }

                if (data.role === ROLES.borrower && data.borrowerId) {
                    const isAlreadyLinked = currentLinked.some(b => b.id === data.borrowerId);
                    if (!isAlreadyLinked) {
                        const b = await database.collections.get<Borrower>('borrowers').find(data.borrowerId);
                        batchOps.push(b.prepareUpdate(borrower => {
                            borrower.authId = user.id;
                        }));

                        logs.push({
                            entityType: 'borrowers',
                            entityId: b.id,
                            action: 'UPDATE',
                            oldData: { authId: b.authId },
                            newData: { authId: user.id }
                        });
                    }
                }

                const auditLogs = await ActionLogService.prepareLogActions(logs);
                await database.batch(...batchOps, ...auditLogs);
            });

            // Direct Supabase update so account activation is immediate on remote
            try {
                await supabase
                    .from('user_profiles')
                    .update({
                        full_name: data.fullName.trim(),
                        email: data.email.toLowerCase().trim(),
                        role: data.role,
                        is_active: data.isActive,
                        branch_id: data.branchId ? data.branchId.trim() : null,
                        area_id: data.areaId ? data.areaId.trim() : null,
                        updated_at: new Date().toISOString(),
                    })
                    .or(`id.eq.${user.id},email.ilike.${data.email.toLowerCase().trim()}`);
            } catch (spErr) {
                console.warn('[EditUserScreen] Direct Supabase profile update failed:', spErr);
            }

            // Trigger SyncService to push local updates immediately
            SyncService.checkAndSync({ force: true, localChange: true }).catch(syncErr => {
                console.warn('[EditUserScreen] Sync trigger after update failed:', syncErr);
            });

            if (Platform.OS === 'web') {
                window.alert("User profile updated successfully.");
            } else {
                Alert.alert("Success", "User profile updated successfully.");
            }
            safeBack(router, '/(admin)');
        } catch (error) {
            handleSaveError(error, 'User', 'update');
        } finally {
            setSaving(false);
        }
    };

    const handleDirectActivate = () => {
        setValue('isActive', true, { shouldDirty: true, shouldValidate: true });
        handleSubmit(onSubmit)();
    };

    const handleDelete = () => {
        if (Platform.OS === 'web') {
            setShowDeleteConfirm(true);
            return;
        }

        Alert.alert(
            "Delete User Profile",
            "Are you sure you want to delete this user profile? This will deactivate the profile locally and sync the deletion to the server.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: executeDelete
                }
            ]
        );
    };

    const executeDelete = async () => {
        try {
            setSaving(true);
            await database.write(async () => {
                const batchOps: any[] = [];
                const logs: any[] = [];

                if (user) {
                    // 1. Soft-delete the user profile
                    batchOps.push(user.prepareUpdate(u => {
                        u.isActive = false;
                        (u as any).deletedAt = new Date().getTime();
                    }));

                    logs.push({
                        entityType: 'user_profiles',
                        entityId: user.id,
                        action: 'DELETE',
                        oldData: { email: user.email, fullName: user.fullName }
                    });

                    // 2. Soft-delete linked collector if any
                    const existingCollectors = await database.collections.get<any>('collectors').query(Q.where('auth_id', id)).fetch();
                    for (const c of existingCollectors) {
                        batchOps.push(c.prepareUpdate((collect: any) => {
                            collect.isActive = false;
                            collect.deletedAt = new Date().getTime();
                        }));

                        logs.push({
                            entityType: 'collectors',
                            entityId: c.id,
                            action: 'DELETE',
                            oldData: { fullName: c.fullName }
                        });
                    }

                    // 3. Clear borrower links
                    const currentLinked = await database.collections.get<Borrower>('borrowers').query(Q.where('auth_id', id)).fetch();
                    for (const b of currentLinked) {
                        batchOps.push(b.prepareUpdate(borrower => {
                            borrower.authId = '';
                        }));

                        logs.push({
                            entityType: 'borrowers',
                            entityId: b.id,
                            action: 'UPDATE',
                            oldData: { authId: user.id },
                            newData: { authId: '' }
                        });
                    }
                }

                const auditLogs = await ActionLogService.prepareLogActions(logs);
                await database.batch(...batchOps, ...auditLogs);
            });

            safeBack(router, '/(admin)');
        } catch (e) {
            console.error('Failed to delete user', e);
            if (Platform.OS === 'web') {
                window.alert("Could not delete user profile.");
            } else {
                Alert.alert("Error", "Could not delete user profile.");
            }
            setSaving(false);
        }
    };

    const handleResetPassword = async () => {
        if (!user || !user.email) return;

        if (Platform.OS === 'web') {
            if (window.confirm(`Send password reset email to ${user.email}?`)) {
                await executeResetPassword();
            }
            return;
        }

        Alert.alert(
            "Reset Password",
            `Send password reset email to ${user.email}?`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Send Email", onPress: executeResetPassword }
            ]
        );
    };

    const executeResetPassword = async () => {
        if (!user || !user.email) return;
        try {
            setSaving(true);
            await AuthService.sendPasswordResetEmail(user.email);
            if (Platform.OS === 'web') {
                window.alert(`Password reset email sent to ${user.email}.`);
            } else {
                Alert.alert("Success", `Password reset email sent to ${user.email}.`);
            }
        } catch (error: any) {
            if (Platform.OS === 'web') {
                window.alert(error?.message || "Failed to send password reset email.");
            } else {
                Alert.alert("Error", error?.message || "Failed to send password reset email.");
            }
        } finally {
            setSaving(false);
        }
    };

    // Filtered Timeline
    const filteredTimeline = timeline.filter(event => {
        if (timelineAction !== 'ALL' && event.action !== timelineAction) return false;
        if (!timelineSearch.trim()) return true;
        const q = timelineSearch.toLowerCase();
        return (
            event.narrative.toLowerCase().includes(q) ||
            event.title.toLowerCase().includes(q) ||
            event.module.toLowerCase().includes(q) ||
            event.entityName.toLowerCase().includes(q) ||
            event.entityId.toLowerCase().includes(q)
        );
    });

    const getActionBadgeStyle = (action: string) => {
        switch (action) {
            case 'CREATE':
                return { bg: 'bg-emerald-100', text: 'text-emerald-800' };
            case 'UPDATE':
                return { bg: 'bg-blue-100', text: 'text-blue-800' };
            case 'DELETE':
                return { bg: 'bg-red-100', text: 'text-red-800' };
            case 'RESTORE':
                return { bg: 'bg-amber-100', text: 'text-amber-800' };
            default:
                return { bg: 'bg-gray-100', text: 'text-gray-800' };
        }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#1E3A8A" />
            </View>
        );
    }

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {/* Top User Overview Banner */}
            <View className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mb-4">
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 mr-3">
                        <View className="w-12 h-12 rounded-2xl bg-blue-900 items-center justify-center mr-3">
                            <MaterialIcons name="person" size={26} color="#FFFFFF" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-xl font-black text-gray-900" numberOfLines={1}>
                                {user?.fullName || 'User Profile'}
                            </Text>
                            <Text className="text-xs text-gray-500 font-medium" numberOfLines={1}>
                                {user?.email}
                            </Text>
                        </View>
                    </View>
                    <View className="items-end">
                        <View className="bg-blue-50 border border-blue-200 px-3 py-1 rounded-full mb-1">
                            <Text className="text-blue-900 font-bold text-xs uppercase">
                                {ROLE_LABELS[user?.role as keyof typeof ROLE_LABELS] || user?.role}
                            </Text>
                        </View>
                        <View className={`px-2 py-0.5 rounded-md ${user?.isActive ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                            <Text className={`text-[10px] font-bold uppercase ${user?.isActive ? 'text-emerald-800' : 'text-amber-800'}`}>
                                {user?.isActive ? 'Active' : 'Pending Activation'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* 3-Tab Segmented Control */}
                <View className="flex-row bg-gray-100 p-1 rounded-2xl mt-5">
                    <Pressable
                        onPress={() => setActiveTab('profile')}
                        className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${
                            activeTab === 'profile' ? 'bg-white shadow-sm' : ''
                        }`}
                    >
                        <MaterialIcons
                            name="tune"
                            size={16}
                            color={activeTab === 'profile' ? '#1E3A8A' : '#6B7280'}
                        />
                        <Text
                            className={`text-xs font-bold ml-1.5 ${
                                activeTab === 'profile' ? 'text-blue-900' : 'text-gray-600'
                            }`}
                        >
                            Profile & Roles
                        </Text>
                    </Pressable>

                    <Pressable
                        onPress={() => setActiveTab('history')}
                        className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${
                            activeTab === 'history' ? 'bg-white shadow-sm' : ''
                        }`}
                    >
                        <MaterialIcons
                            name="history"
                            size={16}
                            color={activeTab === 'history' ? '#1E3A8A' : '#6B7280'}
                        />
                        <Text
                            className={`text-xs font-bold ml-1.5 ${
                                activeTab === 'history' ? 'text-blue-900' : 'text-gray-600'
                            }`}
                        >
                            Activity History
                        </Text>
                    </Pressable>

                    <Pressable
                        onPress={() => setActiveTab('relationships')}
                        className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${
                            activeTab === 'relationships' ? 'bg-white shadow-sm' : ''
                        }`}
                    >
                        <MaterialIcons
                            name="account-tree"
                            size={16}
                            color={activeTab === 'relationships' ? '#1E3A8A' : '#6B7280'}
                        />
                        <Text
                            className={`text-xs font-bold ml-1.5 ${
                                activeTab === 'relationships' ? 'text-blue-900' : 'text-gray-600'
                            }`}
                        >
                            Relationships
                        </Text>
                    </Pressable>
                </View>
            </View>

            {/* TAB 1: PROFILE & ROLES */}
            {activeTab === 'profile' && (
                <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                    <Text className="text-lg font-black text-gray-900 mb-4">Edit Profile & Permissions</Text>

                    {!isActiveValue && (
                        <View className="mb-6 bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
                            <View className="flex-row items-center mb-3">
                                <View className="w-10 h-10 rounded-full bg-amber-100 items-center justify-center mr-3">
                                    <MaterialIcons name="pending-actions" size={22} color="#B45309" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-amber-900 font-black text-sm uppercase tracking-wider">
                                        Pending Admin Approval
                                    </Text>
                                    <Text className="text-amber-700 text-xs font-semibold mt-0.5">
                                        This account cannot sign in until activated
                                    </Text>
                                </View>
                            </View>
                            <Text className="text-amber-800 text-xs font-medium leading-5 mb-3">
                                Verify the signup details below, confirm the role assignment, then activate the account.
                            </Text>
                            <Pressable
                                className="bg-amber-600 active:bg-amber-700 py-3 rounded-xl items-center flex-row justify-center"
                                onPress={handleDirectActivate}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
                                        <Text className="text-white font-black text-sm uppercase tracking-wider ml-2">
                                            Activate Account & Save
                                        </Text>
                                    </>
                                )}
                            </Pressable>
                        </View>
                    )}

                    {/* Active status badge when user is active */}
                    {isActiveValue && (
                        <View className="mb-4 flex-row items-center bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                            <View className="w-8 h-8 rounded-full bg-emerald-100 items-center justify-center mr-3">
                                <MaterialIcons name="verified-user" size={18} color="#16A34A" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-emerald-800 font-bold text-sm">Account Active</Text>
                                <Text className="text-emerald-600 text-xs">This user can sign in and use the system</Text>
                            </View>
                        </View>
                    )}

                    <View className="mb-4">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-widest">Full Name</Text>
                        <Controller
                            control={control}
                            name="fullName"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className={`bg-gray-50 p-4 rounded-xl border ${errors.fullName ? 'border-red-500' : 'border-gray-200'} text-gray-900`}
                                    placeholderTextColor="#9CA3AF"
                                    onChangeText={onChange}
                                    value={value}
                                    editable={!saving}
                                />
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
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    onChangeText={onChange}
                                    value={value}
                                    editable={!saving}
                                />
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
                                    {Object.entries(ROLES).map(([roleKey, roleValue]) => (
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
                            {(selectedRole === ROLES.branch_cashier || selectedRole === ROLES.branch_manager) && (
                                <View className="bg-emerald-100 px-2 py-0.5 rounded-md">
                                    <Text className="text-emerald-800 text-[10px] font-bold uppercase">Required for Role</Text>
                                </View>
                            )}
                        </View>
                        <Text className="text-xs text-slate-500 mb-3">
                            Reassign or lock this user to a specific branch/store location.
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

                    {selectedRole === ROLES.borrower && (
                        <View className="mb-4 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                            <Text className="text-xs font-bold text-blue-800 mb-2 uppercase tracking-widest">Link to Borrower Profile</Text>
                            {loadingBorrowers ? (
                                <ActivityIndicator size="small" color="#1E3A8A" />
                            ) : (
                                <View>
                                    <View className="relative mb-2 flex-row items-center bg-white rounded-xl border border-blue-200 px-3">
                                        <MaterialIcons name="search" size={20} color="#6B7280" className="mr-2" />
                                        <TextInput
                                            className="flex-1 py-3 text-gray-900 font-medium text-sm"
                                            placeholder="Search member/borrower..."
                                            placeholderTextColor="#9CA3AF"
                                            value={searchQuery}
                                            onChangeText={setSearchQuery}
                                        />
                                        {searchQuery.length > 0 && (
                                            <Pressable onPress={() => setSearchQuery('')} className="p-1">
                                                <MaterialIcons name="close" size={18} color="#6B7280" />
                                            </Pressable>
                                        )}
                                    </View>
                                    <Controller
                                        control={control}
                                        name="borrowerId"
                                        render={({ field: { onChange, value } }) => (
                                            <View>
                                                {filteredBorrowers.length === 0 ? (
                                                    <Text className="text-gray-700 text-xs py-2 italic flex-wrap">
                                                        {borrowers.length === 0 ? 'No borrowers found.' : 'No matching borrowers.'}
                                                    </Text>
                                                ) : (
                                                    <ScrollView className="max-h-40" nestedScrollEnabled>
                                                        {filteredBorrowers.map(b => (
                                                            <Pressable
                                                                key={b.id}
                                                                onPress={() => onChange(b.id)}
                                                                className={`p-3 rounded-lg mb-1 flex-row justify-between items-center ${value === b.id ? 'bg-blue-600' : 'bg-white'}`}
                                                            >
                                                                <Text className={`text-sm ${value === b.id ? 'text-white font-bold' : 'text-gray-700'}`}>{b.fullName}</Text>
                                                                {value === b.id && <MaterialIcons name="check" size={16} color="#FFF" />}
                                                            </Pressable>
                                                        ))}
                                                    </ScrollView>
                                                )}
                                            </View>
                                        )}
                                    />
                                </View>
                            )}
                            {errors.borrowerId && <Text className="text-red-500 text-xs mt-1 font-bold">{errors.borrowerId.message}</Text>}
                        </View>
                    )}

                    <View className="flex-row items-center justify-between mb-8 p-4 bg-gray-50 rounded-2xl">
                        <View className="flex-1 mr-4">
                            <Text className="text-sm font-bold text-gray-900">Active Status</Text>
                            <Text className="text-xs text-gray-500">
                                {isActiveValue ? 'This user can sign in to the system' : 'This user cannot sign in until activated'}
                            </Text>
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
                        className={`w-full py-4 rounded-2xl items-center shadow-lg mb-4 ${saving ? 'bg-blue-400' : 'bg-blue-900 active:bg-blue-800'}`}
                        onPress={handleSubmit(onSubmit, (errs) => handleFormValidationError(errs, 'User'))}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text className="text-white font-black text-lg uppercase tracking-widest">Save Changes</Text>
                        )}
                    </Pressable>

                    <Pressable
                        className="w-full py-4 rounded-2xl items-center bg-blue-50 border border-blue-100 active:bg-blue-100 mb-4"
                        onPress={handleResetPassword}
                        disabled={saving}
                    >
                        <Text className="text-blue-700 font-bold uppercase tracking-widest text-xs">Reset Password</Text>
                    </Pressable>

                    <Pressable
                        className="w-full py-4 rounded-2xl items-center bg-red-50 border border-red-100 active:bg-red-100"
                        onPress={handleDelete}
                        disabled={saving}
                    >
                        <Text className="text-red-600 font-bold uppercase tracking-widest text-xs">Delete Profile</Text>
                    </Pressable>
                </View>
            )}

            {/* TAB 2: ACTIVITY HISTORY */}
            {activeTab === 'history' && (
                <View className="mb-6">
                    {/* Activity Filter Bar */}
                    <View className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-4">
                        <View className="flex-row items-center justify-between mb-3">
                            <View>
                                <Text className="text-base font-black text-gray-900">User Activity Timeline</Text>
                                <Text className="text-xs text-gray-500">Chronological history of modifications by this operator</Text>
                            </View>
                            <Pressable
                                onPress={() => loadTimeline()}
                                disabled={timelineLoading}
                                className="w-8 h-8 rounded-lg bg-gray-100 items-center justify-center active:bg-gray-200"
                            >
                                {timelineLoading ? (
                                    <ActivityIndicator size="small" color="#1E3A8A" />
                                ) : (
                                    <MaterialIcons name="refresh" size={18} color="#374151" />
                                )}
                            </Pressable>
                        </View>

                        {/* Search Input */}
                        <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-3">
                            <MaterialIcons name="search" size={18} color="#6B7280" className="mr-2" />
                            <TextInput
                                className="flex-1 text-gray-900 text-xs font-medium py-0"
                                placeholder="Search actions, entities, notes..."
                                placeholderTextColor="#9CA3AF"
                                value={timelineSearch}
                                onChangeText={setTimelineSearch}
                            />
                            {timelineSearch.length > 0 && (
                                <Pressable onPress={() => setTimelineSearch('')} className="p-1">
                                    <MaterialIcons name="close" size={14} color="#6B7280" />
                                </Pressable>
                            )}
                        </View>

                        {/* Action Filter Pills */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                            {['ALL', 'CREATE', 'UPDATE', 'DELETE'].map(act => (
                                <Pressable
                                    key={act}
                                    onPress={() => setTimelineAction(act)}
                                    className={`mr-2 px-3 py-1.5 rounded-full border ${
                                        timelineAction === act ? 'bg-blue-900 border-blue-900' : 'bg-gray-50 border-gray-200'
                                    }`}
                                >
                                    <Text className={`text-xs font-bold ${timelineAction === act ? 'text-white' : 'text-gray-700'}`}>
                                        {act === 'ALL' ? 'All Actions' : act}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Timeline Feed */}
                    {timelineLoading && !timelineLoaded ? (
                        <View className="py-12 items-center justify-center bg-white rounded-3xl border border-gray-100">
                            <ActivityIndicator size="large" color="#1E3A8A" />
                            <Text className="text-gray-500 text-xs font-medium mt-3">Loading user activity log...</Text>
                        </View>
                    ) : filteredTimeline.length === 0 ? (
                        <View className="py-12 px-6 items-center justify-center bg-white rounded-3xl border border-gray-100">
                            <MaterialIcons name="history-toggle-off" size={42} color="#9CA3AF" />
                            <Text className="text-gray-900 font-bold text-sm mt-3">No activity logged yet</Text>
                            <Text className="text-gray-500 text-xs text-center mt-1">
                                Operational actions performed by this user will appear here in chronological order.
                            </Text>
                        </View>
                    ) : (
                        <View className="space-y-3">
                            {filteredTimeline.map(item => {
                                const badgeStyle = getActionBadgeStyle(item.action);
                                const isDiffExpanded = expandedDiffId === item.id;

                                return (
                                    <View
                                        key={item.id}
                                        className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-3"
                                    >
                                        <View className="flex-row items-center justify-between mb-2">
                                            <View className="flex-row items-center flex-wrap gap-1.5">
                                                <View className={`px-2 py-0.5 rounded-md ${badgeStyle.bg}`}>
                                                    <Text className={`text-[10px] font-bold uppercase ${badgeStyle.text}`}>
                                                        {item.action}
                                                    </Text>
                                                </View>
                                                <View className="bg-slate-100 px-2 py-0.5 rounded-md">
                                                    <Text className="text-[10px] font-bold text-slate-700">
                                                        {item.module}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text className="text-[11px] text-gray-400 font-medium">
                                                {item.relativeTime}
                                            </Text>
                                        </View>

                                        <Text className="text-sm font-bold text-gray-900">{item.title}</Text>
                                        {item.subtitle ? (
                                            <Text className="text-xs text-gray-500 mt-0.5">{item.subtitle}</Text>
                                        ) : null}

                                        <Text className="text-xs text-gray-700 leading-relaxed mt-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                            {item.narrative}
                                        </Text>

                                        <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-gray-50">
                                            <Text className="text-[10px] text-gray-400">
                                                {item.formattedDate}
                                            </Text>

                                            {item.changes.length > 0 && (
                                                <Pressable
                                                    onPress={() => setExpandedDiffId(isDiffExpanded ? null : item.id)}
                                                    className="flex-row items-center bg-gray-100 px-2 py-1 rounded-md active:bg-gray-200"
                                                >
                                                    <MaterialIcons
                                                        name={isDiffExpanded ? "expand-less" : "expand-more"}
                                                        size={14}
                                                        color="#374151"
                                                    />
                                                    <Text className="text-[10px] font-bold text-gray-700 ml-0.5">
                                                        {isDiffExpanded ? "Hide Diff" : `Changes (${item.changes.length})`}
                                                    </Text>
                                                </Pressable>
                                            )}
                                        </View>

                                        {/* Expandable Changes Diff View */}
                                        {isDiffExpanded && item.changes.length > 0 && (
                                            <View className="mt-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                                                <Text className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                                                    Modified Attributes
                                                </Text>
                                                {item.changes.map((ch, idx) => (
                                                    <View key={idx} className="mb-2 last:mb-0">
                                                        <Text className="text-[11px] font-bold text-slate-800">
                                                            {ch.label || ch.key}
                                                        </Text>
                                                        <View className="flex-row items-center mt-0.5 flex-wrap">
                                                            <Text className="text-[10px] text-red-600 line-through mr-1.5 font-medium">
                                                                {ch.oldValueFormatted || (ch.oldValue !== undefined && ch.oldValue !== null ? String(ch.oldValue) : '(empty)')}
                                                            </Text>
                                                            <MaterialIcons name="arrow-forward" size={12} color="#64748B" />
                                                            <Text className="text-[10px] text-emerald-700 font-bold ml-1.5">
                                                                {ch.newValueFormatted || (ch.newValue !== undefined && ch.newValue !== null ? String(ch.newValue) : '(empty)')}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* Quick Link to Full Audit Trail */}
                    <Pressable
                        onPress={() => {
                            router.push({
                                pathname: '/(admin)/settings/audit-trail',
                                params: {
                                    userId: user?.id,
                                    operator: user?.fullName || user?.email,
                                }
                            });
                        }}
                        className="w-full py-3.5 bg-blue-50 border border-blue-200 rounded-2xl items-center flex-row justify-center active:bg-blue-100 mt-2"
                    >
                        <MaterialIcons name="open-in-new" size={18} color="#1E3A8A" />
                        <Text className="text-blue-900 font-bold text-xs uppercase tracking-wider ml-1.5">
                            Trace in Full System Audit Trail
                        </Text>
                    </Pressable>
                </View>
            )}

            {/* TAB 3: DATA RELATIONSHIPS */}
            {activeTab === 'relationships' && (
                <View className="mb-6">
                    {relationshipsLoading && !relationshipsLoaded ? (
                        <View className="py-12 items-center justify-center bg-white rounded-3xl border border-gray-100">
                            <ActivityIndicator size="large" color="#1E3A8A" />
                            <Text className="text-gray-500 text-xs font-medium mt-3">Analyzing user data graph...</Text>
                        </View>
                    ) : relationships ? (
                        <View>
                            {/* Organization & Location Association */}
                            <View className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-4">
                                <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                    Organization & Location Access
                                </Text>
                                <View className="flex-row items-center justify-between py-2 border-b border-gray-50">
                                    <View className="flex-row items-center">
                                        <MaterialIcons name="storefront" size={20} color="#059669" />
                                        <Text className="text-xs font-bold text-gray-700 ml-2">Branch / Store Unit</Text>
                                    </View>
                                    <Text className="text-xs font-bold text-gray-900">
                                        {relationships.organization.branchName || 'Global / Unrestricted'}
                                    </Text>
                                </View>
                                <View className="flex-row items-center justify-between py-2 border-b border-gray-50">
                                    <View className="flex-row items-center">
                                        <MaterialIcons name="map" size={20} color="#2563EB" />
                                        <Text className="text-xs font-bold text-gray-700 ml-2">Assigned Area</Text>
                                    </View>
                                    <Text className="text-xs font-bold text-gray-900">
                                        {relationships.organization.areaName || 'All Areas'}
                                    </Text>
                                </View>
                                <View className="flex-row items-center justify-between py-2">
                                    <View className="flex-row items-center">
                                        <MaterialIcons name="security" size={20} color="#7C3AED" />
                                        <Text className="text-xs font-bold text-gray-700 ml-2">Security Role</Text>
                                    </View>
                                    <Text className="text-xs font-bold text-purple-900">
                                        {relationships.user.roleLabel}
                                    </Text>
                                </View>
                            </View>

                            {/* Linked Member / Borrower Profile (if applicable) */}
                            {relationships.linkedBorrower && (
                                <View className="bg-blue-50 border border-blue-200 p-5 rounded-3xl mb-4">
                                    <View className="flex-row items-center justify-between mb-2">
                                        <View className="flex-row items-center">
                                            <MaterialIcons name="account-circle" size={22} color="#1E3A8A" />
                                            <Text className="text-xs font-black text-blue-900 uppercase tracking-widest ml-2">
                                                Linked Member Profile
                                            </Text>
                                        </View>
                                        <View className="bg-blue-200 px-2.5 py-0.5 rounded-full">
                                            <Text className="text-blue-900 text-[10px] font-bold">Borrower Link</Text>
                                        </View>
                                    </View>
                                    <Text className="text-base font-black text-gray-900">
                                        {relationships.linkedBorrower.fullName}
                                    </Text>
                                    {relationships.linkedBorrower.memberId && (
                                        <Text className="text-xs text-blue-800 font-semibold mt-0.5">
                                            Member ID: {relationships.linkedBorrower.memberId}
                                        </Text>
                                    )}
                                    {relationships.linkedBorrower.contactNumber && (
                                        <Text className="text-xs text-gray-600 mt-0.5">
                                            Contact: {relationships.linkedBorrower.contactNumber}
                                        </Text>
                                    )}
                                    <Pressable
                                        onPress={() => {
                                            router.push(`/(admin)/borrowers/${relationships.linkedBorrower?.id}` as any);
                                        }}
                                        className="mt-3 bg-blue-900 py-2.5 px-4 rounded-xl flex-row items-center justify-center active:bg-blue-800"
                                    >
                                        <MaterialIcons name="open-in-new" size={16} color="#FFFFFF" />
                                        <Text className="text-white text-xs font-bold ml-1.5">View Member File</Text>
                                    </Pressable>
                                </View>
                            )}

                            {/* Operational Activity Metrics Grid */}
                            <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                Operational Impact & Responsibilities
                            </Text>
                            <View className="flex-row flex-wrap gap-2.5 mb-4">
                                {/* Actions Logged */}
                                <View className="flex-1 min-w-[140px] bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
                                    <View className="flex-row items-center justify-between mb-1">
                                        <Text className="text-[11px] font-bold text-gray-500 uppercase">Actions Logged</Text>
                                        <MaterialIcons name="history" size={18} color="#4B5563" />
                                    </View>
                                    <Text className="text-2xl font-black text-gray-900">{relationships.counts.actionsLogged}</Text>
                                    <Text className="text-[10px] text-gray-500 mt-0.5">Audit actions recorded</Text>
                                </View>

                                {/* Approved Loans */}
                                <View className="flex-1 min-w-[140px] bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
                                    <View className="flex-row items-center justify-between mb-1">
                                        <Text className="text-[11px] font-bold text-emerald-700 uppercase">Approved Loans</Text>
                                        <MaterialIcons name="check-circle" size={18} color="#059669" />
                                    </View>
                                    <Text className="text-2xl font-black text-emerald-700">{relationships.counts.loansApproved}</Text>
                                    <Text className="text-[10px] text-gray-500 mt-0.5">Vol: {formatPHP(relationships.totals.loansVolume)}</Text>
                                </View>

                                {/* Collections */}
                                <View className="flex-1 min-w-[140px] bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
                                    <View className="flex-row items-center justify-between mb-1">
                                        <Text className="text-[11px] font-bold text-blue-700 uppercase">Payments Collected</Text>
                                        <MaterialIcons name="payments" size={18} color="#2563EB" />
                                    </View>
                                    <Text className="text-2xl font-black text-blue-700">{relationships.counts.paymentsCollected}</Text>
                                    <Text className="text-[10px] text-gray-500 mt-0.5">Vol: {formatPHP(relationships.totals.paymentsVolume)}</Text>
                                </View>

                                {/* Remittances Handled */}
                                <View className="flex-1 min-w-[140px] bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
                                    <View className="flex-row items-center justify-between mb-1">
                                        <Text className="text-[11px] font-bold text-purple-700 uppercase">Remittances</Text>
                                        <MaterialIcons name="receipt-long" size={18} color="#7C3AED" />
                                    </View>
                                    <Text className="text-2xl font-black text-purple-700">{relationships.counts.remittancesHandled}</Text>
                                    <Text className="text-[10px] text-gray-500 mt-0.5">Handled / Approved</Text>
                                </View>

                                {/* Journal Entries */}
                                <View className="flex-1 min-w-[140px] bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
                                    <View className="flex-row items-center justify-between mb-1">
                                        <Text className="text-[11px] font-bold text-amber-700 uppercase">Posted Journal GL</Text>
                                        <MaterialIcons name="menu-book" size={18} color="#D97706" />
                                    </View>
                                    <Text className="text-2xl font-black text-amber-700">{relationships.counts.journalEntriesPosted}</Text>
                                    <Text className="text-[10px] text-gray-500 mt-0.5">Debit: {formatPHP(relationships.totals.journalEntriesVolume)}</Text>
                                </View>

                                {/* Stock Movements */}
                                <View className="flex-1 min-w-[140px] bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
                                    <View className="flex-row items-center justify-between mb-1">
                                        <Text className="text-[11px] font-bold text-teal-700 uppercase">Stock Transfers</Text>
                                        <MaterialIcons name="inventory" size={18} color="#0D9488" />
                                    </View>
                                    <Text className="text-2xl font-black text-teal-700">{relationships.counts.stockMovements}</Text>
                                    <Text className="text-[10px] text-gray-500 mt-0.5">Bodega movements</Text>
                                </View>
                            </View>

                            {/* System Module Distribution */}
                            {Object.keys(relationships.activityByModule).length > 0 && (
                                <View className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-4">
                                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                        Activity Distribution by Module
                                    </Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {Object.entries(relationships.activityByModule).map(([modName, count]) => (
                                            <View
                                                key={modName}
                                                className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl flex-row items-center"
                                            >
                                                <Text className="text-xs font-bold text-slate-800 mr-2">{modName}</Text>
                                                <View className="bg-slate-200 px-2 py-0.5 rounded-full">
                                                    <Text className="text-[11px] font-black text-slate-700">{count}</Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Connected Operational Records Stream */}
                            {relationships.recentRelatedEntities.length > 0 && (
                                <View className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-4">
                                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                        Connected Operational Records
                                    </Text>
                                    {relationships.recentRelatedEntities.map(node => (
                                        <View
                                            key={`${node.type}-${node.id}`}
                                            className="py-2.5 border-b border-gray-50 flex-row items-center justify-between last:border-b-0"
                                        >
                                            <View className="flex-1 mr-2">
                                                <View className="flex-row items-center mb-0.5">
                                                    {node.badge && (
                                                        <View className="bg-blue-100 px-2 py-0.5 rounded mr-2">
                                                            <Text className="text-[10px] font-bold text-blue-900 uppercase">
                                                                {node.badge}
                                                            </Text>
                                                        </View>
                                                    )}
                                                    <Text className="text-xs font-bold text-gray-900" numberOfLines={1}>
                                                        {node.title}
                                                    </Text>
                                                </View>
                                                {node.subtitle && (
                                                    <Text className="text-[11px] text-gray-500" numberOfLines={1}>
                                                        {node.subtitle}
                                                    </Text>
                                                )}
                                            </View>

                                            {node.linkRoute && (
                                                <Pressable
                                                    onPress={() => {
                                                        router.push(node.linkRoute as any);
                                                    }}
                                                    className="p-1.5 bg-gray-100 rounded-lg active:bg-gray-200"
                                                >
                                                    <MaterialIcons name="chevron-right" size={18} color="#374151" />
                                                </Pressable>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Full Audit Trail Link Button */}
                            <Pressable
                                onPress={() => {
                                    router.push({
                                        pathname: '/(admin)/settings/audit-trail',
                                        params: {
                                            userId: user?.id,
                                            operator: user?.fullName || user?.email,
                                        }
                                    });
                                }}
                                className="w-full py-4 bg-blue-900 rounded-2xl items-center flex-row justify-center active:bg-blue-800 shadow-sm"
                            >
                                <MaterialIcons name="search" size={20} color="#FFFFFF" />
                                <Text className="text-white font-black text-sm uppercase tracking-wider ml-2">
                                    Deep Trace User in System Audit Trail
                                </Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View className="py-12 px-6 items-center justify-center bg-white rounded-3xl border border-gray-100">
                            <MaterialIcons name="account-tree" size={42} color="#9CA3AF" />
                            <Text className="text-gray-900 font-bold text-sm mt-3">No relational data found</Text>
                            <Text className="text-gray-500 text-xs text-center mt-1">
                                This user does not have any linked branches, loans, or transactions in the database.
                            </Text>
                        </View>
                    )}
                </View>
            )}

            <ConfirmDialog
                visible={showDeleteConfirm}
                title="Delete User Profile"
                message="Are you sure you want to delete this user profile? This will deactivate the profile locally and sync the deletion to the server."
                confirmText="Delete"
                cancelText="Cancel"
                isDangerous={true}
                onConfirm={() => {
                    setShowDeleteConfirm(false);
                    executeDelete();
                }}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </ScrollView>
    );
}
