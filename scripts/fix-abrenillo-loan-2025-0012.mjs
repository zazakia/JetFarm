import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fixAbrenilloLoans() {
  console.log('========================================================================');
  console.log('         FIXING EDMONDO C. ABRENILLO LOAN 2025-0012 IN PROD DB');
  console.log('========================================================================\n');

  // Borrower: EDMONDO C. ABRENILLO
  const borrowerId = 'a81636fb-3945-4fbb-916e-9619babd0e64';

  // Check existing loans for Edmondo C. Abrenillo
  const { data: existingLoans, error: lErr } = await supabase
    .from('app_loans')
    .select('*')
    .eq('borrower_id', borrowerId)
    .is('deleted_at', null);

  if (lErr) throw lErr;

  console.log('Current Active Loans for EDMONDO C. ABRENILLO in DB:');
  console.table(existingLoans.map(l => ({
    id: l.id,
    loan_number: l.loan_number,
    principal_amount: l.principal_amount,
    total_amount: l.total_amount,
    status: l.status
  })));

  // Check if 2025-0012 already exists
  const has2025_0012 = existingLoans.some(l => l.loan_number && l.loan_number.includes('2025-0012') || (l.principal_amount === 3000 && l.total_amount === 3420));

  if (!has2025_0012) {
    console.log('\n➕ Inserting missing Loan 2025-0012 (Principal: ₱3,000.00, Total: ₱3,420.00)...');
    const newLoanId = crypto.randomUUID();
    const { data: insertedLoan, error: iErr } = await supabase
      .from('app_loans')
      .insert({
        id: newLoanId,
        borrower_id: borrowerId,
        loan_number: 'LN-ONDL-OnDL2025-2025-0012',
        loan_type: 'on_demand',
        principal_amount: 3000,
        total_amount: 3420,
        installment_amount: 3420,
        frequency: 'one_time',
        term: 12,
        term_unit: 'months',
        interest_rate: 0,
        status: 'UNPAID',
        release_date: '2022-12-02T00:00:00+00:00',
        maturity_date: '2023-02-02T00:00:00+00:00',
        notes: 'Restored from Excel onDLLoaner2026 (OnDL2025 - 2025-0012)',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (iErr) {
      console.error('❌ Error inserting loan 2025-0012:', iErr);
    } else {
      console.log('✅ Successfully inserted Loan 2025-0012:', insertedLoan.id);
    }
  } else {
    console.log('ℹ️ Loan 2025-0012 already exists.');
  }

  // Fetch updated loans
  const { data: updatedLoans } = await supabase
    .from('app_loans')
    .select('*')
    .eq('borrower_id', borrowerId)
    .is('deleted_at', null);

  console.log('\nUpdated Active Loans for EDMONDO C. ABRENILLO in DB:');
  console.table(updatedLoans.map(l => ({
    id: l.id,
    loan_number: l.loan_number,
    principal_amount: l.principal_amount,
    total_amount: l.total_amount,
    status: l.status,
    release_date: l.release_date,
    maturity_date: l.maturity_date
  })));
}

fixAbrenilloLoans().catch(console.error);
