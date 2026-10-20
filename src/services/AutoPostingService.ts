/**
 * AutoPostingService
 *
 * Automatically generates double-entry journal entries when financial transactions
 * are created in Agri-One. This service bridges the operational transaction
 * tables (expenses, cash, bank, agri farm/labour/settlement records) with the
 * formal accounting layer.
 *
 * Auto-posting rules:
 * ┌──────────────────────────────┬───────────────────────┬───────────────────────┐
 * │ Transaction                  │ Debit                 │ Credit                │
 * ├──────────────────────────────┼───────────────────────┼───────────────────────┤
 * │ Expense recorded             │ 5xxx [category acct]  │ 1010 Cash on Hand     │
 * │ Cash in                      │ 1010 Cash on Hand     │ 4060 Other Income     │
 * │ Cash out                     │ 5100 Other Expenses   │ 1010 Cash on Hand     │
 * │ Bank deposit                 │ 1020 Cash in Bank     │ 1010 Cash on Hand     │
 * │ Bank withdrawal              │ 1010 Cash on Hand     │ 1020 Cash in Bank     │
 * │ Farm expense paid            │ 5xxx Farm expense     │ 1010 Cash on Hand     │
 * │ Labour / settlement paid     │ 5xxx Labour            │ 1010 Cash on Hand     │
 * │ Harvest sale                 │ 1010 Cash on Hand      │ 4xxx Harvest revenue  │
 * │ Investor contribution        │ 1010 Cash on Hand      │ 2xxx Investor payable │
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
import Expense from '../database/models/Expense';
import CashTransaction from '../database/models/CashTransaction';
import BankTransaction from '../database/models/BankTransaction';
import AgriFarmExpense from '../database/models/AgriFarmExpense';
import AgriWeeklySettlement from '../database/models/AgriWeeklySettlement';
import AgriLaborLog from '../database/models/AgriLaborLog';
import AgriHarvestLog from '../database/models/AgriHarvestLog';
import AgriInvestorLedger from '../database/models/AgriInvestorLedger';


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

    // Agribusiness Domain Accounts (CDA & PAS 41 Agricultural standard)
    BIOLOGICAL_ASSETS_STANDING_CROPS: '1240',
    AGRI_PRODUCE_INVENTORY: '1245',
    AGRI_SUPPLIES_INVENTORY: '1246',
    LAND_OWNER_SETTLEMENT_PAYABLE: '2035',
    FARM_LABOR_PAYABLE: '2036',
    AGRI_PROJECT_EQUITY: '3015',
    AGRI_HARVEST_SALES_REVENUE: '4140',
    AGRI_BYPRODUCT_REVENUE: '4145',
    LAND_OWNER_SETTLEMENT_EXPENSE: '5160',
    FARM_LABOR_EXPENSE: '5161',
    AGRI_FERTILIZER_EXPENSE: '5162',
    AGRI_HERBICIDE_EXPENSE: '5163',
    AGRI_TRACTOR_EXPENSE: '5164',
    AGRI_SEEDLINGS_EXPENSE: '5165',
    AGRI_FUEL_EXPENSE: '5166',
    AGRI_TRUCKING_EXPENSE: '5167',
    AGRI_TOOLS_EXPENSE: '5168',
    AGRI_OTHER_FARM_EXPENSE: '5169',
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

function mapAgriExpenseCategoryToAccount(category: string): string {
    const lower = (category || '').toLowerCase().trim();
    if (lower.includes('fertilizer') || lower.includes('urea') || lower.includes('potash') || lower.includes('compost')) {
        return ACCT.AGRI_FERTILIZER_EXPENSE; // 5162
    }
    if (lower.includes('herbicide') || lower.includes('pest') || lower.includes('chemical') || lower.includes('spray')) {
        return ACCT.AGRI_HERBICIDE_EXPENSE; // 5163
    }
    if (lower.includes('tractor') || lower.includes('tillage') || lower.includes('machinery') || lower.includes('plow') || lower.includes('furrow')) {
        return ACCT.AGRI_TRACTOR_EXPENSE; // 5164
    }
    if (lower.includes('seed') || lower.includes('cutting') || lower.includes('stem') || lower.includes('planting material')) {
        return ACCT.AGRI_SEEDLINGS_EXPENSE; // 5165
    }
    if (lower.includes('fuel') || lower.includes('diesel') || lower.includes('gas') || lower.includes('oil')) {
        return ACCT.AGRI_FUEL_EXPENSE; // 5166
    }
    if (lower.includes('transport') || lower.includes('truck') || lower.includes('hauling') || lower.includes('logistics')) {
        return ACCT.AGRI_TRUCKING_EXPENSE; // 5167
    }
    if (lower.includes('tool') || lower.includes('scale') || lower.includes('equipment') || lower.includes('implement')) {
        return ACCT.AGRI_TOOLS_EXPENSE; // 5168
    }
    return ACCT.AGRI_OTHER_FARM_EXPENSE; // 5169
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
     * Post a cash transaction (cash on hand in/out).
     * The CBU, savings and loan-migration heuristics that used to sit here are gone:
     * those cooperative tables are retired on this branch, so every manual cash
     * movement posts straight to Other Income / Other Operating Expenses.
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

        // Regular cash in / out
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
     * Post a farm expense record (fertilizer, herbicide, tractor, seedlings, fuel, etc.).
     * DR: Respective Farm Expense Account (5162-5169)
     * CR: Cash on Hand (1010) if paid by Jet / farm cash, OR Agribusiness Project Equity / BioGreen Fund (3015) if paid by investor
     */
    async postAgriFarmExpense(opts: {
        expenseId: string;
        amount: number;
        category: string;
        description: string;
        paidBy: 'jet' | 'investor' | string;
        cropCycleId?: string | null;
        entryDate?: Date;
        postedBy?: string;
    }): Promise<JournalEntry | null> {
        if (opts.amount <= 0) return null;

        const expenseAccountCode = mapAgriExpenseCategoryToAccount(opts.category);
        const isInvestorPaid = opts.paidBy === 'investor';
        const creditAccountCode = isInvestorPaid ? ACCT.AGRI_PROJECT_EQUITY : ACCT.CASH_ON_HAND;
        const creditAccountName = isInvestorPaid ? 'Agribusiness Project Equity / BioGreen Fund' : 'Cash on Hand (COH)';

        const entryDate = opts.entryDate || new Date();
        const cycleTag = opts.cropCycleId ? ` [Cycle: ${opts.cropCycleId}]` : '';

        return this.journalEntryService.createEntry({
            entryDate,
            description: `Farm Expense — ${opts.category}: ${opts.description}${cycleTag} (${isInvestorPaid ? 'BioGreen Partner Funded' : 'JetFarm Disbursed'})`,
            entryType: 'auto',
            sourceTable: 'agri_farm_expenses',
            sourceId: opts.expenseId,
            postedBy: opts.postedBy,
            lines: [
                {
                    accountCode: expenseAccountCode,
                    accountName: opts.category,
                    debitAmount: opts.amount,
                    description: opts.description,
                    businessUnitId: 'agribusiness',
                    moduleSourceTable: 'agri_farm_expenses',
                    moduleSourceId: opts.cropCycleId || opts.expenseId,
                },
                {
                    accountCode: creditAccountCode,
                    accountName: creditAccountName,
                    creditAmount: opts.amount,
                    description: isInvestorPaid ? 'BioGreen Partner Equity Contribution' : 'Cash disbursed for farm inputs',
                    businessUnitId: 'agribusiness',
                    moduleSourceTable: 'agri_farm_expenses',
                    moduleSourceId: opts.cropCycleId || opts.expenseId,
                },
            ],
        }, opts.postedBy);
    }

    /**
     * Post a weekly land owner crop share settlement (₱1/kg vs ₱25k minimum guarantee).
     * DR: Land Owner Crop Share & Guaranteed Settlement (5160)
     * CR: Cash on Hand (1010) if paid, OR Land Owner Settlement Payable (2035) if approved
     */
    async postAgriWeeklySettlement(opts: {
        settlementId: string;
        cropCycleId: string;
        weekNumber: number;
        landOwnerName?: string;
        netPayoutDue: number;
        paymentStatus?: string;
        disbursementDate?: Date | null;
        postedBy?: string;
    }): Promise<JournalEntry | null> {
        if (opts.netPayoutDue <= 0) return null;

        const isPaid = (opts.paymentStatus || '').toLowerCase() === 'paid';
        const creditAccountCode = isPaid ? ACCT.CASH_ON_HAND : ACCT.LAND_OWNER_SETTLEMENT_PAYABLE;
        const creditAccountName = isPaid ? 'Cash on Hand (COH)' : 'Land Owner Crop Share / Settlement Payable';

        const entryDate = isPaid && opts.disbursementDate ? new Date(opts.disbursementDate) : new Date();
        const loName = opts.landOwnerName ? ` — ${opts.landOwnerName}` : '';

        return this.journalEntryService.createEntry({
            entryDate,
            description: `Land Owner Settlement — Wk ${opts.weekNumber}${loName} [Cycle: ${opts.cropCycleId}] (${isPaid ? 'Paid' : 'Approved Payable'})`,
            entryType: 'auto',
            sourceTable: 'agri_weekly_settlements',
            sourceId: opts.settlementId,
            postedBy: opts.postedBy,
            lines: [
                {
                    accountCode: ACCT.LAND_OWNER_SETTLEMENT_EXPENSE,
                    accountName: 'Land Owner Crop Share & Guaranteed Settlement',
                    debitAmount: opts.netPayoutDue,
                    description: `Crop share settlement Wk ${opts.weekNumber}`,
                    businessUnitId: 'agribusiness',
                    moduleSourceTable: 'agri_weekly_settlements',
                    moduleSourceId: opts.cropCycleId,
                },
                {
                    accountCode: creditAccountCode,
                    accountName: creditAccountName,
                    creditAmount: opts.netPayoutDue,
                    description: isPaid ? 'Settlement cash disbursement' : 'Accrued land owner settlement payable',
                    businessUnitId: 'agribusiness',
                    moduleSourceTable: 'agri_weekly_settlements',
                    moduleSourceId: opts.cropCycleId,
                },
            ],
        }, opts.postedBy);
    }

    /**
     * Post a farm labor log wage disbursement or payable.
     * DR: Farm Field Labor & Harvesting Wages (5161)
     * CR: Cash on Hand (1010) if paid, OR Farm Labor Payable (2036) if pending
     */
    async postAgriLaborLog(opts: {
        laborLogId: string;
        workerName?: string;
        task: string;
        totalPay: number;
        paymentStatus?: string;
        workDate?: Date;
        cropCycleId?: string | null;
        postedBy?: string;
    }): Promise<JournalEntry | null> {
        if (opts.totalPay <= 0) return null;

        const isPaid = (opts.paymentStatus || '').toLowerCase() === 'paid';
        const creditAccountCode = isPaid ? ACCT.CASH_ON_HAND : ACCT.FARM_LABOR_PAYABLE;
        const creditAccountName = isPaid ? 'Cash on Hand (COH)' : 'Farm Labor & Field Wages Payable';

        const entryDate = opts.workDate || new Date();
        const workerTag = opts.workerName ? ` (${opts.workerName})` : '';

        return this.journalEntryService.createEntry({
            entryDate,
            description: `Farm Field Labor — ${opts.task}${workerTag}${opts.cropCycleId ? ` [Cycle: ${opts.cropCycleId}]` : ''}`,
            entryType: 'auto',
            sourceTable: 'agri_labor_logs',
            sourceId: opts.laborLogId,
            postedBy: opts.postedBy,
            lines: [
                {
                    accountCode: ACCT.FARM_LABOR_EXPENSE,
                    accountName: 'Farm Field Labor & Harvesting Wages',
                    debitAmount: opts.totalPay,
                    description: opts.task,
                    businessUnitId: 'agribusiness',
                    moduleSourceTable: 'agri_labor_logs',
                    moduleSourceId: opts.cropCycleId || opts.laborLogId,
                },
                {
                    accountCode: creditAccountCode,
                    accountName: creditAccountName,
                    creditAmount: opts.totalPay,
                    description: isPaid ? 'Cash wage disbursement' : 'Accrued farm labor wages payable',
                    businessUnitId: 'agribusiness',
                    moduleSourceTable: 'agri_labor_logs',
                    moduleSourceId: opts.cropCycleId || opts.laborLogId,
                },
            ],
        }, opts.postedBy);
    }

    /**
     * Post harvest off-take delivery / cassava sales revenue.
     * DR: Cash on Hand (1010) (or Receivables)
     * CR: Crop Harvest Sales & Offtake Revenue (4140)
     */
    async postAgriHarvestSale(opts: {
        harvestLogId: string;
        cropCycleId: string;
        batchNumber: string;
        netWeightKg: number;
        pricePerKilo?: number;
        grossRevenue: number;
        harvestDate?: Date;
        investorId?: string | null;
        postedBy?: string;
    }): Promise<JournalEntry | null> {
        if (opts.grossRevenue <= 0) return null;

        const entryDate = opts.harvestDate || new Date();

        return this.journalEntryService.createEntry({
            entryDate,
            description: `Agri Harvest Off-take Sale — Batch ${opts.batchNumber} (${opts.netWeightKg.toLocaleString()} kg @ ₱${(opts.pricePerKilo || 4).toFixed(2)}/kg) [Cycle: ${opts.cropCycleId}]`,
            entryType: 'auto',
            sourceTable: 'agri_harvest_logs',
            sourceId: opts.harvestLogId,
            postedBy: opts.postedBy,
            lines: [
                {
                    accountCode: ACCT.CASH_ON_HAND,
                    accountName: 'Cash on Hand (COH)',
                    debitAmount: opts.grossRevenue,
                    description: `Proceeds from harvest batch ${opts.batchNumber}`,
                    businessUnitId: 'agribusiness',
                    moduleSourceTable: 'agri_harvest_logs',
                    moduleSourceId: opts.cropCycleId,
                },
                {
                    accountCode: ACCT.AGRI_HARVEST_SALES_REVENUE,
                    accountName: 'Crop Harvest Sales & Offtake Revenue',
                    creditAmount: opts.grossRevenue,
                    description: 'Harvest off-take revenue recognized',
                    businessUnitId: 'agribusiness',
                    moduleSourceTable: 'agri_harvest_logs',
                    moduleSourceId: opts.cropCycleId,
                },
            ],
        }, opts.postedBy);
    }

    /**
     * Post BioGreen / Agri Investor ledger transaction (capital injection or off-take settlement).
     */
    async postAgriInvestorTransaction(opts: {
        ledgerId: string;
        investorName?: string;
        type: string;
        amount: number;
        transactionDate?: Date;
        cropCycleId?: string | null;
        notes?: string | null;
        postedBy?: string;
    }): Promise<JournalEntry | null> {
        if (opts.amount <= 0) return null;

        const entryDate = opts.transactionDate || new Date();
        const invTag = opts.investorName ? ` (${opts.investorName})` : '';

        if (opts.type === 'capital_injection' || opts.type === 'equipment_provision') {
            return this.journalEntryService.createEntry({
                entryDate,
                description: `Agri Investor Capital Injection${invTag}: ${opts.notes || 'Capital contribution for farm operations'}`,
                entryType: 'auto',
                sourceTable: 'agri_investor_ledgers',
                sourceId: opts.ledgerId,
                postedBy: opts.postedBy,
                lines: [
                    {
                        accountCode: ACCT.CASH_ON_HAND,
                        accountName: 'Cash on Hand (COH)',
                        debitAmount: opts.amount,
                        description: 'Investor capital deposited into operations',
                        businessUnitId: 'agribusiness',
                        moduleSourceTable: 'agri_investor_ledgers',
                        moduleSourceId: opts.cropCycleId || opts.ledgerId,
                    },
                    {
                        accountCode: ACCT.AGRI_PROJECT_EQUITY,
                        accountName: 'Agribusiness Project Equity / BioGreen Fund',
                        creditAmount: opts.amount,
                        description: 'Partner equity contribution recognized',
                        businessUnitId: 'agribusiness',
                        moduleSourceTable: 'agri_investor_ledgers',
                        moduleSourceId: opts.cropCycleId || opts.ledgerId,
                    },
                ],
            }, opts.postedBy);
        } else if (opts.type === 'harvest_offtake') {
            return this.journalEntryService.createEntry({
                entryDate,
                description: `Agri Harvest Off-take Delivery${invTag}: ${opts.notes || 'Off-take settled against partner ledger'}`,
                entryType: 'auto',
                sourceTable: 'agri_investor_ledgers',
                sourceId: opts.ledgerId,
                postedBy: opts.postedBy,
                lines: [
                    {
                        accountCode: ACCT.AGRI_PROJECT_EQUITY,
                        accountName: 'Agribusiness Project Equity / BioGreen Fund',
                        debitAmount: opts.amount,
                        description: 'Settlement against partner equity/advance',
                        businessUnitId: 'agribusiness',
                        moduleSourceTable: 'agri_investor_ledgers',
                        moduleSourceId: opts.cropCycleId || opts.ledgerId,
                    },
                    {
                        accountCode: ACCT.AGRI_HARVEST_SALES_REVENUE,
                        accountName: 'Crop Harvest Sales & Offtake Revenue',
                        creditAmount: opts.amount,
                        description: 'Off-take revenue recognized',
                        businessUnitId: 'agribusiness',
                        moduleSourceTable: 'agri_investor_ledgers',
                        moduleSourceId: opts.cropCycleId || opts.ledgerId,
                    },
                ],
            }, opts.postedBy);
        }

        return null;
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

            // 2. Backfill Expenses
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


            // 3. Backfill Cash Transactions
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

            // 4. Backfill Bank Transactions
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

            // 5. Backfill Agri Farm Expenses
            try {
                const farmExpenses = await this.db.get<AgriFarmExpense>('agri_farm_expenses')
                    .query(Q.where('deleted_at', null))
                    .fetch();
                for (const fe of farmExpenses) {
                    if (!postedSourceSet.has(`agri_farm_expenses:${fe.id}`)) {
                        const amount = fe.amount ?? 0;
                        if (amount > 0) {
                            await this.postAgriFarmExpense({
                                expenseId: fe.id,
                                amount,
                                category: fe.category || 'miscellaneous',
                                description: fe.description || 'Farm operational expense',
                                paidBy: fe.paidBy || 'jet',
                                cropCycleId: fe.cropCycleId,
                                entryDate: new Date(fe.expenseDate || fe.createdAt || Date.now()),
                                postedBy: 'system',
                            });
                            postedCount++;
                            postedSourceSet.add(`agri_farm_expenses:${fe.id}`);
                        }
                    }
                }
            } catch (err: any) {
                errors.push(`Agri farm expenses backfill error: ${err.message}`);
            }

            // 6. Backfill Agri Weekly Settlements
            try {
                const settlements = await this.db.get<AgriWeeklySettlement>('agri_weekly_settlements')
                    .query(Q.where('deleted_at', null))
                    .fetch();
                for (const ws of settlements) {
                    const status = (ws.paymentStatus || '').toLowerCase();
                    if (['paid', 'approved'].includes(status) && !postedSourceSet.has(`agri_weekly_settlements:${ws.id}`)) {
                        const amount = ws.netPayoutDueThisWeek ?? 0;
                        if (amount > 0) {
                            await this.postAgriWeeklySettlement({
                                settlementId: ws.id,
                                cropCycleId: ws.cropCycleId,
                                weekNumber: ws.weekNumber || 1,
                                netPayoutDue: amount,
                                paymentStatus: ws.paymentStatus,
                                disbursementDate: ws.disbursementDate ? new Date(ws.disbursementDate) : null,
                                postedBy: 'system',
                            });
                            postedCount++;
                            postedSourceSet.add(`agri_weekly_settlements:${ws.id}`);
                        }
                    }
                }
            } catch (err: any) {
                errors.push(`Agri weekly settlements backfill error: ${err.message}`);
            }

            // 7. Backfill Agri Labor Logs
            try {
                const laborLogs = await this.db.get<AgriLaborLog>('agri_labor_logs')
                    .query(Q.where('deleted_at', null))
                    .fetch();
                for (const ll of laborLogs) {
                    const status = (ll.paymentStatus || '').toLowerCase();
                    if (status === 'paid' && !postedSourceSet.has(`agri_labor_logs:${ll.id}`)) {
                        const amount = ll.totalPay ?? 0;
                        if (amount > 0) {
                            await this.postAgriLaborLog({
                                laborLogId: ll.id,
                                task: ll.task || 'Field Labor',
                                totalPay: amount,
                                paymentStatus: ll.paymentStatus,
                                workDate: new Date(ll.workDate || ll.createdAt || Date.now()),
                                cropCycleId: ll.cropCycleId,
                                postedBy: 'system',
                            });
                            postedCount++;
                            postedSourceSet.add(`agri_labor_logs:${ll.id}`);
                        }
                    }
                }
            } catch (err: any) {
                errors.push(`Agri labor logs backfill error: ${err.message}`);
            }

            // 8. Backfill Agri Investor Ledgers
            try {
                const investorLedgers = await this.db.get<AgriInvestorLedger>('agri_investor_ledgers')
                    .query(Q.where('deleted_at', null))
                    .fetch();
                for (const il of investorLedgers) {
                    if (!postedSourceSet.has(`agri_investor_ledgers:${il.id}`)) {
                        const amount = il.amount ?? 0;
                        if (amount > 0) {
                            await this.postAgriInvestorTransaction({
                                ledgerId: il.id,
                                type: il.type,
                                amount,
                                transactionDate: new Date(il.transactionDate || il.createdAt || Date.now()),
                                cropCycleId: il.cropCycleId,
                                notes: il.notes,
                                postedBy: 'system',
                            });
                            postedCount++;
                            postedSourceSet.add(`agri_investor_ledgers:${il.id}`);
                        }
                    }
                }
            } catch (err: any) {
                errors.push(`Agri investor ledgers backfill error: ${err.message}`);
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
export { ACCT as AUTO_POSTING_ACCOUNTS, mapExpenseCategoryToAccount, mapAgriExpenseCategoryToAccount };
