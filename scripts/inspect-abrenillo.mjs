import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkAbrenillo() {
  console.log('========================================================================');
  console.log('           EXCEL FILES SEARCH FOR "ABRENILLO"');
  console.log('========================================================================\n');
  const files = [
    'docs/ddd/onDLLoaner2026 (2).xlsx',
    'docs/onDLLoaner2026 (1).xlsx',
    'docs poscursor/2025-LOANERS.xlsx',
    'docs poscursor/2024-LOANERS.xlsx',
    'docs/SUMMARY.xlsx'
  ];

  for (const f of files) {
    try {
      const wb = xlsx.readFile(f);
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        rows.forEach((r, idx) => {
          const str = JSON.stringify(r);
          if (str && str.toLowerCase().includes('abrenillo')) {
            console.log(`[FILE]: ${f} | [SHEET]: ${sheetName} | [ROW ${idx + 1}]:`);
            console.log(r);
            console.log('---');
          }
        });
      }
    } catch (e) {
      console.log(`Error reading ${f}: ${e.message}`);
    }
  }

  console.log('\n========================================================================');
  console.log('        SUPABASE PRODUCTION DB SEARCH FOR "ABRENILLO"');
  console.log('========================================================================\n');

  const { data: borrowers, error: bErr } = await supabase
    .from('app_borrowers')
    .select('id, full_name, membership_number, address, membership_status, created_at')
    .ilike('full_name', '%abrenillo%');

  if (bErr) console.error('Error fetching borrowers:', bErr);
  console.log('Borrowers in DB:');
  console.table(borrowers);

  if (borrowers && borrowers.length > 0) {
    const borrowerIds = borrowers.map(b => b.id);
    const { data: loans, error: lErr } = await supabase
      .from('app_loans')
      .select('*')
      .in('borrower_id', borrowerIds)
      .is('deleted_at', null);

    if (lErr) console.error('Error fetching loans:', lErr);

    console.log('\nLoans in DB:');
    console.table(loans.map(l => ({
      id: l.id,
      loan_no: l.loan_no,
      borrower_id: l.borrower_id,
      principal_amount: l.principal_amount,
      total_amount: l.total_amount,
      balance_amount: l.balance_amount,
      status: l.status,
      date_released: l.date_released,
      due_date: l.due_date,
      created_at: l.created_at
    })));
  }
}

checkAbrenillo().catch(console.error);
