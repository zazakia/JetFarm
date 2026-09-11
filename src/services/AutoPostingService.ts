/**
 * AutoPostingService
 *
 * Automatically generates double-entry journal entries when financial transactions
 * are created in POSCursor. This service bridges the existing transaction
 * tables (payments, expenses, savings, cash, bank) with the formal accounting layer.
 *
 * Auto-posting rules (Philippine cooperative standard):
 * ┌──────────────────────────────┬───────────────────────┬───────────────────────┐
 * │ Transaction                  │ Debit                 │ Credit                │
 * ├──────────────────────────────┼───────────────────────┼───────────────────────┤
 * │ Loan disbursed               │ 1100 Loans Receivable │ 1010 Cash on Hand     │
 * │ Payment — principal          │ 1010 Cash on Hand     │ 1100 Loans Receivable │
 * │ Payment — interest/charges   │ 1010 Cash on Hand     │ 4010 Interest Income  │
 * │ Payment — penalty            │ 1010 Cash on Hand     │ 4040 Penalties        │
 * │ Expense recorded             │ 5xxx [category acct]  │ 1010 Cash on Hand     │
 * │ Savings deposit              │ 1010 Cash on Hand     │ 2010 Savings Payable  │
 * │ Savings withdrawal           │ 2010 Savings Payable  │ 1010 Cash on Hand     │
 * │ Share capital paid           │ 1010 Cash on Hand     │ 3010 Share Capital    │
 * │ Cash in                      │ 1010 Cash on Hand     │ 4060 Other Income     │
 * │ Cash out                     │ 5100 Other Expenses   │ 1010 Cash on Hand     │
 * │ Bank deposit                 │ 1020 Cash in Bank     │ 1010 Cash on Hand     │
 * │ Bank withdrawal              │ 1010 Cash on Hand     │ 1020 Cash in Bank     │
 * └──────────────────────────────┴───────────────────────┴───────────────────────┘
 *
 * Expense category → account code mapping is configurable.
 * All entries use 1010 (Cash on Hand) by default unless a bank account
 * is explicitly referenced.
 */

import { Database, Q } from '@nozbe/watermelondb';
import { database as globalDatabase } from '../database';
import { JournalEntryServiceClass } from './JournalEntryService';
import JournalEntry from '../database/models/JournalEntry';
import JournalEntryLine from '../database/models/JournalEntryLine';
import Payment from '../database/models/Payment';
import Loan from '../database/models/Loan';
import Expense from '../database/models/Expense';
import SavingsTransaction from '../database/models/SavingsTransaction';
import ShareCapitalTransaction from '../database/models/ShareCapitalTransaction';
import CashTransaction from '../database/models/CashTransaction';
import BankTransaction from '../database/models/BankTransaction';


// ─── Default Account Codes ────────────────────────────────────────────────────

const ACCT = {
    CASH_ON_HAND: '1010',
    PETTY_CASH: '1011',
    CASH_IN_BANK_DEFAULT: '1020',
    LOANS_RECEIVABLE: '1100',
    SAVINGS_DEPOSITS_PAYABLE: '2010',
    SHARE_CAPITAL: '3010',
    INTEREST_ON_LOANS: '4010',
    SERVICE_CHARGES: '4020',
    MEMBERSHIP_FEES: '4030',
    PENALTIES_AND_FINES: '4040',
    OTHER_INCOME: '4060',
    MISCELLANEOUS_INCOME: '4070',
    SALARIES_AND_WAGES: '5010',
    OFFICE_EXPENSES: '5020',
    COMMUNICATION_EXPENSES: '5030',
    TRANSPORTATION_EXPENSES: '5040',
    DEPRECIATION: '5050',
    TAXES_AND_LICENSES: '5060',
    REPAIRS_AND_MAINTENANCE: '5070',
    TRAINING_AND_DEVELOPMENT: '5080',
    PROFESSIONAL_FEES: '5090',
    OTHER_OPERATING_EXPENSES: '5100',
};

/** Maps expense category keywords → account code */
const EXPENSE_CATEGORY_MAP: Record<string, string> = {
    salary: ACCT.SALARIES_AND_WAGES,
    salaries: ACCT.SALARIES_AND_WAGES,
    wages: ACCT.SALARIES_AND_WAGES,
    payroll: ACCT.SALARIES_AND_WAGES,
    office: ACCT.OFFICE_EXPENSES,
    supplies: ACCT.OFFICE_EXPENSES,
    communication: ACCT.COMMUNICATION_EXPENSES,
    telephone: ACCT.COMMUNICATION_EXPENSES,
    internet: ACCT.COMMUNICATION_EXPENSES,
    transportation: ACCT.TRANSPORTATION_EXPENSES,
    travel: ACCT.TRANSPORTATION_EXPENSES,
    fuel: ACCT.TRANSPORTATION_EXPENSES,
    depreciation: ACCT.DEPRECIATION,
    amortization: ACCT.DEPRECIATION,
    tax: ACCT.TAXES_AND_LICENSES,
    taxes: ACCT.TAXES_AND_LICENSES,
    license: ACCT.TAXES_AND_LICENSES,
    repair: ACCT.REPAIRS_AND_MAINTENANCE,
    maintenance: ACCT.REPAIRS_AND_MAINTENANCE,
    training: ACCT.TRAINING_AND_DEVELOPMENT,
    seminar: ACCT.TRAINING_AND_DEVELOPMENT,
    professional: ACCT.PROFESSIONAL_FEES,
    audit: ACCT.PROFESSIONAL_FEES,
    legal: ACCT.PROFESSIONAL_FEES,
};

