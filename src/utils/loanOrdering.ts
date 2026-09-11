type LoanOrderable = {
    id?: string;
    loanNumber?: string | null;
    releaseDate?: Date | number | string | null;
};

const missingReleaseDate = Number.MAX_SAFE_INTEGER;

function releaseDateTime(value: LoanOrderable['releaseDate']): number {
    if (value instanceof Date) {
        const time = value.getTime();
        return Number.isFinite(time) ? time : missingReleaseDate;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : missingReleaseDate;
    }

    if (typeof value === 'string' && value.trim()) {
        const time = new Date(value).getTime();
        return Number.isFinite(time) ? time : missingReleaseDate;
    }

    return missingReleaseDate;
}

export function compareLoansChronologically(a: LoanOrderable, b: LoanOrderable): number {
    const releaseDateDiff = releaseDateTime(a.releaseDate) - releaseDateTime(b.releaseDate);
    if (releaseDateDiff !== 0) return releaseDateDiff;

    const loanNumberDiff = (a.loanNumber || '').localeCompare(b.loanNumber || '', undefined, {
        numeric: true,
        sensitivity: 'base',
    });
    if (loanNumberDiff !== 0) return loanNumberDiff;

    return (a.id || '').localeCompare(b.id || '');
}

export function sortLoansChronologically<T extends LoanOrderable>(loans: readonly T[]): T[] {
    return [...loans].sort(compareLoansChronologically);
}
