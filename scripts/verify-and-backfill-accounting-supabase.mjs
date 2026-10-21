import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set. A service key is never hardcoded in this repo - export it in the shell that runs this script.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ACCT = {
  CASH_ON_HAND: '1010',       // Cash on Hand
  PETTY_CASH: '1011',         // Petty Cash Fund
  CASH_IN_BANK: '1020',       // Cash in Bank — BDO
  LOAN_RECEIVABLE: '1100',    // Loans Receivable
  INTEREST_RECEIVABLE: '1300',// Interest Receivable
  INTEREST_INCOME: '4010',    // Interest Income on Loans
  SERVICE_FEE_INCOME: '4020', // Service & Processing Fees
  FINES_PENALTIES: '4040',    // Fines & Penalties
  SAVINGS_DEPOSIT: '2010',    // Savings Deposits Payable
  SHARE_CAPITAL: '3010',      // Share Capital - Common
  OPERATING_EXPENSES: '5100', // Other Operating Expenses
  MISC_INCOME: '4070',        // Miscellaneous Income
};

async function auditAndBackfillAccounting() {
  console.log('========================================================================');
  console.log('  AUDITING & BACKFILLING ACCOUNTING JOURNAL ENTRIES IN PRODUCTION DB');
  console.log('========================================================================\n');

  // 1. Fetch current journal entries
  const { data: existingJournals } = await supabase.from('journal_entries').select('*');
  const { data: existingLines } = await supabase.from('journal_entry_lines').select('*');

  const existingSourceMap = new Set();
  for (const j of existingJournals || []) {
    if (j.source_table && j.source_id) {
      existingSourceMap.add(`${j.source_table}:${j.source_id}`);
    }
  }

  console.log(`Current DB Journal Entries: ${(existingJournals || []).length}`);
  console.log(`Current DB Journal Entry Lines: ${(existingLines || []).length}\n`);

  // 2. Fetch operational records
  const [{ data: loans }, { data: payments }, { data: expenses }, { data: savings }, { data: shareCap }, { data: cashTxns }, { data: bankTxns }] = await Promise.all([
    supabase.from('app_loans').select('*').is('deleted_at', null),
    supabase.from('app_payments').select('*').is('deleted_at', null),
    supabase.from('app_expenses').select('*').is('deleted_at', null),
    supabase.from('app_savings_transactions').select('*').is('deleted_at', null),
    supabase.from('app_share_capital_transactions').select('*').is('deleted_at', null),
    supabase.from('app_cash_transactions').select('*').is('deleted_at', null),
    supabase.from('app_bank_transactions').select('*').is('deleted_at', null),
  ]);

  let createdJournalsCount = 0;
  let createdLinesCount = 0;

  async function createJournal(entryData, linesData) {
    const journalId = crypto.randomUUID();
    const entryDate = entryData.date || new Date().toISOString();
    const d = new Date(entryDate);
    const totalAmount = linesData.reduce((sum, l) => sum + (l.debit || 0), 0);

    const newJournal = {
      id: journalId,
      entry_date: entryDate,
      reference_number: `JE-${String(Date.now()).slice(-8)}-${Math.floor(Math.random() * 1000)}`,
      description: entryData.description || 'Auto-posted Transaction',
      source_table: entryData.sourceTable,
      source_id: entryData.sourceId,
      entry_type: 'auto',
      is_posted: true,
      posted_by: 'system',
      total_debit: totalAmount,
      total_credit: totalAmount,
      fiscal_year: d.getFullYear(),
      fiscal_month: d.getMonth() + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: insertJErr } = await supabase.from('journal_entries').insert(newJournal);
    if (insertJErr) {
      console.error(`Failed to insert journal entry:`, insertJErr.message);
      return;
    }
    createdJournalsCount++;

    const dbLines = linesData.map((line) => ({
      id: crypto.randomUUID(),
      journal_entry_id: journalId,
      account_code: line.accountCode,
      account_name: line.accountName || line.accountCode,
      debit_amount: Number(line.debit || 0),
      credit_amount: Number(line.credit || 0),
      description: entryData.description || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error: insertLErr } = await supabase.from('journal_entry_lines').insert(dbLines);
    if (insertLErr) {
      console.error(`Failed to insert lines for journal:`, insertLErr.message);
    } else {
      createdLinesCount += dbLines.length;
    }
  }

  // A. Backfill Loan Disbursements
  for (const loan of loans || []) {
    if (!existingSourceMap.has(`app_loans:${loan.id}`) && Number(loan.principal_amount || 0) > 0) {
      const amount = Number(loan.principal_amount);
      await createJournal(
        {
          sourceTable: 'app_loans',
          sourceId: loan.id,
          date: new Date(Number(loan.release_date) || Date.now()).toISOString(),
          description: `Loan Disbursement - ${loan.loan_number || loan.id}`
        },
        [
          { accountCode: ACCT.LOAN_RECEIVABLE, accountName: 'Loans Receivable', debit: amount, credit: 0 },
          { accountCode: ACCT.CASH_ON_HAND, accountName: 'Cash on Hand', debit: 0, credit: amount }
        ]
      );
    }
  }

  // B. Backfill Loan Payments
  for (const p of payments || []) {
    if (!existingSourceMap.has(`app_payments:${p.id}`) && Number(p.amount || 0) > 0) {
      const amount = Number(p.amount);
      const principalPart = Number(p.principal_amount || amount * 0.8);
      const interestPart = Number(p.interest_amount || amount * 0.2);

      await createJournal(
        {
          sourceTable: 'app_payments',
          sourceId: p.id,
          date: new Date(Number(p.payment_date) || Date.now()).toISOString(),
          description: `Loan Repayment Receipt - OR #${p.or_number || p.id}`
        },
        [
          { accountCode: ACCT.CASH_ON_HAND, accountName: 'Cash on Hand', debit: amount, credit: 0 },
          { accountCode: ACCT.LOAN_RECEIVABLE, accountName: 'Loans Receivable', debit: 0, credit: principalPart },
          { accountCode: ACCT.INTEREST_INCOME, accountName: 'Interest Income from Loans', debit: 0, credit: interestPart }
        ]
      );
    }
  }

  // C. Backfill Expenses
  for (const e of expenses || []) {
    if (!existingSourceMap.has(`app_expenses:${e.id}`) && Number(e.amount || 0) > 0) {
      const amount = Number(e.amount);
      await createJournal(
        {
          sourceTable: 'app_expenses',
          sourceId: e.id,
          date: new Date(Number(e.expense_date) || Date.now()).toISOString(),
          description: `Expense Payment - ${e.particulars || e.category || 'Operating Expense'}`
        },
        [
          { accountCode: ACCT.OPERATING_EXPENSES, accountName: e.category || 'Administrative Expenses', debit: amount, credit: 0 },
          { accountCode: ACCT.CASH_ON_HAND, accountName: 'Cash on Hand', debit: 0, credit: amount }
        ]
      );
    }
  }

  // D. Backfill Savings Transactions
  for (const s of savings || []) {
    if (!existingSourceMap.has(`app_savings_transactions:${s.id}`) && Number(s.amount || 0) > 0) {
      const amount = Number(s.amount);
      const isDeposit = (s.type || '').toLowerCase() === 'deposit';

      await createJournal(
        {
          sourceTable: 'app_savings_transactions',
          sourceId: s.id,
          date: new Date(Number(s.transaction_date) || Date.now()).toISOString(),
          description: `Member Savings ${isDeposit ? 'Deposit' : 'Withdrawal'}`
        },
        isDeposit
          ? [
              { accountCode: ACCT.CASH_ON_HAND, accountName: 'Cash on Hand', debit: amount, credit: 0 },
              { accountCode: ACCT.SAVINGS_DEPOSIT, accountName: 'Savings Deposits', debit: 0, credit: amount }
            ]
          : [
              { accountCode: ACCT.SAVINGS_DEPOSIT, accountName: 'Savings Deposits', debit: amount, credit: 0 },
              { accountCode: ACCT.CASH_ON_HAND, accountName: 'Cash on Hand', debit: 0, credit: amount }
            ]
      );
    }
  }

  // E. Backfill Share Capital / CBU Transactions
  for (const sc of shareCap || []) {
    if (!existingSourceMap.has(`app_share_capital_transactions:${sc.id}`) && Number(sc.amount || 0) > 0) {
      const amount = Number(sc.amount);
      const isContribution = (sc.transaction_type || '').toLowerCase().includes('contribution') || (sc.transaction_type || '').toLowerCase().includes('deposit') || (sc.transaction_type || '').toLowerCase() === 'cbu';

      await createJournal(
        {
          sourceTable: 'app_share_capital_transactions',
          sourceId: sc.id,
          date: new Date(Number(sc.transaction_date) || Date.now()).toISOString(),
          description: `Member CBU Share Capital ${isContribution ? 'Contribution' : 'Withdrawal'}`
        },
        isContribution
          ? [
              { accountCode: ACCT.CASH_ON_HAND, accountName: 'Cash on Hand', debit: amount, credit: 0 },
              { accountCode: ACCT.SHARE_CAPITAL, accountName: 'Share Capital Common', debit: 0, credit: amount }
            ]
          : [
              { accountCode: ACCT.SHARE_CAPITAL, accountName: 'Share Capital Common', debit: amount, credit: 0 },
              { accountCode: ACCT.CASH_ON_HAND, accountName: 'Cash on Hand', debit: 0, credit: amount }
            ]
      );
    }
  }

  // F. Backfill Bank Transactions
  for (const bt of bankTxns || []) {
    if (!existingSourceMap.has(`app_bank_transactions:${bt.id}`) && Number(bt.amount || 0) > 0) {
      const amount = Number(bt.amount);
      const isDeposit = (bt.type || '').toLowerCase() === 'deposit';

      await createJournal(
        {
          sourceTable: 'app_bank_transactions',
          sourceId: bt.id,
          date: new Date(Number(bt.transaction_date) || Date.now()).toISOString(),
          description: `Bank ${isDeposit ? 'Deposit' : 'Withdrawal'} - ${bt.particulars || bt.id}`
        },
        isDeposit
          ? [
              { accountCode: ACCT.CASH_IN_BANK, accountName: 'Cash in Bank', debit: amount, credit: 0 },
              { accountCode: ACCT.CASH_ON_HAND, accountName: 'Cash on Hand', debit: 0, credit: amount }
            ]
          : [
              { accountCode: ACCT.CASH_ON_HAND, accountName: 'Cash on Hand', debit: amount, credit: 0 },
              { accountCode: ACCT.CASH_IN_BANK, accountName: 'Cash in Bank', debit: 0, credit: amount }
            ]
      );
    }
  }

  console.log('\n========================================================================');
  console.log('              ACCOUNTING BACKFILL & PARITY SUMMARY');
  console.log('========================================================================');
  console.log(`New Journal Entries Created:           ${createdJournalsCount}`);
  console.log(`New Journal Lines Created:              ${createdLinesCount}`);
  console.log('========================================================================\n');
}

auditAndBackfillAccounting().catch(console.error);
