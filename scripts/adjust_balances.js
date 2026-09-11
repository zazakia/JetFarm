const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function applyAdjustments() {
  const workbook = xlsx.readFile('DCM-as-of-march-21.xlsx');
  const sheet = workbook.Sheets["DATA of Clients"];
  const rawData = xlsx.utils.sheet_to_json(sheet, { range: 11, defval: null });
  
  // Fetch all loans from Supabase to get their UUIDs based on loan_number maps
  const { data: allLoans, error: loansError } = await supabase.from('app_loans').select('id, loan_number, collector_id, release_date');
  if (loansError) throw loansError;

  const loanMap = {};
  for (const l of allLoans) {
     loanMap[l.loan_number] = l;
  }

  const dateHeaderPattern = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
  
  let count = 0;
  const paymentsToInsert = [];

  for (const row of rawData) {
    count++;
    if (!row['Name Of Client']) continue;

    const principal = parseFloat(row['Loan Amount']) || 0;
    const interest = parseFloat(row['Interest']) || 0;
    const excelBalance = parseFloat(row['Total Loan Balance']) || 0;

    let totalPayments = 0;
    for (const key of Object.keys(row)) {
        if (dateHeaderPattern.test(key)) {
            const val = parseFloat(row[key]);
            if (!isNaN(val) && val > 0) totalPayments += val;
        }
    }
    
    const computedBalance = (principal + interest) - totalPayments;
    const diff = computedBalance - excelBalance;

    // If diff > 2 pesos, we missed historical payments prior to this tracking period
    if (diff > 2) {
       const loanNumber = `LN-DAILY-${count.toString().padStart(4, '0')}`;
       const dbLoan = loanMap[loanNumber];
       
       if (dbLoan) {
           // Create a single bulk payment to capture all the missing historical payments.
           paymentsToInsert.push({
               id: crypto.randomUUID(),
               loan_id: dbLoan.id,
               amount: parseFloat(diff.toFixed(2)),
               payment_date: dbLoan.release_date || new Date('2024-01-01T00:00:00Z').toISOString(),
               collector_id: dbLoan.collector_id,
               created_at: new Date().toISOString(),
               updated_at: new Date().toISOString()
           });
       }
    }
  }

  console.log(`Found ${paymentsToInsert.length} adjusting carryover payments to insert.`);

  // Insert in chunks
  for (let i = 0; i < paymentsToInsert.length; i += 50) {
      const chunk = paymentsToInsert.slice(i, i + 50);
      const { error } = await supabase.from('app_payments').insert(chunk);
      if (error) {
          console.error("Payment insert error:", error);
          throw error;
      }
  }

  console.log("Adjustment Payments successfully inserted into Supabase!");
}

applyAdjustments().catch(console.error);
