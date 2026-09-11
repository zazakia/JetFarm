/**
 * seed-production-mock-data.mjs
 * 
 * Seeds sample mock data into the POS Cursor production Supabase DB for demo and CRUD testing.
 * Uses the Supabase REST API via the service-role key.
 * 
 * Usage:
 *   node scripts/seed-production-mock-data.mjs
 *   node scripts/seed-production-mock-data.mjs --dry-run     (validates without inserting)
 *   node scripts/seed-production-mock-data.mjs --clean       (deletes existing DEMO_ records first)
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// ── Production credentials ───────────────────────────────────────────────────
const SUPABASE_URL  = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SERVICE_KEY   = 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const args     = process.argv.slice(2);
const DRY_RUN  = args.includes('--dry-run');
const CLEAN    = args.includes('--clean');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function ts(daysOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString();
}

function epoch(daysOffset = 0) {
  return Date.now() + daysOffset * 86_400_000;
}

async function insert(table, rows, label) {
  if (DRY_RUN) {
    console.log(`  [dry-run] Would insert ${rows.length} row(s) into ${table}`);
    return rows;
  }
  const { data, error } = await supabase.from(table).upsert(rows, { onConflict: 'id' }).select();
  if (error) {
    console.error(`  ❌ ${label || table}: ${error.message}`);
    throw error;
  }
  console.log(`  ✅ ${label || table}: ${data.length} row(s)`);
  return data;
}

async function del(table, prefix) {
  const { error } = await supabase.from(table).delete().like('id', `${prefix}%`);
  if (error) console.error(`  ⚠️  clean ${table}: ${error.message}`);
  else console.log(`  🧹 cleaned ${table} (prefix=${prefix})`);
}

// ── IDs (deterministic so re-runs are idempotent) ────────────────────────────
const DEMO = 'demo-';

const collectorIds = [
  `${DEMO}collector-001`,
  `${DEMO}collector-002`,
];

const adminId       = `${DEMO}admin-001`;
const encoderId     = `${DEMO}encoder-001`;
const payEncoderId  = `${DEMO}payenc-001`;
const expEncoderId  = `${DEMO}expenc-001`;

const borrowerIds = Array.from({ length: 6 }, (_, i) =>
  `${DEMO}borrower-00${i + 1}`,
);

const loanIds = Array.from({ length: 6 }, (_, i) =>
  `${DEMO}loan-00${i + 1}`,
);

const schedIds = (loanIdx, count) =>
  Array.from({ length: count }, (_, i) =>
    `${DEMO}sched-${String(loanIdx).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`,
  );

// ── Data ─────────────────────────────────────────────────────────────────────

const userProfiles = [
  { id: adminId,       full_name: 'DEMO Admin',             role: 'admin',            email: 'demo.admin@poscursor.test',       is_active: true, created_at: ts(-30), updated_at: ts() },
  { id: collectorIds[0], full_name: 'DEMO Collector Ana',   role: 'collector',        email: 'demo.collector1@poscursor.test',  is_active: true, created_at: ts(-30), updated_at: ts() },
  { id: collectorIds[1], full_name: 'DEMO Collector Ben',   role: 'collector',        email: 'demo.collector2@poscursor.test',  is_active: true, created_at: ts(-30), updated_at: ts() },
  { id: encoderId,     full_name: 'DEMO Loan Encoder',      role: 'loan_encoder',     email: 'demo.encoder@poscursor.test',     is_active: true, created_at: ts(-30), updated_at: ts() },
  { id: payEncoderId,  full_name: 'DEMO Payment Encoder',   role: 'payment_encoder',  email: 'demo.payenc@poscursor.test',      is_active: true, created_at: ts(-30), updated_at: ts() },
  { id: expEncoderId,  full_name: 'DEMO Expenses Encoder',  role: 'expenses_encoder', email: 'demo.expenc@poscursor.test',      is_active: true, created_at: ts(-30), updated_at: ts() },
];

const collectors = [
  { id: collectorIds[0], full_name: 'DEMO Collector Ana', auth_id: null, is_active: true, created_at: ts(-30), updated_at: ts() },
  { id: collectorIds[1], full_name: 'DEMO Collector Ben', auth_id: null, is_active: true, created_at: ts(-30), updated_at: ts() },
];

const borrowerData = [
  { id: borrowerIds[0], full_name: 'DEMO Juan dela Cruz',  first_name: 'Juan',   last_name: 'dela Cruz',  phone: '09171234001', address: 'Zone 1, Brgy. Poblacion, Dagupan', area: 'Dagupan Central', route_index: 1,  collector_id: collectorIds[0], gender: 'Male',   membership_type: 'regular',   membership_number: 'DEMO-M001', date_joined: epoch(-365), civil_status: 'Married',   source_of_income: 'Sari-sari Store' },
  { id: borrowerIds[1], full_name: 'DEMO Maria Santos',    first_name: 'Maria',  last_name: 'Santos',     phone: '09171234002', address: 'Zone 2, Brgy. Bonuan, Dagupan',    area: 'Dagupan North',   route_index: 2,  collector_id: collectorIds[0], gender: 'Female', membership_type: 'regular',   membership_number: 'DEMO-M002', date_joined: epoch(-300), civil_status: 'Single',    source_of_income: 'Dress Making' },
  { id: borrowerIds[2], full_name: 'DEMO Carlos Reyes',    first_name: 'Carlos', last_name: 'Reyes',      phone: '09171234003', address: 'Zone 3, Brgy. Pogo, Dagupan',      area: 'Dagupan South',   route_index: 3,  collector_id: collectorIds[0], gender: 'Male',   membership_type: 'associate', membership_number: 'DEMO-M003', date_joined: epoch(-180), civil_status: 'Married',   source_of_income: 'Tricycle Driver' },
  { id: borrowerIds[3], full_name: 'DEMO Ana Garcia',      first_name: 'Ana',    last_name: 'Garcia',     phone: '09171234004', address: 'Zone 4, Brgy. Lucao, Dagupan',     area: 'Dagupan East',    route_index: 1,  collector_id: collectorIds[1], gender: 'Female', membership_type: 'regular',   membership_number: 'DEMO-M004', date_joined: epoch(-500), civil_status: 'Widowed',   source_of_income: 'Laundry Shop' },
  { id: borrowerIds[4], full_name: 'DEMO Pedro Lopez',     first_name: 'Pedro',  last_name: 'Lopez',      phone: '09171234005', address: 'Zone 5, Brgy. Mangin, Dagupan',    area: 'Dagupan West',    route_index: 2,  collector_id: collectorIds[1], gender: 'Male',   membership_type: 'regular',   membership_number: 'DEMO-M005', date_joined: epoch(-400), civil_status: 'Married',   source_of_income: 'Fishing' },
  { id: borrowerIds[5], full_name: 'DEMO Rosa Mendoza',    first_name: 'Rosa',   last_name: 'Mendoza',    phone: '09171234006', address: 'Zone 6, Brgy. Calmay, Dagupan',    area: 'Dagupan North',   route_index: 3,  collector_id: collectorIds[1], gender: 'Female', membership_type: 'associate', membership_number: 'DEMO-M006', date_joined: epoch(-90),  civil_status: 'Single',    source_of_income: 'Food Vendor' },
];

const borrowers = borrowerData.map(b => ({
  ...b,
  created_at: ts(-30),
  updated_at: ts(),
  deleted_at: null,
  notes: 'DEMO seed record — safe to delete',
  latitude: 16.04 + Math.random() * 0.05,
  longitude: 120.33 + Math.random() * 0.05,
}));

// Loans: 4 active + 1 completed + 1 pending
const loanDefs = [
  { id: loanIds[0], borrowerId: borrowerIds[0], collectorId: collectorIds[0], num: 'DEMO-LN-001', principal: 10000, rate: 20, term: 60, freq: 'daily',   status: 'active',    daysAgo: 30 },
  { id: loanIds[1], borrowerId: borrowerIds[1], collectorId: collectorIds[0], num: 'DEMO-LN-002', principal: 15000, rate: 20, term: 26, freq: 'weekly',  status: 'active',    daysAgo: 20 },
  { id: loanIds[2], borrowerId: borrowerIds[2], collectorId: collectorIds[0], num: 'DEMO-LN-003', principal: 5000,  rate: 20, term: 12, freq: 'monthly', status: 'active',    daysAgo: 60 },
  { id: loanIds[3], borrowerId: borrowerIds[3], collectorId: collectorIds[1], num: 'DEMO-LN-004', principal: 20000, rate: 20, term: 60, freq: 'daily',   status: 'active',    daysAgo: 10 },
  { id: loanIds[4], borrowerId: borrowerIds[4], collectorId: collectorIds[1], num: 'DEMO-LN-005', principal: 8000,  rate: 20, term: 60, freq: 'daily',   status: 'completed', daysAgo: 90 },
  { id: loanIds[5], borrowerId: borrowerIds[5], collectorId: collectorIds[1], num: 'DEMO-LN-006', principal: 12000, rate: 20, term: 26, freq: 'weekly',  status: 'pending',   daysAgo: 0  },
];

const loans = loanDefs.map(l => {
  const interest    = l.principal * (l.rate / 100);
  const total       = l.principal + interest;
  const installment = Math.round(total / l.term * 100) / 100;
  return {
    id:               l.id,
    borrower_id:      l.borrowerId,
    loan_number:      l.num,
    loan_type:        'new',
    principal_amount: l.principal,
    interest_rate:    l.rate,
    interest_type:    'flat',
    term:             l.term,
    term_unit:        l.freq === 'monthly' ? 'months' : 'days',
    frequency:        l.freq,
    total_amount:     total,
    installment_amount: installment,
    interest_amount:  interest,
    release_date:     ts(-l.daysAgo),
    first_payment_date: ts(-l.daysAgo + 1),
    maturity_date:    ts(l.term - l.daysAgo),
    status:           l.status,
    is_reloan:        false,
    encoded_by:       encoderId,
    collector_id:     l.collectorId,
    deposit_amount:   0,
    insurance_amount: 100,
    processing_fee:   200,
    collection_fee:   0,
    notarial_fee:     100,
    savings_per_payment: 20,
    deducted_amount:  0,
    batch:            1,
    cycle:            1,
    notes:            'DEMO seed record — safe to delete',
    created_at:       ts(-l.daysAgo),
    updated_at:       ts(),
    deleted_at:       null,
  };
});

// Payment schedules — 3 per loan
const schedules = [];
loanDefs.forEach((l, li) => {
  const installment = loans[li].installment_amount;
  for (let i = 0; i < 3; i++) {
    const dayOffset = -l.daysAgo + i + 1;
    const isPast    = dayOffset < 0;
    const status    = (l.status === 'completed') ? 'paid' : (isPast && i < 1 ? 'paid' : 'pending');
    schedules.push({
      id:               `${DEMO}sched-${String(li + 1).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`,
      loan_id:          l.id,
      due_date:         ts(dayOffset),
      scheduled_amount: installment,
      status,
      fees_amount:      0,
      principal_amount: Math.round(installment * 0.8 * 100) / 100,
      interest_amount:  Math.round(installment * 0.2 * 100) / 100,
      created_at:       ts(-l.daysAgo),
      updated_at:       ts(),
      deleted_at:       null,
    });
  }
});

// Payments — 1 per active loan (on first schedule)
const payments = loanDefs
  .filter(l => ['active', 'completed'].includes(l.status))
  .map((l, i) => ({
    id:            `${DEMO}payment-${String(i + 1).padStart(3, '0')}`,
    loan_id:       l.id,
    borrower_id:   l.borrowerId,
    schedule_id:   `${DEMO}sched-${String(loanDefs.indexOf(l) + 1).padStart(2, '0')}-001`,
    collector_id:  l.collectorId,
    amount:        loans[loanDefs.indexOf(l)].installment_amount,
    payment_date:  ts(-l.daysAgo + 1),
    receipt_number: `DEMO-RCPT-${String(i + 1).padStart(4, '0')}`,
    notes:         'DEMO payment seed',
    encoded_at:    ts(-l.daysAgo + 1),
    created_at:    ts(-l.daysAgo + 1),
    updated_at:    ts(),
    deleted_at:    null,
  }));

// Expenses
const expenses = [
  { id: `${DEMO}expense-001`, category: 'Office Supplies',  description: 'DEMO Bond paper and ballpen', amount: 350,  expense_date: ts(-10), frequency: 'one-time', encoded_by: expEncoderId },
  { id: `${DEMO}expense-002`, category: 'Utilities',        description: 'DEMO Electric bill',          amount: 1200, expense_date: ts(-5),  frequency: 'monthly',  encoded_by: expEncoderId },
  { id: `${DEMO}expense-003`, category: 'Transportation',   description: 'DEMO Fuel for collection',    amount: 500,  expense_date: ts(-3),  frequency: 'one-time', encoded_by: expEncoderId },
  { id: `${DEMO}expense-004`, category: 'Miscellaneous',    description: 'DEMO Snacks for meeting',     amount: 800,  expense_date: ts(-1),  frequency: 'one-time', encoded_by: expEncoderId },
].map(e => ({ ...e, created_at: ts(-10), updated_at: ts(), deleted_at: null }));

const expenseCategories = [
  { id: `${DEMO}cat-001`, name: 'Office Supplies',  is_active: true, created_at: ts(-30), updated_at: ts(), deleted_at: null },
  { id: `${DEMO}cat-002`, name: 'Utilities',        is_active: true, created_at: ts(-30), updated_at: ts(), deleted_at: null },
  { id: `${DEMO}cat-003`, name: 'Transportation',   is_active: true, created_at: ts(-30), updated_at: ts(), deleted_at: null },
  { id: `${DEMO}cat-004`, name: 'Miscellaneous',    is_active: true, created_at: ts(-30), updated_at: ts(), deleted_at: null },
  { id: `${DEMO}cat-005`, name: 'Salaries',         is_active: true, created_at: ts(-30), updated_at: ts(), deleted_at: null },
];

const cashTransactions = [
  { id: `${DEMO}cash-001`, transaction_date: ts(-7), particulars: 'DEMO Opening balance',    type: 'in',  amount: 50000, remarks: 'DEMO cash in',  recorded_by: adminId },
  { id: `${DEMO}cash-002`, transaction_date: ts(-5), particulars: 'DEMO Loan release Juan',  type: 'out', amount: 10000, remarks: 'DEMO cash out', recorded_by: adminId },
  { id: `${DEMO}cash-003`, transaction_date: ts(-3), particulars: 'DEMO Collection Ana',     type: 'in',  amount: 5500,  remarks: 'DEMO cash in',  recorded_by: collectorIds[0] },
  { id: `${DEMO}cash-004`, transaction_date: ts(-1), particulars: 'DEMO Collection Ben',     type: 'in',  amount: 4200,  remarks: 'DEMO cash in',  recorded_by: collectorIds[1] },
  { id: `${DEMO}cash-005`, transaction_date: ts(0),  particulars: 'DEMO Expense payment',    type: 'out', amount: 1200,  remarks: 'DEMO cash out', recorded_by: expEncoderId },
].map(c => ({ ...c, created_at: ts(-7), updated_at: ts(), deleted_at: null }));

const bankAccounts = [
  { id: `${DEMO}bank-001`, bank_name: 'BDO',     account_name: 'DEMO POS Cursor Coop', account_number: 'DEMO-0012345678', starting_balance: 100000, created_at: ts(-90), updated_at: ts(), deleted_at: null },
  { id: `${DEMO}bank-002`, bank_name: 'Metrobank', account_name: 'DEMO POS Cursor Coop', account_number: 'DEMO-9987654321', starting_balance: 50000,  created_at: ts(-90), updated_at: ts(), deleted_at: null },
];

const bankTransactions = [
  { id: `${DEMO}banktxn-001`, bank_account_id: `${DEMO}bank-001`, transaction_date: ts(-15), type: 'deposit',    amount: 20000, particulars: 'DEMO Capital deposit',    remarks: 'DEMO', created_at: ts(-15), updated_at: ts(), deleted_at: null },
  { id: `${DEMO}banktxn-002`, bank_account_id: `${DEMO}bank-001`, transaction_date: ts(-10), type: 'withdrawal', amount: 10000, particulars: 'DEMO Loan fund release',   remarks: 'DEMO', created_at: ts(-10), updated_at: ts(), deleted_at: null },
  { id: `${DEMO}banktxn-003`, bank_account_id: `${DEMO}bank-002`, transaction_date: ts(-5),  type: 'deposit',    amount: 5000,  particulars: 'DEMO Payment remittance',  remarks: 'DEMO', created_at: ts(-5),  updated_at: ts(), deleted_at: null },
];

const savingsTransactions = [
  { id: `${DEMO}savings-001`, borrower_id: borrowerIds[0], type: 'deposit',    amount: 500,  reference_id: loanIds[0], date: ts(-20), notes: 'DEMO savings deposit',    created_at: ts(-20), updated_at: ts(), deleted_at: null },
  { id: `${DEMO}savings-002`, borrower_id: borrowerIds[1], type: 'deposit',    amount: 300,  reference_id: loanIds[1], date: ts(-15), notes: 'DEMO savings deposit',    created_at: ts(-15), updated_at: ts(), deleted_at: null },
  { id: `${DEMO}savings-003`, borrower_id: borrowerIds[2], type: 'deposit',    amount: 200,  reference_id: loanIds[2], date: ts(-10), notes: 'DEMO savings deposit',    created_at: ts(-10), updated_at: ts(), deleted_at: null },
  { id: `${DEMO}savings-004`, borrower_id: borrowerIds[3], type: 'withdrawal', amount: 1000, reference_id: null,       date: ts(-5),  notes: 'DEMO savings withdrawal', created_at: ts(-5),  updated_at: ts(), deleted_at: null },
];

const collectionLogs = [
  { id: `${DEMO}colllog-001`, collector_id: collectorIds[0], log_date: ts(-3), total_collected: 5500, cash_on_hand_start: 0, cash_on_hand_end: 5500, notes: 'DEMO collection log', created_at: ts(-3), updated_at: ts(), deleted_at: null },
  { id: `${DEMO}colllog-002`, collector_id: collectorIds[1], log_date: ts(-2), total_collected: 4200, cash_on_hand_start: 0, cash_on_hand_end: 4200, notes: 'DEMO collection log', created_at: ts(-2), updated_at: ts(), deleted_at: null },
  { id: `${DEMO}colllog-003`, collector_id: collectorIds[0], log_date: ts(-1), total_collected: 3800, cash_on_hand_start: 0, cash_on_hand_end: 3800, notes: 'DEMO collection log', created_at: ts(-1), updated_at: ts(), deleted_at: null },
];

const remittances = [
  { id: `${DEMO}remit-001`, collector_id: collectorIds[0], amount: 5500, remittance_date: ts(-3), status: 'approved', approved_by: adminId, notes: 'DEMO remittance', created_at: ts(-3), updated_at: ts(), deleted_at: null },
  { id: `${DEMO}remit-002`, collector_id: collectorIds[1], amount: 4200, remittance_date: ts(-2), status: 'approved', approved_by: adminId, notes: 'DEMO remittance', created_at: ts(-2), updated_at: ts(), deleted_at: null },
  { id: `${DEMO}remit-003`, collector_id: collectorIds[0], amount: 3800, remittance_date: ts(-1), status: 'pending',  approved_by: null,    notes: 'DEMO remittance', created_at: ts(-1), updated_at: ts(), deleted_at: null },
];

const financialSnapshots = [
  { id: `${DEMO}snapshot-001`, snapshot_date: ts(-7),  total_assets: 250000, total_equity: 150000, total_liabilities: 100000, loan_loss_reserve: 5000, operating_revenue: 12000, financial_costs: 2000, subsidy_adjustment: 0, inflation_adjustment: 0, risk_weighted_assets: 125000, created_at: ts(-7),  updated_at: ts(), deleted_at: null },
  { id: `${DEMO}snapshot-002`, snapshot_date: ts(-14), total_assets: 245000, total_equity: 148000, total_liabilities: 97000,  loan_loss_reserve: 4800, operating_revenue: 11500, financial_costs: 1950, subsidy_adjustment: 0, inflation_adjustment: 0, risk_weighted_assets: 122000, created_at: ts(-14), updated_at: ts(), deleted_at: null },
];

const loanPenalties = [
  { id: `${DEMO}penalty-001`, loan_id: loanIds[2], amount: 50, penalty_date: epoch(-5), reason: 'DEMO late payment penalty', created_at: ts(-5), updated_at: ts(), deleted_at: null },
  { id: `${DEMO}penalty-002`, loan_id: loanIds[0], amount: 25, penalty_date: epoch(-2), reason: 'DEMO missed schedule',       created_at: ts(-2), updated_at: ts(), deleted_at: null },
];

const collectionGroups = [
  { id: `${DEMO}group-001`, name: 'DEMO Group Alpha', collector_id: collectorIds[0], collection_day: 1, is_active: true, created_at: ts(-30), updated_at: ts(), deleted_at: null },
  { id: `${DEMO}group-002`, name: 'DEMO Group Beta',  collector_id: collectorIds[1], collection_day: 3, is_active: true, created_at: ts(-30), updated_at: ts(), deleted_at: null },
];

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌱 POS Cursor Production Mock Data Seeder');
  console.log(`   Target : ${SUPABASE_URL}`);
  console.log(`   Mode   : ${DRY_RUN ? 'DRY RUN' : CLEAN ? 'CLEAN + SEED' : 'SEED (upsert)'}`);
  console.log('─'.repeat(60));

  // ── Clean phase ─────────────────────────────────────────────
  if (CLEAN && !DRY_RUN) {
    console.log('\n🧹 Cleaning existing DEMO records…');
    const cleanOrder = [
      'app_action_logs', 'app_loan_penalties', 'app_payment_schedules',
      'app_payments', 'app_savings_transactions', 'app_collection_logs',
      'app_remittances', 'app_loans', 'app_borrowers', 'collection_groups',
      'app_collectors', 'app_expenses', 'app_expense_categories',
      'app_cash_transactions', 'app_bank_transactions', 'app_bank_accounts',
      'app_financial_snapshots', 'user_profiles',
    ];
    for (const tbl of cleanOrder) {
      await del(tbl, DEMO);
    }
  }

  // ── Seed phase ───────────────────────────────────────────────
  console.log('\n🌱 Inserting demo records…');

  try {
    await insert('user_profiles',         userProfiles,         'User Profiles (6 roles)');
    await insert('app_collectors',        collectors,           'Collectors (2)');
    await insert('app_borrowers',         borrowers,            'Borrowers (6)');
    await insert('app_expense_categories',expenseCategories,    'Expense Categories (5)');
    await insert('app_loans',             loans,                'Loans (4 active, 1 completed, 1 pending)');
    await insert('app_payment_schedules', schedules,            `Payment Schedules (${schedules.length})`);
    await insert('app_payments',          payments,             `Payments (${payments.length})`);
    await insert('app_loan_penalties',    loanPenalties,        'Loan Penalties (2)');
    await insert('app_expenses',          expenses,             'Expenses (4)');
    await insert('app_cash_transactions', cashTransactions,     'Cash Transactions (5)');
    await insert('app_bank_accounts',     bankAccounts,         'Bank Accounts (2)');
    await insert('app_bank_transactions', bankTransactions,     'Bank Transactions (3)');
    await insert('app_savings_transactions', savingsTransactions, 'Savings Transactions (4)');
    await insert('app_collection_logs',   collectionLogs,       'Collection Logs (3)');
    await insert('app_remittances',       remittances,          'Remittances (3)');
    await insert('app_financial_snapshots', financialSnapshots, 'Financial Snapshots (2)');
    await insert('collection_groups',     collectionGroups,     'Collection Groups (2)');
  } catch (err) {
    console.error('\n❌ Seed aborted:', err.message);
    process.exit(1);
  }

  console.log('\n' + '─'.repeat(60));
  console.log('✅ SEED COMPLETE!\n');
  console.log('📊 Summary:');
  console.log(`   User Profiles      : ${userProfiles.length}`);
  console.log(`   Collectors         : ${collectors.length}`);
  console.log(`   Borrowers          : ${borrowers.length}`);
  console.log(`   Loans              : ${loans.length} (4 active, 1 completed, 1 pending)`);
  console.log(`   Payment Schedules  : ${schedules.length}`);
  console.log(`   Payments           : ${payments.length}`);
  console.log(`   Expenses           : ${expenses.length}`);
  console.log(`   Cash Transactions  : ${cashTransactions.length}`);
  console.log(`   Bank Accounts      : ${bankAccounts.length}`);
  console.log(`   Savings Txns       : ${savingsTransactions.length}`);
  console.log(`   Collection Logs    : ${collectionLogs.length}`);
  console.log(`   Remittances        : ${remittances.length}`);
  console.log(`   Financial Snapshots: ${financialSnapshots.length}`);
  console.log(`   Collection Groups  : ${collectionGroups.length}`);
  console.log('\n💡 All demo IDs are prefixed with "demo-" for easy identification.');
  console.log('   To wipe: node scripts/seed-production-mock-data.mjs --clean --dry-run');
  console.log('   To clean and re-seed: node scripts/seed-production-mock-data.mjs --clean');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
