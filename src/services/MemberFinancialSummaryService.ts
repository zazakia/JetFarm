import { Database, Model, Q } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import Borrower from '../database/models/Borrower';
import Loan from '../database/models/Loan';
import Payment from '../database/models/Payment';
import SavingsTransaction from '../database/models/SavingsTransaction';
import ShareCapitalTransaction from '../database/models/ShareCapitalTransaction';
import { coerceMoneyAmount } from '../utils/currency';

export interface MemberLedgerSummary {
    borrowerId: string;
    savingsBalance: number;
    cbuBalance: number;
    savings2024Balance: number;
    cbu2024Balance: number;
    savings2025Deposits: number;
    savings2025Withdrawals: number;
    cbu2025Contributions: number;
    savings2026Deposits: number;
    savings2026Withdrawals: number;
    cbu2026Contributions: number;
    recentTransactions: {
        id: string;
        source: 'savings' | 'cbu';
        type: string;
        amount: number;
        date: number;
        notes?: string | null;
    }[];
}

export interface RegistryMemberFinancialSummary extends MemberLedgerSummary {
    fullName: string;
    memberId?: string | null;
    group?: string | null;
}

export interface PortfolioSummary {
    totalSavingsBalance: number;
    totalSavingsDeposits: number;
    totalSavingsWithdrawals: number;
    totalSavingsInterest: number;
    totalCbuBalance: number;
    activeSavingsAccounts: number;
    activeCbuMembers: number;
    yearSavingsDeposits: number;
    yearSavingsWithdrawals: number;
    yearCbuContributions: number;
}

export interface LoanTypeSummary {
    loanType: string;
    totalLoans: number;
    activeLoans: number;
    paidLoans: number;
    delinquentLoans: number;
    amountReleased: number;
    outstandingBalance: number;
    amountCollected: number;
    collectionEfficiency: number;
}

type SavingsLike = Pick<SavingsTransaction, 'id' | 'borrowerId' | 'type' | 'amount' | 'date' | 'notes' | 'deletedAt'>;
type CbuLike = Pick<ShareCapitalTransaction, 'id' | 'memberId' | 'transactionType' | 'amount' | 'transactionDate' | 'notes' | 'deletedAt'>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
}

function yearRange(year: number) {
    return {
        start: new Date(year, 0, 1).getTime(),
        end: new Date(year, 11, 31, 23, 59, 59, 999).getTime(),
    };
}

function isSavingsIncrease(type: string): boolean {
    return !['WITHDRAWAL', 'WITHDRAW', 'WITHDRAW_CASH', 'WITHDRAW_LOAN', 'REDEMPTION', 'REVERSAL'].includes((type || '').toUpperCase());
}

function isCbuIncrease(type: string): boolean {
    return !['WITHDRAWAL', 'REDEMPTION', 'REVERSAL'].includes(type.toUpperCase());
}

function balanceSavings(transactions: SavingsLike[], asOf?: number): number {
    return roundCurrency(transactions.reduce((sum, tx) => {
        if (tx.deletedAt !== null && tx.deletedAt !== undefined) return sum;
        if (asOf !== undefined && tx.date > asOf) return sum;
        const amount = coerceMoneyAmount(tx.amount);
        return isSavingsIncrease(tx.type) ? sum + amount : sum - amount;
    }, 0));
}

function balanceCbu(transactions: CbuLike[], asOf?: number): number {
    return roundCurrency(transactions.reduce((sum, tx) => {
        if (tx.deletedAt !== null && tx.deletedAt !== undefined) return sum;
        if (asOf !== undefined && tx.transactionDate > asOf) return sum;
        const amount = coerceMoneyAmount(tx.amount);
        return isCbuIncrease(tx.transactionType) ? sum + amount : sum - amount;
    }, 0));
}

export class MemberFinancialSummaryServiceClass {
    constructor(private db: Database = globalDatabase) {}

    private collection<T extends Model = Model>(name: string) {
        const db = this.db as Database & { collections?: { get: Database['get'] } };
        return typeof db.get === 'function' ? db.get<T>(name) : db.collections!.get<T>(name);
    }

