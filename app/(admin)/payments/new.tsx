import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, SafeAreaView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '../../../src/utils/navigation';
import ConfirmDialog from '../../../src/components/ConfirmDialog';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { database } from '../../../src/database';
import Loan from '../../../src/database/models/Loan';
import Borrower from '../../../src/database/models/Borrower';
import Payment from '../../../src/database/models/Payment';
import PaymentSchedule from '../../../src/database/models/PaymentSchedule';
import { Q } from '@nozbe/watermelondb';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../src/store/AuthContext';
import { formatPHP } from '../../../src/utils/currency';
import { PaymentService } from '../../../src/services/PaymentService';
import { DatePicker } from '../../../src/components/DatePicker';
import { format, parseISO } from 'date-fns';
import { handleFormValidationError, handleSaveError } from '../../../src/utils/errorAlerts';
import { ExcessCashReceiptService } from '../../../src/services/ExcessCashReceiptService';


const schema = z.object({
    selectedLoanId: z.string().min(1, "Loan selection is required"),
    amount: z.string().refine(v => v.trim() !== '' && !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Amount must be greater than zero"),
    paymentDate: z.string().min(1, "Payment date is required"),
    paymentType: z.string().default('cash'),
    receiptNumber: z.string().optional(),
    currentSalary: z.string().optional().refine(v => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0), "Current salary must be zero or higher"),
    notes: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.paymentType !== 'cash' && (!data.receiptNumber || data.receiptNumber.trim() === '')) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Reference Number is required for GCash/Bank transfers",
            path: ["receiptNumber"]
        });
    }
});

type FormData = z.infer<typeof schema>;

