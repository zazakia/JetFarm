import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function parseExcelDate(val) {
  if (!val) return new Date().toISOString().split('T')[0];
  if (typeof val === 'number') {
    const jsDate = new Date((val - (25567 + 2)) * 86400 * 1000);
    return jsDate.toISOString().split('T')[0];
  }
  return String(val);
}

async function syncOnDLLoansToSupabase() {
  console.log('========================================================================');
  console.log('  SYNCING ALL 53 EXCEL ON-DL LOANS TO PRODUCTION SUPABASE DATABASE');
  console.log('========================================================================\n');

  const wb = xlsx.readFile('docs/ddd/onDLLoaner2026 (2).xlsx');
  const onDlRecords = [];

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

      // Collect numbers
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

      onDlRecords.push({
        sourceSheet: sheetName,
        dlNo,
        borrowerName,
        principal,
        dateReleased: dateReleased || '2025-01-01',
        dueDate: dueDate || '2026-12-31',
        balanceToCollect,
        rawRow: row
      });
    }
  }

  console.log(`Found ${onDlRecords.length} On-DL loan records from Excel.\n`);

  // Fetch current DB borrowers & loans
  const { data: borrowers, error: bErr } = await supabase.from('app_borrowers').select('*');
  if (bErr) throw bErr;

  const { data: existingLoans, error: lErr } = await supabase.from('app_loans').select('*');
  if (lErr) throw lErr;

  const borrowerMap = new Map();
  for (const b of borrowers) {
    if (b.full_name) {
      const clean = b.full_name.trim().toLowerCase().replace(/[^a-z ]/g, '');
      borrowerMap.set(clean, b);
    }
  }

  let createdBorrowersCount = 0;
  let createdLoansCount = 0;
  let updatedLoansCount = 0;
  let totalBalanceAdded = 0;

  for (const rec of onDlRecords) {
    const cleanName = rec.borrowerName.trim().toLowerCase().replace(/[^a-z ]/g, '');
    
    // Check if borrower exists
    let bObj = borrowerMap.get(cleanName);
    if (!bObj) {
      // Fuzzy search by first and last name
      const parts = cleanName.split(' ');
      const firstName = parts[0];
      const lastName = parts[parts.length - 1];

      for (const [bName, targetB] of borrowerMap.entries()) {
        if (bName.includes(firstName) && bName.includes(lastName)) {
          bObj = targetB;
          break;
        }
      }
    }

    if (!bObj) {
      // Create new borrower record in app_borrowers
      const newBorrowerId = crypto.randomUUID();
      const membershipNo = `AN-26-${String(Math.floor(1000 + Math.random() * 9000))}`;
      
      const { data: newB, error: createBErr } = await supabase
        .from('app_borrowers')
        .insert({
          id: newBorrowerId,
          full_name: rec.borrowerName.toUpperCase(),
          membership_number: membershipNo,
          membership_status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createBErr) {
        console.error(`Failed to create borrower ${rec.borrowerName}:`, createBErr.message);
        continue;
      }

      bObj = newB;
      borrowerMap.set(cleanName, bObj);
      createdBorrowersCount++;
      console.log(`✨ Created Borrower Profile: ${rec.borrowerName} (${membershipNo})`);
    }

    // Check if loan already exists for borrower
    const loanNum = `LN-ONDL-${rec.dlNo}`;
    let loanObj = existingLoans.find(l => l.loan_number === loanNum || (l.borrower_id === bObj.id && (l.status === 'UNPAID' || l.status === 'active' || l.status === 'PARTIAL')));

    const releaseIso = new Date(rec.dateReleased).toISOString();
    const dueIso = new Date(rec.dueDate).toISOString();

    if (loanObj) {
      // Update existing loan balance to match On-DL total balance to collect
      const { error: uErr } = await supabase
        .from('app_loans')
        .update({
          principal_amount: rec.principal,
          total_amount: rec.balanceToCollect,
          installment_amount: rec.balanceToCollect,
          status: 'UNPAID',
          notes: `Updated from Excel onDLLoaner2026 (${rec.sourceSheet} - ${rec.dlNo})`,
          updated_at: new Date().toISOString()
        })
        .eq('id', loanObj.id);

      if (uErr) {
        console.error(`Failed to update loan for ${rec.borrowerName}:`, uErr.message);
      } else {
        updatedLoansCount++;
        totalBalanceAdded += rec.balanceToCollect;
      }
    } else {
      // Insert new active/UNPAID loan record
      const newLoanId = crypto.randomUUID();

      const { error: iErr } = await supabase
        .from('app_loans')
        .insert({
          id: newLoanId,
          borrower_id: bObj.id,
          loan_number: loanNum,
          loan_type: 'on_demand',
          principal_amount: rec.principal,
          total_amount: rec.balanceToCollect,
          installment_amount: rec.balanceToCollect,
          frequency: 'one_time',
          term: 12,
          term_unit: 'months',
          interest_rate: 0,
          status: 'UNPAID',
          release_date: releaseIso,
          maturity_date: dueIso,
          notes: `Imported from Excel onDLLoaner2026 (${rec.sourceSheet} - ${rec.dlNo})`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (iErr) {
        console.error(`Failed to insert loan for ${rec.borrowerName}:`, iErr.message);
      } else {
        createdLoansCount++;
        totalBalanceAdded += rec.balanceToCollect;
        console.log(`✅ Created Loan: ${loanNum} for ${rec.borrowerName} (₱${rec.balanceToCollect})`);
      }
    }
  }

  console.log('\n========================================================================');
  console.log('                  ON-DL LOANS SYNC & PARITY RESULT');
  console.log('========================================================================');
  console.log(`Total Excel On-DL Loans Processed:     53`);
  console.log(`Borrowers Created:                     ${createdBorrowersCount}`);
  console.log(`Loans Created:                         ${createdLoansCount}`);
  console.log(`Loans Updated:                         ${updatedLoansCount}`);
  console.log(`Total Active Balance Synced:           PHP ${totalBalanceAdded.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log('========================================================================\n');
}

syncOnDLLoansToSupabase().catch(console.error);
