import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, Pressable, Platform, Alert, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import Loan from '../../../src/database/models/Loan';
import Borrower from '../../../src/database/models/Borrower';
import { MaterialIcons } from '@expo/vector-icons';
import { SearchBar } from '../../../src/components/SearchBar';
import { formatPHP } from '../../../src/utils/currency';
import SwipeableItem from '../../../src/components/SwipeableItem';
import ConfirmDialog from '../../../src/components/ConfirmDialog';
import BaseModelService from '../../../src/services/BaseModelService';
import { PaginatedDataView, Column } from '../../../src/components/PaginatedDataView';
import { format } from 'date-fns';
import { formatDate } from '../../../src/utils/dates';

function LoanRow({ loan, onRowPress, isCard = false }: { loan: Loan; onRowPress: (id: string) => void; isCard?: boolean }) {
    const router = useRouter();
    const [borrowerName, setBorrowerName] = useState('Loading...');

    useEffect(() => {
        let isMounted = true;
        database.collections.get<Borrower>('borrowers').find(loan.borrowerId)
            .then(b => {
                if (isMounted) setBorrowerName(b.fullName);
            })
            .catch(() => {
                if (isMounted) setBorrowerName('Unknown');
            });
        return () => { isMounted = false; };
    }, [loan.borrowerId]);

    if (isCard) {
        return (
            <Pressable
                testID={`loan-card-${loan.id}`}
                className="bg-white p-4 rounded-2xl mb-3 border border-gray-100 shadow-sm active:opacity-70"
                onPress={() => onRowPress(loan.id)}
            >
                <View className="flex-row justify-between items-start mb-2">
                    <View>
                        <Pressable onPress={() => router.push(`/(admin)/borrowers/${loan.borrowerId}`)}>
                            <Text className="text-base font-bold text-blue-700 underline">{borrowerName}</Text>
                        </Pressable>
                        <View className="flex-row items-center mt-0.5">
                            <Text className="text-xs font-bold text-gray-700">{loan.loanNumber}</Text>
                            {loan.isReloan && (
                                <View className="ml-2 px-1.5 py-0.5 bg-blue-100 rounded-md">
                                    <Text className="text-[8px] font-black uppercase text-blue-700">Renewal</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <View className={`px-2 py-1 rounded ${loan.status === 'active' ? 'bg-blue-50' :
                        loan.status === 'paid' ? 'bg-green-50' :
                            loan.status === 'defaulted' ? 'bg-red-50' : 'bg-gray-100'
                        }`}>
                        <Text className={`text-[10px] font-black uppercase tracking-wider ${loan.status === 'active' ? 'text-blue-800' :
                            loan.status === 'paid' ? 'text-green-800' :
                                loan.status === 'defaulted' ? 'text-red-800' : 'text-gray-800'
                            }`}>{loan.status}</Text>
                    </View>
                </View>

                <View className="h-px bg-gray-50 my-2" />

                <View className="flex-row justify-between items-center">
                    <View>
                        <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">Principal</Text>
                        <Text className="text-sm font-extrabold text-blue-900 mt-0.5">{formatPHP(loan.principalAmount)}</Text>
                    </View>
                    <View className="items-center">
                        <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">Insurance</Text>
                        <Text className="text-sm font-bold text-orange-600 mt-0.5">{formatPHP(loan.insuranceAmount || 0)}</Text>
                    </View>
                    <View className="items-end">
                        <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">Total Amnt</Text>
                        <Text className="text-sm font-extrabold text-red-700 mt-0.5">{formatPHP(loan.totalAmount)}</Text>
                    </View>
                </View>
            </Pressable>
        );
    }

    // List view
    return (
        <Pressable
            className="bg-white p-4 border-b border-gray-100 flex-row items-center justify-between active:opacity-70"
            onPress={() => onRowPress(loan.id)}
        >
            <View>
                <Text className="text-base font-bold text-gray-900">{borrowerName}</Text>
                <Text className="text-xs text-gray-500">{loan.loanNumber}</Text>
            </View>
            <View className="items-end">
                <Text className="font-bold text-red-700">{formatPHP(loan.totalAmount)}</Text>
                <Text className={`text-[10px] font-bold uppercase mt-1 ${loan.status === 'active' ? 'text-blue-600' : loan.status === 'paid' ? 'text-green-600' : 'text-gray-500'}`}>{loan.status}</Text>
            </View>
        </Pressable>
    );
}

// Separate cell component for Tabular view to fetch borrower name
function BorrowerNameCell({ borrowerId }: { borrowerId: string }) {
    const router = useRouter();
    const [borrowerName, setBorrowerName] = useState('Loading...');

    useEffect(() => {
        let isMounted = true;
        database.collections.get<Borrower>('borrowers').find(borrowerId)
            .then(b => { if (isMounted) setBorrowerName(b.fullName); })
            .catch(() => { if (isMounted) setBorrowerName('Unknown'); });
        return () => { isMounted = false; };
    }, [borrowerId]);

    return (
        <Pressable onPress={() => router.push(`/(admin)/borrowers/${borrowerId}`)}>
            <Text className="text-blue-600 font-bold" numberOfLines={1}>{borrowerName}</Text>
        </Pressable>
    );
}

export default function LoansListScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
    const [isConfirmDeleteVisible, setIsConfirmDeleteVisible] = useState(false);
    const [visibleSwipeActionId, setVisibleSwipeActionId] = useState<string | null>(null);

    // Track search query clauses
    const [queryClauses, setQueryClauses] = useState<Q.Clause[]>([]);

    useEffect(() => {
        const buildClauses = async () => {
            const clauses: Q.Clause[] = [];
            
            if (filterStatus !== 'all') {
                clauses.push(Q.where('status', filterStatus));
            }

            if (searchQuery) {
                // To search by borrower name, fetch matching borrowers first
                try {
                    const matchingBorrowers = await database.collections.get<Borrower>('borrowers')
                        .query(
                            Q.where('full_name', Q.like(`%${Q.sanitizeLikeString(searchQuery)}%`)),
                            Q.where('deleted_at', Q.eq(null)),
                            Q.take(50)
                        ).fetch();
                    
                    const borrowerIds = matchingBorrowers.map(b => b.id);
                    
                    clauses.push(
                        Q.or(
                            Q.where('loan_number', Q.like(`%${Q.sanitizeLikeString(searchQuery)}%`)),
                            Q.where('borrower_id', Q.oneOf(borrowerIds))
                        )
                    );
                } catch (e) {
                    console.warn("Failed to lookup borrower for search", e);
                    clauses.push(Q.where('loan_number', Q.like(`%${Q.sanitizeLikeString(searchQuery)}%`)));
                }
            }

            clauses.push(Q.sortBy('created_at', Q.desc));
            setQueryClauses(clauses);
        };

        const timer = setTimeout(buildClauses, 300); // Debounce search
        return () => clearTimeout(timer);
    }, [searchQuery, filterStatus]);

    const handleDelete = async () => {
        if (!selectedLoan) return;
        try {
            await BaseModelService.cascadeDeleteLoan(selectedLoan);
            setIsConfirmDeleteVisible(false);
            if (Platform.OS === 'web') {
                window.alert('Loan record and related payments moved to trash.');
            } else {
                Alert.alert('Deleted', 'Loan moved to trash.');
            }
            // Trigger refresh (e.g. by tweaking queryClauses slightly or relying on pull-to-refresh)
            setQueryClauses([...queryClauses]); 
        } catch (error) {
            console.error('Failed to delete loan:', error);
            const msg = error instanceof Error ? error.message : "Could not delete loan.";
            Alert.alert("Error", msg);
        }
    };

    const renderCardItem = (item: Loan) => (
        <SwipeableItem
            onActionsVisibilityChange={(isVisible) => {
                setVisibleSwipeActionId((currentId) => isVisible ? item.id : currentId === item.id ? null : currentId);
            }}
            onDelete={() => {
                setSelectedLoan(item);
                setIsConfirmDeleteVisible(true);
            }}
        >
            <LoanRow loan={item} onRowPress={(id) => router.push(`/(admin)/loans/${id}`)} isCard={true} />
        </SwipeableItem>
    );

    const renderListItem = (item: Loan) => (
        <SwipeableItem
            onActionsVisibilityChange={(isVisible) => {
                setVisibleSwipeActionId((currentId) => isVisible ? item.id : currentId === item.id ? null : currentId);
            }}
            onDelete={() => {
                setSelectedLoan(item);
                setIsConfirmDeleteVisible(true);
            }}
        >
            <LoanRow loan={item} onRowPress={(id) => router.push(`/(admin)/loans/${id}`)} isCard={false} />
        </SwipeableItem>
    );

    const columns: Column<Loan>[] = [
        {
            key: 'loanNumber',
            label: 'Loan #',
            width: 120,
            render: (item) => (
                <Pressable onPress={() => router.push(`/(admin)/loans/${item.id}`)}>
                    <Text className="text-blue-600 font-bold">{item.loanNumber}</Text>
                </Pressable>
            )
        },
        {
            key: 'borrowerId',
            label: 'Borrower',
            width: 180,
            render: (item) => <BorrowerNameCell borrowerId={item.borrowerId} />
        },
        {
            key: 'principalAmount',
            label: 'Principal',
            width: 100,
            render: (item) => <Text className="text-gray-800">{formatPHP(item.principalAmount)}</Text>
        },
        {
            key: 'totalAmount',
            label: 'Total Amnt',
            width: 100,
            render: (item) => <Text className="text-red-700 font-bold">{formatPHP(item.totalAmount)}</Text>
        },
        {
            key: 'status',
            label: 'Status',
            width: 90,
            render: (item) => (
                <Text className={`text-xs font-bold uppercase ${
                    item.status === 'active' ? 'text-blue-600' :
                    item.status === 'paid' ? 'text-green-600' : 'text-gray-500'
                }`}>{item.status}</Text>
            )
        },
        {
            key: 'createdAt',
            label: 'Date Created',
            width: 120,
            render: (item) => <Text className="text-gray-600">{formatDate(item.createdAt)}</Text>
        }
    ];

    return (
        <View className="flex-1 bg-gray-50 p-4">
            <View className="mb-2">
                <SearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search by loan # or borrower name..."
                />
            </View>

            <View className="mb-4">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {['all', 'pending', 'active', 'paid', 'defaulted', 'rejected'].map(status => (
                        <Pressable
                            key={status}
                            onPress={() => setFilterStatus(status)}
                            className={`px-4 py-2 rounded-full border mr-2 ${filterStatus === status ? 'bg-blue-900 border-blue-900' : 'bg-white border-gray-200'}`}
                        >
                            <Text className={`text-xs font-bold uppercase tracking-wider ${filterStatus === status ? 'text-white' : 'text-gray-700'}`}>
                                {status}
                            </Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>

            <View className="flex-1">
                {queryClauses && (
                    <PaginatedDataView<Loan>
                        tableName="loans"
                        queryClauses={queryClauses}
                        columns={columns}
                        renderCardItem={renderCardItem}
                        renderListItem={renderListItem}
                        defaultViewMode="table"
                        emptyMessage="No loans found"
                        emptyIcon="money-off"
                    />
                )}
            </View>

            <ConfirmDialog
                visible={isConfirmDeleteVisible}
                title="Delete Loan"
                message={`Are you sure you want to delete Loan ${selectedLoan?.loanNumber}? This will also soft-delete all related payments and schedules. You can restore it from Trash.`}
                confirmLabel="Delete"
                onConfirm={handleDelete}
                onCancel={() => setIsConfirmDeleteVisible(false)}
                isDestructive={true}
            />

            {/* FAB */}
            {!visibleSwipeActionId && (
                <Pressable
                    testID="new-loan-fab"
                    className={`${Platform.OS === 'web' ? 'absolute bottom-6 left-6' : 'absolute bottom-6 right-6'} w-14 h-14 bg-red-700 rounded-full items-center justify-center shadow-lg active:bg-red-800`}
                    onPress={() => router.push('/(admin)/loans/new')}
                >
                    <MaterialIcons name="add" size={28} color="#FFFFFF" />
                </Pressable>
            )}
        </View>
    );
}
