import { Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import CashTransaction from '../database/models/CashTransaction';

export interface CashDenominations {
    p1000: number;
    p500: number;
    p200: number;
    p100: number;
    p50: number;
    p20: number;
    coins: number;
}

export interface ShiftSummaryInput {
    branchId: string;
    cashierId: string;
    openingFloat: number;
    grossSales: number;
    cashSales: number;
    nonCashSales: number;
    totalDrops: number;
    orderCount: number;
}

export interface XReadingReport {
    branchId: string;
    cashierId: string;
    timestamp: Date;
    openingFloat: number;
    grossSales: number;
    cashSales: number;
    nonCashSales: number;
    totalDrops: number;
    expectedDrawerCash: number;
    orderCount: number;
}

export interface ZReadingReport extends XReadingReport {
    actualCashCount: number;
    variance: number;
    varianceStatus: 'exact' | 'over' | 'short';
    breakdown: CashDenominations;
}

export class ShiftCashService {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    /**
     * Calculates the total value in PHP from the counted cash denominations.
     */
    static calculateCashDenominationTotal(breakdown: CashDenominations): number {
        const total =
            (breakdown.p1000 || 0) * 1000 +
            (breakdown.p500 || 0) * 500 +
            (breakdown.p200 || 0) * 200 +
            (breakdown.p100 || 0) * 100 +
            (breakdown.p50 || 0) * 50 +
            (breakdown.p20 || 0) * 20 +
            (breakdown.coins || 0);

        return Number(total.toFixed(2));
    }

    /**
     * Generates a non-resetting mid-shift X-Reading report.
     */
    static generateXReading(input: ShiftSummaryInput): XReadingReport {
        const expectedDrawerCash = Number(
            (input.openingFloat + input.cashSales - input.totalDrops).toFixed(2)
        );

        return {
            branchId: input.branchId,
            cashierId: input.cashierId,
            timestamp: new Date(),
            openingFloat: Number(input.openingFloat.toFixed(2)),
            grossSales: Number(input.grossSales.toFixed(2)),
            cashSales: Number(input.cashSales.toFixed(2)),
            nonCashSales: Number(input.nonCashSales.toFixed(2)),
            totalDrops: Number(input.totalDrops.toFixed(2)),
            expectedDrawerCash,
            orderCount: input.orderCount,
        };
    }

    /**
     * Computes the final shift Z-Reading with denomination count and over/short variance.
     */
    static computeZReading(input: ShiftSummaryInput, breakdown: CashDenominations): ZReadingReport {
        const xReading = this.generateXReading(input);
        const actualCashCount = this.calculateCashDenominationTotal(breakdown);
        const variance = Number((actualCashCount - xReading.expectedDrawerCash).toFixed(2));

        let varianceStatus: 'exact' | 'over' | 'short' = 'exact';
        if (variance > 0.009) {
            varianceStatus = 'over';
        } else if (variance < -0.009) {
            varianceStatus = 'short';
        }

        return {
            ...xReading,
            actualCashCount,
            variance,
            varianceStatus,
            breakdown,
        };
    }

    /**
     * Records the opening shift float in the Cash Register.
     */
    async openShift(branchId: string, cashierId: string, openingFloat: number, notes?: string): Promise<string> {
        if (openingFloat < 0) {
            throw new Error('Opening float cannot be negative');
        }

        let createdId = '';
        let posSessionId = '';

        await this.db.write(async () => {
            try {
                const sessionColl = this.db.get<any>('pos_sessions');
                if (sessionColl?.create) {
                    const session = await sessionColl.create((s: any) => {
                        s.branchId = branchId;
                        s.cashierId = cashierId;
                        s.openedAt = new Date();
                        s.openingFloat = openingFloat;
                        s.status = 'open';
                        s.notes = notes || null;
                    });
                    posSessionId = session.id;
                }
            } catch {}

            const cashCollection = this.db.get<CashTransaction>('cash_transactions');
            const rec = await cashCollection.create((r) => {
                r.amount = openingFloat;
                r.type = 'in';
                (r as any).branchId = branchId;
                if (posSessionId) {
                    (r as any).posSessionId = posSessionId;
                }
                r.particulars = `Opening Float — ${branchId} (${notes || 'Cashier Shift Start'})`;
                r.remarks = 'Opening Float';
                r.recordedBy = cashierId;
                r.transactionDate = Date.now();
            });
            createdId = rec.id;
        });

        return createdId;
    }

    /**
     * Records a mid-shift cash drop to the store safe.
     */
    async recordCashDrop(branchId: string, cashierId: string, amount: number, reason: string, posSessionId?: string): Promise<string> {
        if (amount <= 0) {
            throw new Error('Cash drop amount must be greater than zero');
        }

        let createdId = '';
        await this.db.write(async () => {
            const cashCollection = this.db.get<CashTransaction>('cash_transactions');
            const rec = await cashCollection.create((r) => {
                r.amount = amount;
                r.type = 'out';
                (r as any).branchId = branchId;
                if (posSessionId) {
                    (r as any).posSessionId = posSessionId;
                }
                r.particulars = `Safe Drop: ₱${amount.toFixed(2)} — ${reason} (${branchId})`;
                r.remarks = 'Cash Drop to Safe';
                r.recordedBy = cashierId;
                r.transactionDate = Date.now();
            });
            createdId = rec.id;
        });

        return createdId;
    }

    /**
     * Blind shift closing: Cashier inputs cash drawer denominations without viewing expected target.
     * Prevents reconciliation manipulation and enforces anti-fraud controls.
     */
    async blindCloseShift(
        sessionId: string,
        breakdown: CashDenominations,
        supervisorWitness?: string,
        shiftSummary?: ShiftSummaryInput
    ): Promise<ZReadingReport> {
        const actualCashCount = ShiftCashService.calculateCashDenominationTotal(breakdown);

        let report: ZReadingReport;
        if (shiftSummary) {
            report = ShiftCashService.computeZReading(shiftSummary, breakdown);
        } else {
            report = {
                branchId: 'default',
                cashierId: 'default',
                timestamp: new Date(),
                openingFloat: 0,
                grossSales: 0,
                cashSales: 0,
                nonCashSales: 0,
                totalDrops: 0,
                expectedDrawerCash: 0,
                orderCount: 0,
                actualCashCount,
                variance: actualCashCount,
                varianceStatus: actualCashCount === 0 ? 'exact' : actualCashCount > 0 ? 'over' : 'short',
                breakdown,
            };
        }

        await this.db.write(async () => {
            try {
                const sessionColl = this.db.get<any>('pos_sessions');
                if (sessionColl?.find) {
                    const session = await sessionColl.find(sessionId);
                    if (session) {
                        await session.update((s: any) => {
                            s.closedAt = new Date();
                            s.closingCashActual = actualCashCount;
                            s.closingCashExpected = report.expectedDrawerCash;
                            s.varianceAmount = report.variance;
                            s.status = 'closed';
                            if (supervisorWitness) {
                                s.notes = `${s.notes ? s.notes + ' | ' : ''}Witnessed by: ${supervisorWitness}`;
                            }
                        });
                    }
                }
            } catch {}
        });

        return report;
    }
}
