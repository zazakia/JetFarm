#!/usr/bin/env node
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1] ?? 'true');
}

const inputPath = args.get('--input');
const apply = args.get('--apply') === 'true';
const asOf = args.get('--as-of') ?? '2024-12-31';
const recordedBy = args.get('--recorded-by') ?? 'historical-import';

if (!inputPath) {
  console.error('Usage: node scripts/import-historical-member-balances.mjs --input balances.json [--as-of 2024-12-31] [--apply true]');
  console.error('JSON rows: [{ "borrowerId": "...", "savings2024": 1000, "cbu2024": 500 }]');
  process.exit(1);
}

const raw = await fs.readFile(inputPath, 'utf8');
const rows = JSON.parse(raw);
if (!Array.isArray(rows)) {
  throw new Error('Input must be a JSON array.');
}

const date = new Date(`${asOf}T23:59:59.000Z`).getTime();
const now = Date.now();

const savingsRows = [];
const cbuRows = [];
for (const row of rows) {
  const borrowerId = row.borrowerId ?? row.memberId;
  if (!borrowerId) throw new Error(`Missing borrowerId/memberId in row: ${JSON.stringify(row)}`);

  const savings = Number(row.savings2024 ?? row.savings ?? 0);
  const cbu = Number(row.cbu2024 ?? row.cbu ?? row.shareCapital2024 ?? 0);

  if (Number.isFinite(savings) && savings !== 0) {
    savingsRows.push({
      id: crypto.randomUUID(),
      borrower_id: borrowerId,
      type: 'deposit',
      amount: Math.round(savings * 100) / 100,
      reference_id: 'historical-2024-opening-balance',
      date,
      notes: 'Historical 2024 opening savings balance imported from Excel',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
  }

  if (Number.isFinite(cbu) && cbu !== 0) {
    cbuRows.push({
      id: crypto.randomUUID(),
      member_id: borrowerId,
      transaction_type: 'DEPOSIT',
      share_type: 'COMMON',
      number_of_shares: null,
      par_value: null,
      amount: Math.round(cbu * 100) / 100,
      running_balance_shares: null,
      running_balance_amount: Math.round(cbu * 100) / 100,
      reference_number: 'historical-2024-opening-balance',
      date,
      notes: 'Historical 2024 opening CBU balance imported from Excel',
      recorded_by: recordedBy,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
  }
}

console.log(JSON.stringify({
  mode: apply ? 'apply' : 'dry-run',
  asOf,
  savingsRows: savingsRows.length,
  cbuRows: cbuRows.length,
  savingsTotal: savingsRows.reduce((sum, row) => sum + row.amount, 0),
  cbuTotal: cbuRows.reduce((sum, row) => sum + row.amount, 0),
}, null, 2));

if (!apply) {
  process.exit(0);
}

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or anon key if RLS allows inserts) before --apply true.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

if (savingsRows.length > 0) {
  const { error } = await supabase.from('app_savings_transactions').upsert(savingsRows, { onConflict: 'id' });
  if (error) throw error;
}

if (cbuRows.length > 0) {
  const { error } = await supabase.from('app_share_capital_transactions').upsert(cbuRows, { onConflict: 'id' });
  if (error) throw error;
}

console.log('Historical balances imported.');
