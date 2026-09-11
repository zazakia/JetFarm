const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verifyDbBalances() {
  const workbook = xlsx.readFile('DCM-as-of-march-21.xlsx');
  const sheet = workbook.Sheets["DATA of Clients"];
  const rawData = xlsx.utils.sheet_to_json(sheet, { range: 11, defval: null });
  
  // Fetch all loans and payments to verify total paid
  const { data: allLoans, error: loansError } = await supabase.from('app_loans').select('id, loan_number, principal_amount, interest_rate, deducted_amount');
  if (loansError) throw loansError;
  
  // Paginate payments fetch to get all
  let allPayments = [];
  let page = 0;
  let hasMore = true;
  while (hasMore) {
     const { data, error } = await supabase.from('app_payments').select('loan_id, amount').range(page * 1000, (page+1)*1000 - 1);
     if (error) throw error;
     if (data && data.length > 0) {
        allPayments = allPayments.concat(data);
        if (data.length < 1000) hasMore = false;
        else page++;
     } else {
        hasMore = false;
     }
  }

  const paymentSums = {};
  for (const p of allPayments) {
     if (!paymentSums[p.loan_id]) paymentSums[p.loan_id] = 0;
     paymentSums[p.loan_id] += (parseFloat(p.amount) || 0);
  }

  const loanMap = {};
  for (const l of allLoans) {
     loanMap[l.loan_number] = l;
  }
  
  let mismatches = 0;
  let matches = 0;
  let count = 0;

  for (const row of rawData) {
    count++;
    if (!row['Name Of Client']) continue;

    const excelName = row['Name Of Client'].toString().trim();
    const excelBalance = parseFloat(row['Total Loan Balance']) || 0;
    
    const loanNumber = `LN-DAILY-${count.toString().padStart(4, '0')}`;
    const dbLoan = loanMap[loanNumber];
    
    if (dbLoan) {
        // According to extraction logic: principal + interest is the total loan
        // Wait, interest_rate in migrate_excel.js evaluated to a percentage. 
        // We know exactly what was inserted. But let's look at the database.
        // migrate_excel.js: total_amount = totalPayment (from excel column)
        const principal = parseFloat(row['Loan Amount']) || 0;
        const interestStr = parseFloat(row['Interest']) || 0;
        const totalLoan = principal + interestStr;
        
        const sumPaid = paymentSums[dbLoan.id] || 0;
        const dbComputedBalance = totalLoan - sumPaid;
        
        if (Math.abs(dbComputedBalance - excelBalance) > 2) {
            mismatches++;
            if (mismatches < 10) {
               console.log(`DB Mismatch for ${excelName} (${loanNumber}): Excel says ${excelBalance.toFixed(2)}, DB Computed ${dbComputedBalance.toFixed(2)} (Paid: ${sumPaid})`);
            }
        } else {
            matches++;
        }
    }
  }

  console.log(`\nDB vs EXCEL Verification:`);
  console.log(`${matches} loans matching perfectly or within 2 pesos in the DB!`);
  console.log(`${mismatches} loans have a mismatched balance based on DB records.`);
}

verifyDbBalances().catch(console.error);
