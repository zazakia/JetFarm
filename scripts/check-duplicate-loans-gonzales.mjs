import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkGonzalesAndDuplicates() {
  console.log('Searching for borrowers matching "gonzal"...');
  const { data: borrowers, error: bErr } = await supabase
    .from('app_borrowers')
    .select('id, full_name, membership_number, deleted_at')
    .ilike('full_name', '%gonzal%');
  
  if (bErr) console.error('Error fetching borrowers:', bErr);
  console.log('Borrowers found:', borrowers);

  const borrowerIds = (borrowers || []).map(b => b.id);
  
  if (borrowerIds.length > 0) {
    const { data: loans, error: lErr } = await supabase
      .from('app_loans')
      .select('*')
      .in('borrower_id', borrowerIds);
    if (lErr) console.error('Error fetching loans:', lErr);
    console.log('Loans found for gonzal borrowers:', loans);
  }

  // Check overall duplicate loans
  console.log('\nChecking all active loans for potential duplicate loan_numbers or duplicate borrower active loans...');
  const { data: allLoans } = await supabase
    .from('app_loans')
    .select('id, loan_number, borrower_id, principal_amount, total_amount, status, created_at, deleted_at')
    .is('deleted_at', null);

  const loanNumMap = new Map();
  for (const l of (allLoans || [])) {
    const key = l.loan_number;
    if (!loanNumMap.has(key)) loanNumMap.set(key, []);
    loanNumMap.get(key).push(l);
  }

  console.log('\nDuplicate loan_numbers (same loan_number across multiple records):');
  let dupCount = 0;
  for (const [key, group] of loanNumMap.entries()) {
    if (group.length > 1) {
      dupCount++;
      console.log(`Duplicate Loan Number [${key}]: ${group.length} records`);
      console.log(group);
    }
  }
  if (dupCount === 0) console.log('No exact duplicate loan numbers found.');

  // Check for similar loans (same borrower, same principal, created around same time)
  const borrowerLoanMap = new Map();
  for (const l of (allLoans || [])) {
    const key = `${l.borrower_id}_${l.principal_amount}_${l.status}`;
    if (!borrowerLoanMap.has(key)) borrowerLoanMap.set(key, []);
    borrowerLoanMap.get(key).push(l);
  }

  console.log('\nPotential duplicate loans (same borrower, principal, status):');
  for (const [key, group] of borrowerLoanMap.entries()) {
    if (group.length > 1) {
      console.log(`Potential Dup Group [${key}]: ${group.length} loans`);
      for (const l of group) {
        console.log(`  ID: ${l.id} | Loan#: ${l.loan_number} | Created: ${l.created_at}`);
      }
    }
  }
}

checkGonzalesAndDuplicates().catch(console.error);
