import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function parseExcelDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const jsDate = new Date((val - (25567 + 2)) * 86400 * 1000);
    return jsDate.toISOString().split('T')[0];
  }
  return String(val);
}

async function verifyAllOnDLLoans() {
  const wb = xlsx.readFile('docs/ddd/onDLLoaner2026 (2).xlsx');

  const excelRows = [];

  for (const sName of ['OnDL2025', 'OnDL2026']) {
    const ws = wb.Sheets[sName];
    if (!ws) continue;
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });

    for (let i = 7; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[1] || typeof row[1] !== 'string') continue;
      const dlNo = String(row[0] || '').trim();
      const name = String(row[1] || '').trim();
      if (!dlNo || dlNo.toUpperCase().includes('TOTAL') || dlNo.toUpperCase().includes('DL NO') || !name || name.toUpperCase().includes('TOTAL')) continue;

      let dateReleased = null;
      let dueDate = null;
      const nums = [];

      for (const cell of row) {
        if (cell === null || cell === undefined || cell === '' || cell === 'P') continue;
        if (typeof cell === 'number' && cell > 40000 && cell < 50000) {
          if (!dateReleased) dateReleased = parseExcelDate(cell);
          else if (!dueDate) dueDate = parseExcelDate(cell);
        } else if (typeof cell === 'number' || (typeof cell === 'string' && !isNaN(Number(cell.replace(/,/g, ''))))) {
          nums.push(typeof cell === 'number' ? cell : Number(cell.replace(/,/g, '')));
        }
      }

      const principal = nums[0] || 0;
      const balanceToCollect = nums[nums.length - 1] || principal;

      excelRows.push({
        sheet: sName,
        dlNo,
        name,
        principal,
        dateReleased,
        dueDate,
        balanceToCollect
      });
    }
  }

  console.log(`Total Excel Rows Extracted: ${excelRows.length}\n`);

  console.log('=== EXCEL LOANS LIST ===');
  console.table(excelRows);

  const { data: dbBorrowers } = await supabase.from('app_borrowers').select('*').is('deleted_at', null);
  const { data: dbLoans } = await supabase.from('app_loans').select('*').is('deleted_at', null);

  console.log('\n=== MATCHING EXCEL LOANS TO DB LOANS ===');
  const auditResult = [];

  for (const ex of excelRows) {
    const cleanExName = ex.name.trim().toLowerCase().replace(/[^a-z ]/g, '');
    const matchedB = dbBorrowers.find(b => {
      const cleanDbName = (b.full_name || '').toLowerCase().replace(/[^a-z ]/g, '');
      return cleanDbName === cleanExName || (cleanDbName.includes(cleanExName.split(' ')[0]) && cleanDbName.includes(cleanExName.split(' ').pop()));
    });

    if (!matchedB) {
      auditResult.push({
        Excel_Sheet: ex.sheet,
        DL_No: ex.dlNo,
        Excel_Name: ex.name,
        Excel_Principal: ex.principal,
        Excel_Total: ex.balanceToCollect,
        DB_Borrower: '❌ NOT FOUND',
        DB_Loan_No: 'N/A',
        DB_Total: 'N/A',
        Status: '❌ MISSING BORROWER'
      });
      continue;
    }

    const bLoans = dbLoans.filter(l => l.borrower_id === matchedB.id);

    // Look for exact match by loan_number or principal/total
    const exactLoan = bLoans.find(l => (l.loan_number && l.loan_number.includes(ex.dlNo)) || (Math.abs(l.principal_amount - ex.principal) < 1 && Math.abs(l.total_amount - ex.balanceToCollect) < 1));

    if (exactLoan) {
      auditResult.push({
        Excel_Sheet: ex.sheet,
        DL_No: ex.dlNo,
        Excel_Name: ex.name,
        Excel_Principal: ex.principal,
        Excel_Total: ex.balanceToCollect,
        DB_Borrower: matchedB.full_name,
        DB_Loan_No: exactLoan.loan_number,
        DB_Total: exactLoan.total_amount,
        Status: '✅ MATCH'
      });
    } else {
      auditResult.push({
        Excel_Sheet: ex.sheet,
        DL_No: ex.dlNo,
        Excel_Name: ex.name,
        Excel_Principal: ex.principal,
        Excel_Total: ex.balanceToCollect,
        DB_Borrower: matchedB.full_name,
        DB_Loan_No: bLoans.map(l => l.loan_number).join(', ') || 'NONE',
        DB_Total: bLoans.map(l => l.total_amount).join(', ') || '0',
        Status: '❌ LOAN NOT FOUND / MISMATCHED'
      });
    }
  }

  console.table(auditResult);
}

verifyAllOnDLLoans().catch(console.error);
