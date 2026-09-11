/**
 * CashReceiptsJournalService
 *
 * Generates the Cash Receipts Journal (CRJ) — a columnar register of all
 * cash inflows. Queries journal_entries where cash account lines (1010, 1011, 1015, 1016)
 * are DEBITED, grouped by source type.
 *
 * CRJ Columns:
 * Date | OR No. | Payor/Description | Loan Repayments | Savings Deposits
 *      | Share Capital | Service Charges | Other Receipts | Cash Debit (1010)
 */

import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import JournalEntry from '../database/models/JournalEntry';
import JournalEntryLine from '../database/models/JournalEntryLine';

const CASH_DEBIT_ACCOUNTS = ['1010', '1011', '1015', '1016'];

export interface CRJRow {
    date: Date;
    referenceNumber: string;
    description: string;
    sourceType: string;
    loanRepayments: number;
    savingsDeposits: number;
    shareCapital: number;
    serviceCharges: number;
    membershipFees: number;
    otherReceipts: number;
    totalCash: number;
    entryId: string;
}

export interface CRJSummary {
    rows: CRJRow[];
    totalLoanRepayments: number;
    totalSavingsDeposits: number;
    totalShareCapital: number;
    totalServiceCharges: number;
    totalMembershipFees: number;
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
            let loanRepayments = 0;
            let savingsDeposits = 0;
            let shareCapital = 0;
            let serviceCharges = 0;
            let membershipFees = 0;
            let otherReceipts = 0;

            for (const line of lines) {
                const credit = line.creditAmount ?? 0;
                if (credit <= 0) continue;
                const code = line.accountCode;
                if (code === '1100' || code === '1200') loanRepayments += credit;
                else if (code === '2010') savingsDeposits += credit;
                else if (code === '3010') shareCapital += credit;
                else if (code === '4020') serviceCharges += credit;
                else if (code === '4030') membershipFees += credit;
                else otherReceipts += credit;
            }

            crjRows.push({
                date: entry.entryDate,
                referenceNumber: entry.referenceNumber,
                description: entry.description,
                sourceType: entry.sourceTable ?? 'manual',
                loanRepayments,
                savingsDeposits,
                shareCapital,
                serviceCharges,
                membershipFees,
                otherReceipts,
                totalCash,
                entryId: entry.id,
            });
        }

        return {
            rows: crjRows,
            totalLoanRepayments: crjRows.reduce((s, r) => s + r.loanRepayments, 0),
            totalSavingsDeposits: crjRows.reduce((s, r) => s + r.savingsDeposits, 0),
            totalShareCapital: crjRows.reduce((s, r) => s + r.shareCapital, 0),
            totalServiceCharges: crjRows.reduce((s, r) => s + r.serviceCharges, 0),
            totalMembershipFees: crjRows.reduce((s, r) => s + r.membershipFees, 0),
            totalOtherReceipts: crjRows.reduce((s, r) => s + r.otherReceipts, 0),
            grandTotalCash: crjRows.reduce((s, r) => s + r.totalCash, 0),
            periodStart: startDate,
            periodEnd: endDate,
        };
    }

    private _emptySummary(startDate: Date, endDate: Date): CRJSummary {
        return {
            rows: [],
            totalLoanRepayments: 0,
            totalSavingsDeposits: 0,
            totalShareCapital: 0,
            totalServiceCharges: 0,
            totalMembershipFees: 0,
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
