import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT.supabase.co';
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

async function auditOnDLLoans() {
  console.log('========================================================================');
  console.log('       AUDITING EXCEL ON-DL LOANS VS PRODUCTION SUPABASE');
  console.log('========================================================================\n');

  const wb = xlsx.readFile('docs/onDLLoaner2026 (1).xlsx');
  const excelRecords = [];

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
          if (!dateReleased) dateReleased = parseExcelDate(cell);
          else if (!dueDate) dueDate = parseExcelDate(cell);
        } else if (typeof cell === 'number' || (typeof cell === 'string' && !isNaN(Number(cell.replace(/,/g, ''))))) {
          nums.push(typeof cell === 'number' ? cell : Number(cell.replace(/,/g, '')));
        }
      }

      const principal = nums[0] || 0;
      const balanceToCollect = nums[nums.length - 1] || principal;

      excelRecords.push({
        sourceSheet: sheetName,
        dlNo,
        borrowerName,
        principal,
        dateReleased,
        dueDate,
        balanceToCollect,
        rawRow: row
      });
    }
  }

  console.log(`Loaded ${excelRecords.length} records from Excel.`);

  const { data: borrowers } = await supabase.from('app_borrowers').select('id, full_name, membership_number').is('deleted_at', null);
  const { data: loans } = await supabase.from('app_loans').select('*'); // include soft-deleted for audit

  console.log(`Loaded ${borrowers.length} borrowers and ${loans.length} loans from DB.\n`);

  const borrowerMap = new Map();
  for (const b of borrowers) {
    if (b.full_name) {
      const clean = b.full_name.trim().toLowerCase().replace(/[^a-z ]/g, '');
      borrowerMap.set(clean, b);
    }
  }

  const issues = [];

  for (const rec of excelRecords) {
    const cleanName = rec.borrowerName.trim().toLowerCase().replace(/[^a-z ]/g, '');
    let bObj = borrowerMap.get(cleanName);
    if (!bObj) {
      const parts = cleanName.split(' ');
      const first = parts[0];
      const last = parts[parts.length - 1];
      for (const [bName, targetB] of borrowerMap.entries()) {
        if (bName.includes(first) && bName.includes(last)) {
          bObj = targetB;
          break;
        }
      }
    }

    if (!bObj) {
      issues.push({ type: 'MISSING_BORROWER', rec });
      continue;
    }

    // Find loan in DB for this borrower matching either dlNo or principal
    const bLoans = loans.filter(l => l.borrower_id === bObj.id);
    const matchingLoan = bLoans.find(l => 
      (l.loan_number && l.loan_number.includes(rec.dlNo)) ||
      (Math.abs(Number(l.principal_amount) - rec.principal) < 1 && l.deleted_at === null)
    );

    if (!matchingLoan) {
      issues.push({ type: 'MISSING_LOAN', rec, borrower: bObj.full_name, bLoans });
    } else {
      const isDeleted = matchingLoan.deleted_at !== null;
      const principalDiff = Math.abs(Number(matchingLoan.principal_amount) - rec.principal);
      const totalDiff = Math.abs(Number(matchingLoan.total_amount) - rec.balanceToCollect);

      if (isDeleted || principalDiff > 1 || totalDiff > 1) {
        issues.push({
          type: 'DISCREPANCY',
          rec,
          borrower: bObj.full_name,
          matchingLoan,
          isDeleted,
          principalDiff,
          totalDiff
        });
      }
    }
  }

  console.log('--- ON-DL DISCREPANCY AUDIT RESULTS ---');
  console.log(`Total Issues Found: ${issues.length}\n`);

  for (const issue of issues) {
    if (issue.type === 'MISSING_LOAN') {
      console.log(`❌ [MISSING LOAN] Sheet: ${issue.rec.sourceSheet} | DL#: ${issue.rec.dlNo} | Member: ${issue.rec.borrowerName} | Principal: ₱${issue.rec.principal} | Total: ₱${issue.rec.balanceToCollect}`);
    } else if (issue.type === 'DISCREPANCY') {
      console.log(`⚠️ [DISCREPANCY/DELETED] Sheet: ${issue.rec.sourceSheet} | DL#: ${issue.rec.dlNo} | Member: ${issue.rec.borrowerName} | Excel Principal: ₱${issue.rec.principal} | DB Principal: ₱${issue.matchingLoan.principal_amount} | DB Loan#: ${issue.matchingLoan.loan_number} | Deleted: ${issue.isDeleted}`);
    }
  }
}

auditOnDLLoans().catch(console.error);
