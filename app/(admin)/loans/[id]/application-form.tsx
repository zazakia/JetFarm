import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import { database } from '../../../../src/database';
import Loan from '../../../../src/database/models/Loan';
import Borrower from '../../../../src/database/models/Borrower';
import { MaterialIcons } from '@expo/vector-icons';
import { COMPANY_NAME } from '../../../../src/constants/brand';
import { logoBase64 } from '../../../../src/utils/logoBase64';
import { formatPHP } from '../../../../src/utils/currency';
import { formatDate } from '../../../../src/utils/dates';

const printHtml = async (html: string) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.print(); }
        return;
    }
    await Print.printAsync({ html });
};

export default function ApplicationFormScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const [loan, setLoan] = useState<Loan | null>(null);
    const [borrower, setBorrower] = useState<Borrower | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const l = await database.collections.get<Loan>('loans').find(id);
                const b = await database.collections.get<Borrower>('borrowers').find(l.borrowerId);
                setLoan(l);
                setBorrower(b);
            } catch (e) {
                Alert.alert('Error', 'Failed to load loan application details.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const buildHtml = () => {
        if (!loan || !borrower) return '';
        return `<html><head><style>
            body { font-family: Arial, sans-serif; padding: 40px; font-size: 11px; line-height: 1.5; }
            .header { text-align: center; margin-bottom: 25px; border-b: 2px solid #1E3A8A; padding-bottom: 12px; }
            .brand-logo { width: 56px; height: 56px; object-fit: contain; }
            .title { font-size: 18px; font-weight: bold; text-transform: uppercase; color: #1E3A8A; letter-spacing: 2px; }
            .subtitle { font-size: 13px; font-weight: bold; margin-top: 4px; color: #374151; letter-spacing: 1.5px; }
            .section { margin-bottom: 20px; border: 1px solid #E5E7EB; padding: 15px; border-radius: 8px; }
            .section-title { font-weight: bold; font-size: 11px; text-transform: uppercase; color: #1E3A8A; border-bottom: 1px solid #E5E7EB; padding-bottom: 4px; margin-bottom: 10px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .label { color: #6B7280; font-weight: bold; font-size: 9px; text-transform: uppercase; }
            .value { font-weight: bold; color: #111827; font-size: 11px; margin-top: 2px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
            .sig { text-align: center; width: 30%; }
            .sig-line { border-top: 1px solid #000; padding-top: 5px; font-weight: bold; font-size: 10px; }
        </style></head><body>
            <div class="header">
                <img class="brand-logo" src="${logoBase64}" alt="${COMPANY_NAME} logo"/>
                <div class="title">${COMPANY_NAME}</div>
                <div class="subtitle">LOAN APPLICATION FORM</div>
                <div style="font-size: 10px; color: #4B5563; margin-top: 4px;">Loan Application No.: <strong>${loan.loanNumber}</strong></div>
            </div>

            <div class="section">
                <div class="section-title">Borrower & Member Profile</div>
                <div class="grid">
                    <div><div class="label">Full Name</div><div class="value">${borrower.fullName}</div></div>
                    <div><div class="label">Member ID</div><div class="value">${borrower.memberId || 'N/A'}</div></div>
                    <div><div class="label">Civil Status</div><div class="value" style="text-transform: capitalize;">${borrower.civilStatus || 'N/A'}</div></div>
                    <div><div class="label">Contact Phone</div><div class="value">${borrower.phone || 'N/A'}</div></div>
                    <div><div class="label">Nature of Business</div><div class="value">${borrower.business || 'N/A'}</div></div>
                    <div><div class="label">Co-Maker Name</div><div class="value">${borrower.coMakerName || 'N/A'}</div></div>
                    <div style="grid-column: span 2;"><div class="label">Address</div><div class="value">${borrower.address || 'N/A'}</div></div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Requested Loan Terms & Details</div>
                <div class="grid">
                    <div><div class="label">Principal Requested</div><div class="value">₱${loan.principalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div></div>
                    <div><div class="label">Loan Type</div><div class="value" style="text-transform: uppercase;">${loan.loanType || 'Standard'}</div></div>
                    <div><div class="label">Loan Term</div><div class="value">${loan.term} ${loan.termUnit} (${loan.frequency})</div></div>
                    <div><div class="label">Interest Rate & Method</div><div class="value">${loan.interestRate}% (${loan.interestType})</div></div>
                    <div><div class="label">Installment Amount</div><div class="value">₱${loan.installmentAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div></div>
                    <div><div class="label">Total Amount Payable</div><div class="value">₱${loan.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div></div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Credit Evaluation & Action</div>
                <div style="display: flex; gap: 20px; font-weight: bold; margin-bottom: 15px;">
                    <div>[ X ] RECOMMENDED FOR APPROVAL</div>
                    <div>[   ] REJECTED</div>
                </div>
                <div class="grid">
                    <div><div class="label">Status</div><div class="value" style="text-transform: uppercase;">${loan.status}</div></div>
                    <div><div class="label">Release Date</div><div class="value">${loan.releaseDate ? formatDate(Number(loan.releaseDate)) : 'Pending'}</div></div>
                </div>
            </div>

            <div class="signatures">
                <div class="sig">
                    <div style="height: 40px;"></div>
                    <div class="sig-line">Borrower Signature</div>
                </div>
                <div class="sig">
                    <div style="height: 40px;"></div>
                    <div class="sig-line">Credit Officer / Encoder</div>
                </div>
                <div class="sig">
                    <div style="height: 40px;"></div>
                    <div class="sig-line">Approving Authority</div>
                </div>
            </div>
        </body></html>`;
    };

    if (loading) return <ActivityIndicator className="flex-1 bg-gray-50 pt-20" size="large" color="#1E3A8A" />;
    if (!loan || !borrower) return <View className="flex-1 items-center justify-center bg-gray-50"><Text>Loan details not found.</Text></View>;

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
                <View className="flex-row items-center mb-4">
                    <MaterialIcons name="assignment" size={28} color="#1E3A8A" className="mr-3" />
                    <View>
                        <Text className="text-2xl font-black text-gray-900">Application Form</Text>
                        <Text className="text-gray-500 font-bold text-xs">{borrower.fullName} • Loan No: {loan.loanNumber}</Text>
                    </View>
                </View>

                <View className="bg-blue-50 border border-blue-100 p-4 rounded-2xl mb-6">
                    <Text className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">Loan Summary</Text>
                    <View className="flex-row justify-between py-1 border-b border-blue-100">
                        <Text className="text-xs text-gray-600 font-bold">Principal</Text>
                        <Text className="text-xs text-gray-900 font-bold">{formatPHP(loan.principalAmount)}</Text>
                    </View>
                    <View className="flex-row justify-between py-1 border-b border-blue-100">
                        <Text className="text-xs text-gray-600 font-bold">Installment</Text>
                        <Text className="text-xs text-gray-900 font-bold">{formatPHP(loan.installmentAmount)} ({loan.frequency})</Text>
                    </View>
                    <View className="flex-row justify-between py-1">
                        <Text className="text-xs text-gray-600 font-bold">Status</Text>
                        <Text className="text-xs text-blue-900 font-black uppercase">{loan.status}</Text>
                    </View>
                </View>

                <Pressable
                    className="w-full bg-blue-900 rounded-2xl py-4 flex-row justify-center items-center active:bg-blue-800 shadow-lg"
                    onPress={() => printHtml(buildHtml())}
                >
                    <MaterialIcons name="print" size={22} color="#FFFFFF" className="mr-2" />
                    <Text className="text-white font-black text-base uppercase tracking-wider">Print Application Form</Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}