    async getMemberSummary(borrowerId: string): Promise<MemberLedgerSummary> {
        const [savingsTransactions, cbuTransactions] = await Promise.all([
            this.collection<SavingsTransaction>('savings_transactions').query(
                Q.where('borrower_id', borrowerId),
                Q.where('deleted_at', null),
                Q.sortBy('date', Q.desc)
            ).fetch(),
            this.collection<ShareCapitalTransaction>('share_capital_transactions').query(
                Q.where('member_id', borrowerId),
                Q.where('deleted_at', null),
                Q.sortBy('date', Q.desc)
            ).fetch(),
        ]);

        const y2024 = yearRange(2024);
        const y2025 = yearRange(2025);
        const y2026 = yearRange(2026);
        const savings2025 = savingsTransactions.filter(tx => tx.date >= y2025.start && tx.date <= y2025.end);
        const cbu2025 = cbuTransactions.filter(tx => tx.transactionDate >= y2025.start && tx.transactionDate <= y2025.end);
        const savings2026 = savingsTransactions.filter(tx => tx.date >= y2026.start && tx.date <= y2026.end);
        const cbu2026 = cbuTransactions.filter(tx => tx.transactionDate >= y2026.start && tx.transactionDate <= y2026.end);

        const recentTransactions = [
            ...savingsTransactions.map(tx => ({
                id: tx.id,
                source: 'savings' as const,
                type: tx.type,
                amount: coerceMoneyAmount(tx.amount),
                date: tx.date,
                notes: tx.notes,
            })),
            ...cbuTransactions.map(tx => ({
                id: tx.id,
                source: 'cbu' as const,
                type: tx.transactionType,
                amount: coerceMoneyAmount(tx.amount),
                date: tx.transactionDate,
                notes: tx.notes,
            })),
        ].sort((a, b) => b.date - a.date).slice(0, 10);

        return {
            borrowerId,
            savingsBalance: balanceSavings(savingsTransactions),
            cbuBalance: balanceCbu(cbuTransactions),
            savings2024Balance: balanceSavings(savingsTransactions, y2024.end),
            cbu2024Balance: balanceCbu(cbuTransactions, y2024.end),
            savings2025Deposits: roundCurrency(savings2025.filter(tx => isSavingsIncrease(tx.type)).reduce((sum, tx) => sum + coerceMoneyAmount(tx.amount), 0)),
            savings2025Withdrawals: roundCurrency(savings2025.filter(tx => !isSavingsIncrease(tx.type)).reduce((sum, tx) => sum + coerceMoneyAmount(tx.amount), 0)),
            cbu2025Contributions: roundCurrency(cbu2025.filter(tx => isCbuIncrease(tx.transactionType)).reduce((sum, tx) => sum + coerceMoneyAmount(tx.amount), 0)),
            savings2026Deposits: roundCurrency(savings2026.filter(tx => isSavingsIncrease(tx.type)).reduce((sum, tx) => sum + coerceMoneyAmount(tx.amount), 0)),
            savings2026Withdrawals: roundCurrency(savings2026.filter(tx => !isSavingsIncrease(tx.type)).reduce((sum, tx) => sum + coerceMoneyAmount(tx.amount), 0)),
            cbu2026Contributions: roundCurrency(cbu2026.filter(tx => isCbuIncrease(tx.transactionType)).reduce((sum, tx) => sum + coerceMoneyAmount(tx.amount), 0)),
            recentTransactions,
        };
    }

    async getRegistrySummaries(): Promise<RegistryMemberFinancialSummary[]> {
        const borrowers = await this.collection<Borrower>('borrowers').query(
            Q.where('deleted_at', null),
            Q.sortBy('full_name', Q.asc)
        ).fetch();

        const summaries = await Promise.all(borrowers.map(async borrower => ({
            ...(await this.getMemberSummary(borrower.id)),
            fullName: borrower.fullName,
            memberId: borrower.memberId,
            group: borrower.group,
        })));

        return summaries;
    }

