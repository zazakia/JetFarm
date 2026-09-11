import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, Linking, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '../../../src/utils/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { database } from '../../../src/database';
import Collector from '../../../src/database/models/Collector';
import Borrower from '../../../src/database/models/Borrower';
import Loan from '../../../src/database/models/Loan';
import Payment from '../../../src/database/models/Payment';
import PaymentSchedule from '../../../src/database/models/PaymentSchedule';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons } from '@expo/vector-icons';
import { formatPHP } from '../../../src/utils/currency';
import { format } from 'date-fns';
import { parseDateLocal } from '../../../src/utils/dates';
import { EncryptionService } from '../../../src/services/EncryptionService';
import { ReminderService } from '../../../src/services/ReminderService';
import { MemberFinancialSummaryService } from '../../../src/services/MemberFinancialSummaryService';
import ConfirmDialog from '../../../src/components/ConfirmDialog';
import { BorrowerSearchBar } from '../../../src/components/BorrowerSearchBar';
import BaseModelService from '../../../src/services/BaseModelService';
import { sortLoansChronologically } from '../../../src/utils/loanOrdering';
import { PdfGenerator } from '../../../src/services/PdfGenerator';
import { computeSchedulePenalties } from '../../../src/utils/penalty';
import { handleFormValidationError, handleSaveError } from '../../../src/utils/errorAlerts';
import { useAuth } from '../../../src/store/AuthContext';
import { useRolePermissions } from '../../../src/hooks/useSettingsConfig';
import { ShareCapitalService } from '../../../src/services/ShareCapitalService';

