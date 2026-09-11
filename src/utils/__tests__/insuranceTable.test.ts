import { APR_2026_INSURANCE_REFERENCE_TABLE, coverageMonthsForTerm, lookupApr2026Insurance, lookupApr2026InsuranceRow } from '../insuranceTable';

describe('insuranceTable', () => {
    it('matches the APR 2026 table baseline used by existing defaults', () => {
        expect(lookupApr2026Insurance({ principal: 5000, term: 6, termUnit: 'months' })).toEqual({
            premium: 17,
            ratePerThousand: 3.4,
            coverageMonths: 6,
            source: 'APR 2026_INSURANCE.xlsx',
        });
    });

    it('uses APR 2026_INSURANCE.xlsx reference rows by principal band', () => {
        expect(APR_2026_INSURANCE_REFERENCE_TABLE).toHaveLength(500);
        expect(lookupApr2026InsuranceRow(1)).toEqual({ principalFrom: 0.01, principalTo: 1000, premium: 3.4 });
        expect(lookupApr2026InsuranceRow(12500)).toEqual({ principalFrom: 12000.01, principalTo: 13000, premium: 44.2 });
    });

    it('handles principal exceeding the reference table maximum principal', () => {
        expect(lookupApr2026InsuranceRow(600000)).toEqual({
            principalFrom: 500000.01,
            principalTo: 600000,
            premium: (600000 / 1000) * 3.4
        });
    });

    it('rounds currency and normalizes day terms to coverage months', () => {
        expect(coverageMonthsForTerm(40, 'days')).toBe(2);
        expect(lookupApr2026Insurance({ principal: 12500, term: 40, termUnit: 'days' }).premium).toBe(44.2);
    });

    it('returns zero premium for incomplete or invalid loan inputs', () => {
        expect(lookupApr2026Insurance({ principal: Number.NaN, term: 6, termUnit: 'months' }).premium).toBe(0);
        expect(lookupApr2026Insurance({ principal: 5000, term: 0, termUnit: 'months' }).premium).toBe(0);
        expect(lookupApr2026Insurance({ principal: -5000, term: 6, termUnit: 'months' }).premium).toBe(0);
    });
});