    async getPortfolioSummary(year = 2025): Promise<PortfolioSummary> {
        const [savingsTransactions, cbuTransactions] = await Promise.all([
            this.collection<SavingsTransaction>('savings_transactions').query(Q.where('deleted_at', null)).fetch(),
            this.collection<ShareCapitalTransaction>('share_capital_transactions').query(Q.where('deleted_at', null)).fetch(),
        ]);

        const range = yearRange(year);
        const yearSavings = savingsTransactions.filter(tx => tx.date >= range.start && tx.date <= range.end);
        const yearCbu = cbuTransactions.filter(tx => tx.transactionDate >= range.start && tx.transactionDate <= range.end);

        const savingsByBorrower = new Map<string, SavingsLike[]>();
        savingsTransactions.forEach(tx => {
            savingsByBorrower.set(tx.borrowerId, [...(savingsByBorrower.get(tx.borrowerId) ?? []), tx]);
        });

        const cbuByMember = new Map<string, CbuLike[]>();
        cbuTransactions.forEach(tx => {
            cbuByMember.set(tx.memberId, [...(cbuByMember.get(tx.memberId) ?? []), tx]);
        });

        return {
            totalSavingsBalance: balanceSavings(savingsTransactions),
            totalSavingsDeposits: roundCurrency(savingsTransactions.filter(tx => isSavingsIncrease(tx.type)).reduce((sum, tx) => sum + coerceMoneyAmount(tx.amount), 0)),
            totalSavingsWithdrawals: roundCurrency(savingsTransactions.filter(tx => !isSavingsIncrease(tx.type)).reduce((sum, tx) => sum + coerceMoneyAmount(tx.amount), 0)),
            totalSavingsInterest: roundCurrency(savingsTransactions.filter(tx => tx.type === 'interest').reduce((sum, tx) => sum + coerceMoneyAmount(tx.amount), 0)),
            totalCbuBalance: balanceCbu(cbuTransactions),
            activeSavingsAccounts: Array.from(savingsByBorrower.values()).filter(txs => balanceSavings(txs) > 0).length,
            activeCbuMembers: Array.from(cbuByMember.values()).filter(txs => balanceCbu(txs) > 0).length,
            yearSavingsDeposits: roundCurrency(yearSavings.filter(tx => isSavingsIncrease(tx.type)).reduce((sum, tx) => sum + coerceMoneyAmount(tx.amount), 0)),
            yearSavingsWithdrawals: roundCurrency(yearSavings.filter(tx => !isSavingsIncrease(tx.type)).reduce((sum, tx) => sum + coerceMoneyAmount(tx.amount), 0)),
            yearCbuContributions: roundCurrency(yearCbu.filter(tx => isCbuIncrease(tx.transactionType)).reduce((sum, tx) => sum + coerceMoneyAmount(tx.amount), 0)),
        };
    }

    async getLoanTypeSummary(): Promise<LoanTypeSummary[]> {
        const [loans, payments] = await Promise.all([
            this.collection<Loan>('loans').query(Q.where('deleted_at', null)).fetch(),
            this.collection<Payment>('payments').query(Q.where('deleted_at', null)).fetch(),
        ]);

        const paymentsByLoanId = new Map<string, number>();
        payments.forEach(payment => {
            paymentsByLoanId.set(payment.loanId, (paymentsByLoanId.get(payment.loanId) ?? 0) + coerceMoneyAmount(payment.amount));
        });

        const groups = new Map<string, LoanTypeSummary>();
        loans.forEach(loan => {
            const loanType = loan.loanType || 'standard';
            const current = groups.get(loanType) ?? {
                loanType,
                totalLoans: 0,
                activeLoans: 0,
                paidLoans: 0,
                delinquentLoans: 0,
                amountReleased: 0,
                outstandingBalance: 0,
                amountCollected: 0,
                collectionEfficiency: 0,
            };

            const collected = paymentsByLoanId.get(loan.id) ?? 0;
            const status = loan.status || '';
            current.totalLoans += 1;
            current.activeLoans += ['active', 'defaulted'].includes(status) ? 1 : 0;
            current.paidLoans += status === 'paid' ? 1 : 0;
            current.delinquentLoans += status === 'defaulted' || loan.isDelinquent ? 1 : 0;
            current.amountReleased += coerceMoneyAmount(loan.principalAmount);
            current.amountCollected += collected;
            current.outstandingBalance += Math.max(0, coerceMoneyAmount(loan.totalAmount) - collected);
            groups.set(loanType, current);
        });

        return Array.from(groups.values()).map(row => ({
            ...row,
            amountReleased: roundCurrency(row.amountReleased),
            amountCollected: roundCurrency(row.amountCollected),
            outstandingBalance: roundCurrency(row.outstandingBalance),
            collectionEfficiency: row.amountReleased > 0 ? roundCurrency((row.amountCollected / row.amountReleased) * 100) : 0,
        })).sort((a, b) => b.outstandingBalance - a.outstandingBalance);
    }

