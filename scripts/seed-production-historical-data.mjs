/**
 * seed-production-historical-data.mjs
 *
 * Seeds audited 2024 and 2025 financial statement data from CS Arriola Auditing Services
 * reports directly into the production Supabase database (YOUR_SUPABASE_PROJECT).
 *
 * Usage:
 *   node scripts/seed-production-historical-data.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set. A service key is never hardcoded in this repo - export it in the shell that runs this script.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

const PERFORMED_BY = 'historical-migration';
const now = new Date().toISOString();

// ─── COA Codes ────────────────────────────────────────────────────────────
const COA = {
    CASH_ON_HAND: '1010',
    CASH_IN_BANK: '1020',
    LOANS_RECEIVABLE: '1100',
    SUNDRY_ASSETS: '1710',
    SAVINGS_DEPOSITS: '2010',
    INTEREST_SHARE_CAPITAL_PAYABLE: '2050',
    PATRONAGE_REFUND_PAYABLE: '2060',
    DUE_TO_UNION: '2070',
    SHARE_CAPITAL: '3010',
    RESERVE_FUND: '3020',
    EDUCATION_FUND: '3030',
    COMMUNITY_DEV_FUND: '3040',
    OPTIONAL_FUND: '3050',
    RETAINED_SURPLUS: '3060',
    INTEREST_ON_LOANS: '4010',
    SERVICE_FEES: '4020',
    MEMBERSHIP_FEES: '4030',
    INTEREST_ON_INVESTMENTS: '4060',
    MISCELLANEOUS_INCOME: '4070',
    FINANCING_COSTS: '5110',
    OTHER_EXPENSES: '5100',
};

// ─── Default Chart of Accounts ─────────────────────────────────────────────
const DEFAULT_ACCOUNTS = [
    { code: '1000', name: 'ASSETS', account_type: 'asset', normal_balance: 'debit', is_header: true, sort_order: 1 },
    { code: '1010', name: 'Cash on Hand', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 2 },
    { code: '1020', name: 'Cash in Bank — BDO', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 3 },
    { code: '1030', name: 'Cash in Bank — PNB', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 4 },
    { code: '1040', name: 'Cash in Bank — Other', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 5 },
    { code: '1100', name: 'Loans Receivable', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 10 },
    { code: '1110', name: 'Allowance for Loan Losses', account_type: 'asset', normal_balance: 'credit', parent_code: '1100', sort_order: 11, description: 'Contra-asset reducing Loans Receivable' },
    { code: '1200', name: 'Savings Loan Receivable', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 15 },
    { code: '1300', name: 'Interest Receivable', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 20 },
    { code: '1400', name: 'Prepaid Expenses', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 25 },
    { code: '1500', name: 'Other Receivables', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 30 },
    { code: '1600', name: 'Property and Equipment (net)', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 35 },
    { code: '1700', name: 'Other Assets', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 40 },
    { code: '1710', name: 'Other Non-Current Assets (Sundry)', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 41 },

    { code: '2000', name: 'LIABILITIES', account_type: 'liability', normal_balance: 'credit', is_header: true, sort_order: 100 },
    { code: '2010', name: 'Savings Deposits Payable', account_type: 'liability', normal_balance: 'credit', parent_code: '2000', sort_order: 101 },
    { code: '2020', name: 'Share Capital Payable', account_type: 'liability', normal_balance: 'credit', parent_code: '2000', sort_order: 102 },
    { code: '2030', name: 'Accounts Payable', account_type: 'liability', normal_balance: 'credit', parent_code: '2000', sort_order: 103 },
    { code: '2040', name: 'Accrued Expenses Payable', account_type: 'liability', normal_balance: 'credit', parent_code: '2000', sort_order: 104 },
    { code: '2050', name: 'Interest on Share Capital Payable', account_type: 'liability', normal_balance: 'credit', parent_code: '2000', sort_order: 105 },
    { code: '2060', name: 'Patronage Refund Payable', account_type: 'liability', normal_balance: 'credit', parent_code: '2000', sort_order: 106 },
    { code: '2070', name: 'Due to Union/Federation', account_type: 'liability', normal_balance: 'credit', parent_code: '2000', sort_order: 107 },
    { code: '2100', name: 'Other Payables', account_type: 'liability', normal_balance: 'credit', parent_code: '2000', sort_order: 110 },

    { code: '3000', name: 'FUND BALANCE / EQUITY', account_type: 'equity', normal_balance: 'credit', is_header: true, sort_order: 200 },
    { code: '3010', name: 'Share Capital', account_type: 'equity', normal_balance: 'credit', parent_code: '3000', sort_order: 201 },
    { code: '3020', name: 'Reserve Fund', account_type: 'equity', normal_balance: 'credit', parent_code: '3000', sort_order: 202 },
    { code: '3030', name: 'Education Fund', account_type: 'equity', normal_balance: 'credit', parent_code: '3000', sort_order: 203 },
    { code: '3040', name: 'Community Development Fund', account_type: 'equity', normal_balance: 'credit', parent_code: '3000', sort_order: 204 },
    { code: '3050', name: 'Optional Fund', account_type: 'equity', normal_balance: 'credit', parent_code: '3000', sort_order: 205 },
    { code: '3060', name: 'Retained Surplus / (Deficit)', account_type: 'equity', normal_balance: 'credit', parent_code: '3000', sort_order: 210 },

    { code: '4000', name: 'INCOME', account_type: 'income', normal_balance: 'credit', is_header: true, sort_order: 300 },
    { code: '4010', name: 'Interest on Loans', account_type: 'income', normal_balance: 'credit', parent_code: '4000', sort_order: 301 },
    { code: '4020', name: 'Service Charges', account_type: 'income', normal_balance: 'credit', parent_code: '4000', sort_order: 302 },
    { code: '4030', name: 'Membership Fees', account_type: 'income', normal_balance: 'credit', parent_code: '4000', sort_order: 303 },
    { code: '4040', name: 'Penalties & Fines', account_type: 'income', normal_balance: 'credit', parent_code: '4000', sort_order: 304 },
    { code: '4050', name: 'Dividend Income', account_type: 'income', normal_balance: 'credit', parent_code: '4000', sort_order: 305 },
    { code: '4060', name: 'Other Income', account_type: 'income', normal_balance: 'credit', parent_code: '4000', sort_order: 310 },
    { code: '4070', name: 'Miscellaneous Income', account_type: 'income', normal_balance: 'credit', parent_code: '4000', sort_order: 311 },

    { code: '5000', name: 'EXPENSES', account_type: 'expense', normal_balance: 'debit', is_header: true, sort_order: 400 },
    { code: '5010', name: 'Salaries & Wages', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 401 },
    { code: '5020', name: 'Office Expenses', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 402 },
    { code: '5030', name: 'Communication Expenses', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 403 },
    { code: '5040', name: 'Transportation Expenses', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 404 },
    { code: '5050', name: 'Depreciation & Amortization', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 405 },
    { code: '5060', name: 'Taxes & Licenses', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 406 },
    { code: '5070', name: 'Repairs & Maintenance', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 407 },
    { code: '5080', name: 'Training & Development', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 408 },
    { code: '5090', name: 'Professional Fees', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 409 },
    { code: '5100', name: 'Other Operating Expenses', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 420 },
    { code: '5110', name: 'Interest on Deposit Liabilities', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 421 },
];

function getDeterministicId(code) {
    const md5Hex = crypto.createHash('md5').update(code).digest('hex');
    return [
        md5Hex.substring(0, 8),
        md5Hex.substring(8, 12),
        md5Hex.substring(12, 16),
        md5Hex.substring(16, 20),
        md5Hex.substring(20)
    ].join('-');
}

async function checkAndSeedCOA() {
    console.log('🔍 Checking Chart of Accounts in production...');
    const { data: coas, error } = await supabase
        .from('chart_of_accounts')
        .select('code');

    if (error) throw new Error(`Failed to check COA: ${error.message}`);

    if (coas.length === 0) {
        console.log('🌱 Seeding default Chart of Accounts to production...');
        const rows = DEFAULT_ACCOUNTS.map(a => ({
            id: getDeterministicId(a.code),
            code: a.code,
            name: a.name,
            account_type: a.account_type,
            normal_balance: a.normal_balance,
            parent_code: a.parent_code || null,
            is_header: a.is_header || false,
            description: a.description || null,
            sort_order: a.sort_order,
            is_active: true,
            created_at: now,
            updated_at: now
        }));

        const { error: insertError } = await supabase
            .from('chart_of_accounts')
            .insert(rows);

        if (insertError) throw new Error(`Failed to seed COA: ${insertError.message}`);
        console.log('✅ Chart of Accounts seeded successfully.');
    } else {
        console.log(`✅ Chart of Accounts already exists (${coas.length} accounts found).`);
    }
}

async function insertJournalEntry({ date, description, entryType, lines, fiscalYear }) {
    const entryId = uuidv4();
    const refNumber = `JE-${fiscalYear}-HIST-${Math.floor(100000 + Math.random() * 900000)}`;

    const totalDebit = lines.reduce((s, l) => s + (l.debitAmount || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.creditAmount || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.05) {
        throw new Error(`❌ Unbalanced entry "${description}": DR ${totalDebit} != CR ${totalCredit}`);
    }

    const { error: entryError } = await supabase
        .from('journal_entries')
        .insert({
            id: entryId,
            reference_number: refNumber,
            entry_date: date,
            description,
            entry_type: entryType,
            is_posted: true,
            fiscal_year: fiscalYear,
            fiscal_month: new Date(date).getMonth() + 1,
            total_debit: totalDebit,
            total_credit: totalCredit,
            posted_by: PERFORMED_BY,
            created_at: now,
            updated_at: now,
        });

    if (entryError) throw new Error(`Entry insert failed: ${entryError.message}`);

    const lineRows = lines.map(l => ({
        id: uuidv4(),
        journal_entry_id: entryId,
        account_code: l.accountCode,
        account_name: l.accountCode,
        debit_amount: l.debitAmount || 0,
        credit_amount: l.creditAmount || 0,
        description: l.description || description,
        created_at: now,
        updated_at: now,
    }));

    const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(lineRows);

    if (linesError) throw new Error(`Lines insert failed: ${linesError.message}`);

    return entryId;
}

async function seedPeriodSettings() {
    console.log('🌱 Seeding financial period settings to production...');

    // Delete existing settings to prevent conflict on unique constraints
    await supabase.from('financial_period_settings').delete().in('fiscal_year', [2024, 2025]);

    const settings = [
        {
            id: uuidv4(),
            fiscal_year: 2025,
            authorized_share_capital: 280000.00,
            subscribed_capital: 250000.00,
            subscription_receivable: 18092.73,
            sundry_assets: 121399.90,
            prior_year_data: JSON.stringify({
                cashOnHand: 39902.93,
                cashInBank: 53011.35,
                loanReceivable: 164622.70,
                sundryAssets: 117411.91,
                totalAssets: 374948.89,
                depositLiabilities: 116384.50,
                interestShareCapitalPayable: 559.15,
                patronageRefundPayable: 559.15,
                dueToUnion: 186.38,
                otherPayables: 0,
                totalCurrentLiabilities: 117689.18,
                subscribedCapital: 250000.00,
                subscriptionReceivable: 18092.73,
                reserveFund: 17094.77,
                educationFund: 1366.41,
                communityDevFund: 1647.38,
                optionalFund: 5243.88,
                retainedSurplus: 0,
                totalEquity: 257259.71,
                authorizedShareCapital: 280000.00,
                interestOnLoans: 16260.00,
                serviceCharges: 3620.00,
                penalties: 0,
                membershipFees: 0,
                interestOnInvestments: 0,
                miscellaneousIncome: 0,
                financingCosts: 6814.31,
                salaries: 0,
                office: 0,
                communication: 0,
                transportation: 0,
                depreciation: 0,
                taxes: 0,
                repairs: 0,
                training: 0,
                professional: 0,
                otherExpenses: 9338.00,
            }),
            created_at: now,
            updated_at: now
        },
        {
            id: uuidv4(),
            fiscal_year: 2024,
            authorized_share_capital: 280000.00,
            subscribed_capital: 250000.00,
            subscription_receivable: 18092.73,
            sundry_assets: 117411.91,
            prior_year_data: JSON.stringify({
                cashOnHand: 0,
                cashInBank: 0,
                loanReceivable: 0,
                sundryAssets: 0,
                totalAssets: 0,
                depositLiabilities: 0,
                interestShareCapitalPayable: 0,
                patronageRefundPayable: 0,
                dueToUnion: 0,
                otherPayables: 0,
                totalCurrentLiabilities: 0,
                subscribedCapital: 208622.34,
                subscriptionReceivable: 18092.73,
                reserveFund: 15230.91,
                educationFund: 1366.41,
                communityDevFund: 1535.55,
                optionalFund: 4982.94,
                retainedSurplus: 0,
                totalEquity: 211645.02,
                authorizedShareCapital: 280000.00,
                interestOnLoans: 0,
                serviceCharges: 0,
                penalties: 0,
                membershipFees: 0,
                interestOnInvestments: 0,
                miscellaneousIncome: 0,
                financingCosts: 0,
                salaries: 0,
                office: 0,
                communication: 0,
                transportation: 0,
                depreciation: 0,
                taxes: 0,
                repairs: 0,
                training: 0,
                professional: 0,
                otherExpenses: 0,
            }),
            created_at: now,
            updated_at: now
        }
    ];

    const { error } = await supabase
        .from('financial_period_settings')
        .insert(settings);

    if (error) throw new Error(`Failed to seed period settings: ${error.message}`);
    console.log('✅ Financial period settings seeded successfully.');
}

async function cleanExistingJournalEntries() {
    console.log('🧹 Cleaning existing historical journal entries from production...');
    const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .delete()
        .eq('description', 'Audited Cash on Hand') // or matching entry descriptions
        .or('description.ilike.%FY2025%')
        .or('description.ilike.%FY2024%');

    if (linesError) console.warn('Warning when cleaning lines:', linesError.message);

    const { error: entriesError } = await supabase
        .from('journal_entries')
        .delete()
        .eq('posted_by', PERFORMED_BY);

    if (entriesError) console.warn('Warning when cleaning entries:', entriesError.message);
    console.log('✅ Cleaned existing historical journal entries.');
}

async function seedJournalEntries() {
    console.log('🌱 Seeding FY2024 closing balance entry to production...');
    const DEC31_2024 = new Date(2024, 11, 31, 23, 59, 59).toISOString();

    await insertJournalEntry({
        date: DEC31_2024,
        description: 'FY2024: Audited Balance Sheet closing balances (historical migration)',
        entryType: 'adjusting',
        fiscalYear: 2024,
        lines: [
            { accountCode: COA.CASH_ON_HAND, debitAmount: 39902.93, description: 'Audited Cash on Hand' },
            { accountCode: COA.CASH_IN_BANK, debitAmount: 53011.35, description: 'Audited Cash in Bank' },
            { accountCode: COA.LOANS_RECEIVABLE, debitAmount: 164622.70, description: 'Audited Loans Receivable' },
            { accountCode: COA.SUNDRY_ASSETS, debitAmount: 117411.91, description: 'Audited Other Non-Current Assets' },
            { accountCode: COA.SAVINGS_DEPOSITS, creditAmount: 116384.50, description: 'Audited Deposit Liabilities' },
            { accountCode: COA.INTEREST_SHARE_CAPITAL_PAYABLE, creditAmount: 559.15, description: 'Audited Interest on Share Capital Payable' },
            { accountCode: COA.PATRONAGE_REFUND_PAYABLE, creditAmount: 559.15, description: 'Audited Patronage Refund Payable' },
            { accountCode: COA.DUE_TO_UNION, creditAmount: 186.38, description: 'Audited Due to Union/Federation' },
            { accountCode: COA.SHARE_CAPITAL, creditAmount: 231907.27, description: 'Audited Paid-up Share Capital' },
            { accountCode: COA.RESERVE_FUND, creditAmount: 17094.77, description: 'Audited Reserve Fund' },
            { accountCode: COA.EDUCATION_FUND, creditAmount: 1366.41, description: 'Audited Education and Training Fund' },
            { accountCode: COA.COMMUNITY_DEV_FUND, creditAmount: 1647.38, description: 'Audited Community Development Fund' },
            { accountCode: COA.OPTIONAL_FUND, creditAmount: 5243.88, description: 'Audited Optional Fund' },
        ]
    });

    console.log('🌱 Seeding FY2025 transactions and adjustments to production...');
    const DEC31_2025 = new Date(2025, 11, 31, 23, 59, 59).toISOString();

    // 1. Interest income from loans
    await insertJournalEntry({
        date: DEC31_2025,
        description: 'FY2025: Income from credit operations — interest on loans',
        entryType: 'adjusting',
        fiscalYear: 2025,
        lines: [
            { accountCode: COA.CASH_ON_HAND, debitAmount: 10500.00 },
            { accountCode: COA.INTEREST_ON_LOANS, creditAmount: 10500.00 },
        ]
    });

    // 2. Service charges/fees
    await insertJournalEntry({
        date: DEC31_2025,
        description: 'FY2025: Service fees collected',
        entryType: 'adjusting',
        fiscalYear: 2025,
        lines: [
            { accountCode: COA.CASH_ON_HAND, debitAmount: 2300.00 },
            { accountCode: COA.SERVICE_FEES, creditAmount: 2300.00 },
        ]
    });

    // 3. Other income
    await insertJournalEntry({
        date: DEC31_2025,
        description: 'FY2025: Other income — membership, investments, miscellaneous',
        entryType: 'adjusting',
        fiscalYear: 2025,
        lines: [
            { accountCode: COA.CASH_ON_HAND, debitAmount: 328.62 },
            { accountCode: COA.MEMBERSHIP_FEES, creditAmount: 200.00 },
            { accountCode: COA.INTEREST_ON_INVESTMENTS, creditAmount: 78.62 },
            { accountCode: COA.MISCELLANEOUS_INCOME, creditAmount: 50.00 },
        ]
    });

    // 4. Financing costs
    await insertJournalEntry({
        date: DEC31_2025,
        description: 'FY2025: Financing costs — interest on member deposits @ 6% p.a.',
        entryType: 'adjusting',
        fiscalYear: 2025,
        lines: [
            { accountCode: COA.FINANCING_COSTS, debitAmount: 7334.57 },
            { accountCode: COA.SAVINGS_DEPOSITS, creditAmount: 7334.57 },
        ]
    });

    // 5. Operating/Administrative expenses
    await insertJournalEntry({
        date: DEC31_2025,
        description: 'FY2025: Administrative costs',
        entryType: 'adjusting',
        fiscalYear: 2025,
        lines: [
            { accountCode: COA.OTHER_EXPENSES, debitAmount: 7308.00 },
            { accountCode: COA.CASH_ON_HAND, creditAmount: 7308.00 },
        ]
    });

    // 6. Savings Deposits Net receipts
    await insertJournalEntry({
        date: DEC31_2025,
        description: 'FY2025: Savings deposits net member deposits',
        entryType: 'adjusting',
        fiscalYear: 2025,
        lines: [
            { accountCode: COA.CASH_ON_HAND, debitAmount: 23823.78 },
            { accountCode: COA.SAVINGS_DEPOSITS, creditAmount: 23823.78 },
        ]
    });

    // 7. Loan receivable collections
    await insertJournalEntry({
        date: DEC31_2025,
        description: 'FY2025: Loans receivable net collections',
        entryType: 'adjusting',
        fiscalYear: 2025,
        lines: [
            { accountCode: COA.CASH_ON_HAND, debitAmount: 10100.00 },
            { accountCode: COA.LOANS_RECEIVABLE, creditAmount: 10100.00 },
        ]
    });

    // 8. Sundry assets net additions
    await insertJournalEntry({
        date: DEC31_2025,
        description: 'FY2025: Sundry assets net purchases',
        entryType: 'adjusting',
        fiscalYear: 2025,
        lines: [
            { accountCode: COA.SUNDRY_ASSETS, debitAmount: 3987.99 },
            { accountCode: COA.CASH_ON_HAND, creditAmount: 3987.99 },
        ]
    });

    // 9. Education program payment
    await insertJournalEntry({
        date: DEC31_2025,
        description: 'FY2025: Education fund program disbursement',
        entryType: 'adjusting',
        fiscalYear: 2025,
        lines: [
            { accountCode: COA.EDUCATION_FUND, debitAmount: 1366.41 },
            { accountCode: COA.CASH_ON_HAND, creditAmount: 1366.41 },
        ]
    });

    // 10. BDO bank account net deposits
    await insertJournalEntry({
        date: DEC31_2025,
        description: 'FY2025: BDO bank account net deposits',
        entryType: 'adjusting',
        fiscalYear: 2025,
        lines: [
            { accountCode: COA.CASH_IN_BANK, debitAmount: 208.98 },
            { accountCode: COA.CASH_ON_HAND, creditAmount: 208.98 },
        ]
    });

    // 11. Reserve fund rounding adjustment
    await insertJournalEntry({
        date: DEC31_2025,
        description: 'FY2025: Reserve fund rounding adjustments',
        entryType: 'adjusting',
        fiscalYear: 2025,
        lines: [
            { accountCode: COA.RESERVE_FUND, debitAmount: 0.02 },
            { accountCode: COA.CASH_ON_HAND, creditAmount: 0.02 },
        ]
    });

    // 12. Operating Net Loss close
    await insertJournalEntry({
        date: DEC31_2025,
        description: 'FY2025: Closing entry — net operating loss close to Retained Surplus',
        entryType: 'closing',
        fiscalYear: 2025,
        lines: [
            { accountCode: COA.INTEREST_ON_LOANS, debitAmount: 10500.00 },
            { accountCode: COA.SERVICE_FEES, debitAmount: 2300.00 },
            { accountCode: COA.MEMBERSHIP_FEES, debitAmount: 200.00 },
            { accountCode: COA.INTEREST_ON_INVESTMENTS, debitAmount: 78.62 },
            { accountCode: COA.MISCELLANEOUS_INCOME, debitAmount: 50.00 },
            { accountCode: COA.RETAINED_SURPLUS, debitAmount: 1513.95 },
            { accountCode: COA.FINANCING_COSTS, creditAmount: 7334.57 },
            { accountCode: COA.OTHER_EXPENSES, creditAmount: 7308.00 },
        ]
    });

    // 13. Loss absorption
    await insertJournalEntry({
        date: DEC31_2025,
        description: 'FY2025: Reserve fund net loss absorption per RA 9520',
        entryType: 'closing',
        fiscalYear: 2025,
        lines: [
            { accountCode: COA.RESERVE_FUND, debitAmount: 1513.95 },
            { accountCode: COA.RETAINED_SURPLUS, creditAmount: 1513.95 },
        ]
    });

    console.log('✅ Journal entries seeded successfully.');
}

async function seedStatutoryFundAllocations() {
    console.log('🌱 Seeding statutory fund allocations to production...');

    // Delete existing
    await supabase.from('statutory_fund_allocations').delete().in('fiscal_year', [2024, 2025]);

    const allocations = [
        // FY2024 Allocations (Net surplus = 3,727.69)
        { fiscal_year: 2024, fund_type: 'reserve', percentage: 50, amount: 1863.85 },
        { fiscal_year: 2024, fund_type: 'education', percentage: 5, amount: 186.38 },
        { fiscal_year: 2024, fund_type: 'union_federation', percentage: 5, amount: 186.38 },
        { fiscal_year: 2024, fund_type: 'community_dev', percentage: 3, amount: 111.83 },
        { fiscal_year: 2024, fund_type: 'optional', percentage: 7, amount: 260.94 },
        { fiscal_year: 2024, fund_type: 'interest_on_capital', percentage: 15, amount: 559.15 },
        { fiscal_year: 2024, fund_type: 'patronage_refund', percentage: 15, amount: 559.16 },
        // FY2025 Allocations (Net loss = -1,513.95)
        { fiscal_year: 2025, fund_type: 'reserve', percentage: 100, amount: -1513.95 }
    ].map(a => ({
        id: uuidv4(),
        fiscal_year: a.fiscal_year,
        fund_type: a.fund_type,
        percentage: a.percentage,
        amount: a.amount,
        performed_by: PERFORMED_BY,
        created_at: now,
        updated_at: now
    }));

    const { error } = await supabase
        .from('statutory_fund_allocations')
        .insert(allocations);

    if (error) throw new Error(`Failed to seed statutory allocations: ${error.message}`);
    console.log('✅ Statutory fund allocations seeded successfully.');
}

async function main() {
    console.log('===================================================');
    console.log('🚀 SEEDING AUDITED HISTORICAL DATA TO PRODUCTION DB');
    console.log('===================================================');
    try {
        await checkAndSeedCOA();
        await seedPeriodSettings();
        await cleanExistingJournalEntries();
        await seedJournalEntries();
        await seedStatutoryFundAllocations();
        console.log('===================================================');
        console.log('🎉 HISTORICAL MIGRATION TO PRODUCTION SUCCESSFUL!');
        console.log('===================================================');
    } catch (err) {
        console.error('❌ MIGRATION FAILED:', err.message);
        process.exit(1);
    }
}

main();
