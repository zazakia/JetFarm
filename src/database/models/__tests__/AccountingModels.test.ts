import { createTestDatabase, closeTestDatabase } from '../../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';
import ChartOfAccount from '../ChartOfAccount';
import JournalEntry from '../JournalEntry';
import JournalEntryLine from '../JournalEntryLine';

describe('Accounting Database Models', () => {
    let database: Database;

    beforeEach(async () => {
        database = createTestDatabase();
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('should initialize and CRUD ChartOfAccount model correctly', async () => {
        const coaCollection = database.get<ChartOfAccount>('chart_of_accounts');
        let record!: ChartOfAccount;

        await database.write(async () => {
            record = await coaCollection.create(r => {
                r.code = '1010';
                r.name = 'Cash on Hand';
                r.accountType = 'asset';
                r.normalBalance = 'debit';
                r.parentCode = '1000';
                r.isHeader = false;
                r.isActive = true;
                r.description = 'Cash in cash boxes';
                r.sortOrder = 1;
            });
        });

        expect(record).toBeDefined();
        expect(record.id).toBeDefined();
        expect(record.code).toBe('1010');
        expect(record.name).toBe('Cash on Hand');
        expect(record.accountType).toBe('asset');
        expect(record.normalBalance).toBe('debit');
        expect(record.parentCode).toBe('1000');
        expect(record.isHeader).toBe(false);
        expect(record.isActive).toBe(true);
        expect(record.description).toBe('Cash in cash boxes');
        expect(record.sortOrder).toBe(1);

        // Update
        await database.write(async () => {
            await record.update(r => {
                r.name = 'Cash on Hand - Main';
            });
        });

        const updated = await coaCollection.find(record.id);
        expect(updated.name).toBe('Cash on Hand - Main');
    });

    it('should initialize and CRUD JournalEntry model correctly', async () => {
        const jeCollection = database.get<JournalEntry>('journal_entries');
        let record!: JournalEntry;
        const entryDate = new Date();

        await database.write(async () => {
            record = await jeCollection.create(r => {
                r.entryDate = entryDate;
                r.referenceNumber = 'JE-2026-000001';
                r.description = 'Standard transaction';
                r.entryType = 'manual';
                r.sourceTable = 'payments';
                r.sourceId = 'pay-123';
                r.postedBy = 'TestUser';
                r.isPosted = true;
                r.totalDebit = 1000;
                r.totalCredit = 1000;
                r.fiscalYear = 2026;
                r.fiscalMonth = 7;
            });
        });

        expect(record).toBeDefined();
        expect(record.id).toBeDefined();
        expect(record.entryDate.getTime()).toBe(entryDate.getTime());
        expect(record.referenceNumber).toBe('JE-2026-000001');
        expect(record.description).toBe('Standard transaction');
        expect(record.entryType).toBe('manual');
        expect(record.sourceTable).toBe('payments');
        expect(record.sourceId).toBe('pay-123');
        expect(record.postedBy).toBe('TestUser');
        expect(record.isPosted).toBe(true);
        expect(record.totalDebit).toBe(1000);
        expect(record.totalCredit).toBe(1000);
        expect(record.fiscalYear).toBe(2026);
        expect(record.fiscalMonth).toBe(7);
    });

    it('should initialize and CRUD JournalEntryLine model correctly', async () => {
        const jelCollection = database.get<JournalEntryLine>('journal_entry_lines');
        let record!: JournalEntryLine;

        await database.write(async () => {
            record = await jelCollection.create(r => {
                r.journalEntryId = 'je-123';
                r.accountCode = '1010';
                r.accountName = 'Cash';
                r.debitAmount = 1000;
                r.creditAmount = 0;
                r.description = 'Debit Cash';
            });
        });

        expect(record).toBeDefined();
        expect(record.id).toBeDefined();
        expect(record.journalEntryId).toBe('je-123');
        expect(record.accountCode).toBe('1010');
        expect(record.accountName).toBe('Cash');
        expect(record.debitAmount).toBe(1000);
        expect(record.creditAmount).toBe(0);
        expect(record.description).toBe('Debit Cash');
    });
});
