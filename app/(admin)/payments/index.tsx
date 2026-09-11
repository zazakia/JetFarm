import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import Payment from '../../../src/database/models/Payment';
import Loan from '../../../src/database/models/Loan';
import Borrower from '../../../src/database/models/Borrower';
import { MaterialIcons } from '@expo/vector-icons';
import { SearchBar } from '../../../src/components/SearchBar';
import { formatPHP } from '../../../src/utils/currency';
import { formatDate } from '../../../src/utils/dates';
import SwipeableItem from '../../../src/components/SwipeableItem';
import ConfirmDialog from '../../../src/components/ConfirmDialog';
import BaseModelService from '../../../src/services/BaseModelService';
import { PaginatedDataView, Column } from '../../../src/components/PaginatedDataView';

function PaymentRow({ payment, onEdit, onDelete, isCard = false }: { payment: Payment; onEdit: () => void; onDelete: () => void; isCard?: boolean }) {
    const router = useRouter();
    const [borrowerName, setBorrowerName] = useState('Loading...');
    const [loanNumber, setLoanNumber] = useState('Loading...');
    const [borrowerId, setBorrowerId] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        database.collections.get<Loan>('loans').find(payment.loanId)
            .then(loan => {
                if (isMounted) {
                    setLoanNumber(loan.loanNumber);
                    setBorrowerId(loan.borrowerId);
                    // Fetch borrower
                    database.collections.get<Borrower>('borrowers').find(loan.borrowerId)
                        .then(b => { if (isMounted) setBorrowerName(b.fullName); })
                        .catch(() => { if (isMounted) setBorrowerName('Unknown'); });
                }
            })
            .catch(() => {
                if (isMounted) {
                    setLoanNumber('Unknown');
                    setBorrowerName('Unknown');
                }
            });
        return () => { isMounted = false; };
    }, [payment.loanId]);

    const inner = (
        <View className={isCard ? "bg-white p-4 rounded-2xl mb-3 border border-gray-100 shadow-sm flex-row items-center" : "bg-white p-4 border-b border-gray-100 flex-row items-center justify-between"}>
            {isCard && (
                <View className="w-12 h-12 rounded-full bg-green-50 items-center justify-center mr-4">
                    <MaterialIcons name="done" size={24} color="#EAB308" />
                </View>
            )}
            <View className="flex-1">
                <Pressable onPress={() => borrowerId && router.push(`/(admin)/borrowers/${borrowerId}`)}>
                    <Text className="text-base font-bold text-blue-700 underline">{borrowerName}</Text>
                </Pressable>
                <Text className="text-xs text-gray-700 mt-0.5">{loanNumber} • {formatDate(new Date(payment.paymentDate))}</Text>
                {payment.receiptNumber ? (
                    <Text className="text-[10px] font-bold text-gray-700 mt-1 uppercase tracking-widest">RCT: {payment.receiptNumber}</Text>
                ) : null}
            </View>
            <View className="items-end pl-2">
                <Text className="text-sm font-extrabold text-yellow-500">{formatPHP(payment.amount)}</Text>
                <Pressable
                    onPress={onEdit}
                    className="mt-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100"
                >
                    <Text className="text-[10px] font-black text-blue-700 uppercase">Edit</Text>
                </Pressable>
            </View>
        </View>
    );

    return (
        <SwipeableItem
            onEdit={onEdit}
            onDelete={onDelete}
        >
            {inner}
        </SwipeableItem>
    );
}

function PaymentLoanBorrowerCell({ loanId }: { loanId: string }) {
    const router = useRouter();
    const [borrowerName, setBorrowerName] = useState('Loading...');
    const [loanNumber, setLoanNumber] = useState('Loading...');
    const [borrowerId, setBorrowerId] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        database.collections.get<Loan>('loans').find(loanId)
            .then(loan => {
                if (isMounted) {
                    setLoanNumber(loan.loanNumber);
                    setBorrowerId(loan.borrowerId);
                    database.collections.get<Borrower>('borrowers').find(loan.borrowerId)
                        .then(b => { if (isMounted) setBorrowerName(b.fullName); })
                        .catch(() => {});
                }
            })
            .catch(() => {});
        return () => { isMounted = false; };
    }, [loanId]);

    return (
        <View>
            <Pressable onPress={() => borrowerId && router.push(`/(admin)/borrowers/${borrowerId}`)}>
                <Text className="text-blue-600 font-bold" numberOfLines={1}>{borrowerName}</Text>
            </Pressable>
            <Pressable onPress={() => router.push(`/(admin)/loans/${loanId}`)}>
                <Text className="text-xs text-gray-500 mt-0.5">{loanNumber}</Text>
            </Pressable>
        </View>
    );
}

