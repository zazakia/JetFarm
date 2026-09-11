import { database as globalDatabase } from '../database';
import { Database } from '@nozbe/watermelondb';
import { JournalEntryService } from './JournalEntryService';
import ActionLogService from './ActionLogService';
import { SeriesService } from './SeriesService';

export interface FundTransferInput {
    sourceAccountCode: string;
    sourceAccountName?: string;
    targetAccountCode: string;
    targetAccountName?: string;
    amount: number;
    referenceNumber?: string;
    description: string;
    transferDate?: Date;
    performedBy?: string;
}

export class FundTransferServiceClass {
    protected db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    /**
     * Record a source of funds transfer or bank withdrawal.
     * Generates balanced debit and credit journal entries.
     */
    async executeTransfer(input: FundTransferInput): Promise<any> {
        if (!input.amount || input.amount <= 0) {
            throw new Error('Transfer amount must be greater than zero.');
        }
        if (!input.sourceAccountCode || !input.targetAccountCode) {
            throw new Error('Source and target account codes are required.');
        }
        if (input.sourceAccountCode === input.targetAccountCode) {
            throw new Error('Source and target accounts cannot be the same.');
        }

        const date = input.transferDate ?? new Date();
        const refNumber = input.referenceNumber || SeriesService.generate('REM');

        // Create balanced journal entry:
        // Debit: Target account (receiving funds)
        // Credit: Source account (releasing funds)
        const journalEntry = await JournalEntryService.createEntry({
            entryDate: date,
            description: input.description || `Fund Transfer from ${input.sourceAccountCode} to ${input.targetAccountCode}`,
            entryType: 'manual',
            lines: [
                {
                    accountCode: input.targetAccountCode,
                    accountName: input.targetAccountName,
                    debitAmount: input.amount,
                    creditAmount: 0,
                    description: `Transfer IN from ${input.sourceAccountCode}`,
                },
                {
                    accountCode: input.sourceAccountCode,
                    accountName: input.sourceAccountName,
                    debitAmount: 0,
                    creditAmount: input.amount,
                    description: `Transfer OUT to ${input.targetAccountCode}`,
                },
            ],
            sourceTable: 'fund_transfers',
            postedBy: input.performedBy,
        }, input.performedBy);

        await ActionLogService.logAction({
            entityType: 'fund_transfers',
            entityId: journalEntry.id,
            action: 'CREATE',
            newData: {
                source: input.sourceAccountCode,
                target: input.targetAccountCode,
                amount: input.amount,
                refNumber,
            },
            performedBy: input.performedBy,
        });

        return journalEntry;
    }
}

const instance = new FundTransferServiceClass();
export { instance as FundTransferService };
export default instance;
