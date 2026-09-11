import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function parseExcelDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    // Excel serial date format
    const jsDate = new Date((val - (25567 + 2)) * 86400 * 1000);
    return jsDate.toISOString().split('T')[0];
  }
  return String(val);
}

function parseNumber(val) {
  if (val === undefined || val === null || val === '' || val === 'P') return 0;
  const num = Number(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : num;
}

async function verifyExcelVsProd() {
  console.log('========================================================================');
  console.log('   FULL AUDIT: EXCEL ON-DEMAND LOANS (2025 & 2026) VS PRODUCTION DB');
  console.log('========================================================================\n');

  const wb = xlsx.readFile('docs/ddd/onDLLoaner2026 (2).xlsx');

  const excelLoans = [];

  for (const sheetName of ['OnDL2025', 'OnDL2026']) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    // Header row is index 6 (Row 7 in Excel)
    for (let i = 7; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const dlNo = row[0] ? String(row[0]).trim() : '';
      const name = row[1] ? String(row[1]).trim() : '';

      // Ignore headers, totals, or empty rows
      if (!dlNo || dlNo.toUpperCase().includes('TOTAL') || dlNo.toUpperCase().includes('DL NO') || !name || name.toUpperCase().includes('TOTAL')) {
        continue;
      }

      // Identify numerical values in row
      // Row fields: DL No, Name, [empty], Loan Amount (or 'P' then amount), Date Released, Due Date, Due Amount, Interest, Penalty, Total, Payment Made, Total Amount to be Collected
      const nums = row.filter(cell => typeof cell === 'number' || (typeof cell === 'string' && /^\d+$/.test(cell.trim())));

      // Extract specific columns safely
      let loanAmount = 0;
      let dateReleased = null;
      let dueDate = null;
      let totalAmount = 0;
      let payments = 0;
      let balance = 0;

      // Find amounts in row
      let nonDateNums = [];
      for (const cell of row) {
        if (cell === null || cell === undefined || cell === '' || cell === 'P') continue;
        if (typeof cell === 'number' && cell > 40000 && cell < 50000) {
          if (!dateReleased) dateReleased = parseExcelDate(cell);
          else if (!dueDate) dueDate = parseExcelDate(cell);
        } else if (typeof cell === 'number' || (typeof cell === 'string' && cell.trim() !== '' && !isNaN(Number(cell.replace(/,/g, ''))))) {
          const val = typeof cell === 'number' ? cell : Number(cell.replace(/,/g, ''));
          nonDateNums.push(val);
        }
      }

      // In row, nonDateNums format typically: [LoanAmount, DueAmount, Interest, Penalty, Total, Payments, Balance]
      // Or similar. Let's capture name, dlNo, sheet, and raw row values
      const rawLoanAmt = row[4] && typeof row[4] === 'number' ? row[4] : (row[3] && typeof row[3] === 'number' ? row[3] : nonDateNums[0] || 0);
      const rawBalance = row[row.length - 1] && typeof row[row.length - 1] === 'number' ? row[row.length - 1] : nonDateNums[nonDateNums.length - 1] || 0;

      excelLoans.push({
        sheet: sheetName,
        dlNo,
        name,
        loanAmount: rawLoanAmt,
        dateReleased,
        dueDate,
        balance: rawBalance,
        rawRow: row
      });
    }
  }

  console.log(`Extracted ${excelLoans.length} loans from Excel file.\n`);

  // Fetch production borrowers & loans
  const { data: prodBorrowers, error: bErr } = await supabase
    .from('app_borrowers')
    .select('*')
    .is('deleted_at', null);
  if (bErr) throw bErr;

  const { data: prodLoans, error: lErr } = await supabase
    .from('app_loans')
    .select('*')
    .is('deleted_at', null);
  if (lErr) throw lErr;

  console.log(`Production DB Totals: ${prodBorrowers.length} borrowers, ${prodLoans.length} loans.\n`);

  const activeProdLoans = prodLoans.filter(l => {
    const s = (l.status || '').toLowerCase();
    return s === 'active' || s === 'unpaid' || s === 'partial' || s === 'defaulted';
  });

  console.log(`Production Active Loans (active/unpaid/partial/defaulted): ${activeProdLoans.length}\n`);

  // Map borrowers by normalized name
  const borrowerByName = new Map();
  for (const b of prodBorrowers) {
    if (b.full_name) {
      const clean = b.full_name.trim().toLowerCase().replace(/[^a-z ]/g, '');
      borrowerByName.set(clean, b);
    }
  }

  // Audit each Excel loan against DB
  const comparisonResults = [];
  let matchedCount = 0;
  let missingBorrowerCount = 0;
  let missingLoanCount = 0;
  let totalExcelActiveBalance = 0;

  for (const ex of excelLoans) {
    totalExcelActiveBalance += ex.balance;

    const cleanExName = ex.name.trim().toLowerCase().replace(/[^a-z ]/g, '');
    let matchedBorrower = borrowerByName.get(cleanExName);

    if (!matchedBorrower) {
      // Fuzzy search by first + last name
      const parts = cleanExName.split(' ');
      const firstName = parts[0];
      const lastName = parts[parts.length - 1];

      for (const [bName, bObj] of borrowerByName.entries()) {
        if (bName.includes(firstName) && bName.includes(lastName)) {
          matchedBorrower = bObj;
          break;
        }
      }
    }

    if (!matchedBorrower) {
      missingBorrowerCount++;
      comparisonResults.push({
        Sheet: ex.sheet,
        DL_No: ex.dlNo,
        Excel_Name: ex.name,
        Excel_LoanAmt: ex.loanAmount,
        Excel_Balance: ex.balance,
        DB_Borrower: '❌ NOT FOUND IN DB',
        DB_Loan_Count: 0,
        DB_Active_Loan_Bal: 'N/A',
        Status: '❌ MISSING BORROWER'
      });
      continue;
    }

    // Find loans for this borrower in production
    const borrowerLoans = prodLoans.filter(l => l.borrower_id === matchedBorrower.id);
    const activeBorrowerLoans = borrowerLoans.filter(l => {
      const s = (l.status || '').toLowerCase();
      return s === 'active' || s === 'unpaid' || s === 'partial' || s === 'defaulted';
    });

    const activeBalSum = activeBorrowerLoans.reduce((s, l) => s + Number(l.total_amount || l.principal_amount || 0), 0);

    let status = '❌ NO ACTIVE LOAN IN DB';
    if (activeBorrowerLoans.length > 0) {
      matchedCount++;
      const diff = Math.abs(activeBalSum - ex.balance);
      if (diff < 1.0) {
        status = '✅ MATCH (Active Loan & Balance)';
      } else {
        status = `⚠️ ACTIVE LOAN FOUND (DB Bal: PHP ${activeBalSum.toFixed(2)}, Excel: PHP ${ex.balance.toFixed(2)})`;
      }
    } else {
      missingLoanCount++;
    }

    comparisonResults.push({
      Sheet: ex.sheet,
      DL_No: ex.dlNo,
      Excel_Name: ex.name,
      Excel_LoanAmt: ex.loanAmount,
      Excel_Balance: ex.balance,
      DB_Borrower: matchedBorrower.full_name,
      DB_Loan_Count: borrowerLoans.length,
      DB_Active_Loan_Bal: activeBalSum.toFixed(2),
      Status: status
    });
  }

  console.table(comparisonResults);

  console.log('\n========================================================================');
  console.log('                      EXCEL VS PROD DB SUMMARY');
  console.log('========================================================================');
  console.log(`Total Excel Loans Inspected:           ${excelLoans.length}`);
  console.log(`Total Excel Balance to Collect:        PHP ${totalExcelActiveBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`Excel Borrowers Matched with DB:       ${excelLoans.length - missingBorrowerCount}`);
  console.log(`Active Loans Matched in DB:            ${matchedCount}`);
  console.log(`Borrowers Missing in DB:               ${missingBorrowerCount}`);
  console.log(`Borrowers in DB without Active Loan:   ${missingLoanCount}`);
  console.log('========================================================================\n');
}

verifyExcelVsProd().catch(console.error);