export default function PaymentsListScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [isConfirmDeleteVisible, setIsConfirmDeleteVisible] = useState(false);
    const [queryClauses, setQueryClauses] = useState<Q.Clause[]>([]);

    useEffect(() => {
        const buildClauses = async () => {
            const clauses: Q.Clause[] = [];

            if (searchQuery) {
                try {
                    const safeSearch = Q.sanitizeLikeString(searchQuery);
                    const matchingBorrowers = await database.collections.get<Borrower>('borrowers')
                        .query(Q.where('full_name', Q.like(`%${safeSearch}%`)), Q.take(50)).fetch();
                    
                    const matchingLoans = await database.collections.get<Loan>('loans')
                        .query(Q.where('loan_number', Q.like(`%${safeSearch}%`)), Q.take(50)).fetch();

                    const loanIdsFromBorrowers = await database.collections.get<Loan>('loans')
                        .query(Q.where('borrower_id', Q.oneOf(matchingBorrowers.map(b => b.id))), Q.take(200)).fetch();

                    const combinedLoanIds = Array.from(new Set([
                        ...matchingLoans.map(l => l.id),
                        ...loanIdsFromBorrowers.map(l => l.id)
                    ]));

                    clauses.push(
                        Q.or(
                            Q.where('receipt_number', Q.like(`%${safeSearch}%`)),
                            Q.where('loan_id', Q.oneOf(combinedLoanIds))
                        )
                    );
                } catch (e) {
                    console.warn("Failed to lookup associations for search", e);
                    clauses.push(Q.where('receipt_number', Q.like(`%${Q.sanitizeLikeString(searchQuery)}%`)));
                }
            }

            clauses.push(Q.sortBy('payment_date', Q.desc));
            setQueryClauses(clauses);
        };

        const timer = setTimeout(buildClauses, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleDelete = async () => {
        if (!selectedPayment) return;
        try {
            await BaseModelService.softDelete(selectedPayment);
            setIsConfirmDeleteVisible(false);
            if (Platform.OS === 'web') {
                window.alert('Payment record moved to trash.');
            } else {
                Alert.alert('Deleted', 'Payment moved to trash.');
            }
            setQueryClauses([...queryClauses]); 
        } catch (error) {
            console.error('Failed to delete payment:', error);
            Alert.alert("Error", "Could not delete payment.");
        }
    };

    const renderItem = (item: Payment, isCard: boolean) => (
        <PaymentRow
            payment={item}
            onEdit={() => router.push(`/(admin)/payments/new?paymentId=${item.id}`)}
            onDelete={() => {
                setSelectedPayment(item);
                setIsConfirmDeleteVisible(true);
            }}
            isCard={isCard}
        />
    );

    const columns: Column<Payment>[] = [
        {
            key: 'loanId',
            label: 'Borrower / Loan',
            width: 200,
            render: (item) => <PaymentLoanBorrowerCell loanId={item.loanId} />
        },
        {
            key: 'receiptNumber',
            label: 'Receipt #',
            width: 100,
            render: (item) => <Text className="text-gray-700">{item.receiptNumber || '-'}</Text>
        },
        {
            key: 'amount',
            label: 'Amount',
            width: 100,
            render: (item) => <Text className="text-yellow-500 font-bold">{formatPHP(item.amount)}</Text>
        },
        {
            key: 'paymentDate',
            label: 'Payment Date',
            width: 120,
            render: (item) => <Text className="text-gray-700">{formatDate(new Date(item.paymentDate))}</Text>
        },
        {
            key: 'actions',
            label: 'Actions',
            width: 80,
            render: (item) => (
                <Pressable onPress={() => router.push(`/(admin)/payments/new?paymentId=${item.id}`)}>
                    <MaterialIcons name="edit" size={20} color="#6B7280" />
                </Pressable>
            )
        }
    ];

    return (
        <View className="flex-1 bg-gray-50 p-4">
            {/* Action Bar */}
            <View className="flex-row flex-wrap gap-2 mb-4">
                <Pressable
                    onPress={() => router.push('/(admin)/payments/other-receipt')}
                    className="flex-row items-center bg-emerald-600 px-4 py-2.5 rounded-xl shadow-sm active:bg-emerald-700"
                >
                    <MaterialIcons name="receipt" size={18} color="#FFFFFF" className="mr-1.5" />
                    <Text className="text-white font-black text-xs uppercase">Record Other Receipt</Text>
                </Pressable>
                <Pressable
                    onPress={() => router.push('/(admin)/reports/other-receipts')}
                    className="flex-row items-center bg-white px-4 py-2.5 rounded-xl border border-emerald-300 shadow-sm active:bg-emerald-50"
                >
                    <MaterialIcons name="assessment" size={18} color="#059669" className="mr-1.5" />
                    <Text className="text-emerald-800 font-bold text-xs uppercase">Other Receipts Report</Text>
                </Pressable>
            </View>

            <View className="mb-4">
                <SearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search name, loan #, receipt..."
                />
            </View>

            <View className="flex-1">
                {queryClauses && (
                    <PaginatedDataView<Payment>
                        tableName="payments"
                        queryClauses={queryClauses}
                        columns={columns}
                        renderCardItem={(item) => renderItem(item, true)}
                        renderListItem={(item) => renderItem(item, false)}
                        defaultViewMode="table"
                        emptyMessage="No payments found"
                        emptyIcon="receipt-long"
                    />
                )}
            </View>

            <ConfirmDialog
                visible={isConfirmDeleteVisible}
                title="Delete Payment"
                message={`Are you sure you want to delete this payment of ${selectedPayment ? formatPHP(selectedPayment.amount) : ''}? This can be recovered from Trash.`}
                confirmLabel="Delete"
                onConfirm={handleDelete}
                onCancel={() => setIsConfirmDeleteVisible(false)}
                isDestructive={true}
            />

            {/* FAB */}
            <Pressable
                className={`${Platform.OS === 'web' ? 'absolute bottom-6 left-6' : 'absolute bottom-6 right-6'} flex-row items-center bg-red-700 px-6 py-4 rounded-full shadow-xl active:bg-red-800`}
                onPress={() => router.push('/(admin)/payments/new')}
            >
                <MaterialIcons name="add" size={24} color="#FFFFFF" className="mr-2" />
                <Text className="text-white font-black uppercase tracking-wider">Add Payment</Text>
            </Pressable>
        </View>
    );
}
