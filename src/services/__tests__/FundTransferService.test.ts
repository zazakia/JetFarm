import { FundTransferService } from '../FundTransferService';
import { JournalEntryService } from '../JournalEntryService';

jest.mock('../JournalEntryService', () => ({
    JournalEntryService: {
        createEntry: jest.fn().mockResolvedValue({ id: 'je-transfer-123' }),
    },
}));

jest.mock('../ActionLogService', () => ({
    logAction: jest.fn().mockResolvedValue(true),
}));

describe('FundTransferService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('successfully executes a fund transfer between COH and Petty Cash', async () => {
        const result = await FundTransferService.executeTransfer({
            sourceAccountCode: '1010',
            sourceAccountName: 'Cash on Hand (COH)',
            targetAccountCode: '1011',
            targetAccountName: 'Petty Cash',
            amount: 5000,
            description: 'Replenish Petty Cash',
            performedBy: 'user-admin-1',
        });

        expect(result).toBeDefined();
        expect(JournalEntryService.createEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                entryType: 'manual',
                sourceTable: 'fund_transfers',
                lines: expect.arrayContaining([
                    expect.objectContaining({
                        accountCode: '1011',
                        debitAmount: 5000,
                        creditAmount: 0,
                    }),
                    expect.objectContaining({
                        accountCode: '1010',
                        debitAmount: 0,
                        creditAmount: 5000,
                    }),
                ]),
            }),
            'user-admin-1'
        );
    });

    it('throws an error if amount is zero or negative', async () => {
        await expect(FundTransferService.executeTransfer({
            sourceAccountCode: '1010',
            targetAccountCode: '1011',
            amount: 0,
            description: 'Invalid transfer',
        })).rejects.toThrow('Transfer amount must be greater than zero.');
    });

    it('throws an error if source and target accounts are identical', async () => {
        await expect(FundTransferService.executeTransfer({
            sourceAccountCode: '1010',
            targetAccountCode: '1010',
            amount: 1000,
            description: 'Same account transfer',
        })).rejects.toThrow('Source and target accounts cannot be the same.');
    });

    it('returns transfer history list with user tracing', async () => {
        const history = await FundTransferService.getTransferHistory(10);
        expect(Array.isArray(history)).toBe(true);
    });

    // CHARACTERIZES D7 (fails once fixed). executeTransfer validates amount > 0, presence of
    // both codes and code inequality (src/services/FundTransferService.ts:50-58) but never asks
    // what the source account holds before crediting it, and the screen that was supposed to
    // supply that figure hardcodes zero (app/(admin)/transfers/index.tsx:60-66, `account ? 0 : 0`,
    // a value that is never rendered either). A ₱9,999,999 transfer out of Cash on Hand is
    // therefore accepted and posted no matter what the ledger actually contains.
    it('CHARACTERIZES D7 (fails once fixed): an amount no account can cover is still posted', async () => {
        const result = await FundTransferService.executeTransfer({
            sourceAccountCode: '1010',
            sourceAccountName: 'Cash on Hand (COH)',
            targetAccountCode: '1011',
            targetAccountName: 'Petty Cash',
            amount: 9999999,
            description: 'E2E overdraft probe',
            performedBy: 'user-admin-1',
        });

        // D7: a sufficiency check would reject this before any entry is written.
        expect(result).toBeDefined();
        expect(JournalEntryService.createEntry).toHaveBeenCalledTimes(1);

        const payload = (JournalEntryService.createEntry as jest.Mock).mock.calls[0][0];
        const creditLine = payload.lines.find((l: any) => l.accountCode === '1010');
        // The source is credited for the full un-backed amount.
        expect(creditLine.creditAmount).toBe(9999999);
        const debitLine = payload.lines.find((l: any) => l.accountCode === '1011');
        expect(debitLine.debitAmount).toBe(9999999);
    });
});