function mapExpenseCategoryToAccount(category: string): string {
    const key = category.toLowerCase();
    for (const [keyword, code] of Object.entries(EXPENSE_CATEGORY_MAP)) {
        if (key.includes(keyword)) return code;
    }
    return ACCT.OTHER_OPERATING_EXPENSES;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class AutoPostingServiceClass {
    protected db: Database;
    protected journalEntryService: JournalEntryServiceClass;

    constructor(db: Database = globalDatabase) {
        this.db = db;
        this.journalEntryService = new JournalEntryServiceClass(db);
    }

    /**
     * Post a loan disbursement.
     * DR: Loans Receivable (1100)
     * CR: Cash on Hand (1010)
     */
    async postLoanDisbursement(opts: {
        loanId: string;
        amount: number;
        entryDate: Date;
        borrowerName?: string;
        postedBy?: string;
    }): Promise<void> {
        await this.journalEntryService.createEntry({
            entryDate: opts.entryDate,
            description: `Loan disbursed to ${opts.borrowerName ?? 'borrower'}`,
            entryType: 'auto',
            sourceTable: 'loans',
            sourceId: opts.loanId,
            postedBy: opts.postedBy,
            lines: [
                {
                    accountCode: ACCT.LOANS_RECEIVABLE,
                    accountName: 'Loans Receivable',
                    debitAmount: opts.amount,
                    description: `Loan principal — ${opts.borrowerName ?? ''}`,
                },
                {
                    accountCode: ACCT.CASH_ON_HAND,
                    accountName: 'Cash on Hand',
                    creditAmount: opts.amount,
                    description: 'Cash released',
                },
            ],
        }, opts.postedBy);
    }

    /**
     * Post a loan payment.
     * Splits principal and interest into separate lines.
     *
     * DR: Cash on Hand (1010) — for total amount received
     * CR: Loans Receivable (1100) — for principal portion
     * CR: Interest on Loans (4010) — for interest portion
     * CR: Penalties & Fines (4040) — for penalty portion (if any)
     */
    async postPayment(opts: {
        paymentId: string;
        principal: number;
        interest: number;
        penalty?: number;
        serviceCharge?: number;
        entryDate: Date;
        borrowerName?: string;
        postedBy?: string;
    }): Promise<void> {
        const penalty = opts.penalty ?? 0;
        const serviceCharge = opts.serviceCharge ?? 0;
        const totalReceived = opts.principal + opts.interest + penalty + serviceCharge;

        if (totalReceived <= 0) return;

        const creditLines = [];

        if (opts.principal > 0) {
            creditLines.push({
                accountCode: ACCT.LOANS_RECEIVABLE,
                accountName: 'Loans Receivable',
                creditAmount: opts.principal,
                description: 'Principal repayment',
            });
        }

        if (opts.interest > 0) {
            creditLines.push({
                accountCode: ACCT.INTEREST_ON_LOANS,
                accountName: 'Interest on Loans',
                creditAmount: opts.interest,
                description: 'Interest income',
            });
        }

        if (serviceCharge > 0) {
            creditLines.push({
                accountCode: ACCT.SERVICE_CHARGES,
                accountName: 'Service Charges',
                creditAmount: serviceCharge,
                description: 'Service charge',
            });
        }

        if (penalty > 0) {
            creditLines.push({
                accountCode: ACCT.PENALTIES_AND_FINES,
                accountName: 'Penalties & Fines',
                creditAmount: penalty,
                description: 'Penalty charge',
            });
        }

        await this.journalEntryService.createEntry({
            entryDate: opts.entryDate,
            description: `Payment received from ${opts.borrowerName ?? 'borrower'}`,
            entryType: 'auto',
            sourceTable: 'payments',
            sourceId: opts.paymentId,
            postedBy: opts.postedBy,
            lines: [
                {
                    accountCode: ACCT.CASH_ON_HAND,
                    accountName: 'Cash on Hand',
                    debitAmount: totalReceived,
                    description: 'Cash collected',
                },
                ...creditLines,
            ],
        }, opts.postedBy);
    }

    /**
     * Post an expense record.
     * DR: Expense Account (5xxx based on category)
     * CR: Cash on Hand (1010)
     */
    async postExpense(opts: {
        expenseId: string;
        amount: number;
        category: string;
        description?: string;
        entryDate: Date;
        postedBy?: string;
    }): Promise<void> {
        const expenseAccountCode = mapExpenseCategoryToAccount(opts.category);

        await this.journalEntryService.createEntry({
            entryDate: opts.entryDate,
            description: opts.description ?? `Expense: ${opts.category}`,
            entryType: 'auto',
            sourceTable: 'expenses',
            sourceId: opts.expenseId,
            postedBy: opts.postedBy,
            lines: [
                {
                    accountCode: expenseAccountCode,
                    debitAmount: opts.amount,
                    description: opts.category,
                },
                {
                    accountCode: ACCT.CASH_ON_HAND,
                    accountName: 'Cash on Hand',
                    creditAmount: opts.amount,
                    description: 'Cash disbursed',
                },
            ],
        }, opts.postedBy);
    }

    /**
     * Post a savings transaction.
     * Deposit: DR Cash on Hand (1010) / CR Savings Deposits Payable (2010)
     * Withdrawal: DR Savings Deposits Payable (2010) / CR Cash on Hand (1010)
     */
    async postSavingsTransaction(opts: {
        transactionId: string;
        type: 'deposit' | 'withdrawal';
        amount: number;
        entryDate: Date;
        borrowerName?: string;
        postedBy?: string;
    }): Promise<void> {
        const isDeposit = opts.type === 'deposit';
        const label = opts.borrowerName ?? 'member';

        await this.journalEntryService.createEntry({
            entryDate: opts.entryDate,
            description: `Savings ${opts.type} — ${label}`,
            entryType: 'auto',
            sourceTable: 'savings_transactions',
            sourceId: opts.transactionId,
            postedBy: opts.postedBy,
            lines: [
                {
                    accountCode: isDeposit ? ACCT.CASH_ON_HAND : ACCT.SAVINGS_DEPOSITS_PAYABLE,
                    accountName: isDeposit ? 'Cash on Hand' : 'Savings Deposits Payable',
                    debitAmount: opts.amount,
                    description: isDeposit ? 'Cash received' : 'Savings released',
                },
                {
                    accountCode: isDeposit ? ACCT.SAVINGS_DEPOSITS_PAYABLE : ACCT.CASH_ON_HAND,
                    accountName: isDeposit ? 'Savings Deposits Payable' : 'Cash on Hand',
                    creditAmount: opts.amount,
                    description: isDeposit ? 'Savings deposit recorded' : 'Cash paid out',
                },
            ],
        }, opts.postedBy);
    }

    /**
     * Post a share capital / CBU transaction.
     * Deposit/Contribution: DR Cash on Hand (1010) / CR Share Capital (3010)
     * Withdrawal/Refund: DR Share Capital (3010) / CR Cash on Hand (1010)
     */
    async postShareCapital(opts: {
        transactionId: string;
        type?: string;
        amount: number;
        entryDate: Date;
        memberName?: string;
        postedBy?: string;
    }): Promise<void> {
        const isWithdrawal = !!opts.type && ['WITHDRAWAL', 'REDEMPTION', 'DEBIT', 'REFUND'].includes(opts.type.toUpperCase());
        const label = opts.memberName ?? 'member';

        await this.journalEntryService.createEntry({
            entryDate: opts.entryDate,
            description: `Share capital ${isWithdrawal ? 'withdrawal' : 'payment'} — ${label}`,
            entryType: 'auto',
            sourceTable: 'share_capital_transactions',
            sourceId: opts.transactionId,
            postedBy: opts.postedBy,
            lines: [
                {
                    accountCode: isWithdrawal ? ACCT.SHARE_CAPITAL : ACCT.CASH_ON_HAND,
                    accountName: isWithdrawal ? 'Share Capital' : 'Cash on Hand',
                    debitAmount: opts.amount,
                    description: isWithdrawal ? 'Share capital refund' : 'Cash received',
                },
                {
                    accountCode: isWithdrawal ? ACCT.CASH_ON_HAND : ACCT.SHARE_CAPITAL,
                    accountName: isWithdrawal ? 'Cash on Hand' : 'Share Capital',
                    creditAmount: opts.amount,
                    description: isWithdrawal ? 'Cash paid out' : 'Share capital contribution',
                },
            ],
        }, opts.postedBy);
    }

    /**
     * Post a cash transaction (cash on hand in/out).
     * Automatically identifies CBU / Share Capital (Equity 3010), Savings (Liability 2010),
     * Loan migration (Receivables 1100), or general income/expense.
     */
    async postCashTransaction(opts: {
        transactionId: string;
        type: 'in' | 'out';
        amount: number;
        particulars?: string;
        entryDate: Date;
        postedBy?: string;
    }): Promise<void> {
        const isIn = opts.type === 'in';
        const rawParticulars = opts.particulars ?? '';
        const particularsLower = rawParticulars.toLowerCase();

        // 1. Compound CBU and Savings migration detection
        const isCbuAndSavings = particularsLower.includes('cbu and savings') ||
            particularsLower.includes('cbu & savings') ||
            particularsLower.includes('total cbu and savings migration');

        if (isCbuAndSavings && isIn) {
            // Audited CBU is 454,836.15 and Savings is 179,132.62 (total 633,968.78)
            const cbuPortion = opts.amount >= 633960 && opts.amount <= 633975
                ? 454836.15
                : Math.round(opts.amount * 0.71744 * 100) / 100;
            const savingsPortion = Math.round((opts.amount - cbuPortion) * 100) / 100;

            await this.journalEntryService.createEntry({
                entryDate: opts.entryDate,
                description: rawParticulars || 'Total CBU and Savings Migration',
                entryType: 'auto',
                sourceTable: 'cash_transactions',
                sourceId: opts.transactionId,
                postedBy: opts.postedBy,
                lines: [
                    {
                        accountCode: ACCT.CASH_ON_HAND,
                        accountName: 'Cash on Hand',
                        debitAmount: opts.amount,
                        description: 'Cash received from member CBU & Savings',
                    },
                    {
                        accountCode: ACCT.SHARE_CAPITAL,
                        accountName: 'Share Capital',
                        creditAmount: cbuPortion,
                        description: 'Capital Build-Up (Share Capital) contribution',
                    },
                    {
                        accountCode: ACCT.SAVINGS_DEPOSITS_PAYABLE,
                        accountName: 'Savings Deposits Payable',
                        creditAmount: savingsPortion,
                        description: 'Member savings deposits recorded',
                    },
                ],
            }, opts.postedBy);
            return;
        }

        // 2. CBU / Share Capital detection (Equity - Account 3010)
        const isCbu = particularsLower.includes('cbu') ||
            particularsLower.includes('share capital') ||
            particularsLower.includes('capital build') ||
            particularsLower.includes('capital contribution');

        if (isCbu) {
            await this.journalEntryService.createEntry({
                entryDate: opts.entryDate,
                description: rawParticulars || `Share Capital ${isIn ? 'contribution' : 'refund'}`,
                entryType: 'auto',
                sourceTable: 'cash_transactions',
                sourceId: opts.transactionId,
                postedBy: opts.postedBy,
                lines: [
                    {
                        accountCode: isIn ? ACCT.CASH_ON_HAND : ACCT.SHARE_CAPITAL,
                        accountName: isIn ? 'Cash on Hand' : 'Share Capital',
                        debitAmount: opts.amount,
                        description: isIn ? 'Cash received for Share Capital' : 'Share Capital refund/withdrawal',
                    },
                    {
                        accountCode: isIn ? ACCT.SHARE_CAPITAL : ACCT.CASH_ON_HAND,
                        accountName: isIn ? 'Share Capital' : 'Cash on Hand',
                        creditAmount: opts.amount,
                        description: isIn ? 'Share Capital contribution' : 'Cash paid out',
                    },
                ],
            }, opts.postedBy);
            return;
        }

        // 3. Savings detection (Liability - Account 2010)
        const isSavings = particularsLower.includes('saving');
        if (isSavings) {
            await this.journalEntryService.createEntry({
                entryDate: opts.entryDate,
                description: rawParticulars || `Savings ${isIn ? 'deposit' : 'withdrawal'}`,
                entryType: 'auto',
                sourceTable: 'cash_transactions',
                sourceId: opts.transactionId,
                postedBy: opts.postedBy,
                lines: [
                    {
                        accountCode: isIn ? ACCT.CASH_ON_HAND : ACCT.SAVINGS_DEPOSITS_PAYABLE,
                        accountName: isIn ? 'Cash on Hand' : 'Savings Deposits Payable',
                        debitAmount: opts.amount,
                        description: isIn ? 'Cash received for Savings' : 'Savings released',
                    },
                    {
                        accountCode: isIn ? ACCT.SAVINGS_DEPOSITS_PAYABLE : ACCT.CASH_ON_HAND,
                        accountName: isIn ? 'Savings Deposits Payable' : 'Cash on Hand',
                        creditAmount: opts.amount,
                        description: isIn ? 'Savings deposit recorded' : 'Cash paid out',
                    },
                ],
            }, opts.postedBy);
            return;
        }

        // 4. Loan Migration detection (Loans Receivable - Account 1100)
        const isLoanMigration = particularsLower.includes('unpaid loans') ||
            particularsLower.includes('loan balance migration') ||
            particularsLower.includes('loan migration');
        if (isLoanMigration) {
            await this.journalEntryService.createEntry({
                entryDate: opts.entryDate,
                description: rawParticulars || `Loan Migration ${isIn ? 'repayment' : 'disbursement'}`,
                entryType: 'auto',
                sourceTable: 'cash_transactions',
                sourceId: opts.transactionId,
                postedBy: opts.postedBy,
                lines: [
                    {
                        accountCode: !isIn ? ACCT.LOANS_RECEIVABLE : ACCT.CASH_ON_HAND,
                        accountName: !isIn ? 'Loans Receivable' : 'Cash on Hand',
                        debitAmount: opts.amount,
                        description: !isIn ? 'Migrated loan portfolio balance' : 'Loan repayment',
                    },
                    {
                        accountCode: !isIn ? ACCT.CASH_ON_HAND : ACCT.LOANS_RECEIVABLE,
                        accountName: !isIn ? 'Cash on Hand' : 'Loans Receivable',
                        creditAmount: opts.amount,
                        description: !isIn ? 'Cash disbursed' : 'Loan balance reduction',
                    },
                ],
            }, opts.postedBy);
            return;
        }

        // 5. Default Regular Cash In/Out
        await this.journalEntryService.createEntry({
            entryDate: opts.entryDate,
            description: opts.particulars ?? `Cash ${opts.type === 'in' ? 'receipt' : 'disbursement'}`,
            entryType: 'auto',
            sourceTable: 'cash_transactions',
            sourceId: opts.transactionId,
            postedBy: opts.postedBy,
            lines: [
                {
                    accountCode: isIn ? ACCT.CASH_ON_HAND : ACCT.OTHER_OPERATING_EXPENSES,
                    accountName: isIn ? 'Cash on Hand' : 'Other Operating Expenses',
                    debitAmount: opts.amount,
                    description: opts.particulars ?? '',
                },
                {
                    accountCode: isIn ? ACCT.OTHER_INCOME : ACCT.CASH_ON_HAND,
                    accountName: isIn ? 'Other Income' : 'Cash on Hand',
                    creditAmount: opts.amount,
                    description: opts.particulars ?? '',
                },
            ],
        }, opts.postedBy);
    }

    /**
     * Post a bank account transaction.
     * Deposit (cash → bank): DR Cash in Bank / CR Cash on Hand
     * Withdrawal (bank → cash): DR Cash on Hand / CR Cash in Bank
     */
    async postBankTransaction(opts: {
        transactionId: string;
        type: 'deposit' | 'withdrawal';
        amount: number;
        bankAccountCode?: string; // defaults to 1020
        particulars?: string;
        entryDate: Date;
        postedBy?: string;
    }): Promise<void> {
        const bankCode = opts.bankAccountCode ?? ACCT.CASH_IN_BANK_DEFAULT;
        const isDeposit = opts.type === 'deposit';

        await this.journalEntryService.createEntry({
            entryDate: opts.entryDate,
            description: opts.particulars ?? `Bank ${opts.type}`,
            entryType: 'auto',
            sourceTable: 'bank_transactions',
            sourceId: opts.transactionId,
            postedBy: opts.postedBy,
            lines: [
                {
                    accountCode: isDeposit ? bankCode : ACCT.CASH_ON_HAND,
                    accountName: isDeposit ? 'Cash in Bank' : 'Cash on Hand',
                    debitAmount: opts.amount,
                    description: opts.particulars ?? '',
                },
                {
                    accountCode: isDeposit ? ACCT.CASH_ON_HAND : bankCode,
                    accountName: isDeposit ? 'Cash on Hand' : 'Cash in Bank',
                    creditAmount: opts.amount,
                    description: opts.particulars ?? '',
                },
            ],
        }, opts.postedBy);
    }

    /**
     * Post a fee collection (membership fee, passbook fee, system fee).
     * DR: Cash on Hand (1010)
     * CR: Miscellaneous Income (4070)
     */
    async postMembershipFee(opts: {
        sourceId: string;
        amount: number;
        memberName?: string;
        entryDate: Date;
        postedBy?: string;
        feeType?: string;
    }): Promise<void> {
        const feeTitle = opts.feeType ? opts.feeType.replace('_', ' ') : 'Membership fee';
        await this.journalEntryService.createEntry({
            entryDate: opts.entryDate,
            description: `${feeTitle} — ${opts.memberName ?? 'member'}`,
            entryType: 'auto',
            sourceTable: 'borrowers',
            sourceId: opts.sourceId,
            postedBy: opts.postedBy,
            lines: [
                {
                    accountCode: ACCT.CASH_ON_HAND,
                    accountName: 'Cash on Hand',
                    debitAmount: opts.amount,
                },
                {
                    accountCode: ACCT.MISCELLANEOUS_INCOME,
                    accountName: 'Miscellaneous Income',
                    creditAmount: opts.amount,
                },
            ],
        }, opts.postedBy);
    }

    /**
     * Post an official receipt for non-loan transactions (Service Charge, Processing Fee,
     * Membership Fee, Passbook Fee, Misc Income, Other Income, Share Capital, Savings Deposit).
     *
     * DR: 1010 Cash on Hand (or 1020 Cash in Bank)
     * CR: Mapped Income/Equity/Liability Account
     */
    async postOtherReceipt(opts: {
        receiptId: string;
        receiptNumber?: string;
        payorName: string;
        amount: number;
        feeType: string;
        paymentMethod?: 'cash' | 'bank';
        bankAccountCode?: string;
        entryDate: Date;
        notes?: string;
        postedBy?: string;
    }): Promise<void> {
        const isBank = opts.paymentMethod === 'bank';
        const debitAccountCode = isBank ? (opts.bankAccountCode || ACCT.CASH_IN_BANK_DEFAULT) : ACCT.CASH_ON_HAND;
        const debitAccountName = isBank ? 'Cash in Bank' : 'Cash on Hand';

        let creditAccountCode = ACCT.OTHER_INCOME;
        let creditAccountName = 'Other Income';

        const normalizedFee = opts.feeType.toLowerCase();
        if (normalizedFee.includes('service') || normalizedFee.includes('processing')) {
            creditAccountCode = ACCT.SERVICE_CHARGES;
            creditAccountName = 'Service Charges';
        } else if (normalizedFee.includes('membership')) {
            creditAccountCode = ACCT.MEMBERSHIP_FEES;
            creditAccountName = 'Membership Fees';
        } else if (normalizedFee.includes('passbook') || normalizedFee.includes('misc')) {
            creditAccountCode = ACCT.MISCELLANEOUS_INCOME;
            creditAccountName = 'Miscellaneous Income';
        } else if (normalizedFee.includes('share') || normalizedFee.includes('cbu') || normalizedFee.includes('capital')) {
            creditAccountCode = ACCT.SHARE_CAPITAL;
            creditAccountName = 'Share Capital';
        } else if (normalizedFee.includes('saving')) {
            creditAccountCode = ACCT.SAVINGS_DEPOSITS_PAYABLE;
            creditAccountName = 'Savings Deposits Payable';
        }

        const orLabel = opts.receiptNumber ? ` [${opts.receiptNumber}]` : '';
        const desc = `Receipt${orLabel}: ${opts.payorName} — ${creditAccountName}${opts.notes ? ` (${opts.notes})` : ''}`;

        await this.journalEntryService.createEntry({
            entryDate: opts.entryDate,
            description: desc,
            entryType: 'auto',
            sourceTable: 'cash_transactions',
            sourceId: opts.receiptId,
            postedBy: opts.postedBy,
            lines: [
                {
                    accountCode: debitAccountCode,
                    accountName: debitAccountName,
                    debitAmount: opts.amount,
                    description: `Cash/Bank received from ${opts.payorName}`,
                },
                {
                    accountCode: creditAccountCode,
                    accountName: creditAccountName,
                    creditAmount: opts.amount,
                    description: `${creditAccountName} collected`,
                },
            ],
        }, opts.postedBy);
    }

    /**
     * Post a fund transfer between source of funds account buckets.
     * DR: Destination Account Code (e.g. 1011 Petty Cash, 1020 Cash in Bank)
     * CR: Source Account Code (e.g. 1010 Cash on Hand)
     */
    async postFundTransfer(opts: {
        transferId: string;
        sourceAccountCode: string;
        destinationAccountCode: string;
        amount: number;
        entryDate: Date;
        description?: string;
        postedBy?: string;
    }): Promise<void> {
        await this.journalEntryService.createEntry({
            entryDate: opts.entryDate,
            description: opts.description ?? `Fund transfer: ${opts.sourceAccountCode} -> ${opts.destinationAccountCode}`,
            entryType: 'auto',
            sourceTable: 'cash_transactions',
            sourceId: opts.transferId,
            postedBy: opts.postedBy,
            lines: [
                {
                    accountCode: opts.destinationAccountCode,
                    debitAmount: opts.amount,
                    description: 'Destination account funding',
                },
                {
                    accountCode: opts.sourceAccountCode,
                    creditAmount: opts.amount,
                    description: 'Source account debit',
                },
            ],
        }, opts.postedBy);
    }

    /**
     * Post withdrawal from Bank Account to Cash on Hand.
     * DR: Cash on Hand (1010)
     * CR: Cash in Bank (1020 or specific bank code)
     */
    async postBankWithdrawalToCashOnHand(opts: {
        transactionId: string;
        amount: number;
        bankAccountCode?: string;
        entryDate: Date;
        referenceNumber?: string;
        postedBy?: string;
    }): Promise<void> {
        const bankCode = opts.bankAccountCode ?? ACCT.CASH_IN_BANK_DEFAULT;
        await this.journalEntryService.createEntry({
            entryDate: opts.entryDate,
            description: `Bank withdrawal to Cash on Hand (Ref: ${opts.referenceNumber ?? 'N/A'})`,
            entryType: 'auto',
            sourceTable: 'bank_transactions',
            sourceId: opts.transactionId,
            postedBy: opts.postedBy,
            lines: [
                {
                    accountCode: ACCT.CASH_ON_HAND,
                    accountName: 'Cash on Hand',
                    debitAmount: opts.amount,
                    description: 'Cash received from bank withdrawal',
                },
                {
                    accountCode: bankCode,
                    accountName: 'Cash in Bank',
                    creditAmount: opts.amount,
                    description: 'Bank withdrawal',
                },
            ],
        }, opts.postedBy);
    }

    /**
     * Reclassifies any previously created journal entries for CBU or Savings migration
     * that were incorrectly credited to Other Income (4060) or Miscellaneous Income (4070),
     * moving them to Share Capital (3010) and Savings Deposits Payable (2010).
     */
    async reclassifyLegacyCbuEntries(): Promise<number> {
        let fixedCount = 0;
        try {
            const entries = await this.db.collections
                .get<JournalEntry>('journal_entries')
                .query(Q.where('deleted_at', Q.eq(null)))
                .fetch();

            for (const entry of entries) {
                const desc = (entry.description || '').toLowerCase();
                const isCbuAndSavings = desc.includes('cbu and savings') ||
                    desc.includes('cbu & savings') ||
                    desc.includes('total cbu and savings migration');
                const isCbuOnly = !isCbuAndSavings && (
                    desc.includes('cbu') ||
                    desc.includes('share capital') ||
                    desc.includes('capital build') ||
                    desc.includes('capital contribution')
                );
                const isSavingsOnly = !isCbuAndSavings && desc.includes('saving');

                if (!isCbuAndSavings && !isCbuOnly && !isSavingsOnly) continue;

                const lines = await this.db.collections
                    .get<JournalEntryLine>('journal_entry_lines')
                    .query(
                        Q.where('journal_entry_id', entry.id),
                        Q.where('deleted_at', Q.eq(null))
                    )
                    .fetch();

                const wrongIncomeLine = lines.find(l => l.accountCode === '4060' || l.accountCode === '4070');
                if (wrongIncomeLine) {
                    if (isCbuAndSavings) {
                        const totalCr = wrongIncomeLine.creditAmount || entry.totalCredit || 0;
                        const cbuPortion = totalCr >= 633960 && totalCr <= 633975
                            ? 454836.15
                            : Math.round(totalCr * 0.71744 * 100) / 100;
                        const savingsPortion = Math.round((totalCr - cbuPortion) * 100) / 100;

                        await this.db.write(async () => {
                            // Update the existing line to Share Capital (Equity 3010)
                            await wrongIncomeLine.update(l => {
                                l.accountCode = ACCT.SHARE_CAPITAL;
                                l.accountName = 'Share Capital';
                                l.creditAmount = cbuPortion;
                                l.description = 'CBU (Share Capital) portion';
                            });

                            // Create a new line for Savings Deposits Payable (Liability 2010)
                            await this.db.collections
                                .get<JournalEntryLine>('journal_entry_lines')
                                .create(l => {
                                    l.journalEntryId = entry.id;
                                    l.accountCode = ACCT.SAVINGS_DEPOSITS_PAYABLE;
                                    l.accountName = 'Savings Deposits Payable';
                                    l.debitAmount = 0;
                                    l.creditAmount = savingsPortion;
                                    l.description = 'Savings deposits portion';
                                });
                        });
                        fixedCount++;
                    } else if (isCbuOnly) {
                        await this.db.write(async () => {
                            await wrongIncomeLine.update(l => {
                                l.accountCode = ACCT.SHARE_CAPITAL;
                                l.accountName = 'Share Capital';
                                l.description = 'Share Capital / CBU';
                            });
                        });
                        fixedCount++;
                    } else if (isSavingsOnly) {
                        await this.db.write(async () => {
                            await wrongIncomeLine.update(l => {
                                l.accountCode = ACCT.SAVINGS_DEPOSITS_PAYABLE;
                                l.accountName = 'Savings Deposits Payable';
                                l.description = 'Savings deposit';
                            });
                        });
                        fixedCount++;
                    }
                }
            }
        } catch (err) {
            console.warn('[AutoPostingService] reclassifyLegacyCbuEntries error:', err);
        }
        return fixedCount;
    }

    /**
     * Scans operational tables and automatically creates double-entry journal entries
     * for any transactions that do not currently have a corresponding journal entry.
     * Prevents duplicates by matching source_table + source_id.
     */
    async backfillUnpostedTransactions(): Promise<{
        postedCount: number;
        errors: string[];
    }> {
        let postedCount = 0;
        const errors: string[] = [];

        // 0. Reclassify any legacy journal entries where CBU/Savings was placed in Other Income
        await this.reclassifyLegacyCbuEntries();

        try {
            // 1. Load existing posted journal entry source references
            const existingEntries = await this.db.get<JournalEntry>('journal_entries')
                .query(Q.where('deleted_at', null))
                .fetch();

            const postedSourceSet = new Set<string>();
            for (const entry of existingEntries) {
                if (entry.sourceTable && entry.sourceId) {
                    postedSourceSet.add(`${entry.sourceTable}:${entry.sourceId}`);
                }
            }

            // 2. Backfill Payments
            try {
                const payments = await this.db.get<Payment>('payments')
                    .query(Q.where('deleted_at', null))
                    .fetch();
                for (const p of payments) {
                    if (!postedSourceSet.has(`payments:${p.id}`)) {
                        const amount = p.amount ?? 0;
                        if (amount > 0) {
                            await this.postPayment({
                                paymentId: p.id,
                                principal: amount,
                                interest: 0,
                                entryDate: new Date(p.paymentDate || p.createdAt || Date.now()),
                                postedBy: p.collectorId || 'system',
                            });
                            postedCount++;
                            postedSourceSet.add(`payments:${p.id}`);
                        }
                    }
                }
            } catch (err: any) {
                errors.push(`Payments backfill error: ${err.message}`);
            }

            // 3. Backfill Disbursed Loans
            try {
                const loans = await this.db.get<Loan>('loans')
                    .query(Q.where('deleted_at', null))
                    .fetch();
                for (const loan of loans) {
                    const status = (loan.status || '').toLowerCase();
                    if (['disbursed', 'active', 'paid', 'completed'].includes(status)) {
                        if (!postedSourceSet.has(`loans:${loan.id}`)) {
                            const amount = loan.principalAmount ?? loan.totalAmount ?? 0;
                            if (amount > 0) {
                                const releaseDateMs = typeof loan.releaseDate === 'number' ? loan.releaseDate : (loan.releaseDate instanceof Date ? loan.releaseDate.getTime() : Date.now());
                                await this.postLoanDisbursement({
                                    loanId: loan.id,
                                    amount,
                                    entryDate: new Date(releaseDateMs || loan.createdAt || Date.now()),
                                    postedBy: loan.encodedBy || 'system',
                                });
                                postedCount++;
                                postedSourceSet.add(`loans:${loan.id}`);
                            }
                        }
                    }
                }
            } catch (err: any) {
                errors.push(`Loans backfill error: ${err.message}`);
            }

            // 4. Backfill Expenses
            try {
                const expenses = await this.db.get<Expense>('expenses')
                    .query(Q.where('deleted_at', null))
                    .fetch();
                for (const exp of expenses) {
                    if (!postedSourceSet.has(`expenses:${exp.id}`)) {
                        const amount = exp.amount ?? 0;
                        if (amount > 0) {
                            await this.postExpense({
                                expenseId: exp.id,
                                amount,
                                category: exp.category || 'General',
                                description: exp.description,
                                entryDate: new Date(exp.expenseDate || exp.createdAt || Date.now()),
                                postedBy: exp.encodedBy || 'system',
                            });
                            postedCount++;
                            postedSourceSet.add(`expenses:${exp.id}`);
                        }
                    }
                }
            } catch (err: any) {
                errors.push(`Expenses backfill error: ${err.message}`);
            }

            // 5. Backfill Savings / CBU Transactions
            try {
                const savings = await this.db.get<SavingsTransaction>('savings_transactions')
                    .query(Q.where('deleted_at', null))
                    .fetch();
                for (const st of savings) {
                    if (!postedSourceSet.has(`savings_transactions:${st.id}`)) {
                        const amount = st.amount ?? 0;
                        if (amount > 0) {
                            const isDeposit = !['WITHDRAWAL', 'WITHDRAW', 'WITHDRAW_CASH', 'WITHDRAW_LOAN', 'REDEMPTION', 'REVERSAL'].includes((st.type || '').toUpperCase());
                            const stTypeLower = (st.type || '').toLowerCase();
                            const isCbuType = stTypeLower === 'cbu' || stTypeLower.includes('cbu') || stTypeLower.includes('capital') || stTypeLower.includes('share');

                            if (isCbuType) {
                                await this.postShareCapital({
                                    transactionId: st.id,
                                    type: isDeposit ? 'deposit' : 'withdrawal',
                                    amount,
                                    entryDate: new Date(st.date || st.createdAt || Date.now()),
                                    postedBy: 'system',
                                });
                            } else {
                                await this.postSavingsTransaction({
                                    transactionId: st.id,
                                    type: isDeposit ? 'deposit' : 'withdrawal',
                                    amount,
                                    entryDate: new Date(st.date || st.createdAt || Date.now()),
                                    postedBy: 'system',
                                });
                            }
                            postedCount++;
                            postedSourceSet.add(`savings_transactions:${st.id}`);
                        }
                    }
                }
            } catch (err: any) {
                errors.push(`Savings backfill error: ${err.message}`);
            }

            // 6. Backfill Share Capital Transactions
            try {
                const shareCap = await this.db.get<ShareCapitalTransaction>('share_capital_transactions')
                    .query(Q.where('deleted_at', null))
                    .fetch();
                for (const sc of shareCap) {
                    if (!postedSourceSet.has(`share_capital_transactions:${sc.id}`)) {
                        const amount = sc.amount ?? 0;
                        if (amount > 0) {
                            await this.postShareCapital({
                                transactionId: sc.id,
                                type: sc.transactionType,
                                amount,
                                entryDate: new Date(sc.transactionDate || sc.createdAt || Date.now()),
                                postedBy: sc.recordedBy || 'system',
                            });
                            postedCount++;
                            postedSourceSet.add(`share_capital_transactions:${sc.id}`);
                        }
                    }
                }
            } catch (err: any) {
                errors.push(`Share capital backfill error: ${err.message}`);
            }

            // 7. Backfill Cash Transactions
            try {
                const cashTxns = await this.db.get<CashTransaction>('cash_transactions')
                    .query(Q.where('deleted_at', null))
                    .fetch();
                for (const ct of cashTxns) {
                    if (!postedSourceSet.has(`cash_transactions:${ct.id}`)) {
                        const amount = ct.amount ?? 0;
                        if (amount > 0 && ct.type !== 'starting_balance') {
                            await this.postCashTransaction({
                                transactionId: ct.id,
                                type: ct.type === 'in' ? 'in' : 'out',
                                amount,
                                particulars: ct.particulars,
                                entryDate: new Date(ct.transactionDate || ct.createdAt || Date.now()),
                                postedBy: ct.recordedBy || 'system',
                            });
                            postedCount++;
                            postedSourceSet.add(`cash_transactions:${ct.id}`);
                        }
                    }
                }
            } catch (err: any) {
                errors.push(`Cash transactions backfill error: ${err.message}`);
            }

            // 8. Backfill Bank Transactions
            try {
                const bankTxns = await this.db.get<BankTransaction>('bank_transactions')
                    .query(Q.where('deleted_at', null))
                    .fetch();
                for (const bt of bankTxns) {
                    if (!postedSourceSet.has(`bank_transactions:${bt.id}`)) {
                        const amount = bt.amount ?? 0;
                        if (amount > 0) {
                            const isDeposit = bt.type === 'deposit';
                            await this.postBankTransaction({
                                transactionId: bt.id,
                                type: isDeposit ? 'deposit' : 'withdrawal',
                                amount,
                                particulars: (bt as any).description || (bt as any).referenceNumber || '',
                                entryDate: new Date((bt as any).transactionDate || bt.createdAt || Date.now()),
                                postedBy: 'system',
                            });
                            postedCount++;
                            postedSourceSet.add(`bank_transactions:${bt.id}`);
                        }
                    }
                }
            } catch (err: any) {
                errors.push(`Bank transactions backfill error: ${err.message}`);
            }

        } catch (err: any) {
            errors.push(`General backfill error: ${err.message}`);
        }

        return { postedCount, errors };
    }
}

const instance = new AutoPostingServiceClass();
export { instance as AutoPostingService };
export default instance;

// Export the account code map for use in tests and UI
export { ACCT as AUTO_POSTING_ACCOUNTS, mapExpenseCategoryToAccount };
