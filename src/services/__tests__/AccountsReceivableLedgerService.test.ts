import { AccountsReceivableLedgerService } from '../AccountsReceivableLedgerService';
import { JournalEntryService } from '../JournalEntryService';
import { ChartOfAccountsService } from '../ChartOfAccountsService';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';

describe('AccountsReceivableLedgerService', () => {
    let database: Database;
    let arService: typeof AccountsReceivableLedgerService;
    let jeService: typeof JournalEntryService;

    beforeEach(async () => {
        database = createTestDatabase();
        arService = AccountsReceivableLedgerService;
        jeService = JournalEntryService;
        (arService as any).db = database;
        (jeService as any).db = database;
        (ChartOfAccountsService as any).db = database;
        await ChartOfAccountsService.seed('TestUser');
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('computes running debtor balance from charges and settlements', async () => {
        const settlementId = 'settle-xyz-123';

        // 1. Off-take delivered, invoice raised (charge) Dr 1500 ₱10,000
        await jeService.createEntry({
            entryDate: new Date(2026, 0, 1),
            description: 'Off-take settlement #ST-XYZ',
            entryType: 'auto',
            sourceTable: 'agri_weekly_settlements',
            sourceId: settlementId,
            lines: [
                { accountCode: '1500', debitAmount: 10000, description: 'Buyer invoice raised' },
                { accountCode: '4140', creditAmount: 10000, description: 'Harvest revenue' },
            ],
        }, 'Admin');

        // 2. Partial collection (credit) Cr 1500 ₱3,000
        await jeService.createEntry({
            entryDate: new Date(2026, 0, 10),
            description: 'Partial collection installment 1',
            entryType: 'auto',
            sourceTable: 'agri_weekly_settlements',
            sourceId: settlementId,
            lines: [
                { accountCode: '1010', debitAmount: 3000, description: 'Cash collection' },
                { accountCode: '1500', creditAmount: 3000, description: 'Settlement collected' },
            ],
        }, 'Admin');

        const ledger = await arService.getSourceLedger('agri_weekly_settlements', settlementId);
        expect(ledger).toHaveLength(2);
        expect(ledger[0].balance).toBe(10000);
        expect(ledger[1].balance).toBe(7000);

        const currentBal = await arService.getBalance('agri_weekly_settlements', settlementId);
        expect(currentBal).toBe(7000);
    });

    it('generates AR aging summary properly', async () => {
        const asOf = new Date(2026, 1, 1); // Feb 1, 2026
        const settlementId = 'settle-aging-1';

        await jeService.createEntry({
            entryDate: new Date(2026, 0, 15), // 17 days old
            description: 'Off-take settlement for aging test',
            entryType: 'auto',
            sourceTable: 'agri_weekly_settlements',
            sourceId: settlementId,
            lines: [
                { accountCode: '1500', debitAmount: 4000 },
                { accountCode: '4140', creditAmount: 4000 },
            ],
        }, 'Admin');

        const aging = await arService.getAgingSummary(asOf);
        expect(aging.grandTotal).toBe(4000);
        expect(aging.total1to30).toBe(4000);
        expect(aging.customers).toHaveLength(1);
        expect(aging.customers[0].sourceTable).toBe('agri_weekly_settlements');
    });
});
