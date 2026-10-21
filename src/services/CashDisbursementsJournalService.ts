/**
 * CashDisbursementsJournalService
 *
 * Generates the Cash Disbursements Journal (CDJ) — a columnar register of all
 * cash and bank outflows. Queries journal_entries whose cash/bank account lines
 * (1010, 1011, 1020, 1030, 1040) are CREDITED, grouped by disbursement type.
 *
 * CDJ Columns:
 * Date | Voucher No. | Payee/Description | Settlements & Wages | Operating Expenses
 *      | Receivable Advances | Capital Refunds | Transfers | Other | Cash/Bank Credit
 */

import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import JournalEntry from '../database/models/JournalEntry';
import JournalEntryLine from '../database/models/JournalEntryLine';

const CASH_CREDIT_ACCOUNTS = ['1010', '1011', '1015', '1016', '1020', '1030', '1040'];

/** Land-owner crop shares and field wages cleared in cash. */
const SETTLEMENT_CODES = ['2035', '2036'];
/** Cash advanced into a receivable (offtaker / grower advances). */
const RECEIVABLE_CODES = ['1300', '1500'];
/** Owner or capital-partner equity returned. */
const CAPITAL_CODES = ['2020', '3010', '3015'];

export interface CDJRow {
    date: Date;
    referenceNumber: string;
    description: string;
    sourceType: string;
    settlementsAndWages: number;
    operatingExpenses: number;
    receivableAdvances: number;
    capitalRefunds: number;
    internalTransfers: number;
    otherDisbursements: number;
    totalCash: number;
    entryId: string;
}

export interface CDJSummary {
    rows: CDJRow[];
    totalSettlementsAndWages: number;
    totalOperatingExpenses: number;
    totalReceivableAdvances: number;
    totalCapitalRefunds: number;
    totalInternalTransfers: number;
    totalOtherDisbursements: number;
    grandTotalCash: number;
    periodStart: Date;
    periodEnd: Date;
}

export class CashDisbursementsJournalServiceClass {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    async getReport(startDate: Date, endDate: Date): Promise<CDJSummary> {
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

        const cdjRows: CDJRow[] = [];
        for (const entry of entries) {
            const lines = linesByEntry.get(entry.id) ?? [];
            const cashCreditLine = lines.find(
                l => CASH_CREDIT_ACCOUNTS.includes(l.accountCode) && (l.creditAmount ?? 0) > 0
            );
            if (!cashCreditLine) continue;

            const totalCash = cashCreditLine.creditAmount ?? 0;
            let settlementsAndWages = 0;
            let operatingExpenses = 0;
            let receivableAdvances = 0;
            let capitalRefunds = 0;
            let internalTransfers = 0;
            let otherDisbursements = 0;

            for (const line of lines) {
                const debit = line.debitAmount ?? 0;
                if (debit <= 0) continue;
                const code = line.accountCode;
                if (CASH_CREDIT_ACCOUNTS.includes(code)) internalTransfers += debit;
                else if (SETTLEMENT_CODES.includes(code)) settlementsAndWages += debit;
                else if (RECEIVABLE_CODES.includes(code)) receivableAdvances += debit;
                else if (CAPITAL_CODES.includes(code)) capitalRefunds += debit;
                else if (code.startsWith('5')) operatingExpenses += debit;
                else otherDisbursements += debit;
            }

            cdjRows.push({
                date: entry.entryDate,
                referenceNumber: entry.referenceNumber,
                description: entry.description,
                sourceType: entry.sourceTable ?? 'manual',
                settlementsAndWages,
                operatingExpenses,
                receivableAdvances,
                capitalRefunds,
                internalTransfers,
                otherDisbursements,
                totalCash,
                entryId: entry.id,
            });
        }

        return {
            rows: cdjRows,
            totalSettlementsAndWages: cdjRows.reduce((s, r) => s + r.settlementsAndWages, 0),
            totalOperatingExpenses: cdjRows.reduce((s, r) => s + r.operatingExpenses, 0),
            totalReceivableAdvances: cdjRows.reduce((s, r) => s + r.receivableAdvances, 0),
            totalCapitalRefunds: cdjRows.reduce((s, r) => s + r.capitalRefunds, 0),
            totalInternalTransfers: cdjRows.reduce((s, r) => s + r.internalTransfers, 0),
            totalOtherDisbursements: cdjRows.reduce((s, r) => s + r.otherDisbursements, 0),
            grandTotalCash: cdjRows.reduce((s, r) => s + r.totalCash, 0),
            periodStart: startDate,
            periodEnd: endDate,
        };
    }

    private _emptySummary(startDate: Date, endDate: Date): CDJSummary {
        return {
            rows: [],
            totalSettlementsAndWages: 0,
            totalOperatingExpenses: 0,
            totalReceivableAdvances: 0,
            totalCapitalRefunds: 0,
            totalInternalTransfers: 0,
            totalOtherDisbursements: 0,
            grandTotalCash: 0,
            periodStart: startDate,
            periodEnd: endDate,
        };
    }
}

const instance = new CashDisbursementsJournalServiceClass();
export { instance as CashDisbursementsJournalService };
export default instance;
