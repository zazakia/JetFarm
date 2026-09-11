/**
 * ChartOfAccountsService
 *
 * Manages the Chart of Accounts (CoA) for the cooperative's accounting system.
 * Follows a Philippine cooperative-standard account code structure (CDA-aligned),
 * using 4-digit codes: 1000=Assets, 2000=Liabilities, 3000=Equity, 4000=Income, 5000=Expenses.
 *
 * Features:
 * - Full CRUD with validation (unique codes, type constraints)
 * - Hierarchical tree grouping for UI rendering
 * - Auto-seeding of default CDA-aligned accounts
 * - Blocking soft-delete if account has journal postings
 */

import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import ChartOfAccount from '../database/models/ChartOfAccount';
import ActionLogService from './ActionLogService';
import CryptoJS from 'crypto-js';

function getDeterministicCoaId(code: string): string {
    const md5Hex = CryptoJS.MD5(code).toString();
    return [
        md5Hex.substring(0, 8),
        md5Hex.substring(8, 12),
        md5Hex.substring(12, 16),
        md5Hex.substring(16, 20),
        md5Hex.substring(20)
    ].join('-');
}

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type NormalBalance = 'debit' | 'credit';

export interface CoACreateInput {
    code: string;
    name: string;
    accountType: AccountType;
    normalBalance: NormalBalance;
    parentCode?: string;
    isHeader?: boolean;
    description?: string;
    sortOrder?: number;
}

export interface CoAAccountNode {
    code: string;
    name: string;
    accountType: AccountType;
    normalBalance: NormalBalance;
    parentCode: string | null;
    isHeader: boolean;
    isActive: boolean;
    description: string | null;
    sortOrder: number | null;
    id: string;
    children: CoAAccountNode[];
}

export interface CoATree {
    assets: CoAAccountNode[];
    liabilities: CoAAccountNode[];
    equity: CoAAccountNode[];
    income: CoAAccountNode[];
    expenses: CoAAccountNode[];
}

