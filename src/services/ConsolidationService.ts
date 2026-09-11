import { Database, Q } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import JournalEntry from '../database/models/JournalEntry';
import JournalEntryLine from '../database/models/JournalEntryLine';
import ChartOfAccount from '../database/models/ChartOfAccount';
import { AccountType, NormalBalance } from './ChartOfAccountsService';

export interface BuPnLResult {
    businessUnitId: string | null; // null for consolidated
    year: number;
    revenues: { code: string; name: string; balance: number }[];
    expenses: { code: string; name: string; balance: number }[];
    totalRevenues: number;
    totalExpenses: number;
    netSurplus: number;
}

export interface BuBalanceSheetResult {
    businessUnitId: string | null;
    year: number;
    assets: { code: string; name: string; balance: number }[];
    liabilities: { code: string; name: string; balance: number }[];
    equity: { code: string; name: string; balance: number }[];
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
}

export class ConsolidationServiceClass {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    /**
     * Compute GL balances as-of a specific date, optionally filtered by Business Unit ID.
     * If businessUnitId is provided, aggregates only lines tagged with that ID.
     * If businessUnitId is null/undefined, aggregates all lines (consolidated).
     */
    async getBalances(asOf: Date, businessUnitId?: string): Promise<Map<string, number>> {
        const balances = new Map<string, number>();
        const asOfMs = asOf.getTime();

        // 1. Fetch all posted, undeleted journal entries <= asOf
        const entries = await this.db.collections
            .get<JournalEntry>('journal_entries')
            .query(
                Q.where('entry_date', Q.lte(asOfMs)),
                Q.where('is_posted', true),
                Q.where('deleted_at', Q.eq(null))
            )
            .fetch();

        const entryIds = entries.map(e => e.id);
        if (entryIds.length === 0) return balances;

        // 2. Fetch all lines for these entries, filtering by business unit if specified
        const clauses: Q.Clause[] = [
            Q.where('journal_entry_id', Q.oneOf(entryIds)),
            Q.where('deleted_at', Q.eq(null))
        ];

        if (businessUnitId) {
            if (businessUnitId === 'coop-base') {
                clauses.push(Q.where('business_unit_id', Q.eq(null)));
            } else {
                clauses.push(Q.where('business_unit_id', businessUnitId));
            }
        }

        const lines = await this.db.collections
            .get<JournalEntryLine>('journal_entry_lines')
            .query(...clauses)
            .fetch();

        // 3. Aggregate debits and credits per account code
        const aggregates = new Map<string, { dr: number; cr: number }>();
        for (const line of lines) {
            if (!aggregates.has(line.accountCode)) {
                aggregates.set(line.accountCode, { dr: 0, cr: 0 });
            }
            const agg = aggregates.get(line.accountCode)!;
            agg.dr += line.debitAmount ?? 0;
            agg.cr += line.creditAmount ?? 0;
        }

        // 4. Fetch all accounts to determine normal balance
        const accounts = await this.db.collections
            .get<ChartOfAccount>('chart_of_accounts')
            .query(Q.where('deleted_at', Q.eq(null)))
            .fetch();

        for (const account of accounts) {
            const agg = aggregates.get(account.code) ?? { dr: 0, cr: 0 };
            const balance = account.normalBalance === 'debit'
                ? agg.dr - agg.cr
                : agg.cr - agg.dr;
            
            // Only include accounts that have a non-zero balance (or are active)
            if (balance !== 0 || agg.dr > 0 || agg.cr > 0) {
                balances.set(account.code, balance);
            }
        }

        return balances;
    }

    /**
     * Compute Profit and Loss (Income / Operations Statement) for a business unit or consolidated.
     */
    async getPnL(year: number, businessUnitId?: string): Promise<BuPnLResult> {
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
        
        // Fetch balances as of end of year
        const balances = await this.getBalances(endOfYear, businessUnitId);

        // Fetch accounts details
        const accounts = await this.db.collections
            .get<ChartOfAccount>('chart_of_accounts')
            .query(Q.where('deleted_at', Q.eq(null)))
            .fetch();

        const revenues: { code: string; name: string; balance: number }[] = [];
        const expenses: { code: string; name: string; balance: number }[] = [];
        let totalRevenues = 0;
        let totalExpenses = 0;

        for (const account of accounts) {
            const balance = balances.get(account.code) ?? 0;
            if (balance === 0) continue;

            if (account.accountType === 'income') {
                revenues.push({ code: account.code, name: account.name, balance });
                totalRevenues += balance;
            } else if (account.accountType === 'expense') {
                expenses.push({ code: account.code, name: account.name, balance });
                totalExpenses += balance;
            }
        }

        return {
            businessUnitId: businessUnitId ?? null,
            year,
            revenues,
            expenses,
            totalRevenues,
            totalExpenses,
            netSurplus: totalRevenues - totalExpenses
        };
    }

    /**
     * Compute Balance Sheet (Statement of Financial Condition) for a business unit or consolidated.
     */
    async getBalanceSheet(year: number, businessUnitId?: string): Promise<BuBalanceSheetResult> {
        const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
        const balances = await this.getBalances(endOfYear, businessUnitId);

        const accounts = await this.db.collections
            .get<ChartOfAccount>('chart_of_accounts')
            .query(Q.where('deleted_at', Q.eq(null)))
            .fetch();

        const assets: { code: string; name: string; balance: number }[] = [];
        const liabilities: { code: string; name: string; balance: number }[] = [];
        const equity: { code: string; name: string; balance: number }[] = [];

        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;

        // Calculate unclosed net surplus (Revenue - Expenses) to add to Equity (Retained Surplus)
        let unclosedNetSurplus = 0;
        for (const account of accounts) {
            const balance = balances.get(account.code) ?? 0;
            if (account.accountType === 'income') {
                unclosedNetSurplus += balance;
            } else if (account.accountType === 'expense') {
                unclosedNetSurplus -= balance;
            }
        }

        for (const account of accounts) {
            let balance = balances.get(account.code) ?? 0;

            // Retained surplus (usually account '3060') should absorb the unclosed net surplus
            if (account.code === '3060') {
                balance += unclosedNetSurplus;
            }

            if (balance === 0) continue;

            if (account.accountType === 'asset') {
                assets.push({ code: account.code, name: account.name, balance });
                totalAssets += balance;
            } else if (account.accountType === 'liability') {
                liabilities.push({ code: account.code, name: account.name, balance });
                totalLiabilities += balance;
            } else if (account.accountType === 'equity') {
                equity.push({ code: account.code, name: account.name, balance });
                totalEquity += balance;
            }
        }

        // If retained surplus doesn't exist as an account but we have unclosed net surplus, we add it as a row
        const hasRetainedSurplusRow = equity.some(e => e.code === '3060');
        if (!hasRetainedSurplusRow && unclosedNetSurplus !== 0) {
            equity.push({ code: '3060', name: 'Retained Surplus / (Deficit) (Unclosed)', balance: unclosedNetSurplus });
            totalEquity += unclosedNetSurplus;
        }

        return {
            businessUnitId: businessUnitId ?? null,
            year,
            assets,
            liabilities,
            equity,
            totalAssets,
            totalLiabilities,
            totalEquity
        };
    }
}

export const ConsolidationService = new ConsolidationServiceClass();
export default ConsolidationService;
