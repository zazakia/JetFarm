import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import * as Print from 'expo-print';
import { Q } from '@nozbe/watermelondb';
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { database } from '../../../src/database';
import Borrower from '../../../src/database/models/Borrower';
import Loan from '../../../src/database/models/Loan';
import { formatPHP } from '../../../src/utils/currency';
import {
    CREDITORS_GROUP_LIFE_ELIGIBLE_LOAN_TYPES,
    CreditorsGroupLifeSummaryRow,
    CreditorsGroupLifeSummaryService,
} from '../../../src/services/CreditorsGroupLifeSummaryService';

const printHtml = async (html: string) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.srcdoc = html;
        document.body.appendChild(iframe);
        iframe.onload = () => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => iframe.remove(), 1000);
        };
        return;
    }

    await Print.printAsync({ html });
};

export default function CreditorsGroupLifeReportScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [rows, setRows] = useState<CreditorsGroupLifeSummaryRow[]>([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const startDate = startOfMonth(currentMonth).getTime();
    const endDate = endOfMonth(currentMonth).getTime();

    const loadData = async () => {
        setLoading(true);
        try {
            const loans = await database.collections.get<Loan>('loans').query(
                Q.where('deleted_at', Q.eq(null)),
                Q.where('loan_type', Q.oneOf([...CREDITORS_GROUP_LIFE_ELIGIBLE_LOAN_TYPES])),
                Q.where('release_date', Q.gte(startDate)),
                Q.where('release_date', Q.lte(endDate)),
                Q.sortBy('release_date', Q.asc)
            ).fetch();

            const borrowerIds = Array.from(new Set(loans.map(loan => loan.borrowerId)));
            const borrowers = borrowerIds.length
                ? await database.collections.get<Borrower>('borrowers').query(Q.where('id', Q.oneOf(borrowerIds))).fetch()
                : [];
            const borrowerMap = new Map(borrowers.map(borrower => [borrower.id, borrower]));

            const nextRows = CreditorsGroupLifeSummaryService.buildRows(
                loans.map(loan => ({
                    loan,
                    borrower: borrowerMap.get(loan.borrowerId) || { fullName: 'Unknown Borrower' },
                }))
            );

            setRows(nextRows);
        } catch (error) {
            console.error('Failed to load creditors group life summary:', error);
            Alert.alert('Error', 'Failed to load creditors group life summary.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadData(); }, [currentMonth]));

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const goToPrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
    const goToNextMonth = () => {
        const next = addMonths(currentMonth, 1);
        if (next <= new Date()) setCurrentMonth(next);
    };

    const totals = CreditorsGroupLifeSummaryService.totals(rows);
    const isCurrentMonth = format(currentMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

    if (loading && !refreshing) {
        return <ActivityIndicator className="flex-1 bg-gray-50 pt-20" size="large" color="#1E3A8A" />;
    }

    return (
        <ScrollView
            className="flex-1 bg-gray-50"
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-4">
                <View className="flex-row items-start justify-between mb-4">
                    <View className="flex-1 pr-4">
                        <Text className="text-2xl font-black text-gray-900">Creditors Group Life</Text>
                        <Text className="text-gray-700 mt-1">Summary sheet for salary and top-up loan insurance submissions.</Text>
                    </View>
                    <View className="bg-green-50 rounded-2xl p-3 border border-green-100">
                        <Text className="text-[10px] text-green-700 font-black uppercase tracking-widest">Service Fee</Text>
                        <Text className="text-green-800 text-lg font-black">10%</Text>
                    </View>
                </View>

                <View className="flex-row items-center justify-between bg-gray-50 rounded-2xl border border-gray-100 px-4 py-3 mb-4">
                    <Pressable onPress={goToPrevMonth} className="p-2 rounded-xl bg-white active:bg-gray-100">
                        <MaterialIcons name="chevron-left" size={24} color="#1E3A8A" />
                    </Pressable>
                    <View className="items-center">
                        <Text className="text-base font-black text-gray-900">{format(currentMonth, 'MMMM yyyy')}</Text>
                        <Text className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">
                            Released {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
                        </Text>
                    </View>
                    <Pressable
                        onPress={goToNextMonth}
                        className={`p-2 rounded-xl ${isCurrentMonth ? 'opacity-30 bg-white' : 'bg-white active:bg-gray-100'}`}
                        disabled={isCurrentMonth}
                    >
                        <MaterialIcons name="chevron-right" size={24} color="#1E3A8A" />
                    </Pressable>
                </View>

                <View className="flex-row gap-3 mb-4">
                    <Metric label="Records" value={String(rows.length)} />
                    <Metric label="Loan Amount" value={formatPHP(totals.amountOfLoan)} />
                    <Metric label="Gross Premium" value={formatPHP(totals.annualGrossPremiumPaid)} />
                </View>

                <Pressable
                    className={`rounded-2xl py-3 flex-row justify-center items-center ${rows.length ? 'bg-blue-900 active:bg-green-900' : 'bg-gray-300'}`}
                    onPress={() => printHtml(CreditorsGroupLifeSummaryService.buildHtml({ rows }))}
                    disabled={rows.length === 0}
                >
                    <MaterialIcons name="print" size={20} color="#fff" />
                    <Text className="text-white font-black ml-2">Print / Export Summary Sheet</Text>
                </Pressable>
            </View>

            {rows.length === 0 ? (
                <View className="items-center justify-center p-10 opacity-60">
                    <MaterialIcons name="health-and-safety" size={52} color="#9CA3AF" />
                    <Text className="text-gray-700 font-bold mt-4 text-center">No salary or top-up loans released this month</Text>
                </View>
            ) : rows.map(row => (
                <View key={`${row.voucherNumber}-${row.lastName}-${row.firstName}`} className="bg-white rounded-2xl p-4 mb-3 border border-gray-100">
                    <View className="flex-row justify-between items-start mb-2">
                        <View className="flex-1 pr-4">
                            <Text className="font-black text-gray-900">{row.lastName}, {row.firstName}</Text>
                            <Text className="text-xs text-gray-500 font-bold uppercase mt-0.5">{row.typeOfLoan} • {row.termMonths} months</Text>
                        </View>
                        <Text className="text-green-700 font-black">{formatPHP(row.annualGrossPremiumPaid)}</Text>
                    </View>
                    <View className="flex-row justify-between border-t border-gray-100 pt-2 mt-2">
                        <Text className="text-xs text-gray-700">Loan: <Text className="font-bold">{formatPHP(row.amountOfLoan)}</Text></Text>
                        <Text className="text-xs text-gray-700">Net: <Text className="font-bold">{formatPHP(row.annualNetPremiumPaid)}</Text></Text>
                        <Text className="text-xs text-gray-700">Fee: <Text className="font-bold">{formatPHP(row.serviceFee)}</Text></Text>
                    </View>
                </View>
            ))}
        </ScrollView>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <View className="flex-1 bg-gray-50 rounded-2xl p-3 border border-gray-100">
            <Text className="text-[10px] text-gray-700 font-black uppercase tracking-widest mb-1">{label}</Text>
            <Text className="text-sm text-gray-900 font-black" numberOfLines={1}>{value}</Text>
        </View>
    );
}
