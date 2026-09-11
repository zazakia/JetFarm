import React, { useCallback, useEffect, useState } from 'react';
import {
    View, Text, TextInput, Pressable, ScrollView,
    ActivityIndicator, Alert, SafeAreaView, StatusBar, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { FieldErrors, useForm, Controller } from 'react-hook-form';
import * as z from 'zod';
import { database } from '../../src/database';
import { BorrowerSelector } from '../../src/components/BorrowerSelector';
import { LoanCalculatorService, LoanCalcResult } from '../../src/services/LoanCalculatorService';
import { CalculationBasisCard } from '../../src/components/CalculationBasisCard';
import { formatPHP } from '../../src/utils/currency';
import { MaterialIcons } from '@expo/vector-icons';
import { LoanService } from '../../src/services/LoanService';
import { DatePicker } from '../../src/components/DatePicker';
import uuid from 'react-native-uuid';
import { Q } from '@nozbe/watermelondb';
import Loan from '../../src/database/models/Loan';
import Borrower from '../../src/database/models/Borrower';
import Payment from '../../src/database/models/Payment';
import LoanPenalty from '../../src/database/models/LoanPenalty';
import PaymentSchedule from '../../src/database/models/PaymentSchedule';
import { LinearGradient } from 'expo-linear-gradient';
import { SyncStatusIndicator } from '../../src/components/SyncStatusIndicator';
import { AuthService } from '../../src/services/AuthService';
import { useAuth } from '../../src/store/AuthContext';
import { format } from 'date-fns';
import { AuditService, AuditIssue } from '../../src/services/AuditService';
import { AuditReportDialog } from '../../src/components/AuditReportDialog';
import ConfirmDialog from '../../src/components/ConfirmDialog';
import {
    isInstitutionalLoanType,
    LOAN_PRODUCT_PRESETS,
    LoanProductType,
    loanProductLabel,
    loanProductTermRuleText,
    notarialFeeFromPrincipal,
    processingFeeFromPrincipal,
    validateLoanProductPrincipal,
    validateLoanProductTerm,
} from '../../src/utils/loanProducts';
import { lookupApr2026Insurance } from '../../src/utils/insuranceTable';
import { createSafeZodResolver } from '../../src/utils/zodFormResolver';
import { findActiveLoanForType } from '../../src/utils/activeLoanPolicy';
import { useLoanProductPresets } from '../../src/hooks/useSettingsConfig';

const schema = z.object({
    borrowerId: z.string().min(1, 'Borrower is required'),
    loanType: z.enum(['standard', 'pension', 'salary_regular', 'salary_contractual', 'motor_vehicle', 'cash_advance', 'salary_cash_advance', 'top_up']),
    principal: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'Principal must be positive'),
    targetPayment: z.string().optional().refine(v => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0), 'Invalid target payment'),
    ratePercent: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Rate cannot be negative'),
    term: z.string().refine(v => !isNaN(parseInt(v)) && parseInt(v) > 0, 'Term must be at least 1'),
    termUnit: z.enum(['months', 'days', 'weeks']),
    interestType: z.enum(['flat', 'diminishing']),
    frequency: z.enum(['daily', 'weekly', 'bi_monthly', 'monthly']),
    deposit: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Deposit cannot be negative'),
    insurance: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Insurance cannot be negative'),
    savingsPerPayment: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Invalid savings amount'),
    processingFee: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Invalid processing fee'),
    collectionFee: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Invalid collection fee'),
    notarialFee: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Invalid notarial fee'),
    rodFee: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Invalid ROD fee'),
    ltoFee: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Invalid LTO fee'),
    udiRebatableFee: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Invalid UDI fee'),
    rebateAmount: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Invalid rebate'),
    isReloan: z.boolean(),
    previousLoanId: z.string().optional(),
    releaseDate: z.string().min(1, 'Release date is required'),
}).superRefine((data, ctx) => {
    const termError = validateLoanProductTerm(data.loanType, data.term, data.termUnit);
    if (termError) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['term'],
            message: termError,
        });
    }
});

type FormData = z.infer<typeof schema>;
type LoanFormNotification = {
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
};

const firstErrorMessage = (formErrors: FieldErrors<FormData>): string => {
    const first = Object.values(formErrors)[0];
    if (first && typeof first === 'object' && 'message' in first && typeof first.message === 'string') {
        return first.message;
    }
    return 'Please review the highlighted fields and try again.';
};

const auditIssueMessage = (issues: AuditIssue[]): string => {
    const critical = issues.find(issue => issue.category === 'Critical');
    const issue = critical ?? issues[0];
    if (!issue) {
        return 'Please review the audit report before saving.';
    }
    return issue.suggestedFix
        ? `${issue.message} Suggested fix: ${issue.suggestedFix}`
        : issue.message;
};

function FormLabel({ children }: { children: React.ReactNode }) {
    return <Text className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">{children}</Text>;
}

function FormInput({ value, onChange, error, disabled, keyboardType = 'default', placeholder = '' }: any) {
    return (
        <>
            <TextInput
                className={`bg-gray-50 px-4 py-3.5 rounded-2xl border font-bold text-gray-900 ${error ? 'border-red-400' : 'border-gray-200'}`}
                value={value} onChangeText={onChange} keyboardType={keyboardType}
                editable={!disabled} placeholder={placeholder} placeholderTextColor="#D1D5DB"
            />
            {!!error && <Text className="text-red-500 text-xs mt-1 mb-1">{error}</Text>}
        </>
    );
}

