import { findActiveLoanForType, isSameLoanType, normalizeLoanType } from '../activeLoanPolicy';

describe('activeLoanPolicy', () => {
    it('normalizes missing loan types to standard', () => {
        expect(normalizeLoanType()).toBe('standard');
        expect(normalizeLoanType(null)).toBe('standard');
        expect(normalizeLoanType('')).toBe('standard');
        expect(normalizeLoanType('  ')).toBe('standard');
    });

    it('matches active loans only within the same loan type', () => {
        const loans = [
            { id: 'standard-active', status: 'active', loanType: 'standard' },
            { id: 'pension-active', status: 'active', loanType: 'pension' },
        ];

        expect(findActiveLoanForType(loans, 'pension')?.id).toBe('pension-active');
        expect(findActiveLoanForType(loans, 'cash_advance')).toBeUndefined();
    });

    it('allows multiple active loans for a borrower when loan types differ', () => {
        expect(isSameLoanType('standard', 'pension')).toBe(false);
        expect(isSameLoanType('salary_regular', 'salary_regular')).toBe(true);
    });

    it('excludes the loan currently being edited', () => {
        const loans = [
            { id: 'editing-loan', status: 'active', loanType: 'standard' },
        ];

        expect(findActiveLoanForType(loans, 'standard', 'editing-loan')).toBeUndefined();
    });
});
