/**
 * AccountsReceivableLedgerService
 *
 * Generates per-customer AR ledger (subsidiary AR ledger).
 * Tracks debits (new charges/loans) and credits (payments received)
 * against receivable accounts: 1100 Loans Receivable, 1200 Savings Loan
 * Receivable, 1300 Interest Receivable, 1500 Other Receivables (WS/Marketplace).
 *
 * Aging brackets: Current | 1-30 | 31-60 | 61-90 | 90+ days
 */

import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import JournalEntry from '../database/models/JournalEntry';
import JournalEntryLine from '../database/models/JournalEntryLine';

const AR_ACCOUNT_CODES = ['1100', '1200', '1300', '1500'];

export interface ARLedgerLine {
    date: Date;
    referenceNumber: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    accountCode: string;
    sourceTable: string | null;
    sourceId: string | null;
    entryId: string;
}

export interface ARCustomerSummary {
    customerId: string;
    customerName: string;
    customerType: 'borrower' | 'ws_customer' | 'marketplace_buyer' | 'unknown';
    totalAR: number;
    lastActivityDate: Date | null;
    agingCurrent: number;
    aging1to30: number;
    aging31to60: number;
    aging61to90: number;
    agingOver90: number;
}

export interface ARAgingSummary {
    customers: ARCustomerSummary[];
    totalCurrent: number;
    total1to30: number;
    total31to60: number;
    total61to90: number;
    totalOver90: number;
    grandTotal: number;
    asOf: Date;
}

export class AccountsReceivableLedgerServiceClass {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    /**
     * Get all AR ledger lines for a specific source (e.g., a loan or WS customer)
     * grouped and ordered by date with running balance.
     */
    async getSourceLedger(
        sourceTable: string,
        sourceId: string,
        opts: { startDate?: Date; endDate?: Date } = {}
    ): Promise<ARLedgerLine[]> {
        const entryClauses: Q.Clause[] = [
            Q.where('source_table', sourceTable),
            Q.where('source_id', sourceId),
            Q.where('is_posted', true),
            Q.where('deleted_at', Q.eq(null)),
        ];
        if (opts.startDate) entryClauses.push(Q.where('entry_date', Q.gte(opts.startDate.getTime())));
        if (opts.endDate) entryClauses.push(Q.where('entry_date', Q.lte(opts.endDate.getTime())));

        const entries = await this.db.collections
            .get<JournalEntry>('journal_entries')
            .query(...entryClauses)
            .fetch();

        if (entries.length === 0) return [];

        const entryIds = entries.map(e => e.id);
        const allLines = await this.db.collections
            .get<JournalEntryLine>('journal_entry_lines')
            .query(
                Q.where('journal_entry_id', Q.oneOf(entryIds)),
                Q.where('account_code', Q.oneOf(AR_ACCOUNT_CODES)),
                Q.where('deleted_at', Q.eq(null))
            )
            .fetch();

        const entryMap = new Map(entries.map(e => [e.id, e]));

        let runningBalance = 0;
        const ledgerLines: ARLedgerLine[] = allLines
            .map(line => {
                const entry = entryMap.get(line.journalEntryId);
                return { line, entry, date: entry?.entryDate ?? new Date() };
            })
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .map(({ line, entry, date }) => {
                const debit = line.debitAmount ?? 0;
                const credit = line.creditAmount ?? 0;
                runningBalance += debit - credit;
                return {
                    date,
                    referenceNumber: entry?.referenceNumber ?? '',
                    description: entry?.description ?? '',
                    debit,
                    credit,
                    balance: runningBalance,
                    accountCode: line.accountCode,
                    sourceTable: entry?.sourceTable ?? null,
                    sourceId: entry?.sourceId ?? null,
                    entryId: line.journalEntryId,
                };
            });

        return ledgerLines;
    }

    /**
     * Compute the current AR balance for a specific source record.
     */
    async getBalance(sourceTable: string, sourceId: string, asOf?: Date): Promise<number> {
        const lines = await this.getSourceLedger(sourceTable, sourceId, { endDate: asOf });
        return lines.length > 0 ? lines[lines.length - 1].balance : 0;
    }

