import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert , Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { safeBack } from '../../../src/utils/navigation';
import { database } from '../../../src/database';
import Loan from '../../../src/database/models/Loan';
import PaymentSchedule from '../../../src/database/models/PaymentSchedule';
import Borrower from '../../../src/database/models/Borrower';
import Payment from '../../../src/database/models/Payment';
import Collector from '../../../src/database/models/Collector';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPHP } from '../../../src/utils/currency';
import { formatDate } from '../../../src/utils/dates';
import uuid from 'react-native-uuid';
import { LoanCalculatorService } from '../../../src/services/LoanCalculatorService';
import BaseModelService from '../../../src/services/BaseModelService';
import ConfirmDialog from '../../../src/components/ConfirmDialog';

import AuditService from '../../../src/services/AuditService';
import { LoanService } from '../../../src/services/LoanService';
import { CalculationBasisCard } from '../../../src/components/CalculationBasisCard';
import { PdfGenerator } from '../../../src/services/PdfGenerator';
import { isInstitutionalLoanType, loanProductLabel } from '../../../src/utils/loanProducts';
import { CreditorsGroupLifeSummaryService } from '../../../src/services/CreditorsGroupLifeSummaryService';
import { useLoanProductPresets, useRolePermissions } from '../../../src/hooks/useSettingsConfig';
import { useAuth } from '../../../src/store/AuthContext';

