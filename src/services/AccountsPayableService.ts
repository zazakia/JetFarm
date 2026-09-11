/**
 * AccountsPayableService
 *
 * Manages Accounts Payable (AP) vouchers — the liability incurred when goods or
 * services are received from suppliers on credit.
 *
 * Journal Entries:
 * On voucher creation:
 *   DR: Expense/Inventory account (e.g., 5xxx or 1210)
 *   CR: 2030 Accounts Payable
 *
 * On payment:
 *   DR: 2030 Accounts Payable
 *   CR: 1010 Cash on Hand (or 1020 Cash in Bank)
 */

import { Q, Database } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import AccountsPayableVoucher from '../database/models/AccountsPayableVoucher';
import Supplier from '../database/models/Supplier';
import { JournalEntryServiceClass } from './JournalEntryService';
import ActionLogService from './ActionLogService';

const ACCT = {
    CASH_ON_HAND: '1010',
    CASH_IN_BANK: '1020',
    ACCOUNTS_PAYABLE: '2030',
    OTHER_OPERATING_EXPENSES: '5100',
};

export interface APVoucherInput {
    supplierId: string;
    invoiceNumber?: string;
    invoiceDate: Date;
    dueDate?: Date;
    description: string;
    amount: number;
    expenseAccountCode?: string;
    moduleId?: string;
    postedBy?: string;
}

export interface APVoucherRow {
    voucherId: string;
    voucherNumber: string;
    supplierName: string;
    invoiceNumber: string | null;
    invoiceDate: Date;
    dueDate: Date | null;
    description: string;
    amount: number;
    amountPaid: number;
    balance: number;
    status: string;
    moduleId: string | null;
}

export interface APAgingSummary {
    totalCurrent: number;
    total1to30: number;
    total31to60: number;
    totalOver60: number;
    grandTotal: number;
    asOf: Date;
}

export class AccountsPayableServiceClass {
    private db: Database;
    private journalEntryService: JournalEntryServiceClass;

    constructor(db: Database = globalDatabase) {
        this.db = db;
        this.journalEntryService = new JournalEntryServiceClass(db);
    }

    private async generateVoucherNumber(): Promise<string> {
        const year = new Date().getFullYear();
        const count = await this.db.collections
            .get<AccountsPayableVoucher>('accounts_payable_vouchers')
            .query(Q.where('deleted_at', Q.eq(null)))
            .fetchCount();
        const seq = String(count + 1).padStart(5, '0');
        return `APV-${year}-${seq}`;
    }

    /**
     * Create a new AP voucher and post the corresponding journal entry.
     * DR: Expense/Inventory account
     * CR: 2030 Accounts Payable
     */
    async createVoucher(input: APVoucherInput): Promise<AccountsPayableVoucher> {
        const voucherNumber = await this.generateVoucherNumber();
        const expenseAccount = input.expenseAccountCode ?? ACCT.OTHER_OPERATING_EXPENSES;

        let voucher!: AccountsPayableVoucher;

        await this.db.write(async () => {
            voucher = await this.db.collections.get<AccountsPayableVoucher>('accounts_payable_vouchers').create(v => {
                (v as any).supplierId = input.supplierId;
                (v as any).voucherNumber = voucherNumber;
                (v as any).invoiceNumber = input.invoiceNumber ?? null;
                (v as any).invoiceDate = input.invoiceDate.getTime();
                (v as any).dueDate = input.dueDate?.getTime() ?? null;
                v.description = input.description;
                v.amount = input.amount;
                (v as any).amountPaid = 0;
                v.balance = input.amount;
                v.status = 'open';
                (v as any).expenseAccountCode = expenseAccount;
                (v as any).moduleId = input.moduleId ?? null;
                (v as any).postedBy = input.postedBy ?? null;
            });
        });

        // Post journal entry
        await this.journalEntryService.createEntry({
            entryDate: input.invoiceDate,
            description: `AP Voucher ${voucherNumber}: ${input.description}`,
            entryType: 'auto',
            sourceTable: 'accounts_payable_vouchers',
            sourceId: voucher.id,
            postedBy: input.postedBy,
            lines: [
                {
                    accountCode: expenseAccount,
                    debitAmount: input.amount,
                    description: input.description,
                },
                {
                    accountCode: ACCT.ACCOUNTS_PAYABLE,
                    accountName: 'Accounts Payable',
                    creditAmount: input.amount,
                    description: `Payable to supplier (${voucherNumber})`,
                },
            ],
        }, input.postedBy);

        await ActionLogService.logAction({
            entityType: 'accounts_payable_vouchers',
            entityId: voucher.id,
            action: 'CREATE',
            newData: { voucherNumber, amount: input.amount },
            performedBy: input.postedBy,
        });

        return voucher;
    }

