import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import UserProfile from '../../../src/database/models/UserProfile';
import BusinessUnit from '../../../src/database/models/BusinessUnit';
import { MaterialIcons } from '@expo/vector-icons';
import { SearchBar } from '../../../src/components/SearchBar';
import { Colors } from '../../../src/constants/colors';
import { ROLES, ROLE_LABELS } from '../../../src/constants/roles';
import { SyncService } from '../../../src/services/SyncService';

type FilterTab = 'all' | 'pending' | 'active';

export default function UsersListScreen() {
    const router = useRouter();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [branchesMap, setBranchesMap] = useState<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

    const loadData = async () => {
        try {
            // Pull newly registered user profiles from Supabase
            SyncService.checkAndSync({ force: true }).catch((err) => {
                console.warn('[UsersListScreen] Background sync error:', err);
            });

            // Fetch business units for branch name resolution
            try {
                const units = await database.collections.get<BusinessUnit>('business_units')
                    .query(Q.where('deleted_at', null))
                    .fetch();
                const mapping: Record<string, string> = {};
                units.forEach(u => {
                    mapping[u.id] = u.name;
                    if (u.slug) mapping[u.slug] = u.name;
                });
                setBranchesMap(mapping);
            } catch (buErr) {
                console.warn('[UsersListScreen] Error loading business units:', buErr);
            }

            const allValidRoles = Object.values(ROLES);
            const fetched = await database.collections.get<UserProfile>('user_profiles')
                .query(
                    Q.where('deleted_at', Q.eq(null)),
                    Q.where('role', Q.oneOf(allValidRoles)),
                    Q.where('full_name', Q.notLike('%Diagnostic%')),
                    Q.where('full_name', Q.notLike('%Mock%'))
                )
                .fetch();
            const sorted = fetched.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
            setUsers(sorted);
        } catch (error) {
            console.error('Failed to load users:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const pendingUsers = users.filter(u => !u.isActive);
    const activeUsers = users.filter(u => u.isActive);

    const getFilteredUsers = (): UserProfile[] => {
        let base: UserProfile[];
        switch (activeFilter) {
            case 'pending':
                base = pendingUsers;
                break;
            case 'active':
                base = activeUsers;
                break;
            default:
                base = users;
        }
        if (!searchQuery.trim()) return base;
        const q = searchQuery.toLowerCase();
        return base.filter(u =>
            u.fullName.toLowerCase().includes(q) ||
            u.role.toLowerCase().includes(q) ||
            (u.email || '').toLowerCase().includes(q)
        );
    };

    const filtered = getFilteredUsers();
    const pendingCount = pendingUsers.length;

    const FILTER_TABS: { key: FilterTab; label: string; count?: number }[] = [
        { key: 'all', label: 'All' },
        { key: 'pending', label: 'Pending', count: pendingCount },
        { key: 'active', label: 'Active' },
    ];

    const getRoleIcon = (role: string): keyof typeof MaterialIcons.glyphMap => {
        switch (role) {
            case 'admin': return 'stars';
            case 'main_office': return 'business';
            case 'collector': return 'people';
            case 'loan_encoder': return 'post-add';
            case 'payment_encoder': return 'payments';
            case 'expenses_encoder': return 'receipt-long';
            case 'branch_cashier': return 'point-of-sale';
            case 'branch_manager': return 'storefront';
            case 'area_supervisor': return 'map';
            case 'commissary_keeper': return 'inventory-2';
            case 'executive': return 'insights';
            default: return 'person';
        }
    };

    const getRoleColor = (role: string): string => {
        switch (role) {
            case 'admin': return Colors.roleAdmin;
            case 'main_office': return Colors.roleAdmin;
            case 'collector': return Colors.roleCollector;
            case 'loan_encoder': return Colors.roleLoanEncoder;
            case 'payment_encoder': return Colors.rolePaymentEncoder;
            case 'expenses_encoder': return Colors.roleExpensesEncoder;
            case 'branch_cashier': return Colors.roleBranchCashier || '#047857';
            case 'branch_manager': return Colors.roleBranchManager || '#0284c7';
            case 'area_supervisor': return Colors.roleAreaSupervisor || '#b45309';
            case 'commissary_keeper': return Colors.roleCommissaryKeeper || '#d97706';
            case 'executive': return Colors.roleExecutive || '#4f46e5';
            default: return Colors.roleBorrower;
        }
    };

    const renderItem = ({ item }: { item: UserProfile }) => {
        const isPending = !item.isActive;
        const roleColor = getRoleColor(item.role);
        const roleLabel = ROLE_LABELS[item.role as keyof typeof ROLE_LABELS] || item.role;
        const branchName = item.branchId ? (branchesMap[item.branchId] || item.branchId) : null;

        return (
            <Pressable
                className="bg-white p-4 rounded-2xl mb-3 border shadow-sm flex-row items-center active:opacity-70"
                style={{ borderColor: isPending ? '#F59E0B' : '#F1F5F9' }}
                onPress={() => router.push(`/(admin)/users/${item.id}`)}
            >
                <View
                    className="w-12 h-12 rounded-full items-center justify-center mr-4"
                    style={{ backgroundColor: isPending ? '#FEF3C7' : `${roleColor}15` }}
                >
                    <MaterialIcons name={getRoleIcon(item.role)} size={24} color={isPending ? '#D97706' : roleColor} />
                </View>
                <View className="flex-1">
                    <View className="flex-row items-center">
                        <Text className="text-base font-bold text-slate-800" numberOfLines={1}>
                            {item.fullName || 'Unnamed'}
                        </Text>
                        {isPending && (
                            <View className="ml-2 bg-amber-100 px-2 py-0.5 rounded-md">
                                <Text className="text-amber-700 text-[10px] font-black uppercase tracking-wider">
                                    Pending
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text className="text-sm text-slate-500 mt-0.5" numberOfLines={1}>
                        {item.email || 'No email'}
                    </Text>
                    <View className="flex-row flex-wrap items-center mt-1.5">
                        <View
                            className="px-2 py-0.5 rounded-md mr-2"
                            style={{ backgroundColor: `${roleColor}15` }}
                        >
                            <Text className="text-xs font-semibold" style={{ color: roleColor }}>
                                {roleLabel}
                            </Text>
                        </View>
                        {branchName && (
                            <View className="flex-row items-center px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200">
                                <MaterialIcons name="storefront" size={11} color="#047857" className="mr-1" />
                                <Text className="text-[11px] font-bold text-emerald-800" numberOfLines={1}>
                                    {branchName}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
                <MaterialIcons name="chevron-right" size={24} color="#CBD5E1" />
            </Pressable>
        );
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-slate-50">
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-slate-50">
            {/* Pending Approval Banner */}
            {pendingCount > 0 && (
                <Pressable
                    className="mx-4 mt-3 p-4 rounded-2xl flex-row items-center border"
                    style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}
                    onPress={() => setActiveFilter('pending')}
                >
                    <View className="w-10 h-10 rounded-full bg-amber-100 items-center justify-center mr-3">
                        <MaterialIcons name="pending-actions" size={22} color="#D97706" />
                    </View>
                    <View className="flex-1">
                        <Text className="text-amber-800 font-bold text-sm">
                            {pendingCount} Account{pendingCount !== 1 ? 's' : ''} Pending Approval
                        </Text>
                        <Text className="text-amber-600 text-xs mt-0.5">
                            Tap to review and activate
                        </Text>
                    </View>
                    <MaterialIcons name="arrow-forward-ios" size={16} color="#D97706" />
                </Pressable>
            )}

            {/* Filter Tabs */}
            <View className="flex-row mx-4 mt-3 mb-2 bg-slate-100 rounded-xl p-1">
                {FILTER_TABS.map((tab) => {
                    const isActive = activeFilter === tab.key;
                    return (
                        <Pressable
                            key={tab.key}
                            onPress={() => setActiveFilter(tab.key)}
                            className="flex-1 py-2.5 rounded-lg items-center justify-center flex-row"
                            style={{ backgroundColor: isActive ? '#FFFFFF' : 'transparent' }}
                        >
                            <Text
                                className="font-bold text-sm"
                                style={{ color: isActive ? Colors.primary : '#64748B' }}
                            >
                                {tab.label}
                            </Text>
                            {tab.count !== undefined && tab.count > 0 && (
                                <View className="ml-1.5 bg-amber-500 rounded-full min-w-[18px] h-[18px] items-center justify-center">
                                    <Text className="text-white text-[10px] font-bold">
                                        {tab.count}
                                    </Text>
                                </View>
                            )}
                        </Pressable>
                    );
                })}
            </View>

            {/* Search */}
            <View className="px-4 pb-2">
                <SearchBar
                    placeholder="Search users..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {/* User List */}
            <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
                ListEmptyComponent={
                    <View className="items-center py-12">
                        <MaterialIcons name="people-outline" size={48} color="#CBD5E1" />
                        <Text className="text-slate-400 font-semibold mt-3 text-base">
                            {activeFilter === 'pending' ? 'No pending accounts' :
                             activeFilter === 'active' ? 'No active accounts' : 'No users found'}
                        </Text>
                    </View>
                }
            />
        </View>
    );
}
