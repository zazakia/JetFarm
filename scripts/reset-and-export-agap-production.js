#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

const { createPlan } = require('./agap-migration-lib');
const { applyMigration } = require('./migrate-agap-excel');

const DATA_TABLES = [
  'app_action_logs',
  'app_collection_logs',
  'app_remittances',
  'app_savings_transactions',
  'app_loan_penalties',
  'app_payment_schedules',
  'app_payments',
  'app_loans',
  'app_borrowers',
  'collection_groups',
  'app_collectors',
];

const RESTORE_TABLES = [
  'app_collectors',
  'collection_groups',
  'app_borrowers',
  'app_loans',
  'app_payment_schedules',
  'app_payments',
  'app_loan_penalties',
  'app_savings_transactions',
  'app_collection_logs',
  'app_remittances',
  'app_action_logs',
];

function parseArgs(argv) {
  const args = {
    envFile: '.env.production',
    backupDir: null,
    requireProductionUrl: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--env-file') args.envFile = argv[++i];
    else if (arg === '--backup-dir') args.backupDir = argv[++i];
    else if (arg === '--allow-non-production-url') args.requireProductionUrl = false;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/reset-and-export-agap-production.js --env-file .env.production [--backup-dir backups/<dir>]');
      console.log('Requires EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the selected env file or process environment.');
      process.exit(0);
    }
  }
  return args;
}

function loadEnv(envFile) {
  dotenv.config({ path: envFile, override: true });
  return {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function assertProductionEnv(env, requireProductionUrl) {
  const missing = [];
  if (!env.url) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!env.key) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length) {
    throw new Error(`Missing ${missing.join(', ')}. Refusing to clear/export data.`);
  }
  if (requireProductionUrl && /127\.0\.0\.1|localhost/i.test(env.url)) {
    throw new Error(`Refusing to run against non-production URL: ${env.url}`);
  }
  if (requireProductionUrl && !/https:\/\/[a-z0-9-]+\.supabase\.co/i.test(env.url)) {
    throw new Error(`Refusing to run: URL does not look like a Supabase production URL: ${env.url}`);
  }
}

