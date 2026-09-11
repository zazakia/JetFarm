import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { safeBack } from '../../../src/utils/navigation';
import { format } from 'date-fns';
import { FieldErrors, useForm, Controller } from 'react-hook-form';
import * as z from 'zod';
import { database } from '../../../src/database';
import { Q } from '@nozbe/watermelondb';
import Loan from '../../../src/database/models/Loan';
import Borrower from '../../../src/database/models/Borrower';
import Payment from '../../../src/database/models/Payment';
import LoanPenalty from '../../../src/database/models/LoanPenalty';
import PaymentSchedule from '../../../src/database/models/PaymentSchedule';
import { BorrowerSelector } from '../../../src/components/BorrowerSelector';
import { DatePicker } from '../../../src/components/DatePicker';
import { LoanCalculatorService, LoanCalcResult } from '../../../src/services/LoanCalculatorService';
import { formatPHP } from '../../../src/utils/currency';
import { LoanService } from '../../../src/services/LoanService';
import { MaterialIcons } from '@expo/vector-icons';
import uuid from 'react-native-uuid';
import { useAuth } from '../../../src/store/AuthContext';
import { AuditService, AuditIssue } from '../../../src/services/AuditService';
import { AuditReportDialog } from '../../../src/components/AuditReportDialog';
import { CalculationBasisCard } from '../../../src/components/CalculationBasisCard';
import { shouldAutoPopulateLoanCycle, shouldDefaultDailyTerm } from '../../../src/utils/loanFormDefaults';
import { toDate } from '../../../src/utils/dates';
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
} from '../../../src/utils/loanProducts';
import { lookupApr2026Insurance } from '../../../src/utils/insuranceTable';
import { createSafeZodResolver } from '../../../src/utils/zodFormResolver';
import { findActiveLoanForType } from '../../../src/utils/activeLoanPolicy';
import { useLoanProductPresets } from '../../../src/hooks/useSettingsConfig';

