import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as Print from 'expo-print';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import Borrower from '../../../src/database/models/Borrower';
import Loan from '../../../src/database/models/Loan';
import Payment from '../../../src/database/models/Payment';
import PaymentSchedule from '../../../src/database/models/PaymentSchedule';
import { MonthlySalesReportRow, MonthlySalesReportService } from '../../../src/services/MonthlySalesReportService';
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

const toTime = (value?: Date | number | null) => {
    if (!value) return 0;
    return value instanceof Date ? value.getTime() : value;
};

export default function MonthlySalesReportScreen() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<MonthlySalesReportRow[]>([]);
    const month = new Date();

    useEffect(() => {
        const load = async () => {
            try {
                const start = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
                const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime();
                const schedules = await database.collections.get<PaymentSchedule>('payment_schedules').query(
                    Q.where('due_date', Q.gte(start)),
                    Q.where('due_date', Q.lt(end))
                ).fetch();
                const loanIds = Array.from(new Set(schedules.map(s => s.loanId)));
                const loans = loanIds.length ? await database.collections.get<Loan>('loans').query(Q.where('id', Q.oneOf(loanIds))).fetch() : [];
                const borrowerIds = Array.from(new Set(loans.map(l => l.borrowerId)));
                const borrowers = borrowerIds.length ? await database.collections.get<Borrower>('borrowers').query(Q.where('id', Q.oneOf(borrowerIds))).fetch() : [];
                const payments = loanIds.length ? await database.collections.get<Payment>('payments').query(Q.where('loan_id', Q.oneOf(loanIds))).fetch() : [];
                const loanMap = new Map(loans.map(l => [l.id, l]));
                const borrowerMap = new Map(borrowers.map(b => [b.id, b]));
                const rows = schedules.map(schedule => {
                    const loan = loanMap.get(schedule.loanId);
                    const borrower = loan ? borrowerMap.get(loan.borrowerId) : null;
                    const scheduleDueTime = toTime(schedule.dueDate);
                    const payment = payments.find(p => p.scheduleId === schedule.id || (p.loanId === schedule.loanId && Math.abs(toTime(p.paymentDate) - scheduleDueTime) < 86400000 * 3));
                    return {
                        dueDate: schedule.dueDate,
                        customerName: borrower?.fullName || 'Unknown',
                        establishment: borrower?.business || borrower?.group || '',
                        accountNumber: loan?.loanNumber || schedule.loanId,
                        status: schedule.status,
                        datePaid: payment?.paymentDate || null,
                        amountPaid: payment?.amount || 0,
                        principal: schedule.principalAmount || 0,
                        interest: schedule.interestAmount || 0,
                        vat: schedule.feesAmount || 0,
                        unclaimedRebates: loan?.rebateAmount || 0,
                    };
                });
                setRows(rows);
            } catch (error) {
                console.error('Failed to load monthly sales report:', error);
                Alert.alert('Error', 'Failed to load monthly sales report.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const totals = MonthlySalesReportService.totals(rows);
    if (loading) return <ActivityIndicator className="flex-1 bg-gray-50 pt-20" size="large" color="#1E3A8A" />;

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-4">
                <Text className="text-2xl font-black text-gray-900">Monthly Summary Sales</Text>
                <Text className="text-gray-700 mt-1">Sample-format monthly collections report for the current month.</Text>
                <Pressable className="mt-4 bg-blue-900 rounded-2xl py-3 flex-row justify-center items-center" onPress={() => printHtml(MonthlySalesReportService.buildHtml(rows, month))}>
                    <MaterialIcons name="print" size={20} color="#fff" />
                    <Text className="text-white font-black ml-2">Print / Export</Text>
                </Pressable>
            </View>
            <View className="flex-row flex-wrap justify-between mb-4">
                <Metric label="Amount Paid" value={formatPHP(totals.amountPaid)} />
                <Metric label="Principal" value={formatPHP(totals.principal)} />
                <Metric label="Interest" value={formatPHP(totals.interest)} />
                <Metric label="Fees" value={formatPHP(totals.vat)} />
            </View>
            {rows.slice(0, 50).map((row, index) => (
                <View key={`${row.accountNumber}-${index}`} className="bg-white rounded-2xl p-4 mb-2 border border-gray-100">
                    <Text className="font-black text-gray-900">{row.customerName}</Text>
                    <Text className="text-xs text-gray-700">{row.accountNumber} • {row.status || 'pending'}</Text>
                    <Text className="text-sm font-bold text-green-700 mt-1">{formatPHP(row.amountPaid)}</Text>
                </View>
            ))}
        </ScrollView>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return <View className="w-[48%] bg-white rounded-2xl p-4 mb-3 border border-gray-100"><Text className="text-[10px] uppercase font-black text-gray-500">{label}</Text><Text className="font-black text-gray-900 mt-1">{value}</Text></View>;
}
