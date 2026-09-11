#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

const DEFAULT_OUTPUT_DIR = path.join('docs', 'reconciliation');

function parseArgs(argv) {
  const args = {
    envFile: '.env.production',
    outputDir: DEFAULT_OUTPUT_DIR,
    apply: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--env-file') args.envFile = argv[++i];
    else if (arg === '--output-dir') args.outputDir = argv[++i];
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/cleanup-nonhuman-production-borrowers.js [--env-file .env.production] [--apply]');
      console.log('Default mode is dry-run. Requires SUPABASE_SERVICE_ROLE_KEY for --apply.');
      process.exit(0);
    }
  }

  return args;
}

function loadEnv(envFile) {
  dotenv.config({ path: envFile, override: true });
  return {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    readKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
}

function assertEnv(env, apply) {
  if (!env.url || !env.readKey) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or Supabase key.');
  }
  if (apply && !env.serviceKey) {
    throw new Error('Refusing to apply cleanup without SUPABASE_SERVICE_ROLE_KEY.');
  }
  if (/127\.0\.0\.1|localhost/i.test(env.url)) {
    throw new Error(`Refusing production cleanup against local URL: ${env.url}`);
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(env.url)) {
    throw new Error(`Refusing cleanup because URL does not look like Supabase production: ${env.url}`);
  }
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

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[._,;:()[\]{}"'`~!@#$%^&*+=<>?/\\|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyBorrower(row) {
  const rawName = String(row.full_name || `${row.first_name || ''} ${row.last_name || ''}`).trim();
  const normalized = normalizeName(rawName);
  const compact = normalized.replace(/\s+/g, '');
  const reasons = [];

  if (!normalized) reasons.push('blank_name');
  if (/^\d+$/.test(compact)) reasons.push('numeric_only_name');
  if (normalized.length <= 1) reasons.push('too_short_name');

  const exactNonPerson = new Set([
    'borrower',
    'borrower name',
    'name',
    'client',
    'member',
    'total',
    'grand total',
    'subtotal',
    'summary',
    'collection sheet',
    'daily collection sheet',
    'weekly collection sheet',
    'loan',
    'loans',
    'payment',
    'payments',
    'collector',
    'area',
    'group',
    'date',
    'balance',
    'cash',
    'test',
    'sample',
    'dummy',
    'unknown',
    'n a',
    'na',
    'none',
  ]);
  if (exactNonPerson.has(normalized)) reasons.push('known_header_or_placeholder');

  const phrasePatterns = [
    /\btotal\b/,
    /\bsubtotal\b/,
    /\bsummary\b/,
    /\bcollection\s*sheet\b/,
    /\bborrower\s*name\b/,
    /\bpayment\s*date\b/,
    /\bcollector\b/,
    /\bencoded\b/,
    /\bprincipal\b/,
    /\bbalance\b/,
    /\binterest\b/,
    /\bsavings\b/,
    /\btest\b/,
    /\bsample\b/,
    /\bdummy\b/,
    /\bunknown\b/,
  ];
  for (const pattern of phrasePatterns) {
    if (pattern.test(normalized)) {
      reasons.push(`pattern:${pattern.source}`);
      break;
    }
  }

  const alphaWords = normalized.split(' ').filter((part) => /^[a-z]+$/.test(part));
  if (alphaWords.length === 0 && normalized) reasons.push('no_alpha_name_words');

  return {
    isNonHuman: reasons.length > 0,
    rawName,
    normalized,
    reasons: [...new Set(reasons)],
  };
}

function groupBy(rows, keyFn) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    const list = grouped.get(key) || [];
    list.push(row);
    grouped.set(key, list);
  }
  return grouped;
}

async function deleteByIds(supabase, table, ids) {
  if (!ids.length) return 0;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const { error } = await supabase.from(table).delete().in('id', batch);
    if (error) throw new Error(`${table} delete failed: ${error.message}`);
    deleted += batch.length;
  }
  return deleted;
}

async function deleteByColumn(supabase, table, column, ids) {
  if (!ids.length) return 0;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const { data, error } = await supabase.from(table).delete().in(column, batch).select('id');
    if (error) throw new Error(`${table} delete failed on ${column}: ${error.message}`);
    deleted += (data || []).length;
  }
  return deleted;
}

