import { database } from '../database';
import { Database, Q } from '@nozbe/watermelondb';
import CashTransaction from '../database/models/CashTransaction';
import Expense from '../database/models/Expense';
import { coerceMoneyAmount } from '../utils/currency';
import { ErrorService } from "./ErrorService";

// ---------------------------------------------------------------------------
// Balance Breakdown Types
// ---------------------------------------------------------------------------

export interface BreakdownItem {
    id: string;
    label: string;
    date: number;   // epoch ms
    amount: number; // absolute value
}

export interface BreakdownCategory {
    key: string;
    label: string;
    sign: '+' | '-';
    total: number;
    items: BreakdownItem[];
}

export interface BalanceBreakdown {
    balance: number;
    categories: BreakdownCategory[];
}

/**
 * Soft-delete filter — used in every query to exclude logically deleted records.
 */
const NOT_DELETED = Q.where('deleted_at', null);

/**
 * Cash in the box is now derived from the two tables this branch actually keeps:
 * manual cash transactions and recorded expenses. The former remittance, loan
 * payment, savings and share-capital feeds were cooperative-lending artefacts
 * and their tables are retired on this branch.
 */
export class CashService {
    private db: Database;
    constructor(db: Database = database) {
        this.db = db;
    }

    private static defaultInstance = new CashService();

    static async getCurrentBalance(): Promise<number> {
        return this.defaultInstance.getCurrentBalance();
    }

    static async getPettyCashBalance(): Promise<number> {
        return this.defaultInstance.getPettyCashBalance();
    }

    static async getBalanceBreakdown(): Promise<BalanceBreakdown> {
        return this.defaultInstance.getBalanceBreakdown();
    }

    async getPettyCashBalance(): Promise<number> {
        try {
            if (!this.db || !this.db.collections) {
                ErrorService.handleError(new Error('CashService.getPettyCashBalance: Database or collections not initialized'), 'CashService.getPettyCashBalance: Database or collections not initialized');
                return 0;
            }
            const txnsCollection = this.db.collections.get<CashTransaction>('cash_transactions');
            if (!txnsCollection) {
                return 0;
            }

            const txns = await txnsCollection.query(
                NOT_DELETED,
                Q.where('is_petty_cash', true)
            ).fetch();

            const startingBalance = txns
                .filter(t => t.type === 'starting_balance')
                .reduce((s, t) => s + coerceMoneyAmount(t.amount), 0);

            const cashIn = txns
                .filter(t => t.type === 'in')
                .reduce((s, t) => s + coerceMoneyAmount(t.amount), 0);

            const cashOut = txns
                .filter(t => t.type === 'out')
                .reduce((s, t) => s + coerceMoneyAmount(t.amount), 0);

            return startingBalance + cashIn - cashOut;
        } catch (e) {
            ErrorService.handleError(e, 'CashService.getPettyCashBalance error:');
            return 0;
        }
    }

    /**
     * Shared read of the two feeds the cash balance is built from.
     */
    private async readCashInputs() {
        const txnsCollection = this.db.collections.get<CashTransaction>('cash_transactions');
        const expensesCollection = this.db.collections.get<Expense>('expenses');
        if (!txnsCollection || !expensesCollection) {
            return null;
        }

        const txns = await txnsCollection.query(
            NOT_DELETED,
            Q.or(Q.where('is_petty_cash', null), Q.where('is_petty_cash', false))
        ).fetch();

        // Manual movements are only counted from the first starting balance onward.
        const startingBalTxn = txns.find(t => t.type === 'starting_balance');
        const rawCutoff = startingBalTxn ? startingBalTxn.transactionDate : 0;
        const cutoffDate = (rawCutoff && !isNaN(Number(rawCutoff))) ? Number(rawCutoff) : 0;

        const expenses = await expensesCollection.query(NOT_DELETED).fetch();

        const startingBalanceTxns = txns.filter(t => t.type === 'starting_balance');
        const cashInTxns = txns.filter(t => t.type === 'in' && t.transactionDate >= cutoffDate);
        const cashOutTxns = txns.filter(t => t.type === 'out' && t.transactionDate >= cutoffDate);
        const expenseFiltered = expenses.filter(e => (e.createdAt || 0) >= cutoffDate);

        return {
            startingBalanceTxns,
            cashInTxns,
            cashOutTxns,
            expenseFiltered,
            startingBalance: startingBalanceTxns.reduce((s, t) => s + coerceMoneyAmount(t.amount), 0),
            cashIn: cashInTxns.reduce((s, t) => s + coerceMoneyAmount(t.amount), 0),
            cashOut: cashOutTxns.reduce((s, t) => s + coerceMoneyAmount(t.amount), 0),
            expensesTotal: expenseFiltered.reduce((s, e) => s + coerceMoneyAmount(e.amount), 0),
        };
    }

