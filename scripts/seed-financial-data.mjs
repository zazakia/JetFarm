// Generated seed script - Properly separated BS and IS entries
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

    await insertJournalEntry({
        date: '2024-01-01T00:00:01.000Z',
        description: '2024 Audited Balance Sheet - Year End Position',
        entryType: 'adjusting',
        fiscalYear: 2024,
        lines: [
            { code: '1010', debit: 39902.93, credit: 0, description: '2024 Audited Balance Sheet' },
            { code: '1020', debit: 53011.35, credit: 0, description: '2024 Audited Balance Sheet' },
            { code: '1100', debit: 164622.7, credit: 0, description: '2024 Audited Balance Sheet' },
            { code: '1710', debit: 117411.91, credit: 0, description: '2024 Audited Balance Sheet' },
            { code: '2010', debit: 0, credit: 116384.5, description: '2024 Audited Balance Sheet' },
            { code: '2050', debit: 0, credit: 559.15, description: '2024 Audited Balance Sheet' },
            { code: '2060', debit: 0, credit: 559.15, description: '2024 Audited Balance Sheet' },
            { code: '2070', debit: 0, credit: 186.38, description: '2024 Audited Balance Sheet' },
            { code: '3010', debit: 0, credit: 231907.27, description: '2024 Audited Balance Sheet' },
            { code: '3020', debit: 0, credit: 17094.77, description: '2024 Audited Balance Sheet' },
            { code: '3030', debit: 0, credit: 1366.41, description: '2024 Audited Balance Sheet' },
            { code: '3040', debit: 0, credit: 1647.38, description: '2024 Audited Balance Sheet' },
            { code: '3050', debit: 0, credit: 5243.88, description: '2024 Audited Balance Sheet' }
        ]
    });

    await insertJournalEntry({
        date: '2024-12-31T12:00:00.000Z',
        description: '2024 Income Statement - Annual Activity',
        entryType: 'adjusting',
        fiscalYear: 2024,
        lines: [
            { code: '3060', debit: 3727.69, credit: 0, description: '2024 Income Statement Activity' },
            { code: '4010', debit: 0, credit: 16260.0, description: '2024 Income Statement Activity' },
            { code: '4020', debit: 0, credit: 3620.0, description: '2024 Income Statement Activity' },
            { code: '5000', debit: 6814.31, credit: 0, description: '2024 Income Statement Activity' },
            { code: '5110', debit: 9338.0, credit: 0, description: '2024 Income Statement Activity' }
        ]
    });

    await insertJournalEntry({
        date: '2025-01-01T00:00:01.000Z',
        description: '2025 Audited Balance Sheet - Changes from 2024',
        entryType: 'adjusting',
        fiscalYear: 2025,
        lines: [
            { code: '1010', debit: 34181.0, credit: 0, description: '2025 Audited Balance Sheet Changes' },
            { code: '1020', debit: 208.98, credit: 0, description: '2025 Audited Balance Sheet Changes' },
            { code: '1100', debit: 0, credit: 10100.0, description: '2025 Audited Balance Sheet Changes' },
            { code: '1710', debit: 3987.99, credit: 0, description: '2025 Audited Balance Sheet Changes' },
            { code: '2010', debit: 0, credit: 31158.35, description: '2025 Audited Balance Sheet Changes' },
            { code: '3020', debit: 1513.97, credit: 0, description: '2025 Audited Balance Sheet Changes' },
            { code: '3030', debit: 1366.41, credit: 0, description: '2025 Audited Balance Sheet Changes' }
        ]
    });

    await insertJournalEntry({
        date: '2025-12-31T12:00:00.000Z',
        description: '2025 Income Statement - Annual Activity',
        entryType: 'adjusting',
        fiscalYear: 2025,
        lines: [
            { code: '3060', debit: 0, credit: 1513.95, description: '2025 Income Statement Activity' },
            { code: '4010', debit: 0, credit: 10500.0, description: '2025 Income Statement Activity' },
            { code: '4020', debit: 0, credit: 2300.0, description: '2025 Income Statement Activity' },
            { code: '4030', debit: 0, credit: 200.0, description: '2025 Income Statement Activity' },
            { code: '4050', debit: 0, credit: 78.62, description: '2025 Income Statement Activity' },
            { code: '4060', debit: 0, credit: 50.0, description: '2025 Income Statement Activity' },
            { code: '5000', debit: 7334.57, credit: 0, description: '2025 Income Statement Activity' },
            { code: '5110', debit: 7308.0, credit: 0, description: '2025 Income Statement Activity' }
        ]
    });

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
