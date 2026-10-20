import { MonthlyClosingService } from '../MonthlyClosingService';
import { ConsolidationService } from '../ConsolidationService';
import FinancialSnapshot from '../../database/models/FinancialSnapshot';

// The service and ConsolidationService both read the `database` singleton, so a single
// module-level mock gives them the same LokiJS instance.
jest.mock('../../database', () => {
    const { createTestDatabase } = jest.requireActual('../../__tests__/test-utils');
    return { database: createTestDatabase() };
});

import { database } from '../../database';

type AccountSeed = {
    code: string;
    name: string;
    accountType: string;
    normalBalance: 'debit' | 'credit';
};

const ACCOUNTS: AccountSeed[] = [
    { code: '1010', name: 'Cash on Hand', accountType: 'asset', normalBalance: 'debit' },
    { code: '2010', name: 'Accounts Payable', accountType: 'liability', normalBalance: 'credit' },
    { code: '3060', name: 'Retained Surplus', accountType: 'equity', normalBalance: 'credit' },
    { code: '4000', name: 'Harvest Sales', accountType: 'income', normalBalance: 'credit' },
    { code: '5000', name: 'Labor Expense', accountType: 'expense', normalBalance: 'debit' },
];

/**
 * Ledger fixture. Two posted entries land in February, two in March, one March entry is left
 * unposted, so a wrong as-of window, a missing open-to-close subtraction, or a missing
 * `is_posted` filter all change the snapshot.
 *
 * As of 2024-03-31: cash = 5000 + 3000 - 1200 = 6800, cumulative income 8000, expense 1200.
 * March movement only: revenue 3000, cost 1200.
 */
async function seedLedger() {
    await database.write(async () => {
        for (const a of ACCOUNTS) {
            await database.get('chart_of_accounts').create((rec: any) => {
                rec.code = a.code;
                rec.name = a.name;
                rec.accountType = a.accountType;
                rec.normalBalance = a.normalBalance;
                rec.isHeader = false;
                rec.isActive = true;
                rec.parentCode = null;
                rec.description = null;
                rec.sortOrder = null;
                rec.updatedAt = new Date();
                rec.deletedAt = null;
            });
        }

        const post = async (
            id: string,
            entryDate: Date,
            lines: { code: string; debit?: number; credit?: number }[],
            isPosted = true
        ) => {
            await database.get('journal_entries').create((je: any) => {
                je._raw.id = id;
                je.entryDate = entryDate;
                je.referenceNumber = `JV-${id}`;
                je.description = 'fixture entry';
                je.entryType = 'manual';
                je.sourceTable = null;
                je.sourceId = null;
                je.postedBy = 'tester';
                je.isPosted = isPosted;
                je.totalDebit = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
                je.totalCredit = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
                je.fiscalYear = entryDate.getFullYear();
                je.fiscalMonth = entryDate.getMonth() + 1;
                je.updatedAt = new Date();
                je.deletedAt = null;
            });
            for (const line of lines) {
                await database.get('journal_entry_lines').create((jl: any) => {
                    jl.journalEntryId = id;
                    jl.accountCode = line.code;
                    jl.accountName = null;
                    jl.debitAmount = line.debit ?? 0;
                    jl.creditAmount = line.credit ?? 0;
                    jl.description = null;
                    jl.businessUnitId = null;
                    jl.moduleSourceTable = null;
                    jl.moduleSourceId = null;
                    jl.updatedAt = new Date();
                    jl.deletedAt = null;
                });
            }
        };

        await post('feb-1', new Date('2024-02-10T09:00:00Z'), [
            { code: '1010', debit: 5000 },
            { code: '4000', credit: 5000 },
        ]);
        await post('feb-2', new Date('2024-02-20T09:00:00Z'), [
            { code: '5000', debit: 400 },
            { code: '1010', credit: 400 },
        ]);
        await post('mar-1', new Date('2024-03-08T09:00:00Z'), [
            { code: '1010', debit: 3000 },
            { code: '4000', credit: 3000 },
        ]);
        await post('mar-2', new Date('2024-03-18T09:00:00Z'), [
            { code: '5000', debit: 1200 },
            { code: '1010', credit: 1200 },
        ]);
        // Ignored by every aggregation because is_posted is false.
        await post('mar-3', new Date('2024-03-28T09:00:00Z'), [
            { code: '1010', debit: 9999 },
            { code: '4000', credit: 9999 },
        ], false);
    });
}

