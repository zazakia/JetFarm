import { sortLoansChronologically } from '../loanOrdering';

describe('loanOrdering utility', () => {
    it('sorts loans from first release date to last release date', () => {
        const loans = [
            { id: 'newer-active', loanNumber: 'LN-20260417-148', releaseDate: new Date('2026-04-17'), status: 'active' },
            { id: 'older-paid', loanNumber: 'LN-20260328-0378', releaseDate: new Date('2026-03-28'), status: 'paid' },
            { id: 'middle-paid', loanNumber: 'LN-20260401-001', releaseDate: new Date('2026-04-01'), status: 'paid' },
        ];

        expect(sortLoansChronologically(loans).map(loan => loan.loanNumber)).toEqual([
            'LN-20260328-0378',
            'LN-20260401-001',
            'LN-20260417-148',
        ]);
    });

    it('uses loan number as a tie-breaker for loans released on the same date', () => {
        const loans = [
            { id: 'b', loanNumber: 'LN-20260328-2097', releaseDate: 1774627200000 },
            { id: 'a', loanNumber: 'LN-20260328-0378', releaseDate: 1774627200000 },
        ];

        expect(sortLoansChronologically(loans).map(loan => loan.loanNumber)).toEqual([
            'LN-20260328-0378',
            'LN-20260328-2097',
        ]);
    });

    it('does not mutate the source array', () => {
        const loans = [
            { id: '2', loanNumber: 'LN-2', releaseDate: 2 },
            { id: '1', loanNumber: 'LN-1', releaseDate: 1 },
        ];

        sortLoansChronologically(loans);

        expect(loans.map(loan => loan.id)).toEqual(['2', '1']);
    });

    // --- Additional branch coverage ---

    it('handles string releaseDate (ISO string format)', () => {
        const loans = [
            { id: 'b', loanNumber: 'LN-B', releaseDate: '2026-04-17T00:00:00.000Z' },
            { id: 'a', loanNumber: 'LN-A', releaseDate: '2026-03-01T00:00:00.000Z' },
        ];
        expect(sortLoansChronologically(loans).map(l => l.id)).toEqual(['a', 'b']);
    });

    it('treats invalid string releaseDate as MAX (sorts to end)', () => {
        const loans = [
            { id: 'valid', loanNumber: 'LN-1', releaseDate: '2026-01-01' },
            { id: 'invalid', loanNumber: 'LN-2', releaseDate: 'not-a-date' },
        ];
        expect(sortLoansChronologically(loans).map(l => l.id)).toEqual(['valid', 'invalid']);
    });

    it('treats null/undefined releaseDate as MAX (sorts to end)', () => {
        const loans = [
            { id: 'no-date', loanNumber: 'LN-2', releaseDate: null },
            { id: 'has-date', loanNumber: 'LN-1', releaseDate: 1000 },
        ];
        expect(sortLoansChronologically(loans).map(l => l.id)).toEqual(['has-date', 'no-date']);
    });

    it('treats non-finite number releaseDate as MAX', () => {
        const loans = [
            { id: 'inf', loanNumber: 'LN-2', releaseDate: Infinity },
            { id: 'finite', loanNumber: 'LN-1', releaseDate: 1000 },
        ];
        expect(sortLoansChronologically(loans).map(l => l.id)).toEqual(['finite', 'inf']);
    });

    it('treats invalid Date object as MAX', () => {
        const loans = [
            { id: 'bad-date', loanNumber: 'LN-2', releaseDate: new Date('invalid') },
            { id: 'good-date', loanNumber: 'LN-1', releaseDate: new Date('2026-01-01') },
        ];
        expect(sortLoansChronologically(loans).map(l => l.id)).toEqual(['good-date', 'bad-date']);
    });

    it('uses id as final tie-breaker when releaseDate and loanNumber are equal', () => {
        const loans = [
            { id: 'z-id', loanNumber: 'LN-SAME', releaseDate: 5000 },
            { id: 'a-id', loanNumber: 'LN-SAME', releaseDate: 5000 },
        ];
        expect(sortLoansChronologically(loans).map(l => l.id)).toEqual(['a-id', 'z-id']);
    });

    it('handles missing loanNumber or missing id in tie-breaker', () => {
        const loans = [
            { id: 'b-id', loanNumber: undefined as any, releaseDate: 5000 },
            { id: 'a-id', loanNumber: 'LN-A', releaseDate: 5000 },
        ];
        expect(sortLoansChronologically(loans).map(l => l.id)).toEqual(['b-id', 'a-id']);

        const loans2 = [
            { id: undefined as any, loanNumber: 'LN-SAME', releaseDate: 5000 },
            { id: 'a-id', loanNumber: 'LN-SAME', releaseDate: 5000 },
        ];
        expect(sortLoansChronologically(loans2).map(l => l.id)).toEqual([undefined, 'a-id']);

        const loans3 = [
            { id: undefined as any, loanNumber: undefined as any, releaseDate: 5000 },
            { id: undefined as any, loanNumber: undefined as any, releaseDate: 5000 },
        ];
        expect(sortLoansChronologically(loans3)).toEqual(loans3);
    });
});
