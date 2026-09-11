#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const dotenv = require('dotenv');

const { DEFAULT_SUMMARY_PATH, chooseCollectionPath, createPlan } = require('./agap-migration-lib');

function parseArgs(argv) {
  const args = {
    apply: false,
    summaryPath: DEFAULT_SUMMARY_PATH,
    collectionPath: chooseCollectionPath(),
    envFile: '.env',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--summary') args.summaryPath = argv[++i];
    else if (arg === '--collection') args.collectionPath = argv[++i];
    else if (arg === '--env-file') args.envFile = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/migrate-agap-excel.js [--apply] [--env-file .env] [--summary docs/SUMMARY.xlsx] [--collection "E:/.../COLLECTION SHEET.xlsx"]');
      console.log('Default mode is dry-run. Use --apply to write to Supabase.');
      process.exit(0);
    }
  }
  return args;
}

function randomId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function scheduleStatus(totalPaid, installmentAmount, index, dueDate) {
  const cumulativeDue = installmentAmount * index;
  const previousDue = installmentAmount * (index - 1);
  if (totalPaid >= cumulativeDue - 1) return 'paid';
  if (totalPaid > previousDue + 1) return 'partial';
  if (dueDate < new Date()) return 'late';
  return 'pending';
}

function requireEnv() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }
  return { url, key };
}

async function loadExisting(supabase) {
  const [{ data: borrowers, error: borrowersError }, { data: loans, error: loansError }] = await Promise.all([
    supabase.from('app_borrowers').select('*'),
    supabase.from('app_loans').select('*'),
  ]);
  if (borrowersError) throw borrowersError;
  if (loansError) throw loansError;
  return { borrowers: borrowers || [], loans: loans || [] };
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
}

async function getTableColumns(supabase, table) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error) throw new Error(`Unable to inspect ${table} columns: ${error.message}`);
  return new Set(Object.keys((data && data[0]) || {}));
}

async function getTargetColumns(supabase) {
  const entries = await Promise.all(
    ['app_collectors', 'app_borrowers', 'app_loans', 'app_payment_schedules', 'app_payments'].map(async (table) => [table, await getTableColumns(supabase, table)])
  );
  return Object.fromEntries(entries);
}

function sanitizeRows(rows, columns) {
  if (!columns || columns.size === 0) return rows;
  return rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => columns.has(key))));
}

function mapCollectorName(plan, collectorName) {
  if (!collectorName) return null;
  const match = plan.collectorsByName?.get(normalize(collectorName));
  return match || null;
}

async function ensureCollectors(supabase, plan) {
  const names = [...new Set(plan.borrowers.map((borrower) => borrower.collector_name).filter(Boolean))];
  const { data: existing, error } = await supabase.from('app_collectors').select('id, full_name');
  if (error) throw error;
  const byName = new Map((existing || []).map((collector) => [normalize(collector.full_name), collector.id]));

  const toInsert = names
    .filter((name) => !byName.has(normalize(name)))
    .map((name) => ({ id: randomId(), full_name: name, is_active: true, created_at: nowIso(), updated_at: nowIso() }));

  for (let i = 0; i < toInsert.length; i += 50) {
    const batch = toInsert.slice(i, i + 50);
    const { error: insertError } = await supabase.from('app_collectors').insert(batch);
    if (insertError) throw insertError;
    for (const collector of batch) byName.set(normalize(collector.full_name), collector.id);
  }

  plan.collectorsByName = byName;
}