function writeReport(result, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = result.generatedAt.replace(/[:.]/g, '-');
  const filePath = path.join(outputDir, `production-nonhuman-borrower-cleanup-${stamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
  return filePath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv(args.envFile);
  assertEnv(env, args.apply);

  const supabase = createClient(env.url, args.apply ? env.serviceKey : env.readKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [borrowers, loans, payments, schedules, savings] = await Promise.all([
    fetchAll(supabase, 'app_borrowers'),
    fetchAll(supabase, 'app_loans'),
    fetchAll(supabase, 'app_payments'),
    fetchAll(supabase, 'app_payment_schedules'),
    fetchAll(supabase, 'app_savings_transactions'),
  ]);

  const activeBorrowers = borrowers.filter((row) => !row.deleted_at);
  const loanByBorrower = groupBy(loans.filter((row) => !row.deleted_at), (row) => row.borrower_id);
  const paymentsByLoan = groupBy(payments.filter((row) => !row.deleted_at), (row) => row.loan_id);
  const schedulesByLoan = groupBy(schedules.filter((row) => !row.deleted_at), (row) => row.loan_id);
  const savingsByBorrower = groupBy(savings.filter((row) => !row.deleted_at), (row) => row.borrower_id);

  const candidates = activeBorrowers
    .map((borrower) => {
      const classification = classifyBorrower(borrower);
      const borrowerLoans = loanByBorrower.get(borrower.id) || [];
      const loanIds = borrowerLoans.map((loan) => loan.id);
      const borrowerPayments = loanIds.flatMap((loanId) => paymentsByLoan.get(loanId) || []);
      const borrowerSchedules = loanIds.flatMap((loanId) => schedulesByLoan.get(loanId) || []);
      const borrowerSavings = savingsByBorrower.get(borrower.id) || [];
      return {
        id: borrower.id,
        full_name: borrower.full_name,
        first_name: borrower.first_name,
        last_name: borrower.last_name,
        group: borrower.group,
        area: borrower.area,
        reasons: classification.reasons,
        loanIds,
        paymentIds: borrowerPayments.map((payment) => payment.id),
        scheduleIds: borrowerSchedules.map((schedule) => schedule.id),
        savingsIds: borrowerSavings.map((saving) => saving.id),
        loanCount: borrowerLoans.length,
        paymentCount: borrowerPayments.length,
        scheduleCount: borrowerSchedules.length,
        savingsCount: borrowerSavings.length,
        isNonHuman: classification.isNonHuman,
      };
    })
    .filter((row) => row.isNonHuman);

  const result = {
    generatedAt: new Date().toISOString(),
    targetUrl: env.url,
    mode: args.apply ? 'apply' : 'dry-run',
    beforeCounts: {
      borrowers: activeBorrowers.length,
      loans: loans.filter((row) => !row.deleted_at).length,
      payments: payments.filter((row) => !row.deleted_at).length,
      schedules: schedules.filter((row) => !row.deleted_at).length,
      savings: savings.filter((row) => !row.deleted_at).length,
    },
    candidates,
    candidateSummary: {
      borrowers: candidates.length,
      loans: candidates.reduce((sum, row) => sum + row.loanCount, 0),
      payments: candidates.reduce((sum, row) => sum + row.paymentCount, 0),
      schedules: candidates.reduce((sum, row) => sum + row.scheduleCount, 0),
      savings: candidates.reduce((sum, row) => sum + row.savingsCount, 0),
    },
    deleted: null,
  };

  if (args.apply && candidates.length) {
    const loanIds = [...new Set(candidates.flatMap((candidate) => candidate.loanIds))];
    const borrowerIds = candidates.map((candidate) => candidate.id);

    result.deleted = {
      paymentSchedules: await deleteByColumn(supabase, 'app_payment_schedules', 'loan_id', loanIds),
      payments: await deleteByColumn(supabase, 'app_payments', 'loan_id', loanIds),
      savings: await deleteByColumn(supabase, 'app_savings_transactions', 'borrower_id', borrowerIds),
      loans: await deleteByIds(supabase, 'app_loans', loanIds),
      borrowers: await deleteByIds(supabase, 'app_borrowers', borrowerIds),
    };
  } else if (args.apply) {
    result.deleted = {
      paymentSchedules: 0,
      payments: 0,
      savings: 0,
      loans: 0,
      borrowers: 0,
    };
  }

  const reportPath = writeReport(result, args.outputDir);
  console.log(JSON.stringify({
    targetUrl: result.targetUrl,
    mode: result.mode,
    beforeCounts: result.beforeCounts,
    candidateSummary: result.candidateSummary,
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      full_name: candidate.full_name,
      reasons: candidate.reasons,
      loans: candidate.loanCount,
      payments: candidate.paymentCount,
      schedules: candidate.scheduleCount,
    })),
    deleted: result.deleted,
    report: reportPath,
  }, null, 2));
}

main().catch((error) => {
  console.error('[cleanup-nonhuman-production-borrowers] Failed:', error);
  process.exit(1);
});
