import { computeDocumentaryStamp, DOCUMENTARY_STAMP_RATE } from '../documentaryStamp';

describe('documentaryStamp', () => {
    it('computes DST as 0.75% of loan amount', () => {
        expect(computeDocumentaryStamp(10042.85)).toEqual({
            principal: 10042.85,
            rate: DOCUMENTARY_STAMP_RATE,
            amount: 75.32,
            source: '04-APR 2026 DST sample rate: loan amount × 0.75%',
        });
        expect(computeDocumentaryStamp(43062.2).amount).toBe(322.97);
        expect(computeDocumentaryStamp(50952.08).amount).toBe(382.14);
    });

    it('guards invalid inputs', () => {
        expect(computeDocumentaryStamp(Number.NaN).amount).toBe(0);
        expect(computeDocumentaryStamp(-1000).amount).toBe(0);
    });
});