    async getCurrentBalance(): Promise<number> {
        try {
            if (!this.db || !this.db.collections) {
                ErrorService.handleError(new Error('CashService.getCurrentBalance: Database or collections not initialized'), 'CashService.getCurrentBalance: Database or collections not initialized');
                return 0;
            }
            const data = await this.readCashInputs();
            if (!data) {
                return 0;
            }
            return data.startingBalance + data.cashIn - data.expensesTotal - data.cashOut;
        } catch (e) {
            ErrorService.handleError(e, 'CashService.getCurrentBalance error:');
            return 0;
        }
    }

    /**
     * Returns a full breakdown of every component that makes up the current
     * cash-box balance, together with the raw records for each category so the
     * UI can show per-category drill-downs.
     */
    async getBalanceBreakdown(): Promise<BalanceBreakdown> {
        try {
            if (!this.db || !this.db.collections) return { balance: 0, categories: [] };

            const data = await this.readCashInputs();
            if (!data) return { balance: 0, categories: [] };

            const {
                startingBalanceTxns, cashInTxns, cashOutTxns, expenseFiltered,
                startingBalance, cashIn, cashOut, expensesTotal,
            } = data;

            const balance = startingBalance + cashIn - expensesTotal - cashOut;

            const categories: BreakdownCategory[] = [
                {
                    key: 'starting_balance',
                    label: 'Starting Balance',
                    sign: '+',
                    total: startingBalance,
                    items: startingBalanceTxns.map(t => ({
                        id: t.id,
                        label: t.particulars || 'Starting Balance',
                        date: t.transactionDate,
                        amount: coerceMoneyAmount(t.amount),
                    })),
                },
                {
                    key: 'cash_in',
                    label: 'Manual Cash In',
                    sign: '+',
                    total: cashIn,
                    items: cashInTxns.map(t => ({
                        id: t.id,
                        label: t.particulars || 'Cash In',
                        date: t.transactionDate,
                        amount: coerceMoneyAmount(t.amount),
                    })),
                },
                {
                    key: 'expenses',
                    label: 'Expenses',
                    sign: '-',
                    total: expensesTotal,
                    items: expenseFiltered.map(e => ({
                        id: e.id,
                        label: (e as any).particulars || (e as any).description || 'Expense',
                        date: e.createdAt || 0,
                        amount: coerceMoneyAmount(e.amount),
                    })),
                },
                {
                    key: 'cash_out',
                    label: 'Manual Cash Out',
                    sign: '-',
                    total: cashOut,
                    items: cashOutTxns.map(t => ({
                        id: t.id,
                        label: t.particulars || 'Cash Out',
                        date: t.transactionDate,
                        amount: coerceMoneyAmount(t.amount),
                    })),
                },
            ];

            return { balance, categories };
        } catch (e) {
            ErrorService.handleError(e, 'CashService.getBalanceBreakdown error:');
            return { balance: 0, categories: [] };
        }
    }
}