/** Default Philippine cooperative Chart of Accounts (CDA-aligned) */
const DEFAULT_ACCOUNTS: CoACreateInput[] = [
    // ── ASSETS (1000s) ────────────────────────────────
    { code: '1000', name: 'ASSETS', accountType: 'asset', normalBalance: 'debit', isHeader: true, sortOrder: 1 },
    { code: '1010', name: 'Cash on Hand (COH)', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 2 },
    { code: '1011', name: 'Cash on Hand — Petty Cash', accountType: 'asset', normalBalance: 'debit', parentCode: '1010', sortOrder: 3 },
    { code: '1020', name: 'Cash in Bank — BDO', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 4 },
    { code: '1030', name: 'Cash in Bank — PNB', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 5 },
    { code: '1040', name: 'Cash in Bank — Other', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 6 },
    { code: '1100', name: 'Loans Receivable', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 10 },
    { code: '1110', name: 'Allowance for Loan Losses', accountType: 'asset', normalBalance: 'credit', parentCode: '1100', sortOrder: 11, description: 'Contra-asset reducing Loans Receivable' },
    { code: '1200', name: 'Savings Loan Receivable', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 15 },
    { code: '1210', name: 'Merchandise Inventory — Agri-Store', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 16 },
    { code: '1220', name: 'Merchandise Inventory — Pharmacy', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 17 },
    { code: '1230', name: 'Merchandise Inventory — Marketplace', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 18 },
    { code: '1300', name: 'Interest Receivable', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 20 },
    { code: '1400', name: 'Prepaid Expenses', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 25 },
    { code: '1500', name: 'Other Receivables', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 30 },
    { code: '1600', name: 'Property and Equipment (net)', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 35 },
    { code: '1700', name: 'Other Assets', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 40 },
    { code: '1710', name: 'Other Non-Current Assets (Sundry)', accountType: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 41 },

    // ── LIABILITIES (2000s) ───────────────────────────
    { code: '2000', name: 'LIABILITIES', accountType: 'liability', normalBalance: 'credit', isHeader: true, sortOrder: 100 },
    { code: '2010', name: 'Savings Deposits Payable', accountType: 'liability', normalBalance: 'credit', parentCode: '2000', sortOrder: 101 },
    { code: '2020', name: 'Share Capital Payable', accountType: 'liability', normalBalance: 'credit', parentCode: '2000', sortOrder: 102 },
    { code: '2030', name: 'Accounts Payable', accountType: 'liability', normalBalance: 'credit', parentCode: '2000', sortOrder: 103 },
    { code: '2040', name: 'Accrued Expenses Payable', accountType: 'liability', normalBalance: 'credit', parentCode: '2000', sortOrder: 104 },
    { code: '2050', name: 'Interest on Share Capital Payable', accountType: 'liability', normalBalance: 'credit', parentCode: '2000', sortOrder: 105 },
    { code: '2060', name: 'Patronage Refund Payable', accountType: 'liability', normalBalance: 'credit', parentCode: '2000', sortOrder: 106 },
    { code: '2070', name: 'Due to Union/Federation', accountType: 'liability', normalBalance: 'credit', parentCode: '2000', sortOrder: 107 },
    { code: '2100', name: 'Other Payables', accountType: 'liability', normalBalance: 'credit', parentCode: '2000', sortOrder: 110 },

    // ── EQUITY (3000s) ────────────────────────────────
    { code: '3000', name: 'FUND BALANCE / EQUITY', accountType: 'equity', normalBalance: 'credit', isHeader: true, sortOrder: 200 },
    { code: '3010', name: 'Share Capital', accountType: 'equity', normalBalance: 'credit', parentCode: '3000', sortOrder: 201 },
    { code: '3020', name: 'Reserve Fund', accountType: 'equity', normalBalance: 'credit', parentCode: '3000', sortOrder: 202 },
    { code: '3030', name: 'Education Fund', accountType: 'equity', normalBalance: 'credit', parentCode: '3000', sortOrder: 203 },
    { code: '3040', name: 'Community Development Fund', accountType: 'equity', normalBalance: 'credit', parentCode: '3000', sortOrder: 204 },
    { code: '3050', name: 'Optional Fund', accountType: 'equity', normalBalance: 'credit', parentCode: '3000', sortOrder: 205 },
    { code: '3060', name: 'Retained Surplus / (Deficit)', accountType: 'equity', normalBalance: 'credit', parentCode: '3000', sortOrder: 210 },

    // ── INCOME (4000s) ────────────────────────────────
    { code: '4000', name: 'INCOME', accountType: 'income', normalBalance: 'credit', isHeader: true, sortOrder: 300 },
    { code: '4010', name: 'Interest on Loans', accountType: 'income', normalBalance: 'credit', parentCode: '4000', sortOrder: 301 },
    { code: '4020', name: 'Service Charges', accountType: 'income', normalBalance: 'credit', parentCode: '4000', sortOrder: 302 },
    { code: '4030', name: 'Membership Fees', accountType: 'income', normalBalance: 'credit', parentCode: '4000', sortOrder: 303 },
    { code: '4040', name: 'Penalties & Fines', accountType: 'income', normalBalance: 'credit', parentCode: '4000', sortOrder: 304 },
    { code: '4050', name: 'Dividend Income', accountType: 'income', normalBalance: 'credit', parentCode: '4000', sortOrder: 305 },
    { code: '4060', name: 'Other Income', accountType: 'income', normalBalance: 'credit', parentCode: '4000', sortOrder: 310 },
    { code: '4070', name: 'Miscellaneous Income', accountType: 'income', normalBalance: 'credit', parentCode: '4000', sortOrder: 311 },
    { code: '4100', name: 'Water Sales Revenue', accountType: 'income', normalBalance: 'credit', parentCode: '4000', sortOrder: 320 },
    { code: '4110', name: 'Sales Revenue — Agri-Store', accountType: 'income', normalBalance: 'credit', parentCode: '4000', sortOrder: 321 },
    { code: '4120', name: 'Sales Revenue — Pharmacy', accountType: 'income', normalBalance: 'credit', parentCode: '4000', sortOrder: 322 },
    { code: '4130', name: 'Sales Revenue — Marketplace', accountType: 'income', normalBalance: 'credit', parentCode: '4000', sortOrder: 323 },

    // ── EXPENSES (5000s) ──────────────────────────────
    { code: '5000', name: 'EXPENSES', accountType: 'expense', normalBalance: 'debit', isHeader: true, sortOrder: 400 },
    { code: '5010', name: 'Salaries & Wages', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 401 },
    { code: '5020', name: 'Office Expenses', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 402 },
    { code: '5030', name: 'Communication Expenses', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 403 },
    { code: '5040', name: 'Transportation Expenses', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 404 },
    { code: '5050', name: 'Depreciation & Amortization', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 405 },
    { code: '5060', name: 'Taxes & Licenses', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 406 },
    { code: '5070', name: 'Repairs & Maintenance', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 407 },
    { code: '5080', name: 'Training & Development', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 408 },
    { code: '5090', name: 'Professional Fees', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 409 },
    { code: '5100', name: 'Other Operating Expenses', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 420 },
    { code: '5110', name: 'Interest on Deposit Liabilities', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 421 },
    { code: '5130', name: 'Cost of Goods Sold — Agri-Store', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 423 },
    { code: '5140', name: 'Cost of Goods Sold — Pharmacy', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 424 },
    { code: '5150', name: 'Cost of Goods Sold — Marketplace', accountType: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 425 },
];