    calculateSavingsInterest(balance: number, days: number, annualRate = 0.06): number {
        return roundCurrency(coerceMoneyAmount(balance) * annualRate * (days / 365));
    }

    calculateMonthlySavingsInterest(averageDailyBalance: number, annualRate = 0.06): number {
        return this.calculateSavingsInterest(averageDailyBalance, 365 / 12, annualRate);
    }

    calculateQuarterlySavingsInterest(averageDailyBalance: number, annualRate = 0.06): number {
        return this.calculateSavingsInterest(averageDailyBalance, 365 / 4, annualRate);
    }

    /**
     * Issue #44: Calculate Loan Balance as of Jan 1, 2026 from onDLLoaner2026 dataset,
     * deducting Cash on Hand and adding net balance to Loan Receivable.
     */
    calculate2026OpeningLoanBalance(dataset: { grossLoanBalance: number; cashOnHand: number }[]): {
        grossLoanBalance: number;
        cashOnHandDeduction: number;
        netLoanReceivable: number;
    } {
        const grossLoanBalance = roundCurrency(dataset.reduce((sum, d) => sum + coerceMoneyAmount(d.grossLoanBalance), 0));
        const cashOnHandDeduction = roundCurrency(dataset.reduce((sum, d) => sum + coerceMoneyAmount(d.cashOnHand), 0));
        const netLoanReceivable = roundCurrency(Math.max(0, grossLoanBalance - cashOnHandDeduction));
        return { grossLoanBalance, cashOnHandDeduction, netLoanReceivable };
    }

    /**
     * Issue #45: Calculate opening CBU and Savings based on 2025 dataset,
     * verifying Cash on Hand connection and credit posting to Share Capital.
     */
    calculate2025CbuSavingsOpeningBalance(records: { savings2025: number; cbu2025: number; isCashOnHandConnected?: boolean }[]): {
        totalSavings2025: number;
        totalCbu2025: number;
        cashOnHandConnectedTotal: number;
        shareCapitalCredit: number;
    } {
        let totalSavings2025 = 0;
        let totalCbu2025 = 0;
        let cashOnHandConnectedTotal = 0;

        records.forEach(r => {
            const savings = coerceMoneyAmount(r.savings2025);
            const cbu = coerceMoneyAmount(r.cbu2025);
            totalSavings2025 += savings;
            totalCbu2025 += cbu;
            if (r.isCashOnHandConnected !== false) {
                cashOnHandConnectedTotal += (savings + cbu);
            }
        });

        const shareCapitalCredit = roundCurrency(totalCbu2025);

        return {
            totalSavings2025: roundCurrency(totalSavings2025),
            totalCbu2025: roundCurrency(totalCbu2025),
            cashOnHandConnectedTotal: roundCurrency(cashOnHandConnectedTotal),
            shareCapitalCredit,
        };
    }
}

const instance = new MemberFinancialSummaryServiceClass();
export { instance as MemberFinancialSummaryService };
export default instance;