function prepareRows(plan, existing) {
  const borrowerByMember = new Map();
  const borrowerByName = new Map();
  for (const borrower of existing.borrowers) {
    if (borrower.member_id) borrowerByMember.set(String(borrower.member_id).toUpperCase(), borrower);
    borrowerByName.set(normalize(borrower.full_name), borrower);
  }

  const existingLoanNumbers = new Set(existing.loans.map((loan) => loan.loan_number));
  const borrowerIdMap = new Map();
  const borrowersToInsert = [];
  const borrowersToUpdate = [];

  for (const borrower of plan.borrowers) {
    const existingBorrower = (borrower.member_id && borrowerByMember.get(borrower.member_id)) || borrowerByName.get(normalize(borrower.full_name));
    if (existingBorrower) {
      borrowerIdMap.set(borrower.id, existingBorrower.id);
      const patch = {};
      if (borrower.group && borrower.group !== existingBorrower.group) patch.group = borrower.group;
      if (borrower.address && !existingBorrower.address) patch.address = borrower.address;
      if (borrower.loan_code && borrower.loan_code !== existingBorrower.loan_code) patch.loan_code = borrower.loan_code;
      if (Object.keys(patch).length) borrowersToUpdate.push({ id: existingBorrower.id, patch });
    } else {
      const id = randomId();
      borrowerIdMap.set(borrower.id, id);
      borrowersToInsert.push({
        id,
        full_name: borrower.full_name,
        first_name: borrower.first_name,
        last_name: borrower.last_name,
        member_id: borrower.member_id,
        gender: borrower.gender,
        date_of_birth: borrower.date_of_birth,
        phone: borrower.phone,
        contact_no: borrower.contact_no,
        area: borrower.area,
        address: borrower.address,
        source_of_income: borrower.source_of_income,
        date_joined: borrower.date_joined,
        membership_status: borrower.membership_status,
        group: borrower.group,
        cycle_id: borrower.cycle_id,
        loan_code: borrower.loan_code,
        collector_id: mapCollectorName(plan, borrower.collector_name),
        created_at: nowIso(),
        updated_at: nowIso(),
      });
    }
  }

  const loanIdMap = new Map();
  const loansToInsert = [];
  const schedulesToInsert = [];
  for (const loan of plan.loans) {
    if (existingLoanNumbers.has(loan.loan_number)) continue;
    const id = randomId();
    loanIdMap.set(loan.id, id);
    const firstPaymentDate = loan.release_date ? addDays(new Date(`${loan.release_date}T00:00:00Z`), 7) : null;
    loansToInsert.push({
      id,
      borrower_id: borrowerIdMap.get(loan.borrower_id),
      loan_number: loan.loan_number,
      loan_type: loan.loan_type,
      principal_amount: loan.principal_amount,
      interest_rate: loan.interest_rate,
      interest_type: loan.interest_type,
      term: loan.term,
      term_unit: loan.term_unit,
      frequency: loan.frequency,
      total_amount: loan.total_amount,
      installment_amount: loan.installment_amount,
      deposit_amount: loan.deposit_amount,
      insurance_amount: loan.insurance_amount,
      savings_per_payment: loan.savings_per_payment,
      deducted_amount: loan.deducted_amount,
      interest_amount: loan.interest_amount,
      release_date: loan.release_date,
      first_payment_date: firstPaymentDate ? firstPaymentDate.toISOString() : null,
      maturity_date: loan.maturity_date,
      status: loan.status,
      is_reloan: loan.is_reloan,
      previous_loan_id: loan.previous_loan_id ? loanIdMap.get(loan.previous_loan_id) || null : null,
      cycle: loan.cycle,
      notes: `Migrated from AGAP Excel. Group=${loan.group || ''}; stated balance=${loan.stated_latest_balance}`,
      created_at: nowIso(),
      updated_at: nowIso(),
    });

    const principalPerPayment = loan.term > 0 ? loan.principal_amount / loan.term : 0;
    const interestPerPayment = loan.term > 0 ? loan.interest_amount / loan.term : 0;
    const feesPerPayment = Math.max(0, loan.installment_amount - principalPerPayment - interestPerPayment);
    for (let paymentNo = 1; paymentNo <= loan.term; paymentNo += 1) {
      const dueDate = firstPaymentDate ? addDays(firstPaymentDate, (paymentNo - 1) * 7) : null;
      schedulesToInsert.push({
        id: randomId(),
        loan_id: id,
        due_date: dueDate ? dueDate.toISOString() : nowIso(),
        scheduled_amount: loan.installment_amount,
        principal_amount: principalPerPayment,
        interest_amount: interestPerPayment,
        fees_amount: feesPerPayment,
        status: scheduleStatus(loan.total_paid || 0, loan.installment_amount, paymentNo, dueDate || new Date()),
        created_at: nowIso(),
        updated_at: nowIso(),
      });
    }
  }

  const paymentsToInsert = plan.payments
    .filter((payment) => loanIdMap.has(payment.loan_id))
    .map((payment) => ({
      id: randomId(),
      loan_id: loanIdMap.get(payment.loan_id),
      borrower_id: borrowerIdMap.get(payment.borrower_id),
      amount: payment.amount,
      payment_date: payment.payment_date,
      payment_type: payment.payment_type,
      notes: payment.notes,
      encoded_at: nowIso(),
      created_at: nowIso(),
      updated_at: nowIso(),
    }));

  return { borrowersToInsert, borrowersToUpdate, loansToInsert, paymentsToInsert, schedulesToInsert };
}

