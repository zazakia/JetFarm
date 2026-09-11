import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Print from 'expo-print';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import Borrower from '../../../src/database/models/Borrower';
import Loan from '../../../src/database/models/Loan';
import { formatPHP } from '../../../src/utils/currency';
import { LandBankSubmissionReportService } from '../../../src/services/LandBankSubmissionReportService';

type ExportRow = {
    accountNumber: string;
    accountName: string;
    bankName: string;
    amount: number;
    loanNumber: string;
};

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

const downloadText = (content: string, filename: string) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    } else {
        Alert.alert('Export', 'File export is available on web. On mobile, copy the text below.');
    }
};

export default function BankExportScreen() {
    const [rows, setRows] = useState<ExportRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [textContent, setTextContent] = useState('');
    const [activeTab, setActiveTab] = useState<'standard' | 'landbank'>('standard');

    const load = async () => {
        setLoading(true);
        try {
            const startOfDay = new Date(filterDate).setHours(0, 0, 0, 0);
            const endOfDay = new Date(filterDate).setHours(23, 59, 59, 999);

            const loans = await database.collections.get<Loan>('loans').query(
                Q.where('deleted_at', Q.eq(null)),
                Q.where('status', Q.oneOf(['active', 'pending'])),
                Q.where('release_date', Q.gte(startOfDay)),
                Q.where('release_date', Q.lte(endOfDay))
            ).fetch();

            const borrowerIds = Array.from(new Set(loans.map((l) => l.borrowerId)));
            const borrowers = borrowerIds.length
                ? await database.collections.get<Borrower>('borrowers').query(Q.where('id', Q.oneOf(borrowerIds))).fetch()
                : [];
            const bMap = new Map(borrowers.map((b) => [b.id, b]));

            const result: ExportRow[] = loans
                .filter((l) => {
                    const b = bMap.get(l.borrowerId);
                    return b?.bankAccountNumber;
                })
                .map((l) => {
                    const b = bMap.get(l.borrowerId)!;
                    return {
                        accountNumber: b.bankAccountNumber ?? '',
                        accountName: b.bankAccountName ?? b.fullName,
                        bankName: b.bankName ?? '',
                        amount: l.principalAmount,
                        loanNumber: l.loanNumber,
                    };
                });

            setRows(result);
            buildText(result);
        } catch (e) {
            console.error('[BankExport] load error:', e);
            Alert.alert('Error', 'Failed to load data.');
        } finally {
            setLoading(false);
        }
    };

    const buildText = (data: ExportRow[]) => {
        const header = `BATCH CREDIT TRANSFER - ${filterDate}\n${'='.repeat(80)}\n`;
        const colHeader = `${'ACCOUNT NO'.padEnd(20)}${'ACCOUNT NAME'.padEnd(30)}${'BANK'.padEnd(15)}${'AMOUNT'.padStart(15)}\n${'-'.repeat(80)}\n`;
        const lines = data
            .map(
                (r) =>
                    `${r.accountNumber.padEnd(20)}${r.accountName.padEnd(30)}${r.bankName.padEnd(15)}${r.amount.toFixed(2).padStart(15)}`
            )
            .join('\n');
        const total = data.reduce((s, r) => s + r.amount, 0);
        const footer = `\n${'-'.repeat(80)}\n${'TOTAL'.padEnd(65)}${total.toFixed(2).padStart(15)}\nRecord Count: ${data.length}`;
        setTextContent(header + colHeader + lines + footer);
    };

    const handlePrintLandBankReport = async () => {
        if (rows.length === 0) {
            Alert.alert('No Records', 'No bank disbursal records to generate LandBank report.');
            return;
        }

        const reportRows = rows.map((r) => ({
            accountNumber: r.accountNumber,
            accountName: r.accountName,
            amount: r.amount,
        }));

        const html = LandBankSubmissionReportService.buildHtml({
            rows: reportRows,
            reportDate: new Date(filterDate),
            branch: 'Main Branch',
            batchNumber: `LB-${filterDate.replace(/-/g, '')}-01`,
            preparedBy: 'Admin Disbursing Officer',
        });

        await printHtml(html);
    };

    useEffect(() => {
        load();
    }, []);

    if (loading) return <ActivityIndicator className="flex-1 bg-gray-50 pt-20" size="large" color="#1E3A8A" />;

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-4">
                <Text className="text-2xl font-black text-gray-900">Bank & LandBank Export</Text>
                <Text className="text-gray-700 mt-1">
                    Generate batch credit transfer text files and official LandBank payroll/disbursal submission reports.
                </Text>

                {/* Tab selector */}
                <View className="flex-row mt-4 mb-2 bg-gray-100 p-1 rounded-2xl">
                    <Pressable
                        onPress={() => setActiveTab('standard')}
                        className={`flex-1 py-2 rounded-xl items-center ${activeTab === 'standard' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Text className={`text-xs font-bold ${activeTab === 'standard' ? 'text-blue-900' : 'text-gray-600'}`}>
                            Standard Batch Text
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setActiveTab('landbank')}
                        className={`flex-1 py-2 rounded-xl items-center ${activeTab === 'landbank' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <Text className={`text-xs font-bold ${activeTab === 'landbank' ? 'text-blue-900' : 'text-gray-600'}`}>
                            LandBank Submission
                        </Text>
                    </Pressable>
                </View>

                <Text className="text-xs font-bold text-gray-700 uppercase mt-2 mb-1">Release Date</Text>
                <View className="flex-row gap-2">
                    <TextInput
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                        value={filterDate}
                        onChangeText={setFilterDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#9CA3AF"
                    />
                    <Pressable className="bg-blue-900 rounded-xl px-4 items-center justify-center" onPress={load}>
                        <MaterialIcons name="search" size={20} color="#fff" />
                    </Pressable>
                </View>

                <Text className="font-black text-gray-900 mt-4">
                    {rows.length} record{rows.length !== 1 ? 's' : ''} • Total:{' '}
                    {formatPHP(rows.reduce((s, r) => s + r.amount, 0))}
                </Text>
            </View>

            {rows.length > 0 && activeTab === 'standard' && (
                <>
                    <View className="bg-white rounded-2xl border border-gray-100 mb-4 overflow-hidden">
                        {rows.map((row, i) => (
                            <View key={i} className="p-4 border-b border-gray-50">
                                <View className="flex-row justify-between">
                                    <Text className="font-bold text-gray-900">{row.accountName}</Text>
                                    <Text className="font-black text-green-700">{formatPHP(row.amount)}</Text>
                                </View>
                                <Text className="text-xs text-gray-500">
                                    {row.accountNumber} • {row.bankName}
                                </Text>
                                <Text className="text-xs text-gray-400">{row.loanNumber}</Text>
                            </View>
                        ))}
                    </View>

                    <View className="bg-gray-900 rounded-2xl p-4 mb-4">
                        <Text className="text-green-400 font-mono text-xs">{textContent}</Text>
                    </View>

                    <Pressable
                        className="bg-blue-900 rounded-2xl py-4 flex-row justify-center items-center mb-4"
                        onPress={() => downloadText(textContent, `bank_export_${filterDate}.txt`)}
                    >
                        <MaterialIcons name="download" size={20} color="#fff" />
                        <Text className="text-white font-black ml-2 text-base">Download .txt File</Text>
                    </Pressable>
                </>
            )}

            {rows.length > 0 && activeTab === 'landbank' && (
                <View className="bg-white rounded-3xl p-5 border border-gray-100 mb-6 shadow-sm">
                    <View className="flex-row items-center justify-between mb-4">
                        <View>
                            <Text className="text-gray-900 font-bold text-base">Official LandBank Payroll / Loan Sheet</Text>
                            <Text className="text-gray-500 text-xs">CDA & LBP standard submission format</Text>
                        </View>
                        <Pressable
                            onPress={handlePrintLandBankReport}
                            className="bg-emerald-700 px-4 py-2.5 rounded-xl flex-row items-center active:bg-emerald-800"
                        >
                            <MaterialIcons name="print" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text className="text-white font-bold text-xs">Print / Export PDF</Text>
                        </Pressable>
                    </View>

                    <View className="border border-gray-200 rounded-2xl overflow-hidden mb-4">
                        <View className="bg-gray-50 p-3 border-b border-gray-200 flex-row">
                            <Text className="flex-1 font-bold text-xs text-gray-700">Account No.</Text>
                            <Text className="flex-1 font-bold text-xs text-gray-700">Account Name</Text>
                            <Text className="w-28 font-bold text-xs text-gray-700 text-right">Amount (PHP)</Text>
                        </View>
                        {rows.map((row, idx) => (
                            <View
                                key={idx}
                                className={`p-3 flex-row items-center ${idx !== rows.length - 1 ? 'border-b border-gray-100' : ''}`}
                            >
                                <Text className="flex-1 text-xs font-mono text-gray-900">{row.accountNumber}</Text>
                                <Text className="flex-1 text-xs font-bold text-gray-800 uppercase">{row.accountName}</Text>
                                <Text className="w-28 text-xs font-extrabold text-emerald-700 text-right">
                                    {formatPHP(row.amount)}
                                </Text>
                            </View>
                        ))}
                    </View>

                    <Pressable
                        onPress={handlePrintLandBankReport}
                        className="bg-emerald-700 rounded-2xl py-3.5 flex-row justify-center items-center"
                    >
                        <MaterialIcons name="picture-as-pdf" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text className="text-white font-bold text-sm">Download Official LandBank Report (PDF)</Text>
                    </Pressable>
                </View>
            )}

            {rows.length === 0 && !loading && (
                <View className="items-center justify-center py-20">
                    <MaterialIcons name="account-balance" size={64} color="#E5E7EB" />
                    <Text className="text-gray-500 mt-4">No loans with bank accounts on this date</Text>
                </View>
            )}
        </ScrollView>
    );
}