async function clear(table: string) {
    await database.write(async () => {
        const rows = await database.get(table).query().fetch();
        for (const row of rows) await row.destroyPermanently();
    });
}

describe('MonthlyClosingService', () => {
    beforeEach(async () => {
        await clear('financial_snapshots');
        await clear('journal_entry_lines');
        await clear('journal_entries');
        await clear('chart_of_accounts');
        await seedLedger();
        jest.restoreAllMocks();
    });

    describe('closeMonth', () => {
        it('snapshots the ledger as of month end', async () => {
            const result = await MonthlyClosingService.closeMonth(new Date('2024-03-15'));

            expect(result).not.toBeNull();
            const snapshots = await database.get<FinancialSnapshot>('financial_snapshots').query().fetch();
            expect(snapshots).toHaveLength(1);

            const snapshot = snapshots[0];
            // The model types this as number but the @date decorator returns a Date at runtime.
            expect((snapshot.snapshotDate as unknown as Date).getTime()).toBe(new Date(2024, 2, 31, 23, 59, 59, 999).getTime());
            expect(snapshot.totalAssets).toBe(6400);
            expect(snapshot.totalLiabilities).toBe(0);
            // Equity absorbs the unclosed net surplus (8000 income - 1600 expense) so A = L + E.
            expect(snapshot.totalEquity).toBe(6400);
        });

        it('records only the closed month movement for revenue and cost', async () => {
            const result = await MonthlyClosingService.closeMonth(new Date('2024-03-15'));
            expect(result).not.toBeNull();

            const snapshot = await database.get<FinancialSnapshot>('financial_snapshots').query().fetch();
            // February posted 5000 of income and 400 of expense; the March snapshot must not carry them.
            expect(snapshot[0].operatingRevenue).toBe(3000);
            expect(snapshot[0].financialCosts).toBe(1200);
        });

        it('leaves the retired lending fields flat', async () => {
            const result = await MonthlyClosingService.closeMonth(new Date('2024-03-15'));
            expect(result).not.toBeNull();

            const snapshot = await database.get<FinancialSnapshot>('financial_snapshots').query().fetch();
            // Documentation assertion: credit operations are gone, so there is no provision to read
            // and no loan portfolio to weight. Only riskWeightedAssets === totalAssets is provable
            // against a mutation (multiply by a weight and it fails); loanLossReserve 0 has no
            // lending source left to misread it from.
            expect(snapshot[0].loanLossReserve).toBe(0);
            expect(snapshot[0].subsidyAdjustment).toBe(0);
            expect(snapshot[0].inflationAdjustment).toBe(0);
            expect(snapshot[0].riskWeightedAssets).toBe(snapshot[0].totalAssets);
        });

        it('returns null when the ledger read fails', async () => {
            jest.spyOn(ConsolidationService, 'getBalances').mockRejectedValue(new Error('ledger read failed'));
            const result = await MonthlyClosingService.closeMonth(new Date('2024-03-15'));
            expect(result).toBeNull();
        });
    });

    describe('isMonthClosed', () => {
        it('returns true once a snapshot exists for that month end', async () => {
            await MonthlyClosingService.closeMonth(new Date('2024-03-15'));
            await expect(MonthlyClosingService.isMonthClosed(new Date('2024-03-02'))).resolves.toBe(true);
        });

        it('returns false for an unclosed month', async () => {
            await MonthlyClosingService.closeMonth(new Date('2024-03-15'));
            await expect(MonthlyClosingService.isMonthClosed(new Date('2024-04-15'))).resolves.toBe(false);
        });
    });

    describe('getClosingHistory', () => {
        it('returns every snapshot', async () => {
            await MonthlyClosingService.closeMonth(new Date('2024-01-15'));
            await MonthlyClosingService.closeMonth(new Date('2024-02-15'));
            await expect(MonthlyClosingService.getClosingHistory()).resolves.toHaveLength(2);
        });
    });
});