async function insertBatches(supabase, table, rows, columns = null) {
  const sanitizedRows = columns ? sanitizeRows(rows, columns) : rows;
  for (let i = 0; i < sanitizedRows.length; i += 50) {
    const { error } = await supabase.from(table).insert(sanitizedRows.slice(i, i + 50));
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
  }
}

function loadEnvFile(envFile) {
  dotenv.config({ path: envFile, override: true });
}

async function applyMigration(plan, env = requireEnv(), options = {}) {
  const supabase = createClient(env.url, env.key, { auth: { autoRefreshToken: false, persistSession: false } });
  await ensureCollectors(supabase, plan);
  const targetColumns = options.targetColumns || await getTargetColumns(supabase);
  const existing = await loadExisting(supabase);
  const rows = prepareRows(plan, existing);

  console.log(`Inserting borrowers=${rows.borrowersToInsert.length}, updating borrowers=${rows.borrowersToUpdate.length}, inserting loans=${rows.loansToInsert.length}, inserting schedules=${rows.schedulesToInsert.length}, inserting payments=${rows.paymentsToInsert.length}`);

  await insertBatches(supabase, 'app_borrowers', rows.borrowersToInsert, targetColumns.app_borrowers);
  for (const update of rows.borrowersToUpdate) {
    const sanitizedPatch = sanitizeRows([{ ...update.patch, updated_at: nowIso() }], targetColumns.app_borrowers)[0];
    const { error } = await supabase.from('app_borrowers').update(sanitizedPatch).eq('id', update.id);
    if (error) throw error;
  }
  await insertBatches(supabase, 'app_loans', rows.loansToInsert, targetColumns.app_loans);
  await insertBatches(supabase, 'app_payment_schedules', rows.schedulesToInsert, targetColumns.app_payment_schedules);
  await insertBatches(supabase, 'app_payments', rows.paymentsToInsert, targetColumns.app_payments);

  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadEnvFile(args.envFile);
  const plan = createPlan(args);

  console.log(`Prepared migration from ${plan.summary.sourceCollectionPath}`);
  console.log(`Borrowers=${plan.summary.borrowers}, loans=${plan.summary.loans}, payments=${plan.summary.payments}, rollovers=${plan.summary.rollovers}, reviewItems=${plan.summary.issueCount}`);

  if (!args.apply) {
    console.log('Dry run only. No database writes were performed. Run with --apply after reviewing docs/reconciliation output.');
    return;
  }

  if (plan.issues.some((issue) => issue.level === 'error')) {
    throw new Error('Migration plan contains blocking errors. Run analyze-agap-excel-migration.js and resolve them first.');
  }

  await applyMigration(plan, requireEnv());

  console.log('AGAP Excel migration applied.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[migrate-agap-excel] Failed:', error);
    process.exit(1);
  });
}

module.exports = {
  applyMigration,
  loadEnvFile,
  parseArgs,
  prepareRows,
  requireEnv,
  sanitizeRows,
};
