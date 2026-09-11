const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fixNetLoanReleased() {
  console.log("Reading migration report...");
  const reportPath = './data/migration_net_loan_report.json';
  if (!fs.existsSync(reportPath)) {
    console.error(`Report not found at ${reportPath}`);
    return;
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const mismatches = report.mismatches || [];

  console.log(`Found ${mismatches.length} mismatches to fix.`);

  let successCount = 0;
  let errorCount = 0;

  for (const item of mismatches) {
    const { loanId, expectedDeducted, borrower } = item;
    
    console.log(`Updating Loan ${loanId} for ${borrower}: Setting deducted_amount to ${expectedDeducted}`);
    
    const { error } = await supabase
      .from('app_loans')
      .update({ deducted_amount: expectedDeducted })
      .eq('id', loanId);

    if (error) {
      console.error(`Error updating loan ${loanId}: ${error.message}`);
      errorCount++;
    } else {
      successCount++;
    }
  }

  console.log("\nUpdate Summary:");
  console.log(`Total Mismatches: ${mismatches.length}`);
  console.log(`Successfully Updated: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
}

fixNetLoanReleased().catch(err => {
  console.error(err);
  process.exit(1);
});