const schema = z.object({
    borrowerId: z.string().min(1, "Borrower is required"),
    loanType: z.enum(['standard', 'petty_cash', 'livelihood', 'salary', 'emergency']),
    principal: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Principal must be positive"),
    targetPayment: z.string().optional().refine(v => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0), "Invalid target payment"),
    ratePercent: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Rate cannot be negative"),
    term: z.string().refine(v => !isNaN(parseInt(v, 10)) && parseInt(v, 10) > 0, "Term must be at least 1"),
    termUnit: z.enum(['months', 'days', 'weeks']),
    interestType: z.enum(['flat', 'diminishing']),
    frequency: z.enum(['daily', 'weekly', 'bi_monthly', 'monthly']),
    deposit: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Invalid deposit"),
    insurance: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Invalid insurance"),
    savingsPerPayment: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Invalid savings amount"),
    processingFee: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Invalid processing fee"),
    collectionFee: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Invalid collection fee"),
    notarialFee: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Invalid notarial fee"),
    rodFee: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Invalid ROD fee"),
    ltoFee: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Invalid LTO fee"),
    udiRebatableFee: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Invalid UDI fee"),
    rebateAmount: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Invalid rebate"),
    isReloan: z.boolean(),
    previousLoanId: z.string().optional(),
    loanBatch: z.string().optional(),
    loanCycle: z.string().optional(),
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

export default function NewLoanScreen() {
    const { id: editLoanId } = useLocalSearchParams<{ id?: string }>();
    const router = useRouter();
    const { user } = useAuth();
    const [saving, setSaving] = useState(false);
    const [calcResult, setCalcResult] = useState<LoanCalcResult | null>(null);
    const [previousLoanBalance, setPreviousLoanBalance] = useState(0);
    const [previousLoanBalances, setPreviousLoanBalances] = useState<Record<string, number>>({});
    const [existingLoan, setExistingLoan] = useState<Loan | null>(null);
    const [isEditing, setIsEditing] = useState(!!editLoanId);
    const [activeLoan, setActiveLoan] = useState<Loan | null>(null);
    const [auditIssues, setAuditIssues] = useState<AuditIssue[]>([]);
    const [showAudit, setShowAudit] = useState(false);
    const [pendingData, setPendingData] = useState<{ data: FormData, status: 'pending' | 'active' } | null>(null);
    const { presets: loanProductPresets } = useLoanProductPresets();

    const [originalPrevLoanId, setOriginalPrevLoanId] = useState<string | null>(null);
    const [originalDeducted, setOriginalDeducted] = useState<number>(0);
    const [previousTermUnit, setPreviousTermUnit] = useState<string>('weeks');

    const { control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
        resolver: createSafeZodResolver(schema),
        defaultValues: {
            borrowerId: '',
            loanType: 'standard',
            principal: '5000',
            targetPayment: '',
            ratePercent: '20',
            term: '20',
            termUnit: 'weeks',
            interestType: 'flat',
            frequency: 'monthly',
            deposit: '50',
            insurance: '17',
            savingsPerPayment: '0',
            processingFee: '0',
            collectionFee: '0',
            notarialFee: '0',
            rodFee: '0',
            ltoFee: '0',
            udiRebatableFee: '0',
            rebateAmount: '0',
            isReloan: false,
            previousLoanId: '',
            loanBatch: '',
            loanCycle: '1',
            releaseDate: format(new Date(), 'yyyy-MM-dd'),
        }
    });

    const [previousLoans, setPreviousLoans] = useState<Loan[]>([]);
    const [loadingPreviousLoans, setLoadingPreviousLoans] = useState(false);
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
            // react-hook-form still exposes validation errors through formState.
        }
    }, []);

    const editingLoanId = typeof editLoanId === 'string' && editLoanId.trim().length > 0 ? editLoanId : null;
    const isEditMode = !!editingLoanId;

    const watchedFields = watch();
    const watchedLoanType = watchedFields.loanType || 'standard';
    const watchedIsInstitutional = isInstitutionalLoanType(watchedLoanType);
    const watchedTermRuleText = loanProductTermRuleText(watchedLoanType);
    const watchedSavingsPerPayment = parseFloat(watchedFields.savingsPerPayment || '0') || 0;
    const watchedRebateAmount = parseFloat(watchedFields.rebateAmount || '0') || 0;
    const watchedTargetPayment = parseFloat(watchedFields.targetPayment || '');
    const computedPrincipalFromTarget = watchedIsInstitutional && !isNaN(watchedTargetPayment) && watchedTargetPayment > 0
        ? LoanCalculatorService.principalFromTargetInstitutionalPayment({
            targetPayment: watchedTargetPayment,
            monthlyRatePercent: parseFloat(watchedFields.ratePercent || '0') || 0,
            term: parseInt(watchedFields.term || '0', 10) || 0,
            termUnit: watchedFields.termUnit,
            frequency: watchedFields.frequency,
            savingsPerPayment: watchedSavingsPerPayment,
            rebatePerPayment: watchedRebateAmount,
        })
        : null;
    const effectivePrincipal = computedPrincipalFromTarget ?? (parseFloat(watchedFields.principal || '0') || 0);
    const tableInsurance = lookupApr2026Insurance({
        principal: effectivePrincipal,
        term: parseInt(watchedFields.term || '0', 10) || 0,
        termUnit: watchedFields.termUnit,
    });

    useEffect(() => {
        if (editLoanId) {
            const fetchExistingLoan = async () => {
                try {
                    const l = await database.collections.get<Loan>('loans').find(editLoanId);
                    setExistingLoan(l);
                    setIsEditing(true);

                    const rDate = l.releaseDate ? new Date(l.releaseDate) : new Date();

                    reset({
                        borrowerId: l.borrowerId,
                        loanType: (l.loanType as LoanProductType) || 'standard',
                        principal: l.principalAmount.toString(),
                        targetPayment: '',
                        ratePercent: l.interestRate.toString(),
                        term: l.term.toString(),
                        termUnit: l.termUnit as 'months' | 'days',
                        interestType: l.interestType as 'flat' | 'diminishing',
                        frequency: l.frequency as 'daily' | 'weekly' | 'bi_monthly' | 'monthly',
                        deposit: (l.depositAmount || 0).toString(),
                        insurance: (l.insuranceAmount || 0).toString(),
                        savingsPerPayment: (l.savingsPerPayment || 0).toString(),
                        processingFee: (l.processingFee || 0).toString(),
                        collectionFee: (l.collectionFee || 0).toString(),
                        notarialFee: (l.notarialFee || 0).toString(),
                        rodFee: (l.rodFee || 0).toString(),
                        ltoFee: (l.ltoFee || 0).toString(),
                        udiRebatableFee: (l.udiRebatableFee || 0).toString(),
                        rebateAmount: (l.rebateAmount || 0).toString(),
                        isReloan: l.isReloan,
                        previousLoanId: l.previousLoanId || '',
                        loanBatch: l.loanBatch ? l.loanBatch.toString() : '',
                        loanCycle: l.loanCycle ? l.loanCycle.toString() : '1',
                        releaseDate: format(rDate, 'yyyy-MM-dd'),
                    });
                    
                    setOriginalPrevLoanId(l.previousLoanId || '');
                    setOriginalDeducted(l.deductedAmount || 0);
                    setPreviousLoanBalance(l.deductedAmount || 0);
                } catch (error) {
                    console.error("Failed to load existing loan", error);
                }
            };
            fetchExistingLoan();
        }
    }, [editLoanId, reset]);

    useEffect(() => {
        if (isEditing) return;
        const preset = loanProductPresets[watchedLoanType as LoanProductType] || loanProductPresets.standard || LOAN_PRODUCT_PRESETS.standard;
        setValue('ratePercent', preset.defaultRatePercent);
        setValue('term', preset.defaultTerm);
        setValue('termUnit', preset.defaultTermUnit);
        setValue('frequency', preset.defaultFrequency);
        setValue('savingsPerPayment', preset.defaultSavingsPerPayment);
        const principal = parseFloat(preset.defaultPrincipal || watchedFields.principal || '0') || 0;
        setValue('notarialFee', notarialFeeFromPrincipal(watchedLoanType as LoanProductType, principal).toString());
        if (preset.defaultPrincipal) {
            setValue('principal', preset.defaultPrincipal);
        }

        setValue('processingFee', processingFeeFromPrincipal(watchedLoanType as LoanProductType, principal).toString());
    }, [watchedLoanType, isEditing, setValue, loanProductPresets]);

    useEffect(() => {
        if (isEditing || watchedLoanType === 'standard') return;
        setValue('processingFee', processingFeeFromPrincipal(watchedLoanType as LoanProductType, effectivePrincipal).toString());
        setValue('notarialFee', notarialFeeFromPrincipal(watchedLoanType as LoanProductType, effectivePrincipal).toString());
    }, [effectivePrincipal, watchedLoanType, isEditing, setValue]);

    useEffect(() => {
        if (isEditing) return;
        const t = parseInt(watchedFields.term, 10);
        const numPayments = (!isNaN(t) && t > 0) ? LoanCalculatorService.paymentsForFrequency(t, watchedFields.termUnit, watchedFields.frequency) : 1;
        
        if (watchedFields.termUnit === 'weeks') {
            setValue('insurance', (10 * numPayments).toString());
            setValue('deposit', (effectivePrincipal * 0.01 * numPayments).toString());
        } else {
            setValue('insurance', '0'); // Issue #18: Default insurance to 0 as field is removed
            setValue('deposit', (effectivePrincipal * 0.01).toString()); // Issue #15: Autocompute savings
        }
    }, [effectivePrincipal, watchedFields.term, watchedFields.termUnit, watchedFields.frequency, isEditing, setValue]);

    useEffect(() => {
        const p = effectivePrincipal;
        const r = parseFloat(watchedFields.ratePercent);
        const t = parseInt(watchedFields.term, 10);
        const dep = parseFloat(watchedFields.deposit);
        const ins = parseFloat(watchedFields.insurance);

        if (!isNaN(p) && p > 0 && !isNaN(r) && !isNaN(t) && t > 0) {
            const parsedDate = toDate(watchedFields.releaseDate) || new Date();
            const res = watchedIsInstitutional
                ? LoanCalculatorService.calculateInstitutionalLoan({
                    loanType: watchedLoanType,
                    principal: p,
                    monthlyRatePercent: r,
                    term: t,
                    termUnit: watchedFields.termUnit,
                    frequency: watchedFields.frequency,
                    releaseDate: parsedDate,
                    processingFee: parseFloat(watchedFields.processingFee) || 0,
                    collectionFee: parseFloat(watchedFields.collectionFee) || 0,
                    notarialFee: parseFloat(watchedFields.notarialFee) || 0,
                    insuranceFee: !isNaN(ins) ? ins : 0,
                    rodFee: parseFloat(watchedFields.rodFee) || 0,
                    ltoFee: parseFloat(watchedFields.ltoFee) || 0,
                    udiRebatableFee: parseFloat(watchedFields.udiRebatableFee) || 0,
                    outstandingBalance: previousLoanBalance,
                    savingsPerPayment: parseFloat(watchedFields.savingsPerPayment) || 0,
                    rebatePerPayment: parseFloat(watchedFields.rebateAmount) || 0,
                })
                : LoanCalculatorService.calculate(
                    p, r, t, watchedFields.termUnit,
                    watchedFields.interestType, watchedFields.frequency,
                    parsedDate, !isNaN(dep) ? dep : 0, !isNaN(ins) ? ins : 0
                );
            setCalcResult(res);
        } else {
            setCalcResult(null);
        }
    }, [effectivePrincipal, watchedFields.ratePercent, watchedFields.term, watchedFields.termUnit, watchedFields.interestType, watchedFields.frequency, watchedFields.deposit, watchedFields.insurance, watchedFields.releaseDate, watchedFields.loanType, watchedFields.processingFee, watchedFields.collectionFee, watchedFields.notarialFee, watchedFields.rodFee, watchedFields.ltoFee, watchedFields.udiRebatableFee, watchedFields.savingsPerPayment, watchedFields.rebateAmount, previousLoanBalance]);

    useEffect(() => {
        const fetchPreviousLoans = async () => {
            if (watchedFields.borrowerId) {
                setLoadingPreviousLoans(true);
                try {
                    const loans = await database.collections.get<Loan>('loans').query(
                        Q.where('borrower_id', watchedFields.borrowerId),
                        Q.where('status', Q.oneOf(['active', 'closed', 'paid', 'defaulted']))
                    ).fetch();
                    
                    const active = findActiveLoanForType(loans, watchedLoanType, editLoanId);
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
                    } else {
                        setPreviousLoanBalances({});
                    }

                    if (active && !isEditing) {
                        setValue('isReloan', true);
                        setValue('previousLoanId', active.id);
                    } else if (!active && !isEditing) {
                        setValue('isReloan', false);
                        setValue('previousLoanId', '');
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
            }
        };
        fetchPreviousLoans();
    }, [watchedFields.borrowerId, watchedLoanType, isEditing, editLoanId, setValue]);

    // Auto-calculate Loan Cycle
    useEffect(() => {
        if (shouldAutoPopulateLoanCycle(isEditing, watchedFields.borrowerId)) {
            setValue('loanCycle', (previousLoans.length + 1).toString());
        }
    }, [previousLoans, watchedFields.borrowerId, isEditing, setValue]);

    // Auto-set term to 40 when unit is 'days'
    useEffect(() => {
        if (shouldDefaultDailyTerm({
            isEditing,
            previousTermUnit,
            nextTermUnit: watchedFields.termUnit,
            currentTerm: watchedFields.term,
        })) {
            setValue('term', '40');
        }
        setPreviousTermUnit(watchedFields.termUnit);
    }, [watchedFields.termUnit, watchedFields.term, previousTermUnit, isEditing, setValue]);

    // Calculate previous loan balance when selection changes
    useEffect(() => {
        const calcPrevBalance = async () => {
            if (watchedFields.isReloan && watchedFields.previousLoanId) {
                // Preserve historical data if this is an edit and the link hasn't changed.
                if (isEditing && watchedFields.previousLoanId === originalPrevLoanId) {
                    setPreviousLoanBalance(originalDeducted);
                    return;
                }
                setPreviousLoanBalance(previousLoanBalances[watchedFields.previousLoanId] || 0);
            } else {
                setPreviousLoanBalance(0);
            }
        };
        calcPrevBalance();
    }, [watchedFields.isReloan, watchedFields.previousLoanId, previousLoanBalances, isEditing, originalPrevLoanId, originalDeducted]);

    const performSave = async (data: FormData, status: 'pending' | 'active') => {
        if (!calcResult) return;
        setSaving(true);
        try {
            const borrower = await database.collections.get<Borrower>('borrowers').find(data.borrowerId);
            const loanId = isEditing && existingLoan ? existingLoan.id : uuid.v4().toString();
            const ln = isEditing && existingLoan ? existingLoan.loanNumber : LoanCalculatorService.generateLoanNumber();

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
                releaseDate: toDate(data.releaseDate) || new Date(),
                status,
                isReloan: data.isReloan,
                previousLoanId: data.previousLoanId,
                deductedAmount: previousLoanBalance,
                loanBatch: data.loanBatch ? parseInt(data.loanBatch, 10) : null,
                loanCycle: data.loanCycle ? parseInt(data.loanCycle, 10) : null,
                interestAmount: calcResult.totalInterest,
                isEditing,
                existingLoan: existingLoan
            });

            notify('success', 'Loan saved', `Loan ${status === 'active' ? 'disbursed' : 'saved as draft'}.`);
            if (Platform.OS === 'web') {
                window.alert(`Loan ${status === 'active' ? 'disbursed' : 'saved as draft'}.`);
            } else {
                Alert.alert("Success", `Loan ${status === 'active' ? 'disbursed' : 'saved as draft'}.`);
            }
            safeBack(router, '/(admin)');
        } catch (error) {
            console.error('Save loan failed:', error);
            const message = error instanceof Error ? error.message : 'Failed to save loan.';
            notify('error', 'Save failed', message);
            if (Platform.OS === 'web') {
                window.alert(`Failed to save loan. ${message}`);
            } else {
                Alert.alert('Error', message);
            }
        } finally {
            setSaving(false);
            setShowAudit(false);
            setPendingData(null);
        }
    };

    const onSubmit = async (data: FormData, status: 'pending' | 'active') => {
        setNotification(null);
        setShowAudit(false);
        if (!calcResult) {
            notify('error', 'Calculation unavailable', 'Please check the loan inputs until the computation summary appears.');
            return;
        }

        // Final safety check: one active loan per borrower per loan type.
        if (status === 'active' && activeLoan && !data.isReloan) {
            const message = `Borrower already has an active ${loanProductLabel(data.loanType as LoanProductType)}. Use Renewal for this loan type or choose another loan type.`;
            if (Platform.OS === 'web') {
                window.alert(message);
            } else {
                Alert.alert('Error', message);
            }
            notify('error', 'Cannot disburse loan', message);
            return;
        }

        // Override check for principal deviation
        const preset = loanProductPresets[data.loanType as LoanProductType] || loanProductPresets.standard;
        const maxAllowed = preset?.maxPrincipal;
        if (status === 'active' && maxAllowed && effectivePrincipal > maxAllowed) {
            const warningMsg = `This loan principal (${formatPHP(effectivePrincipal)}) exceeds the maximum allowed limit of ${formatPHP(maxAllowed)} for ${loanProductLabel(data.loanType)}. Do you want to override this rule and disburse this loan?`;
            
            if (Platform.OS === 'web') {
                if (!window.confirm(warningMsg)) {
                    return;
                }
            } else {
                const proceed = await new Promise((resolve) => {
                    Alert.alert(
                        'Confirm Rule Override',
                        warningMsg,
                        [
                            { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                            { text: 'Override & Disburse', onPress: () => resolve(true) }
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
                { ...data, principal: effectivePrincipal.toString(), deductedAmount: previousLoanBalance },
                calcResult, 
                isEditing
            );

            if (issues.length > 0) {
                setAuditIssues(issues);
                setPendingData({ data, status });
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

            // 2. If no issues, proceed to save directly
            await performSave(data, status);
        } catch (error) {
            console.error('Audit failed:', error);
            const message = error instanceof Error ? error.message : 'Safety audit failed. Please try again.';
            notify('error', 'Safety audit failed', message);
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

    const submitLoan = useCallback((status: 'pending' | 'active') => {
        void handleSubmit(
            data => onSubmit(data, status),
            onInvalidSubmit
        )().catch(error => {
            console.error('Loan submit failed:', error);
            const message = error instanceof Error ? error.message : 'Unexpected form error. Please try again.';
            notify('error', 'Submit failed', message);
        });
    }, [handleSubmit, notify, onInvalidSubmit, onSubmit]);

    return (
        <ScrollView className="flex-1 bg-gray-50"  contentContainerStyle={{ padding: 16 }}>
            {notification && (
                <View
                    testID="loan-form-notification"
                    className={`mb-4 p-4 rounded-2xl border ${
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
            <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                <Text testID="page-title" className="text-xl font-extrabold text-gray-900 mb-6">Loan Parameters</Text>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Select Borrower</Text>
                    <Controller
                        control={control}
                        name="borrowerId"
                        render={({ field: { onChange, value } }) => (
                            <BorrowerSelector
                                selectedBorrowerId={value}
                                onSelect={(b) => onChange(b.id)}
                                disabled={isEditMode}
                            />
                        )}
                    />
                    {errors.borrowerId && <Text className="text-red-500 text-xs mt-1">{errors.borrowerId.message}</Text>}
                </View>

                {/* Release Date Picker */}
                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Loan Release Date</Text>
                    <Controller
                        control={control}
                        name="releaseDate"
                        render={({ field: { onChange, value } }) => (
                            <DatePicker
                                value={value}
                                onChange={(date: string) => {
                                    onChange(date);
                                }}
                            />
                        )}
                    />
                    {errors.releaseDate && <Text className="text-red-500 text-xs mt-1">{errors.releaseDate.message}</Text>}
                    <Text className="text-[10px] text-gray-700 mt-1 italic">Calculations will be based on this date</Text>
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Loan Type / Computation Module</Text>
                    <Controller
                        control={control}
                        name="loanType"
                        render={({ field: { onChange, value } }) => (
                            <View className="flex-row flex-wrap bg-gray-50 p-1 rounded-xl">
                                {(Object.keys(loanProductPresets) as LoanProductType[])
                                    .filter(type => type === value || loanProductPresets[type]?.isActive !== false)
                                    .map(type => (
                                        <Pressable
                                            key={type}
                                            testID={`loan-type-${type}`}
                                            onPress={() => applyFieldChange(onChange, type)}
                                            className={`w-1/2 py-3 px-2 rounded-lg ${value === type ? 'bg-white shadow-sm' : ''}`}
                                        >
                                            <Text className={`text-xs font-bold ${value === type ? 'text-blue-900' : 'text-gray-700'}`}>
                                                {loanProductPresets[type].label}
                                            </Text>
                                        </Pressable>
                                    ))}
                            </View>
                        )}
                    />
                    <Text className="text-[10px] text-gray-700 mt-1 italic">
                        {loanProductPresets[watchedLoanType as LoanProductType]?.description}
                    </Text>
                </View>

                {/* Renewal Toggle */}
                {watchedFields.borrowerId !== '' && (
                    <View className={`mb-4 flex-row items-center justify-between p-4 rounded-2xl border ${activeLoan ? 'bg-amber-50 border-amber-100' : 'bg-blue-50/50 border-blue-100'}`}>
                        <View className="flex-1 mr-4">
                            <Text className={`${activeLoan ? 'text-amber-900' : 'text-blue-900'} font-bold text-sm`}>
                                {activeLoan ? 'Loan Renewal Required' : 'Is this a Renewal?'}
                            </Text>
                            <Text className={`${activeLoan ? 'text-amber-500' : 'text-blue-400'} text-xs mt-0.5`}>
                                {activeLoan ? `Borrower has an active ${loanProductLabel(watchedLoanType)} (${activeLoan.loanNumber}). Renewal is required for this loan type.` : 'Link this to a previous loan'}
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
                                        onPress={() => !activeLoan && !(isEditing && existingLoan?.status === 'active') && applyFieldChange(onChange, !value)}
                                        disabled={previousLoans.length === 0 || !!activeLoan || (isEditing && existingLoan?.status === 'active')}
                                        className={`w-12 h-6 rounded-full p-1 ${value ? 'bg-blue-600' : 'bg-gray-200'} ${(previousLoans.length === 0 || !!activeLoan || (isEditing && existingLoan?.status === 'active')) ? 'opacity-50' : ''}`}
                                    >
                                        <View className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all ${value ? 'ml-6' : 'ml-0'}`} />
                                    </Pressable>
                                </View>
                            )}
                        />
                    </View>
                )}

                {/* Previous Loan Selector */}
                {watchedFields.isReloan && previousLoans.length > 0 && (
                    <View className="mb-4">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Previous Loan to Renew</Text>
                        <Controller
                            control={control}
                            name="previousLoanId"
                            render={({ field: { onChange, value } }) => (
                                <View className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
                                    {previousLoans.map((loan, idx) => (
                                        <Pressable
                                            key={loan.id}
                                            onPress={() => !activeLoan && !(isEditing && existingLoan?.status === 'active') && applyFieldChange(onChange, loan.id)}
                                            className={`p-4 flex-row justify-between items-center ${idx < previousLoans.length - 1 ? 'border-b border-gray-100' : ''} ${value === loan.id ? 'bg-blue-50' : ''} ${ (activeLoan || (isEditing && existingLoan?.status === 'active')) ? 'opacity-70' : ''}`}
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

                <View className="flex-row mb-4">
                    <View className="flex-1 mr-2">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Loan Amount (Principal) (₱) *</Text>
                        <Controller
                            control={control}
                            name="principal"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className={`bg-gray-50 p-4 rounded-xl border ${errors.principal ? 'border-red-500' : 'border-gray-200'} text-gray-900 font-bold`}
                                    testID="loan-principal-input"
                                    value={value} onChangeText={onChange} keyboardType="numeric" editable={!saving} placeholder="e.g. 5000"
                                 placeholderTextColor="#9CA3AF"/>
                            )}
                        />
                        {errors.principal && <Text className="text-red-500 text-xs mt-1">{errors.principal.message}</Text>}
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
                    <View className="flex-1 ml-2">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Int. Rate (%) *</Text>
                        <Controller
                            control={control}
                            name="ratePercent"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className={`bg-gray-50 p-4 rounded-xl border ${errors.ratePercent ? 'border-red-500' : 'border-gray-200'} text-gray-900 font-bold`}
                                    testID="loan-rate-input"
                                    value={value} onChangeText={onChange} keyboardType="numeric" editable={!saving}
                                />
                            )}
                        />
                        {errors.ratePercent && <Text className="text-red-500 text-xs mt-1">{errors.ratePercent.message}</Text>}
                    </View>
                </View>

                {watchedIsInstitutional && (
                    <View className="mb-4 bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                        <Text className="text-xs font-bold text-amber-900 mb-2 uppercase">Optional Target Payment</Text>
                        <Controller
                            control={control}
                            name="targetPayment"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className={`bg-white p-4 rounded-xl border ${errors.targetPayment ? 'border-red-500' : 'border-amber-100'} text-gray-900 font-bold`}
                                    testID="loan-target-payment-input"
                                    value={value}
                                    onChangeText={onChange}
                                    keyboardType="numeric"
                                    editable={!saving}
                                    placeholder={watchedFields.frequency === 'bi_monthly' ? 'e.g. 3500 per payday' : 'e.g. 2000 monthly'}
                                 placeholderTextColor="#9CA3AF"/>
                            )}
                        />
                        {errors.targetPayment && <Text className="text-red-500 text-xs mt-1">{errors.targetPayment.message}</Text>}
                        {computedPrincipalFromTarget !== null && (
                            <Text className="text-[11px] text-amber-900 mt-2 font-bold">
                                Computed loan amount from target: {formatPHP(computedPrincipalFromTarget)}
                            </Text>
                        )}
                    </View>
                )}

                <View className="flex-row mb-4">
                    <View className="flex-1 mr-2">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Batch Number</Text>
                        <Controller
                            control={control}
                            name="loanBatch"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 font-bold"
                                    value={value} onChangeText={onChange} placeholder="e.g. 1" keyboardType="numeric" editable={!saving}
                                 placeholderTextColor="#9CA3AF"/>
                            )}
                        />
                    </View>
                    <View className="flex-1 ml-2">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Loan Cycle</Text>
                        <Controller
                            control={control}
                            name="loanCycle"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-gray-900 font-bold"
                                    value={value} onChangeText={onChange} placeholder="e.g. 1" keyboardType="numeric" editable={!saving}
                                 placeholderTextColor="#9CA3AF"/>
                            )}
                        />
                    </View>
                </View>

                {watchedIsInstitutional && (
                    <View className="mb-4 bg-white p-4 rounded-2xl border border-gray-100">
                        <Text className="text-xs font-bold text-gray-700 uppercase mb-3">Computation Slip Charges</Text>
                        <View className="flex-row mb-3">
                            <View className="flex-1 mr-2">
                                <Text className="text-[10px] font-bold text-gray-700 mb-1 uppercase">Savings / Payment</Text>
                                <Controller control={control} name="savingsPerPayment" render={({ field: { onChange, value } }) => (
                                    <TextInput testID="loan-savings-per-payment-input" className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-bold text-gray-900" value={value} onChangeText={onChange} keyboardType="numeric" editable={!saving} />
                                )} />
                            </View>
                            <View className="flex-1 ml-2">
                                <Text className="text-[10px] font-bold text-gray-700 mb-1 uppercase">Rebate / Payment</Text>
                                <Controller control={control} name="rebateAmount" render={({ field: { onChange, value } }) => (
                                    <TextInput testID="loan-rebate-amount-input" className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-bold text-gray-900" value={value} onChangeText={onChange} keyboardType="numeric" editable={!saving} />
                                )} />
                            </View>
                        </View>
                        <View className="flex-row mb-3">
                            <View className="flex-1 mr-2">
                                <Text className="text-[10px] font-bold text-gray-700 mb-1 uppercase">Processing Fee</Text>
                                <Controller control={control} name="processingFee" render={({ field: { onChange, value } }) => (
                                    <TextInput testID="loan-processing-fee-input" className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-bold text-gray-900" value={value} onChangeText={onChange} keyboardType="numeric" editable={!saving} />
                                )} />
                            </View>
                            <View className="flex-1 ml-2">
                                <Text className="text-[10px] font-bold text-gray-700 mb-1 uppercase">Notarial Fee</Text>
                                <Controller control={control} name="notarialFee" render={({ field: { onChange, value } }) => (
                                    <TextInput className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-bold text-gray-900" value={value} onChangeText={onChange} keyboardType="numeric" editable={!saving} />
                                )} />
                            </View>
                        </View>
                        <View className="mb-3">
                            <Text className="text-[10px] font-bold text-gray-700 mb-1 uppercase">Collection Fee</Text>
                            <Controller control={control} name="collectionFee" render={({ field: { onChange, value } }) => (
                                <TextInput className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-bold text-gray-900" value={value} onChangeText={onChange} keyboardType="numeric" editable={!saving} />
                            )} />
                        </View>
                    </View>
                )}

                <View className="flex-row mb-4">
                    <View className="flex-1 mr-2">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Total Savings (₱) *</Text>
                        <Controller
                            control={control}
                            name="deposit"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className={`bg-gray-50 p-4 rounded-xl border ${errors.deposit ? 'border-red-500' : 'border-gray-200'} text-gray-900 font-bold`}
                                    value={value} onChangeText={onChange} keyboardType="numeric" editable={!saving}
                                />
                            )}
                        />
                        {errors.deposit && <Text className="text-red-500 text-xs mt-1">{errors.deposit.message}</Text>}
                    </View>
                </View>

                <View className="flex-row mb-4">
                    <View className="flex-[2] mr-2">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Term *</Text>
                        <Controller
                            control={control}
                            name="term"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className={`bg-gray-50 p-4 rounded-xl border ${errors.term ? 'border-red-500' : 'border-gray-200'} text-gray-900 font-bold`}
                                    testID="loan-term-input"
                                    value={value} onChangeText={onChange} keyboardType="numeric" editable={!saving}
                                />
                            )}
                        />
                        {errors.term && <Text className="text-red-500 text-xs mt-1">{errors.term.message}</Text>}
                        {watchedTermRuleText && !errors.term && (
                            <Text className="text-amber-700 text-[11px] font-bold mt-1">{watchedTermRuleText}</Text>
                        )}
                    </View>
                    <View className="flex-[1] ml-2">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Unit</Text>
                        <Controller
                            control={control}
                            name="termUnit"
                            render={({ field: { onChange, value } }) => (
                                <View className="flex-row bg-gray-50 p-1 rounded-xl">
                                    {['months', 'days', 'weeks'].map(unit => (
                                        <Pressable
                                            key={unit}
                                            onPress={() => applyFieldChange(onChange, unit)}
                                            className={`flex-1 py-3 items-center rounded-lg ${value === unit ? 'bg-white shadow-sm' : ''}`}
                                        >
                                            <Text className={`text-xs font-bold capitalize ${value === unit ? 'text-blue-900' : 'text-gray-700'}`}>{unit}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            )}
                        />
                    </View>
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Interest Type</Text>
                    <Controller
                        control={control}
                        name="interestType"
                        render={({ field: { onChange, value } }) => (
                            <View className="flex-row bg-gray-50 p-1 rounded-xl">
                                {['flat', 'diminishing'].map(type => (
                                    <Pressable
                                        key={type}
                                        testID={`interest-type-${type}`}
                                        onPress={() => applyFieldChange(onChange, type)}
                                        className={`flex-1 py-3 items-center rounded-lg ${value === type ? 'bg-white shadow-sm' : ''}`}
                                    >
                                        <Text className={`font-bold capitalize ${value === type ? 'text-blue-900' : 'text-gray-700'}`}>{type}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    />
                </View>

                <View className="mb-4">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Payment Frequency</Text>
                    <Controller
                        control={control}
                        name="frequency"
                        render={({ field: { onChange, value } }) => (
                            <View className="flex-row flex-wrap bg-gray-50 p-1 rounded-xl">
                                {['daily', 'weekly', 'bi_monthly', 'monthly'].map(freq => (
                                    <Pressable
                                        key={freq}
                                        onPress={() => applyFieldChange(onChange, freq)}
                                        className={`w-1/2 py-3 items-center rounded-lg ${value === freq ? 'bg-white shadow-sm' : ''}`}
                                    >
                                        <Text className={`font-bold capitalize ${value === freq ? 'text-blue-900' : 'text-gray-700'}`}>
                                            {freq.replace('_', '-')}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                    />
                </View>
            </View>

            {calcResult && (
                <View className="mb-6">
                    <View className="bg-blue-900 p-6 rounded-3xl shadow-md relative overflow-hidden">
                        <View className="absolute -right-10 -top-10 bg-white/10 w-40 h-40 rounded-full" />
                        <Text className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-1">Total Loan Amount</Text>
                        <Text className="text-4xl font-extrabold text-white mb-6">{formatPHP(calcResult.totalAmount)}</Text>
                        <View className="flex-row mb-2">
                            <View className="flex-1 bg-white/10 p-4 rounded-2xl mr-2">
                                <Text className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mb-1">Installment Amount</Text>
                                <Text className="text-xl font-bold text-white">{formatPHP(calcResult.installmentAmount)}</Text>
                                <Text className="text-xs text-indigo-300 mt-1">per {watchedFields.frequency.replace('_', '-')}</Text>
                            </View>
                            <View className="flex-1 bg-white/10 p-4 rounded-2xl ml-2 justify-center">
                                <Text className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mb-1">Total Payments</Text>
                                <Text className="text-xl font-bold text-white">{calcResult.numPayments} payments</Text>
                            </View>
                        </View>
                    </View>

                    <View className="bg-white p-4 rounded-2xl border border-gray-100 mt-4">
                        <Text className="text-xs font-bold text-gray-700 uppercase mb-3">Breakdown</Text>
                        <View className="flex-row justify-between mb-2">
                            <Text className="text-gray-600">Loan Amount (Principal)</Text>
                            <Text className="font-bold text-gray-900">{formatPHP(effectivePrincipal)}</Text>
                        </View>
                        <View className="flex-row justify-between mb-2">
                            <Text className="text-gray-600">Interest ({watchedFields.ratePercent}%)</Text>
                            <Text className="font-bold text-gray-900">{formatPHP(calcResult.totalInterest)}</Text>
                        </View>
                        <View className="flex-row justify-between mb-2">
                            <View>
                                <Text className="text-gray-600">Total Savings</Text>
                                <Text className="text-[10px] text-gray-700">{formatPHP(parseFloat(watchedFields.deposit) / calcResult.numPayments)} per {watchedFields.frequency.replace('_', '-')}</Text>
                            </View>
                            <Text className="font-bold text-gray-900">{formatPHP(parseFloat(watchedFields.deposit))}</Text>
                        </View>
                         <View className="flex-row justify-between">
                            <View>
                                <Text className="text-gray-600">Total Insurance</Text>
                                <Text className="text-[10px] text-gray-700">{formatPHP(parseFloat(watchedFields.insurance) / calcResult.numPayments)} per {watchedFields.frequency.replace('_', '-')}</Text>
                            </View>
                            <Text className="font-bold text-gray-900">{formatPHP(parseFloat(watchedFields.insurance))}</Text>
                        </View>

                        {calcResult.institutionalBreakdown ? (
                            <View className="mt-3 pt-3 border-t border-gray-100">
                                {calcResult.institutionalBreakdown.processingFee > 0 && (
                                    <View className="flex-row justify-between mb-2">
                                        <Text className="text-gray-600">Processing Fee</Text>
                                        <Text className="font-bold text-gray-900">{formatPHP(calcResult.institutionalBreakdown.processingFee)}</Text>
                                    </View>
                                )}
                                {calcResult.institutionalBreakdown.notarialFee > 0 && (
                                    <View className="flex-row justify-between mb-2">
                                        <Text className="text-gray-600">Notarial Fee</Text>
                                        <Text className="font-bold text-gray-900">{formatPHP(calcResult.institutionalBreakdown.notarialFee)}</Text>
                                    </View>
                                )}
                                {calcResult.institutionalBreakdown.collectionFee > 0 && (
                                    <View className="flex-row justify-between mb-2">
                                        <Text className="text-gray-600">Collection Fee</Text>
                                        <Text className="font-bold text-gray-900">{formatPHP(calcResult.institutionalBreakdown.collectionFee)}</Text>
                                    </View>
                                )}
                                <View className="flex-row justify-between">
                                    <Text className="text-gray-600">Net Proceeds</Text>
                                    <Text className="font-bold text-green-700">{formatPHP(calcResult.institutionalBreakdown.netProceeds)}</Text>
                                </View>
                            </View>
                        ) : (() => {
                            const std = LoanCalculatorService.calculateStandardBreakdown(effectivePrincipal, previousLoanBalance);
                            return (
                                <View className="mt-3 pt-3 border-t border-gray-100">
                                    <View className="flex-row justify-between mb-2">
                                        <Text className="text-gray-600">ARF (2%)</Text>
                                        <Text className="font-bold text-gray-900">{formatPHP(std.arf)}</Text>
                                    </View>
                                    <View className="flex-row justify-between mb-2">
                                        <Text className="text-gray-600">CPF (4%)</Text>
                                        <Text className="font-bold text-gray-900">{formatPHP(std.cpf)}</Text>
                                    </View>
                                    <View className="flex-row justify-between mb-2">
                                        <Text className="text-gray-600">MEM</Text>
                                        <Text className="font-bold text-gray-900">{formatPHP(std.mem)}</Text>
                                    </View>
                                    <View className="flex-row justify-between mb-2">
                                        <Text className="text-gray-600">LHF</Text>
                                        <Text className="font-bold text-gray-900">{formatPHP(std.lhf)}</Text>
                                    </View>
                                    <View className="flex-row justify-between mb-2">
                                        <Text className="text-gray-600">RSF</Text>
                                        <Text className="font-bold text-gray-900">{formatPHP(std.rsf)}</Text>
                                    </View>
                                    <View className="flex-row justify-between mb-2">
                                        <Text className="text-gray-600">Doc. Stamp</Text>
                                        <Text className="font-bold text-gray-900">{formatPHP(std.docStamp)}</Text>
                                    </View>
                                    <View className="flex-row justify-between">
                                        <Text className="text-gray-600">Net Proceeds</Text>
                                        <Text className="font-bold text-green-700">{formatPHP(std.netProceeds)}</Text>
                                    </View>
                                </View>
                            );
                        })()}

                        {previousLoanBalance > 0 && (
                            <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-100">
                                <Text className="text-red-600 font-bold">Previous Balance Deducted</Text>
                                <Text className="font-bold text-red-600">-{formatPHP(previousLoanBalance)}</Text>
                            </View>
                        )}

                        <View className="flex-row justify-between mt-4 pt-4 border-t-2 border-gray-100">
                            <Text className="text-lg font-black text-gray-900">Net Release (Disbursement)</Text>
                            <Text className="text-lg font-black text-green-700">
                                {formatPHP(calcResult.institutionalBreakdown?.netProceeds ?? LoanCalculatorService.calculateStandardBreakdown(effectivePrincipal, previousLoanBalance).netProceeds)}
                            </Text>
                        </View>
                        
                        {watchedFields.termUnit === 'weeks' && (
                            <View className="mt-4 pt-4 border-t-2 border-gray-100 bg-gray-50 p-4 rounded-xl">
                                <Text className="text-xs font-bold text-gray-700 uppercase mb-3 text-center tracking-widest">Weekly Amortization Breakdown</Text>
                                <View className="flex-row justify-between mb-2">
                                    <Text className="text-gray-600 text-xs">Weekly Principal (Prin / Terms)</Text>
                                    <Text className="font-bold text-gray-900 text-xs">{formatPHP(effectivePrincipal / (calcResult?.numPayments || 1))}</Text>
                                </View>
                                <View className="flex-row justify-between mb-2">
                                    <Text className="text-gray-600 text-xs">Weekly Interest (Total Int / Terms)</Text>
                                    <Text className="font-bold text-gray-900 text-xs">{formatPHP((calcResult?.totalInterest || 0) / (calcResult?.numPayments || 1))}</Text>
                                </View>
                                <View className="flex-row justify-between mb-2">
                                    <Text className="text-gray-600 text-xs">Weekly Savings (1% of Prin)</Text>
                                    <Text className="font-bold text-gray-900 text-xs">{formatPHP(effectivePrincipal * 0.01)}</Text>
                                </View>
                                <View className="flex-row justify-between mb-2">
                                    <Text className="text-gray-600 text-xs">LPF (Fixed)</Text>
                                    <Text className="font-bold text-gray-900 text-xs">{formatPHP(10)}</Text>
                                </View>
                                <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-200">
                                    <Text className="text-sm font-black text-gray-900">Total Weekly Amortization</Text>
                                    <Text className="text-sm font-black text-green-700">
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

                    <CalculationBasisCard interestType={watchedFields.interestType} />
                </View>
            )}

            <View className="flex-row mb-10">
                <Pressable
                    testID="save-draft-loan-button"
                    className="flex-1 bg-white border border-blue-900 py-4 rounded-xl items-center mr-2 active:bg-gray-50"
                    onPress={() => submitLoan('pending')}
                    disabled={saving}
                >
                    <Text className="text-blue-900 font-bold text-lg">Save Draft</Text>
                </Pressable>
                <Pressable
                    testID="disburse-loan-button"
                    className={`flex-1 flex-row py-4 rounded-xl items-center justify-center ml-2 ${saving ? 'bg-green-400' : 'bg-yellow-500 active:bg-green-800'}`}
                    onPress={() => submitLoan('active')}
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : (
                        <>
                            <MaterialIcons name="local-atm" size={20} color="#fff" className="mr-2" />
                            <Text className="text-white font-bold text-lg">Disburse</Text>
                        </>
                    )}
                </Pressable>
            </View>
            <AuditReportDialog
                visible={showAudit}
                issues={auditIssues}
                onCancel={() => {
                    setShowAudit(false);
                    setSaving(false);
                }}
                onConfirm={() => {
                    if (pendingData) {
                        performSave(pendingData.data, pendingData.status);
                    }
                }}
                isSaving={saving}
            />
        </ScrollView>
    );
}