export default function NewPaymentScreen() {
    const { loanId, paymentId } = useLocalSearchParams<{ loanId?: string; paymentId?: string }>();
    const router = useRouter();
    const { user } = useAuth();
    const isEditMode = Boolean(paymentId);
    const [saving, setSaving] = useState(false);
    const [isConfirmOverpaymentVisible, setIsConfirmOverpaymentVisible] = useState(false);
    const [pendingData, setPendingData] = useState<FormData | null>(null);
    const [loans, setLoans] = useState<{ 
        id: string, 
        label: string, 
        amount: number, 
        borrowerId: string,
        borrowerName: string,
        loanNumber: string,
        group: string,
        area: string 
    }[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('All');
    const [groups, setGroups] = useState<string[]>(['All']);
    const [outstandingBalance, setOutstandingBalance] = useState<number>(0);
    const [suggestedAmount, setSuggestedAmount] = useState<number>(0);

    const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            selectedLoanId: loanId || '',
            amount: '',
            paymentDate: format(new Date(), 'yyyy-MM-dd'),
            paymentType: 'cash',
            receiptNumber: '',
            currentSalary: '',
            notes: '',
        }
    });

    const selectedLoanId = watch('selectedLoanId');
    const paymentAmountPreview = parseFloat(watch('amount') || '0') || 0;
    const currentSalaryPreview = parseFloat(watch('currentSalary') || '0') || 0;
    const excessCashPreview = ExcessCashReceiptService.calculateExcessCash(currentSalaryPreview, paymentAmountPreview);

    useEffect(() => {
        const loadLoans = async () => {
            const activeLoans = await database.collections.get<Loan>('loans').query(
                Q.where('deleted_at', Q.eq(null)),
                isEditMode ? Q.where('id', Q.notEq('')) : Q.where('status', Q.oneOf(['active', 'defaulted']))
            ).fetch();
            const borrowers = await database.collections.get<Borrower>('borrowers').query().fetch();
            
            const bMap = new Map();
            const gSet = new Set<string>(['All']);
            
            borrowers.forEach(b => {
                const groupName = b.group || 'No Group';
                bMap.set(b.id, {
                    name: b.fullName,
                    group: groupName,
                    area: b.area || 'No Area'
                });
                if (b.group) gSet.add(b.group);
            });
            
            const opts = activeLoans.map(l => {
                const bInfo = bMap.get(l.borrowerId) || { name: 'Unknown', group: 'No Group', area: 'No Area' };
                return {
                    id: l.id,
                    label: `${bInfo.name} - ${l.loanNumber}`,
                    amount: l.totalAmount,
                    borrowerId: l.borrowerId,
                    borrowerName: bInfo.name,
                    loanNumber: l.loanNumber,
                    group: bInfo.group,
                    area: bInfo.area
                };
            });
            setLoans(opts);
            setGroups(Array.from(gSet).sort((a, b) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b)));
        };
        loadLoans();
    }, [isEditMode]);

    useEffect(() => {
        if (!paymentId) return;

        const loadPaymentForEdit = async () => {
            const payment = await database.collections.get<Payment>('payments').find(paymentId);
            setValue('selectedLoanId', payment.loanId);
            setValue('amount', String(payment.amount ?? ''));
            setValue('paymentDate', format(new Date(payment.paymentDate), 'yyyy-MM-dd'));
            setValue('paymentType', payment.paymentType || 'cash');
            setValue('receiptNumber', payment.receiptNumber || '');
            setValue('currentSalary', payment.currentSalary ? String(payment.currentSalary) : '');
            setValue('notes', payment.notes || '');
        };

        loadPaymentForEdit().catch(error => {
            console.error('Failed to load payment for edit:', error);
            if (Platform.OS === 'web') {
                window.alert('Failed to load payment for editing.');
            } else {
                Alert.alert('Error', 'Failed to load payment for editing.');
            }
            safeBack(router, '/(admin)/payments');
        });
    }, [paymentId, router, setValue]);

    const filteredLoans = loans.filter(l => {
        const matchesSearch = l.label.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesGroup = selectedGroup === 'All' || l.group === selectedGroup;
        return matchesSearch && matchesGroup;
    });

    useEffect(() => {
        if (!selectedLoanId) {
            setOutstandingBalance(0);
            setSuggestedAmount(0);
            return;
        }
        const calcBalances = async () => {
            const l = await database.collections.get<Loan>('loans').find(selectedLoanId);
            const p = await database.collections.get<Payment>('payments').query(
                Q.where('deleted_at', Q.eq(null)),
                Q.where('loan_id', selectedLoanId)
            ).fetch();
            const s = await database.collections.get<PaymentSchedule>('payment_schedules').query(
                Q.where('loan_id', selectedLoanId),
                Q.sortBy('due_date', Q.asc)
            ).fetch();
            const paid = p
                .filter(pay => !isEditMode || pay.id !== paymentId)
                .reduce((sum, pay) => sum + pay.amount, 0);
            const balance = Math.max(0, l.totalAmount - paid);
            setOutstandingBalance(balance);
            const pendingSched = s.find(sched => sched.status === 'pending' || sched.status === 'late' || sched.status === 'partial');
            if (pendingSched) {
                setSuggestedAmount(pendingSched.scheduledAmount);
                if (!isEditMode) setValue('amount', pendingSched.scheduledAmount.toString());
            } else {
                setSuggestedAmount(0);
            }
        };
        calcBalances();
    }, [selectedLoanId, isEditMode, paymentId, setValue]);

    const onSubmit = async (data: FormData) => {
        if (data.paymentType !== 'cash' && (!data.receiptNumber || !String(data.receiptNumber).trim())) {
            Alert.alert('Validation Error', 'Reference number is required for non-cash payments.');
            return;
        }

        const paymentAmount = parseFloat(data.amount);
        if (paymentAmount > outstandingBalance && outstandingBalance > 0) {
            if (Platform.OS === 'web') {
                setPendingData(data);
                setIsConfirmOverpaymentVisible(true);
            } else {
                Alert.alert("Confirm Overpayment", "The payment amount exceeds the outstanding balance. Proceed anyway?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Proceed", onPress: () => saveDatabase(data) }
                ]);
            }
            return;
        }
        saveDatabase(data);
    };

    const handleConfirmOverpayment = () => {
        setIsConfirmOverpaymentVisible(false);
        if (pendingData) {
            saveDatabase(pendingData);
            setPendingData(null);
        }
    };

    const saveDatabase = async (data: FormData) => {
        setSaving(true);
        const paymentAmount = parseFloat(data.amount);
        const currentSalary = parseFloat(data.currentSalary || '0') || 0;
        const selectedLoan = loans.find(l => l.id === data.selectedLoanId);
        const amountDueBeforePayment = outstandingBalance;
        try {
            if (isEditMode && paymentId) {
                await PaymentService.updatePayment(paymentId, {
                    amount: paymentAmount,
                    paymentDate: parseISO(data.paymentDate),
                    paymentType: data.paymentType,
                    receiptNumber: data.receiptNumber,
                    currentSalary,
                    notes: data.notes,
                    performedBy: user?.id,
                    database,
                });
            } else {
                await PaymentService.postPayment({
                    loanId: data.selectedLoanId,
                    amount: paymentAmount,
                    paymentDate: parseISO(data.paymentDate),
                    paymentType: data.paymentType,
                    receiptNumber: data.receiptNumber,
                    currentSalary,
                    notes: data.notes,
                    encodedBy: user?.id,
                    database,
                });

                await new ExcessCashReceiptService().printIfNeeded({
                    loan: selectedLoan ? {
                        borrowerName: selectedLoan.borrowerName,
                        loanNumber: selectedLoan.loanNumber,
                    } : null,
                    paymentAmount,
                    amountDueBeforePayment,
                    paymentDate: parseISO(data.paymentDate),
                    receiptNumber: data.receiptNumber,
                    notes: data.notes,
                    preparedBy: user?.email || user?.id || 'System',
                });
            }

            if (Platform.OS === 'web') {
                window.alert(isEditMode ? "Payment updated successfully." : "Payment recorded successfully.");
            } else {
                Alert.alert("Success", isEditMode ? "Payment updated successfully." : "Payment recorded successfully.");
            }
            safeBack(router, '/(admin)/payments');
        } catch (error) {
            handleSaveError(error, 'Payment', isEditMode ? 'update' : 'save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
            <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                <Text testID="page-title" className="text-xl font-extrabold text-gray-900 mb-6">{isEditMode ? 'Edit Payment' : 'Record Payment'}</Text>

                <View className="mb-6">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-widest">Select Loan Account *</Text>
                    
                    {/* Search and Filters */}
                    <View className="mb-4 gap-3">
                        <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-1">
                            <Ionicons name="search" size={20} color="#9CA3AF" />
                            <TextInput
                                className="flex-1 ml-2 h-12 text-gray-900 font-semibold"
                                placeholder="Search borrower or loan #"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCapitalize="none"
                             placeholderTextColor="#9CA3AF"/>
                            {searchQuery.length > 0 && (
                                <Pressable onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                                </Pressable>
                            )}
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row overflow-visible">
                            {groups.map(group => (
                                <Pressable
                                    key={group}
                                    onPress={() => setSelectedGroup(group)}
                                    className={`px-4 py-2 rounded-full mr-2 border ${selectedGroup === group ? 'bg-blue-900 border-blue-900' : 'bg-white border-gray-200'}`}
                                >
                                    <Text className={`text-xs font-bold ${selectedGroup === group ? 'text-white' : 'text-gray-700'}`}>
                                        {group}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>

                    <Controller
                        control={control}
                        name="selectedLoanId"
                        render={({ field: { onChange, value } }) => (
                            <View className="border border-gray-200 rounded-3xl overflow-hidden bg-gray-50">
                                {filteredLoans.length === 0 ? (
                                    <View className="p-10 items-center justify-center">
                                        <Ionicons name="search-outline" size={48} color="#D1D5DB" />
                                        <Text className="mt-4 text-gray-700 font-bold text-center">No loans found matching your search.</Text>
                                    </View>
                                ) : (
                                    <View style={{ maxHeight: 300 }}>
                                        <ScrollView nestedScrollEnabled className="flex-grow-0">
                                            {filteredLoans.map((l, i) => (
                                                <Pressable
                                                    key={l.id}
                                                    onPress={() => { if (!isEditMode) onChange(l.id); }}
                                                    disabled={isEditMode}
                                                    className={`p-4 flex-row justify-between items-center ${i < filteredLoans.length - 1 ? 'border-b border-gray-100' : ''} ${value === l.id ? 'bg-blue-50/50' : ''}`}
                                                >
                                                    <View className="flex-1">
                                                        <Text className={value === l.id ? 'text-blue-900 font-black text-base' : 'text-gray-900 font-bold text-base'}>
                                                            {l.borrowerName}
                                                        </Text>
                                                        <View className="flex-row items-center mt-1">
                                                            <View className="bg-gray-200 px-2 py-0.5 rounded-md mr-2">
                                                                <Text className="text-[10px] font-black text-gray-600">{l.loanNumber}</Text>
                                                            </View>
                                                            <Text className="text-gray-700 text-xs font-medium">{l.group} • {l.area}</Text>
                                                        </View>
                                                    </View>
                                                    <View className="flex-row items-center">
                                                        {value === l.id ? (
                                                            <Ionicons name="checkmark-circle" size={24} color="#1E3A8A" />
                                                        ) : (
                                                            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                                                        )}
                                                    </View>
                                                </Pressable>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>
                        )}
                    />
                    {isEditMode ? (
                        <Text className="text-[10px] text-amber-600 font-bold mt-2 uppercase">Loan account is locked when editing a payment.</Text>
                    ) : null}
                    {errors.selectedLoanId && <Text className="text-red-500 text-xs mt-2 ml-1 font-bold">{errors.selectedLoanId.message}</Text>}
                </View>

                {selectedLoanId ? (
                    <View className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6 flex-row justify-between items-center">
                        <View>
                            <Text className="text-blue-500 text-[10px] font-bold uppercase tracking-widest mb-1">Outstanding Balance</Text>
                            <Text className="text-blue-900 text-xl font-extrabold">{formatPHP(outstandingBalance)}</Text>
                        </View>
                        {suggestedAmount > 0 && (
                            <View className="items-end">
                                <Text className="text-blue-500 text-[10px] font-bold uppercase tracking-widest mb-1">Due Amount</Text>
                                <Text className="text-blue-900 text-base font-bold">{formatPHP(suggestedAmount)}</Text>
                            </View>
                        )}
                    </View>
                ) : null}

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Date of Payment *</Text>
                    <Controller
                        control={control}
                        name="paymentDate"
                        render={({ field: { onChange, value } }) => (
                            <DatePicker value={value} onChange={onChange} />
                        )}
                    />
                    {errors.paymentDate && <Text className="text-red-500 text-xs mt-1">{errors.paymentDate.message}</Text>}
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Payment Method *</Text>
                    <Controller
                        control={control}
                        name="paymentType"
                        render={({ field: { onChange, value } }) => (
                            <View className="flex-row rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                                {['cash', 'gcash', 'bank'].map((type) => (
                                    <Pressable
                                        key={type}
                                        onPress={() => onChange(type)}
                                        className={`flex-1 p-3 items-center justify-center ${value === type ? 'bg-blue-900' : ''}`}
                                    >
                                        <Text className={`font-bold uppercase text-[11px] ${value === type ? 'text-white' : 'text-gray-700'}`}>
                                            {type === 'bank' ? 'Bank Tx' : type}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    />
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Amount Received (₱) *</Text>
                    <Controller
                        control={control}
                        name="amount"
                        render={({ field: { onChange, value } }) => (
                            <TextInput
                                className={`bg-gray-50 p-4 rounded-xl border ${errors.amount ? 'border-red-500' : 'border-gray-200'} text-gray-900 font-extrabold text-2xl tracking-tighter`}
                                value={value} onChangeText={onChange} keyboardType="numeric" editable={!saving}
                                placeholder="0.00"
                             placeholderTextColor="#9CA3AF"/>
                        )}
                    />
                    {errors.amount && <Text className="text-red-500 text-xs mt-1">{errors.amount.message}</Text>}
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Current Salary / ATM Withdrawal</Text>
                    <Controller
                        control={control}
                        name="currentSalary"
                        render={({ field: { onChange, value } }) => (
                            <TextInput
                                className={`bg-gray-50 p-4 rounded-xl border ${errors.currentSalary ? 'border-red-500' : 'border-gray-200'} text-gray-900 font-bold text-xl`}
                                value={value}
                                onChangeText={onChange}
                                keyboardType="numeric"
                                editable={!saving}
                                placeholder="0.00"
                             placeholderTextColor="#9CA3AF"/>
                        )}
                    />
                    {errors.currentSalary && <Text className="text-red-500 text-xs mt-1">{errors.currentSalary.message}</Text>}
                    {currentSalaryPreview > 0 ? (
                        <View className="bg-green-50 border border-green-100 rounded-xl p-3 mt-3">
                            <Text className="text-green-800 text-xs font-bold uppercase">Excess Cash Preview</Text>
                            <Text className="text-green-900 text-xl font-black mt-1">{formatPHP(excessCashPreview)}</Text>
                            <Text className="text-green-700 text-xs mt-1">
                                {formatPHP(currentSalaryPreview)} salary less {formatPHP(paymentAmountPreview)} payment.
                            </Text>
                        </View>
                    ) : (
                        <Text className="text-[11px] text-gray-500 mt-2">Optional, but recommended for automatic Excess Cash Report.</Text>
                    )}
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Receipt / Reference Number {watch('paymentType') !== 'cash' ? '*' : ''}</Text>
                    <Controller
                        control={control}
                        name="receiptNumber"
                        render={({ field: { onChange, value } }) => (
                            <TextInput
                                className={`bg-gray-50 p-4 rounded-xl border ${errors.receiptNumber ? 'border-red-500' : 'border-gray-200'} text-gray-900 font-bold tracking-wider uppercase`}
                                value={value} onChangeText={onChange} editable={!saving}
                                placeholder={watch('paymentType') === 'cash' ? "RCT-000000" : "REF-000000"}
                             placeholderTextColor="#9CA3AF"/>
                        )}
                    />
                    {errors.receiptNumber && <Text className="text-red-500 text-xs mt-1">{errors.receiptNumber.message}</Text>}
                </View>

                <View className="mb-8">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Notes</Text>
                    <Controller
                        control={control}
                        name="notes"
                        render={({ field: { onChange, value } }) => (
                            <TextInput
                                className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 h-24 text-top"
                                value={value} onChangeText={onChange} editable={!saving} multiline
                                placeholder="Optional remarks..."
                                textAlignVertical="top"
                             placeholderTextColor="#9CA3AF"/>
                        )}
                    />
                </View>

                <Pressable
                    className={`w-full py-4 rounded-xl items-center flex-row justify-center ${saving ? 'bg-green-400' : 'bg-yellow-500 active:bg-green-800'}`}
                    onPress={handleSubmit(onSubmit, (errs) => handleFormValidationError(errs, 'Payment'))} disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : (
                        <>
                            <MaterialIcons name="done-all" size={24} color="#fff" className="mr-2" />
                            <Text className="text-white font-black text-xl uppercase tracking-wider">{isEditMode ? 'Update Payment' : 'Save Payment'}</Text>
                        </>
                    )}
                </Pressable>
            </View>

            <ConfirmDialog
                visible={isConfirmOverpaymentVisible}
                title="Confirm Overpayment"
                message="The payment amount exceeds the outstanding balance. Proceed anyway?"
                onConfirm={handleConfirmOverpayment}
                onCancel={() => setIsConfirmOverpaymentVisible(false)}
                confirmText="Proceed"
                cancelText="Cancel"
            />
        </ScrollView>
    );
}
