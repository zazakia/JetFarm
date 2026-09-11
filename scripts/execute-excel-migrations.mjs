/**
 * execute-excel-migrations.mjs
 * Consolidates the CBU, Savings, and Loan migration JSON files, creates unique borrowers, 
 * and pushes the data to Supabase production.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function nowMs() {
    return new Date().toISOString();
}

async function execute() {
    console.log('🚀 Starting Data Push to Supabase...');

    // Load JSON summaries
    const cbuSavingsSummary = JSON.parse(readFileSync(join(__dirname, '../src/assets/cbu_savings_migration_summary.json'), 'utf-8'));
    const loansSummary = JSON.parse(readFileSync(join(__dirname, '../src/assets/unpaid_loans_migration_summary.json'), 'utf-8'));

    const cbuRecords = cbuSavingsSummary.cbuRecords.filter(r => r.name !== 'TOTAL' && r.name !== 'POSCURSOR');
    const savingsRecords = cbuSavingsSummary.savingsRecords.filter(r => r.name !== 'TOTAL');
    const loanRecords = loansSummary.loanRecords;

    // 1. Compile Unique Borrowers
    const borrowerMap = new Map(); // name (lowercase) -> borrower object
    
    function addBorrower(name, accountNo) {
        if (!name) return;
        const key = name.trim().toLowerCase();
        if (!borrowerMap.has(key)) {
            borrowerMap.set(key, {
                id: randomUUID(),
                full_name: name.trim(),
                member_id: accountNo || null,
                created_at: nowMs(),
                updated_at: nowMs(),
                deleted_at: null
            });
        }
    }

    cbuRecords.forEach(r => addBorrower(r.name, r.accountNo));
    savingsRecords.forEach(r => addBorrower(r.name, null));
    loanRecords.forEach(r => addBorrower(r.borrowerName, null));

    const borrowersToInsert = Array.from(borrowerMap.values());
    console.log(`📦 Compiled ${borrowersToInsert.length} unique borrowers.`);

    if (borrowersToInsert.length > 0) {
        const { error: bErr } = await supabase.from('app_borrowers').insert(borrowersToInsert);
        if (bErr) {
            console.error('❌ Error inserting borrowers:', bErr);
            return;
        }
        console.log(`✅ Inserted ${borrowersToInsert.length} borrowers.`);
    }

    // 2. Prepare CBU and Savings Transactions
    const savingsTxToInsert = [];
    cbuRecords.forEach(r => {
        const b = borrowerMap.get(r.name.trim().toLowerCase());
        savingsTxToInsert.push({
            id: randomUUID(),
            borrower_id: b.id,
            type: 'cbu',
            amount: r.cbuAmount,
            date: nowMs(),
            notes: 'Migration 2025 CBU Initial Balance',
            created_at: nowMs(),
            updated_at: nowMs(),
            deleted_at: null
        });
    });

    savingsRecords.forEach(r => {
        const b = borrowerMap.get(r.name.trim().toLowerCase());
        savingsTxToInsert.push({
            id: randomUUID(),
            borrower_id: b.id,
            type: 'savings',
            amount: r.savingsAmount,
            date: nowMs(),
            notes: 'Migration 2025 Savings Initial Balance',
            created_at: nowMs(),
            updated_at: nowMs(),
            deleted_at: null
        });
    });

    if (savingsTxToInsert.length > 0) {
        const { error: sErr } = await supabase.from('app_savings_transactions').insert(savingsTxToInsert);
        if (sErr) {
            console.error('❌ Error inserting savings transactions:', sErr);
            return;
        }
        console.log(`✅ Inserted ${savingsTxToInsert.length} savings/cbu transactions.`);
    }

    // 3. Prepare Unpaid Loans and Payments
    const loansToInsert = [];
    const paymentsToInsert = [];
    const borrowerLoanCounts = new Map();
    
    loanRecords.forEach(r => {
        const b = borrowerMap.get(r.borrowerName.trim().toLowerCase());
        const loanId = randomUUID();
        
        const count = (borrowerLoanCounts.get(b.id) || 0) + 1;
        borrowerLoanCounts.set(b.id, count);
        
        loansToInsert.push({
            id: loanId,
            borrower_id: b.id,
            loan_number: r.dlNo || `DL-${Date.now().toString().slice(-6)}`,
            loan_type: count > 1 ? `legacy_loan_${count}` : 'legacy_loan',
            principal_amount: r.principal || r.balanceToCollect,
            interest_rate: 0,
            interest_type: 'flat',
            term: 1,
            term_unit: 'months',
            frequency: 'monthly',
            total_amount: r.totalAmount || r.balanceToCollect,
            installment_amount: r.balanceToCollect,
            status: 'active',
            interest_amount: r.interest || 0,
            notes: `Migrated from ${r.sourceSheet}, DL No: ${r.dlNo}, Penalty: ${r.penalty}, Payments Made: ${r.paymentMade}`,
            created_at: nowMs(),
            updated_at: nowMs(),
            deleted_at: null
        });

        if (r.paymentMade > 0) {
            paymentsToInsert.push({
                id: randomUUID(),
                loan_id: loanId,
                borrower_id: b.id,
                amount: r.paymentMade,
                payment_date: nowMs(),
                payment_type: 'regular',
                notes: 'Migrated prior payment',
                created_at: nowMs(),
                updated_at: nowMs(),
                deleted_at: null
            });
        }
    });

    if (loansToInsert.length > 0) {
        const { error: lErr } = await supabase.from('app_loans').insert(loansToInsert);
        if (lErr) {
            console.error('❌ Error inserting loans:', lErr);
            return;
        }
        console.log(`✅ Inserted ${loansToInsert.length} unpaid loans.`);
    }

    if (paymentsToInsert.length > 0) {
        const { error: pErr } = await supabase.from('app_payments').insert(paymentsToInsert);
        if (pErr) {
            console.error('❌ Error inserting payments:', pErr);
            return;
        }
        console.log(`✅ Inserted ${paymentsToInsert.length} prior payments.`);
    }

    // 4. Prepare Cash Transactions (Accounting Entries)
    const cashTxToInsert = [];
    
    // CBU/Savings adds to Cash on Hand (Debit)
    const cbuSavingsIn = cbuSavingsSummary.summary.accountingEntries.find(e => e.type === 'DEBIT' && e.account.includes('Cash on Hand')).amount;
    if (cbuSavingsIn > 0) {
        cashTxToInsert.push({
            id: randomUUID(),
            type: 'in',
            amount: cbuSavingsIn,
            transaction_date: nowMs(),
            particulars: 'Total CBU and Savings Migration 2025',
            created_at: nowMs(),
            updated_at: nowMs(),
            deleted_at: null
        });
    }

    // Unpaid loans take away from Cash on Hand (Credit, meaning money already went out to borrowers)
    const loansOut = loansSummary.summary.accountingEntries.find(e => e.type === 'CREDIT' && e.account.includes('Cash on Hand')).amount;
    if (loansOut > 0) {
        cashTxToInsert.push({
            id: randomUUID(),
            type: 'out',
            amount: loansOut,
            transaction_date: nowMs(),
            particulars: 'Total Unpaid Loans Balance Migration 2026',
            created_at: nowMs(),
            updated_at: nowMs(),
            deleted_at: null
        });
    }

    if (cashTxToInsert.length > 0) {
        const { error: cErr } = await supabase.from('app_cash_transactions').insert(cashTxToInsert);
        if (cErr) {
            console.error('❌ Error inserting cash transactions:', cErr);
            return;
        }
        console.log(`✅ Inserted ${cashTxToInsert.length} cash transaction entries (Accounting).`);
    }

    console.log('✨ All migrations successfully pushed to Supabase Production!');
}

execute().catch(console.error);
