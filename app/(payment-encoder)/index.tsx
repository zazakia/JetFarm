import React, { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
    View, Text, TextInput, Pressable, ScrollView,
    ActivityIndicator, Alert, SafeAreaView, StatusBar,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { database } from '../../src/database';
import { BorrowerSelector } from '../../src/components/BorrowerSelector';
import { formatPHP } from '../../src/utils/currency';
import { MaterialIcons } from '@expo/vector-icons';
import Borrower from '../../src/database/models/Borrower';
import Loan from '../../src/database/models/Loan';
import { Q } from '@nozbe/watermelondb';
import { LinearGradient } from 'expo-linear-gradient';
import { SyncStatusIndicator } from '../../src/components/SyncStatusIndicator';
import { AuthService } from '../../src/services/AuthService';
import { useAuth } from '../../src/store/AuthContext';
import { PhpCurrencyText } from '../../src/components/PhpCurrencyText';
import { SeriesService } from '../../src/services/SeriesService';
import { DatePicker } from '../../src/components/DatePicker';
import { format, parseISO } from 'date-fns';
import { PaymentService } from '../../src/services/PaymentService';
import { handleFormValidationError, handleSaveError } from '../../src/utils/errorAlerts';
import { ExcessCashReceiptService } from '../../src/services/ExcessCashReceiptService';
import { StateView } from '../../src/components/StateView';
import {
    OtherReceiptService,
    OtherReceiptCategory,
    OTHER_RECEIPT_CATEGORIES
} from '../../src/services/OtherReceiptService';


const schema = z.object({
    borrowerId: z.string().min(1, 'Borrower is required'),
    selectedLoanId: z.string().min(1, 'Loan selection is required'),
    amount: z.string().refine(v => v.trim() !== '' && !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Amount must be greater than zero'),
    paymentDate: z.string().min(1, 'Payment date is required'),
    receiptNumber: z.string().optional(),
    currentSalary: z.string().optional().refine(v => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0), 'Current salary must be zero or higher'),
    notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function PaymentEncoderScreen() {
    const { user, role, collectorId, signOut } = useAuth();
    const { borrowerId: paramBorrowerId, loanId: paramLoanId } = useLocalSearchParams<{ borrowerId: string, loanId: string }>();
    const router = useRouter();
    const [encoderMode, setEncoderMode] = useState<'loan' | 'other'>('loan');
    const [saving, setSaving] = useState(false);
    const [loans, setLoans] = useState<Loan[]>([]);

    // Other Receipt State
    const [otherPayorName, setOtherPayorName] = useState('');
    const [otherCategory, setOtherCategory] = useState<OtherReceiptCategory>('service_charge');
    const [otherAmount, setOtherAmount] = useState('');
    const [otherReceiptNumber, setOtherReceiptNumber] = useState(SeriesService.generateReceiptNumber());
    const [otherDate, setOtherDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [otherNotes, setOtherNotes] = useState('');
    const [otherSaving, setOtherSaving] = useState(false);

    const { control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: { 
            borrowerId: paramBorrowerId || '', 
            selectedLoanId: paramLoanId || '', 
            amount: '', 
            paymentDate: format(new Date(), 'yyyy-MM-dd'),
            receiptNumber: SeriesService.generateReceiptNumber(), 
            currentSalary: '',
            notes: '' 
        },
    });

    // Handle case where params change after mount
    useEffect(() => {
        if (paramBorrowerId) setValue('borrowerId', paramBorrowerId);
        if (paramLoanId) setValue('selectedLoanId', paramLoanId);
    }, [paramBorrowerId, paramLoanId]);

    const borrowerId = watch('borrowerId');
    const selectedLoanId = watch('selectedLoanId');
    const paymentAmountPreview = parseFloat(watch('amount') || '0') || 0;
    const currentSalaryPreview = parseFloat(watch('currentSalary') || '0') || 0;
    const excessCashPreview = ExcessCashReceiptService.calculateExcessCash(currentSalaryPreview, paymentAmountPreview);

    useEffect(() => {
        let cancelled = false;

        const loadActiveLoans = async () => {
            if (!borrowerId) {
                setLoans([]);
                setValue('selectedLoanId', '');
                return;
            }

            try {
                if (role === 'collector') {
                    if (!collectorId) {
                        setLoans([]);
                        setValue('selectedLoanId', '');
                        return;
                    }

                    const borrower = await database.collections.get<Borrower>('borrowers').find(borrowerId);
                    if (borrower.collectorId !== collectorId) {
                        setLoans([]);
                        setValue('selectedLoanId', '');
                        Alert.alert('Access denied', 'This borrower is not assigned to your collector account.');
                        return;
                    }
                }

                const activeLoans = await database.collections.get<Loan>('loans')
                    .query(Q.where('borrower_id', borrowerId), Q.where('status', 'active'))
                    .fetch();

                if (cancelled) return;

                setLoans(activeLoans);
                if (selectedLoanId && !activeLoans.some(loan => loan.id === selectedLoanId)) {
                    setValue('selectedLoanId', '');
                }
            } catch (error) {
                console.error('Failed to load active loans:', error);
                if (!cancelled) {
                    setLoans([]);
                    setValue('selectedLoanId', '');
                }
            }
        };

        loadActiveLoans();

        return () => {
            cancelled = true;
        };
    }, [borrowerId, collectorId, role, selectedLoanId, setValue]);

    useEffect(() => {
        const selectedLoan = loans.find(l => l.id === selectedLoanId);
        if (selectedLoan) setValue('amount', selectedLoan.installmentAmount.toString());
    }, [selectedLoanId, loans]);

    const onSubmit = async (data: FormData) => {
        setSaving(true);
        try {
            const selectedLoanForSubmit = loans.find(loan => loan.id === data.selectedLoanId);
            if (!selectedLoanForSubmit) {
                Alert.alert('Select loan', 'Choose an active loan for an assigned borrower before saving.');
                return;
            }

            await PaymentService.postPayment({
                loanId: data.selectedLoanId,
                amount: parseFloat(data.amount),
                paymentDate: parseISO(data.paymentDate),
                receiptNumber: data.receiptNumber,
                currentSalary: parseFloat(data.currentSalary || '0') || 0,
                notes: data.notes,
                encodedBy: user?.id,
                collectorId: role === 'collector' ? collectorId : undefined,
                database,
            });

            Alert.alert('Payment saved', 'Payment recorded successfully.');
            setValue('amount', '');
            setValue('receiptNumber', SeriesService.generateReceiptNumber());
            setValue('currentSalary', '');
            setValue('notes', '');
            reset({ ...watch(), amount: '', currentSalary: '', receiptNumber: SeriesService.generateReceiptNumber(), notes: '' });
        } catch (error) {
            handleSaveError(error, 'Payment', 'save');
        } finally {
            setSaving(false);
        }
    };

    const handleOtherReceiptSubmit = async () => {
        const payor = otherPayorName.trim();
        if (!payor) {
            Alert.alert('Required Field', 'Please enter payor name.');
            return;
        }

        const val = parseFloat(otherAmount);
        if (isNaN(val) || val <= 0) {
            Alert.alert('Invalid Amount', 'Please enter a valid positive amount.');
            return;
        }

        setOtherSaving(true);
        try {
            await OtherReceiptService.createReceipt({
                receiptNumber: otherReceiptNumber.trim() || undefined,
                payorName: payor,
                category: otherCategory,
                amount: val,
                paymentMethod: 'cash',
                transactionDate: parseISO(otherDate),
                notes: otherNotes,
                recordedBy: user?.id,
            });

            Alert.alert('Success', 'Official Other Receipt recorded and auto-posted successfully.');
            setOtherAmount('');
            setOtherNotes('');
            setOtherPayorName('');
            setOtherReceiptNumber(SeriesService.generateReceiptNumber());
        } catch (error: any) {
            console.error('Failed to save other receipt:', error);
            Alert.alert('Error', error?.message || 'Failed to save other receipt.');
        } finally {
            setOtherSaving(false);
        }
    };

    const selectedLoan = loans.find(l => l.id === selectedLoanId);
    const otherCategories = Object.values(OTHER_RECEIPT_CATEGORIES);

    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            <StatusBar barStyle="light-content" />
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Gradient Header */}
                <LinearGradient
                    colors={['#B45309', '#78350F']}
                    className="pt-10 pb-20 px-6 rounded-b-[40px]"
                >
                    <View className="flex-row items-center justify-between">
                        <View>
                            <Text className="text-amber-50 text-xs font-black uppercase tracking-[3px]">Payment Encoder</Text>
                            <Text className="text-white text-3xl font-black mt-1">{user?.email?.split('@')[0]}</Text>
                        </View>
                        <View className="items-end gap-2">
                            <SyncStatusIndicator />
                            <Pressable
                                testID="logout-button"
                                onPress={signOut}
                                accessibilityRole="button"
                                accessibilityLabel="Sign out"
                                className="p-2.5 bg-white/10 rounded-2xl active:bg-white/20 border border-white/10"
                            >
                                <MaterialIcons name="logout" size={18} color="#FFF" />
                            </Pressable>
                        </View>
                    </View>
                </LinearGradient>

                {/* Form Card */}
                <View className="px-6 -mt-12 mb-10">
                    <View className="bg-white rounded-[32px] p-6 border border-gray-50" style={{ boxShadow: '0 20px 25px -5px rgba(120,53,15,0.1)' }}>
                        {/* Mode Selector */}
                        <View className="flex-row bg-gray-100 p-1 rounded-2xl mb-6">
                            <Pressable
                                onPress={() => setEncoderMode('loan')}
                                className={`flex-1 py-3 items-center rounded-xl ${encoderMode === 'loan' ? 'bg-white shadow-sm' : ''}`}
                            >
                                <Text className={`text-xs font-black uppercase ${encoderMode === 'loan' ? 'text-amber-900' : 'text-gray-600'}`}>
                                    Loan Payment
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={() => setEncoderMode('other')}
                                className={`flex-1 py-3 items-center rounded-xl ${encoderMode === 'other' ? 'bg-white shadow-sm' : ''}`}
                            >
                                <Text className={`text-xs font-black uppercase ${encoderMode === 'other' ? 'text-emerald-900' : 'text-gray-600'}`}>
                                    Other Receipt
                                </Text>
                            </Pressable>
                        </View>

                        <Text testID="page-title" className="text-gray-900 text-xl font-black mb-6">
                            {encoderMode === 'loan' ? 'Record Loan Payment' : 'Issue Official Other Receipt'}
                        </Text>

                        {encoderMode === 'other' ? (
                            /* Other Receipt Mode */
                            <View>
                                {/* Payor Name */}
                                <View className="mb-4">
                                    <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Payor Name *</Text>
                                    <TextInput
                                        className="bg-gray-50 px-5 py-4 rounded-2xl border border-gray-200 text-gray-900 font-bold text-base"
                                        value={otherPayorName}
                                        onChangeText={setOtherPayorName}
                                        placeholder="Enter customer / member name"
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>

                                {/* Category Chips */}
                                <View className="mb-4">
                                    <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Receipt Category *</Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {otherCategories.map(cat => {
                                            const isSelected = otherCategory === cat.key;
                                            return (
                                                <Pressable
                                                    key={cat.key}
                                                    onPress={() => setOtherCategory(cat.key)}
                                                    className={`px-3 py-2 rounded-xl border flex-row items-center ${
                                                        isSelected ? 'bg-emerald-50 border-emerald-600' : 'bg-gray-50 border-gray-200'
                                                    }`}
                                                >
                                                    <Text className={`text-xs font-black ${isSelected ? 'text-emerald-900' : 'text-gray-700'}`}>
                                                        {cat.label}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </View>

                                {/* Amount */}
                                <View className="mb-4">
                                    <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Amount (PHP) *</Text>
                                    <TextInput
                                        className="bg-gray-50 px-5 py-4 rounded-2xl border border-gray-200 text-gray-900 font-black text-2xl"
                                        value={otherAmount}
                                        onChangeText={setOtherAmount}
                                        keyboardType="numeric"
                                        placeholder="0.00"
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>

                                {/* Date */}
                                <View className="mb-4">
                                    <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Date *</Text>
                                    <DatePicker value={otherDate} onChange={setOtherDate} />
                                </View>

                                {/* Receipt Number */}
                                <View className="mb-4">
                                    <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Receipt # (OR)</Text>
                                    <TextInput
                                        className="bg-gray-50 px-5 py-4 rounded-2xl border border-gray-200 text-gray-900 font-semibold"
                                        value={otherReceiptNumber}
                                        onChangeText={setOtherReceiptNumber}
                                        placeholder="Optional"
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>

                                {/* Remarks */}
                                <View className="mb-6">
                                    <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Particulars / Remarks</Text>
                                    <TextInput
                                        className="bg-gray-50 px-5 py-4 rounded-2xl border border-gray-200 text-gray-900 h-20"
                                        value={otherNotes}
                                        onChangeText={setOtherNotes}
                                        multiline
                                        textAlignVertical="top"
                                        placeholder="Optional remarks..."
                                        placeholderTextColor="#9CA3AF"
                                    />
                                </View>

                                <Pressable
                                    onPress={handleOtherReceiptSubmit}
                                    disabled={otherSaving}
                                    className={`w-full py-4 rounded-2xl items-center flex-row justify-center ${
                                        otherSaving ? 'bg-emerald-300' : 'bg-emerald-600 active:bg-emerald-700'
                                    }`}
                                >
                                    {otherSaving ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <>
                                            <MaterialIcons name="check-circle" size={20} color="#fff" />
                                            <Text className="text-white font-black text-lg ml-2">Issue Other Receipt</Text>
                                        </>
                                    )}
                                </Pressable>
                            </View>
                        ) : (
                            /* Loan Payment Mode */
                            <View>
                                {/* Borrower Selector */}
                                <Controller
                                    control={control}
                                    name="borrowerId"
                                    render={({ field: { onChange, value } }) => (
                                        <BorrowerSelector
                                            selectedBorrowerId={value}
                                            onSelect={(b) => onChange(b.id)}
                                            role={role}
                                            collectorId={collectorId}
                                        />
                                    )}
                                />
                                {errors.borrowerId ? <Text className="text-red-500 text-xs mt-1 mb-2">{errors.borrowerId.message}</Text> : null}

                        {/* Active Loan Selection */}
                        {borrowerId ? (
                            <View className="mt-6 mb-4">
                                <Text className="text-xs font-black text-gray-700 mb-3 uppercase tracking-wider">Select Active Loan</Text>
                                <Controller
                                    control={control}
                                    name="selectedLoanId"
                                    render={({ field: { onChange, value } }) => (
                                        loans.length === 0 ? (
                                            <StateView
                                                testID="payment-encoder-no-active-loans"
                                                title="No active loans"
                                                message="Select another borrower or create an active loan before recording payment."
                                                icon="account-balance-wallet"
                                            />
                                        ) : (
                                            <View className="flex-row flex-wrap gap-2">
                                                {loans.map(loan => (
                                                    <Pressable
                                                        key={loan.id}
                                                        onPress={() => onChange(loan.id)}
                                                        accessibilityRole="button"
                                                        accessibilityLabel={`Select loan ${loan.loanNumber}`}
                                                        accessibilityState={{ selected: value === loan.id }}
                                                        className={`px-4 py-3 rounded-2xl border ${value === loan.id ? 'bg-amber-50 border-amber-400' : 'bg-gray-50 border-gray-200'}`}
                                                    >
                                                        <Text className={`font-bold text-sm ${value === loan.id ? 'text-amber-800' : 'text-gray-600'}`}>
                                                            {loan.loanNumber}
                                                        </Text>
                                                        <Text className="text-[10px] text-gray-700 font-semibold mt-0.5">
                                                            {formatPHP(loan.installmentAmount)} / {loan.frequency}
                                                        </Text>
                                                    </Pressable>
                                                ))}
                                            </View>
                                        )
                                    )}
                                />
                                {errors.selectedLoanId ? <Text className="text-red-500 text-xs mt-1">{errors.selectedLoanId.message}</Text> : null}
                            </View>
                        ) : null}

                        {/* Loan Preview */}
                        {selectedLoan ? (
                            <View className="bg-amber-50 p-4 rounded-2xl border border-amber-100 mb-4">
                                <View className="flex-row justify-between mb-1">
                                    <Text className="text-amber-900 text-xs font-bold">Principal</Text>
                                    <Text className="text-amber-900 font-black text-sm">{formatPHP(selectedLoan.principalAmount)}</Text>
                                </View>
                                <View className="flex-row justify-between">
                                    <Text className="text-amber-900 text-xs font-bold">Installment</Text>
                                    <Text className="text-amber-900 font-black text-sm">{formatPHP(selectedLoan.installmentAmount)}</Text>
                                </View>
                            </View>
                        ) : null}

                        {/* Payment Date */}
                        <View className="mb-4">
                            <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Date of Payment *</Text>
                            <Controller
                                control={control}
                                name="paymentDate"
                                render={({ field: { onChange, value } }) => (
                                    <DatePicker value={value} onChange={onChange} />
                                )}
                            />
                            {errors.paymentDate && <Text className="text-red-500 text-xs mt-1">{errors.paymentDate.message}</Text>}
                        </View>

                        {/* Amount */}
                        <View className="mb-4">
                            <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Amount (PHP)</Text>
                            <Controller
                                control={control}
                                name="amount"
                                render={({ field: { onChange, value } }) => (
                                    <TextInput
                                        accessibilityLabel="Payment amount"
                                        className={`bg-gray-50 px-5 py-4 rounded-2xl border text-gray-900 font-black text-2xl ${errors.amount ? 'border-red-400' : 'border-gray-200'}`}
                                        value={value} onChangeText={onChange} keyboardType="numeric"
                                        editable={!saving} placeholder="0.00" placeholderTextColor="#D1D5DB"
                                    />
                                )}
                            />
                            {errors.amount ? <Text className="text-red-500 text-xs mt-1">{errors.amount.message}</Text> : null}
                        </View>

                        {/* Current Salary / ATM Withdrawal */}
                        <View className="mb-4">
                            <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Current Salary / ATM Withdrawal</Text>
                            <Controller
                                control={control}
                                name="currentSalary"
                                render={({ field: { onChange, value } }) => (
                                    <TextInput
                                        accessibilityLabel="Current salary or ATM withdrawal amount"
                                        className={`bg-gray-50 px-5 py-4 rounded-2xl border text-gray-900 font-black text-xl ${errors.currentSalary ? 'border-red-400' : 'border-gray-200'}`}
                                        value={value}
                                        onChangeText={onChange}
                                        keyboardType="numeric"
                                        editable={!saving}
                                        placeholder="0.00"
                                        placeholderTextColor="#D1D5DB"
                                    />
                                )}
                            />
                            {errors.currentSalary ? <Text className="text-red-500 text-xs mt-1">{errors.currentSalary.message}</Text> : null}
                            {currentSalaryPreview > 0 ? (
                                <View className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mt-3">
                                    <Text className="text-emerald-800 text-xs font-black uppercase">Excess Cash Preview</Text>
                                    <Text className="text-emerald-900 text-xl font-black mt-1">{formatPHP(excessCashPreview)}</Text>
                                    <Text className="text-emerald-700 text-xs mt-1">
                                        {formatPHP(currentSalaryPreview)} salary less {formatPHP(paymentAmountPreview)} payment.
                                    </Text>
                                </View>
                            ) : (
                                <Text className="text-[11px] text-gray-500 mt-2">Optional, but recommended for automatic Excess Cash Report.</Text>
                            )}
                        </View>

                        {/* Receipt */}
                        <View className="mb-4">
                            <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Receipt Number</Text>
                            <Controller
                                control={control}
                                name="receiptNumber"
                                render={({ field: { onChange, value } }) => (
                                    <TextInput
                                        accessibilityLabel="Receipt number"
                                        className="bg-gray-50 px-5 py-4 rounded-2xl border border-gray-200 text-gray-900 font-semibold"
                                        value={value} onChangeText={onChange}
                                        editable={!saving} placeholder="Optional" placeholderTextColor="#D1D5DB"
                                    />
                                )}
                            />
                        </View>

                        {/* Notes */}
                        <View className="mb-6">
                            <Text className="text-xs font-black text-gray-700 mb-2 uppercase tracking-wider">Notes</Text>
                            <Controller
                                control={control}
                                name="notes"
                                render={({ field: { onChange, value } }) => (
                                    <TextInput
                                        accessibilityLabel="Payment notes"
                                        className="bg-gray-50 px-5 py-4 rounded-2xl border border-gray-200 text-gray-900 h-24"
                                        value={value} onChangeText={onChange}
                                        multiline textAlignVertical="top"
                                        editable={!saving} placeholder="Optional remarks..." placeholderTextColor="#D1D5DB"
                                    />
                                )}
                            />
                        </View>

                        <Pressable
                            testID="confirm-payment-button"
                            accessibilityRole="button"
                            accessibilityLabel={saving ? 'Saving payment' : 'Confirm payment'}
                            accessibilityState={{ disabled: saving, busy: saving }}
                            className={`w-full py-4 rounded-2xl items-center flex-row justify-center ${saving ? 'bg-amber-300' : 'bg-amber-600 active:bg-amber-700'}`}
                            onPress={handleSubmit(onSubmit, (errs) => handleFormValidationError(errs, 'Payment'))}
                            disabled={saving}
                        >
                            {saving ? <ActivityIndicator color="#fff" /> : (
                                <>
                                    <MaterialIcons name="check-circle" size={20} color="#fff" />
                                    <Text className="text-white font-black text-lg ml-2">Confirm Payment</Text>
                                </>
                            )}
                        </Pressable>
                        </View>
                    )}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
