import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, Platform, Alert, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import Borrower from '../../../src/database/models/Borrower';
import Loan from '../../../src/database/models/Loan';
import { MaterialIcons } from '@expo/vector-icons';
import { SearchBar } from '../../../src/components/SearchBar';
import BaseModelService from '../../../src/services/BaseModelService';
import SwipeableItem from '../../../src/components/SwipeableItem';
import ActionSheet from '../../../src/components/ActionSheet';
import ConfirmDialog from '../../../src/components/ConfirmDialog';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { format, isAfter, startOfToday, startOfWeek, startOfMonth } from 'date-fns';
import { PaginatedDataView, Column } from '../../../src/components/PaginatedDataView';
import { formatPHP } from '../../../src/utils/currency';
import { MemberFinancialSummaryService } from '../../../src/services/MemberFinancialSummaryService';

import { isLoanActive } from '../../../src/utils/activeLoanPolicy';

export default function BorrowersListScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [frequencyFilter, setFrequencyFilter] = useState('all');
    const [groupFilter, setGroupFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');
    const [balanceFilter, setBalanceFilter] = useState('all');
    const [borrowerFrequencies, setBorrowerFrequencies] = useState<Record<string, string>>({});
    const [uniqueGroups, setUniqueGroups] = useState<string[]>([]);
    const [borrowerSavings, setBorrowerSavings] = useState<Record<string, number>>({});
    const [borrowerCbu, setBorrowerCbu] = useState<Record<string, number>>({});
    
    // Action & Confirm States
    const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null);
    const [isActionSheetVisible, setIsActionSheetVisible] = useState(false);
    const [isConfirmDeleteVisible, setIsConfirmDeleteVisible] = useState(false);
    const [visibleSwipeActionId, setVisibleSwipeActionId] = useState<string | null>(null);

    const frequencies = [
        { id: 'all', label: 'All' },
        { id: 'daily', label: 'Daily' },
        { id: 'weekly', label: 'Weekly' },
        { id: 'bi_monthly', label: 'Bi-Monthly' },
        { id: 'monthly', label: 'Monthly' },
        { id: 'other', label: 'Other' }
    ];

    const dateFilters = [
        { id: 'all', label: 'All Time' },
        { id: 'today', label: 'Today' },
        { id: 'this_week', label: 'This Week' },
        { id: 'this_month', label: 'This Month' }
    ];

    const balanceFilters = [
        { id: 'all', label: 'All Balances' },
        { id: 'savings', label: 'Has Savings' },
        { id: 'cbu', label: 'Has CBU' },
        { id: 'both', label: 'Savings + CBU' },
    ];

    const loadMetadata = async () => {
        try {
            const loans = await database.collections.get<Loan>('loans').query(Q.where('deleted_at', null)).fetch();
            const fetchedLoans = loans.filter(l => isLoanActive(l.status));
            const frequencyMap: Record<string, string> = {};
            fetchedLoans.forEach(l => {
                frequencyMap[l.borrowerId] = l.frequency || 'other';
            });
            setBorrowerFrequencies(frequencyMap);

            const registrySummaries = await MemberFinancialSummaryService.getRegistrySummaries();
            const savingsMap: Record<string, number> = {};
            const cbuMap: Record<string, number> = {};
            registrySummaries.forEach(summary => {
                savingsMap[summary.borrowerId] = summary.savingsBalance;
                cbuMap[summary.borrowerId] = summary.cbuBalance;
            });
            setBorrowerSavings(savingsMap);
            setBorrowerCbu(cbuMap);

            // Fetch groups just for the filter bar
            const groupsDb = await database.collections.get<Borrower>('borrowers')
                .query(Q.where('deleted_at', Q.eq(null)))
                .fetch();
            const gSet = Array.from(new Set(groupsDb.map(b => b.group).filter(Boolean))).sort();
            setUniqueGroups(gSet);
        } catch (error) {
            console.error('Failed to load metadata:', error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadMetadata();
        }, [])
    );

    const handleDelete = async () => {
        if (!selectedBorrower) return;
        try {
            await BaseModelService.cascadeDeleteBorrower(selectedBorrower);
            setIsConfirmDeleteVisible(false);
            // In a real app we'd refresh the list here. 
            // We can add an event emitter or ref to trigger PaginatedDataView reload.
            Alert.alert("Success", "Borrower deleted.");
        } catch (error: any) {
            console.error('Failed to delete borrower:', error);
            setIsConfirmDeleteVisible(false);
            const msg = error.message || "Failed to delete borrower";
            if (Platform.OS === 'web') {
                window.alert(msg);
            } else {
                Alert.alert("Cannot Delete", msg);
            }
        }
    };

    const queryClauses = useMemo(() => {
        const clauses: Q.Clause[] = [];
        
        if (searchQuery) {
            // Note: address and phone are encrypted, so we can't Q.like them easily
            clauses.push(
                Q.or(
                    Q.where('full_name', Q.like(`%${Q.sanitizeLikeString(searchQuery)}%`)),
                    Q.where('member_id', Q.like(`%${Q.sanitizeLikeString(searchQuery)}%`))
                )
            );
        }

        if (groupFilter !== 'all') {
            clauses.push(Q.where('group', groupFilter));
        }

        if (dateFilter !== 'all') {
            let startTs = 0;
            if (dateFilter === 'today') startTs = startOfToday().getTime();
            else if (dateFilter === 'this_week') startTs = startOfWeek(new Date(), { weekStartsOn: 1 }).getTime();
            else if (dateFilter === 'this_month') startTs = startOfMonth(new Date()).getTime();
            clauses.push(Q.where('created_at', Q.gte(startTs)));
        }

        clauses.push(Q.sortBy('full_name', Q.asc));
        return clauses;
    }, [searchQuery, groupFilter, dateFilter]);

    const filterItem = useCallback((item: Borrower) => {
        const freq = borrowerFrequencies[item.id] || '';
        if (frequencyFilter !== 'all' && freq.toLowerCase() !== frequencyFilter) {
            return false;
        }
        if (balanceFilter === 'savings' && (borrowerSavings[item.id] || 0) <= 0) return false;
        if (balanceFilter === 'cbu' && (borrowerCbu[item.id] || 0) <= 0) return false;
        if (balanceFilter === 'both' && ((borrowerSavings[item.id] || 0) <= 0 || (borrowerCbu[item.id] || 0) <= 0)) return false;
        return true;
    }, [borrowerFrequencies, frequencyFilter, balanceFilter, borrowerSavings, borrowerCbu]);

    const renderListItem = useCallback((item: Borrower) => {
        const freq = borrowerFrequencies[item.id] || '';
        if (frequencyFilter !== 'all' && freq.toLowerCase() !== frequencyFilter) {
            return null; // Local filtering for frequency since it's from loans relation
        }

        return (
            <SwipeableItem
                onActionsVisibilityChange={(isVisible) => {
                    setVisibleSwipeActionId((currentId) => isVisible ? item.id : currentId === item.id ? null : currentId);
                }}
                onEdit={() => router.push(`/(admin)/borrowers/${item.id}/edit`)}
                onDelete={() => {
                    setSelectedBorrower(item);
                    setIsConfirmDeleteVisible(true);
                }}
            >
                <Pressable
                    testID={`borrower-item-${item.id}`}
                    data-testid={`borrower-item-${item.id}`}
                    className="bg-white p-4 border-b border-gray-100 flex-row items-center active:opacity-70"
                    onPress={() => router.push(`/(admin)/borrowers/${item.id}`)}
                    onLongPress={() => {
                        setSelectedBorrower(item);
                        setIsActionSheetVisible(true);
                    }}
                >
                    <View className="w-12 h-12 rounded-full bg-blue-50 items-center justify-center mr-3">
                        <Text className="text-blue-700 font-bold text-lg">{item.fullName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View className="flex-1" style={{ minWidth: 0 }}>
                        <View className="flex-row items-start mb-0.5" style={{ minWidth: 0 }}>
                            <Text className="flex-1 text-base font-bold text-gray-900 leading-5" numberOfLines={2} ellipsizeMode="tail">
                                {item.fullName}
                            </Text>
                            {(item as any).deceased && (
                                <View className="bg-red-50 px-2 py-0.5 rounded border border-red-200 ml-1">
                                    <Text className="text-[9px] text-red-600 font-black uppercase">DECEASED</Text>
                                </View>
                            )}
                            {freq ? (
                                <View className="bg-purple-50 px-2 py-1 rounded border border-purple-100 ml-2 max-w-[92px]">
                                    <Text className="text-[10px] text-purple-700 font-bold uppercase" numberOfLines={1} ellipsizeMode="tail">
                                        {freq.replace('_', '-')}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                        <View className="flex-row items-center mt-0.5">
                            <MaterialIcons name="calendar-today" size={12} color="#9CA3AF" />
                            <Text className="text-[10px] text-gray-700 ml-1" numberOfLines={1}>
                                Added: {format(item.createdAt, 'MMM dd, yyyy')}
                            </Text>
                        </View>
                        {item.decryptedPhone && (
                            <View className="flex-row items-center mt-1">
                                <MaterialIcons name="phone" size={12} color="#4B5563" />
                                <Text className="text-xs text-gray-700 ml-1" numberOfLines={1} ellipsizeMode="tail">
                                    {item.decryptedPhone}
                                </Text>
                            </View>
                        )}
                        <View className="flex-row items-center mt-1">
                            <MaterialIcons name="account-balance-wallet" size={12} color="#1E3A8A" />
                            <Text className="text-[11px] font-semibold text-gray-700 ml-1">
                                CBU: {formatPHP(borrowerCbu[item.id] || 0)} | Savings: {formatPHP(borrowerSavings[item.id] || 0)}
                            </Text>
                        </View>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color="#D1D5DB" className="ml-2" />
                </Pressable>
            </SwipeableItem>
        );
    }, [borrowerFrequencies, frequencyFilter, borrowerCbu, borrowerSavings, router]);

    const columns: Column<Borrower>[] = useMemo(() => [
        { 
            key: 'fullName', 
            label: 'Borrower Name', 
            width: 220,
            render: (item) => (
                <Pressable onPress={() => router.push(`/(admin)/borrowers/${item.id}`)}>
                    <View className="flex-row items-center">
                        <Text className="text-blue-600 font-bold mr-1">{item.fullName}</Text>
                        {(item as any).deceased && (
                            <View className="bg-red-100 px-1 py-0.5 rounded border border-red-200">
                                <Text className="text-[8px] text-red-600 font-extrabold uppercase">DECEASED</Text>
                            </View>
                        )}
                    </View>
                    <Text className="text-xs text-gray-500">{item.memberId || 'No ID'}</Text>
                </Pressable>
            )
        },
        {
            key: 'cbu',
            label: 'CBU Balance',
            width: 120,
            sortValue: (item) => borrowerCbu[item.id] || 0,
            render: (item) => <Text className="text-gray-900 font-bold">{formatPHP(borrowerCbu[item.id] || 0)}</Text>
        },
        {
            key: 'savings',
            label: 'Savings Balance',
            width: 120,
            sortValue: (item) => borrowerSavings[item.id] || 0,
            render: (item) => <Text className="text-gray-900 font-bold">{formatPHP(borrowerSavings[item.id] || 0)}</Text>
        },
        { 
            key: 'phone', 
            label: 'Phone', 
            width: 120,
            render: (item) => <Text className="text-gray-700">{item.decryptedPhone || '-'}</Text>
        },
        { 
            key: 'address', 
            label: 'Address', 
            width: 180,
            render: (item) => <Text className="text-gray-700" numberOfLines={1}>{item.decryptedAddress || '-'}</Text>
        },
        { 
            key: 'group', 
            label: 'Group', 
            width: 100,
            render: (item) => <Text className="text-gray-700">{item.group || '-'}</Text>
        },
        { 
            key: 'createdAt', 
            label: 'Date Added', 
            width: 110,
            render: (item) => <Text className="text-gray-700">{format(item.createdAt, 'MMM dd, yyyy')}</Text>
        },
        {
            key: 'actions',
            label: 'Actions',
            width: 80,
            render: (item) => (
                <Pressable onPress={() => {
                    setSelectedBorrower(item);
                    setIsActionSheetVisible(true);
                }}>
                    <MaterialIcons name="more-vert" size={20} color="#6B7280" />
                </Pressable>
            )
        }
    ], [borrowerCbu, borrowerSavings, router]);

    return (
        <GestureHandlerRootView className="flex-1">
            <View className="flex-1 bg-gray-50 p-4">
            <View className="mb-2.5">
                <SearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search name, phone, or address..."
                />
                
                <View className="mt-2.5 flex-row flex-wrap items-center gap-1.5">
                    {frequencies.map(f => (
                        <Pressable
                            key={f.id}
                            onPress={() => setFrequencyFilter(f.id)}
                            className={`px-2.5 py-1 rounded-full border active:opacity-80 ${
                                frequencyFilter === f.id
                                    ? 'bg-red-700 border-red-700'
                                    : 'bg-white border-gray-200'
                            }`}
                        >
                            <Text className={`text-xs font-bold ${
                                frequencyFilter === f.id ? 'text-white' : 'text-gray-700'
                            }`}>
                                {f.label}
                            </Text>
                        </Pressable>
                    ))}

                    <View className="h-4 w-[1px] bg-gray-300 mx-1" />

                    {dateFilters.map(d => (
                        <Pressable
                            key={d.id}
                            onPress={() => setDateFilter(d.id)}
                            className={`px-2.5 py-1 rounded-full border active:opacity-80 ${
                                dateFilter === d.id
                                    ? 'bg-yellow-500 border-yellow-500'
                                    : 'bg-white border-gray-200'
                            }`}
                        >
                            <Text className={`text-xs font-bold ${
                                dateFilter === d.id ? 'text-white' : 'text-gray-700'
                            }`}>
                                {d.label}
                            </Text>
                        </Pressable>
                    ))}

                    {uniqueGroups.length > 0 && (
                        <>
                            <View className="h-4 w-[1px] bg-gray-300 mx-1" />
                            <Pressable
                                onPress={() => setGroupFilter('all')}
                                className={`px-2.5 py-1 rounded-full border active:opacity-80 ${
                                    groupFilter === 'all'
                                        ? 'bg-blue-700 border-blue-700'
                                        : 'bg-white border-gray-200'
                                }`}
                            >
                                <Text className={`text-xs font-bold ${
                                    groupFilter === 'all' ? 'text-white' : 'text-gray-700'
                                }`}>
                                    All Groups
                                </Text>
                            </Pressable>
                            {uniqueGroups.map(g => (
                                <Pressable
                                    key={g}
                                    onPress={() => setGroupFilter(g)}
                                    className={`px-2.5 py-1 rounded-full border active:opacity-80 ${
                                        groupFilter === g
                                            ? 'bg-blue-700 border-blue-700'
                                            : 'bg-white border-gray-200'
                                    }`}
                                >
                                    <Text className={`text-xs font-bold ${
                                        groupFilter === g ? 'text-white' : 'text-gray-700'
                                    }`}>
                                        {g}
                                    </Text>
                                </Pressable>
                            ))}
                        </>
                    )}

                    <View className="h-4 w-[1px] bg-gray-300 mx-1" />

                    {balanceFilters.map(f => (
                        <Pressable
                            key={f.id}
                            onPress={() => setBalanceFilter(f.id)}
                            className={`px-2.5 py-1 rounded-full border active:opacity-80 ${
                                balanceFilter === f.id
                                    ? 'bg-green-700 border-green-700'
                                    : 'bg-white border-gray-200'
                            }`}
                        >
                            <Text className={`text-xs font-bold ${
                                balanceFilter === f.id ? 'text-white' : 'text-gray-700'
                            }`}>
                                {f.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </View>

            <View className="flex-1">
                <PaginatedDataView<Borrower>
                    tableName="borrowers"
                    queryClauses={queryClauses}
                    columns={columns}
                    renderListItem={renderListItem}
                    defaultViewMode="table"
                    emptyMessage="No borrowers found"
                    emptyIcon="group-off"
                    filterItem={filterItem}
                />
            </View>

                {/* FAB */}
                {!visibleSwipeActionId && (
                    <Pressable
                        testID="new-borrower-fab"
                        className={`${Platform.OS === 'web' ? 'absolute bottom-6 left-6' : 'absolute bottom-6 right-6'} w-14 h-14 bg-red-700 rounded-full items-center justify-center shadow-lg active:bg-red-800`}
                        onPress={() => router.push('/(admin)/borrowers/new')}
                    >
                        <MaterialIcons name="person-add" size={28} color="#FFFFFF" />
                    </Pressable>
                )}
            </View>

            {/* Action Sheet */}
            <ActionSheet
                visible={isActionSheetVisible}
                onClose={() => setIsActionSheetVisible(false)}
                title={selectedBorrower?.fullName}
                actions={[
                    { 
                        id: 'view', 
                        label: 'View Details', 
                        icon: 'eye-outline', 
                        onPress: () => router.push(`/(admin)/borrowers/${selectedBorrower?.id}`) 
                    },
                    { 
                        id: 'edit', 
                        label: 'Edit Borrower', 
                        icon: 'pencil-outline', 
                        onPress: () => router.push(`/(admin)/borrowers/${selectedBorrower?.id}/edit`) 
                    },
                    { 
                        id: 'delete', 
                        label: 'Delete Borrower', 
                        icon: 'trash-outline', 
                        onPress: () => setIsConfirmDeleteVisible(true), 
                        isDestructive: true 
                    },
                ]}
            />

            {/* Confirm Delete */}
            <ConfirmDialog
                visible={isConfirmDeleteVisible}
                title="Delete Borrower?"
                message={`Are you sure you want to delete ${selectedBorrower?.fullName}? This action is reversible by administrators but will hide the borrower from all lists.`}
                confirmLabel="Delete"
                onConfirm={handleDelete}
                onCancel={() => setIsConfirmDeleteVisible(false)}
                isDestructive
            />
        </GestureHandlerRootView>
    );
}