async function fetchAllRows(supabase, table) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from(table).select('*').range(from, to);
    if (error) throw new Error(`Backup select failed for ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function backupTables(supabase, backupDir) {
  fs.mkdirSync(backupDir, { recursive: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    tables: {},
  };

  for (const table of DATA_TABLES) {
    const rows = await fetchAllRows(supabase, table);
    const filePath = path.join(backupDir, `${table}.json`);
    fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
    manifest.tables[table] = { rows: rows.length, file: filePath, columns: Object.keys(rows[0] || {}) };
    console.log(`Backed up ${table}: ${rows.length}`);
  }

  fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

async function countRows(supabase) {
  const counts = {};
  for (const table of DATA_TABLES) {
    const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
    if (error) throw new Error(`Count failed for ${table}: ${error.message}`);
    counts[table] = count || 0;
  }
  return counts;
}

async function clearTables(supabase) {
  for (const table of DATA_TABLES) {
    const { error } = await supabase.from(table).delete().not('id', 'is', null);
    if (error) throw new Error(`Delete failed for ${table}: ${error.message}`);
    console.log(`Cleared ${table}`);
  }
}

function sanitizeRowsForColumns(rows, columns) {
  if (!columns || columns.size === 0) return rows;
  return rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => columns.has(key))));
}

async function insertRows(supabase, table, rows) {
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + 100));
    if (error) throw new Error(`Restore insert failed for ${table}: ${error.message}`);
  }
}

async function restoreBackupTables(supabase, backupDir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'manifest.json'), 'utf8'));
  for (const table of RESTORE_TABLES) {
    const meta = manifest.tables[table];
    if (!meta || !fs.existsSync(meta.file)) continue;
    const rows = JSON.parse(fs.readFileSync(meta.file, 'utf8'));
    if (!rows.length) continue;
    const columns = new Set(meta.columns || []);
    await insertRows(supabase, table, sanitizeRowsForColumns(rows, columns));
    console.log(`Restored ${table}: ${rows.length}`);
  }
}

async function verifyPlanAgainstDb(supabase, plan) {
  const counts = {
    borrowers: await supabase.from('app_borrowers').select('id', { count: 'exact', head: true }),
    loans: await supabase.from('app_loans').select('id', { count: 'exact', head: true }),
    payments: await supabase.from('app_payments').select('id', { count: 'exact', head: true }),
  };
  for (const [name, result] of Object.entries(counts)) {
    if (result.error) throw new Error(`Post-migration count failed for ${name}: ${result.error.message}`);
  }

  const { data: loans, error: loansError } = await supabase
    .from('app_loans')
    .select('id,total_amount,status,borrower_id');
  if (loansError) throw loansError;
  const { data: payments, error: paymentsError } = await supabase
    .from('app_payments')
    .select('loan_id,amount');
  if (paymentsError) throw paymentsError;

  const paidByLoan = new Map();
  for (const payment of payments || []) {
    paidByLoan.set(payment.loan_id, (paidByLoan.get(payment.loan_id) || 0) + Number(payment.amount || 0));
  }
  const overpaidLoans = (loans || []).filter((loan) => (paidByLoan.get(loan.id) || 0) > Number(loan.total_amount || 0) + 1);

  const activeByBorrower = new Map();
  for (const loan of (loans || []).filter((loan) => loan.status === 'active')) {
    const list = activeByBorrower.get(loan.borrower_id) || [];
    list.push(loan.id);
    activeByBorrower.set(loan.borrower_id, list);
  }
  const borrowersWithMultipleActive = [...activeByBorrower.values()].filter((ids) => ids.length > 1).length;

  return {
    expected: {
      borrowers: plan.summary.borrowers,
      loans: plan.summary.loans,
      payments: plan.summary.payments,
    },
    actual: {
      borrowers: counts.borrowers.count || 0,
      loans: counts.loans.count || 0,
      payments: counts.payments.count || 0,
    },
    overpaidLoans: overpaidLoans.length,
    borrowersWithMultipleActive,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv(args.envFile);
  assertProductionEnv(env, args.requireProductionUrl);

  const supabase = createClient(env.url, env.key, { auth: { autoRefreshToken: false, persistSession: false } });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = args.backupDir || path.join('backups', `production-before-agap-reset-${stamp}`);

  console.log(`Target: ${env.url}`);
  const plan = createPlan();
  console.log(`Plan: borrowers=${plan.summary.borrowers}, loans=${plan.summary.loans}, payments=${plan.summary.payments}, rollovers=${plan.summary.rollovers}, reviewItems=${plan.summary.issueCount}`);

  const beforeCounts = await countRows(supabase);
  console.log('Before counts:', JSON.stringify(beforeCounts));

  await backupTables(supabase, backupDir);
  const backupManifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'manifest.json'), 'utf8'));
  const targetColumns = Object.fromEntries(
    Object.entries(backupManifest.tables).map(([table, meta]) => [table, new Set(meta.columns || [])])
  );
  let afterClearCounts = {};
  try {
    await clearTables(supabase);

    afterClearCounts = await countRows(supabase);
    console.log('After clear counts:', JSON.stringify(afterClearCounts));

    await applyMigration(plan, env, { targetColumns });
  } catch (error) {
    console.error('Migration failed after backup. Attempting production restore from backup...');
    try {
      await clearTables(supabase);
      await restoreBackupTables(supabase, backupDir);
      console.error('Production data restored from backup after failed migration.');
    } catch (restoreError) {
      console.error('Rollback restore failed:', restoreError);
    }
    throw error;
  }

  const verification = await verifyPlanAgainstDb(supabase, plan);
  const report = {
    generatedAt: new Date().toISOString(),
    targetUrl: env.url,
    backupDir,
    beforeCounts,
    afterClearCounts,
    verification,
    planSummary: plan.summary,
  };
  const reportPath = path.join('docs', 'reconciliation', `production-reset-export-${stamp}.json`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`Verification: ${JSON.stringify(verification)}`);
  console.log(`Backup: ${backupDir}`);
  console.log(`Report: ${reportPath}`);
}

main().catch((error) => {
  console.error('[reset-and-export-agap-production] Failed:', error);
  process.exit(1);
});
