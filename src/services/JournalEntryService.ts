/**
 * JournalEntryService
 *
 * Core double-entry bookkeeping engine for POSCursor.
 *
 * Responsibilities:
 * - Create balanced journal entries (debit total must equal credit total)
 * - Generate sequential reference numbers (JE-YYYY-NNNNNN)
 * - Compute general ledger running balances per account
 * - Generate trial balance as-of any date
 * - Support reversal entries for posted journals
 * - Lock posted entries (reversals only, no direct edits)
 */

import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import JournalEntry from '../database/models/JournalEntry';
import JournalEntryLine from '../database/models/JournalEntryLine';
import { ChartOfAccountsService, ChartOfAccountsServiceClass } from './ChartOfAccountsService';
import ActionLogService from './ActionLogService';

const LEGACY_ACCOUNT_CODE_MAP: Readonly<Record<string, string>> = Object.freeze({
    '11110': '1010',
    '11200': '1020',
    '12100': '1100',
    '21100': '2010',
    '31100': '3010',
    '41100': '4010',
    '51100': '5100',
});

export function normalizeAccountCode(code: string): string {
    return LEGACY_ACCOUNT_CODE_MAP[code] ?? code;
}

function getEquivalentAccountCodes(code: string): string[] {
    const canonicalCode = normalizeAccountCode(code);
    return [
        canonicalCode,
        ...Object.entries(LEGACY_ACCOUNT_CODE_MAP)
            .filter(([, canonical]) => canonical === canonicalCode)
            .map(([legacy]) => legacy),
    ];
}

export interface JournalLineInput {
    accountCode: string;
    accountName?: string;
    debitAmount?: number;
    creditAmount?: number;
    description?: string;
}

export interface JournalEntryInput {
    entryDate: Date;
    description: string;
    entryType: 'auto' | 'manual' | 'adjusting' | 'closing' | 'reversing';
    lines: JournalLineInput[];
    sourceTable?: string;
    sourceId?: string;
    postedBy?: string;
    fiscalYear?: number;
    fiscalMonth?: number;
}

export interface LedgerLine {
    date: Date;
    referenceNumber: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    entryId: string;
}

export interface TrialBalanceRow {
    code: string;
    name: string;
    accountType: string;
    normalBalance: string;
    totalDebit: number;
    totalCredit: number;
    netBalance: number;
}

export interface TrialBalanceSummary {
    asOf: Date;
    rows: TrialBalanceRow[];
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
}

export class JournalEntryServiceClass {
    protected db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    // ─── Reference Number Generator ───────────────────────────────────────────

    private async generateReferenceNumber(year: number): Promise<string> {
        const startOfYear = new Date(year, 0, 1).getTime();
        const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999).getTime();

        const count = await this.db.collections
            .get('journal_entries')
            .query(
                Q.where('entry_date', Q.gte(startOfYear)),
                Q.where('entry_date', Q.lte(endOfYear)),
                Q.where('deleted_at', Q.eq(null))
            )
            .fetchCount();

