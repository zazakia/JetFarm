/**
 * CashReceiptsJournalService
 *
 * Generates the Cash Receipts Journal (CRJ) — a columnar register of all
 * cash and bank inflows. Queries journal_entries whose cash/bank account lines
 * (1010, 1011, 1020, 1030, 1040) are DEBITED, grouped by source type.
 *
 * CRJ Columns:
 * Date | OR No. | Payor/Description | Receivable Collections | Capital Contributions
 *      | Farm Revenue | Other Receipts | Cash/Bank Debit
 */

import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import JournalEntry from '../database/models/JournalEntry';
import JournalEntryLine from '../database/models/JournalEntryLine';

const CASH_DEBIT_ACCOUNTS = ['1010', '1011', '1015', '1016', '1020', '1030', '1040'];

/** Receivable write-downs (interest / other receivables) settled in cash. */
const RECEIVABLE_CODES = ['1300', '1500'];
/** Owner and capital-partner equity paid into the farm. */
const CAPITAL_CODES = ['2020', '3010', '3015'];

export interface CRJRow {
    date: Date;
    referenceNumber: string;
    description: string;
    sourceType: string;
    receivableCollections: number;
    capitalContributions: number;
    farmRevenue: number;
    internalTransfers: number;
    otherReceipts: number;
    totalCash: number;
    entryId: string;
}

export interface CRJSummary {
    rows: CRJRow[];
    totalReceivableCollections: number;
    totalCapitalContributions: number;
    totalFarmRevenue: number;
    totalInternalTransfers: number;
    totalOtherReceipts: number;
    grandTotalCash: number;
    periodStart: Date;
    periodEnd: Date;
}

export class CashReceiptsJournalServiceClass {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    async getReport(startDate: Date, endDate: Date): Promise<CRJSummary> {
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

        if (entries.length === 0) {
            return this._emptySummary(startDate, endDate);
        }

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

        const crjRows: CRJRow[] = [];
        for (const entry of entries) {
            const lines = linesByEntry.get(entry.id) ?? [];
            const cashDebitLine = lines.find(
                l => CASH_DEBIT_ACCOUNTS.includes(l.accountCode) && (l.debitAmount ?? 0) > 0
            );
            if (!cashDebitLine) continue;

            const totalCash = cashDebitLine.debitAmount ?? 0;
            let receivableCollections = 0;
            let capitalContributions = 0;
            let farmRevenue = 0;
            let internalTransfers = 0;
            let otherReceipts = 0;

            for (const line of lines) {
                const credit = line.creditAmount ?? 0;
                if (credit <= 0) continue;
                const code = line.accountCode;
                if (CASH_DEBIT_ACCOUNTS.includes(code)) internalTransfers += credit;
                else if (RECEIVABLE_CODES.includes(code)) receivableCollections += credit;
                else if (CAPITAL_CODES.includes(code)) capitalContributions += credit;
                else if (code.startsWith('4')) farmRevenue += credit;
                else otherReceipts += credit;
            }

            crjRows.push({
                date: entry.entryDate,
                referenceNumber: entry.referenceNumber,
                description: entry.description,
                sourceType: entry.sourceTable ?? 'manual',
                receivableCollections,
                capitalContributions,
                farmRevenue,
                internalTransfers,
                otherReceipts,
                totalCash,
                entryId: entry.id,
            });
        }

        return {
            rows: crjRows,
            totalReceivableCollections: crjRows.reduce((s, r) => s + r.receivableCollections, 0),
            totalCapitalContributions: crjRows.reduce((s, r) => s + r.capitalContributions, 0),
            totalFarmRevenue: crjRows.reduce((s, r) => s + r.farmRevenue, 0),
            totalInternalTransfers: crjRows.reduce((s, r) => s + r.internalTransfers, 0),
            totalOtherReceipts: crjRows.reduce((s, r) => s + r.otherReceipts, 0),
            grandTotalCash: crjRows.reduce((s, r) => s + r.totalCash, 0),
            periodStart: startDate,
            periodEnd: endDate,
        };
    }

    private _emptySummary(startDate: Date, endDate: Date): CRJSummary {
        return {
            rows: [],
            totalReceivableCollections: 0,
            totalCapitalContributions: 0,
            totalFarmRevenue: 0,
            totalInternalTransfers: 0,
            totalOtherReceipts: 0,
            grandTotalCash: 0,
            periodStart: startDate,
            periodEnd: endDate,
        };
    }
}

const instance = new CashReceiptsJournalServiceClass();
export { instance as CashReceiptsJournalService };
export default instance;
