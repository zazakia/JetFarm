#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const { createPlan } = require('./agap-migration-lib');

const TABLES = [
  'app_collectors',
  'app_borrowers',
  'app_loans',
  'app_payments',
  'app_payment_schedules',
  'app_savings_transactions',
  'collection_groups',
];

function parseArgs(argv) {
  const args = {
    envFile: '.env.production',
    outputDir: path.join('docs', 'reconciliation'),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--env-file') args.envFile = argv[++i];
    else if (arg === '--output-dir') args.outputDir = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/verify-agap-production-migration.js [--env-file .env.production] [--output-dir docs/reconciliation]');
      process.exit(0);
    }
  }
  return args;
}

function loadEnv(envFile) {
  dotenv.config({ path: envFile, override: true });
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const keyType = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'publishable';
  if (!url || !key) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or Supabase key.');
  return { url, key, keyType };
}

async function fetchAll(supabase, table, select = '*') {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (error) throw new Error(`${table} select failed: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function countRows(supabase) {
  const counts = {};
  for (const table of TABLES) {
    const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
    if (error) throw new Error(`${table} count failed: ${error.message}`);
    counts[table] = count || 0;
  }
  return counts;
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
}

function findDuplicates(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, count: list.length, ids: list.map((row) => row.id).slice(0, 10) }));
}

function sumBy(rows, keyFn, amountFn) {
  const totals = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    totals.set(key, (totals.get(key) || 0) + Number(amountFn(row) || 0));
  }
  return totals;
}

function mdTable(rows) {
  if (!rows.length) return '_No rows._\n';
  const headers = Object.keys(rows[0]);
  const fmt = (value) => JSON.stringify(value ?? '').replace(/^"|"$/g, '').replace(/\|/g, '\\|');
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${headers.map((header) => fmt(row[header])).join(' | ')} |`),
  ].join('\n') + '\n';
}

function writeReport(result, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = result.generatedAt.replace(/[:.]/g, '-');
  const jsonPath = path.join(outputDir, `production-migration-verify-${stamp}.json`);
  const mdPath = path.join(outputDir, `production-migration-verify-${stamp}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));

  const issueRows = Object.entries(result.summary.issues).map(([issue, count]) => ({ issue, count }));
  const report = [
    '# Production Migration Verification',
    '',
    `Generated: ${result.generatedAt}`,
    `Target: ${result.targetUrl}`,
    `Key type: ${result.keyType}`,
    '',
    '## Counts',
    '',
    mdTable([result.counts]),
    '',
    '## Issue Summary',
    '',
    mdTable(issueRows),
    '',
    '## Notes',
    '',
    '- This is a read-only verification. No data was changed.',
    '- Duplicate samples are capped in the JSON report.',
    '',
  ].join('\n');
  fs.writeFileSync(mdPath, report);
  return { jsonPath, mdPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv(args.envFile);
  const supabase = createClient(env.url, env.key, { auth: { autoRefreshToken: false, persistSession: false } });

  const [counts, borrowers, loans, payments, schedules] = await Promise.all([
    countRows(supabase),
    fetchAll(supabase, 'app_borrowers'),
    fetchAll(supabase, 'app_loans'),
    fetchAll(supabase, 'app_payments'),
    fetchAll(supabase, 'app_payment_schedules'),
  ]);

  const activeBorrowers = borrowers.filter((row) => !row.deleted_at);
  const activeLoans = loans.filter((row) => !row.deleted_at);
  const activePayments = payments.filter((row) => !row.deleted_at);
  const activeSchedules = schedules.filter((row) => !row.deleted_at);

  const borrowerIds = new Set(activeBorrowers.map((row) => row.id));
  const loanIds = new Set(activeLoans.map((row) => row.id));
  const paidByLoan = sumBy(activePayments, (row) => row.loan_id, (row) => row.amount);

  const multipleActiveByBorrower = findDuplicates(
    activeLoans.filter((loan) => loan.status === 'active'),
    (loan) => loan.borrower_id
  );
  const overpaidLoans = activeLoans
    .filter((loan) => (paidByLoan.get(loan.id) || 0) > Number(loan.total_amount || 0) + 1)
    .map((loan) => ({
      id: loan.id,
      loan_number: loan.loan_number,
      total_amount: Number(loan.total_amount || 0),
      paid: Math.round((paidByLoan.get(loan.id) || 0) * 100) / 100,
    }));

  const result = {
    generatedAt: new Date().toISOString(),
    targetUrl: env.url,
    keyType: env.keyType,
    counts,
    expectedFromExcelPlan: createPlan().summary,
    summary: {
      issues: {
        duplicateMemberIds: findDuplicates(activeBorrowers, (row) => row.member_id).length,
        duplicateBorrowerNames: findDuplicates(activeBorrowers, (row) => normalize(row.full_name)).length,
        duplicateLoanNumbers: findDuplicates(activeLoans, (row) => row.loan_number).length,
        duplicatePayments: findDuplicates(activePayments, (row) => `${row.loan_id}|${row.payment_date}|${row.amount}|${row.payment_type || ''}`).length,
        orphanLoans: activeLoans.filter((loan) => !borrowerIds.has(loan.borrower_id)).length,
        orphanPayments: activePayments.filter((payment) => !loanIds.has(payment.loan_id)).length,
        orphanSchedules: activeSchedules.filter((schedule) => !loanIds.has(schedule.loan_id)).length,
        overpaidLoans: overpaidLoans.length,
        borrowersWithMultipleActiveLoans: multipleActiveByBorrower.length,
      },
    },
    samples: {
      duplicateMemberIds: findDuplicates(activeBorrowers, (row) => row.member_id).slice(0, 25),
      duplicateBorrowerNames: findDuplicates(activeBorrowers, (row) => normalize(row.full_name)).slice(0, 25),
      duplicateLoanNumbers: findDuplicates(activeLoans, (row) => row.loan_number).slice(0, 25),
      duplicatePayments: findDuplicates(activePayments, (row) => `${row.loan_id}|${row.payment_date}|${row.amount}|${row.payment_type || ''}`).slice(0, 25),
      orphanPayments: activePayments
        .filter((payment) => !loanIds.has(payment.loan_id))
        .map((payment) => ({
          id: payment.id,
          loan_id: payment.loan_id,
          amount: payment.amount,
          payment_date: payment.payment_date,
        }))
        .slice(0, 25),
      orphanSchedules: activeSchedules
        .filter((schedule) => !loanIds.has(schedule.loan_id))
        .map((schedule) => ({ id: schedule.id, loan_id: schedule.loan_id }))
        .slice(0, 25),
      multipleActiveByBorrower: multipleActiveByBorrower.slice(0, 25),
      overpaidLoans: overpaidLoans.slice(0, 25),
    },
  };

  const outputs = writeReport(result, args.outputDir);
  console.log(JSON.stringify({
    targetUrl: result.targetUrl,
    keyType: result.keyType,
    counts: result.counts,
    issues: result.summary.issues,
    report: outputs.mdPath,
    json: outputs.jsonPath,
  }, null, 2));
}

main().catch((error) => {
  console.error('[verify-agap-production-migration] Failed:', error);
  process.exit(1);
});
