import { Database } from '@nozbe/watermelondb';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { SalesJournalService } from '../SalesJournalService';
import { JournalEntryService } from '../JournalEntryService';
import { ChartOfAccountsService } from '../ChartOfAccountsService';

/**
 * The Sales Journal is a ledger view: it reads journal entries, so it no longer needs the
 * marketplace posting service that originally produced its rows. These tests post entries
 * directly, which is how agribusiness harvest settlements and manual credit sales reach the SJ.
 */
describe('SalesJournalService', () => {
    let database: Database;

    beforeEach(async () => {
        database = createTestDatabase();
        (SalesJournalService as any).db = database;
        (JournalEntryService as any).db = database;
        (ChartOfAccountsService as any).db = database;
        await ChartOfAccountsService.seed('TestUser');
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    const postSale = async (input: {
        id: string;
        date: Date;
        referenceNumber: string;
        arCode?: string;
        incomeCode?: string;
        amount: number;
        businessUnitId?: string | null;
        isPosted?: boolean;
        sourceId?: string | null;
    }) => {
        await database.write(async () => {
            await database.get('journal_entries').create((je: any) => {
                je._raw.id = input.id;
                je.entryDate = input.date;
                je.referenceNumber = input.referenceNumber;
                je.description = `Credit sale ${input.referenceNumber}`;
                je.entryType = 'manual';
                je.sourceTable = 'agri_harvest_logs';
                je.sourceId = input.sourceId ?? input.id;
                je.postedBy = 'TestUser';
                je.isPosted = input.isPosted ?? true;
                je.totalDebit = input.amount;
                je.totalCredit = input.amount;
                je.fiscalYear = input.date.getFullYear();
                je.fiscalMonth = input.date.getMonth() + 1;
                je.deletedAt = null;
            });
            const lines = [
                { code: input.arCode ?? '1500', debit: input.amount, credit: 0 },
                { code: input.incomeCode ?? '4140', debit: 0, credit: input.amount },
            ];
            for (const line of lines) {
                await database.get('journal_entry_lines').create((jl: any) => {
                    jl.journalEntryId = input.id;
                    jl.accountCode = line.code;
                    jl.accountName = null;
                    jl.debitAmount = line.debit;
                    jl.creditAmount = line.credit;
                    jl.description = null;
                    jl.businessUnitId = input.businessUnitId ?? null;
                    jl.moduleSourceTable = null;
                    jl.moduleSourceId = null;
                    jl.deletedAt = null;
                });
            }
        });
    };

    it('registers credit sales inside the period', async () => {
        await postSale({
            id: 'sj-1',
            date: new Date(2026, 0, 12),
            referenceNumber: 'INV-2026-0001',
            amount: 2500,
        });

        const summary = await SalesJournalService.getReport(new Date(2026, 0, 1), new Date(2026, 0, 31));

        expect(summary.rows).toHaveLength(1);
        expect(summary.totalARDebit).toBe(2500);
        expect(summary.totalSalesCredit).toBe(2500);
        expect(summary.rows[0].referenceNumber).toBe('INV-2026-0001');
        expect(summary.rows[0].sourceId).toBe('sj-1');
        expect(summary.rows[0].arAccountCode).toBe('1500');
        expect(summary.rows[0].salesAccountCode).toBe('4140');
        expect(summary.rows[0].sourceType).toBe('agri_harvest_logs');
    });

    it('skips entries outside the requested window', async () => {
        await postSale({ id: 'sj-in', date: new Date(2026, 0, 15), referenceNumber: 'INV-IN', amount: 1000 });
        await postSale({ id: 'sj-out', date: new Date(2026, 1, 5), referenceNumber: 'INV-OUT', amount: 4000 });

        const summary = await SalesJournalService.getReport(new Date(2026, 0, 1), new Date(2026, 0, 31));

        expect(summary.rows.map(r => r.referenceNumber)).toEqual(['INV-IN']);
        expect(summary.totalARDebit).toBe(1000);
    });

    it('skips unposted drafts', async () => {
        await postSale({
            id: 'sj-draft',
            date: new Date(2026, 0, 15),
            referenceNumber: 'INV-DRAFT',
            amount: 3000,
            isPosted: false,
        });

        const summary = await SalesJournalService.getReport(new Date(2026, 0, 1), new Date(2026, 0, 31));
        expect(summary.rows).toHaveLength(0);
        expect(summary.totalSalesCredit).toBe(0);
    });

    it('skips cash sales because no receivable is debited', async () => {
        await postSale({
            id: 'sj-cash',
            date: new Date(2026, 0, 15),
            referenceNumber: 'INV-CASH',
            amount: 1800,
            arCode: '1010',
        });

        const summary = await SalesJournalService.getReport(new Date(2026, 0, 1), new Date(2026, 0, 31));
        expect(summary.rows).toHaveLength(0);
    });

    it('filters by business unit when asked', async () => {
        await postSale({
            id: 'sj-a',
            date: new Date(2026, 0, 10),
            referenceNumber: 'INV-A',
            amount: 1000,
            businessUnitId: 'bu-agri',
        });
        await postSale({
            id: 'sj-b',
            date: new Date(2026, 0, 11),
            referenceNumber: 'INV-B',
            amount: 2000,
            businessUnitId: 'bu-other',
        });

        const filtered = await SalesJournalService.getReport(
            new Date(2026, 0, 1),
            new Date(2026, 0, 31),
            'bu-agri'
        );
        const all = await SalesJournalService.getReport(new Date(2026, 0, 1), new Date(2026, 0, 31));

        expect(filtered.rows.map(r => r.entryId)).toEqual(['sj-a']);
        expect(all.rows).toHaveLength(2);
    });
});
