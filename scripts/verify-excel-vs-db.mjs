/**
 * verify-excel-vs-db.mjs
 * Compares Excel-extracted migration data against actual production Supabase data.
 * Checks: app_savings_transactions (CBU + Savings), app_loans (unpaid balances), borrowers
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
    console.error('❌ Missing Supabase key. Set SUPABASE_SERVICE_ROLE_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Load Excel-extracted migration summaries
const cbuSavingsSummary = JSON.parse(readFileSync(join(__dirname, '../src/assets/cbu_savings_migration_summary.json'), 'utf-8'));
const loansSummary = JSON.parse(readFileSync(join(__dirname, '../src/assets/unpaid_loans_migration_summary.json'), 'utf-8'));

const fmt = (n) => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (a, b) => b > 0 ? ((Math.abs(a - b) / b) * 100).toFixed(2) + '%' : 'N/A';

function sectionHeader(title) {
    console.log('\n' + '═'.repeat(60));
    console.log(`  ${title}`);
    console.log('═'.repeat(60));
}

function ok(msg) { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }

async function verifySavingsTransactions() {
    sectionHeader('1. SAVINGS TRANSACTIONS (CBU + Savings)');

    // Excel totals
    const excelCbuTotal = cbuSavingsSummary.summary.totalCbuAmount;
    const excelSavingsTotal = cbuSavingsSummary.summary.totalSavingsAmount;
    const excelCbuCount = cbuSavingsSummary.summary.totalCbuMembers;
    const excelSavingsCount = cbuSavingsSummary.summary.totalSavingsMembers;

    console.log('\n  📊 Excel Source Data:');
    info(`CBU: ${excelCbuCount} records = ${fmt(excelCbuTotal)}`);
    info(`Savings: ${excelSavingsCount} records = ${fmt(excelSavingsTotal)}`);
    info(`Total COH Debit: ${fmt(excelCbuTotal + excelSavingsTotal)}`);

    // Query production DB — try app_savings_transactions first
    const tables = ['app_savings_transactions', 'savings_transactions'];
    let dbSavings = null;

    for (const table of tables) {
        const { data, error } = await supabase
            .from(table)
            .select('type, amount, notes, deleted_at')
            .is('deleted_at', null);

        if (!error && data) {
            dbSavings = { table, data };
            break;
        }
    }

    if (!dbSavings) {
        fail('Could not query savings_transactions / app_savings_transactions — table may not exist or access denied');
        return;
    }

    console.log(`\n  📡 Production DB (${dbSavings.table}):`);

    const cbuRows = dbSavings.data.filter(r => r.type === 'cbu' || r.notes?.toLowerCase().includes('cbu') || r.type === 'deposit' && r.notes?.toLowerCase().includes('cbu'));
    const savingsRows = dbSavings.data.filter(r => r.type === 'savings' || r.notes?.toLowerCase().includes('savings'));
    const allRows = dbSavings.data;

    const dbCbuTotal = cbuRows.reduce((s, r) => s + Number(r.amount), 0);
    const dbSavingsTotal = savingsRows.reduce((s, r) => s + Number(r.amount), 0);
    const dbAllTotal = allRows.reduce((s, r) => s + Number(r.amount), 0);

    info(`Total rows in DB: ${allRows.length}`);
    info(`CBU-type rows: ${cbuRows.length} = ${fmt(dbCbuTotal)}`);
    info(`Savings-type rows: ${savingsRows.length} = ${fmt(dbSavingsTotal)}`);
    info(`All savings DB total: ${fmt(dbAllTotal)}`);

    if (allRows.length === 0) {
        warn('No savings transaction records found in production DB — migration may not have run yet');
    } else {
        if (Math.abs(dbAllTotal - (excelCbuTotal + excelSavingsTotal)) < 1) {
            ok(`Total matches Excel: DB ${fmt(dbAllTotal)} ≈ Excel ${fmt(excelCbuTotal + excelSavingsTotal)}`);
        } else {
            const diff = dbAllTotal - (excelCbuTotal + excelSavingsTotal);
            warn(`Totals differ: DB ${fmt(dbAllTotal)} vs Excel ${fmt(excelCbuTotal + excelSavingsTotal)} (diff: ${fmt(diff)}, ${pct(dbAllTotal, excelCbuTotal + excelSavingsTotal)})`);
        }
    }

    return allRows.length;
}

async function verifyLoans() {
    sectionHeader('2. UNPAID LOAN BALANCES');

    const excelCount = loansSummary.summary.totalUnpaidLoans;
    const excelPrincipal = loansSummary.summary.totalPrincipalAmount;
    const excelBalance = loansSummary.summary.totalBalanceToCollect;

    console.log('\n  📊 Excel Source Data (onDLLoaner2026):');
    info(`Unpaid loans: ${excelCount}`);
    info(`Total Principal: ${fmt(excelPrincipal)}`);
    info(`Total Balance to Collect: ${fmt(excelBalance)}`);

    // Query production — try app_loans first
    const loanTables = ['app_loans', 'loans'];
    let dbLoans = null;

    for (const table of loanTables) {
        const { data, error } = await supabase
            .from(table)
            .select('id, status, principal_amount, amount, outstanding_balance, deleted_at')
            .is('deleted_at', null)
            .limit(500);

        if (!error && data !== null) {
            dbLoans = { table, data };
            break;
        }
    }

    if (!dbLoans) {
        fail('Could not query loans / app_loans — table may not exist or access denied');
        return;
    }

    console.log(`\n  📡 Production DB (${dbLoans.table}):`);
    info(`Total loan records (non-deleted): ${dbLoans.data.length}`);

    // Active/unpaid loans
    const unpaidStatuses = ['active', 'unpaid', 'ongoing', 'delinquent', 'overdue'];
    const unpaidLoans = dbLoans.data.filter(r =>
        !r.status || unpaidStatuses.includes(r.status?.toLowerCase())
    );

    const dbTotal = dbLoans.data.reduce((s, r) => s + Number(r.outstanding_balance || r.principal_amount || r.amount || 0), 0);
    const unpaidTotal = unpaidLoans.reduce((s, r) => s + Number(r.outstanding_balance || r.principal_amount || r.amount || 0), 0);

    info(`Active/unpaid loans: ${unpaidLoans.length}`);
    info(`Total outstanding (all): ${fmt(dbTotal)}`);
    info(`Total outstanding (unpaid): ${fmt(unpaidTotal)}`);

    if (dbLoans.data.length === 0) {
        warn('No loan records found in production DB — migration may not have run yet');
    } else {
        if (dbLoans.data.length === excelCount) {
            ok(`Count matches Excel: ${dbLoans.data.length} = ${excelCount} loans`);
        } else {
            warn(`Count differs: DB has ${dbLoans.data.length} loans, Excel has ${excelCount} unpaid loans`);
        }
    }

    return dbLoans.data.length;
}

async function verifyBorrowers() {
    sectionHeader('3. BORROWERS / MEMBERS');

    const { data, error } = await supabase
        .from('app_borrowers')
        .select('id, full_name, member_id, deleted_at')
        .is('deleted_at', null)
        .limit(500);

    if (error) {
        fail(`Could not query borrowers: ${error.message}`);
        return;
    }

    console.log('\n  📡 Production DB (borrowers):');
    info(`Total borrowers (non-deleted): ${data.length}`);

    const withMemberId = data.filter(b => b.member_id);
    info(`With member_id: ${withMemberId.length}`);

    // Cross-check CBU names against borrowers
    const cbuNames = cbuSavingsSummary.cbuRecords
        .filter(r => r.name !== 'TOTAL' && r.name !== 'POSCURSOR')
        .map(r => r.name.toLowerCase().trim());

    let matchedCount = 0;
    let unmatchedNames = [];

    for (const cbuName of cbuNames) {
        const firstName = cbuName.split(' ')[0];
        const matched = data.some(b =>
            b.full_name?.toLowerCase().includes(firstName) ||
            cbuName.includes(b.full_name?.toLowerCase().split(' ')[0] || '')
        );
        if (matched) matchedCount++;
        else unmatchedNames.push(cbuName);
    }

    info(`CBU members matched in borrowers table: ${matchedCount}/${cbuNames.length}`);

    if (unmatchedNames.length > 0 && unmatchedNames.length <= 15) {
        warn(`Unmatched CBU names (may need borrower records created):`);
        unmatchedNames.forEach(n => console.log(`     - ${n}`));
    } else if (unmatchedNames.length > 15) {
        warn(`${unmatchedNames.length} CBU names not matched in borrowers — migration borrower records may still be needed`);
    }

    return data.length;
}

async function verifyCashTransactions() {
    sectionHeader('4. CASH ON HAND TRANSACTIONS');

    const { data, error } = await supabase
        .from('app_cash_transactions')
        .select('type, amount, particulars, deleted_at')
        .is('deleted_at', null)
        .limit(500);

    if (error) {
        fail(`Could not query cash_transactions: ${error.message}`);
        return;
    }

    const inTx = data.filter(r => r.type === 'in');
    const outTx = data.filter(r => r.type === 'out');
    const totalIn = inTx.reduce((s, r) => s + Number(r.amount), 0);
    const totalOut = outTx.reduce((s, r) => s + Number(r.amount), 0);

    console.log('\n  📡 Production DB (cash_transactions):');
    info(`Total transactions: ${data.length}`);
    info(`IN (${inTx.length} entries): ${fmt(totalIn)}`);
    info(`OUT (${outTx.length} entries): ${fmt(totalOut)}`);
    info(`Net COH balance: ${fmt(totalIn - totalOut)}`);

    // Expected: COH debit from CBU+Savings migration = credit from loans migration
    const expectedCohIn = cbuSavingsSummary.summary.accountingEntries.find(e => e.account.includes('Cash on Hand'))?.amount || 0;
    const expectedCohOut = loansSummary.summary.accountingEntries.find(e => e.account.includes('Cash on Hand'))?.amount || 0;

    console.log('\n  📊 Expected from Excel Migrations:');
    info(`Expected COH DEBIT (from CBU+Savings): ${fmt(expectedCohIn)}`);
    info(`Expected COH CREDIT (from Loans): ${fmt(expectedCohOut)}`);
    info(`Expected Net: ${fmt(expectedCohIn - expectedCohOut)}`);

    if (data.length === 0) {
        warn('No cash transactions in production DB — migrations not yet applied');
    } else {
        const netDiff = Math.abs((totalIn - totalOut) - (expectedCohIn - expectedCohOut));
        if (netDiff < 1) {
            ok(`Net COH balance matches expected: ${fmt(totalIn - totalOut)}`);
        } else {
            warn(`Net COH differs: DB ${fmt(totalIn - totalOut)} vs Expected ${fmt(expectedCohIn - expectedCohOut)}`);
        }
    }
}

async function main() {
    console.log('\n🔍 POSCURSOR COOP — Excel vs Production DB Verification');
    console.log(`   DB: ${SUPABASE_URL}`);
    console.log(`   Time: ${new Date().toLocaleString('en-PH')}`);

    await verifySavingsTransactions();
    await verifyLoans();
    await verifyBorrowers();
    await verifyCashTransactions();

    sectionHeader('VERIFICATION COMPLETE');
    console.log('  Review results above. Items marked ❌ or ⚠️  need action.\n');
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
