export const DOCUMENTARY_STAMP_RATE = 0.0075;

export interface DocumentaryStampResult {
    principal: number;
    rate: number;
    amount: number;
    source: string;
}

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

export function computeDocumentaryStamp(principal: number): DocumentaryStampResult {
    const normalizedPrincipal = Math.max(0, Number.isFinite(principal) ? principal : 0);
    return {
        principal: roundCurrency(normalizedPrincipal),
        rate: DOCUMENTARY_STAMP_RATE,
        amount: roundCurrency(normalizedPrincipal * DOCUMENTARY_STAMP_RATE),
        source: '04-APR 2026 DST sample rate: loan amount × 0.75%',
    };
}