    /**
     * Record a payment against an AP voucher.
     * DR: 2030 Accounts Payable
     * CR: 1010 Cash on Hand (or 1020 Cash in Bank)
     */
    async recordPayment(opts: {
        voucherId: string;
        amount: number;
        paymentDate: Date;
        paymentAccountCode?: string;
        postedBy?: string;
    }): Promise<void> {
        const voucher = await this.db.collections
            .get<AccountsPayableVoucher>('accounts_payable_vouchers')
            .find(opts.voucherId);

        if (!voucher) throw new Error(`AP Voucher not found: ${opts.voucherId}`);
        if (voucher.status === 'paid' || voucher.status === 'cancelled') {
            throw new Error(`Cannot pay a ${voucher.status} voucher.`);
        }
        if (opts.amount > voucher.balance + 0.01) {
            throw new Error(`Payment amount ₱${opts.amount.toFixed(2)} exceeds voucher balance ₱${voucher.balance.toFixed(2)}.`);
        }

        const newAmountPaid = (voucher.amountPaid ?? 0) + opts.amount;
        const newBalance = Math.max(0, voucher.balance - opts.amount);
        const newStatus = newBalance <= 0.005 ? 'paid' : 'partial';
        const cashAccount = opts.paymentAccountCode ?? ACCT.CASH_ON_HAND;

        await this.db.write(async () => {
            await voucher.update(v => {
                (v as any).amountPaid = newAmountPaid;
                v.balance = newBalance;
                v.status = newStatus;
            });
        });

        await this.journalEntryService.createEntry({
            entryDate: opts.paymentDate,
            description: `AP Payment: ${voucher.voucherNumber} (${newStatus})`,
            entryType: 'auto',
            sourceTable: 'accounts_payable_vouchers',
            sourceId: opts.voucherId,
            postedBy: opts.postedBy,
            lines: [
                {
                    accountCode: ACCT.ACCOUNTS_PAYABLE,
                    accountName: 'Accounts Payable',
                    debitAmount: opts.amount,
                    description: `Payment for ${voucher.voucherNumber}`,
                },
                {
                    accountCode: cashAccount,
                    debitAmount: 0,
                    creditAmount: opts.amount,
                    description: 'Cash paid to supplier',
                },
            ],
        }, opts.postedBy);

        await ActionLogService.logAction({
            entityType: 'accounts_payable_vouchers',
            entityId: opts.voucherId,
            action: 'UPDATE',
            newData: { amountPaid: newAmountPaid, balance: newBalance, status: newStatus },
            performedBy: opts.postedBy,
        });
    }

    /**
     * Get paginated list of AP vouchers.
     */
    async getVouchers(opts: {
        status?: string;
        supplierId?: string;
        moduleId?: string;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
    } = {}): Promise<AccountsPayableVoucher[]> {
        const clauses: Q.Clause[] = [Q.where('deleted_at', Q.eq(null))];
        if (opts.status) clauses.push(Q.where('status', opts.status));
        if (opts.supplierId) clauses.push(Q.where('supplier_id', opts.supplierId));
        if (opts.moduleId) clauses.push(Q.where('module_id', opts.moduleId));
        if (opts.startDate) clauses.push(Q.where('invoice_date', Q.gte(opts.startDate.getTime())));
        if (opts.endDate) clauses.push(Q.where('invoice_date', Q.lte(opts.endDate.getTime())));
        clauses.push(Q.sortBy('invoice_date', Q.desc));
        if (opts.limit) clauses.push(Q.take(opts.limit));

        return this.db.collections
            .get<AccountsPayableVoucher>('accounts_payable_vouchers')
            .query(...clauses)
            .fetch();
    }

    /**
     * Get supplier list.
     */
    async getSuppliers(activeOnly = true): Promise<Supplier[]> {
        const clauses: Q.Clause[] = [Q.where('deleted_at', Q.eq(null))];
        if (activeOnly) clauses.push(Q.where('is_active', true));
        clauses.push(Q.sortBy('name', Q.asc));
        return this.db.collections.get<Supplier>('suppliers').query(...clauses).fetch();
    }

    /**
     * Create a new supplier record.
     */
    async createSupplier(input: {
        name: string;
        contactPerson?: string;
        phone?: string;
        email?: string;
        address?: string;
        tin?: string;
        paymentTermsDays?: number;
    }): Promise<Supplier> {
        let supplier!: Supplier;
        await this.db.write(async () => {
            supplier = await this.db.collections.get<Supplier>('suppliers').create(s => {
                s.name = input.name;
                (s as any).contactPerson = input.contactPerson ?? null;
                (s as any).phone = input.phone ?? null;
                (s as any).email = input.email ?? null;
                (s as any).address = input.address ?? null;
                (s as any).tin = input.tin ?? null;
                (s as any).paymentTermsDays = input.paymentTermsDays ?? 30;
                (s as any).isActive = true;
            });
        });
        return supplier;
    }

    /**
     * AP aging: groups open/partial vouchers by days overdue.
     */
    async getAgingSummary(asOf: Date): Promise<APAgingSummary> {
        const openVouchers = await this.getVouchers({ status: 'open' });
        const partialVouchers = await this.getVouchers({ status: 'partial' });
        const vouchers = [...openVouchers, ...partialVouchers];

        const asOfMs = asOf.getTime();
        const DAY_MS = 86400000;
        let totalCurrent = 0, total1to30 = 0, total31to60 = 0, totalOver60 = 0;

        for (const v of vouchers) {
            const dueMs = v.dueDate ? (v.dueDate instanceof Date ? v.dueDate.getTime() : Number(v.dueDate)) : (v.invoiceDate instanceof Date ? v.invoiceDate.getTime() : Number(v.invoiceDate));
            const daysOverdue = Math.max(0, Math.floor((asOfMs - dueMs) / DAY_MS));
            const balance = v.balance;
            if (daysOverdue === 0) totalCurrent += balance;
            else if (daysOverdue <= 30) total1to30 += balance;
            else if (daysOverdue <= 60) total31to60 += balance;
            else totalOver60 += balance;
        }

        return {
            totalCurrent,
            total1to30,
            total31to60,
            totalOver60,
            grandTotal: totalCurrent + total1to30 + total31to60 + totalOver60,
            asOf,
        };
    }
}

const instance = new AccountsPayableServiceClass();
export { instance as AccountsPayableService };
export default instance;