        const seq = String(count + 1).padStart(6, '0');
        return `JE-${year}-${seq}`;
    }

    // ─── Create ────────────────────────────────────────────────────────────────

    async createEntry(input: JournalEntryInput, performedBy?: string): Promise<JournalEntry> {
        const normalizedLines = input.lines.map(line => ({
            ...line,
            accountCode: normalizeAccountCode(line.accountCode),
        }));

        // Validate balance: total debits must equal total credits
        const totalDebit = normalizedLines.reduce((sum, l) => sum + (l.debitAmount ?? 0), 0);
        const totalCredit = normalizedLines.reduce((sum, l) => sum + (l.creditAmount ?? 0), 0);

        // Allow small floating-point tolerance (1 centavo)
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error(
                `Journal entry is not balanced. Total Debits: ₱${totalDebit.toFixed(2)}, Total Credits: ₱${totalCredit.toFixed(2)}`
            );
        }

        if (normalizedLines.length < 2) {
            throw new Error('A journal entry requires at least 2 lines (one debit, one credit).');
        }
        const coaService = new ChartOfAccountsServiceClass(this.db);
        const postingAccounts = await coaService.getActivePostableAccounts();
        const validCodes = new Set(postingAccounts.map(account => account.code));
        const invalidLine = normalizedLines.find(line => !validCodes.has(line.accountCode));
        if (invalidLine) {
            throw new Error(`Unknown or inactive posting account code: ${invalidLine.accountCode}`);
        }


        const year = input.entryDate.getFullYear();
        const refNumber = await this.generateReferenceNumber(year);
        const entryDateMs = input.entryDate.getTime();

        let createdEntry!: JournalEntry;

        await this.db.write(async () => {
            createdEntry = await this.db.get<JournalEntry>('journal_entries').create(entry => {
                (entry as any).entryDate = entryDateMs;
                entry.referenceNumber = refNumber;
                entry.description = input.description;
                (entry as any).entryType = input.entryType;
                (entry as any).sourceTable = input.sourceTable ?? null;
                (entry as any).sourceId = input.sourceId ?? null;
                (entry as any).postedBy = input.postedBy ?? performedBy ?? null;
                (entry as any).isPosted = true;
                entry.totalDebit = totalDebit;
                entry.totalCredit = totalCredit;
                (entry as any).fiscalYear = input.fiscalYear ?? year;
                (entry as any).fiscalMonth = input.fiscalMonth ?? (input.entryDate.getMonth() + 1);
            });

            // Create all lines in the same transaction
            const linePrepared = normalizedLines.map(line =>
                this.db.get<JournalEntryLine>('journal_entry_lines').prepareCreate(l => {
                    (l as any).journalEntryId = createdEntry.id;
                    (l as any).accountCode = line.accountCode;
                    (l as any).accountName = line.accountName ?? null;
                    (l as any).debitAmount = line.debitAmount ?? 0;
                    (l as any).creditAmount = line.creditAmount ?? 0;
                    (l as any).description = line.description ?? null;
                    (l as any).businessUnitId = (line as any).businessUnitId ?? null;
                    (l as any).moduleSourceTable = (line as any).moduleSourceTable ?? null;
                    (l as any).moduleSourceId = (line as any).moduleSourceId ?? null;
                })
            );

            await this.db.batch(...linePrepared);
        });

        await ActionLogService.logAction({
            entityType: 'journal_entries',
            entityId: createdEntry.id,
            action: 'CREATE',
            newData: { referenceNumber: refNumber, totalDebit, totalCredit, entryType: input.entryType },
            performedBy,
        });

        return createdEntry;
    }

    // ─── Reversal ─────────────────────────────────────────────────────────────

    async reverseEntry(entryId: string, performedBy?: string): Promise<JournalEntry> {
        const original = await this.db.collections
            .get<JournalEntry>('journal_entries')
            .find(entryId);

        if (!original) throw new Error(`Journal entry not found: ${entryId}`);
        if (!original.isPosted) throw new Error('Cannot reverse an unposted entry.');

        // Fetch original lines
        const originalLines = await this.db.collections
            .get<JournalEntryLine>('journal_entry_lines')
            .query(
                Q.where('journal_entry_id', entryId),
                Q.where('deleted_at', Q.eq(null))
            )
            .fetch();

        // Swap debits and credits
        const reversalLines: JournalLineInput[] = originalLines.map(line => ({
            accountCode: line.accountCode,
            accountName: line.accountName ?? undefined,
            debitAmount: line.creditAmount ?? 0,
            creditAmount: line.debitAmount ?? 0,
            description: `Reversal: ${line.description ?? ''}`,
        }));

        return this.createEntry({
            entryDate: new Date(),
            description: `Reversal of ${original.referenceNumber}: ${original.description}`,
            entryType: 'reversing',
            lines: reversalLines,
            sourceTable: 'journal_entries',
            sourceId: entryId,
            postedBy: performedBy,
        }, performedBy);
    }

    // ─── Read ──────────────────────────────────────────────────────────────────

    async getEntries(opts: {
        startDate?: Date;
        endDate?: Date;
        entryType?: string;
        sourceTable?: string;
        sourceId?: string;
        limit?: number;
        skip?: number;
    } = {}): Promise<JournalEntry[]> {
        const clauses: Q.Clause[] = [Q.where('deleted_at', Q.eq(null))];

        if (opts.startDate) clauses.push(Q.where('entry_date', Q.gte(opts.startDate.getTime())));
        if (opts.endDate) clauses.push(Q.where('entry_date', Q.lte(opts.endDate.getTime())));
        if (opts.entryType) clauses.push(Q.where('entry_type', opts.entryType));
        if (opts.sourceTable) clauses.push(Q.where('source_table', opts.sourceTable));
        if (opts.sourceId) clauses.push(Q.where('source_id', opts.sourceId));

        clauses.push(Q.sortBy('entry_date', Q.desc));
        if (opts.skip) clauses.push(Q.skip(opts.skip));
        if (opts.limit) clauses.push(Q.take(opts.limit));

        return this.db.collections
            .get<JournalEntry>('journal_entries')
            .query(...clauses)
            .fetch();
    }

    async getEntryById(id: string): Promise<{ entry: JournalEntry; lines: JournalEntryLine[] } | null> {
        try {
            const entry = await this.db.collections
                .get<JournalEntry>('journal_entries')
                .find(id);

            const lines = await this.db.collections
                .get<JournalEntryLine>('journal_entry_lines')
                .query(
                    Q.where('journal_entry_id', id),
                    Q.where('deleted_at', Q.eq(null))
                )
                .fetch();

            return { entry, lines };
        } catch {
            return null;
        }
    }

    async getLinesForEntry(entryId: string): Promise<JournalEntryLine[]> {
        return this.db.collections
            .get<JournalEntryLine>('journal_entry_lines')
            .query(
                Q.where('journal_entry_id', entryId),
                Q.where('deleted_at', Q.eq(null))
            )
            .fetch();
    }

    /** Find the journal entry auto-posted from a specific source record */
    async getEntryBySource(sourceTable: string, sourceId: string): Promise<JournalEntry | null> {
        const results = await this.db.collections
            .get<JournalEntry>('journal_entries')
            .query(
                Q.where('source_table', sourceTable),
                Q.where('source_id', sourceId),
                Q.where('deleted_at', Q.eq(null))
            )
            .fetch();
        return results[0] ?? null;
    }

    // ─── General Ledger ───────────────────────────────────────────────────────

    /**
     * Get the running balance ledger for a specific account code.
     * Returns sorted ascending by entry date with a running balance column.
     */
    async getLedger(accountCode: string, opts: {
        startDate?: Date;
        endDate?: Date;
    } = {}): Promise<LedgerLine[]> {
        // Instantiate CoA service using this.db to ensure isolated tests pass
        const coaService = new ChartOfAccountsServiceClass(this.db);
        const canonicalAccountCode = normalizeAccountCode(accountCode);
        const account = await coaService.getByCode(canonicalAccountCode);
        if (!account) throw new Error(`Account not found: ${accountCode}`);

        const equivalentCodes = getEquivalentAccountCodes(canonicalAccountCode);
        const lineClauses: Q.Clause[] = [
            Q.where('account_code', Q.oneOf(equivalentCodes)),
            Q.where('deleted_at', Q.eq(null)),
        ];

        const lines = await this.db.collections
            .get<JournalEntryLine>('journal_entry_lines')
            .query(...lineClauses)
            .fetch();

        // Get all entry IDs to fetch entry metadata
        const entryIds = [...new Set(lines.map(l => l.journalEntryId))];
        if (entryIds.length === 0) return [];

        const entries = await this.db.collections
            .get<JournalEntry>('journal_entries')
            .query(
                Q.where('id', Q.oneOf(entryIds)),
                Q.where('deleted_at', Q.eq(null)),
                Q.where('is_posted', true)
            )
            .fetch();

        // Filter by date range if specified
        const filteredEntries = entries.filter(e => {
            const d = e.entryDate.getTime();
            if (opts.startDate && d < opts.startDate.getTime()) return false;
            if (opts.endDate && d > opts.endDate.getTime()) return false;
            return true;
        });

        const entryMap = new Map(filteredEntries.map(e => [e.id, e]));
        const lineMap = new Map(lines.map(l => [l.journalEntryId, l]));

        // Build ledger rows sorted by date
        const isDebitNormal = account.normalBalance === 'debit';
        let runningBalance = 0;

        const ledgerLines: LedgerLine[] = filteredEntries
            .sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime())
            .map(entry => {
                const line = lineMap.get(entry.id);
                const debit = line?.debitAmount ?? 0;
                const credit = line?.creditAmount ?? 0;

                // Running balance: debit-normal accounts increase on debit
                if (isDebitNormal) {
                    runningBalance += debit - credit;
                } else {
                    runningBalance += credit - debit;
                }

                return {
                    date: entry.entryDate,
                    referenceNumber: entry.referenceNumber,
                    description: entry.description,
                    debit,
                    credit,
                    balance: runningBalance,
                    entryId: entry.id,
                };
            });

        return ledgerLines;
    }

    /**
     * Get the net balance for a single account as of a given date.
     * Positive = has a balance; follows normal balance convention.
     */
    async getAccountBalance(accountCode: string, asOf: Date): Promise<number> {
        const ledger = await this.getLedger(accountCode, { endDate: asOf });
        return ledger.length > 0 ? ledger[ledger.length - 1].balance : 0;
    }

    // ─── Trial Balance ────────────────────────────────────────────────────────

    async getTrialBalance(
        asOf: Date,
        options?: { businessUnitId?: string; branchId?: string }
    ): Promise<TrialBalanceSummary> {
        const coaService = new ChartOfAccountsServiceClass(this.db);
        const accounts = await coaService.getActivePostableAccounts();
        const asOfMs = asOf.getTime();

        // Fetch all journal lines for posted entries up to asOf
        const allEntries = await this.db.collections
            .get<JournalEntry>('journal_entries')
            .query(
                Q.where('entry_date', Q.lte(asOfMs)),
                Q.where('is_posted', true),
                Q.where('deleted_at', Q.eq(null))
            )
            .fetch();

        const entryIds = allEntries.map(e => e.id);
        if (entryIds.length === 0) {
            return {
                asOf,
                rows: accounts.map(a => ({
                    code: a.code,
                    name: a.name,
                    accountType: a.accountType,
                    normalBalance: a.normalBalance,
                    totalDebit: 0,
                    totalCredit: 0,
                    netBalance: 0,
                })),
                totalDebits: 0,
                totalCredits: 0,
                isBalanced: true,
            };
        }

        const allLines = await this.db.collections
            .get<JournalEntryLine>('journal_entry_lines')
            .query(
                Q.where('journal_entry_id', Q.oneOf(entryIds)),
                Q.where('deleted_at', Q.eq(null))
            )
            .fetch();

        // If filtering by branch or business unit
        let eligibleUnitIds: Set<string> | null = null;
        if (options?.branchId) {
            eligibleUnitIds = new Set([options.branchId]);
            try {
                const bus = await this.db.collections.get<any>('business_units').query(
                    Q.where('branch_id', options.branchId),
                    Q.where('deleted_at', Q.eq(null))
                ).fetch();
                bus.forEach((b: any) => eligibleUnitIds!.add(b.id));
            } catch {}
        } else if (options?.businessUnitId) {
            eligibleUnitIds = new Set([options.businessUnitId]);
        }

        // Aggregate debits and credits per account code
        const aggregates = new Map<string, { totalDebit: number; totalCredit: number }>();
        for (const line of allLines) {
            if (eligibleUnitIds && (!line.businessUnitId || !eligibleUnitIds.has(line.businessUnitId))) {
                continue;
            }
            const accountCode = normalizeAccountCode(line.accountCode);
            if (!aggregates.has(accountCode)) {
                aggregates.set(accountCode, { totalDebit: 0, totalCredit: 0 });
            }
            const agg = aggregates.get(accountCode)!;
            agg.totalDebit += line.debitAmount ?? 0;
            agg.totalCredit += line.creditAmount ?? 0;
        }

        const rows: TrialBalanceRow[] = accounts.map(account => {
            const agg = aggregates.get(account.code) ?? { totalDebit: 0, totalCredit: 0 };
            const netBalance = account.normalBalance === 'debit'
                ? agg.totalDebit - agg.totalCredit
                : agg.totalCredit - agg.totalDebit;

            return {
                code: account.code,
                name: account.name,
                accountType: account.accountType,
                normalBalance: account.normalBalance,
                totalDebit: agg.totalDebit,
                totalCredit: agg.totalCredit,
                netBalance,
            };
        });
        const knownAccountCodes = new Set(accounts.map(account => account.code));
        const unmappedRows: TrialBalanceRow[] = [...aggregates.entries()]
            .filter(([code]) => !knownAccountCodes.has(code))
            .map(([code, aggregate]) => ({
                code,
                name: `Unmapped account ${code}`,
                accountType: 'unknown',
                normalBalance: 'debit',
                totalDebit: aggregate.totalDebit,
                totalCredit: aggregate.totalCredit,
                netBalance: aggregate.totalDebit - aggregate.totalCredit,
            }));
        const allRows = [...rows, ...unmappedRows];


        // Only include accounts that have activity
        const activeRows = allRows.filter(r => r.totalDebit > 0 || r.totalCredit > 0);

        const totalDebits = activeRows.reduce((s, r) => s + r.totalDebit, 0);
        const totalCredits = activeRows.reduce((s, r) => s + r.totalCredit, 0);

        return {
            asOf,
            rows: activeRows,
            totalDebits,
            totalCredits,
            isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
        };
    }

    // ─── Summary Balances for Financial Statements ────────────────────────────

    /**
     * Get total balance for all accounts of a given type (e.g., all income accounts).
     * Useful for Balance Sheet and Income Statement computation.
     */
    async getTypeBalance(accountType: string, asOf: Date): Promise<number> {
        const coaService = new ChartOfAccountsServiceClass(this.db);
        const accounts = await coaService.getByType(accountType as any);
        const postableAccounts = accounts.filter(a => !a.isHeader && a.isActive);

        let total = 0;
        for (const account of postableAccounts) {
            const balance = await this.getAccountBalance(account.code, asOf);
            total += balance;
        }
        return total;
    }
}

const instance = new JournalEntryServiceClass();
export { instance as JournalEntryService };
export default instance;
