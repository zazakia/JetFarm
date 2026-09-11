import { JournalEntryService } from '../JournalEntryService';
import { ChartOfAccountsService } from '../ChartOfAccountsService';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';

describe('JournalEntryService', () => {
    let database: Database;
    let service: typeof JournalEntryService;

    beforeEach(async () => {
        database = createTestDatabase();
        service = JournalEntryService;
        (service as any).db = database;
        (ChartOfAccountsService as any).db = database;
        
        // Seed CoA so accounts exist
        await ChartOfAccountsService.seed('TestUser');
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('should prevent unbalanced journal entries', async () => {
        // Dr 1000, Cr 500 -> Unbalanced
        await expect(service.createEntry({
            entryDate: new Date(),
            description: 'Unbalanced payment',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 1000 },
                { accountCode: '1100', creditAmount: 500 },
            ]
        }, 'TestUser')).rejects.toThrow(/not balanced/);
    });

    it('should successfully post a balanced entry and generate reference number', async () => {
        const entry = await service.createEntry({
            entryDate: new Date(),
            description: 'Standard collection',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 1000, accountName: 'Cash' },
                { accountCode: '1100', creditAmount: 1000, accountName: 'Loans' },
            ]
        }, 'TestUser');

        expect(entry.referenceNumber).toMatch(/JE-\d{4}-\d{6}/);
        expect(entry.totalDebit).toBe(1000);
        expect(entry.totalCredit).toBe(1000);

        const details = await service.getEntryById(entry.id);
        expect(details?.lines.length).toBe(2);
    });

    it('should compute running ledger balances correctly', async () => {
        // Dr 1010 (Cash on Hand) 5000
        await service.createEntry({
            entryDate: new Date(2026, 0, 1),
            description: 'Opening cash',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 5000, accountName: 'Cash' },
                { accountCode: '3010', creditAmount: 5000, accountName: 'Equity' },
            ]
        }, 'TestUser');

        // Cr 1010 (Cash on Hand) 1500
        await service.createEntry({
            entryDate: new Date(2026, 0, 2),
            description: 'Expense paid',
            entryType: 'manual',
            lines: [
                { accountCode: '5010', debitAmount: 1500, accountName: 'Salaries' },
                { accountCode: '1010', creditAmount: 1500, accountName: 'Cash' },
            ]
        }, 'TestUser');

        const ledger = await service.getLedger('1010');
        expect(ledger.length).toBe(2);
        
        // Running balance for Cash (Debit normal): 5000 - 1500 = 3500
        expect(ledger[0].balance).toBe(5000);
        expect(ledger[1].balance).toBe(3500);

        const finalBalance = await service.getAccountBalance('1010', new Date());
        expect(finalBalance).toBe(3500);
    });

    it('should generate a balanced trial balance', async () => {
        await service.createEntry({
            entryDate: new Date(),
            description: 'Share capital contribution',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 10000 },
                { accountCode: '3010', creditAmount: 10000 },
            ]
        }, 'TestUser');

        const tb = await service.getTrialBalance(new Date());
        expect(tb.isBalanced).toBe(true);
        expect(tb.totalDebits).toBe(10000);
        expect(tb.totalCredits).toBe(10000);
        
        const cashRow = tb.rows.find(r => r.code === '1010');
        expect(cashRow?.netBalance).toBe(10000);
    });

    it('should prevent journal entries with fewer than 2 lines', async () => {
        // Use 0 amounts so balance check (0==0) passes; length check fires next
        await expect(
            service.createEntry({
                entryDate: new Date(),
                description: 'Single line entry',
                entryType: 'manual',
                lines: [
                    { accountCode: '1010', debitAmount: 0, creditAmount: 0 }
                ]
            }, 'TestUser')
        ).rejects.toThrow(/requires at least 2 lines/);
    });

    it('should successfully reverse an entry by swapping debits and credits', async () => {
        // Create initial entry: Dr Cash 1000, Cr Revenue 1000
        const entry = await service.createEntry({
            entryDate: new Date(),
            description: 'Original Sale',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 1000, accountName: 'Cash' },
                { accountCode: '4010', creditAmount: 1000, accountName: 'Interest' }
            ]
        }, 'TestUser');

        const reversal = await service.reverseEntry(entry.id, 'TestUser');
        expect(reversal).toBeDefined();
        expect(reversal.entryType).toBe('reversing');
        expect(reversal.description).toContain('Reversal of JE-');
        expect(reversal.totalDebit).toBe(1000);
        expect(reversal.totalCredit).toBe(1000);

        const lines = await service.getLinesForEntry(reversal.id);
        const cashLine = lines.find(l => l.accountCode === '1010');
        const revLine = lines.find(l => l.accountCode === '4010');

        // Original had Dr Cash and Cr Interest. Reversal should have Cr Cash and Dr Interest.
        expect(cashLine?.creditAmount).toBe(1000);
        expect(cashLine?.debitAmount).toBe(0);
        expect(revLine?.debitAmount).toBe(1000);
        expect(revLine?.creditAmount).toBe(0);
    });

    it('should throw when reversing a non-existent or unposted entry', async () => {
        await expect(
            service.reverseEntry('non-existent-id', 'TestUser')
        ).rejects.toThrow();
    });

    it('should return null for getEntryById when ID is not found or invalid', async () => {
        const found = await service.getEntryById('non-existent-id');
        expect(found).toBeNull();
    });

    it('should compute running balances correctly for credit-normal accounts (e.g. Income/Revenue)', async () => {
        // 4010 is Interest Income (Credit-normal)
        // Cr 4010 3000
        await service.createEntry({
            entryDate: new Date(2026, 0, 1),
            description: 'Interest earned',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 3000 },
                { accountCode: '4010', creditAmount: 3000 }
            ]
        }, 'TestUser');

        // Dr 4010 1000 (reversal or refund)
        await service.createEntry({
            entryDate: new Date(2026, 0, 2),
            description: 'Interest refund',
            entryType: 'manual',
            lines: [
                { accountCode: '4010', debitAmount: 1000 },
                { accountCode: '1010', creditAmount: 1000 }
            ]
        }, 'TestUser');

        const ledger = await service.getLedger('4010');
        expect(ledger.length).toBe(2);

        // Credit-normal increases with credits: 3000 - 1000 = 2000
        expect(ledger[0].balance).toBe(3000);
        expect(ledger[1].balance).toBe(2000);
    });

    it('should return empty list and zeroed totals for getTrialBalance if no postings exist', async () => {
        // Clear all entries from the test database
        const entries = await database.get('journal_entries').query().fetch();
        const lines = await database.get('journal_entry_lines').query().fetch();
        await database.write(async () => {
            const prepared = [
                ...entries.map(e => e.prepareDestroyPermanently()),
                ...lines.map(l => l.prepareDestroyPermanently())
            ];
            await database.batch(...prepared);
        });

        const tb = await service.getTrialBalance(new Date());
        expect(tb.isBalanced).toBe(true);
        expect(tb.totalDebits).toBe(0);
        expect(tb.totalCredits).toBe(0);
        expect(tb.rows.length).toBeGreaterThan(0);
        expect(tb.rows.every(r => r.totalDebit === 0 && r.totalCredit === 0)).toBe(true);
    });

    it('should correctly calculate total balance by account type in getTypeBalance', async () => {
        // Asset (1010) balance: Dr 5000, Cr 2000 -> net Dr 3000
        await service.createEntry({
            entryDate: new Date(),
            description: 'Asset transactions',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 5000 },
                { accountCode: '3010', creditAmount: 5000 }
            ]
        }, 'TestUser');

        await service.createEntry({
            entryDate: new Date(),
            description: 'Asset release',
            entryType: 'manual',
            lines: [
                { accountCode: '5010', debitAmount: 2000 },
                { accountCode: '1010', creditAmount: 2000 }
            ]
        }, 'TestUser');

        const totalAssets = await service.getTypeBalance('asset', new Date());
        // Cash (1010): 3000 (CDA standard seeds other asset accounts, but they have 0 balance)
        expect(totalAssets).toBe(3000);
    });

    it('should filter getEntries by date range, type, sourceTable, sourceId, limit, and skip', async () => {
        const jan1 = new Date(2026, 0, 1);
        const jan3 = new Date(2026, 0, 3);
        const jan5 = new Date(2026, 0, 5);

        // Entry 1: Jan 1, manual, source: payments/pay-1
        await service.createEntry({
            entryDate: jan1,
            description: 'E1',
            entryType: 'manual',
            sourceTable: 'payments',
            sourceId: 'pay-1',
            lines: [
                { accountCode: '1010', debitAmount: 100 },
                { accountCode: '4010', creditAmount: 100 }
            ]
        }, 'TestUser');

        // Entry 2: Jan 3, auto
        await service.createEntry({
            entryDate: jan3,
            description: 'E2',
            entryType: 'auto',
            lines: [
                { accountCode: '1010', debitAmount: 200 },
                { accountCode: '4010', creditAmount: 200 }
            ]
        }, 'TestUser');

        // Entry 3: Jan 5, auto
        await service.createEntry({
            entryDate: jan5,
            description: 'E3',
            entryType: 'auto',
            lines: [
                { accountCode: '1010', debitAmount: 300 },
                { accountCode: '4010', creditAmount: 300 }
            ]
        }, 'TestUser');

        // Filter by startDate/endDate
        const ranged = await service.getEntries({ startDate: jan1, endDate: jan3 });
        expect(ranged.length).toBe(2);

        // Filter by entryType
        const autos = await service.getEntries({ entryType: 'auto' });
        expect(autos.length).toBe(2);

        // Filter by sourceTable + sourceId
        const sourced = await service.getEntries({ sourceTable: 'payments', sourceId: 'pay-1' });
        expect(sourced.length).toBe(1);
        expect(sourced[0].description).toBe('E1');

        // Limit and skip (all 3 entries total)
        const limited = await service.getEntries({ limit: 2 });
        expect(limited.length).toBe(2);

        const skipped = await service.getEntries({ skip: 2, limit: 10 });
        expect(skipped.length).toBe(1);
    });

    it('normalizes legacy five-digit account codes before posting', async () => {
        const entry = await service.createEntry({
            entryDate: new Date(),
            description: 'Legacy-coded capital contribution',
            entryType: 'manual',
            lines: [
                { accountCode: '11110', debitAmount: 750 },
                { accountCode: '31100', creditAmount: 750 },
            ],
        }, 'TestUser');

        const details = await service.getEntryById(entry.id);
        expect(details?.lines.map(line => line.accountCode).sort()).toEqual(['1010', '3010']);
    });

    it('includes legacy and unmapped persisted lines in the trial balance', async () => {
        const entry = await service.createEntry({
            entryDate: new Date(),
            description: 'Synced legacy entry',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 500 },
                { accountCode: '3010', creditAmount: 500 },
            ],
        }, 'TestUser');

        const details = await service.getEntryById(entry.id);
        const cashLine = details!.lines.find(line => line.accountCode === '1010')!;
        const equityLine = details!.lines.find(line => line.accountCode === '3010')!;
        await database.write(async () => {
            await cashLine.update(line => {
                line.accountCode = '11110';
            });
            await equityLine.update(line => {
                line.accountCode = '99999';
            });
        });

        const trialBalance = await service.getTrialBalance(new Date());
        expect(trialBalance.totalDebits).toBe(500);
        expect(trialBalance.totalCredits).toBe(500);
        expect(trialBalance.isBalanced).toBe(true);
        expect(trialBalance.rows.find(row => row.code === '1010')?.totalDebit).toBe(500);
        expect(trialBalance.rows.find(row => row.code === '99999')).toMatchObject({
            name: 'Unmapped account 99999',
            totalCredit: 500,
        });
        const ledger = await service.getLedger('1010');
        expect(ledger).toHaveLength(1);
        expect(ledger[0].debit).toBe(500);
    });

    it('rejects new journal lines that do not map to an active posting account', async () => {
        await expect(service.createEntry({
            entryDate: new Date(),
            description: 'Unknown account',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 100 },
                { accountCode: '99999', creditAmount: 100 },
            ],
        }, 'TestUser')).rejects.toThrow('Unknown or inactive posting account code: 99999');
    });
});
