import { InstitutionalLoanType } from '../services/LoanCalculatorService';
import { COMPANY_NAME } from '../constants/brand';

export type LoanProductType = 'standard' | InstitutionalLoanType;
export type SalaryEmploymentType = 'regular' | 'contractual';

export interface LoanProductPreset {
    label: string;
    description: string;
    defaultRatePercent: string;
    defaultTerm: string;
    defaultTermUnit: 'months' | 'days' | 'weeks';
    defaultFrequency: 'daily' | 'weekly' | 'bi_monthly' | 'monthly';
    defaultProcessingFeeRate: number;
    defaultProcessingFeeFlat?: number;
    defaultNotarialFee: string;
    notarialFeeThreshold?: number;
    notarialFeeAboveThreshold?: number;
    defaultSavingsPerPayment: string;
    defaultPrincipal?: string;
    maxPrincipal?: number;
    minTermMonths?: number;
    maxTermMonths?: number;
    isActive?: boolean;
}

export const LOAN_PRODUCT_PRESETS: Record<LoanProductType, LoanProductPreset> = {
    standard: {
        label: 'Standard Micro Loan',
        description: 'Standard flat computation.',
        defaultRatePercent: '20',
        defaultTerm: '20',
        defaultTermUnit: 'weeks',
        defaultFrequency: 'weekly',
        defaultProcessingFeeRate: 0,
        defaultNotarialFee: '0',
        defaultSavingsPerPayment: '0',
    },
    petty_cash: {
        label: 'Petty Cash Loan',
        description: '75% of share capital, 0% interest, 2% service charge, 1 month term.',
        defaultRatePercent: '0',
        defaultTerm: '1',
        defaultTermUnit: 'months',
        defaultFrequency: 'monthly',
        defaultProcessingFeeRate: 0.02,
        defaultNotarialFee: '0',
        defaultSavingsPerPayment: '0',
    },
    livelihood: {
        label: 'Livelihood Loan',
        description: 'For self-employed, 2% interest per month, 2% service charge, 2 months term.',
        defaultRatePercent: '2',
        defaultTerm: '2',
        defaultTermUnit: 'months',
        defaultFrequency: 'monthly',
        defaultProcessingFeeRate: 0.02,
        defaultNotarialFee: '0',
        defaultSavingsPerPayment: '0',
    },
    salary: {
        label: 'Salary Loan',
        description: 'For employed members, 2% interest per month, 2% service charge, 2 months term.',
        defaultRatePercent: '2',
        defaultTerm: '2',
        defaultTermUnit: 'months',
        defaultFrequency: 'monthly',
        defaultProcessingFeeRate: 0.02,
        defaultNotarialFee: '0',
        defaultSavingsPerPayment: '0',
    },
    emergency: {
        label: 'Emergency Loan',
        description: 'For urgent needs, 0% interest, 2% service charge, 1 month term.',
        defaultRatePercent: '0',
        defaultTerm: '1',
        defaultTermUnit: 'months',
        defaultFrequency: 'monthly',
        defaultProcessingFeeRate: 0.02,
        defaultNotarialFee: '0',
        defaultSavingsPerPayment: '0',
    },
};

let runtimeLoanProductPresets: Record<LoanProductType, LoanProductPreset> = LOAN_PRODUCT_PRESETS;

export function setRuntimeLoanProductPresets(presets: Partial<Record<LoanProductType, LoanProductPreset>>) {
    runtimeLoanProductPresets = { ...LOAN_PRODUCT_PRESETS, ...presets };
}

export function getLoanProductPresets(): Record<LoanProductType, LoanProductPreset> {
    return runtimeLoanProductPresets;
}

export function getLoanProductPreset(type?: string): LoanProductPreset {
    return runtimeLoanProductPresets[(type as LoanProductType) || 'standard'] ?? runtimeLoanProductPresets.standard;
}

export function isInstitutionalLoanType(type?: string): type is InstitutionalLoanType {
    return type === 'petty_cash'
        || type === 'livelihood'
        || type === 'salary'
        || type === 'emergency';
}

export function loanProductLabel(type?: string): string {
    return getLoanProductPreset(type)?.label ?? 'Standard Micro Loan';
}

export function processingFeeFromPrincipal(loanType: LoanProductType, principal: number): number {
    const preset = getLoanProductPreset(loanType);
    if (typeof preset.defaultProcessingFeeFlat === 'number') {
        return preset.defaultProcessingFeeFlat;
    }
    return Math.round((principal * preset.defaultProcessingFeeRate) * 100) / 100;
}

export function notarialFeeFromPrincipal(loanType: LoanProductType, principal: number): number {
    const preset = getLoanProductPreset(loanType);
    if (
        typeof preset.notarialFeeThreshold === 'number'
        && typeof preset.notarialFeeAboveThreshold === 'number'
        && principal > preset.notarialFeeThreshold
    ) {
        return preset.notarialFeeAboveThreshold;
    }

    const notarialFee = parseFloat(preset.defaultNotarialFee || '0');
    return Number.isFinite(notarialFee) ? notarialFee : 0;
}

export function loanProductTermRuleText(type?: string): string | null {
    const preset = getLoanProductPreset(type);
    if (!preset?.minTermMonths && !preset?.maxTermMonths) return null;

    if (preset.minTermMonths && preset.maxTermMonths) {
        return `${preset.label} term must be ${preset.minTermMonths}-${preset.maxTermMonths} months.`;
    }

    if (preset.minTermMonths) {
        return `${preset.label} term must be at least ${preset.minTermMonths} months.`;
    }

    return `${preset.label} term must be at most ${preset.maxTermMonths} months.`;
}

export function validateLoanProductTerm(
    type: string | undefined,
    term: string | number | undefined,
    termUnit: string | undefined
): string | null {
    const preset = getLoanProductPreset(type);
    if (!preset?.minTermMonths && !preset?.maxTermMonths) return null;

    const parsedTerm = typeof term === 'number' ? term : parseInt(term || '', 10);
    if (!Number.isFinite(parsedTerm) || parsedTerm <= 0) return null;

    if (termUnit !== 'months') {
        return `${preset.label} requires a monthly term. ${loanProductTermRuleText(type)}`;
    }

    if (preset.minTermMonths && parsedTerm < preset.minTermMonths) {
        return loanProductTermRuleText(type);
    }

    if (preset.maxTermMonths && parsedTerm > preset.maxTermMonths) {
        return loanProductTermRuleText(type);
    }

    return null;
}

export function validateLoanProductPrincipal(
    type: string | undefined,
    principal: string | number | undefined
): string | null {
    const preset = getLoanProductPreset(type);
    if (!preset?.maxPrincipal) return null;

    const parsedPrincipal = typeof principal === 'number' ? principal : parseFloat(principal || '');
    if (!Number.isFinite(parsedPrincipal) || parsedPrincipal <= 0) return null;

    if (parsedPrincipal > preset.maxPrincipal) {
        return `${preset.label} principal must not exceed ₱${preset.maxPrincipal.toLocaleString('en-PH')}.`;
    }

    return null;
}
