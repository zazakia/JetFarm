import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import * as Print from 'expo-print';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import Loan from '../../../src/database/models/Loan';
import Borrower from '../../../src/database/models/Borrower';
import PaymentSchedule from '../../../src/database/models/PaymentSchedule';
import { formatPHP } from '../../../src/utils/currency';

type PastDueRow = {
    loanNumber: string;
    borrowerName: string;
    phone: string;
    principalAmount: number;
    totalAmount: number;
    overdueDays: number;
    missedPayments: number;
    installmentAmount: number;
};

const printHtml = async (html: string) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.print(); }
        return;
    }
    await Print.printAsync({ html });
};

export default function PastDueReportScreen() {
    const [rows, setRows] = useState<PastDueRow[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            const today = Date.now();
            const loans = await database.collections.get<Loan>('loans').query(
                Q.where('deleted_at', Q.eq(null)),
                Q.where('status', Q.oneOf(['active', 'defaulted'])),
            ).fetch();

            const borrowerIds = Array.from(new Set(loans.map(l => l.borrowerId)));
            const borrowers = borrowerIds.length
                ? await database.collections.get<Borrower>('borrowers').query(Q.where('id', Q.oneOf(borrowerIds))).fetch()
                : [];
            const bMap = new Map(borrowers.map(b => [b.id, b]));

            const result: PastDueRow[] = [];
            for (const loan of loans) {
                const schedules = await database.collections.get<PaymentSchedule>('payment_schedules').query(
                    Q.where('loan_id', loan.id),
                    Q.where('deleted_at', Q.eq(null)),
                    Q.where('status', Q.oneOf(['pending', 'partial'])),
                    Q.where('due_date', Q.lt(today)),
                ).fetch();
                if (schedules.length === 0) continue;
                const earliest = Math.min(...schedules.map(s => Number(s.dueDate)));
                const overdueDays = Math.floor((today - earliest) / 86400000);
                const borrower = bMap.get(loan.borrowerId);
                result.push({
                    loanNumber: loan.loanNumber,
                    borrowerName: borrower?.fullName ?? 'Unknown',
                    phone: borrower?.phone ?? '',
                    principalAmount: loan.principalAmount,
                    totalAmount: loan.totalAmount,
                    overdueDays,
                    missedPayments: schedules.length,
                    installmentAmount: loan.installmentAmount,
                });
            }
            result.sort((a, b) => b.overdueDays - a.overdueDays);
            setRows(result);
        } catch (e) {
            console.error('[PastDue] load error:', e);
            Alert.alert('Error', 'Failed to load past due report.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { load(); }, []));

    const buildHtml = () => {
        const tableRows = rows.map((r, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${r.borrowerName}</td>
                <td>${r.phone}</td>
                <td>${r.loanNumber}</td>
                <td style="text-align:right">₱${r.principalAmount.toLocaleString()}</td>
                <td style="text-align:right">₱${r.installmentAmount.toLocaleString()}</td>
                <td style="text-align:center">${r.missedPayments}</td>
                <td style="text-align:center">${r.overdueDays}d</td>
            </tr>`).join('');
        return `<html><head><style>
            body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
            h2{text-align:center}
            table{width:100%;border-collapse:collapse}
            th,td{border:1px solid #ccc;padding:4px 6px}
            th{background:#1E3A8A;color:#fff}
        </style></head><body>
            <h2>PAST DUE REPORT</h2>
            <p>Generated: ${new Date().toLocaleDateString()}</p>
            <table>
                <tr><th>#</th><th>Client Name</th><th>Phone</th><th>Loan #</th><th>Principal</th><th>Installment</th><th>Missed</th><th>Days Overdue</th></tr>
                ${tableRows}
            </table>
        </body></html>`;
    };

    if (loading) return <ActivityIndicator className="flex-1 bg-gray-50 pt-20" size="large" color="#1E3A8A" />;

    return (
        <View className="flex-1 bg-gray-50 p-4">
            <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-4">
                <Text className="text-2xl font-black text-gray-900">Past Due Report</Text>
                <Text className="text-gray-700 mt-1">Loans with missed payment schedules.</Text>
                <Text className="font-black text-red-700 mt-2">{rows.length} past due loan{rows.length !== 1 ? 's' : ''}</Text>
                <Pressable
                    className="mt-4 bg-blue-900 rounded-2xl py-3 flex-row justify-center items-center"
                    onPress={() => printHtml(buildHtml())}
                >
                    <MaterialIcons name="print" size={20} color="#fff" />
                    <Text className="text-white font-black ml-2">Print / Export</Text>
                </Pressable>
            </View>
            <FlatList
                data={rows}
                keyExtractor={item => item.loanNumber}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListEmptyComponent={
                    <View className="items-center justify-center py-20">
                        <MaterialIcons name="check-circle" size={64} color="#E5E7EB" />
                        <Text className="text-gray-500 mt-4">No past due loans</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View className="bg-white rounded-2xl p-4 mb-3 border border-gray-100">
                        <View className="flex-row justify-between items-start">
                            <Text className="font-black text-gray-900 text-base">{item.borrowerName}</Text>
                            <View className="bg-red-100 px-2 py-1 rounded">
                                <Text className="text-[10px] font-black text-red-800">{item.overdueDays}d overdue</Text>
                            </View>
                        </View>
                        <Text className="text-xs text-gray-500 mt-0.5">{item.loanNumber} {item.phone ? `• ${item.phone}` : ''}</Text>
                        <View className="flex-row justify-between mt-2">
                            <View>
                                <Text className="text-[10px] text-gray-500 uppercase font-bold">Principal</Text>
                                <Text className="font-bold text-gray-900">{formatPHP(item.principalAmount)}</Text>
                            </View>
                            <View>
                                <Text className="text-[10px] text-gray-500 uppercase font-bold">Installment</Text>
                                <Text className="font-bold text-gray-900">{formatPHP(item.installmentAmount)}</Text>
                            </View>
                            <View>
                                <Text className="text-[10px] text-gray-500 uppercase font-bold">Missed</Text>
                                <Text className="font-bold text-red-700">{item.missedPayments} payment{item.missedPayments !== 1 ? 's' : ''}</Text>
                            </View>
                        </View>
                    </View>
                )}
            />
        </View>
    );
}