export class ChartOfAccountsServiceClass {
    protected db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    // ─── Read ──────────────────────────────────────────────────────────────────

    async getAll(): Promise<ChartOfAccount[]> {
        return this.db.collections
            .get<ChartOfAccount>('chart_of_accounts')
            .query(
                Q.where('deleted_at', Q.eq(null)),
                Q.sortBy('sort_order', Q.asc)
            )
            .fetch();
    }

    async getByType(accountType: AccountType): Promise<ChartOfAccount[]> {
        return this.db.collections
            .get<ChartOfAccount>('chart_of_accounts')
            .query(
                Q.where('deleted_at', Q.eq(null)),
                Q.where('account_type', accountType),
                Q.sortBy('sort_order', Q.asc)
            )
            .fetch();
    }

    async getActivePostableAccounts(): Promise<ChartOfAccount[]> {
        return this.db.collections
            .get<ChartOfAccount>('chart_of_accounts')
            .query(
                Q.where('deleted_at', Q.eq(null)),
                Q.where('is_active', true),
                Q.where('is_header', Q.notEq(true)),
                Q.sortBy('sort_order', Q.asc)
            )
            .fetch();
    }

    async getByCode(code: string): Promise<ChartOfAccount | null> {
        const results = await this.db.collections
            .get<ChartOfAccount>('chart_of_accounts')
            .query(
                Q.where('code', code),
                Q.where('deleted_at', Q.eq(null))
            )
            .fetch();
        return results[0] ?? null;
    }

    async getById(id: string): Promise<ChartOfAccount | null> {
        try {
            return await this.db.collections
                .get<ChartOfAccount>('chart_of_accounts')
                .find(id);
        } catch {
            return null;
        }
    }

    /** Build a full account tree grouped by type */
    async getTree(): Promise<CoATree> {
        const all = await this.getAll();
        const toNode = (acc: ChartOfAccount): CoAAccountNode => ({
            id: acc.id,
            code: acc.code,
            name: acc.name,
            accountType: acc.accountType as AccountType,
            normalBalance: acc.normalBalance as NormalBalance,
            parentCode: acc.parentCode,
            isHeader: acc.isHeader ?? false,
            isActive: acc.isActive ?? true,
            description: acc.description,
            sortOrder: acc.sortOrder,
            children: [],
        });

        const nodeMap = new Map<string, CoAAccountNode>();
        const nodes = all.map(toNode);
        nodes.forEach(n => nodeMap.set(n.code, n));

        const roots: { [type: string]: CoAAccountNode[] } = {
            asset: [], liability: [], equity: [], income: [], expense: [],
        };

        nodes.forEach(node => {
            if (node.parentCode && nodeMap.has(node.parentCode)) {
                nodeMap.get(node.parentCode)!.children.push(node);
            } else {
                roots[node.accountType]?.push(node);
            }
        });

        return {
            assets: roots.asset,
            liabilities: roots.liability,
            equity: roots.equity,
            income: roots.income,
            expenses: roots.expense,
        };
    }

