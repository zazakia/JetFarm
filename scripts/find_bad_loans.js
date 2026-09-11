const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findBadLoans() {
  console.log("Analyzing loans in Supabase...");

  // 1. Fetch all loans
  const { data: loans, error: loanError } = await supabase
    .from('app_loans')
    .select('id, loan_number, borrower_id, created_at')
    .is('deleted_at', null);

  if (loanError) {
    console.error("Error fetching loans:", loanError);
    return;
  }

  console.log(`Checking ${loans.length} loans...`);

  // 2. Fetch all payment IDs (distinct loan_ids)
  const { data: pData, error: pError } = await supabase
    .from('app_payments')
    .select('loan_id')
    .is('deleted_at', null);
  
  if (pError) {
      console.error("Error fetching payments:", pError);
      return;
  }
  const loansWithPayments = new Set(pData.map(p => p.loan_id));

  // 3. Fetch all schedule IDs (distinct loan_ids)
  const { data: sData, error: sError } = await supabase
    .from('app_payment_schedules')
    .select('loan_id')
    .is('deleted_at', null);
  
  if (sError) {
      console.error("Error fetching schedules:", sError);
      return;
  }
  const loansWithSchedules = new Set(sData.map(s => s.loan_id));

  const badLoans = [];

  for (const loan of loans) {
    const isNoNumber = !loan.loan_number || loan.loan_number.trim() === '' || loan.loan_number === 'undefined';
    const hasPayments = loansWithPayments.has(loan.id);
    const hasSchedules = loansWithSchedules.has(loan.id);

    if (isNoNumber || (!hasPayments && !hasSchedules)) {
        badLoans.push({
            ...loan,
            hasPayments,
            hasSchedules,
            reason: isNoNumber ? "No Loan Number" : "No Payments & No Schedules"
        });
    }
  }

  if (badLoans.length === 0) {
    console.log("No bad loans found.");
  } else {
    console.log(`Found ${badLoans.length} bad loans:`);
    badLoans.forEach(l => {
      console.log(`- ID: ${l.id}, Number: [${l.loan_number}], Reason: ${l.reason}, Created: ${l.created_at}, HasPayments: ${l.hasPayments}, HasSchedules: ${l.hasSchedules}`);
    });
    
    // Summary of what would be deleted
    const idsToDelete = badLoans.map(l => l.id);
    console.log("\nIDs to remove:", JSON.stringify(idsToDelete));
  }
}

findBadLoans().catch(console.error);
