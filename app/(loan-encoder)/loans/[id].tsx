import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import { database } from '../../../src/database';
import Borrower from '../../../src/database/models/Borrower';
import Loan from '../../../src/database/models/Loan';
import Payment from '../../../src/database/models/Payment';
import PaymentSchedule from '../../../src/database/models/PaymentSchedule';
import { formatPHP } from '../../../src/utils/currency';
import { formatDate } from '../../../src/utils/dates';
import { PdfGenerator } from '../../../src/services/PdfGenerator';
import { isInstitutionalLoanType, loanProductLabel } from '../../../src/utils/loanProducts';
import { CreditorsGroupLifeSummaryService } from '../../../src/services/CreditorsGroupLifeSummaryService';

export default function LoanEncoderLoanDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [loan, setLoan] = useState<Loan | null>(null);
    const [borrower, setBorrower] = useState<Borrower | null>(null);
    const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [printing, setPrinting] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const loadedLoan = await database.collections.get<Loan>('loans').find(id);
                if (loadedLoan.deletedAt) throw new Error('Loan is deleted');

                const [loadedBorrower, loadedSchedules, loadedPayments] = await Promise.all([
                    database.collections.get<Borrower>('borrowers').find(loadedLoan.borrowerId),
                    database.collections.get<PaymentSchedule>('payment_schedules').query(
                        Q.where('loan_id', id),
                        Q.where('deleted_at', Q.eq(null)),
                        Q.sortBy('due_date', Q.asc)
                    ).fetch(),
                    database.collections.get<Payment>('payments').query(
                        Q.where('loan_id', id),
                        Q.where('deleted_at', Q.eq(null))
                    ).fetch(),
                ]);

                setLoan(loadedLoan);
                setBorrower(loadedBorrower);
                setSchedules(loadedSchedules);
                setPayments(loadedPayments);
            } catch (error) {
                console.error('Failed to load loan encoder loan details', error);
                Alert.alert('Loan not found', 'Could not open this loan record.');
                router.replace('/(loan-encoder)');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [id, router]);

    const handlePrintComputationSlip = async () => {
        if (!loan || !borrower) return;
        setPrinting(true);
        try {
            await PdfGenerator.generateLoanComputationSlip(
                { fullName: borrower.fullName, address: borrower.address, phone: borrower.phone },
                loan as any,
                loan.encodedBy || ''
            );
        } finally {
            setPrinting(false);
        }
    };

    const handlePrintLoanForms = async () => {
        if (!loan || !borrower) return;
        setPrinting(true);
        try {
            await PdfGenerator.generateLoanContractForms(
                { fullName: borrower.fullName, address: borrower.address, phone: borrower.phone },
                loan as any
            );
        } finally {
            setPrinting(false);
        }
    };

    const handlePrintCreditorsGroupLife = async () => {
        if (!loan || !borrower) return;
        setPrinting(true);
        try {
            await PdfGenerator.generateCreditorsGroupLifeSummary(
                {
                    fullName: borrower.fullName,
                    address: borrower.address,
                    phone: borrower.phone,
                    dateOfBirth: borrower.dateOfBirth,
                    gender: borrower.gender,
                },
                loan as any
            );
        } finally {
            setPrinting(false);
        }
    };

    if (loading || !loan || !borrower) {
        return <ActivityIndicator size="large" color="#1565C0" className="flex-1 bg-gray-50 pt-20" />;
    }

    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const balance = Math.max(0, loan.totalAmount - totalPaid);
    const canPrintInstitutional = isInstitutionalLoanType(loan.loanType);
    const canPrintCreditorsGroupLife = CreditorsGroupLifeSummaryService.isEligibleLoanType(loan.loanType);

    return (
        <View className="flex-1 bg-gray-50">
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                    <View className="flex-row items-start justify-between mb-4">
                        <View className="flex-1 pr-4">
                            <Text className="text-2xl font-extrabold text-blue-700 mb-1">{borrower.fullName}</Text>
                            <Text className="text-gray-700 font-bold">{loan.loanNumber}</Text>
                            <Text className="text-[11px] text-gray-500 font-bold uppercase mt-1">{loanProductLabel(loan.loanType)}</Text>
                        </View>
                        <View className={`px-3 py-1.5 rounded-xl ${loan.status === 'active' ? 'bg-blue-100' : loan.status === 'paid' ? 'bg-green-100' : 'bg-gray-100'}`}>
                            <Text className={`text-xs font-black uppercase ${loan.status === 'active' ? 'text-blue-800' : loan.status === 'paid' ? 'text-green-800' : 'text-gray-800'}`}>
                                {loan.status}
                            </Text>
                        </View>
                    </View>

                    {canPrintInstitutional ? (
                        <View className="flex-row flex-wrap gap-2">
                            <Pressable
                                testID="loan-encoder-print-computation-slip"
                                className="bg-amber-50 px-3 py-2 rounded-xl flex-row items-center border border-amber-100"
                                onPress={handlePrintComputationSlip}
                                disabled={printing}
                            >
                                <MaterialIcons name="print" size={14} color="#B45309" />
                                <Text className="text-amber-700 font-bold text-[10px] uppercase ml-1">Computation Slip</Text>
                            </Pressable>
                            <Pressable
                                testID="loan-encoder-print-loan-forms"
                                className="bg-purple-50 px-3 py-2 rounded-xl flex-row items-center border border-purple-100"
                                onPress={handlePrintLoanForms}
                                disabled={printing}
                            >
                                <MaterialIcons name="description" size={14} color="#7E22CE" />
                                <Text className="text-purple-700 font-bold text-[10px] uppercase ml-1">Forms</Text>
                            </Pressable>
                            {canPrintCreditorsGroupLife && (
                                <Pressable
                                    testID="loan-encoder-print-creditors-group-life"
                                    className="bg-green-50 px-3 py-2 rounded-xl flex-row items-center border border-green-100"
                                    onPress={handlePrintCreditorsGroupLife}
                                    disabled={printing}
                                >
                                    <MaterialIcons name="health-and-safety" size={14} color="#15803D" />
                                    <Text className="text-green-700 font-bold text-[10px] uppercase ml-1">Insurance Summary</Text>
                                </Pressable>
                            )}
                        </View>
                    ) : (
                        <Text className="text-xs text-gray-500 font-semibold">Print forms are available for institutional loan products.</Text>
                    )}
                </View>

                <View className="bg-blue-900 p-6 rounded-3xl shadow-md mb-6 relative overflow-hidden">
                    <View className="absolute -right-10 -bottom-10 bg-white/10 w-40 h-40 rounded-full" />
                    <Text className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Outstanding Balance</Text>
                    <Text className="text-4xl font-extrabold text-white mb-6">{formatPHP(balance)}</Text>
                    <View className="flex-row bg-white/10 p-4 rounded-2xl">
                        <SummaryItem label="Principal" value={formatPHP(loan.principalAmount)} />
                        <SummaryItem label="Installment" value={formatPHP(loan.installmentAmount)} />
                    </View>
                </View>

                <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                    <Text className="text-lg font-bold text-gray-900 mb-4">Loan Terms</Text>
                    <View className="flex-row flex-wrap">
                        <TermItem label="Loan Type" value={loanProductLabel(loan.loanType)} />
                        <TermItem label="Term" value={`${loan.term} ${loan.termUnit}`} />
                        <TermItem label="Frequency" value={loan.frequency.replace('_', '-')} />
                        <TermItem label="Interest Rate" value={`${loan.interestRate}%`} />
                        <TermItem label="Total Loan" value={formatPHP(loan.totalAmount)} />
                        <TermItem label="Maturity" value={loan.maturityDate ? formatDate(new Date(loan.maturityDate)) : '—'} />
                        {canPrintInstitutional && (
                            <>
                                <TermItem label="Processing Fee" value={formatPHP(loan.processingFee || 0)} />
                                <TermItem label="Notarial Fee" value={formatPHP(loan.notarialFee || 0)} />
                                <TermItem label="Savings / Payment" value={formatPHP(loan.savingsPerPayment || 0)} />
                                <TermItem label="Rebate / Payment" value={formatPHP(loan.rebateAmount || 0)} />
                            </>
                        )}
                    </View>
                </View>

                <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <Text className="text-lg font-bold text-gray-900 mb-6">Amortization Schedule</Text>
                    {schedules.length === 0 ? (
                        <Text className="text-gray-500 text-center py-4">No schedule calculated yet.</Text>
                    ) : (
                        schedules.map((schedule, index) => (
                            <View key={schedule.id} className={`flex-row items-center py-3 ${index < schedules.length - 1 ? 'border-b border-gray-100' : ''}`}>
                                <Text className="w-8 text-sm font-bold text-gray-500">{index + 1}</Text>
                                <Text className="flex-1 text-sm font-bold text-gray-900">{formatDate(new Date(schedule.dueDate))}</Text>
                                <Text className="flex-1 text-sm font-extrabold text-gray-900 text-right">{formatPHP(schedule.scheduledAmount)}</Text>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
    return (
        <View className="flex-1 pr-4">
            <Text className="text-indigo-200 text-[10px] font-bold uppercase tracking-wide mb-1">{label}</Text>
            <Text className="text-sm font-bold text-white">{value}</Text>
        </View>
    );
}

function TermItem({ label, value }: { label: string; value: string }) {
    return (
        <View className="w-1/2 mb-4 pr-2">
            <Text className="text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">{label}</Text>
            <Text className="text-sm font-extrabold text-blue-900 capitalize">{value}</Text>
        </View>
    );
}
