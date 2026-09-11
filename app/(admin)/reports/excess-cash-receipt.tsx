import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Print from 'expo-print';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import Borrower from '../../../src/database/models/Borrower';
import Loan from '../../../src/database/models/Loan';
import Payment from '../../../src/database/models/Payment';
import {
    ExcessCashReceiptService,
    ExcessCashReportPaymentInput,
    ExcessCashReportRow,
} from '../../../src/services/ExcessCashReceiptService';
import { formatPHP } from '../../../src/utils/currency';
import { COMPANY_NAME } from '../../../src/constants/brand';

const escapeHtml = (value: string | number | undefined | null) =>
    String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[char] as string));

const formatDate = (date: Date) => date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
});

const printHtml = async (html: string) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const w = window.open('', '_blank');
        if (w) {
            w.document.write(html);
            w.document.close();
            w.print();
        }
        return;
    }
    await Print.printAsync({ html });
};

export default function ExcessCashReceiptScreen() {
    const [payments, setPayments] = useState<ExcessCashReportPaymentInput[]>([]);
    const [currentSalary, setCurrentSalary] = useState('');
    const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const salaryAmount = Number.parseFloat(currentSalary) || 0;

    const rows = useMemo<ExcessCashReportRow[]>(() => {
        const normalizedSearch = search.trim().toLowerCase();
        const reportPayments = normalizedSearch
            ? payments.filter(payment => (
                payment.borrowerName.toLowerCase().includes(normalizedSearch) ||
                String(payment.bankAccountNumber || '').toLowerCase().includes(normalizedSearch) ||
                String(payment.receiptNumber || '').toLowerCase().includes(normalizedSearch)
            ))
            : payments;

        return ExcessCashReceiptService.buildReportRows(salaryAmount, reportPayments);
    }, [payments, salaryAmount, search]);

    const totals = useMemo(() => rows.reduce((sum, row) => ({
        currentPayment: sum.currentPayment + row.currentPayment,
        excessCash: sum.excessCash + row.excessCash,
    }), { currentPayment: 0, excessCash: 0 }), [rows]);

    useEffect(() => {
        loadPayments();
    }, []);

    const loadPayments = async () => {
        setLoading(true);
        setErrorMessage('');
        try {
            const start = new Date(`${fromDate}T00:00:00`).getTime();
            const end = new Date(`${toDate}T23:59:59.999`).getTime();

            if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
                setPayments([]);
                setErrorMessage('Please enter a valid date range.');
                return;
            }

            const paymentRecords = await database.get<Payment>('payments').query(
                Q.where('deleted_at', Q.eq(null)),
                Q.where('payment_date', Q.gte(start)),
                Q.where('payment_date', Q.lte(end)),
                Q.sortBy('payment_date', Q.desc)
            ).fetch();

            const borrowerIds = Array.from(new Set(paymentRecords.map(payment => payment.borrowerId).filter(Boolean)));
            const loanIds = Array.from(new Set(paymentRecords.map(payment => payment.loanId).filter(Boolean)));

            const [borrowers, loans] = await Promise.all([
                borrowerIds.length
                    ? database.get<Borrower>('borrowers').query(Q.where('id', Q.oneOf(borrowerIds))).fetch()
                    : Promise.resolve([]),
                loanIds.length
                    ? database.get<Loan>('loans').query(Q.where('id', Q.oneOf(loanIds))).fetch()
                    : Promise.resolve([]),
            ]);

            const borrowerById = new Map(borrowers.map(borrower => [borrower.id, borrower]));
            const loanById = new Map(loans.map(loan => [loan.id, loan]));

            setPayments(paymentRecords.map(payment => {
                const borrower = borrowerById.get(payment.borrowerId);
                const loan = loanById.get(payment.loanId);
                return {
                    id: payment.id,
                    borrowerName: borrower?.fullName || 'Unknown borrower',
                    bankName: borrower?.bankName,
                    bankAccountName: borrower?.bankAccountName,
                    bankAccountNumber: borrower?.bankAccountNumber,
                    loanNumber: loan?.loanNumber || payment.loanId,
                    paymentAmount: payment.amount || 0,
                    currentSalary: payment.currentSalary || 0,
                    excessCash: payment.excessCash || 0,
                    paymentDate: payment.paymentDate as number,
                    receiptNumber: payment.receiptNumber,
                };
            }));
        } catch (error: any) {
            console.warn('[ExcessCashReceipt] Unable to load payment data:', error);
            setPayments([]);
            setErrorMessage(error?.message || 'Unable to load payment records.');
        } finally {
            setLoading(false);
        }
    };

    const buildHtml = () => {
        const generatedAt = new Date();
        return `<html><head><style>
            body{font-family:Arial,sans-serif;padding:32px;color:#111827}
            .header{text-align:center;margin-bottom:18px}
            .company{font-size:18px;font-weight:800;text-transform:uppercase}
            .title{font-size:14px;font-weight:800;letter-spacing:.08em;margin-top:4px;color:#1E3A8A}
            .meta{font-size:11px;color:#4B5563;margin-top:8px}
            table{width:100%;border-collapse:collapse;font-size:11px}
            th{background:#1E3A8A;color:white;text-align:left;padding:8px;border:1px solid #1f3523}
            td{padding:8px;border:1px solid #D1D5DB;vertical-align:top}
            .num{text-align:right;white-space:nowrap}
            .total td{font-weight:800;background:#F3F4F6}
            .note{margin-top:14px;font-size:10px;color:#6B7280}
        </style></head><body>
            <div class="header">
                <div class="company">${escapeHtml(COMPANY_NAME)}</div>
                <div class="title">EXCESS CASH REPORT</div>
                <div class="meta">
                    Payment period: ${escapeHtml(fromDate)} to ${escapeHtml(toDate)}<br/>
                    Saved Current Salary values are used from each payment. Fallback salary for older payments: ${escapeHtml(formatPHP(salaryAmount))}<br/>
                    Generated: ${escapeHtml(generatedAt.toLocaleString())}
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Borrower</th>
                        <th>Savings Bank Account</th>
                        <th>Loan / Receipt</th>
                        <th class="num">Current Salary</th>
                        <th class="num">Current Payment</th>
                        <th class="num">Excess Cash</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr>
                            <td>${escapeHtml(formatDate(row.paymentDate))}</td>
                            <td>${escapeHtml(row.borrowerName)}</td>
                            <td>${escapeHtml(row.savingsBankAccount)}</td>
                            <td>${escapeHtml(row.loanNumber)}<br/>${escapeHtml(row.receiptNumber)}</td>
                            <td class="num">${escapeHtml(formatPHP(row.currentSalary))}</td>
                            <td class="num">${escapeHtml(formatPHP(row.currentPayment))}</td>
                            <td class="num">${escapeHtml(formatPHP(row.excessCash))}</td>
                        </tr>
                    `).join('')}
                    <tr class="total">
                        <td colspan="5">TOTAL</td>
                        <td class="num">${escapeHtml(formatPHP(totals.currentPayment))}</td>
                        <td class="num">${escapeHtml(formatPHP(totals.excessCash))}</td>
                    </tr>
                </tbody>
            </table>
            <div class="note">Formula: Excess Cash = Current Salary / ATM Withdrawal saved on the payment less current payment to loan. Negative results are shown as ₱0.00.</div>
        </body></html>`;
    };

    const handlePrint = async () => {
        if (rows.length === 0) return Alert.alert('No Payments', 'No payment records found for this report.');
        await printHtml(buildHtml());
    };

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-4">
                <Text className="text-2xl font-black text-gray-900 mb-2">Excess Cash Report</Text>
                <Text className="text-sm text-gray-600 mb-5">
                    This report uses the Current Salary / ATM Withdrawal saved when each payment is posted. Enter a fallback salary only for older payments that do not have one saved yet.
                </Text>

                <Text className="text-xs font-bold text-gray-700 uppercase mb-1">Fallback Current Salary / ATM Withdrawal</Text>
                <TextInput
                    className="border border-gray-200 rounded-xl px-4 py-3 mb-4 text-gray-900"
                    value={currentSalary}
                    onChangeText={setCurrentSalary}
                    placeholder="0.00"
                    keyboardType="numeric"
                 placeholderTextColor="#9CA3AF"/>

                <View className="flex-row gap-3 mb-4">
                    <View className="flex-1">
                        <Text className="text-xs font-bold text-gray-700 uppercase mb-1">From</Text>
                        <TextInput className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900" value={fromDate} onChangeText={setFromDate} placeholder="YYYY-MM-DD"  placeholderTextColor="#9CA3AF"/>
                    </View>
                    <View className="flex-1">
                        <Text className="text-xs font-bold text-gray-700 uppercase mb-1">To</Text>
                        <TextInput className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900" value={toDate} onChangeText={setToDate} placeholder="YYYY-MM-DD"  placeholderTextColor="#9CA3AF"/>
                    </View>
                </View>

                <Text className="text-xs font-bold text-gray-700 uppercase mb-1">Search borrower / account / receipt</Text>
                <TextInput className="border border-gray-200 rounded-xl px-4 py-3 mb-4 text-gray-900" value={search} onChangeText={setSearch} placeholder="Type to filter report..."  placeholderTextColor="#9CA3AF"/>

                <View className="flex-row gap-3 mb-4">
                    <Pressable className="flex-1 bg-gray-100 rounded-2xl py-4 flex-row justify-center items-center" onPress={loadPayments}>
                        <MaterialIcons name="refresh" size={20} color="#374151" />
                        <Text className="text-gray-700 font-black ml-2">Refresh</Text>
                    </Pressable>
                    <Pressable className="flex-1 bg-blue-900 rounded-2xl py-4 flex-row justify-center items-center" onPress={handlePrint}>
                        <MaterialIcons name="print" size={20} color="#fff" />
                        <Text className="text-white font-black ml-2">Print Report</Text>
                    </Pressable>
                </View>

                {errorMessage ? (
                    <View className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
                        <Text className="text-red-700 font-semibold">{errorMessage}</Text>
                    </View>
                ) : null}

                <View className="bg-green-50 rounded-2xl p-4 mb-4 border border-green-100">
                    <Text className="text-xs text-green-800 font-bold uppercase">Report Summary</Text>
                    <Text className="text-green-900 font-black mt-1">{rows.length} payment(s)</Text>
                    <Text className="text-green-900 font-black">Total Payment: {formatPHP(totals.currentPayment)}</Text>
                    <Text className="text-green-900 font-black">Total Excess Cash: {formatPHP(totals.excessCash)}</Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#1E3A8A" />
                ) : (
                    <View className="gap-y-3">
                        {rows.map(row => (
                            <View key={row.id} className="border border-gray-100 rounded-2xl p-4 bg-gray-50">
                                <View className="flex-row justify-between gap-3">
                                    <View className="flex-1">
                                        <Text className="font-black text-gray-900">{row.borrowerName}</Text>
                                        <Text className="text-xs text-gray-600 mt-1">{row.savingsBankAccount}</Text>
                                        <Text className="text-xs text-gray-500 mt-1">{formatDate(row.paymentDate)} • Loan {row.loanNumber} • OR {row.receiptNumber}</Text>
                                    </View>
                                    <View className="items-end">
                                        <Text className="text-xs text-gray-500">Excess Cash</Text>
                                        <Text className="text-lg font-black text-blue-900">{formatPHP(row.excessCash)}</Text>
                                    </View>
                                </View>
                                <View className="flex-row justify-between mt-3 pt-3 border-t border-gray-200">
                                    <Text className="text-xs text-gray-700">Salary: {formatPHP(row.currentSalary)}</Text>
                                    <Text className="text-xs text-gray-700">Payment: {formatPHP(row.currentPayment)}</Text>
                                </View>
                            </View>
                        ))}
                        {rows.length === 0 ? (
                            <Text className="text-center text-gray-500 py-8">No payment records found for this date range.</Text>
                        ) : null}
                    </View>
                )}
            </View>
        </ScrollView>
    );
}