    /**
     * Get AR aging summary grouped by customer/borrower.
     * Uses source_table + source_id grouping from journal_entry_lines.
     */
    async getAgingSummary(asOf: Date): Promise<ARAgingSummary> {
        const asOfMs = asOf.getTime();
        const now = asOf.getTime();

        const entries = await this.db.collections
            .get<JournalEntry>('journal_entries')
            .query(
                Q.where('entry_date', Q.lte(asOfMs)),
                Q.where('is_posted', true),
                Q.where('deleted_at', Q.eq(null))
            )
            .fetch();

        if (entries.length === 0) {
            return { customers: [], totalCurrent: 0, total1to30: 0, total31to60: 0, total61to90: 0, totalOver90: 0, grandTotal: 0, asOf };
        }

        const entryIds = entries.map(e => e.id);
        const allLines = await this.db.collections
            .get<JournalEntryLine>('journal_entry_lines')
            .query(
                Q.where('journal_entry_id', Q.oneOf(entryIds)),
                Q.where('account_code', Q.oneOf(AR_ACCOUNT_CODES)),
                Q.where('deleted_at', Q.eq(null))
            )
            .fetch();

        const entryMap = new Map(entries.map(e => [e.id, e]));

        // Group by source (source_table:source_id)
        const sourceBalances = new Map<string, { balance: number; lastDate: Date; sourceTable: string; sourceId: string }>();
        for (const line of allLines) {
            const entry = entryMap.get(line.journalEntryId);
            if (!entry) continue;
            const key = `${entry.sourceTable}:${entry.sourceId}`;
            const existing = sourceBalances.get(key) ?? { balance: 0, lastDate: entry.entryDate, sourceTable: entry.sourceTable ?? '', sourceId: entry.sourceId ?? '' };
            existing.balance += (line.debitAmount ?? 0) - (line.creditAmount ?? 0);
            if (entry.entryDate > existing.lastDate) existing.lastDate = entry.entryDate;
            sourceBalances.set(key, existing);
        }

        const DAY_MS = 86400000;
        let totalCurrent = 0, total1to30 = 0, total31to60 = 0, total61to90 = 0, totalOver90 = 0;

        const customers: ARCustomerSummary[] = [];
        for (const [, data] of sourceBalances.entries()) {
            if (data.balance <= 0.005) continue;
            const daysDue = Math.floor((now - data.lastDate.getTime()) / DAY_MS);
            const b = data.balance;
            let agingCurrent = 0, aging1to30 = 0, aging31to60 = 0, aging61to90 = 0, agingOver90 = 0;
            if (daysDue <= 0) agingCurrent = b;
            else if (daysDue <= 30) aging1to30 = b;
            else if (daysDue <= 60) aging31to60 = b;
            else if (daysDue <= 90) aging61to90 = b;
            else agingOver90 = b;

            totalCurrent += agingCurrent;
            total1to30 += aging1to30;
            total31to60 += aging31to60;
            total61to90 += aging61to90;
            totalOver90 += agingOver90;

            const customerType = data.sourceTable === 'loans' ? 'borrower'
                : data.sourceTable === 'ws_deliveries' ? 'ws_customer'
                : data.sourceTable === 'marketplace_orders' ? 'marketplace_buyer'
                : 'unknown';

            customers.push({
                customerId: data.sourceId,
                customerName: data.sourceTable ? `${data.sourceTable}/${data.sourceId.substring(0, 8)}` : 'Unknown',
                customerType,
                totalAR: b,
                lastActivityDate: data.lastDate,
                agingCurrent,
                aging1to30,
                aging31to60,
                aging61to90,
                agingOver90,
            });
        }

        return {
            customers,
            totalCurrent,
            total1to30,
            total31to60,
            total61to90,
            totalOver90,
            grandTotal: totalCurrent + total1to30 + total31to60 + total61to90 + totalOver90,
            asOf,
        };
    }
}

const instance = new AccountsReceivableLedgerServiceClass();
export { instance as AccountsReceivableLedgerService };
export default instance;
