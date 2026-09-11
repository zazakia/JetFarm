/**
 * SalesJournalService
 *
 * Generates the Sales Journal (SJ) — a register of all credit sales (sales on account).
 * Queries journal_entries where AR accounts (1100, 1200, 1300, 1500) are DEBITED
 * and income accounts (4xxx) are CREDITED.
 *
 * SJ Columns:
 * Date | Invoice No. | Customer | Module | AR Debit | Sales Revenue Credit | Status
 */

import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import JournalEntry from '../database/models/JournalEntry';
import JournalEntryLine from '../database/models/JournalEntryLine';

const AR_ACCOUNTS = ['1100', '1200', '1300', '1500'];

export interface SJRow {
    date: Date;
    referenceNumber: string;
    description: string;
    sourceType: string;
    sourceId: string | null;
    arDebit: number;
    arAccountCode: string;
    salesCredit: number;
    salesAccountCode: string;
    moduleId: string | null;
    entryId: string;
}

export interface SJSummary {
    rows: SJRow[];
    totalARDebit: number;
    totalSalesCredit: number;
    periodStart: Date;
    periodEnd: Date;
}

export class SalesJournalServiceClass {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    async getReport(
        startDate: Date,
        endDate: Date,
        moduleFilter?: string
    ): Promise<SJSummary> {
        const startMs = startDate.getTime();
        const endMs = endDate.getTime();

        const entries = await this.db.collections
            .get<JournalEntry>('journal_entries')
            .query(
                Q.where('entry_date', Q.gte(startMs)),
                Q.where('entry_date', Q.lte(endMs)),
                Q.where('is_posted', true),
                Q.where('deleted_at', Q.eq(null)),
                Q.sortBy('entry_date', Q.asc)
            )
            .fetch();

        if (entries.length === 0) return this._emptySummary(startDate, endDate);

        const entryIds = entries.map(e => e.id);
        const allLines = await this.db.collections
            .get<JournalEntryLine>('journal_entry_lines')
            .query(
                Q.where('journal_entry_id', Q.oneOf(entryIds)),
                Q.where('deleted_at', Q.eq(null))
            )
            .fetch();

        const linesByEntry = new Map<string, JournalEntryLine[]>();
        for (const line of allLines) {
            const existing = linesByEntry.get(line.journalEntryId) ?? [];
            existing.push(line);
            linesByEntry.set(line.journalEntryId, existing);
        }

        const sjRows: SJRow[] = [];
        for (const entry of entries) {
            const lines = linesByEntry.get(entry.id) ?? [];

            if (moduleFilter && lines.every(l => l.businessUnitId !== moduleFilter)) continue;

            const arDebitLine = lines.find(
                l => AR_ACCOUNTS.includes(l.accountCode) && (l.debitAmount ?? 0) > 0
            );
            if (!arDebitLine) continue;

            const salesCreditLine = lines.find(
                l => l.accountCode.startsWith('4') && (l.creditAmount ?? 0) > 0
            );
            if (!salesCreditLine) continue;

            sjRows.push({
                date: entry.entryDate,
                referenceNumber: entry.referenceNumber,
                description: entry.description,
                sourceType: entry.sourceTable ?? 'manual',
                sourceId: entry.sourceId,
                arDebit: arDebitLine.debitAmount ?? 0,
                arAccountCode: arDebitLine.accountCode,
                salesCredit: salesCreditLine.creditAmount ?? 0,
                salesAccountCode: salesCreditLine.accountCode,
                moduleId: lines.find(l => l.businessUnitId)?.businessUnitId ?? null,
                entryId: entry.id,
            });
        }

        return {
            rows: sjRows,
            totalARDebit: sjRows.reduce((s, r) => s + r.arDebit, 0),
            totalSalesCredit: sjRows.reduce((s, r) => s + r.salesCredit, 0),
            periodStart: startDate,
            periodEnd: endDate,
        };
    }

    private _emptySummary(startDate: Date, endDate: Date): SJSummary {
        return { rows: [], totalARDebit: 0, totalSalesCredit: 0, periodStart: startDate, periodEnd: endDate };
    }
}

const instance = new SalesJournalServiceClass();
export { instance as SalesJournalService };
export default instance;
