import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function migrateCbuToShareCapitalTable() {
  console.log('====================================================');
  console.log('   MIGRATING CBU TO app_share_capital_transactions');
  console.log('====================================================\n');

  // 1. Fetch all CBU records from app_savings_transactions
  const { data: cbuTx, error: errCbu } = await supabase
    .from('app_savings_transactions')
    .select('*')
    .is('deleted_at', null);

  if (errCbu) {
    console.error('Error fetching CBU from app_savings_transactions:', errCbu);
    return;
  }

  const cbuRows = (cbuTx || []).filter(tx => {
    const t = (tx.type || '').toLowerCase();
    return t === 'cbu' || t === 'cbu_opening_balance' || t === 'cbu_deposit';
  });

  console.log(`Found ${cbuRows.length} CBU records in app_savings_transactions.`);

  if (cbuRows.length === 0) {
    console.log('No CBU rows found to migrate.');
    return;
  }

  // Check existing records in app_share_capital_transactions to avoid duplicates
  const { data: existing } = await supabase
    .from('app_share_capital_transactions')
    .select('id, amount')
    .is('deleted_at', null);

  if (existing && existing.length > 0) {
    console.log(`Table app_share_capital_transactions already has ${existing.length} records. Cleaning up before re-migrating...`);
    await supabase.from('app_share_capital_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }

  // 3. Group by borrower_id to compute running balances correctly
  const byBorrower = {};
  for (const row of cbuRows) {
    if (!byBorrower[row.borrower_id]) byBorrower[row.borrower_id] = [];
    byBorrower[row.borrower_id].push(row);
  }

  const recordsToInsert = [];
  const parValue = 100; // PHP 100 per share standard

  for (const [borrowerId, rows] of Object.entries(byBorrower)) {
    rows.sort((a, b) => {
      const da = Number(a.date || a.transaction_date || a.created_at || Date.now());
      const db = Number(b.date || b.transaction_date || b.created_at || Date.now());
      return da - db;
    });

    let runningAmt = 0;
    let runningShares = 0;

    for (const tx of rows) {
      const amt = Number(tx.amount || 0);
      const shares = Math.floor(amt / parValue);
      runningAmt += amt;
      runningShares += shares;

      const timestamp = Number(tx.date || tx.transaction_date || tx.created_at) || Date.now();

      recordsToInsert.push({
        id: crypto.randomUUID(),
        member_id: borrowerId,
        transaction_type: 'DEPOSIT',
        share_type: 'COMMON',
        number_of_shares: shares,
        par_value: parValue,
        amount: amt,
        running_balance_shares: runningShares,
        running_balance_amount: runningAmt,
        reference_number: tx.reference_id || 'CBU-2025-CARRYFORWARD',
        date: timestamp,
        notes: tx.notes || 'Migrated from CBU savings transaction',
        recorded_by: tx.recorded_by || null,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null
      });
    }
  }

  console.log(`Preparing to insert ${recordsToInsert.length} records into app_share_capital_transactions...`);

  const batchSize = 50;
  let insertedCount = 0;
  for (let i = 0; i < recordsToInsert.length; i += batchSize) {
    const batch = recordsToInsert.slice(i, i + batchSize);
    const { error: insErr } = await supabase
      .from('app_share_capital_transactions')
      .insert(batch);

    if (insErr) {
      console.error('Error inserting batch:', insErr);
      return;
    }
    insertedCount += batch.length;
    console.log(`  Inserted ${insertedCount} / ${recordsToInsert.length} records...`);
  }

  console.log('\n✅ Successfully migrated CBU records to app_share_capital_transactions!');

  // 4. Verify table now
  const { data: afterData } = await supabase
    .from('app_share_capital_transactions')
    .select('id, amount')
    .is('deleted_at', null);

  const totalMigrated = (afterData || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  console.log(`Verification: app_share_capital_transactions now has ${(afterData || []).length} rows.`);
  console.log(`Total CBU Amount in app_share_capital_transactions: PHP ${totalMigrated.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
}

migrateCbuToShareCapitalTable().catch(console.error);