    // ─── Create ────────────────────────────────────────────────────────────────

    async create(input: CoACreateInput, performedBy?: string): Promise<ChartOfAccount> {
        // Validate unique code
        const existing = await this.getByCode(input.code);
        if (existing) {
            throw new Error(`Account code "${input.code}" already exists.`);
        }

        let newRecord!: ChartOfAccount;
        await this.db.write(async () => {
            newRecord = await this.db.get<ChartOfAccount>('chart_of_accounts').create(record => {
                record._raw.id = getDeterministicCoaId(input.code);
                record.code = input.code;
                record.name = input.name;
                (record as any).accountType = input.accountType;
                (record as any).normalBalance = input.normalBalance;
                (record as any).parentCode = input.parentCode ?? null;
                (record as any).isHeader = input.isHeader ?? false;
                (record as any).isActive = true;
                (record as any).description = input.description ?? null;
                (record as any).sortOrder = input.sortOrder ?? null;
            });
        });

        await ActionLogService.logAction({
            entityType: 'chart_of_accounts',
            entityId: newRecord.id,
            action: 'CREATE',
            newData: newRecord._raw,
            performedBy,
        });

        return newRecord;
    }

    // ─── Update ────────────────────────────────────────────────────────────────

    async update(id: string, input: Partial<CoACreateInput>, performedBy?: string): Promise<ChartOfAccount> {
        const record = await this.getById(id);
        if (!record) throw new Error(`Account not found: ${id}`);

        // If changing code, validate uniqueness
        if (input.code && input.code !== record.code) {
            const existing = await this.getByCode(input.code);
            if (existing) throw new Error(`Account code "${input.code}" already exists.`);
        }

        const oldData = { ...record._raw };
        await this.db.write(async () => {
            await record.update(r => {
                if (input.code !== undefined) r.code = input.code!;
                if (input.name !== undefined) r.name = input.name!;
                if (input.accountType !== undefined) (r as any).accountType = input.accountType;
                if (input.normalBalance !== undefined) (r as any).normalBalance = input.normalBalance;
                if (input.parentCode !== undefined) (r as any).parentCode = input.parentCode ?? null;
                if (input.isHeader !== undefined) (r as any).isHeader = input.isHeader;
                if (input.description !== undefined) (r as any).description = input.description ?? null;
                if (input.sortOrder !== undefined) (r as any).sortOrder = input.sortOrder ?? null;
            });
        });

        await ActionLogService.logAction({
            entityType: 'chart_of_accounts',
            entityId: id,
            action: 'UPDATE',
            oldData,
            newData: record._raw,
            performedBy,
        });

        return record;
    }

    async setActive(id: string, isActive: boolean, performedBy?: string): Promise<void> {
        const record = await this.getById(id);
        if (!record) throw new Error(`Account not found: ${id}`);

        await this.db.write(async () => {
            await record.update(r => {
                (r as any).isActive = isActive;
            });
        });

        await ActionLogService.logAction({
            entityType: 'chart_of_accounts',
            entityId: id,
            action: 'UPDATE',
            oldData: { is_active: !isActive },
            newData: { is_active: isActive },
            performedBy,
        });
    }

    // ─── Soft Delete ───────────────────────────────────────────────────────────

    async softDelete(id: string, performedBy?: string): Promise<void> {
        const record = await this.getById(id);
        if (!record) throw new Error(`Account not found: ${id}`);

        // Block deletion of Chart of Accounts items to preserve financial audit trails
        throw new Error(
            `Cannot delete account "${record.code} — ${record.name}": Chart of Accounts entries cannot be deleted once added. Please deactivate the account instead.`
        );
    }

    // ─── Seed ─────────────────────────────────────────────────────────────────

