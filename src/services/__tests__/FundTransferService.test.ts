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
});
