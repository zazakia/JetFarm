import { database as globalDatabase } from '../database';
import { Database, Q } from '@nozbe/watermelondb';
import { JournalEntryService } from './JournalEntryService';
import ActionLogService from './ActionLogService';
import { SeriesService } from './SeriesService';
import JournalEntry from '../database/models/JournalEntry';
import JournalEntryLine from '../database/models/JournalEntryLine';
import UserProfile from '../database/models/UserProfile';
import { resolveOperator } from '../utils/auditTrailFormatter';

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

export interface FundTransferHistoryRecord {
    id: string;
    entryDate: Date;
    referenceNumber: string;
    description: string;
    amount: number;
    sourceAccountCode: string;
    sourceAccountName?: string;
    targetAccountCode: string;
    targetAccountName?: string;
    performedBy?: string;
    operatorName?: string;
    operatorRole?: string;
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

    /**
     * Retrieves fund transfer history with source/target accounts and user tracing.
     */
    async getTransferHistory(limit: number = 50): Promise<FundTransferHistoryRecord[]> {
        try {
            const jeColl = this.db.get<JournalEntry>('journal_entries');
            if (!jeColl) return [];

            const entries = await jeColl
                .query(
                    Q.where('source_table', 'fund_transfers'),
                    Q.where('deleted_at', Q.eq(null)),
                    Q.sortBy('entry_date', Q.desc),
                    Q.take(limit)
                )
                .fetch();

            if (entries.length === 0) return [];

            const userProfiles = await this.db.get<UserProfile>('user_profiles').query().fetch().catch(() => []);
            const userMap = new Map<string, { id: string; fullName: string; role: string; email?: string }>();
            for (const p of userProfiles) {
                userMap.set(p.id, {
                    id: p.id,
                    fullName: p.fullName || p.email,
                    role: p.role,
                    email: p.email,
                });
            }

            const lineColl = this.db.get<JournalEntryLine>('journal_entry_lines');
            const records: FundTransferHistoryRecord[] = [];

            for (const entry of entries) {
                let lines: JournalEntryLine[] = [];
                if (lineColl) {
                    lines = await lineColl.query(
                        Q.where('journal_entry_id', entry.id),
                        Q.where('deleted_at', Q.eq(null))
                    ).fetch();
                }

                const sourceLine = lines.find(l => (l.creditAmount || 0) > 0);
                const targetLine = lines.find(l => (l.debitAmount || 0) > 0);
                const amount = targetLine?.debitAmount || sourceLine?.creditAmount || entry.totalDebit || 0;

                const operator = resolveOperator(entry.postedBy, userMap);

                records.push({
                    id: entry.id,
                    entryDate: entry.entryDate ? new Date(entry.entryDate) : new Date(entry.createdAt),
                    referenceNumber: entry.referenceNumber || entry.id.substring(0, 8),
                    description: entry.description,
                    amount,
                    sourceAccountCode: sourceLine?.accountCode || '',
                    sourceAccountName: sourceLine?.accountName || undefined,
                    targetAccountCode: targetLine?.accountCode || '',
                    targetAccountName: targetLine?.accountName || undefined,
                    performedBy: entry.postedBy || undefined,
                    operatorName: operator.name,
                    operatorRole: operator.role,
                });
            }

            return records;
        } catch (error) {
            console.error('[FundTransferService] Error loading transfer history:', error);
            return [];
        }
    }
}

const instance = new FundTransferServiceClass();
export { instance as FundTransferService };
export default instance;
