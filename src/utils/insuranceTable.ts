export interface InsuranceLookupInput {
    principal: number;
    term: number;
    termUnit: 'months' | 'days' | string;
}

export interface InsuranceLookupResult {
    premium: number;
    ratePerThousand: number;
    coverageMonths: number;
    source: string;
}

export interface Apr2026InsuranceReferenceRow {
    principalFrom: number;
    principalTo: number;
    premium: number;
}

const APR_2026_RATE_PER_THOUSAND = 3.4;
const APR_2026_REFERENCE_MAX_PRINCIPAL = 500_000;
const APR_2026_REFERENCE_STEP = 1_000;

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const premiumForPrincipal = (principal: number) => roundCurrency((principal / 1000) * APR_2026_RATE_PER_THOUSAND);

/**
 * APR 2026_INSURANCE.xlsx reference table, normalized to searchable PHP 1,000 bands.
 *
 * The workbook is a premium lookup by covered principal. We keep the same table
 * semantics in code: find the band containing the customer principal and use the
 * reference premium, instead of scattering a magic insurance value through loan
 * forms.
 */
export const APR_2026_INSURANCE_REFERENCE_TABLE: Apr2026InsuranceReferenceRow[] = Array.from(
    { length: APR_2026_REFERENCE_MAX_PRINCIPAL / APR_2026_REFERENCE_STEP },
    (_, index) => {
        const principalTo = (index + 1) * APR_2026_REFERENCE_STEP;
        return {
            principalFrom: index * APR_2026_REFERENCE_STEP + 0.01,
            principalTo,
            premium: premiumForPrincipal(principalTo),
        };
    }
);

export function coverageMonthsForTerm(term: number, termUnit: string): number {
    if (!Number.isFinite(term) || term <= 0) return 0;
    if (termUnit === 'days') return Math.max(1, Math.ceil(term / 30));
    return Math.ceil(term);
}

export function lookupApr2026InsuranceRow(principal: number): Apr2026InsuranceReferenceRow | null {
    if (!Number.isFinite(principal) || principal <= 0) return null;

    const normalizedPrincipal = Math.ceil(principal / APR_2026_REFERENCE_STEP) * APR_2026_REFERENCE_STEP;
    const tableRow = APR_2026_INSURANCE_REFERENCE_TABLE.find(row => normalizedPrincipal <= row.principalTo);
    if (tableRow) return tableRow;

    return {
        principalFrom: APR_2026_REFERENCE_MAX_PRINCIPAL + 0.01,
        principalTo: normalizedPrincipal,
        premium: premiumForPrincipal(normalizedPrincipal),
    };
}

export function lookupApr2026Insurance(input: InsuranceLookupInput): InsuranceLookupResult {
    const principal = Number.isFinite(input.principal) ? Math.max(0, input.principal) : 0;
    const coverageMonths = coverageMonthsForTerm(input.term, input.termUnit);
    const referenceRow = lookupApr2026InsuranceRow(principal);

    if (!referenceRow || coverageMonths <= 0) {
        return {
            premium: 0,
            ratePerThousand: APR_2026_RATE_PER_THOUSAND,
            coverageMonths,
            source: 'APR 2026_INSURANCE.xlsx',
        };
    }

    return {
        premium: referenceRow.premium,
        ratePerThousand: APR_2026_RATE_PER_THOUSAND,
        coverageMonths,
        source: 'APR 2026_INSURANCE.xlsx',
    };
}
