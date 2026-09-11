/**
 * PurchaseJournalService
 *
 * Generates the Purchase Journal (PJ) — a register of all credit purchases
 * (goods or services received on account from suppliers).
 *
 * Queries accounts_payable_vouchers joined with suppliers.
 *
 * PJ Columns:
 * Date | Voucher No. | Supplier | Invoice No. | Inventory DR | Expense DR | AP Credit (2030) | Module
 */

import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import AccountsPayableVoucher from '../database/models/AccountsPayableVoucher';
import Supplier from '../database/models/Supplier';

export interface PJRow {
    date: Date;
    voucherNumber: string;
    supplierName: string;
    supplierTin: string | null;
    invoiceNumber: string | null;
    description: string;
    inventoryDebit: number;
    expenseDebit: number;
    apCredit: number;
    moduleId: string | null;
    voucherId: string;
    status: string;
}

export interface PJSummary {
    rows: PJRow[];
    totalInventoryDebit: number;
    totalExpenseDebit: number;
    totalAPCredit: number;
    periodStart: Date;
    periodEnd: Date;
}

export class PurchaseJournalServiceClass {
    private db: Database;

    constructor(db: Database = globalDatabase) {
        this.db = db;
    }

    async getReport(
        startDate: Date,
        endDate: Date,
        moduleFilter?: string
    ): Promise<PJSummary> {
        const startMs = startDate.getTime();
        const endMs = endDate.getTime();

        const voucherClauses: Q.Clause[] = [
            Q.where('invoice_date', Q.gte(startMs)),
            Q.where('invoice_date', Q.lte(endMs)),
            Q.where('status', Q.notEq('cancelled')),
            Q.where('deleted_at', Q.eq(null)),
            Q.sortBy('invoice_date', Q.asc),
        ];
        if (moduleFilter) voucherClauses.push(Q.where('module_id', moduleFilter));

        const vouchers = await this.db.collections
            .get<AccountsPayableVoucher>('accounts_payable_vouchers')
            .query(...voucherClauses)
            .fetch();

        if (vouchers.length === 0) return this._emptySummary(startDate, endDate);

        const supplierIds = [...new Set(vouchers.map(v => v.supplierId))];
        const suppliers = await this.db.collections
            .get<Supplier>('suppliers')
            .query(Q.where('id', Q.oneOf(supplierIds)))
            .fetch();
        const supplierMap = new Map(suppliers.map(s => [s.id, s]));

        const rows: PJRow[] = vouchers.map(v => {
            const supplier = supplierMap.get(v.supplierId);
            const isInventory = (v.expenseAccountCode ?? '').startsWith('12');
            const invDate = v.invoiceDate instanceof Date ? v.invoiceDate : new Date(v.invoiceDate);
            return {
                date: invDate,
                voucherNumber: v.voucherNumber,
                supplierName: supplier?.name ?? 'Unknown Supplier',
                supplierTin: supplier?.tin ?? null,
                invoiceNumber: v.invoiceNumber,
                description: v.description,
                inventoryDebit: isInventory ? v.amount : 0,
                expenseDebit: isInventory ? 0 : v.amount,
                apCredit: v.amount,
                moduleId: v.moduleId,
                voucherId: v.id,
                status: v.status,
            };
        });

        return {
            rows,
            totalInventoryDebit: rows.reduce((s, r) => s + r.inventoryDebit, 0),
            totalExpenseDebit: rows.reduce((s, r) => s + r.expenseDebit, 0),
            totalAPCredit: rows.reduce((s, r) => s + r.apCredit, 0),
            periodStart: startDate,
            periodEnd: endDate,
        };
    }

    private _emptySummary(startDate: Date, endDate: Date): PJSummary {
        return { rows: [], totalInventoryDebit: 0, totalExpenseDebit: 0, totalAPCredit: 0, periodStart: startDate, periodEnd: endDate };
    }
}

const instance = new PurchaseJournalServiceClass();
export { instance as PurchaseJournalService };
export default instance;
