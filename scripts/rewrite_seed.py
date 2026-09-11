"""
Rewrites scripts/seed-financial-data.mjs with the CORRECT accounting architecture.

ARCHITECTURE:
- Each year has TWO entries:
  1. A Balance Sheet (BS) snapshot entry with ONLY asset/liability/equity accounts
  2. An Income Statement (IS) entry with ONLY revenue/expense accounts

WHY THIS WORKS:
- getGLBalances accumulates all entries through asOf date
- BS accounts (1xxx, 2xxx, 3xxx) accumulate correctly = ending balances
- IS accounts (4xxx, 5xxx) also accumulate, but getPeriodActivity takes (end - start)
  which isolates just the current year's activity
- retainedSurplus = 3060 balance ONLY (no unclosedNetSurplus double-count)
- 3060 is always 0 per spreadsheet (all net income allocated to specific funds/payables)

AUDITED VALUES (from FS POSCURSOR 2025.2.xls and FS POSCURSOR 2026.xls):

2024 Balance Sheet (Year-End):
  Assets: Cash on Hand 39,902.93 | Cash in Bank 53,011.35 | Loans Rec 164,622.70 | Sundry Assets 117,411.91
  Liabilities: Deposits 116,384.50 | ISC Payable 559.15 | PR Payable 559.15 | Union 186.38
  Equity: Share Capital 231,907.27 | Reserve 17,094.77 | Education 1,366.41 | Community Dev 1,647.38 | Optional 5,243.88 | Retained 0

2025 Balance Sheet (Year-End):
  Assets: Cash on Hand 74,083.93 | Cash in Bank 53,220.33 | Loans Rec 154,522.70 | Sundry Assets 121,399.90
  Liabilities: Deposits 147,542.85 | ISC Payable 559.15 | PR Payable 559.15 | Union 186.38
  Equity: Share Capital 231,907.27 | Reserve 15,580.80 | Education 0 | Community Dev 1,647.38 | Optional 5,243.88 | Retained 0

2024 Income Statement:
  Revenue: Interest on Loans 16,260.00 | Service Charges 3,620.00
  Expenses: Salaries/Operating 6,814.31 | Interest on Deposits 9,338.00
  Net Surplus: 3,727.69

2025 Income Statement:
  Revenue: Interest on Loans 10,500.00 | Service Charges 2,300.00 | Membership Fees 200.00 | Interest on Investments 78.62 | Misc 50.00
  Expenses: Salaries/Operating 7,334.57 | Interest on Deposits 7,308.00
  Net Loss: -1,513.95 (covered by Reserve Fund reduction)
"""

# ─── Audited Balance Sheet Values ────────────────────────────────────────────

# 2024 Balance Sheet - FULL ENDING BALANCES
bs_2024 = {
    # Assets (debit normal = positive)
    '1010': 39902.93,       # Cash on Hand
    '1020': 53011.35,       # Cash in Bank
    '1100': 164622.70,      # Loans Receivable
    '1710': 117411.91,      # Sundry Assets (fixed assets etc)
    # Liabilities (credit normal = negative in stored convention)
    '2010': -116384.50,     # Deposit Liabilities (Savings)
    '2050': -559.15,        # Interest on Share Capital Payable
    '2060': -559.15,        # Patronage Refund Payable
    '2070': -186.38,        # Due to Union/Federation
    # Equity (credit normal = negative in stored convention)
    '3010': -231907.27,     # Share Capital
    '3020': -17094.77,      # Reserve Fund
    '3030': -1366.41,       # Education and Training Fund
    '3040': -1647.38,       # Community Development Fund
    '3050': -5243.88,       # Optional Fund
    '3060': 0,              # Retained Surplus (ZERO - all distributed)
}

# Verify 2024 BS balances to zero
assert abs(sum(bs_2024.values())) < 0.01, f"2024 BS not balanced: {sum(bs_2024.values())}"
print(f"2024 BS balance check: {sum(bs_2024.values())} (should be ~0)")

# 2025 Balance Sheet - FULL ENDING BALANCES
bs_2025 = {
    # Assets
    '1010': 74083.93,       # Cash on Hand
    '1020': 53220.33,       # Cash in Bank
    '1100': 154522.70,      # Loans Receivable
    '1710': 121399.90,      # Sundry Assets
    # Liabilities
    '2010': -147542.85,     # Deposit Liabilities
    '2050': -559.15,        # Interest on Share Capital Payable
    '2060': -559.15,        # Patronage Refund Payable
    '2070': -186.38,        # Due to Union/Federation
    # Equity
    '3010': -231907.27,     # Share Capital
    '3020': -15580.80,      # Reserve Fund (reduced by net loss)
    '3030': 0,              # Education Fund (fully disbursed in 2025)
    '3040': -1647.38,       # Community Development Fund
    '3050': -5243.88,       # Optional Fund
    '3060': 0,              # Retained Surplus (ZERO - all distributed)
}

