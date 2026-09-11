import { database } from '../database';
import { Database, Q } from '@nozbe/watermelondb';
import CashTransaction from '../database/models/CashTransaction';
import Payment from '../database/models/Payment';
import Expense from '../database/models/Expense';
import Remittance from '../database/models/Remittance';
import SavingsTransaction from '../database/models/SavingsTransaction';
import ShareCapitalTransaction from '../database/models/ShareCapitalTransaction';
import Loan from '../database/models/Loan';
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
 * Helper to identify legacy/migration summary cash transactions that represent
 * aggregated balances (such as CBU, Savings, or Unpaid Loans migrations) that are
 * already tracked as individual records in their respective tables.
 */
function isMigrationSummaryCashTxn(txn: CashTransaction): boolean {
    const p = (txn.particulars || '').toLowerCase();
    return p.includes('cbu and savings migration') ||
           p.includes('cbu & savings migration') ||
           p.includes('total cbu and savings migration') ||
           p.includes('total unpaid loans balance migration') ||
           p.includes('unpaid loans balance migration') ||
           (p.includes('migration') && (p.includes('cbu') || p.includes('savings') || p.includes('unpaid loans')));
}

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

    static async getCollectorBalance(collectorId: string): Promise<number> {
        return this.defaultInstance.getCollectorBalance(collectorId);
    }

    static async getTodayCollection(): Promise<number> {
        return this.defaultInstance.getTodayCollection();
    }

    static async getMonthCollection(): Promise<number> {
        return this.defaultInstance.getMonthCollection();
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

    async getCurrentBalance(): Promise<number> {
        try {
            if (!this.db || !this.db.collections) {
                ErrorService.handleError(new Error('CashService.getCurrentBalance: Database or collections not initialized'), 'CashService.getCurrentBalance: Database or collections not initialized');
                return 0;
            }
            const txnsCollection = this.db.collections.get<CashTransaction>('cash_transactions');
            const remittancesCollection = this.db.collections.get<Remittance>('remittances');
            const expensesCollection = this.db.collections.get<Expense>('expenses');
            const paymentsCollection = this.db.collections.get<Payment>('payments');
            const savingsCollection = this.db.collections.get<SavingsTransaction>('savings_transactions');
            const shareCapitalCollection = this.db.collections.get<ShareCapitalTransaction>('share_capital_transactions');
            const loansCollection = this.db.collections.get<Loan>('loans');

            if (!txnsCollection || !remittancesCollection || !expensesCollection || !paymentsCollection || !savingsCollection || !shareCapitalCollection || !loansCollection) {
                return 0;
            }

            // Filter soft-deleted records from all queries, excluding petty cash
            const txns = await txnsCollection.query(
                NOT_DELETED,
                Q.or(Q.where('is_petty_cash', null), Q.where('is_petty_cash', false))
            ).fetch();

            const startingBalance = txns
                .filter(t => t.type === 'starting_balance')
                .reduce((s, t) => s + coerceMoneyAmount(t.amount), 0);

            // Get the date of the first starting balance cash transaction
            const startingBalTxn = txns.find(t => t.type === 'starting_balance');
            const rawCutoff = startingBalTxn ? startingBalTxn.transactionDate : 0;
            const cutoffDate = (rawCutoff && !isNaN(Number(rawCutoff))) ? Number(rawCutoff) : 0;

            const remittances = await remittancesCollection.query(
                NOT_DELETED,
                Q.where('status', 'approved')
            ).fetch();

            const expenses = await expensesCollection.query(NOT_DELETED).fetch();
            const payments = await paymentsCollection.query(NOT_DELETED).fetch();
            const savings = await savingsCollection.query(NOT_DELETED).fetch();
            const shareCapital = await shareCapitalCollection.query(NOT_DELETED).fetch();
            const loans = await loansCollection.query(NOT_DELETED).fetch();

            // Manual cash ins after cutoff date (excluding migration summaries already tracked in savings/share_capital)
            const cashIn = txns
                .filter(t => t.type === 'in' && t.transactionDate >= cutoffDate && !isMigrationSummaryCashTxn(t))
                .reduce((s, t) => s + coerceMoneyAmount(t.amount), 0);

            // Manual cash outs after cutoff date (excluding migration summaries already tracked in loans)
            const cashOut = txns
                .filter(t => t.type === 'out' && t.transactionDate >= cutoffDate && !isMigrationSummaryCashTxn(t))
                .reduce((s, t) => s + coerceMoneyAmount(t.amount), 0);

            // Remittances received after cutoff date
            const remittancesTotal = remittances
                .filter(r => {
                    const rDate = r.createdAt || r.updatedAt || 0;
                    return rDate >= cutoffDate;
                })
                .reduce((s, r) => s + coerceMoneyAmount(r.amount), 0);

            // Expenses after cutoff date
            const expensesTotal = expenses
                .filter(e => {
                    const eDate = e.createdAt || 0;
                    return eDate >= cutoffDate;
                })
                .reduce((s, e) => s + coerceMoneyAmount(e.amount), 0);

            // Payments (Cash collections) after cutoff date
            const paymentsTotal = payments
                .filter(p => p.paymentDate >= cutoffDate)
                .reduce((s, p) => s + coerceMoneyAmount(p.amount), 0);

            // Savings deposits and withdrawals after cutoff date
            const savingsDepositsTotal = savings
                .filter(s => s.type === 'deposit' && s.date >= cutoffDate)
                .reduce((sum, s) => sum + coerceMoneyAmount(s.amount), 0);
            
            const savingsWithdrawalsTotal = savings
                .filter(s => s.type === 'withdraw_cash' && s.date >= cutoffDate)
                .reduce((sum, s) => sum + coerceMoneyAmount(s.amount), 0);

            // Share Capital transactions (Deposits/Subscriptions) after cutoff date
            const shareCapitalTotal = shareCapital
                .filter(s => (s.transactionType === 'DEPOSIT' || s.transactionType === 'SUBSCRIPTION') && s.transactionDate >= cutoffDate)
                .reduce((sum, s) => sum + coerceMoneyAmount(s.amount), 0);

            // Loan Disbursements after cutoff date (Only count active, paid, defaulted loans)
            const disbursementsTotal = loans
                .filter(l => ['active', 'paid', 'defaulted'].includes(l.status) && new Date(l.releaseDate).getTime() >= cutoffDate)
                .reduce((sum, l) => sum + coerceMoneyAmount(l.principalAmount), 0);

            const balance = startingBalance + cashIn + remittancesTotal + paymentsTotal + savingsDepositsTotal + shareCapitalTotal - expensesTotal - cashOut - savingsWithdrawalsTotal - disbursementsTotal;
            return balance;
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

            const txnsCollection = this.db.collections.get<CashTransaction>('cash_transactions');
            const remittancesCollection = this.db.collections.get<Remittance>('remittances');
            const expensesCollection = this.db.collections.get<Expense>('expenses');
            const paymentsCollection = this.db.collections.get<Payment>('payments');
            const savingsCollection = this.db.collections.get<SavingsTransaction>('savings_transactions');
            const shareCapitalCollection = this.db.collections.get<ShareCapitalTransaction>('share_capital_transactions');
            const loansCollection = this.db.collections.get<Loan>('loans');

            if (!txnsCollection || !remittancesCollection || !expensesCollection || !paymentsCollection || !savingsCollection || !shareCapitalCollection || !loansCollection) {
                return { balance: 0, categories: [] };
            }

            const txns = await txnsCollection.query(
                NOT_DELETED,
                Q.or(Q.where('is_petty_cash', null), Q.where('is_petty_cash', false))
            ).fetch();

            const startingBalTxn = txns.find(t => t.type === 'starting_balance');
            const rawCutoff = startingBalTxn ? startingBalTxn.transactionDate : 0;
            const cutoffDate = (rawCutoff && !isNaN(Number(rawCutoff))) ? Number(rawCutoff) : 0;

            const remittances = await remittancesCollection.query(NOT_DELETED, Q.where('status', 'approved')).fetch();
            const expenses = await expensesCollection.query(NOT_DELETED).fetch();
            const payments = await paymentsCollection.query(NOT_DELETED).fetch();
            const savings = await savingsCollection.query(NOT_DELETED).fetch();
            const shareCapital = await shareCapitalCollection.query(NOT_DELETED).fetch();
            const loans = await loansCollection.query(NOT_DELETED).fetch();

            // --- Starting Balance ---
            const startingBalanceTxns = txns.filter(t => t.type === 'starting_balance');
            const startingBalance = startingBalanceTxns.reduce((s, t) => s + coerceMoneyAmount(t.amount), 0);

            // --- Manual Cash In (excluding migration summaries already in individual tables) ---
            const cashInTxns = txns.filter(t => t.type === 'in' && t.transactionDate >= cutoffDate && !isMigrationSummaryCashTxn(t));
            const cashIn = cashInTxns.reduce((s, t) => s + coerceMoneyAmount(t.amount), 0);

            // --- Manual Cash Out (excluding migration summaries already in individual tables) ---
            const cashOutTxns = txns.filter(t => t.type === 'out' && t.transactionDate >= cutoffDate && !isMigrationSummaryCashTxn(t));
            const cashOut = cashOutTxns.reduce((s, t) => s + coerceMoneyAmount(t.amount), 0);

            // --- Remittances ---
            const remittanceFiltered = remittances.filter(r => {
                const rDate = r.createdAt || r.updatedAt || 0;
                return rDate >= cutoffDate;
            });
            const remittancesTotal = remittanceFiltered.reduce((s, r) => s + coerceMoneyAmount(r.amount), 0);

            // --- Expenses ---
            const expenseFiltered = expenses.filter(e => (e.createdAt || 0) >= cutoffDate);
            const expensesTotal = expenseFiltered.reduce((s, e) => s + coerceMoneyAmount(e.amount), 0);

            // --- Payments ---
            const paymentFiltered = payments.filter(p => p.paymentDate >= cutoffDate);
            const paymentsTotal = paymentFiltered.reduce((s, p) => s + coerceMoneyAmount(p.amount), 0);

            // --- Savings Deposits ---
            const savingsDepositFiltered = savings.filter(s => s.type === 'deposit' && s.date >= cutoffDate);
            const savingsDepositsTotal = savingsDepositFiltered.reduce((sum, s) => sum + coerceMoneyAmount(s.amount), 0);

            // --- Savings Withdrawals ---
            const savingsWithdrawFiltered = savings.filter(s => s.type === 'withdraw_cash' && s.date >= cutoffDate);
            const savingsWithdrawalsTotal = savingsWithdrawFiltered.reduce((sum, s) => sum + coerceMoneyAmount(s.amount), 0);

            // --- Share Capital ---
            const shareCapitalFiltered = shareCapital.filter(s =>
                (s.transactionType === 'DEPOSIT' || s.transactionType === 'SUBSCRIPTION') && s.transactionDate >= cutoffDate
            );
            const shareCapitalTotal = shareCapitalFiltered.reduce((sum, s) => sum + coerceMoneyAmount(s.amount), 0);

            // --- Loan Disbursements ---
            const disbursementFiltered = loans.filter(l =>
                ['active', 'paid', 'defaulted'].includes(l.status) && new Date(l.releaseDate).getTime() >= cutoffDate
            );
            const disbursementsTotal = disbursementFiltered.reduce((sum, l) => sum + coerceMoneyAmount(l.principalAmount), 0);

            const balance = startingBalance + cashIn + remittancesTotal + paymentsTotal + savingsDepositsTotal + shareCapitalTotal
                - expensesTotal - cashOut - savingsWithdrawalsTotal - disbursementsTotal;

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
                    key: 'remittances',
                    label: 'Remittances',
                    sign: '+',
                    total: remittancesTotal,
                    items: remittanceFiltered.map(r => ({
                        id: r.id,
                        label: (r as any).particulars || (r as any).notes || 'Remittance',
                        date: r.createdAt || r.updatedAt || 0,
                        amount: coerceMoneyAmount(r.amount),
                    })),
                },
                {
                    key: 'payments',
                    label: 'Loan Payments Collected',
                    sign: '+',
                    total: paymentsTotal,
                    items: paymentFiltered.map(p => ({
                        id: p.id,
                        label: (p as any).particulars || (p as any).notes || 'Payment',
                        date: p.paymentDate,
                        amount: coerceMoneyAmount(p.amount),
                    })),
                },
                {
                    key: 'savings_deposits',
                    label: 'Savings Deposits',
                    sign: '+',
                    total: savingsDepositsTotal,
                    items: savingsDepositFiltered.map(s => ({
                        id: s.id,
                        label: (s as any).particulars || (s as any).remarks || 'Savings Deposit',
                        date: s.date,
                        amount: coerceMoneyAmount(s.amount),
                    })),
                },
                {
                    key: 'share_capital',
                    label: 'Share Capital',
                    sign: '+',
                    total: shareCapitalTotal,
                    items: shareCapitalFiltered.map(s => ({
                        id: s.id,
                        label: (s as any).particulars || (s as any).remarks || s.transactionType || 'Share Capital',
                        date: s.transactionDate,
                        amount: coerceMoneyAmount(s.amount),
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
                {
                    key: 'savings_withdrawals',
                    label: 'Savings Withdrawals',
                    sign: '-',
                    total: savingsWithdrawalsTotal,
                    items: savingsWithdrawFiltered.map(s => ({
                        id: s.id,
                        label: (s as any).particulars || (s as any).remarks || 'Savings Withdrawal',
                        date: s.date,
                        amount: coerceMoneyAmount(s.amount),
                    })),
                },
                {
                    key: 'disbursements',
                    label: 'Loan Disbursements',
                    sign: '-',
                    total: disbursementsTotal,
                    items: disbursementFiltered.map(l => ({
                        id: l.id,
                        label: (l as any).borrowerName || (l as any).particulars || `Loan #${l.id.slice(0, 8)}`,
                        date: new Date(l.releaseDate).getTime(),
                        amount: coerceMoneyAmount(l.principalAmount),
                    })),
                },
            ];

            return { balance, categories };
        } catch (e) {
            ErrorService.handleError(e, 'CashService.getBalanceBreakdown error:');
            return { balance: 0, categories: [] };
        }
    }

    /**
     * Calculates the cash currently held by a collector.
     * Cash = Total Payments Collected - Total Approved Remittances
     */
    async getCollectorBalance(collectorId: string): Promise<number> {
        try {
            if (!this.db || !this.db.collections) {
                ErrorService.handleError(new Error('CashService.getCollectorBalance: Database or collections not initialized'), 'CashService.getCollectorBalance: Database or collections not initialized');
                return 0;
            }
            const payments = await this.db.collections.get<Payment>('payments')
                .query(
                    NOT_DELETED,
                    Q.where('collector_id', collectorId)
                )
                .fetch();
            
            const approvedRemittances = await this.db.collections.get<Remittance>('remittances')
                .query(
                    NOT_DELETED,
                    Q.where('collector_id', collectorId),
                    Q.where('status', 'approved')
                ).fetch();

            const totalCollected = payments.reduce((s, p) => s + coerceMoneyAmount(p.amount), 0);
            const totalRemitted = approvedRemittances.reduce((s, r) => s + coerceMoneyAmount(r.amount), 0);

            return totalCollected - totalRemitted;
        } catch (e) {
            ErrorService.handleError(e, 'CashService.getCollectorBalance error:');
            return 0;
        }
    }

    /**
     * Uses database-level date filtering instead of loading all payments into memory.
     */
    async getTodayCollection(): Promise<number> {
        try {
            if (!this.db || !this.db.collections) return 0;
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
            const endOfDay = startOfDay + 86400000;

            const payments = await this.db.collections.get<Payment>('payments').query(
                NOT_DELETED,
                Q.where('payment_date', Q.gte(startOfDay)),
                Q.where('payment_date', Q.lt(endOfDay))
            ).fetch();

            return payments.reduce((s, p) => s + coerceMoneyAmount(p.amount), 0);
        } catch (e) {
            ErrorService.handleError(e, 'CashService.getTodayCollection error:');
            return 0;
        }
    }

    /**
     * Uses database-level date filtering instead of loading all payments into memory.
     */
    async getMonthCollection(): Promise<number> {
        try {
            if (!this.db || !this.db.collections) return 0;
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
            const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1).getTime();

            const payments = await this.db.collections.get<Payment>('payments').query(
                NOT_DELETED,
                Q.where('payment_date', Q.gte(startOfMonth)),
                Q.where('payment_date', Q.lt(startOfNextMonth))
            ).fetch();

            return payments.reduce((s, p) => s + coerceMoneyAmount(p.amount), 0);
        } catch (e) {
            ErrorService.handleError(e, 'CashService.getMonthCollection error:');
            return 0;
        }
    }
}
