import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkAllMultipleLoans() {
  const wb = xlsx.readFile('docs/ddd/onDLLoaner2026 (2).xlsx');

  const excelLoans = [];

  for (const sheetName of ['OnDL2025', 'OnDL2026']) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });

    for (let i = 7; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[1] || typeof row[1] !== 'string') continue;

      const dlNo = String(row[0] || '').trim();
      const borrowerName = String(row[1] || '').trim();

      if (!dlNo || dlNo.toUpperCase().includes('TOTAL') || dlNo.toUpperCase().includes('DL NO') || !borrowerName || borrowerName.toUpperCase().includes('TOTAL')) {
        continue;
      }

      const nums = [];
      let dateReleased = null;
      let dueDate = null;

      for (const cell of row) {
        if (cell === null || cell === undefined || cell === '' || cell === 'P') continue;
        if (typeof cell === 'number' && cell > 40000 && cell < 50000) {
          if (!dateReleased) dateReleased = cell;
          else if (!dueDate) dueDate = cell;
        } else if (typeof cell === 'number' || (typeof cell === 'string' && !isNaN(Number(cell.replace(/,/g, ''))))) {
          nums.push(typeof cell === 'number' ? cell : Number(cell.replace(/,/g, '')));
        }
      }

      const principal = nums[0] || 0;
      const balanceToCollect = nums[nums.length - 1] || principal;

      excelLoans.push({
        sheet: sheetName,
        dlNo,
        borrowerName: borrowerName.trim(),
        principal,
        balanceToCollect
      });
    }
  }

  // Group Excel loans by borrower
  const excelByBorrower = {};
  for (const item of excelLoans) {
    const key = item.borrowerName.toUpperCase();
    if (!excelByBorrower[key]) excelByBorrower[key] = [];
    excelByBorrower[key].push(item);
  }

  console.log('========================================================================');
  console.log('         MULTIPLE LOANS ANALYSIS: EXCEL VS PRODUCTION DB');
  console.log('========================================================================\n');

  const summary = [];

  const { data: dbBorrowers } = await supabase.from('app_borrowers').select('*').is('deleted_at', null);
  const { data: dbLoans } = await supabase.from('app_loans').select('*').is('deleted_at', null);

  for (const [bName, loans] of Object.entries(excelByBorrower)) {
    const cleanExcelName = bName.toLowerCase().replace(/[^a-z ]/g, '');
    const matchedB = dbBorrowers.find(b => {
      const cleanDbName = (b.full_name || '').toLowerCase().replace(/[^a-z ]/g, '');
      return cleanDbName === cleanExcelName || (cleanDbName.includes(cleanExcelName.split(' ')[0]) && cleanDbName.includes(cleanExcelName.split(' ').pop()));
    });

    const bLoansInDb = matchedB ? dbLoans.filter(l => l.borrower_id === matchedB.id) : [];

    summary.push({
      Excel_Borrower: bName,
      Excel_Rows_Count: loans.length,
      Excel_DL_Numbers: loans.map(l => l.dlNo).join(', '),
      Excel_Total_Bal: loans.reduce((s, l) => s + l.balanceToCollect, 0),
      DB_Borrower: matchedB ? matchedB.full_name : '❌ NOT FOUND',
      DB_Loans_Count: bLoansInDb.length,
      DB_Loan_Numbers: bLoansInDb.map(l => l.loan_number).join(', '),
      DB_Total_Bal: bLoansInDb.reduce((s, l) => s + l.total_amount, 0),
      Is_Multiple_In_Excel: loans.length > 1 ? 'YES ⚠️' : 'NO',
      Status: loans.length > 1 && bLoansInDb.length < loans.length ? '❌ MISSING LOAN IN DB' : (Math.abs(loans.reduce((s, l) => s + l.balanceToCollect, 0) - bLoansInDb.reduce((s, l) => s + l.total_amount, 0)) < 1 ? '✅ MATCH' : '⚠️ MISMATCH')
    });
  }

  console.table(summary);
}

checkAllMultipleLoans().catch(console.error);
