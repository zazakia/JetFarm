/**
 * CashDisbursementsJournalService
 *
 * Generates the Cash Disbursements Journal (CDJ) — a columnar register of all
 * cash outflows. Queries journal_entries where cash account lines (1010, 1020, etc.)
 * are CREDITED, grouped by disbursement type.
 *
 * CDJ Columns:
 * Date | Voucher No. | Payee/Description | Loan Releases | Operating Expenses
 *      | Savings Withdrawals | SC Refunds | Bank Deposits | Other | Cash Credit (1010)
 */

import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import JournalEntry from '../database/models/JournalEntry';
import JournalEntryLine from '../database/models/JournalEntryLine';

const CASH_CREDIT_ACCOUNTS = ['1010', '1011', '1015', '1016', '1020', '1030', '1040'];

export interface CDJRow {
    date: Date;
    referenceNumber: string;
    description: string;
    sourceType: string;
    loanDisbursements: number;
    operatingExpenses: number;
    savingsWithdrawals: number;
    scRefunds: number;
    bankDeposits: number;
    otherDisbursements: number;
    totalCash: number;
    entryId: string;
}

export interface CDJSummary {
    rows: CDJRow[];
    totalLoanDisbursements: number;
    totalOperatingExpenses: number;
    totalSavingsWithdrawals: number;
    totalScRefunds: number;
    totalBankDeposits: number;
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
            let loanDisbursements = 0;
            let operatingExpenses = 0;
            let savingsWithdrawals = 0;
            let scRefunds = 0;
            let bankDeposits = 0;
            let otherDisbursements = 0;

            for (const line of lines) {
                const debit = line.debitAmount ?? 0;
                if (debit <= 0) continue;
                const code = line.accountCode;
                if (code === '1100' || code === '1200') loanDisbursements += debit;
                else if (code.startsWith('5')) operatingExpenses += debit;
                else if (code === '2010') savingsWithdrawals += debit;
                else if (code === '3010') scRefunds += debit;
                else if (['1020', '1030', '1040'].includes(code)) bankDeposits += debit;
                else otherDisbursements += debit;
            }

            cdjRows.push({
                date: entry.entryDate,
                referenceNumber: entry.referenceNumber,
                description: entry.description,
                sourceType: entry.sourceTable ?? 'manual',
                loanDisbursements,
                operatingExpenses,
                savingsWithdrawals,
                scRefunds,
                bankDeposits,
                otherDisbursements,
                totalCash,
                entryId: entry.id,
            });
        }

        return {
            rows: cdjRows,
            totalLoanDisbursements: cdjRows.reduce((s, r) => s + r.loanDisbursements, 0),
            totalOperatingExpenses: cdjRows.reduce((s, r) => s + r.operatingExpenses, 0),
            totalSavingsWithdrawals: cdjRows.reduce((s, r) => s + r.savingsWithdrawals, 0),
            totalScRefunds: cdjRows.reduce((s, r) => s + r.scRefunds, 0),
            totalBankDeposits: cdjRows.reduce((s, r) => s + r.bankDeposits, 0),
            totalOtherDisbursements: cdjRows.reduce((s, r) => s + r.otherDisbursements, 0),
            grandTotalCash: cdjRows.reduce((s, r) => s + r.totalCash, 0),
            periodStart: startDate,
            periodEnd: endDate,
        };
    }

    private _emptySummary(startDate: Date, endDate: Date): CDJSummary {
        return {
            rows: [],
            totalLoanDisbursements: 0,
            totalOperatingExpenses: 0,
            totalSavingsWithdrawals: 0,
            totalScRefunds: 0,
            totalBankDeposits: 0,
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
