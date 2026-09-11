export type ActiveLoanCandidate = {
    id?: string | null;
    status?: string | null;
    loanType?: string | null;
};

export function normalizeLoanType(loanType?: string | null): string {
    const normalized = loanType?.trim();
    return normalized && normalized.length > 0 ? normalized : 'standard';
}

export function isSameLoanType(a?: string | null, b?: string | null): boolean {
    return normalizeLoanType(a) === normalizeLoanType(b);
}

export function isLoanActive(status?: string | null): boolean {
    const s = (status || '').trim().toLowerCase();
    return s === 'active' || s === 'unpaid' || s === 'partial' || s === 'defaulted';
}

export function isLoanPaid(status?: string | null): boolean {
    const s = (status || '').trim().toLowerCase();
    return s === 'paid' || s === 'completed' || s === 'settled';
}

export function findActiveLoanForType<T extends ActiveLoanCandidate>(
    loans: T[],
    loanType?: string | null,
    excludeLoanId?: string | null
): T | undefined {
    return loans.find(loan =>
        isLoanActive(loan.status)
        && (!excludeLoanId || loan.id !== excludeLoanId)
        && isSameLoanType(loan.loanType, loanType)
    );
}