# Verify 2025 BS balances to zero
assert abs(sum(bs_2025.values())) < 0.01, f"2025 BS not balanced: {sum(bs_2025.values())}"
print(f"2025 BS balance check: {sum(bs_2025.values())} (should be ~0)")

# ─── Audited Income Statement Values ─────────────────────────────────────────

# 2024 Income Statement - FULL YEAR ACTIVITY
# Revenues are credit normal (stored negative), Expenses are debit normal (stored positive)
is_2024 = {
    '4010': -16260.00,      # Interest on Loans (Revenue)
    '4020': -3620.00,       # Service Charges (Revenue)
    '5000': 6814.31,        # Operating Expenses (Salaries etc)
    '5110': 9338.00,        # Interest on Deposit Liabilities (Financing Cost)
}
# Net surplus check: revenues - expenses = 16260+3620 - 6814.31 - 9338 = 3727.69
# This must equal what was distributed (allocated to funds, payables)
is_net_2024 = -sum(v for k,v in is_2024.items() if k.startswith('4')) - sum(v for k,v in is_2024.items() if k.startswith('5'))
print(f"2024 IS Net Surplus: {is_net_2024:.2f} (should be 3727.69)")

# For the IS entry to balance, we need a suspense/clearing debit
# (representing the appropriation of surplus to funds)
# Net surplus 3727.69 must be balanced by a debit to offset the credits
# We'll use 3060 as the clearing account: Dr 3060 (debit) by net surplus
is_2024['3060'] = is_net_2024  # Debit to retained surplus clearing (net surplus appropriated)

# Verify IS entry balances (sum = 0)
assert abs(sum(is_2024.values())) < 0.01, f"2024 IS not balanced: {sum(is_2024.values())}"
print(f"2024 IS balance check: {sum(is_2024.values())} (should be ~0)")

# 2025 Income Statement - FULL YEAR ACTIVITY
is_2025 = {
    '4010': -10500.00,      # Interest on Loans
    '4020': -2300.00,       # Service Charges
    '4030': -200.00,        # Membership Fees
    '4050': -78.62,         # Interest on Investments
    '4060': -50.00,         # Miscellaneous Income
    '5000': 7334.57,        # Operating Expenses
    '5110': 7308.00,        # Interest on Deposit Liabilities
}
is_net_2025 = -sum(v for k,v in is_2025.items() if k.startswith('4')) - sum(v for k,v in is_2025.items() if k.startswith('5'))
print(f"2025 IS Net Surplus: {is_net_2025:.2f} (should be -1513.95, a net loss)")

# For 2025, there is a net LOSS of 1513.95 which was covered by reserve fund reduction
# The IS clearing: Dr/Cr 3060 by net (debit if surplus, credit if loss)
is_2025['3060'] = is_net_2025  # Debit retained surplus by net (negative = credit for net loss)

# Verify IS entry balances
assert abs(sum(is_2025.values())) < 0.01, f"2025 IS not balanced: {sum(is_2025.values())}"
print(f"2025 IS balance check: {sum(is_2025.values())} (should be ~0)")

# ─── Compute net CHANGES for 2025 BS entry ───────────────────────────────────
# Since getGLBalances is cumulative, the 2025 BS entry should be the NET CHANGE
# from 2024 ending to 2025 ending for balance sheet accounts
bs_changes_2025 = {}
all_bs_codes = set(list(bs_2024.keys()) + list(bs_2025.keys()))
for code in all_bs_codes:
    change = bs_2025.get(code, 0) - bs_2024.get(code, 0)
    if abs(change) > 0.001:
        bs_changes_2025[code] = change

print(f"\n2025 BS changes (deltas from 2024):")
for code, val in sorted(bs_changes_2025.items()):
    print(f"  {code}: {val:+.2f}")

# Verify BS changes also balance to zero
assert abs(sum(bs_changes_2025.values())) < 0.01, f"2025 BS changes not balanced: {sum(bs_changes_2025.values())}"
print(f"2025 BS changes balance check: {sum(bs_changes_2025.values()):.4f} (should be ~0)")

# ─── Generate the seed script ─────────────────────────────────────────────────

def make_lines(entries, description):
    """Convert a dict of {code: amount} to journal entry lines.
    Positive amounts = Debit, Negative amounts = Credit (per our convention).
    """
    lines = []
    for code, amount in sorted(entries.items()):
        if abs(amount) < 0.001:
            continue
        if amount > 0:
            lines.append(f"{{ code: '{code}', debit: {round(amount, 2)}, credit: 0, description: '{description}' }}")
        else:
            lines.append(f"{{ code: '{code}', debit: 0, credit: {round(-amount, 2)}, description: '{description}' }}")
    return lines

lines_bs_2024 = make_lines(bs_2024, '2024 Audited Balance Sheet')
lines_is_2024 = make_lines(is_2024, '2024 Income Statement Activity')
lines_bs_2025 = make_lines(bs_changes_2025, '2025 Audited Balance Sheet Changes')
lines_is_2025 = make_lines(is_2025, '2025 Income Statement Activity')