export default function LoanDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { user, role } = useAuth();
    const { isAllowed } = useRolePermissions(role);
    const canEdit = isAllowed('action.edit');
    const canDelete = isAllowed('action.delete');
    const { presets: loanProductPresets } = useLoanProductPresets();

    const [loan, setLoan] = useState<Loan | null>(null);
    const [borrower, setBorrower] = useState<Borrower | null>(null);
    const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [previousLoan, setPreviousLoan] = useState<Loan | null>(null);
    const [collector, setCollector] = useState<Collector | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isConfirmDeleteVisible, setIsConfirmDeleteVisible] = useState(false);
    const [isConfirmDisburseVisible, setIsConfirmDisburseVisible] = useState(false);

    const loadData = async () => {
        try {
            const l = await database.collections.get<Loan>('loans').find(id);
            if (l.deletedAt) throw new Error("Loan is deleted");

            const b = await database.collections.get<Borrower>('borrowers').find(l.borrowerId);
            const s = await database.collections.get<PaymentSchedule>('payment_schedules').query(
                Q.where('loan_id', id),
                Q.where('deleted_at', Q.eq(null)),
                Q.sortBy('due_date', Q.asc)
            ).fetch();
            const p = await database.collections.get<Payment>('payments').query(
                Q.where('loan_id', id),
                Q.where('deleted_at', Q.eq(null))
            ).fetch();

            setLoan(l);
            setBorrower(b);
            setSchedules(s);
            setPayments(p);

            if (l.collectorId) {
                const allCols = await database.collections.get<Collector>('collectors').query().fetch();
                const match = allCols.find(c => c.id === l.collectorId || c.authId === l.collectorId);
                if (match) {
                    setCollector(match);
                }
            }

            if (l.isReloan && l.previousLoanId) {
                const prevL = await database.collections.get<Loan>('loans').find(l.previousLoanId).catch(() => null);
                setPreviousLoan(prevL);
            }
        } catch (error) {
            console.error("Failed to load loan details", error);
            safeBack(router, '/(admin)');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const handleDisburse = async () => {
        if (!loan) return;
        setSaving(true);
        try {
            // Re-calculate to get latest schedule dates based on today
            const res = isInstitutionalLoanType(loan.loanType)
                ? LoanCalculatorService.calculateInstitutionalLoan({
                    loanType: loan.loanType,
                    principal: loan.principalAmount,
                    monthlyRatePercent: loan.interestRate,
                    term: loan.term,
                    termUnit: loan.termUnit,
                    frequency: loan.frequency,
                    releaseDate: new Date(),
                    processingFee: loan.processingFee || 0,
                    collectionFee: loan.collectionFee || 0,
                    notarialFee: loan.notarialFee || 0,
                    insuranceFee: loan.insuranceAmount || 0,
                    rodFee: loan.rodFee || 0,
                    ltoFee: loan.ltoFee || 0,
                    udiRebatableFee: loan.udiRebatableFee || 0,
                    outstandingBalance: loan.deductedAmount || 0,
                    savingsPerPayment: loan.savingsPerPayment || 0,
                    rebatePerPayment: loan.rebateAmount || 0,
                })
                : LoanCalculatorService.calculate(
                    loan.principalAmount, loan.interestRate, loan.term, loan.termUnit,
                    loan.interestType, loan.frequency, new Date(),
                    loan.depositAmount || 0, loan.insuranceAmount || 0
                );

            await LoanService.saveLoan({
                loanId: loan.id,
                loanNumber: loan.loanNumber,
                loanType: loan.loanType || 'standard',
                borrowerId: loan.borrowerId,
                principalAmount: loan.principalAmount,
                interestRate: loan.interestRate,
                interestType: loan.interestType as any,
                term: loan.term,
                termUnit: loan.termUnit as any,
                frequency: loan.frequency as any,
                calcResult: res,
                depositAmount: loan.depositAmount || 0,
                insuranceAmount: loan.insuranceAmount || 0,
                processingFee: loan.processingFee || 0,
                collectionFee: loan.collectionFee || 0,
                notarialFee: loan.notarialFee || 0,
                rodFee: loan.rodFee || 0,
                ltoFee: loan.ltoFee || 0,
                udiRebatableFee: loan.udiRebatableFee || 0,
                vatOnInterest: res.institutionalBreakdown?.vatOnInterest || loan.vatOnInterest || 0,
                vatOnCharges: res.institutionalBreakdown?.vatOnOtherCharges || loan.vatOnCharges || 0,
                dstFee: res.institutionalBreakdown?.dstFee || loan.dstFee || 0,
                rebateAmount: loan.rebateAmount || 0,
                savingsPerPayment: loan.savingsPerPayment || 0,
                collectorId: loan.collectorId || '',
                encodedBy: loan.encodedBy || '',
                releaseDate: new Date(),
                status: 'active',
                isReloan: loan.isReloan,
                previousLoanId: loan.previousLoanId || undefined,
                deductedAmount: loan.deductedAmount || 0,
                loanBatch: loan.loanBatch,
                loanCycle: loan.loanCycle,
                interestAmount: loan.interestAmount || 0,
                isEditing: true,
                existingLoan: loan
            });

            // Reload data
            await loadData();
            setIsConfirmDisburseVisible(false);
            if (Platform.OS === 'web') {
                window.alert('Loan disbursed successfully.');
            } else {
                Alert.alert('Success', 'Loan disbursed successfully.');
            }
        } catch (e) {
            console.error('Failed to disburse loan', e);
            setIsConfirmDisburseVisible(false);
            if (Platform.OS === 'web') {
                window.alert('Failed to disburse loan.');
            } else {
                Alert.alert('Error', 'Failed to disburse loan.');
            }
        } finally {
            setSaving(false);
        }
    };


    const handleDelete = async () => {
        if (!loan) return;
        setSaving(true);
        try {
            await BaseModelService.cascadeDeleteLoan(loan);
            setIsConfirmDeleteVisible(false);
            if (Platform.OS === 'web') window.alert("Loan record moved to trash.");
            router.replace('/(admin)/loans');
        } catch (error) {
            console.error("Failed to delete loan", error);
            if (Platform.OS === 'web') {
                window.alert("Could not delete loan.");
            } else {
                Alert.alert("Error", "Could not delete loan.");
            }
        } finally {
            setSaving(false);
        }
    };

    const handleRecompute = async () => {
        if (!loan) return;
        setSaving(true);
        try {
            const res = await AuditService.recalculateLoanTotals(loan.id);
            if (res.success) {
                await loadData();
                if (Platform.OS === 'web') {
                    window.alert(res.message);
                } else {
                    Alert.alert("Success", res.message);
                }
            } else {
                if (Platform.OS === 'web') {
                    window.alert(res.message);
                } else {
                    Alert.alert("Error", res.message);
                }
            }
        } catch (error) {
            if (Platform.OS === 'web') {
                window.alert("Failed to recompute totals.");
            } else {
                Alert.alert("Error", "Failed to recompute totals.");
            }
        } finally {
            setSaving(false);
        }
    };

    const handlePrintComputationSlip = async () => {
        if (!loan || !borrower) return;
        await PdfGenerator.generateLoanComputationSlip(
            { fullName: borrower.fullName, address: borrower.address, phone: borrower.phone },
            loan as any,
            collector?.fullName || loan.encodedBy || ''
        );
    };

    const handlePrintLoanForms = async () => {
        if (!loan || !borrower) return;
        await PdfGenerator.generateLoanContractForms(
            { fullName: borrower.fullName, address: borrower.address, phone: borrower.phone },
            loan as any
        );
    };

    const handlePrintCreditorsGroupLife = async () => {
        if (!loan || !borrower) return;
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
    };

    if (loading || !loan || !borrower) {
        return <ActivityIndicator size="large" color="#D32F2F" className="flex-1 bg-gray-50 pt-20" />;
    }

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = Math.max(0, loan.totalAmount - totalPaid);
    const canPrintCreditorsGroupLife = CreditorsGroupLifeSummaryService.isEligibleLoanType(loan.loanType);

    return (
        <View className="flex-1 bg-gray-50">
            <ScrollView  contentContainerStyle={{ padding: 16 }}>

                {loan.status === 'pending' && (() => {
                    const preset = loanProductPresets[loan.loanType as any] || loanProductPresets.standard;
                    const maxAllowed = preset?.maxPrincipal;
                    if (maxAllowed && loan.principalAmount > maxAllowed) {
                        return (
                            <View className="bg-amber-50 border border-amber-200 p-4 rounded-2xl mb-6">
                                <Text className="text-amber-800 font-extrabold text-sm mb-1">⚠️ Subject to Approval</Text>
                                <Text className="text-amber-700 text-xs font-medium">
                                    This loan principal ({formatPHP(loan.principalAmount)}) exceeds the maximum allowed limit of {formatPHP(maxAllowed)} for {loanProductLabel(loan.loanType)}.
                                </Text>
                            </View>
                        );
                    }
                    return null;
                })()}

                {/* Header Card */}
                <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                    <View className="flex-row justify-between items-start mb-4">
                        <View className="flex-1 pr-4">
                            <Pressable onPress={() => borrower && router.push(`/(admin)/borrowers/${borrower.id}`)}>
                                <Text className="text-2xl font-extrabold text-blue-700 mb-1 underline">{borrower?.fullName}</Text>
                            </Pressable>
                            <View className="flex-row items-center">
                                <Text className="text-gray-700 font-bold">{loan.loanNumber}</Text>
                                {loan.isReloan && (
                                    <View className="ml-2 px-2 py-0.5 bg-blue-100 rounded-md">
                                        <Text className="text-[10px] font-black uppercase text-blue-700">Renewal</Text>
                                    </View>
                                )}
                            </View>
                            {loan.isReloan && previousLoan && (
                                <Pressable 
                                    className="mt-2 flex-row items-center bg-blue-50 self-start px-2 py-1 rounded-lg"
                                    onPress={() => router.push(`/(admin)/loans/${previousLoan.id}`)}
                                >
                                    <MaterialIcons name="loop" size={12} color="#1D4ED8" className="mr-1.5" />
                                    <Text className="text-[10px] font-bold text-blue-700 uppercase">Renewal of {previousLoan.loanNumber}</Text>
                                </Pressable>
                            )}
                        </View>
                        <View className={`px-3 py-1.5 rounded-xl ${loan.status === 'active' ? 'bg-blue-100' :
                            loan.status === 'paid' ? 'bg-green-100' :
                                loan.status === 'defaulted' ? 'bg-red-100' : 'bg-gray-100'
                            }`}>
                            <Text className={`text-xs font-black uppercase tracking-wider ${loan.status === 'active' ? 'text-blue-800' :
                                loan.status === 'paid' ? 'text-green-800' :
                                    loan.status === 'defaulted' ? 'text-red-800' : 'text-gray-800'
                                }`}>{loan.status}</Text>
                        </View>
                    </View>

                    <View className="flex-row justify-between items-center mb-4">
                        <View className="flex-row">
                            {canEdit && (
                                <Pressable 
                                    className="bg-blue-50 px-3 py-2 rounded-xl mr-2"
                                    onPress={() => router.push(`/(admin)/loans/new?id=${loan.id}`)}
                                >
                                    <Text className="text-blue-700 font-bold text-[10px] uppercase">Edit Loan</Text>
                                </Pressable>
                            )}
                            <Pressable 
                                className="bg-emerald-50 px-3 py-2 rounded-xl mr-2 flex-row items-center border border-emerald-100"
                                onPress={handleRecompute}
                                disabled={saving}
                            >
                                <MaterialIcons name="calculate" size={12} color="#355E3B" className="mr-1" />
                                <Text className="text-emerald-700 font-bold text-[10px] uppercase">Recompute</Text>
                            </Pressable>
                            {isInstitutionalLoanType(loan.loanType) && (
                                <>
                                    <Pressable
                                        testID="print-computation-slip"
                                        className="bg-amber-50 px-3 py-2 rounded-xl mr-2 flex-row items-center border border-amber-100"
                                        onPress={handlePrintComputationSlip}
                                    >
                                        <MaterialIcons name="print" size={12} color="#B45309" className="mr-1" />
                                        <Text className="text-amber-700 font-bold text-[10px] uppercase">Computation Slip</Text>
                                    </Pressable>
                                    <Pressable
                                        testID="print-loan-forms"
                                        className="bg-purple-50 px-3 py-2 rounded-xl mr-2 flex-row items-center border border-purple-100"
                                        onPress={handlePrintLoanForms}
                                    >
                                        <MaterialIcons name="description" size={12} color="#7E22CE" className="mr-1" />
                                        <Text className="text-purple-700 font-bold text-[10px] uppercase">Forms</Text>
                                    </Pressable>
                                    <Pressable
                                        className="bg-blue-50 px-3 py-2 rounded-xl mr-2 flex-row items-center border border-blue-100"
                                        onPress={() => router.push(`/(admin)/loans/promissory-note?id=${loan.id}`)}
                                    >
                                        <MaterialIcons name="article" size={12} color="#1D4ED8" className="mr-1" />
                                        <Text className="text-blue-700 font-bold text-[10px] uppercase">Promissory Note</Text>
                                    </Pressable>
                                    {canPrintCreditorsGroupLife && (
                                        <Pressable
                                            testID="print-creditors-group-life"
                                            className="bg-green-50 px-3 py-2 rounded-xl mr-2 flex-row items-center border border-green-100"
                                            onPress={handlePrintCreditorsGroupLife}
                                        >
                                            <MaterialIcons name="health-and-safety" size={12} color="#15803D" className="mr-1" />
                                            <Text className="text-green-700 font-bold text-[10px] uppercase">Insurance Summary</Text>
                                        </Pressable>
                                    )}
                                </>
                            )}
                        </View>
                        {canDelete && (
                            <Pressable 
                                className="bg-red-50 px-3 py-2 rounded-xl flex-row items-center border border-red-100"
                                onPress={() => setIsConfirmDeleteVisible(true)}
                            >
                                <MaterialIcons name="delete-outline" size={14} color="#DC2626" className="mr-1" />
                                <Text className="text-red-700 font-bold text-[10px] uppercase">Delete Loan</Text>
                            </Pressable>
                        )}
                    </View>

                    <View className="flex-row items-center mt-2">
                        <Pressable
                            className="bg-gray-50 px-4 py-2 rounded-xl flex-row items-center border border-gray-200 active:bg-gray-100"
                            onPress={() => router.push(`/(admin)/borrowers/${borrower.id}`)}
                        >
                            <MaterialIcons name="person" size={16} color="#4B5563" className="mr-2" />
                            <Text className="text-gray-700 font-bold text-xs uppercase tracking-wider">Borrower Profile</Text>
                        </Pressable>
                        <Pressable
                            className="bg-gray-50 px-4 py-2 rounded-xl flex-row items-center border border-gray-200 ml-3 active:bg-gray-100"
                            onPress={() => router.push(`/(admin)/borrowers/${borrower.id}/passbook`)}
                        >
                            <MaterialIcons name="menu-book" size={16} color="#4B5563" className="mr-2" />
                            <Text className="text-gray-700 font-bold text-xs uppercase tracking-wider">Passbook</Text>
                        </Pressable>
                        <Pressable
                            className="bg-gray-50 px-4 py-2 rounded-xl flex-row items-center border border-gray-200 ml-3 active:bg-gray-100"
                            onPress={() => router.push(`/(admin)/loans/${loan.id}/guarantors`)}
                        >
                            <MaterialIcons name="people" size={16} color="#4B5563" className="mr-2" />
                            <Text className="text-gray-700 font-bold text-xs uppercase tracking-wider">Guarantors</Text>
                        </Pressable>
                        <Pressable
                            className="bg-gray-50 px-4 py-2 rounded-xl flex-row items-center border border-gray-200 ml-3 active:bg-gray-100"
                            onPress={() => router.push(`/(admin)/loans/${loan.id}/penalties`)}
                        >
                            <MaterialIcons name="warning" size={16} color="#4B5563" className="mr-2" />
                            <Text className="text-gray-700 font-bold text-xs uppercase tracking-wider">Penalties</Text>
                        </Pressable>
                        <Pressable
                            className="bg-blue-50 px-4 py-2 rounded-xl flex-row items-center border border-blue-200 ml-3 active:bg-blue-100"
                            onPress={() => router.push(`/(admin)/loans/${loan.id}/application-form`)}
                        >
                            <MaterialIcons name="assignment" size={16} color="#1E3A8A" className="mr-2" />
                            <Text className="text-blue-900 font-bold text-xs uppercase tracking-wider">Application Form</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Financial Summary */}
                <View className="bg-blue-900 p-6 rounded-3xl shadow-md mb-6 relative overflow-hidden">
                    <View className="absolute -right-10 -bottom-10 bg-white/10 w-40 h-40 rounded-full" />

                    <View className="flex-row justify-between items-end mb-6">
                        <View>
                            <Text className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Outstanding Balance</Text>
                            <Text className="text-4xl font-extrabold text-white">{formatPHP(balance)}</Text>
                        </View>
                    </View>

                    <View className="flex-row bg-white/10 p-4 rounded-2xl">
                        <View className="flex-1 border-r border-indigo-400 border-opacity-30 pr-4">
                            <Text className="text-indigo-200 text-[10px] font-bold uppercase tracking-wide mb-1">Principal</Text>
                            <Text className="text-sm font-bold text-white mb-3">{formatPHP(loan.principalAmount)}</Text>

                            <Text className="text-indigo-200 text-[10px] font-bold uppercase tracking-wide mb-1">Released</Text>
                            <Text className="text-sm font-bold text-white">
                                {loan.releaseDate ? formatDate(new Date(loan.releaseDate)) : '—'}
                            </Text>
                        </View>
                        <View className="flex-1 pl-4">
                            <Text className="text-indigo-200 text-[10px] font-bold uppercase tracking-wide mb-1">Total Loan</Text>
                            <Text className="text-sm font-bold text-white mb-3">{formatPHP(loan.totalAmount)}</Text>

                            <Text className="text-indigo-200 text-[10px] font-bold uppercase tracking-wide mb-1">Matures</Text>
                            <Text className="text-sm font-bold text-white">
                                {loan.maturityDate ? formatDate(new Date(loan.maturityDate)) : '—'}
                            </Text>
                        </View>
                    </View>

                    {(loan.deductedAmount > 0 || loan.depositAmount > 0 || loan.insuranceAmount > 0) && (
                        <View className="mt-6 pt-6 border-t border-indigo-400 border-opacity-30">
                            <View className="flex-row justify-between mb-2">
                                <Text className="text-indigo-200 text-[10px] font-bold uppercase tracking-wide">Loan Amount (Principal)</Text>
                                <Text className="text-sm font-bold text-white">{formatPHP(loan.principalAmount)}</Text>
                            </View>
                            {loan.deductedAmount > 0 && (
                                <View className="flex-row justify-between mb-2">
                                    <Text className="text-indigo-200 text-[10px] font-bold uppercase tracking-wide">Previous Loan Balance</Text>
                                    <Text className="text-sm font-bold text-red-300">-{formatPHP(loan.deductedAmount)}</Text>
                                </View>
                            )}
                            <View className="flex-row justify-between mt-2 pt-2 border-t border-indigo-400 border-opacity-30">
                                <Text className="text-indigo-100 text-xs font-black uppercase tracking-widest">Net Cash Released (Disbursement)</Text>
                                <Text className="text-lg font-black text-green-400">
                                    {formatPHP(loan.principalAmount - (loan.deductedAmount || 0))}
                                </Text>
                            </View>

                            <View className="mt-4 p-3 bg-white/5 rounded-xl border border-white/10">
                                <Text className="text-indigo-200 text-[8px] font-bold uppercase tracking-widest mb-2">Allocation to Collection Target</Text>
                                <View className="flex-row justify-between mb-1">
                                    <Text className="text-indigo-100 text-[10px]">Total Savings Portion</Text>
                                    <Text className="text-[10px] font-bold text-white">{formatPHP(loan.depositAmount || 0)}</Text>
                                </View>
                                <View className="flex-row justify-between">
                                    <Text className="text-indigo-100 text-[10px]">Total Insurance Portion</Text>
                                    <Text className="text-[10px] font-bold text-white">{formatPHP(loan.insuranceAmount || 0)}</Text>
                                </View>
                            </View>
                        </View>
                    )}
                </View>

                <CalculationBasisCard interestType={loan.interestType} title="Understanding these values" />

                {/* Loan Terms */}
                <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                    <Text className="text-lg font-bold text-gray-900 mb-4">Loan Terms</Text>
                    <View className="flex-row flex-wrap">
                        <TermItem label="Loan Amount (Principal)" value={formatPHP(loan.principalAmount)} />
                        <TermItem label="Loan Type" value={loanProductLabel(loan.loanType)} />
                        <TermItem label="Batch" value={loan.loanBatch?.toString() || '—'} />
                        <TermItem label="Cycle" value={loan.loanCycle?.toString() || '—'} />
                        <TermItem label="Interest Rate" value={`${loan.interestRate}% (${loan.interestType})`} />
                        <TermItem label="Interest Amount" value={formatPHP(loan.interestAmount || 0)} />
                        <TermItem label="Term" value={`${loan.term} ${loan.termUnit}`} />
                        <TermItem label="Frequency" value={loan.frequency.replace('_', '-')} />
                        <TermItem label="Installment" value={formatPHP(loan.installmentAmount)} />
                        <TermItem label="Collector" value={collector ? collector.fullName : (loan.collectorId ? '(Loading...)' : 'Not Assigned')} />
                        {isInstitutionalLoanType(loan.loanType) && (
                            <>
                                <TermItem label="Processing Fee" value={formatPHP(loan.processingFee || 0)} />
                                <TermItem label="Notarial Fee" value={formatPHP(loan.notarialFee || 0)} />
                                {loan.dstFee > 0 && <TermItem label="DST" value={formatPHP(loan.dstFee)} />}
                                <TermItem label="Savings / Payment" value={formatPHP(loan.savingsPerPayment || 0)} />
                            </>
                        )}
                    </View>
                </View>

                {/* Amortization Schedule */}
                <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-32">
                    <Text className="text-lg font-bold text-gray-900 mb-6">Amortization Schedule</Text>

                    {schedules.length === 0 ? (
                        <Text className="text-gray-700 text-center py-4">No schedule calculated yet.</Text>
                    ) : (
                        <View>
                            <View className="flex-row border-b-2 border-gray-100 pb-3 mb-2">
                                <Text className="w-10 text-xs font-bold text-gray-700 uppercase tracking-widest text-center">#</Text>
                                <Text className="flex-1 text-xs font-bold text-gray-700 uppercase tracking-widest">Date</Text>
                                <Text className="flex-1 text-xs font-bold text-gray-700 uppercase tracking-widest text-right">Amount</Text>
                                <Text className="flex-1 text-xs font-bold text-gray-700 uppercase tracking-widest text-center">Status</Text>
                            </View>

                            {schedules.map((sched, idx) => (
                                <View key={sched.id} className={`flex-row items-center py-4 ${idx < schedules.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                    <Text className="w-10 text-sm font-bold text-gray-700 text-center">{idx + 1}</Text>
                                    <Text className="flex-1 text-sm font-bold text-gray-900">{formatDate(new Date(sched.dueDate))}</Text>
                                    <Text className="flex-1 text-sm font-extrabold text-gray-900 text-right">{formatPHP(sched.scheduledAmount)}</Text>
                                    <View className="flex-1 items-center">
                                        <Text className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded ${sched.status === 'paid' ? 'bg-green-100 text-green-700' :
                                            sched.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                                                sched.status === 'late' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                                            }`}>{sched.status}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

            </ScrollView>

            {/* Sticky Actions Footer */}
            <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-8 flex-row shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                {loan.status === 'pending' && (
                    <Pressable
                        className={`flex-1 py-4 rounded-xl items-center flex-row justify-center ${saving ? 'bg-gray-400' : 'bg-red-700 active:bg-red-800'}`}
                        onPress={() => setIsConfirmDisburseVisible(true)} disabled={saving}
                    >
                        {saving ? <ActivityIndicator color="#fff" /> : (
                            <>
                                <MaterialIcons name="check-circle-outline" size={20} color="#fff" className="mr-2" />
                                <Text className="text-white font-bold text-lg">Approve & Disburse</Text>
                            </>
                        )}
                    </Pressable>
                )}
                {loan.status === 'active' && (
                    <Pressable
                        className="flex-1 py-4 rounded-xl items-center flex-row justify-center bg-yellow-500 active:bg-green-800"
                        onPress={() => router.push(`/(admin)/payments/new?loanId=${loan.id}`)}
                    >
                        <MaterialIcons name="add" size={20} color="#fff" className="mr-2" />
                        <Text className="text-white font-bold text-lg">Record Payment</Text>
                    </Pressable>
                )}
            </View>

            <ConfirmDialog
                visible={isConfirmDisburseVisible}
                title="Approve & Disburse Loan"
                message={`Are you sure you want to approve and disburse Loan ${loan.loanNumber}? This will mark the loan as active and set today as the release date.`}
                confirmLabel="Disburse"
                onConfirm={handleDisburse}
                onCancel={() => setIsConfirmDisburseVisible(false)}
                isDestructive={false}
            />
            <ConfirmDialog
                visible={isConfirmDeleteVisible}
                title="Delete Loan"
                message={`Are you sure you want to delete Loan ${loan.loanNumber}? This will also soft-delete all related payments and schedules. You can restore it from Trash.`}
                confirmLabel="Delete"
                onConfirm={handleDelete}
                onCancel={() => setIsConfirmDeleteVisible(false)}
                isDestructive={true}
            />
        </View>
    );
}

function TermItem({ label, value }: { label: string, value: string }) {
    return (
        <View className="w-1/2 mb-4 pr-2">
            <Text className="text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">{label}</Text>
            <Text className="text-sm font-extrabold text-blue-900 capitalize">{value}</Text>
        </View>
    );
}