    /**
     * Seeds the default CDA-aligned Philippine cooperative Chart of Accounts.
     * Skips accounts that already exist (idempotent).
     * Returns the number of accounts created.
     */
    async seed(performedBy?: string): Promise<number> {
        const existing = await this.getAll();
        const existingCodes = new Set(existing.map(a => a.code));

        const toCreate = DEFAULT_ACCOUNTS.filter(a => !existingCodes.has(a.code));
        if (toCreate.length === 0) return 0;

        let createdCount = 0;

        await this.db.write(async () => {
            const preparedRecords = toCreate.map(input =>
                this.db.get<ChartOfAccount>('chart_of_accounts').prepareCreate(record => {
                    record._raw.id = getDeterministicCoaId(input.code);
                    record.code = input.code;
                    record.name = input.name;
                    (record as any).accountType = input.accountType;
                    (record as any).normalBalance = input.normalBalance;
                    (record as any).parentCode = input.parentCode ?? null;
                    (record as any).isHeader = input.isHeader ?? false;
                    (record as any).isActive = true;
                    (record as any).description = input.description ?? null;
                    (record as any).sortOrder = input.sortOrder ?? null;
                })
            );
            await this.db.batch(...preparedRecords);
            createdCount = preparedRecords.length;
        });

        if (performedBy) {
            await ActionLogService.logAction({
                entityType: 'chart_of_accounts',
                entityId: 'seed',
                action: 'CREATE',
                newData: { seeded: createdCount },
                performedBy,
            });
        }

        return createdCount;
    }

    /** Check if CoA has been seeded (any accounts exist) */
    async isSeeded(): Promise<boolean> {
        const count = await this.db.collections
            .get('chart_of_accounts')
            .query(Q.where('deleted_at', Q.eq(null)))
            .fetchCount();
        return count > 0;
    }

    /**
     * Retroactively updates existing local chart of accounts records to use deterministic IDs.
     * Deletes duplicates and updates existing records to match server IDs.
     */
    async ensureDeterministicIds(): Promise<void> {
        const coaCollection = this.db.get<ChartOfAccount>('chart_of_accounts');
        const allCoas = await coaCollection.query().fetch();

        const incorrectCoas = allCoas.filter(coa => coa.id !== getDeterministicCoaId(coa.code));
        if (incorrectCoas.length === 0) return;

        await this.db.write(async () => {
            for (const coa of incorrectCoas) {
                const correctId = getDeterministicCoaId(coa.code);
                let correctCoa: ChartOfAccount | null = null;
                try {
                    correctCoa = await coaCollection.find(correctId);
                } catch (e) {
                    // Not found
                }

                if (!correctCoa) {
                    await coaCollection.create(newRecord => {
                        newRecord._raw.id = correctId;
                        newRecord._raw._status = coa._raw._status === 'synced' ? 'synced' : 'created';
                        newRecord.code = coa.code;
                        newRecord.name = coa.name;
                        (newRecord as any).accountType = (coa as any).accountType;
                        (newRecord as any).normalBalance = (coa as any).normalBalance;
                        (newRecord as any).parentCode = (coa as any).parentCode;
                        (newRecord as any).isHeader = (coa as any).isHeader;
                        (newRecord as any).isActive = (coa as any).isActive;
                        (newRecord as any).description = (coa as any).description;
                        (newRecord as any).sortOrder = (coa as any).sortOrder;
                    });
                } else {
                    if (coa._raw._status !== 'synced') {
                        await correctCoa.update(rec => {
                            rec.name = coa.name;
                            (rec as any).accountType = (coa as any).accountType;
                            (rec as any).normalBalance = (coa as any).normalBalance;
                            (rec as any).parentCode = (coa as any).parentCode;
                            (rec as any).isHeader = (coa as any).isHeader;
                            (rec as any).isActive = (coa as any).isActive;
                            (rec as any).description = (coa as any).description;
                            (rec as any).sortOrder = (coa as any).sortOrder;
                        });
                    }
                }
                await coa.destroyPermanently();
            }
        });
    }
}

const instance = new ChartOfAccountsServiceClass();
export { instance as ChartOfAccountsService };
export default instance;