function SegmentControl({ options, value, onChange, labels }: { options: string[]; value: string; onChange: (v: string) => void; labels?: string[] }) {
    return (
        <View className="flex-row bg-gray-100 p-1 rounded-2xl">
            {options.map((opt, i) => (
                <Pressable
                    key={opt}
                    onPress={() => onChange(opt)}
                    className={`flex-1 py-2.5 items-center rounded-xl ${value === opt ? 'bg-white shadow-sm' : ''}`}
                >
                    <Text className={`text-[11px] font-black capitalize ${value === opt ? 'text-blue-600' : 'text-gray-700'}`}>
                        {labels?.[i] ?? opt}
                    </Text>
                </Pressable>
            ))}
        </View>
    );
}

export default function LoanEncoderScreen() {
    const router = useRouter();
    const { user, signOut } = useAuth();
    const { presets: loanProductPresets } = useLoanProductPresets();
    const [saving, setSaving] = useState(false);
    const [calcResult, setCalcResult] = useState<LoanCalcResult | null>(null);

    const { control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
        resolver: createSafeZodResolver(schema),
        defaultValues: {
            borrowerId: '', loanType: 'standard', releaseDate: format(new Date(), 'yyyy-MM-dd'), principal: '10000', targetPayment: '', ratePercent: '20',
            term: '20', termUnit: 'weeks', interestType: 'flat',
            frequency: 'weekly', deposit: '50', insurance: '17',
            savingsPerPayment: '0', processingFee: '0', collectionFee: '0', notarialFee: '0',
            rodFee: '0', ltoFee: '0', udiRebatableFee: '0', rebateAmount: '0',
            isReloan: false, previousLoanId: '',
        },
    });

    const [previousLoans, setPreviousLoans] = useState<Loan[]>([]);
    const [activeLoan, setActiveLoan] = useState<Loan | null>(null);
    const [activeLoanBalance, setActiveLoanBalance] = useState(0);
    const [previousLoanBalances, setPreviousLoanBalances] = useState<Record<string, number>>({});
    const [loadingPreviousLoans, setLoadingPreviousLoans] = useState(false);
    const [auditIssues, setAuditIssues] = useState<AuditIssue[]>([]);
    const [showAudit, setShowAudit] = useState(false);
    const [pendingData, setPendingData] = useState<FormData | null>(null);
    const [showConfirmReloan, setShowConfirmReloan] = useState(false);
    const [reloanConfirmInfo, setReloanConfirmInfo] = useState<{ balance: number; net: number } | null>(null);
    const [notification, setNotification] = useState<LoanFormNotification | null>(null);
    const notify = useCallback((type: LoanFormNotification['type'], title: string, message: string) => {
        setNotification({ type, title, message });
    }, []);
    const applyFieldChange = useCallback((onChange: (value: any) => unknown, value: any) => {
        try {
            const result = onChange(value);
            if (result && typeof (result as any).catch === 'function') {
                void (result as Promise<unknown>).catch(() => undefined);
            }
        } catch {
            // React Hook Form validation errors are displayed through formState.
        }
    }, []);

    const watchedValues = watch();
    const watchedLoanType = watchedValues.loanType || 'standard';
    const watchedIsInstitutional = isInstitutionalLoanType(watchedLoanType);
    const watchedTermRuleText = loanProductTermRuleText(watchedLoanType);
    const watchedSavingsPerPayment = parseFloat(watchedValues.savingsPerPayment || '0') || 0;
    const watchedRebateAmount = parseFloat(watchedValues.rebateAmount || '0') || 0;
    const watchedTargetPayment = parseFloat(watchedValues.targetPayment || '');
    const computedPrincipalFromTarget = watchedIsInstitutional && !isNaN(watchedTargetPayment) && watchedTargetPayment > 0
        ? LoanCalculatorService.principalFromTargetInstitutionalPayment({
            targetPayment: watchedTargetPayment,
            monthlyRatePercent: parseFloat(watchedValues.ratePercent || '0') || 0,
            term: parseInt(watchedValues.term || '0', 10) || 0,
            termUnit: watchedValues.termUnit,
            frequency: watchedValues.frequency,
            savingsPerPayment: watchedSavingsPerPayment,
            rebatePerPayment: watchedRebateAmount,
        })
        : null;
    const effectivePrincipal = computedPrincipalFromTarget ?? (parseFloat(watchedValues.principal || '0') || 0);
    const tableInsurance = lookupApr2026Insurance({
        principal: effectivePrincipal,
        term: parseInt(watchedValues.term || '0', 10) || 0,
        termUnit: watchedValues.termUnit,
    });

    useEffect(() => {
        const fetchPreviousLoans = async () => {
            if (watchedValues.borrowerId) {
                setLoadingPreviousLoans(true);
                try {
                    const loans = await database.collections.get<Loan>('loans').query(
                        Q.where('borrower_id', watchedValues.borrowerId),
                        Q.where('status', Q.oneOf(['active', 'closed', 'paid', 'defaulted']))
                    ).fetch();

                    // Issue #10: Auto-populate principal from borrower's loanCode
                    try {
                        const borrowerProfile = await database.collections.get<Borrower>('borrowers').find(watchedValues.borrowerId);
                        if (borrowerProfile.loanCode) {
                            const mappedPrincipal = LoanCalculatorService.principalFromLoanCode(borrowerProfile.loanCode);
                            if (mappedPrincipal > 0) {
                                setValue('principal', mappedPrincipal.toString());
                            }
                        }
                    } catch (borrowerErr) {
                        console.error('Failed to load borrower profile for loan code mapping:', borrowerErr);
                    }
                    
                    const active = findActiveLoanForType(loans, watchedLoanType);
                    setActiveLoan(active || null);
                    setPreviousLoans(loans);

                    if (loans.length > 0) {
                        const loanIds = loans.map(l => l.id);
                        const [payments, penalties] = await Promise.all([
                            database.collections.get<Payment>('payments').query(Q.where('loan_id', Q.oneOf(loanIds))).fetch(),
                            database.collections.get<LoanPenalty>('loan_penalties').query(Q.where('loan_id', Q.oneOf(loanIds))).fetch()
                        ]);

                        const balances: Record<string, number> = {};
                        loans.forEach(loan => {
                            const loanPayments = payments.filter(p => p.loanId === loan.id);
                            const loanPenalties = penalties.filter(p => p.loanId === loan.id);
                            const totalPaid = loanPayments.reduce((sum, p) => sum + p.amount, 0);
                            const totalPenalties = loanPenalties.reduce((sum, p) => sum + p.amount, 0);
                            balances[loan.id] = Math.max(0, loan.totalAmount + totalPenalties - totalPaid);
                        });
                        setPreviousLoanBalances(balances);

                        if (active) {
                            setActiveLoanBalance(balances[active.id] || 0);
                        } else {
                            setActiveLoanBalance(0);
                        }
                    } else {
                        setPreviousLoanBalances({});
                        setActiveLoanBalance(0);
                    }

                    if (active) {
                        reset({
                            ...watchedValues,
                            isReloan: true,
                            previousLoanId: active.id,
                        });
                    } else {
                        reset({
                            ...watchedValues,
                            isReloan: false,
                            previousLoanId: '',
                        });
                    }
                } catch (error) {
                    console.error('Failed to fetch previous loans:', error);
                } finally {
                    setLoadingPreviousLoans(false);
                }
            } else {
                setPreviousLoans([]);
                setPreviousLoanBalances({});
                setActiveLoan(null);
                setActiveLoanBalance(0);
            }
        };
        fetchPreviousLoans();
    }, [watchedValues.borrowerId, watchedLoanType]);

    useEffect(() => {
        const preset = loanProductPresets[watchedLoanType as LoanProductType] || loanProductPresets.standard || LOAN_PRODUCT_PRESETS.standard;
        setValue('ratePercent', preset.defaultRatePercent);
        setValue('term', preset.defaultTerm);
        setValue('termUnit', preset.defaultTermUnit);
        setValue('frequency', preset.defaultFrequency);
        setValue('savingsPerPayment', preset.defaultSavingsPerPayment);
        const principal = parseFloat(preset.defaultPrincipal || watchedValues.principal || '0') || 0;
        setValue('notarialFee', notarialFeeFromPrincipal(watchedLoanType as LoanProductType, principal).toString());
        if (preset.defaultPrincipal) {
            setValue('principal', preset.defaultPrincipal);
        }

        setValue('processingFee', processingFeeFromPrincipal(watchedLoanType as LoanProductType, principal).toString());
    }, [watchedLoanType, setValue, loanProductPresets]);

    useEffect(() => {
        if (watchedLoanType === 'standard') return;
        setValue('processingFee', processingFeeFromPrincipal(watchedLoanType as LoanProductType, effectivePrincipal).toString());
        setValue('notarialFee', notarialFeeFromPrincipal(watchedLoanType as LoanProductType, effectivePrincipal).toString());
    }, [effectivePrincipal, watchedLoanType, setValue]);

    useEffect(() => {
        const t = parseInt(watchedValues.term, 10);
        const numPayments = (!isNaN(t) && t > 0) ? LoanCalculatorService.paymentsForFrequency(t, watchedValues.termUnit, watchedValues.frequency) : 1;
        
        if (watchedValues.termUnit === 'weeks') {
            setValue('insurance', (10 * numPayments).toString());
            setValue('deposit', (effectivePrincipal * 0.01 * numPayments).toString());
        } else {
            setValue('insurance', '0'); // Issue #18
            setValue('deposit', (effectivePrincipal * 0.01).toString()); // Issue #15
        }
    }, [effectivePrincipal, watchedValues.term, watchedValues.termUnit, watchedValues.frequency, setValue]);

    useEffect(() => {
        const p = effectivePrincipal;
        const r = parseFloat(watchedValues.ratePercent);
        const t = parseInt(watchedValues.term, 10);
        const d = parseFloat(watchedValues.deposit);
        const i = parseFloat(watchedValues.insurance);

        if (!isNaN(p) && p > 0 && !isNaN(r) && !isNaN(t) && t > 0) {
            const parsedDate = new Date(watchedValues.releaseDate || new Date());
            const res = watchedIsInstitutional
                ? LoanCalculatorService.calculateInstitutionalLoan({
                    loanType: watchedLoanType,
                    principal: p,
                    monthlyRatePercent: r,
                    term: t,
                    termUnit: watchedValues.termUnit,
                    frequency: watchedValues.frequency,
                    releaseDate: parsedDate,
                    processingFee: parseFloat(watchedValues.processingFee) || 0,
                    collectionFee: parseFloat(watchedValues.collectionFee) || 0,
                    notarialFee: parseFloat(watchedValues.notarialFee) || 0,
                    insuranceFee: !isNaN(i) ? i : 0,
                    rodFee: parseFloat(watchedValues.rodFee) || 0,
                    ltoFee: parseFloat(watchedValues.ltoFee) || 0,
                    udiRebatableFee: parseFloat(watchedValues.udiRebatableFee) || 0,
                    outstandingBalance: activeLoanBalance,
                    savingsPerPayment: parseFloat(watchedValues.savingsPerPayment) || 0,
                    rebatePerPayment: parseFloat(watchedValues.rebateAmount) || 0,
                })
                : LoanCalculatorService.calculate(
                    p, r, t, watchedValues.termUnit,
                    watchedValues.interestType, watchedValues.frequency, parsedDate,
                    !isNaN(d) ? d : 0, !isNaN(i) ? i : 0
                );
            setCalcResult(res);
        } else {
            setCalcResult(null);
        }
    }, [effectivePrincipal, watchedValues.ratePercent, watchedValues.term, watchedValues.termUnit, watchedValues.interestType, watchedValues.frequency, watchedValues.deposit, watchedValues.insurance, watchedValues.releaseDate, watchedValues.loanType, watchedValues.processingFee, watchedValues.collectionFee, watchedValues.notarialFee, watchedValues.rodFee, watchedValues.ltoFee, watchedValues.udiRebatableFee, watchedValues.savingsPerPayment, watchedValues.rebateAmount, activeLoanBalance]);

    // Auto-set term to 40 when unit is 'days'
    useEffect(() => {
        if (watchedValues.termUnit === 'days') {
            setValue('term', '40');
        }
    }, [watchedValues.termUnit, setValue]);

    const performSave = async (data: FormData, statusOverride?: 'pending' | 'active') => {
        if (!calcResult) return;
        setSaving(true);
        const balanceToDeduct = (data.isReloan && data.previousLoanId === activeLoan?.id) ? activeLoanBalance : 0;
        const status = statusOverride || 'active';
        
        try {
            const borrower = await database.collections.get<Borrower>('borrowers').find(data.borrowerId);
            const loanId = uuid.v4().toString();
            const ln = LoanCalculatorService.generateLoanNumber();

            await LoanService.saveLoan({
                loanId,
                loanNumber: ln,
                loanType: data.loanType,
                borrowerId: data.borrowerId,
                principalAmount: effectivePrincipal,
                interestRate: parseFloat(data.ratePercent),
                interestType: data.interestType as any,
                term: parseInt(data.term, 10),
                termUnit: data.termUnit as any,
                frequency: data.frequency as any,
                calcResult,
                depositAmount: calcResult.institutionalBreakdown
                    ? calcResult.institutionalBreakdown.savingsPerPayment * calcResult.numPayments
                    : parseFloat(data.deposit),
                insuranceAmount: parseFloat(data.insurance),
                processingFee: parseFloat(data.processingFee),
                collectionFee: parseFloat(data.collectionFee),
                notarialFee: parseFloat(data.notarialFee),
                rodFee: parseFloat(data.rodFee),
                ltoFee: parseFloat(data.ltoFee),
                udiRebatableFee: parseFloat(data.udiRebatableFee),
                vatOnInterest: calcResult.institutionalBreakdown?.vatOnInterest || 0,
                vatOnCharges: calcResult.institutionalBreakdown?.vatOnOtherCharges || 0,
                dstFee: calcResult.institutionalBreakdown?.dstFee || 0,
                rebateAmount: parseFloat(data.rebateAmount),
                savingsPerPayment: parseFloat(data.savingsPerPayment),
                collectorId: borrower.collectorId || '',
                encodedBy: user?.id || '',
                releaseDate: new Date(data.releaseDate || new Date()),
                status,
                isReloan: data.isReloan,
                previousLoanId: data.previousLoanId,
                deductedAmount: balanceToDeduct,
                interestAmount: calcResult.totalInterest,
                isEditing: false
            });

            if (status === 'active') {
                notify('success', 'Loan disbursed', 'Loan created and schedules generated.');
                if (Platform.OS === 'web') {
                    window.alert('Loan created and schedules generated.');
                } else {
                    Alert.alert('✓ Disbursed', 'Loan created and schedules generated.');
                }
            } else {
                notify('success', 'Saved for approval', 'Loan saved as pending approval.');
                if (Platform.OS === 'web') {
                    window.alert('Loan saved as pending approval.');
                } else {
                    Alert.alert('Saved', 'Loan saved as pending approval.');
                }
            }
            reset();
            router.replace(`/(loan-encoder)/loans/${loanId}` as any);
        } catch (error) {
            console.error('Save loan failed:', error);
            const message = error instanceof Error ? error.message : 'Failed to save loan. Please check your data or connection.';
            notify('error', 'Save failed', message);
            if (Platform.OS === 'web') {
                window.alert(message);
            } else {
                Alert.alert('Error', message);
            }
        } finally {
            setSaving(false);
            setShowAudit(false);
            setPendingData(null);
        }
    };

    const onSubmit = async (data: FormData) => {
        setNotification(null);
        if (!calcResult) {
            notify('error', 'Calculation unavailable', 'Please check the loan inputs until the computation summary appears.');
            if (Platform.OS === 'web') {
                window.alert('Invalid loan parameters.');
            } else {
                Alert.alert('Error', 'Invalid loan parameters.');
            }
            return;
        }

        // Final safety check: one active loan per borrower per loan type.
        if (activeLoan && !data.isReloan) {
            const message = `Borrower already has an active ${loanProductLabel(data.loanType as LoanProductType)}. Use Renewal for this loan type or choose another loan type.`;
            if (Platform.OS === 'web') {
                window.alert(message);
            } else {
                Alert.alert('Error', message);
            }
            notify('error', 'Cannot disburse loan', message);
            return;
        }
        
        const balanceToDeduct = (data.isReloan && data.previousLoanId === activeLoan?.id) ? activeLoanBalance : 0;
        const netProceeds = LoanCalculatorService.calculateNetProceeds(
            effectivePrincipal,
            parseFloat(data.deposit), 
            parseFloat(data.insurance), 
            balanceToDeduct
        );

        // Deviation check
        const preset = loanProductPresets[data.loanType as LoanProductType] || loanProductPresets.standard;
        const maxAllowed = preset?.maxPrincipal;
        const isDeviated = maxAllowed && effectivePrincipal > maxAllowed;

        if (isDeviated) {
            const warningMsg = `This loan principal exceeds the allowed limit of ${formatPHP(maxAllowed)} and is subject to approval. It will be saved as pending approval instead of disbursed directly. Proceed?`;
            
            if (Platform.OS === 'web') {
                if (!window.confirm(warningMsg)) {
                    return;
                }
            } else {
                const proceed = await new Promise((resolve) => {
                    Alert.alert(
                        'Subject to Approval',
                        warningMsg,
                        [
                            { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                            { text: 'Proceed', onPress: () => resolve(true) }
                        ]
                    );
                });
                if (!proceed) return;
            }
        }

        setSaving(true);
        try {
            // 1. Run Auto-Audit
            const audit = new AuditService(database);
            const issues = await audit.validateLoanPreSave(
                { ...data, principal: effectivePrincipal.toString(), deductedAmount: balanceToDeduct },
                calcResult, 
                false
            );

            if (issues.length > 0) {
                setAuditIssues(issues);
                setPendingData(data);
                const hasCritical = issues.some(issue => issue.category === 'Critical');
                notify(
                    hasCritical ? 'error' : 'info',
                    hasCritical ? 'Cannot save loan' : 'Review needed before saving',
                    auditIssueMessage(issues)
                );
                setShowAudit(true);
                setSaving(false);
                return;
            }

            // 2. Extra confirmation for high balance reloans
            if (balanceToDeduct > 0) {
                if (Platform.OS === 'web') {
                    setReloanConfirmInfo({ balance: balanceToDeduct, net: netProceeds });
                    setPendingData(data);
                    setShowConfirmReloan(true);
                    setSaving(false);
                    return;
                }

                const confirm = await new Promise((resolve) => {
                    Alert.alert(
                        'Confirm Renewal',
                        `This will close the active loan (Balance: ${formatPHP(balanceToDeduct)}) and deduct it from the new loan.\n\nNet Cash Released: ${formatPHP(netProceeds)}`,
                        [
                            { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                            { text: 'Proceed', onPress: () => resolve(true) }
                        ]
                    );
                });
                if (!confirm) {
                    setSaving(false);
                    return;
                }
            }

            // 3. Proceed to save
            await performSave(data);
        } catch (error) {
            console.error('Audit/Save failed:', error);
            const message = error instanceof Error ? error.message : 'Operation failed. Please try again.';
            notify('error', 'Operation failed', message);
            if (Platform.OS === 'web') {
                window.alert(message);
            } else {
                Alert.alert('Error', message);
            }
        } finally {
            setSaving(false);
        }
    };

    const onInvalidSubmit = useCallback((formErrors: FieldErrors<FormData>) => {
        notify('error', 'Cannot save loan', firstErrorMessage(formErrors));
    }, [notify]);

    const submitLoan = useCallback(() => {
        void handleSubmit(
            data => onSubmit(data),
            onInvalidSubmit
        )().catch(error => {
            console.error('Loan submit failed:', error);
            const message = error instanceof Error ? error.message : 'Unexpected form error. Please try again.';
            notify('error', 'Submit failed', message);
        });
    }, [handleSubmit, notify, onInvalidSubmit, onSubmit]);

    return (
        <SafeAreaView className="flex-1 bg-slate-50">
            <StatusBar barStyle="light-content" />
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {notification && (
                    <View
                        testID="loan-form-notification"
                        className={`mx-4 mt-4 p-4 rounded-2xl border ${
                            notification.type === 'error'
                                ? 'bg-red-50 border-red-200'
                                : notification.type === 'success'
                                    ? 'bg-green-50 border-green-200'
                                    : 'bg-blue-50 border-blue-200'
                        }`}
                    >
                        <Text className={`font-black ${
                            notification.type === 'error'
                                ? 'text-red-800'
                                : notification.type === 'success'
                                    ? 'text-green-800'
                                    : 'text-blue-800'
                        }`}>
                            {notification.title}
                        </Text>
                        <Text className="text-gray-700 text-sm mt-1">{notification.message}</Text>
                    </View>
                )}
                {/* Gradient Header */}
                <LinearGradient
                    colors={['#1E40AF', '#1E3A5F']}
                    className="pt-10 pb-20 px-6 rounded-b-[40px]"
                >
                    <View className="flex-row items-center justify-between">
                        <View>
                            <Text className="text-blue-200/70 text-xs font-bold uppercase tracking-[3px]">Loan Encoder</Text>
                            <Text className="text-white text-3xl font-black mt-1">{user?.email?.split('@')[0]}</Text>
                        </View>
                        <View className="items-end gap-2">
                            <SyncStatusIndicator />
                            <Pressable
                                onPress={signOut}
                                className="p-2.5 bg-white/10 rounded-2xl active:bg-white/20 border border-white/10"
                            >
                                <MaterialIcons name="logout" size={18} color="#FFF" />
                            </Pressable>
                        </View>
                    </View>
                </LinearGradient>

                {/* Form Card */}
                <View className="px-6 -mt-12 mb-10">
                    <View className="bg-white rounded-[32px] p-6 shadow-xl shadow-blue-900/10 border border-gray-50">
                        <Text testID="page-title" className="text-gray-900 text-xl font-black mb-6">New Loan Entry</Text>

                        {/* Borrower */}
                        <View className="mb-4">
                            <FormLabel>Borrower</FormLabel>
                            <Controller
                                control={control}
                                name="borrowerId"
                                render={({ field: { onChange, value } }) => (
                                    <BorrowerSelector selectedBorrowerId={value} onSelect={(b) => onChange(b.id)} />
                                )}
                            />
                            {errors.borrowerId && <Text className="text-red-500 text-xs mt-1 mb-2">{errors.borrowerId.message}</Text>}
                        </View>

                        {/* Release Date */}
                        <View className="mb-4">
                            <FormLabel>Release Date</FormLabel>
                            <Controller
                                control={control}
                                name="releaseDate"
                                render={({ field: { onChange, value } }) => (
                                    <DatePicker value={value} onChange={onChange} />
                                )}
                            />
                            {errors.releaseDate && <Text className="text-red-500 text-xs mt-1 mb-2">{errors.releaseDate.message}</Text>}
                        </View>

                        <View className="mb-4">
                            <FormLabel>Loan Type / Computation</FormLabel>
                            <Controller control={control} name="loanType" render={({ field: { onChange, value } }) =>
                                <View className="flex-row flex-wrap bg-gray-100 p-1 rounded-2xl">
                                    {(Object.keys(loanProductPresets) as LoanProductType[])
                                        .filter(type => type === value || loanProductPresets[type]?.isActive !== false)
                                        .map(type => (
                                            <Pressable
                                                key={type}
                                                onPress={() => applyFieldChange(onChange, type)}
                                                className={`w-1/2 py-2.5 px-2 rounded-xl ${value === type ? 'bg-white shadow-sm' : ''}`}
                                            >
                                                <Text className={`text-[10px] font-black ${value === type ? 'text-blue-600' : 'text-gray-700'}`}>
                                                    {loanProductPresets[type].label}
                                                </Text>
                                            </Pressable>
                                        ))}
                                </View>
                            } />
                        </View>

                        {/* Renewal Toggle */}
                        {watchedValues.borrowerId !== '' && (
                            <View className={`mt-4 flex-row items-center justify-between p-4 rounded-2xl border ${activeLoan ? 'bg-amber-50 border-amber-100' : 'bg-blue-50/50 border-blue-100'}`}>
                                <View className="flex-1 mr-4">
                                    <Text className={`${activeLoan ? 'text-amber-900' : 'text-blue-900'} font-bold text-sm`}>
                                        {activeLoan ? 'Loan Renewal Required' : 'Is this a Renewal?'}
                                    </Text>
                                    <Text className={`${activeLoan ? 'text-amber-500' : 'text-blue-400'} text-xs mt-0.5`}>
                                        {activeLoan ? `Borrower has an active ${loanProductLabel(watchedLoanType)} (${activeLoan.loanNumber})` : 'Link this to a previous loan'}
                                    </Text>
                                </View>
                                <Controller
                                    control={control}
                                    name="isReloan"
                                    render={({ field: { onChange, value } }) => (
                                        <View className="flex-row items-center">
                                            {previousLoans.length === 0 && !loadingPreviousLoans && (
                                                <Text className="text-[10px] text-gray-700 italic mr-3">(No history)</Text>
                                            )}
                                            <Pressable
                                                onPress={() => !activeLoan && onChange(!value)}
                                                disabled={previousLoans.length === 0 || !!activeLoan}
                                                className={`w-12 h-6 rounded-full p-1 ${value ? 'bg-blue-600' : 'bg-gray-200'} ${(previousLoans.length === 0 || !!activeLoan) ? 'opacity-50' : ''}`}
                                            >
                                                <View className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all ${value ? 'ml-6' : 'ml-0'}`} />
                                            </Pressable>
                                        </View>
                                    )}
                                />
                            </View>
                        )}

                        {/* Previous Loan Selector */}
                        {watchedValues.isReloan && previousLoans.length > 0 && (
                            <View className="mt-4">
                                <FormLabel>Previous Loan to Renew</FormLabel>
                                <Controller
                                    control={control}
                                    name="previousLoanId"
                                    render={({ field: { onChange, value } }) => (
                                        <View className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
                                            {previousLoans.map((loan, idx) => (
                                                <Pressable
                                                    key={loan.id}
                                                    onPress={() => !activeLoan && onChange(loan.id)}
                                                    className={`p-4 flex-row justify-between items-center ${idx < previousLoans.length - 1 ? 'border-b border-gray-100' : ''} ${value === loan.id ? 'bg-blue-50' : ''} ${activeLoan ? 'opacity-70' : ''}`}
                                                >
                                                    <View>
                                                        <Text className={`font-bold ${value === loan.id ? 'text-blue-700' : 'text-gray-900'}`}>{loan.loanNumber}</Text>
                                                        <View className="flex-row items-center">
                                                            <Text className="text-[10px] text-gray-700 font-bold uppercase">{new Date(loan.releaseDate as any).toLocaleDateString()} • {formatPHP(loan.principalAmount)}</Text>
                                                            {previousLoanBalances[loan.id] > 0 && (
                                                                <Text className="text-[10px] text-amber-600 font-bold uppercase"> • Balance: {formatPHP(previousLoanBalances[loan.id])}</Text>
                                                            )}
                                                        </View>
                                                    </View>
                                                    <View className="flex-row items-center">
                                                        <View className={`px-2 py-0.5 rounded-full mr-2 ${loan.status === 'active' ? 'bg-green-100' : 'bg-gray-200'}`}>
                                                            <Text className={`text-[8px] font-black uppercase ${loan.status === 'active' ? 'text-green-700' : 'text-gray-600'}`}>{loan.status}</Text>
                                                        </View>
                                                        {value === loan.id && <MaterialIcons name="check-circle" size={18} color="#1D4ED8" />}
                                                    </View>
                                                </Pressable>
                                            ))}
                                        </View>
                                    )}
                                />
                                {errors.previousLoanId && <Text className="text-red-500 text-xs mt-1">{errors.previousLoanId.message}</Text>}
                            </View>
                        )}

                        {/* Principal + Rate */}
                        <View className="flex-row mt-5 mb-4 gap-3">
                            <View className="flex-1">
                                <FormLabel>Principal (₱)</FormLabel>
                                <Controller control={control} name="principal" render={({ field: { onChange, value } }) =>
                                    <FormInput value={value} onChange={onChange} error={errors.principal?.message} disabled={saving} keyboardType="numeric" />
                                } />
                                {(() => {
                                    const preset = loanProductPresets[watchedLoanType as LoanProductType] || loanProductPresets.standard;
                                    const maxAllowed = preset?.maxPrincipal;
                                    if (!maxAllowed) return null;
                                    const isExceeded = effectivePrincipal > maxAllowed;
                                    return (
                                        <Text className={`text-[11px] font-bold mt-1 ${isExceeded ? 'text-amber-700 font-black' : 'text-gray-500'}`}>
                                            {isExceeded 
                                                ? `⚠️ Exceeds limit: Max is ${formatPHP(maxAllowed)}` 
                                                : `Max principal: ${formatPHP(maxAllowed)}`}
                                        </Text>
                                    );
                                })()}
                            </View>
                            <View className="flex-1">
                                <FormLabel>Rate (%)</FormLabel>
                                <Controller control={control} name="ratePercent" render={({ field: { onChange, value } }) =>
                                    <FormInput value={value} onChange={onChange} error={errors.ratePercent?.message} disabled={saving} keyboardType="numeric" />
                                } />
                            </View>
                        </View>

                        {watchedIsInstitutional && (
                            <View className="mb-4 bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                                <FormLabel>Optional Target Payment</FormLabel>
                                <Controller control={control} name="targetPayment" render={({ field: { onChange, value } }) =>
                                    <FormInput value={value} onChange={onChange} error={errors.targetPayment?.message} disabled={saving} keyboardType="numeric" placeholder={watchedValues.frequency === 'bi_monthly' ? 'e.g. 3500 per payday' : 'e.g. 2000 monthly'} />
                                } />
                                {computedPrincipalFromTarget !== null && (
                                    <Text className="text-[11px] text-amber-900 font-black mt-1">
                                        Computed loan amount: {formatPHP(computedPrincipalFromTarget)}
                                    </Text>
                                )}
                            </View>
                        )}

                        {/* Term + Unit */}
                        <View className="flex-row mb-4 gap-3">
                            <View className="w-20">
                                <FormLabel>Term</FormLabel>
                                <Controller control={control} name="term" render={({ field: { onChange, value } }) =>
                                    <FormInput value={value} onChange={onChange} error={errors.term?.message} disabled={saving} keyboardType="numeric" />
                                } />
                            </View>
                            <View className="flex-1">
                                <FormLabel>Unit</FormLabel>
                                <Controller control={control} name="termUnit" render={({ field: { onChange, value } }) =>
                                    <SegmentControl options={['months', 'days', 'weeks']} value={value} onChange={onChange} />
                                } />
                            </View>
                        </View>

                        {/* Interest Type */}
                        <View className="mb-4">
                            <FormLabel>Interest Type</FormLabel>
                            <Controller control={control} name="interestType" render={({ field: { onChange, value } }) =>
                                <SegmentControl options={['flat', 'diminishing']} value={value} onChange={onChange} />
                            } />
                        </View>

                        {/* Frequency */}
                        <View className="mb-4">
                            <FormLabel>Payment Frequency</FormLabel>
                            <Controller control={control} name="frequency" render={({ field: { onChange, value } }) =>
                                <SegmentControl
                                    options={['daily', 'weekly', 'bi_monthly', 'monthly']}
                                    value={value} onChange={onChange}
                                    labels={['Daily', 'Weekly', 'Bi-Mo', 'Monthly']}
                                />
                            } />
                        </View>

                        {/* Deposit + Insurance */}
                        <View className="flex-row mb-4 gap-3">
                            <View className="flex-1">
                                <FormLabel>Deposit (₱)</FormLabel>
                                <Controller control={control} name="deposit" render={({ field: { onChange, value } }) =>
                                    <FormInput value={value} onChange={onChange} error={errors.deposit?.message} disabled={saving} keyboardType="numeric" placeholder="0" />
                                } />
                            </View>
                        </View>
                        {watchedTermRuleText && (
                            <Text className="text-[11px] text-amber-700 font-bold -mt-2 mb-4">
                                {watchedTermRuleText}
                            </Text>
                        )}

                        {watchedIsInstitutional && (
                            <View className="mb-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <FormLabel>Computation Slip Charges</FormLabel>
                                <View className="flex-row mb-3 gap-3">
                                    <View className="flex-1">
                                        <FormLabel>Savings/Payday</FormLabel>
                                        <Controller control={control} name="savingsPerPayment" render={({ field: { onChange, value } }) =>
                                            <FormInput value={value} onChange={onChange} disabled={saving} keyboardType="numeric" />
                                        } />
                                    </View>
                                    <View className="flex-1">
                                        <FormLabel>Rebate/Payment</FormLabel>
                                        <Controller control={control} name="rebateAmount" render={({ field: { onChange, value } }) =>
                                            <FormInput value={value} onChange={onChange} disabled={saving} keyboardType="numeric" />
                                        } />
                                    </View>
                                </View>
                                <View className="flex-row mb-3 gap-3">
                                    <View className="flex-1">
                                        <FormLabel>Processing</FormLabel>
                                        <Controller control={control} name="processingFee" render={({ field: { onChange, value } }) =>
                                            <FormInput value={value} onChange={onChange} disabled={saving} keyboardType="numeric" />
                                        } />
                                    </View>
                                    <View className="flex-1">
                                        <FormLabel>Notarial</FormLabel>
                                        <Controller control={control} name="notarialFee" render={({ field: { onChange, value } }) =>
                                            <FormInput value={value} onChange={onChange} disabled={saving} keyboardType="numeric" />
                                        } />
                                    </View>
                                </View>
                                <View className="mb-3">
                                    <FormLabel>Collection</FormLabel>
                                    <Controller control={control} name="collectionFee" render={({ field: { onChange, value } }) =>
                                        <FormInput value={value} onChange={onChange} error={errors.collectionFee?.message} disabled={saving} keyboardType="numeric" />
                                    } />
                                </View>
                            </View>
                        )}

                        {/* Live Calculation Preview */}
                        {calcResult && (
                            <View className="bg-blue-50 p-5 rounded-2xl border border-blue-100 mb-6">
                                <Text className="text-blue-500 text-xs font-black uppercase tracking-wider mb-3">Loan Preview</Text>
                                <View className="flex-row justify-between mb-2">
                                    <Text className="text-blue-700 font-semibold text-sm">Installment Amount</Text>
                                    <Text className="text-blue-900 font-black">{formatPHP(calcResult.installmentAmount)}</Text>
                                </View>
                                <View className="flex-row justify-between mb-2">
                                    <Text className="text-blue-700 font-semibold text-sm">Total to Pay</Text>
                                    <Text className="text-blue-900 font-black">{formatPHP(calcResult.totalAmount)}</Text>
                                </View>

                                {activeLoanBalance > 0 && watchedValues.isReloan && watchedValues.previousLoanId === activeLoan?.id && (
                                    <>
                                        <View className="flex-row justify-between mb-2">
                                            <Text className="text-amber-600 font-semibold text-sm">Previous Loan Balance</Text>
                                            <Text className="text-red-500 font-black">- {formatPHP(activeLoanBalance)}</Text>
                                        </View>
                                        <View className="h-px bg-blue-200 my-2" />
                                        <View className="flex-row justify-between mb-2">
                                            <Text className="text-blue-800 font-black text-sm">NET CASH RELEASED</Text>
                                            <Text className="text-blue-900 font-black text-lg">
                                                {formatPHP(
                                                    calcResult.institutionalBreakdown
                                                        ? calcResult.institutionalBreakdown.netProceeds
                                                        : LoanCalculatorService.calculateNetProceeds(
                                                            effectivePrincipal,
                                                            parseFloat(watchedValues.deposit),
                                                            parseFloat(watchedValues.insurance),
                                                            activeLoanBalance
                                                        )
                                                )}
                                            </Text>
                                        </View>
                                    </>
                                )}

                                <View className="h-px bg-blue-200 my-2" />
                                <View className="flex-row justify-between">
                                    <Text className="text-blue-700 font-semibold text-sm">Maturity Date</Text>
                                    <Text className="text-blue-900 font-black">{format(calcResult.maturityDate, 'MMM d, yyyy')}</Text>
                                </View>

                                {watchedValues.termUnit === 'weeks' && (
                                    <View className="mt-4 pt-4 border-t border-blue-200">
                                        <Text className="text-blue-500 text-xs font-black uppercase tracking-wider mb-3 text-center">Weekly Amortization Breakdown</Text>
                                        <View className="flex-row justify-between mb-2">
                                            <Text className="text-blue-700 text-xs">Weekly Principal</Text>
                                            <Text className="text-blue-900 font-bold text-xs">{formatPHP(effectivePrincipal / (calcResult?.numPayments || 1))}</Text>
                                        </View>
                                        <View className="flex-row justify-between mb-2">
                                            <Text className="text-blue-700 text-xs">Weekly Interest</Text>
                                            <Text className="text-blue-900 font-bold text-xs">{formatPHP((calcResult?.totalInterest || 0) / (calcResult?.numPayments || 1))}</Text>
                                        </View>
                                        <View className="flex-row justify-between mb-2">
                                            <Text className="text-blue-700 text-xs">Weekly Savings</Text>
                                            <Text className="text-blue-900 font-bold text-xs">{formatPHP(effectivePrincipal * 0.01)}</Text>
                                        </View>
                                        <View className="flex-row justify-between mb-2">
                                            <Text className="text-blue-700 text-xs">LPF (Fixed)</Text>
                                            <Text className="text-blue-900 font-bold text-xs">{formatPHP(10)}</Text>
                                        </View>
                                        <View className="flex-row justify-between mt-2 pt-2 border-t border-blue-200/50">
                                            <Text className="text-blue-800 font-black text-sm">Total Weekly Amortization</Text>
                                            <Text className="text-blue-900 font-black text-sm">
                                                {formatPHP(
                                                    (effectivePrincipal / (calcResult?.numPayments || 1)) +
                                                    ((calcResult?.totalInterest || 0) / (calcResult?.numPayments || 1)) +
                                                    (effectivePrincipal * 0.01) +
                                                    10
                                                )}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        <Pressable
                            className={`w-full py-4 rounded-2xl items-center flex-row justify-center ${saving ? 'bg-blue-300' : 'bg-blue-700 active:bg-blue-800'}`}
                            onPress={submitLoan}
                            disabled={saving}
                        >
                            {saving ? <ActivityIndicator color="#fff" /> : (
                                <>
                                    <MaterialIcons name="send" size={20} color="#fff" />
                                    <Text className="text-white font-black text-lg ml-2">Disburse Loan</Text>
                                </>
                            )}
                        </Pressable>
                    </View>
                </View>
            </ScrollView>

            <ConfirmDialog
                visible={showConfirmReloan}
                title="Confirm Renewal"
                message={`This will close the active loan (Balance: ${reloanConfirmInfo ? formatPHP(reloanConfirmInfo.balance) : ''}) and deduct it from the new loan.\n\nNet Cash Released: ${reloanConfirmInfo ? formatPHP(reloanConfirmInfo.net) : ''}`}
                confirmLabel="Proceed"
                cancelLabel="Cancel"
                isDestructive={false}
                onConfirm={() => {
                    setShowConfirmReloan(false);
                    if (pendingData) performSave(pendingData);
                }}
                onCancel={() => setShowConfirmReloan(false)}
            />

            <AuditReportDialog
                visible={showAudit}
                issues={auditIssues}
                isSaving={saving}
                onCancel={() => setShowAudit(false)}
                onConfirm={() => pendingData && performSave(pendingData)}
            />
        </SafeAreaView>
    );
}
