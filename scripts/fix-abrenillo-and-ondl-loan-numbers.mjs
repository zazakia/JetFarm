import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function repairAbrenilloAndOndlLoans() {
  console.log('========================================================================');
  console.log('  REPAIRING EDMONDO C. ABRENILLO & ON-DL LOAN DATA IN PRODUCTION');
  console.log('========================================================================\n');

  // 1. Get Edmondo C. Abrenillo borrower profile
  const { data: borrowers } = await supabase
    .from('app_borrowers')
    .select('*')
    .ilike('full_name', '%EDMONDO%ABRENILLO%')
    .is('deleted_at', null);

  if (!borrowers || borrowers.length === 0) {
    console.error('Borrower EDMONDO C. ABRENILLO not found!');
    return;
  }

  const borrower = borrowers[0];
  console.log(`Found Borrower: ${borrower.full_name} (${borrower.id})`);

  // 2. Fetch all loans for this borrower (including deleted)
  const { data: loans } = await supabase
    .from('app_loans')
    .select('*')
    .eq('borrower_id', borrower.id);

  console.log(`Found ${loans.length} loans for ${borrower.full_name}:\n`, loans);

  // Loan 1 (2025-0012): Should be Principal 3,000 | Total 3,420 | Date: 2022-12-02
  // Loan 2 (2025-0013): Should be Principal 6,360 | Total 7,250.40 | Date: 2023-03-10

  const loan12 = loans.find(l => l.loan_number.includes('2026') || l.id === '76d2f606-7899-451b-9ab3-165a24f930fe');
  const loan13 = loans.find(l => l.loan_number.includes('2025') || l.id === '8012597f-ea58-4782-9ee7-b6ee441c2c6b');

  if (loan12) {
    console.log(`\nRepairing Loan 2025-0012 (ID: ${loan12.id})...`);
    const { error: err12 } = await supabase
      .from('app_loans')
      .update({
        loan_number: 'LN-ONDL-2025-0012',
        principal_amount: 3000,
        total_amount: 3420,
        installment_amount: 3420,
        release_date: '2022-12-02T00:00:00.000Z',
        maturity_date: '2023-02-02T00:00:00.000Z',
        status: 'UNPAID',
        deleted_at: null, // UN-DELETE
        notes: 'Imported from Excel onDLLoaner2026 (OnDL2025 - 2025-0012)',
        updated_at: new Date().toISOString()
      })
      .eq('id', loan12.id);

    if (err12) console.error('Error repairing loan 2025-0012:', err12.message);
    else console.log('✅ REPAIRED Loan 2025-0012: LN-ONDL-2025-0012 | Principal: ₱3,000.00 | Total: ₱3,420.00 | Status: UNPAID');
  }

  if (loan13) {
    console.log(`\nRepairing Loan 2025-0013 (ID: ${loan13.id})...`);
    const { error: err13 } = await supabase
      .from('app_loans')
      .update({
        loan_number: 'LN-ONDL-2025-0013',
        principal_amount: 6360,
        total_amount: 7250.40,
        installment_amount: 7250.40,
        release_date: '2023-03-10T00:00:00.000Z',
        maturity_date: '2023-05-10T00:00:00.000Z',
        status: 'UNPAID',
        deleted_at: null,
        notes: 'Imported from Excel onDLLoaner2026 (OnDL2025 - 2025-0013)',
        updated_at: new Date().toISOString()
      })
      .eq('id', loan13.id);

    if (err13) console.error('Error repairing loan 2025-0013:', err13.message);
    else console.log('✅ REPAIRED Loan 2025-0013: LN-ONDL-2025-0013 | Principal: ₱6,360.00 | Total: ₱7,250.40 | Status: UNPAID');
  }

  // Also clean up redundant ON-DL prefixes across all ON-DL loans if any exist
  const { data: allOndlLoans } = await supabase
    .from('app_loans')
    .select('id, loan_number')
    .like('loan_number', 'LN-ONDL-OnDL%');

  if (allOndlLoans && allOndlLoans.length > 0) {
    console.log(`\nCleaned up ${allOndlLoans.length} ugly loan number prefixes:`);
    for (const l of allOndlLoans) {
      // e.g. LN-ONDL-OnDL2025-2025-0013 -> LN-ONDL-2025-0013
      const cleanNo = l.loan_number.replace(/LN-ONDL-OnDL\d{4}-/, 'LN-ONDL-');
      await supabase.from('app_loans').update({ loan_number: cleanNo }).eq('id', l.id);
      console.log(`  ${l.loan_number} -> ${cleanNo}`);
    }
  }

  console.log('\n========================================================================');
  console.log('                       REPAIR COMPLETE');
  console.log('========================================================================\n');
}

repairAbrenilloAndOndlLoans().catch(console.error);
