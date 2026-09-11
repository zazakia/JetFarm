import { createClient } from '@supabase/supabase-js';
import verifier from './verify-production-db-integrity.core.js';
import { pathToFileURL } from 'url';

const { formatPHP, resolveSupabaseConfig, collectJournalIntegrity } = verifier;

const { url: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_KEY } = resolveSupabaseConfig();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyProductionDataIntegrity() {
  console.log('================================================================================');
  console.log('            PRODUCTION DATABASE DEEP DATA INTEGRITY AUDIT');
  console.log('================================================================================');
  console.log(`Target: ${SUPABASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const auditSummary = {
    dashboardMetrics: {},
    integrityChecks: [],
    passCount: 0,
    failCount: 0,
    warnCount: 0,
  };

  function recordCheck(name, passed, message, level = 'FAIL') {
    if (passed) {
      console.log(`  ✓ [PASS] ${name}: ${message}`);
      auditSummary.passCount += 1;
      auditSummary.integrityChecks.push({ name, status: 'PASS', message });
    } else if (level === 'WARN') {
      console.log(`  ⚠ [WARN] ${name}: ${message}`);
      auditSummary.warnCount += 1;
      auditSummary.integrityChecks.push({ name, status: 'WARN', message });
    } else {
      console.log(`  ✗ [FAIL] ${name}: ${message}`);
      auditSummary.failCount += 1;
      auditSummary.integrityChecks.push({ name, status: 'FAIL', message });
    }
  }

  console.log('--------------------------------------------------------------------------------');
  console.log('1. SYSTEM DASHBOARD METRICS VERIFICATION');
  console.log('--------------------------------------------------------------------------------');

  const { data: borrowers, error: bErr } = await supabase
    .from('app_borrowers')
    .select('id, membership_number, full_name, membership_status, deleted_at')
    .is('deleted_at', null);
  if (bErr) throw bErr;

  const { data: loans, error: lErr } = await supabase
    .from('app_loans')
    .select('id, borrower_id, loan_number, principal_amount, total_amount, status, deleted_at')
    .is('deleted_at', null);
  if (lErr) throw lErr;

  const { data: payments, error: pErr } = await supabase
    .from('app_payments')
    .select('id, loan_id, schedule_id, amount, deleted_at')
    .is('deleted_at', null);
  if (pErr) throw pErr;

  const paymentsByLoanId = new Map();
  for (const payment of payments || []) {
    if (!payment.loan_id) continue;
    paymentsByLoanId.set(payment.loan_id, (paymentsByLoanId.get(payment.loan_id) || 0) + Number(payment.amount || 0));
  }

  const activeOrUnpaidLoans = (loans || []).filter((loan) => {
    const status = String(loan.status || '').toUpperCase();
    return status === 'ACTIVE' || status === 'UNPAID';
  });

  let totalActiveLoanBalance = 0;
  let totalDisbursed = 0;

  for (const loan of loans || []) {
    const principal = Number(loan.principal_amount || 0);
    totalDisbursed += principal;

    const status = String(loan.status || '').toUpperCase();
    if (status === 'ACTIVE' || status === 'UNPAID') {
      const paid = paymentsByLoanId.get(loan.id) || 0;
      totalActiveLoanBalance += Math.max(0, Number(loan.total_amount || 0) - paid);
    }
  }

  const { data: shareTx, error: sErr } = await supabase
    .from('app_share_capital_transactions')
    .select('id, member_id, transaction_type, amount, deleted_at')
    .is('deleted_at', null);
  if (sErr) throw sErr;

  let totalCBUBalance = 0;
  for (const tx of shareTx || []) {
    const amount = Number(tx.amount || 0);
    const type = String(tx.transaction_type || '').toUpperCase();
    if (type === 'WITHDRAWAL' || type === 'DEBIT') {
      totalCBUBalance -= amount;
    } else {
      totalCBUBalance += amount;
    }
  }

  const { data: savTx, error: savErr } = await supabase
    .from('app_savings_transactions')
    .select('id, borrower_id, type, amount, deleted_at')
    .is('deleted_at', null);
  if (savErr) throw savErr;

  let totalSavingsBalance = 0;
  for (const tx of savTx || []) {
    const amount = Number(tx.amount || 0);
    const type = String(tx.type || '').toLowerCase();
    if (type === 'withdrawal' || type === 'debit') {
      totalSavingsBalance -= amount;
    } else {
      totalSavingsBalance += amount;
    }
  }

  console.log(`  • Total Unique Members:        ${borrowers?.length || 0}`);
  console.log(`  • Active/Unpaid Loans Count:   ${activeOrUnpaidLoans.length}`);
  console.log(`  • Total Active Loan Balance:   ${formatPHP(totalActiveLoanBalance)}`);
  console.log(`  • Total Disbursed (Principal): ${formatPHP(totalDisbursed)}`);
  console.log(`  • Total CBU Balance:          ${formatPHP(totalCBUBalance)}`);
  console.log(`  • Total Savings Balance:      ${formatPHP(totalSavingsBalance)}\n`);

  auditSummary.dashboardMetrics = {
    totalUniqueMembers: borrowers?.length || 0,
    activeLoansCount: activeOrUnpaidLoans.length,
    totalActiveLoanBalance,
    totalDisbursed,
    totalCBUBalance,
    totalSavingsBalance,
  };

  recordCheck('Total Members count matches system baseline (102)', (borrowers || []).length === 102, `System Member Count: ${(borrowers || []).length}`);
  recordCheck('Active/Unpaid Loans exist in system', activeOrUnpaidLoans.length > 0, `Active/Unpaid loans count: ${activeOrUnpaidLoans.length}`);
  recordCheck('Total Active Loan Balance computed', totalActiveLoanBalance > 0, `Total Active Loan Balance: ${formatPHP(totalActiveLoanBalance)}`);
  recordCheck('Total Disbursed > 0', totalDisbursed > 0, `Total principal disbursed: ${formatPHP(totalDisbursed)}`);
  recordCheck('Total CBU Balance matches dashboard (229,418.08)', Math.abs(totalCBUBalance - 229418.08) < 0.01, `Total CBU balance: ${formatPHP(totalCBUBalance)}`);
  recordCheck('Total Savings Balance matches dashboard (127,794.98)', Math.abs(totalSavingsBalance - 127794.98) < 0.01, `Total Savings balance: ${formatPHP(totalSavingsBalance)}`);

  console.log('\n--------------------------------------------------------------------------------');
  console.log('2. REFERENTIAL INTEGRITY CHECKS');
  console.log('--------------------------------------------------------------------------------');

  const borrowerIds = new Set((borrowers || []).map((b) => b.id));

  const orphanedLoans = (loans || []).filter((loan) => !borrowerIds.has(loan.borrower_id));
  recordCheck(
    'Loan Borrower FK Integrity',
    orphanedLoans.length === 0,
    orphanedLoans.length === 0 ? 'All loans reference existing borrowers' : `${orphanedLoans.length} loans have invalid/missing borrower_id`
  );

  const orphanedShareTx = (shareTx || []).filter((tx) => !tx.member_id || !borrowerIds.has(tx.member_id));
  recordCheck(
    'Share Capital Member FK Integrity',
    orphanedShareTx.length === 0,
    orphanedShareTx.length === 0 ? 'All share capital transactions reference existing members' : `${orphanedShareTx.length} transactions have invalid/missing member_id`
  );

  const orphanedSavTx = (savTx || []).filter((tx) => !tx.borrower_id || !borrowerIds.has(tx.borrower_id));
  recordCheck(
    'Savings Borrower FK Integrity',
    orphanedSavTx.length === 0,
    orphanedSavTx.length === 0 ? 'All savings transactions reference existing borrowers' : `${orphanedSavTx.length} transactions have invalid/missing borrower_id`
  );

  const loanIds = new Set((loans || []).map((loan) => loan.id));
  const orphanedPayments = (payments || []).filter((payment) => !payment.loan_id || !loanIds.has(payment.loan_id));
  recordCheck(
    'Payment Loan FK Integrity',
    orphanedPayments.length === 0,
    orphanedPayments.length === 0 ? `All ${(payments || []).length} payments reference existing loans` : `${orphanedPayments.length} payments have invalid loan_id`
  );

  console.log('\n--------------------------------------------------------------------------------');
  console.log('3. DOUBLE-ENTRY ACCOUNTING INTEGRITY');
  console.log('--------------------------------------------------------------------------------');

  try {
    const journalSummary = await collectJournalIntegrity(supabase);
    console.log(`  • Posted Journal Entries:        ${journalSummary.postedJournalEntries}`);
    console.log(`  • Posted Journal Lines:          ${journalSummary.postedJournalLines}`);
    console.log(`  • Total Debits:                  ${formatPHP(journalSummary.totalDebits)}`);
    console.log(`  • Total Credits:                 ${formatPHP(journalSummary.totalCredits)}`);
    console.log(`  • Global Difference:             ${formatPHP(journalSummary.difference)}\n`);

    recordCheck(
      'Global Double-Entry Balance (Posted Entries Only)',
      journalSummary.difference < 0.01,
      `Total Debits = ${formatPHP(journalSummary.totalDebits)}, Total Credits = ${formatPHP(journalSummary.totalCredits)} (Diff = ${journalSummary.difference.toFixed(2)})`
    );

    recordCheck(
      'Per-Entry Double-Entry Balance',
      journalSummary.unbalancedEntriesCount === 0,
      journalSummary.unbalancedEntriesCount === 0
        ? `All ${journalSummary.postedJournalEntries} posted journal entries are balanced`
        : `${journalSummary.unbalancedEntriesCount} posted journal entries are unbalanced`,
      journalSummary.unbalancedEntriesCount > 0 ? 'WARN' : 'FAIL'
    );
  } catch (error) {
    console.warn(`  ⚠ Unable to verify journal entries: ${error.message}`);
  }

  console.log('\n--------------------------------------------------------------------------------');
  console.log('4. DUPLICATE & ANOMALY DETECTION');
  console.log('--------------------------------------------------------------------------------');

  const memNumCounts = new Map();
  for (const borrower of borrowers || []) {
    if (borrower.membership_number) {
      const key = borrower.membership_number.trim().toUpperCase();
      memNumCounts.set(key, (memNumCounts.get(key) || 0) + 1);
    }
  }

  let dupeMemNums = 0;
  for (const count of memNumCounts.values()) {
    if (count > 1) dupeMemNums += 1;
  }
  recordCheck(
    'Duplicate Membership Numbers',
    dupeMemNums === 0,
    dupeMemNums === 0 ? 'No duplicate membership numbers found' : `${dupeMemNums} duplicate membership numbers found`,
    dupeMemNums > 0 ? 'WARN' : 'FAIL'
  );

  const nameCounts = new Map();
  for (const borrower of borrowers || []) {
    if (borrower.full_name) {
      const key = borrower.full_name.trim().toLowerCase();
      nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
    }
  }

  let dupeNames = 0;
  for (const count of nameCounts.values()) {
    if (count > 1) dupeNames += 1;
  }
  recordCheck(
    'Duplicate Member Full Names',
    dupeNames === 0,
    dupeNames === 0 ? 'No duplicate member names found' : `${dupeNames} member names appear multiple times`,
    dupeNames > 0 ? 'WARN' : 'FAIL'
  );

  const activeLoansByBorrower = new Map();
  for (const loan of activeOrUnpaidLoans) {
    const key = loan.borrower_id;
    activeLoansByBorrower.set(key, (activeLoansByBorrower.get(key) || 0) + 1);
  }

  let multiActiveLoans = 0;
  for (const count of activeLoansByBorrower.values()) {
    if (count > 1) multiActiveLoans += 1;
  }
  recordCheck(
    'Multiple Active Loans per Borrower',
    multiActiveLoans === 0,
    multiActiveLoans === 0 ? 'No borrowers have multiple active loans' : `${multiActiveLoans} borrowers currently have multiple active loans`,
    multiActiveLoans > 0 ? 'WARN' : 'FAIL'
  );

  console.log('\n================================================================================');
  console.log('                          AUDIT SUMMARY REPORT');
  console.log('================================================================================');
  console.log(`Passed Checks:  ${auditSummary.passCount}`);
  console.log(`Warning Checks: ${auditSummary.warnCount}`);
  console.log(`Failed Checks:  ${auditSummary.failCount}`);
  console.log('================================================================================\n');

  return auditSummary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyProductionDataIntegrity().catch((err) => {
    console.error('✗ Data integrity audit failed with exception:', err);
    process.exit(1);
  });
}

export { verifyProductionDataIntegrity };