const schema = z.object({
    fullName: z.string().min(2, "Name is required"),
    address: z.string().optional(),
    phone: z.string().optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    notes: z.string().optional(),
    collectorId: z.string().optional(),
    group: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    coMakerName: z.string().optional(),
    business: z.string().optional(),
    bankName: z.string().optional(),
    bankAccountName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankBranch: z.string().optional(),
    dateOfBirth: z.string().optional(),
    memberId: z.string().optional(),
    cycleId: z.string().optional().refine(v => !v || !isNaN(parseInt(v, 10)), 'Cycle must be a number'),
    loanCode: z.string().optional(),
    dateJoined: z.string().optional(),
    membershipStatus: z.enum(['active', 'inactive']).optional(),
    deceased: z.boolean().optional(),
    dateOfDeath: z.string().optional(),
    middleName: z.string().optional(),
    nameSuffix: z.string().optional(),
    birthplace: z.string().optional(),
    civilStatus: z.enum(['single', 'married', 'widowed', 'separated', 'annulled']).optional(),
    numberOfDependents: z.string().optional().refine(v => !v || !isNaN(parseInt(v, 10)), 'Must be a number'),
    spouseFirstName: z.string().optional(),
    spouseMiddleName: z.string().optional(),
    motherMaidenName: z.string().optional(),
    tinNumber: z.string().optional(),
    sssNumber: z.string().optional(),
    gsisNumber: z.string().optional(),
    philhealthNumber: z.string().optional(),
    barangay: z.string().optional(),
    cityMunicipality: z.string().optional(),
    province: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function EditBorrowerScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { role } = useAuth();
    const { isAllowed } = useRolePermissions(role);
    const canEdit = isAllowed('action.edit');
    const canDelete = isAllowed('action.delete');
    const [borrower, setBorrower] = useState<Borrower | null>(null);
    const [collectors, setCollectors] = useState<Collector[]>([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [printing, setPrinting] = useState(false);
    const [kpis, setKpis] = useState({ activeLoans: 0, outstandingBalance: 0 });
    const [cbuBalance, setCbuBalance] = useState({ amount: 0, shares: 0 });
    const [savingsBalance, setSavingsBalance] = useState(0);
    const [allPayments, setAllPayments] = useState<Payment[]>([]);
    const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>([]);
    const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [isConfirmDeleteVisible, setIsConfirmDeleteVisible] = useState(false);
    const [isConfirmDeleteLoanVisible, setIsConfirmDeleteLoanVisible] = useState(false);
    const [isConfirmDeletePaymentVisible, setIsConfirmDeletePaymentVisible] = useState(false);
    const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const collectorName = collectors.find(c => c.id === borrower?.collectorId || c.authId === borrower?.collectorId)?.fullName;

    const { control, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            fullName: '', address: '', phone: '', gender: 'other', notes: '', collectorId: '', group: '', firstName: '', lastName: '', coMakerName: '', business: '',
            bankName: '', bankAccountName: '', bankAccountNumber: '', bankBranch: '', dateOfBirth: '',
            memberId: '', cycleId: '1', loanCode: 'LC10K', dateJoined: '', membershipStatus: 'active', deceased: false, dateOfDeath: '',
            middleName: '', nameSuffix: '', birthplace: '', civilStatus: 'single', numberOfDependents: '0', spouseFirstName: '', spouseMiddleName: '', motherMaidenName: '', tinNumber: '', sssNumber: '', gsisNumber: '', philhealthNumber: '', barangay: '', cityMunicipality: '', province: ''
        }
    });

    const loadData = async () => {
        try {
            const b = await database.collections.get<Borrower>('borrowers').find(id);
            const users = await database.collections.get<Collector>('collectors').query(Q.where('is_active', true)).fetch();
            const loans = await database.collections.get<Loan>('loans').query(
                Q.where('borrower_id', id),
                Q.where('deleted_at', Q.eq(null))
            ).fetch();
            const loanIds = loans.map(l => l.id);
            const [payments, schedules] = loanIds.length > 0
                ? await Promise.all([
                    database.collections.get<Payment>('payments').query(
                        Q.where('loan_id', Q.oneOf(loanIds)),
                        Q.where('deleted_at', Q.eq(null))
                    ).fetch(),
                    database.collections.get<PaymentSchedule>('payment_schedules').query(
                        Q.where('loan_id', Q.oneOf(loanIds)),
                        Q.where('deleted_at', Q.eq(null))
                    ).fetch(),
                ])
                : [[], []];

            setBorrower(b);
            setCollectors(users);
            const orderedLoans = sortLoansChronologically(loans);
            setLoans(orderedLoans);
            setPaymentSchedules(schedules);

            const activeLoans = loans.filter(l => l.status === 'active' || l.status === 'defaulted');
            const outstanding = activeLoans.reduce((sum, loan) => {
                const paid = payments.filter(p => p.loanId === loan.id).reduce((s, p) => s + p.amount, 0);
                return sum + Math.max(0, loan.totalAmount - paid);
            }, 0);

            setKpis({ activeLoans: activeLoans.length, outstandingBalance: outstanding });
            const summary = await MemberFinancialSummaryService.getMemberSummary(id);
            const cbu = await ShareCapitalService.getCurrentBalance(id);
            const resolvedCbuAmount = cbu.amount > 0 ? cbu.amount : summary.cbuBalance;
            const resolvedShares = cbu.shares > 0 ? cbu.shares : Math.floor(resolvedCbuAmount / 100);
            setCbuBalance({ amount: resolvedCbuAmount, shares: resolvedShares });
            setSavingsBalance(summary.savingsBalance);
            const orderedPayments = payments.sort((a, b) => b.paymentDate - a.paymentDate);
            setAllPayments(orderedPayments);
            setRecentPayments(orderedPayments.slice(0, 5));

            reset({
                fullName: b.fullName,
                // Use decrypted values so the user sees readable text in the form
                address: b.decryptedAddress || b.address || '',
                phone: b.decryptedPhone || b.phone || '',
                gender: (b.gender as any) || 'other',
                notes: b.notes || '',
                collectorId: b.collectorId || '',
                group: b.group || '',
                firstName: b.firstName || '',
                lastName: b.lastName || '',
                coMakerName: b.coMakerName || '',
                business: b.business || '',
                bankName: b.bankName || '',
                bankAccountName: b.bankAccountName || '',
                bankAccountNumber: b.bankAccountNumber || '',
                bankBranch: b.bankBranch || '',
                dateOfBirth: b.dateOfBirth ? format(new Date(b.dateOfBirth), 'yyyy-MM-dd') : '',
                memberId: b.memberId || '',
                cycleId: b.cycleId ? b.cycleId.toString() : '1',
                loanCode: b.loanCode || 'LC10K',
                dateJoined: b.dateJoined ? format(new Date(b.dateJoined), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                membershipStatus: (b.membershipStatus as any) || 'active',
                deceased: (b as any).deceased || false,
                dateOfDeath: (b as any).dateOfDeath ? format(new Date((b as any).dateOfDeath), 'yyyy-MM-dd') : '',
                middleName: b.middleName || '',
                nameSuffix: b.nameSuffix || '',
                birthplace: b.birthplace || '',
                civilStatus: (b.civilStatus as any) || 'single',
                numberOfDependents: b.numberOfDependents ? b.numberOfDependents.toString() : '0',
                spouseFirstName: b.spouseFirstName || '',
                spouseMiddleName: b.spouseMiddleName || '',
                motherMaidenName: b.motherMaidenName || '',
                tinNumber: b.tinNumber || '',
                sssNumber: b.sssNumber || '',
                gsisNumber: b.gsisNumber || '',
                philhealthNumber: b.philhealthNumber || '',
                barangay: b.barangay || '',
                cityMunicipality: b.cityMunicipality || '',
                province: b.province || '',
            });
        } catch (error) {
            console.error('Failed to load borrower data', error);
            safeBack(router, '/(admin)');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const onSubmit = async (data: FormData) => {
        if (!borrower) return;
        setSaving(true);
        try {
            await BaseModelService.update(borrower, b => {
                b.fullName = data.fullName.trim();
                // Encrypt phone and address to match the storage format set during creation
                b.address = EncryptionService.encrypt(data.address?.trim() || null);
                b.phone = EncryptionService.encrypt(data.phone?.trim() || null);
                b.gender = data.gender || null;
                b.notes = data.notes?.trim() || null;
                b.collectorId = data.collectorId || null;
                b.group = data.group?.trim() || null;
                b.firstName = data.firstName?.trim() || null;
                b.lastName = data.lastName?.trim() || null;
                b.coMakerName = data.coMakerName?.trim() || null;
                b.business = data.business?.trim() || null;
                b.bankName = data.bankName?.trim() || null;
                b.bankAccountName = data.bankAccountName?.trim() || null;
                b.bankAccountNumber = data.bankAccountNumber?.trim() || null;
                b.bankBranch = data.bankBranch?.trim() || null;
                b.dateOfBirth = parseDateLocal(data.dateOfBirth) ?? null;
                b.memberId = data.memberId?.trim() || null;
                b.cycleId = data.cycleId ? parseInt(data.cycleId, 10) : null;
                b.loanCode = data.loanCode?.trim() || null;
                b.dateJoined = parseDateLocal(data.dateJoined) ?? null;
                b.membershipStatus = data.membershipStatus || null;
                (b as any).deceased = data.deceased || false;
                (b as any).dateOfDeath = data.deceased ? (parseDateLocal(data.dateOfDeath) ?? null) : null;
                b.middleName = data.middleName?.trim() || null;
                b.nameSuffix = data.nameSuffix?.trim() || null;
                b.birthplace = data.birthplace?.trim() || null;
                b.civilStatus = data.civilStatus || null;
                b.numberOfDependents = data.numberOfDependents ? parseInt(data.numberOfDependents, 10) : null;
                b.spouseFirstName = data.spouseFirstName?.trim() || null;
                b.spouseMiddleName = data.spouseMiddleName?.trim() || null;
                b.motherMaidenName = data.motherMaidenName?.trim() || null;
                b.tinNumber = data.tinNumber?.trim() || null;
                b.sssNumber = data.sssNumber?.trim() || null;
                b.gsisNumber = data.gsisNumber?.trim() || null;
                b.philhealthNumber = data.philhealthNumber?.trim() || null;
                b.barangay = data.barangay?.trim() || null;
                b.cityMunicipality = data.cityMunicipality?.trim() || null;
                b.province = data.province?.trim() || null;
            });

            if (Platform.OS === 'web') {
                window.alert("Borrower updated successfully.");
            } else {
                Alert.alert("Success", "Borrower updated successfully.");
            }
            setSaving(false);
            reset(data); // reset dirty state
        } catch (error) {
            handleSaveError(error, 'Borrower', 'update');
            setSaving(false);
        }
    };

    const handleDelete = () => {
        if (kpis.activeLoans > 0) {
            const msg = `Cannot delete — borrower has ${kpis.activeLoans} active loan(s). Close all loans first.`;
            if (Platform.OS === 'web') {
                window.alert(msg);
            } else {
                Alert.alert("Error", msg);
            }
            return;
        }
        setIsConfirmDeleteVisible(true);
    };

    const confirmDelete = async () => {
        if (!borrower) return;
        setSaving(true);
        setIsConfirmDeleteVisible(false);
        try {
            await BaseModelService.cascadeDeleteBorrower(borrower);
            router.replace('/(admin)/borrowers');
        } catch (e: any) {
            console.error('Failed to delete borrower', e);
            const msg = e.message || "Could not delete borrower.";
            if (Platform.OS === 'web') {
                window.alert(msg);
            } else {
                Alert.alert("Error", msg);
            }
            setSaving(false);
        }
    };

    const confirmDeleteLoan = async () => {
        if (!selectedLoan) return;
        setSaving(true);
        setIsConfirmDeleteLoanVisible(false);
        try {
            await BaseModelService.cascadeDeleteLoan(selectedLoan);
            await loadData();
            if (Platform.OS === 'web') {
                window.alert("Loan and related payments moved to trash.");
            } else {
                Alert.alert("Success", "Loan and related payments moved to trash.");
            }
        } catch (e: any) {
            console.error('Failed to delete loan', e);
            if (Platform.OS === 'web') {
                window.alert("Could not delete loan.");
            } else {
                Alert.alert("Error", "Could not delete loan.");
            }
        } finally {
            setSaving(false);
            setSelectedLoan(null);
        }
    };

    const confirmDeletePayment = async () => {
        if (!selectedPayment) return;
        setSaving(true);
        setIsConfirmDeletePaymentVisible(false);
        try {
            await BaseModelService.softDelete(selectedPayment);
            await loadData();
            if (Platform.OS === 'web') {
                window.alert("Payment record moved to trash.");
            } else {
                Alert.alert("Success", "Payment record moved to trash.");
            }
        } catch (e: any) {
            console.error('Failed to delete payment', e);
            if (Platform.OS === 'web') {
                window.alert("Could not delete payment.");
            } else {
                Alert.alert("Error", "Could not delete payment.");
            }
        } finally {
            setSaving(false);
            setSelectedPayment(null);
        }
    };

    const handlePrintStatement = async () => {
        if (!borrower || printing) return;

        if (loans.length === 0) {
            const msg = 'This borrower has no loan account to print.';
            if (Platform.OS === 'web') {
                window.alert(msg);
            } else {
                Alert.alert('No loan account', msg);
            }
            return;
        }

        setPrinting(true);
        try {
            await PdfGenerator.generateBorrowerStatementOfAccount(
                {
                    fullName: borrower.fullName,
                    address: borrower.decryptedAddress || borrower.address || undefined,
                    phone: borrower.decryptedPhone || borrower.phone || undefined,
                    dateOfBirth: borrower.dateOfBirth || undefined,
                    gender: borrower.gender || undefined,
                },
                loans.map(loan => {
                    const loanPayments = allPayments
                        .filter(payment => payment.loanId === loan.id)
                        .sort((a, b) => a.paymentDate - b.paymentDate);
                    const penalties = computeSchedulePenalties(
                        paymentSchedules.filter(schedule => schedule.loanId === loan.id)
                    );
                    const totalPenalty = penalties.reduce((sum, penalty) => sum + penalty.penaltyAmount, 0);
                    let runningBalance = loan.totalAmount + totalPenalty;
                    const savingsRatio = loan.totalAmount > 0
                        ? (loan.depositAmount || 0) / loan.totalAmount
                        : 0;

                    return {
                        loan: {
                            loanNumber: loan.loanNumber,
                            loanType: loan.loanType,
                            principalAmount: loan.principalAmount,
                            interestRate: loan.interestRate,
                            interestType: loan.interestType,
                            term: loan.term,
                            termUnit: loan.termUnit,
                            frequency: loan.frequency,
                            installmentAmount: loan.installmentAmount,
                            depositAmount: loan.depositAmount,
                            insuranceAmount: loan.insuranceAmount,
                            releaseDate: loan.releaseDate as number,
                            maturityDate: loan.maturityDate as number,
                            totalAmount: loan.totalAmount,
                            status: loan.status,
                            deductedAmount: loan.deductedAmount,
                            processingFee: loan.processingFee,
                            collectionFee: loan.collectionFee,
                            notarialFee: loan.notarialFee,
                            rodFee: loan.rodFee,
                            ltoFee: loan.ltoFee,
                            udiRebatableFee: loan.udiRebatableFee,
                            vatOnInterest: loan.vatOnInterest,
                            vatOnCharges: loan.vatOnCharges,
                            dstFee: loan.dstFee,
                            rebateAmount: loan.rebateAmount,
                            savingsPerPayment: loan.savingsPerPayment,
                        },
                        payments: loanPayments.map(payment => {
                            runningBalance = Math.max(0, runningBalance - payment.amount);
                            return {
                                paymentDate: payment.paymentDate,
                                receiptNumber: payment.receiptNumber || undefined,
                                amount: payment.amount,
                                pSavings: payment.amount * savingsRatio,
                                runningBalance,
                                notes: payment.notes || undefined,
                            };
                        }),
                        penalties: penalties.map(penalty => ({
                            dueDate: penalty.dueDate,
                            amountDue: penalty.amountDue,
                            daysDelayed: penalty.daysDelayed,
                            penaltyAmount: penalty.penaltyAmount,
                            reason: penalty.reason,
                        })),
                    };
                })
            );
        } catch (error) {
            console.error('Failed to print borrower statement of account', error);
            const msg = 'Failed to generate the statement of account.';
            if (Platform.OS === 'web') {
                window.alert(msg);
            } else {
                Alert.alert('Print failed', msg);
            }
        } finally {
            setPrinting(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50">
                <ActivityIndicator size="large" color="#D32F2F" />
            </View>
        );
    }
    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 20 }}>
            <BorrowerSearchBar currentBorrowerId={id} />
            <View className="mb-6">
                <Text className="text-3xl font-black text-gray-900">{borrower?.fullName}</Text>
                <View className="flex-row items-center mt-2 flex-wrap gap-2">
                    {!!borrower?.memberId && (
                        <View className="bg-amber-100 px-3 py-1.5 rounded-full flex-row items-center">
                            <MaterialIcons name="badge" size={14} color="#78350F" />
                            <Text className="text-amber-800 text-xs font-bold ml-1 uppercase">ID: {borrower.memberId}</Text>
                        </View>
                    )}
                    {!!borrower?.group && (
                        <View className="bg-blue-100 px-3 py-1.5 rounded-full flex-row items-center">
                            <MaterialIcons name="group" size={14} color="#1D4ED8" />
                            <Text className="text-blue-700 text-xs font-bold ml-1 uppercase">{borrower.group}</Text>
                        </View>
                    )}
                    {!!borrower?.collectorId && (
                        <View className="bg-green-100 px-3 py-1.5 rounded-full flex-row items-center">
                            <MaterialIcons name="person" size={14} color="#15803D" />
                            <Text className="text-green-700 text-xs font-bold ml-1 uppercase">
                                {collectorName || 'Assign Collector'}
                            </Text>
                        </View>
                    )}
                    {!!borrower?.dateOfBirth && (
                        <View className="bg-purple-100 px-3 py-1.5 rounded-full flex-row items-center">
                            <MaterialIcons name="cake" size={14} color="#7E22CE" />
                            <Text className="text-purple-700 text-xs font-bold ml-1 uppercase">
                                {format(new Date(borrower.dateOfBirth), 'MMM d, yyyy')}
                            </Text>
                        </View>
                    )}
                    {!!borrower?.createdAt && (
                        <View className="bg-gray-100 px-3 py-1.5 rounded-full flex-row items-center">
                            <MaterialIcons name="calendar-today" size={14} color="#4B5563" />
                            <Text className="text-gray-700 text-xs font-bold ml-1 uppercase">
                                Added: {format(new Date(borrower.createdAt), 'MMM d, yyyy')}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* KPI Cards */}
            <View className="flex-row mb-3 gap-2">
                <View className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100 items-center">
                    <Text className="text-blue-500 text-xs font-bold uppercase mb-1">Active Loans</Text>
                    <Text className="text-blue-900 text-2xl font-extrabold">{kpis.activeLoans}</Text>
                </View>
                <View className="flex-1 bg-green-50 p-4 rounded-xl border border-green-100 items-center">
                    <Text className="text-green-600 text-xs font-bold uppercase mb-1">Outstanding</Text>
                    <Text className="text-green-900 text-xl font-extrabold">{formatPHP(kpis.outstandingBalance)}</Text>
                </View>
            </View>

            {/* Savings & CBU Summary Cards */}
            <View className="flex-row mb-6 gap-2">
                <Pressable 
                    onPress={() => router.push(`/(admin)/borrowers/${id}/savings-transactions`)}
                    className="flex-1 bg-teal-900 p-4 rounded-xl border border-teal-800 flex-row items-center justify-between"
                    style={{ backgroundColor: '#0f766e' }}
                >
                    <View>
                        <Text className="text-teal-200 text-[10px] font-black uppercase tracking-widest mb-0.5">Savings Balance</Text>
                        <Text className="text-white text-xl font-black">{formatPHP(savingsBalance)}</Text>
                        <Text className="text-teal-200 text-[11px] font-bold mt-0.5">Member Savings</Text>
                    </View>
                    <MaterialIcons name="account-balance-wallet" size={24} color="#99f6e4" />
                </Pressable>

                <Pressable 
                    onPress={() => router.push(`/(admin)/borrowers/${id}/share-capital`)}
                    className="flex-1 bg-indigo-900 p-4 rounded-xl border border-indigo-800 flex-row items-center justify-between"
                    style={{ backgroundColor: '#3730a3' }}
                >
                    <View>
                        <Text className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-0.5">CBU / Shares</Text>
                        <Text className="text-white text-xl font-black">{formatPHP(cbuBalance.amount)}</Text>
                        <Text className="text-indigo-200 text-[11px] font-bold mt-0.5">{cbuBalance.shares} share{cbuBalance.shares !== 1 ? 's' : ''}</Text>
                    </View>
                    <MaterialIcons name="pie-chart" size={24} color="#a5b4fc" />
                </Pressable>
            </View>

            {/* Statement, Passbook & Reminders */}
            <View className="flex-row flex-wrap mb-8 gap-2">
                <Pressable
                    testID="borrower-print-statement"
                    disabled={printing || loans.length === 0}
                    className={`flex-1 min-w-[45%] flex-row p-4 rounded-xl items-center justify-center shadow-sm ${
                        printing || loans.length === 0 ? 'bg-gray-300' : 'bg-red-600 active:bg-red-700'
                    }`}
                    onPress={handlePrintStatement}
                >
                    {printing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <MaterialIcons name="print" size={20} color="#FFFFFF" className="mr-2" />
                    )}
                    <Text className="text-white font-bold text-sm uppercase ml-2">
                        {printing ? 'Printing...' : 'Print SOA'}
                    </Text>
                </Pressable>

                <Pressable
                    className="flex-1 min-w-[45%] bg-blue-900 flex-row p-4 rounded-xl items-center justify-center shadow-sm active:bg-blue-900"
                    onPress={() => router.push(`/(admin)/borrowers/${id}/passbook`)}
                >
                    <MaterialIcons name="menu-book" size={20} color="#FFFFFF" className="mr-2" />
                    <Text className="text-white font-bold text-sm uppercase">Passbook</Text>
                </Pressable>

                <Pressable
                    className="flex-1 min-w-[45%] bg-orange-700 flex-row p-4 rounded-xl items-center justify-center shadow-sm active:bg-orange-700"
                    onPress={() => router.push(`/(admin)/borrowers/${id}/savings-transactions`)}
                >
                    <MaterialIcons name="account-balance-wallet" size={20} color="#FFFFFF" className="mr-2" />
                    <Text className="text-white font-bold text-sm uppercase">Savings</Text>
                </Pressable>

                <Pressable
                    className="flex-1 min-w-[45%] bg-teal-700 flex-row p-4 rounded-xl items-center justify-center shadow-sm active:bg-teal-800"
                    onPress={() => router.push(`/(admin)/borrowers/${id}/registry-of-membership`)}
                >
                    <MaterialIcons name="assignment-ind" size={20} color="#FFFFFF" className="mr-2" />
                    <Text className="text-white font-bold text-sm uppercase">Registry</Text>
                </Pressable>

                <Pressable
                    className="flex-1 min-w-[45%] bg-indigo-700 flex-row p-4 rounded-xl items-center justify-center shadow-sm active:bg-indigo-800"
                    onPress={() => router.push(`/(admin)/borrowers/${id}/membership-agreement`)}
                >
                    <MaterialIcons name="description" size={20} color="#FFFFFF" className="mr-2" />
                    <Text className="text-white font-bold text-sm uppercase">Agreement</Text>
                </Pressable>

                <Pressable
                    className="flex-1 min-w-[45%] bg-purple-600 flex-row p-4 rounded-xl items-center justify-center shadow-sm active:bg-purple-700"
                    onPress={() => router.push(`/(admin)/borrowers/${id}/share-capital`)}
                >
                    <MaterialIcons name="pie-chart" size={20} color="#FFFFFF" className="mr-2" />
                    <Text className="text-white font-bold text-sm uppercase">Share Capital</Text>
                </Pressable>

                <Pressable
                    className="flex-1 min-w-[45%] bg-green-600 flex-row p-4 rounded-xl items-center justify-center shadow-sm active:bg-green-700"
                    onPress={() => {
                        if (!borrower) return;
                        
                        const reminderData = {
                            borrowerName: borrower.fullName,
                            amountDue: kpis.outstandingBalance,
                            dueDate: Date.now(), // Fallback to now if no specific due date is selected
                            phoneNumber: borrower.phone || undefined
                        };

                        const whatsappUrl = ReminderService.generateWhatsAppLink('friendly', reminderData);
                        const smsUrl = ReminderService.generateSmsLink('friendly', reminderData);

                        if (whatsappUrl) {
                            Linking.openURL(whatsappUrl).catch(() => {
                                if (smsUrl) {
                                    if (Platform.OS === 'web') {
                                        window.alert("WhatsApp not found. Opening SMS instead.");
                                    } else {
                                        Alert.alert("WhatsApp not found", "Opening SMS instead.");
                                    }
                                    Linking.openURL(smsUrl);
                                }
                            });
                        } else if (smsUrl) {
                            Linking.openURL(smsUrl);
                        } else {
                            if (Platform.OS === 'web') {
                                window.alert("No phone number available for this borrower.");
                            } else {
                                Alert.alert("Error", "No phone number available for this borrower.");
                            }
                        }
                    }}
                >
                    <MaterialIcons name="chat" size={20} color="#FFFFFF" className="mr-2" />
                    <Text className="text-white font-bold text-sm uppercase">Remind</Text>
                </Pressable>
            </View>

            {/* Loan History */}
            <View className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-8">
                <Text className="text-lg font-black text-gray-900 mb-4">Loan History</Text>
                {loans.length > 0 ? (
                    loans.map((l, idx) => (
                        <View key={l.id} className={`py-4 ${idx < loans.length - 1 ? 'border-b border-gray-50' : ''}`}>
                            <View className="flex-row justify-between items-start mb-1">
                                <View className="flex-1">
                                    <View className="flex-row items-center flex-wrap">
                                        <Text className="font-extrabold text-gray-900 mr-2">{l.loanNumber}</Text>
                                        <View className={`px-2 py-0.5 rounded-md ${
                                            l.status === 'active' ? 'bg-blue-100' : 
                                            l.status === 'closed' ? 'bg-green-100' : 'bg-red-100'
                                        }`}>
                                            <Text className={`text-[8px] font-black uppercase ${
                                                l.status === 'active' ? 'text-blue-700' : 
                                                l.status === 'closed' ? 'text-green-700' : 'text-red-700'
                                            }`}>{l.status}</Text>
                                        </View>
                                        {l.isReloan && (
                                            <View className="ml-2 bg-purple-100 px-2 py-0.5 rounded-md">
                                                <Text className="text-[8px] font-black uppercase text-purple-700">Renewal</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View className="flex-row items-center mt-1">
                                        <Text className="text-[10px] text-gray-700 font-bold uppercase">
                                            {format(new Date(l.releaseDate as any), 'MMM d, yyyy')} • {formatPHP(l.principalAmount)}
                                        </Text>
                                        {l.insuranceAmount > 0 && (
                                            <Text className="text-[10px] text-orange-600 font-black uppercase ml-2">
                                                (Ins: {formatPHP(l.insuranceAmount)})
                                            </Text>
                                        )}
                                    </View>
                                    {l.isReloan && l.previousLoanId && (
                                        <Text className="text-[10px] text-purple-400 font-bold mt-1">
                                            Renewed from: {loans.find(prev => prev.id === l.previousLoanId)?.loanNumber || 'Previous Loan'}
                                        </Text>
                                    )}
                                </View>
                                <View className="flex-row items-center">
                                    <Pressable 
                                        onPress={() => router.push(`/(admin)/loans/${l.id}`)}
                                        className="p-2 bg-gray-50 rounded-xl active:bg-gray-100 mr-2"
                                    >
                                        <MaterialIcons name="chevron-right" size={18} color="#9CA3AF" />
                                    </Pressable>
                                    {canDelete && (
                                        <Pressable 
                                            onPress={() => {
                                                setSelectedLoan(l);
                                                setIsConfirmDeleteLoanVisible(true);
                                            }}
                                            className="p-2 bg-red-50 rounded-xl active:bg-red-100"
                                        >
                                            <MaterialIcons name="delete-outline" size={18} color="#DC2626" />
                                        </Pressable>
                                    )}
                                </View>
                            </View>
                        </View>
                    ))
                ) : (
                    <Text className="text-gray-700 text-sm font-medium italic">No loan history found.</Text>
                )}
            </View>

            {/* Recent Activity (Payment History) */}
            <View className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm mb-8">
                <Text className="text-lg font-black text-gray-900 mb-4">Payment History</Text>
                {recentPayments.length > 0 ? (
                    recentPayments.map((p, idx) => {
                        const pLoan = loans.find(l => l.id === p.loanId);
                        const savingsRatio = pLoan ? (pLoan.depositAmount || 0) / (pLoan.totalAmount || 1) : 0;
                        const pSavings = p.amount * savingsRatio;

                        return (
                            <View key={p.id} className={`flex-row justify-between items-center py-3 ${idx < recentPayments.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                <View>
                                    <Text className="font-extrabold text-gray-900">{formatPHP(p.amount)}</Text>
                                    <View className="flex-row items-center">
                                        <Text className="text-[10px] text-gray-700 font-bold uppercase">{new Date(p.paymentDate).toLocaleDateString()}</Text>
                                        {pSavings > 0 && (
                                            <Text className="text-[10px] text-orange-600 font-black uppercase ml-2">
                                                (Incl. {formatPHP(pSavings)} Savings)
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                <View className="flex-row items-center">
                                    <View className="bg-green-50 px-3 py-1 rounded-full mr-2">
                                        <Text className="text-green-700 text-[10px] font-black uppercase">Paid</Text>
                                    </View>
                                    {canDelete && (
                                        <Pressable 
                                            onPress={() => {
                                                setSelectedPayment(p);
                                                setIsConfirmDeletePaymentVisible(true);
                                            }}
                                            className="p-2 bg-red-50 rounded-xl active:bg-red-100"
                                        >
                                            <MaterialIcons name="delete-outline" size={18} color="#DC2626" />
                                        </Pressable>
                                    )}
                                </View>
                            </View>
                        );
                    })
                ) : (
                    <Text className="text-gray-700 text-sm font-medium italic">No recent payments recorded.</Text>
                )}
            </View>

            {/* Edit Form */}
            <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <Text className="text-xl font-extrabold text-gray-900 mb-6">Edit Contact Info</Text>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Full Name *</Text>
                    <Controller
                        control={control}
                        name="fullName"
                        render={({ field: { onChange, value } }) => (
                            <TextInput
                                className={`bg-gray-50 p-4 rounded-xl border ${errors.fullName ? 'border-red-500' : 'border-gray-200'} text-gray-900`}
                                onChangeText={onChange}
                                value={value}
                                editable={!saving}
                            />
                        )}
                    />
                    {errors.fullName && <Text className="text-red-500 text-xs mt-1">{errors.fullName.message}</Text>}
                </View>

                <View className="flex-row mb-4">
                    <View className="flex-1 mr-2">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">First Name</Text>
                        <Controller control={control} name="firstName" render={({ field: { onChange, value } }) => (
                            <TextInput className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900" onChangeText={onChange} value={value || ''} editable={!saving} />
                        )} />
                    </View>
                    <View className="flex-1">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Last Name</Text>
                        <Controller control={control} name="lastName" render={({ field: { onChange, value } }) => (
                            <TextInput className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900" onChangeText={onChange} value={value || ''} editable={!saving} />
                        )} />
                    </View>
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Date of Birth</Text>
                    <Controller control={control} name="dateOfBirth" render={({ field: { onChange, onBlur, value } }) => (
                        <TextInput className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900" onChangeText={onChange} onBlur={onBlur} value={value || ''} placeholder="YYYY-MM-DD" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                    )} />
                </View>

                {/* (Truncated for brevity, normally include Phone, Address, Collector exactly like new.tsx) */}
                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Phone</Text>
                    <Controller control={control} name="phone" render={({ field: { onChange, value } }) => (
                        <TextInput className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900" onChangeText={onChange} value={value || ''} keyboardType="phone-pad" editable={!saving} />
                    )} />
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Address</Text>
                    <Controller control={control} name="address" render={({ field: { onChange, value } }) => (
                        <TextInput className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900" onChangeText={onChange} value={value || ''} multiline editable={!saving} />
                    )} />
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Group</Text>
                    <Controller control={control} name="group" render={({ field: { onChange, value } }) => (
                        <TextInput className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="Group A, Market Group..." editable={!saving}  placeholderTextColor="#9CA3AF"/>
                    )} />
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Co-Maker Name</Text>
                    <Controller control={control} name="coMakerName" render={({ field: { onChange, value } }) => (
                        <TextInput className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="Co-Maker Name" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                    )} />
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Business</Text>
                    <Controller control={control} name="business" render={({ field: { onChange, value } }) => (
                        <TextInput className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="Nature of Business" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                    )} />
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Assign to Collector</Text>
                    <Controller
                        control={control}
                        name="collectorId"
                        render={({ field: { onChange, value } }) => (
                            <View className="border border-gray-200 rounded-xl overflow-hidden">
                                {collectors.length === 0 ? (
                                    <Text className="p-4 text-gray-700">No collectors found.</Text>
                                ) : (
                                    collectors.map((c, i) => (
                                        <Pressable key={c.id} onPress={() => onChange(value === c.id ? '' : c.id)} className={`p-4 flex-row justify-between items-center ${i < collectors.length - 1 ? 'border-b border-gray-100' : ''} ${value === c.id ? 'bg-blue-50' : 'bg-gray-50'}`}>
                                            <Text className={value === c.id ? 'text-blue-700 font-bold' : 'text-gray-700 font-medium'}>{c.fullName}</Text>
                                            {value === c.id && <MaterialIcons name="check" size={20} color="#1D4ED8" />}
                                        </Pressable>
                                    ))
                                )}
                            </View>
                        )}
                    />
                </View>

                <View className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
                    <Text className="text-xs font-black text-blue-900 mb-3 uppercase tracking-wider">Land Bank Submission Details</Text>
                    <View className="mb-3">
                        <Text className="text-[10px] font-bold text-blue-700 mb-1 uppercase">Bank Name</Text>
                        <Controller control={control} name="bankName" render={({ field: { onChange, value } }) => (
                            <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} />
                        )} />
                    </View>
                    <View className="mb-3">
                        <Text className="text-[10px] font-bold text-blue-700 mb-1 uppercase">Account Name</Text>
                        <Controller control={control} name="bankAccountName" render={({ field: { onChange, value } }) => (
                            <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} placeholder="Defaults to borrower name"  placeholderTextColor="#9CA3AF"/>
                        )} />
                    </View>
                    <View className="flex-row">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-blue-700 mb-1 uppercase">Account No.</Text>
                            <Controller control={control} name="bankAccountNumber" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} placeholder="0000-0000-00"  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-blue-700 mb-1 uppercase">Branch</Text>
                            <Controller control={control} name="bankBranch" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} placeholder="LA CARLOTA"  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                    </View>
                </View>

                <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
                    <Text className="text-xs font-black text-amber-900 mb-3 uppercase tracking-wider">Membership & Loan Profile</Text>
                    <View className="mb-3">
                        <Text className="text-[10px] font-bold text-amber-800 mb-1 uppercase">Member ID</Text>
                        <Controller control={control} name="memberId" render={({ field: { onChange, value } }) => (
                            <TextInput className="bg-white p-3 rounded-xl border border-amber-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} placeholder="e.g. AG00033"  placeholderTextColor="#9CA3AF"/>
                        )} />
                    </View>
                    <View className="flex-row mb-3">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-amber-800 mb-1 uppercase">Cycle ID *</Text>
                            <Controller control={control} name="cycleId" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-amber-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} keyboardType="numeric" placeholder="1"  placeholderTextColor="#9CA3AF"/>
                            )} />
                            {errors.cycleId && <Text className="text-red-500 text-xs mt-1">{errors.cycleId.message}</Text>}
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-amber-800 mb-1 uppercase">Loan Code</Text>
                            <Controller control={control} name="loanCode" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-amber-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} placeholder="e.g. LC10K"  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                    </View>
                    <View className="flex-row">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-amber-800 mb-1 uppercase">Date Joined</Text>
                            <Controller control={control} name="dateJoined" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-amber-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} placeholder="YYYY-MM-DD"  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-amber-800 mb-1 uppercase">Membership Status</Text>
                            <Controller control={control} name="membershipStatus" render={({ field: { onChange, value } }) => (
                                <View className="flex-row bg-white rounded-xl border border-amber-100 overflow-hidden p-1">
                                    {['active', 'inactive'].map(status => (
                                        <Pressable key={status} onPress={() => onChange(status)} className={`flex-1 py-1.5 items-center rounded-lg ${value === status ? 'bg-amber-600' : ''}`}>
                                            <Text className={`text-[10px] font-black uppercase ${value === status ? 'text-white' : 'text-gray-600'}`}>{status}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            )} />
                        </View>
                    </View>
                    <View className="flex-row mt-3">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-red-800 mb-1 uppercase">Deceased Status</Text>
                            <Controller control={control} name="deceased" render={({ field: { onChange, value } }) => (
                                <View className="flex-row bg-white rounded-xl border border-amber-100 overflow-hidden p-1">
                                    {[{ label: 'Active', val: false }, { label: 'Deceased', val: true }].map(opt => (
                                        <Pressable key={opt.label} onPress={() => onChange(opt.val)} className={`flex-1 py-1.5 items-center rounded-lg ${value === opt.val ? 'bg-red-600' : ''}`}>
                                            <Text className={`text-[10px] font-black uppercase ${value === opt.val ? 'text-white' : 'text-gray-600'}`}>{opt.label}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            )} />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-red-800 mb-1 uppercase">Date of Death</Text>
                            <Controller control={control} name="dateOfDeath" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-amber-100 text-gray-900" value={value || ''} onChangeText={onChange} editable={!saving} placeholder="YYYY-MM-DD"  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                    </View>
                </View>

                {/* --- CIC COMPLIANCE SECTION --- */}
                <View className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
                    <View className="flex-row items-center justify-between mb-4 border-b border-blue-100 pb-2">
                        <Text className="text-xs font-black text-blue-900 uppercase tracking-wider">CIC Compliance & Demographics</Text>
                        {(() => {
                            const v = watch();
                            const missing = [];
                            if (!v.middleName) missing.push('Middle Name');
                            if (!v.dateOfBirth) missing.push('Date of Birth');
                            if (!v.birthplace) missing.push('Birthplace');
                            if (!v.civilStatus) missing.push('Civil Status');
                            if (!v.tinNumber && !v.sssNumber && !v.gsisNumber) missing.push('Gov ID');
                            
                            return missing.length === 0 ? (
                                <View className="bg-green-100 px-2 py-1 rounded-full flex-row items-center">
                                    <MaterialIcons name="check-circle" size={12} color="#16A34A" style={{ marginRight: 4 }} />
                                    <Text className="text-green-700 text-[9px] font-bold uppercase">CIC Ready</Text>
                                </View>
                            ) : (
                                <View className="bg-red-100 px-2 py-1 rounded-full flex-row items-center">
                                    <MaterialIcons name="error-outline" size={12} color="#DC2626" style={{ marginRight: 4 }} />
                                    <Text className="text-red-700 text-[9px] font-bold uppercase">{missing.length} Missing</Text>
                                </View>
                            );
                        })()}
                    </View>

                    <View className="flex-row mb-3">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-blue-800 mb-1 uppercase">Middle Name <Text className="text-red-500">*</Text></Text>
                            <Controller control={control} name="middleName" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="Required for CIC" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-blue-800 mb-1 uppercase">Name Suffix</Text>
                            <Controller control={control} name="nameSuffix" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="Jr., Sr., III" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                    </View>

                    <View className="flex-row mb-3">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-blue-800 mb-1 uppercase">Birthplace <Text className="text-red-500">*</Text></Text>
                            <Controller control={control} name="birthplace" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="City, Province" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-blue-800 mb-1 uppercase">Civil Status <Text className="text-red-500">*</Text></Text>
                            <Controller control={control} name="civilStatus" render={({ field: { onChange, value } }) => (
                                <View className="bg-white rounded-xl border border-blue-100 overflow-hidden">
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 4 }}>
                                        {['single', 'married', 'widowed', 'separated', 'annulled'].map(status => (
                                            <Pressable key={status} onPress={() => onChange(status)} className={`px-3 py-2 mr-1 rounded-lg ${value === status ? 'bg-blue-600' : ''}`}>
                                                <Text className={`text-[10px] font-bold capitalize ${value === status ? 'text-white' : 'text-gray-600'}`}>{status}</Text>
                                            </Pressable>
                                        ))}
                                    </ScrollView>
                                </View>
                            )} />
                        </View>
                    </View>

                    <View className="flex-row mb-3">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-blue-800 mb-1 uppercase">No. of Dependents</Text>
                            <Controller control={control} name="numberOfDependents" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} keyboardType="numeric" placeholder="0" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-blue-800 mb-1 uppercase">Mother's Maiden Name</Text>
                            <Controller control={control} name="motherMaidenName" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="Full maiden name" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                    </View>

                    <Text className="text-[10px] font-bold text-blue-800 mb-1 uppercase mt-2 border-t border-blue-100 pt-3">Government IDs (At least 1 required)</Text>
                    <View className="flex-row mb-3 mt-1">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-gray-500 mb-1 uppercase">TIN</Text>
                            <Controller control={control} name="tinNumber" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="xxx-xxx-xxx-xxx" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-gray-500 mb-1 uppercase">SSS</Text>
                            <Controller control={control} name="sssNumber" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="xx-xxxxxxx-x" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                    </View>
                    <View className="flex-row mb-3">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-gray-500 mb-1 uppercase">GSIS</Text>
                            <Controller control={control} name="gsisNumber" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="GSIS number" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-gray-500 mb-1 uppercase">PhilHealth</Text>
                            <Controller control={control} name="philhealthNumber" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} placeholder="xx-xxxxxxxxx-x" editable={!saving}  placeholderTextColor="#9CA3AF"/>
                            )} />
                        </View>
                    </View>
                    
                    <Text className="text-[10px] font-bold text-blue-800 mb-1 uppercase mt-2 border-t border-blue-100 pt-3">Spouse Info (If married)</Text>
                    <View className="flex-row mb-1 mt-1">
                        <View className="flex-1 mr-2">
                            <Text className="text-[10px] font-bold text-gray-500 mb-1 uppercase">Spouse First Name</Text>
                            <Controller control={control} name="spouseFirstName" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} editable={!saving} />
                            )} />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-[10px] font-bold text-gray-500 mb-1 uppercase">Spouse Middle</Text>
                            <Controller control={control} name="spouseMiddleName" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-white p-3 rounded-xl border border-blue-100 text-gray-900" onChangeText={onChange} value={value || ''} editable={!saving} />
                            )} />
                        </View>
                    </View>
                </View>

                <View className="mb-8">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Notes</Text>
                    <Controller control={control} name="notes" render={({ field: { onChange, value } }) => (
                        <TextInput className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 h-24 text-top" onChangeText={onChange} value={value || ''} multiline textAlignVertical="top" editable={!saving} />
                    )} />
                </View>

                {isDirty && canEdit && (
                    <Pressable
                        className={`w-full py-4 rounded-xl items-center mb-4 ${saving ? 'bg-red-400' : 'bg-red-600 active:bg-red-700'}`}
                        onPress={handleSubmit(onSubmit, (errs) => handleFormValidationError(errs, 'Borrower'))}
                        disabled={saving}
                    >
                        {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-lg">Save Changes</Text>}
                    </Pressable>
                )}

                {canDelete && (
                    <Pressable 
                        testID="delete-borrower-btn"
                        data-testid="delete-borrower-btn"
                        className="w-full py-4 rounded-xl items-center bg-gray-50 border border-gray-200 mt-2 active:bg-gray-100" onPress={handleDelete} disabled={saving}>
                        <Text className="text-red-600 font-bold">Delete Borrower</Text>
                    </Pressable>
                )}
            </View>

            <ConfirmDialog
                visible={isConfirmDeleteVisible}
                title="Delete Borrower?"
                message={`Are you sure you want to delete ${borrower?.fullName}? This will hide them from all lists. This action can be reversed by an administrator.`}
                confirmLabel="Delete"
                onConfirm={confirmDelete}
                onCancel={() => setIsConfirmDeleteVisible(false)}
                isDestructive
            />

            <ConfirmDialog
                visible={isConfirmDeleteLoanVisible}
                title="Delete Loan"
                message={`Are you sure you want to delete Loan ${selectedLoan?.loanNumber}? This will also soft-delete all related payments and schedules. You can restore it from Trash.`}
                confirmLabel="Delete"
                onConfirm={confirmDeleteLoan}
                onCancel={() => {
                    setIsConfirmDeleteLoanVisible(false);
                    setSelectedLoan(null);
                }}
                isDestructive
            />

            <ConfirmDialog
                visible={isConfirmDeletePaymentVisible}
                title="Delete Payment"
                message={`Are you sure you want to delete this payment of ${selectedPayment ? formatPHP(selectedPayment.amount) : ''}? This can be recovered from Trash.`}
                confirmLabel="Delete"
                onConfirm={confirmDeletePayment}
                onCancel={() => {
                    setIsConfirmDeletePaymentVisible(false);
                    setSelectedPayment(null);
                }}
                isDestructive
            />
        </ScrollView>
    );
}
