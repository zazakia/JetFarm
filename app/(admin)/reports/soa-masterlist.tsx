import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as Print from 'expo-print';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import Borrower from '../../../src/database/models/Borrower';
import Loan from '../../../src/database/models/Loan';
import Payment from '../../../src/database/models/Payment';
import { ClientSoaMasterlistRow, ClientSoaMasterlistService } from '../../../src/services/ClientSoaMasterlistService';
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

const splitName = (borrower: Borrower) => {
    const parts = (borrower.fullName || '').trim().split(/\s+/);
    return {
        firstName: borrower.firstName || parts.slice(0, -1).join(' ') || borrower.fullName,
        lastName: borrower.lastName || parts.slice(-1)[0] || '',
        middleInitial: '',
    };
};

export default function SoaMasterlistReportScreen() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<ClientSoaMasterlistRow[]>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const loans = await database.collections.get<Loan>('loans').query(Q.where('deleted_at', Q.eq(null))).fetch();
                const borrowerIds = Array.from(new Set(loans.map(l => l.borrowerId)));
                const borrowers = borrowerIds.length ? await database.collections.get<Borrower>('borrowers').query(Q.where('id', Q.oneOf(borrowerIds))).fetch() : [];
                const payments = loans.length ? await database.collections.get<Payment>('payments').query(Q.where('loan_id', Q.oneOf(loans.map(l => l.id)))).fetch() : [];
                const borrowerMap = new Map(borrowers.map(b => [b.id, b]));
                const rows = loans.map(loan => {
                    const borrower = borrowerMap.get(loan.borrowerId);
                    const name = borrower ? splitName(borrower) : { firstName: 'Unknown', lastName: '', middleInitial: '' };
                    const loanPayments = payments.filter(p => p.loanId === loan.id);
                    return {
                        ...name,
                        accountNumber: loan.loanNumber,
                        loanType: loan.loanType || loan.interestType,
                        establishment: borrower?.business || borrower?.group || '',
                        soaReferenceNumber: `SOA_${loan.loanNumber}`,
                        loanDate: loan.releaseDate,
                        totalPromissoryNoteAmount: loan.totalAmount || 0,
                        amountPaid: loanPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0),
                        principalPaid: loanPayments.reduce((sum, payment) => sum + Math.min(payment.amount || 0, loan.principalAmount || 0), 0),
                    };
                });
                setRows(rows);
            } catch (error) {
                console.error('Failed to load SOA masterlist:', error);
                Alert.alert('Error', 'Failed to load SOA masterlist.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const totalBalance = rows.reduce((sum, row) => sum + ClientSoaMasterlistService.balance(row), 0);
    if (loading) return <ActivityIndicator className="flex-1 bg-gray-50 pt-20" size="large" color="#1E3A8A" />;

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-4">
                <Text className="text-2xl font-black text-gray-900">Clients SOA Masterlist</Text>
                <Text className="text-gray-700 mt-1">All-client statement-of-account masterlist.</Text>
                <Text className="font-black text-red-700 mt-3">Total Balance: {formatPHP(totalBalance)}</Text>
                <Pressable className="mt-4 bg-blue-900 rounded-2xl py-3 flex-row justify-center items-center" onPress={() => printHtml(ClientSoaMasterlistService.buildHtml(rows))}>
                    <MaterialIcons name="print" size={20} color="#fff" />
                    <Text className="text-white font-black ml-2">Print / Export</Text>
                </Pressable>
            </View>
            {rows.slice(0, 75).map((row, index) => (
                <View key={`${row.accountNumber}-${index}`} className="bg-white rounded-2xl p-4 mb-2 border border-gray-100">
                    <Text className="font-black text-gray-900">{row.lastName}, {row.firstName}</Text>
                    <Text className="text-xs text-gray-700">{row.accountNumber} • {row.soaReferenceNumber}</Text>
                    <Text className="text-sm font-bold text-red-700 mt-1">Balance {formatPHP(ClientSoaMasterlistService.balance(row))}</Text>
                </View>
            ))}
        </ScrollView>
    );
}

