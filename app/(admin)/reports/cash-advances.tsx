import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as Print from 'expo-print';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import Borrower from '../../../src/database/models/Borrower';
import Loan from '../../../src/database/models/Loan';
import { CashAdvanceReportRow, CashAdvanceReportService } from '../../../src/services/CashAdvanceReportService';
import { formatPHP } from '../../../src/utils/currency';

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

export default function CashAdvancesReportScreen() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<CashAdvanceReportRow[]>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const loans = await database.collections.get<Loan>('loans').query(
                    Q.where('deleted_at', Q.eq(null)),
                    Q.where('loan_type', Q.oneOf(['cash_advance', 'salary_cash_advance']))
                ).fetch();
                const borrowerIds = Array.from(new Set(loans.map(l => l.borrowerId)));
                const borrowers = borrowerIds.length ? await database.collections.get<Borrower>('borrowers').query(Q.where('id', Q.oneOf(borrowerIds))).fetch() : [];
                const borrowerMap = new Map(borrowers.map(b => [b.id, b]));
                const rows = loans.map(loan => {
                    const borrower = borrowerMap.get(loan.borrowerId);
                    return {
                        clientNumber: loan.loanNumber,
                        establishment: borrower?.business || borrower?.group || '',
                        institution: borrower?.group || '',
                        clientName: borrower?.fullName || 'Unknown',
                        date: loan.releaseDate,
                        maturityDate: loan.maturityDate,
                        termsInMonths: loan.termUnit === 'days' ? Math.ceil((loan.term || 0) / 30) : loan.term,
                        ratePerMonth: (loan.interestRate || 0) / 100,
                        chequeAmount: 0,
                        cashAmount: loan.principalAmount || 0,
                        deductions: loan.notes || '',
                    };
                });
                setRows(rows);
            } catch (error) {
                console.error('Failed to load cash advances:', error);
                Alert.alert('Error', 'Failed to load cash advances report.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const total = rows.reduce((sum, row) => sum + CashAdvanceReportService.totalAdvance(row), 0);
    if (loading) return <ActivityIndicator className="flex-1 bg-gray-50 pt-20" size="large" color="#1E3A8A" />;

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-4">
                <Text className="text-2xl font-black text-gray-900">Cash Advances</Text>
                <Text className="text-gray-700 mt-1">Cash advance monitoring report grouped from cash-advance loan products.</Text>
                <Text className="font-black text-green-700 mt-3">Total Advances: {formatPHP(total)}</Text>
                <Pressable className="mt-4 bg-blue-900 rounded-2xl py-3 flex-row justify-center items-center" onPress={() => printHtml(CashAdvanceReportService.buildHtml(rows))}>
                    <MaterialIcons name="print" size={20} color="#fff" />
                    <Text className="text-white font-black ml-2">Print / Export</Text>
                </Pressable>
            </View>
            {rows.length === 0 ? <Text className="text-center text-gray-500 mt-10">No cash advance records yet.</Text> : rows.map((row, index) => (
                <View key={`${row.clientNumber}-${index}`} className="bg-white rounded-2xl p-4 mb-2 border border-gray-100">
                    <Text className="font-black text-gray-900">{row.clientName}</Text>
                    <Text className="text-xs text-gray-700">{row.clientNumber} • {row.establishment}</Text>
                    <Text className="text-sm font-bold text-green-700 mt-1">{formatPHP(CashAdvanceReportService.totalAdvance(row))}</Text>
                </View>
            ))}
        </ScrollView>
    );
}

