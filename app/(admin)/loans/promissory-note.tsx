import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import Loan from '../../../src/database/models/Loan';
import Borrower from '../../../src/database/models/Borrower';
import PaymentSchedule from '../../../src/database/models/PaymentSchedule';
import { formatPHP } from '../../../src/utils/currency';
import { formatDate } from '../../../src/utils/dates';
import { COMPANY_NAME } from '../../../src/constants/brand';
import { logoBase64 } from '../../../src/utils/logoBase64';

const printHtml = async (html: string) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.print(); }
        return;
    }
    await Print.printAsync({ html });
};

export default function PromissoryNoteScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [loan, setLoan] = useState<Loan | null>(null);
    const [borrower, setBorrower] = useState<Borrower | null>(null);
    const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const l = await database.collections.get<Loan>('loans').find(id);
                const b = await database.collections.get<Borrower>('borrowers').find(l.borrowerId);
                const s = await database.collections.get<PaymentSchedule>('payment_schedules').query(
                    Q.where('loan_id', id),
                    Q.where('deleted_at', Q.eq(null)),
                    Q.sortBy('due_date', Q.asc),
                ).fetch();
                setLoan(l); setBorrower(b); setSchedules(s);
            } catch (e) {
                Alert.alert('Error', 'Failed to load loan data.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const buildHtml = () => {
        if (!loan || !borrower) return '';
        const scheduleRows = schedules.map((s, i) => `
            <tr>
                <td style="text-align:center">${i + 1}</td>
                <td style="text-align:center">${new Date(Number(s.dueDate)).toLocaleDateString()}</td>
                <td style="text-align:right">â‚±${(s.scheduledAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                <td style="text-align:right">â‚±${(s.principalAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                <td style="text-align:right">â‚±${(s.interestAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
            </tr>`).join('');

        return `<html><head><style>
            body{font-family:Arial,sans-serif;padding:40px;font-size:12px}
            .header{text-align:center;margin-bottom:30px}
            .brand{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:8px}
            .brand-logo{width:52px;height:52px;object-fit:contain}
            .title{font-size:18px;font-weight:bold;text-transform:uppercase;letter-spacing:2px}
            .subtitle{font-size:13px;margin-top:4px;letter-spacing:1.5px}
            .section{margin-bottom:16px}
            .section-title{font-weight:bold;font-size:11px;text-transform:uppercase;color:#555;border-bottom:1px solid #ccc;padding-bottom:4px;margin-bottom:8px}
            .row{display:flex;justify-content:space-between;margin-bottom:6px}
            .label{color:#555;min-width:180px}
            .value{font-weight:bold}
            table{width:100%;border-collapse:collapse;margin-top:10px}
            th,td{border:1px solid #ccc;padding:5px 8px;font-size:11px}
            th{background:#1E3A8A;color:#fff}
            .promise{border:1px solid #1E3A8A;padding:16px;border-radius:6px;margin:20px 0;font-style:italic;line-height:1.6}
            .signatures{display:flex;justify-content:space-between;margin-top:60px}
            .sig{text-align:center;width:200px}
            .sig-line{border-top:1px solid #000;padding-top:6px;font-size:11px}
        </style></head><body>
            <div class="header">
                <div class="brand"><img class="brand-logo" src="${logoBase64}" alt="${COMPANY_NAME} logo"/><div class="title">${COMPANY_NAME}</div></div>
                <div class="subtitle">PROMISSORY NOTE</div>
                <div style="font-size:10px;margin-top:4px">Loan No. <strong>${loan.loanNumber}</strong></div>
            </div>

            <div class="section">
                <div class="section-title">Borrower Information</div>
                <div class="row"><span class="label">Name:</span><span class="value">${borrower.fullName}</span></div>
                <div class="row"><span class="label">Address:</span><span class="value">${borrower.address ?? ''}</span></div>
                <div class="row"><span class="label">Contact:</span><span class="value">${borrower.phone ?? ''}</span></div>
                ${borrower.coMakerName ? `<div class="row"><span class="label">Co-Maker:</span><span class="value">${borrower.coMakerName}</span></div>` : ''}
            </div>

            <div class="section">
                <div class="section-title">Loan Details</div>
                <div class="row"><span class="label">Loan Number:</span><span class="value">${loan.loanNumber}</span></div>
                <div class="row"><span class="label">Loan Type:</span><span class="value">${loan.loanType ?? 'Standard'}</span></div>
                <div class="row"><span class="label">Principal Amount:</span><span class="value">â‚±${loan.principalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                <div class="row"><span class="label">Interest Rate:</span><span class="value">${loan.interestRate}% (${loan.interestType})</span></div>
                <div class="row"><span class="label">Term:</span><span class="value">${loan.term} ${loan.termUnit} (${loan.frequency})</span></div>
                <div class="row"><span class="label">Total Amount:</span><span class="value">â‚±${loan.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                <div class="row"><span class="label">Installment Amount:</span><span class="value">â‚±${loan.installmentAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></div>
                <div class="row"><span class="label">Release Date:</span><span class="value">${loan.releaseDate ? new Date(Number(loan.releaseDate)).toLocaleDateString() : 'N/A'}</span></div>
                <div class="row"><span class="label">Maturity Date:</span><span class="value">${loan.maturityDate ? new Date(Number(loan.maturityDate)).toLocaleDateString() : 'N/A'}</span></div>
            </div>

            <div class="promise">
                I/We, <strong>${borrower.fullName}</strong>, promise to pay <strong>${COMPANY_NAME}</strong> the sum of
                <strong>â‚±${loan.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                in ${schedules.length} installment(s) of <strong>â‚±${loan.installmentAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                each, payable ${loan.frequency}, starting on
                <strong>${loan.firstPaymentDate ? new Date(Number(loan.firstPaymentDate)).toLocaleDateString() : 'N/A'}</strong>.
                In case of default, I/We agree to pay penalty charges and attorney's fees as stipulated by the lender.
            </div>

            ${schedules.length > 0 ? `
            <div class="section">
                <div class="section-title">Payment Schedule</div>
                <table>
                    <tr><th>#</th><th>Due Date</th><th>Amount</th><th>Principal</th><th>Interest</th></tr>
                    ${scheduleRows}
                </table>
            </div>` : ''}

            <div class="signatures">
                <div class="sig"><div class="sig-line">Borrower's Signature over Printed Name</div></div>
                <div class="sig"><div class="sig-line">Co-Maker's Signature over Printed Name</div></div>
                <div class="sig"><div class="sig-line">Authorized Representative</div></div>
            </div>
        </body></html>`;
    };

    if (loading) return <ActivityIndicator className="flex-1 bg-gray-50 pt-20" size="large" color="#1E3A8A" />;
    if (!loan || !borrower) return <View className="flex-1 items-center justify-center"><Text>Loan not found.</Text></View>;

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-4">
                <Text className="text-2xl font-black text-gray-900">Promissory Note</Text>
                <Text className="text-gray-700 mt-1">{borrower.fullName} â€” {loan.loanNumber}</Text>

                <View className="mt-4 gap-2">
                    {[
                        ['Principal', formatPHP(loan.principalAmount)],
                        ['Total Amount', formatPHP(loan.totalAmount)],
                        ['Installment', formatPHP(loan.installmentAmount)],
                        ['Term', `${loan.term} ${loan.termUnit} (${loan.frequency})`],
                        ['Interest Rate', `${loan.interestRate}% ${loan.interestType}`],
                        ['Release Date', loan.releaseDate ? formatDate(Number(loan.releaseDate)) : 'N/A'],
                        ['Maturity Date', loan.maturityDate ? formatDate(Number(loan.maturityDate)) : 'N/A'],
                    ].map(([label, value]) => (
                        <View key={label} className="flex-row justify-between py-1 border-b border-gray-50">
                            <Text className="text-xs text-gray-500 font-bold uppercase">{label}</Text>
                            <Text className="text-sm font-bold text-gray-900">{value}</Text>
                        </View>
                    ))}
                </View>

                <Pressable
                    className="mt-6 bg-blue-900 rounded-2xl py-4 flex-row justify-center items-center"
                    onPress={() => printHtml(buildHtml())}
                >
                    <MaterialIcons name="print" size={20} color="#fff" />
                    <Text className="text-white font-black ml-2 text-base">Print Promissory Note</Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}