def fmt_entry(date, description, entry_type, fiscal_year, lines):
    joined = ',\n            '.join(lines)
    return f'''
    await insertJournalEntry({{
        date: '{date}',
        description: '{description}',
        entryType: '{entry_type}',
        fiscalYear: {fiscal_year},
        lines: [
            {joined}
        ]
    }});
'''

script = '''// Generated seed script - Properly separated BS and IS entries
// Architecture: BS entries capture year-end balance sheet positions
//               IS entries capture annual income statement activity
// This eliminates the double-counting bug in retainedSurplus calculation
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase keys in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

const PERFORMED_BY = 'seed-migration';

async function insertJournalEntry({ date, description, entryType, lines, fiscalYear }) {
    const entryId = randomUUID();
    const refNumber = `JE-${fiscalYear}-HIST-${Math.floor(Math.random() * 999999).toString().padStart(6, '0')}`;
    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.05) throw new Error(`Unbalanced: DR ${totalDebit} != CR ${totalCredit}`);
    await supabase.from('journal_entries').insert({
        id: entryId, reference_number: refNumber, entry_date: new Date(date).toISOString(), description, entry_type: entryType,
        is_posted: true, fiscal_year: fiscalYear, fiscal_month: new Date(date).getMonth() + 1, total_debit: totalDebit, total_credit: totalCredit,
        posted_by: PERFORMED_BY
    });
    await supabase.from('journal_entry_lines').insert(lines.map(l => ({
        id: randomUUID(), journal_entry_id: entryId, account_code: l.code, account_name: l.code,
        debit_amount: l.debit || 0, credit_amount: l.credit || 0, description: l.description || description
    })));
}

async function run() {
    console.log('Cleaning up old DB...');
    await supabase.from('journal_entry_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('journal_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('statutory_fund_allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('Seeding historical financial data...');
'''

script += fmt_entry('2024-01-01T00:00:01.000Z', '2024 Audited Balance Sheet - Year End Position', 'adjusting', 2024, lines_bs_2024)
script += fmt_entry('2024-12-31T12:00:00.000Z', '2024 Income Statement - Annual Activity', 'adjusting', 2024, lines_is_2024)
script += fmt_entry('2025-01-01T00:00:01.000Z', '2025 Audited Balance Sheet - Changes from 2024', 'adjusting', 2025, lines_bs_2025)
script += fmt_entry('2025-12-31T12:00:00.000Z', '2025 Income Statement - Annual Activity', 'adjusting', 2025, lines_is_2025)

script += '''
    // Statutory Fund Allocations for 2024 (from net surplus 3,727.69)
    // ISC + PR + Union distributed as payables (already in BS accounts 2050, 2060, 2070)
    // Reserve, Education, Community Dev, Optional added to fund balances
    const statutoryFunds2024 = [
        { fund_type: 'reserve', percentage: 10, amount: 372.77 },
        { fund_type: 'education', percentage: 10, amount: 372.77 },
        { fund_type: 'community_dev', percentage: 3, amount: 111.83 },
        { fund_type: 'optional', percentage: 7, amount: 260.94 },
        { fund_type: 'interest_on_capital', percentage: 15, amount: 559.15 },
        { fund_type: 'patronage_refund', percentage: 15, amount: 559.15 },
        { fund_type: 'due_to_union', percentage: 5, amount: 186.38 },
    ];
    for (const alloc of statutoryFunds2024) {
        await supabase.from('statutory_fund_allocations').insert({
            id: randomUUID(), fiscal_year: 2024, fund_type: alloc.fund_type, percentage: alloc.percentage, amount: alloc.amount
        });
    }

    // Statutory Fund Allocations for 2025 (net LOSS of -1,513.95 covered by Reserve Fund)
    const statutoryFunds2025 = [
        { fund_type: 'reserve', percentage: 100, amount: -1513.95 },
    ];
    for (const alloc of statutoryFunds2025) {
        await supabase.from('statutory_fund_allocations').insert({
            id: randomUUID(), fiscal_year: 2025, fund_type: alloc.fund_type, percentage: alloc.percentage, amount: alloc.amount
        });
    }

    console.log('Migration complete! Seeded 4 journal entries + statutory allocations.');
}

run().catch(e => { console.error(e); process.exit(1); });
'''

with open('scripts/seed-financial-data.mjs', 'w', encoding='utf-8') as f:
    f.write(script)

print("\nDONE: Seed script written to scripts/seed-financial-data.mjs")
print("\nVERIFICATION:")
print("2025 expected Total Assets:", 403226.86)
print("2025 expected Total L+E:", 148847.53 + 231907.27 + 15580.80 + 0 + 1647.38 + 5243.88 + 0)
print("2024 expected Total Assets:", 374948.89)
print("2024 expected Total L+E:", 116384.50 + 559.15 + 559.15 + 186.38 + 231907.27 + 17094.77 + 1366.41 + 1647.38 + 5243.88 + 0)
