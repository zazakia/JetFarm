import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function parseExcelDate(val) {
  if (!val) return '2025-01-01';
  if (typeof val === 'number') {
    const jsDate = new Date((val - (25567 + 2)) * 86400 * 1000);
    return jsDate.toISOString().split('T')[0];
  }
  return String(val);
}

async function reconcileOnDLFinal() {
  console.log('========================================================================');
  console.log('  FINAL RECONCILIATION & PARITY: ON-DL LOANS VS PRODUCTION DB');
  console.log('========================================================================\n');

  const wb = xlsx.readFile('docs/ddd/onDLLoaner2026 (2).xlsx');

  // Extract loans from OnDL2026 (primary/latest 2026 balances) and OnDL2025 (for items only in 2025)
  const mapByDLNoOrName = new Map();

  for (const sheetName of ['OnDL2025', 'OnDL2026']) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });

    for (let i = 7; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[1] || typeof row[1] !== 'string') continue;

      const dlNo = String(row[0] || '').trim();
      const name = String(row[1] || '').trim();
      if (!dlNo || dlNo.toUpperCase().includes('TOTAL') || name.toUpperCase().includes('TOTAL')) continue;

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

      const key = `${name.toUpperCase().trim()}_${sheetName === 'OnDL2026' ? '2026' : '2025'}`;
      mapByDLNoOrName.set(key, {
        sheet: sheetName,
        dlNo,
        name,
        principal,
        balanceToCollect,
        dateReleased: dateReleased || '2025-01-01',
        dueDate: dueDate || '2026-12-31'
      });
    }
  }

  const finalExcelLoans = Array.from(mapByDLNoOrName.values());
  const totalExcelBal = finalExcelLoans.reduce((sum, x) => sum + x.balanceToCollect, 0);

  console.log(`Extracted ${finalExcelLoans.length} unique On-DL loan entries across 2025/2026 sheets.`);
  console.log(`Total Excel On-DL Balance to Collect: PHP ${totalExcelBal.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`);

  // Remove temporary duplicate LN-ONDL- entries from app_loans
  const { data: currentDbLoans } = await supabase.from('app_loans').select('*').like('loan_number', 'LN-ONDL-%');
  if (currentDbLoans && currentDbLoans.length > 0) {
    console.log(`Cleaning up ${currentDbLoans.length} temporary On-DL test loan records...`);
    const ids = currentDbLoans.map(l => l.id);
    await supabase.from('app_loans').delete().in('id', ids);
  }

  // Fetch borrowers and existing loans
  const { data: borrowers } = await supabase.from('app_borrowers').select('*');
  const { data: existingLoans } = await supabase.from('app_loans').select('*');

  const borrowerMap = new Map();
  for (const b of borrowers || []) {
    if (b.full_name) {
      const clean = b.full_name.trim().toLowerCase().replace(/[^a-z ]/g, '');
      borrowerMap.set(clean, b);
    }
  }

  let createdBorrowers = 0;
  let createdLoans = 0;
  let updatedLoans = 0;
  let syncedBalance = 0;

  for (const item of finalExcelLoans) {
    const cleanName = item.name.trim().toLowerCase().replace(/[^a-z ]/g, '');

    let bObj = borrowerMap.get(cleanName);
    if (!bObj) {
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
      const newBorrowerId = crypto.randomUUID();
      const membershipNo = `AN-26-${String(Math.floor(1000 + Math.random() * 9000))}`;
      const { data: newB, error: bErr } = await supabase
        .from('app_borrowers')
        .insert({
          id: newBorrowerId,
          full_name: item.name.toUpperCase(),
          membership_number: membershipNo,
          membership_status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (bErr) {
        console.error(`Error creating borrower ${item.name}:`, bErr.message);
        continue;
      }
      bObj = newB;
      borrowerMap.set(cleanName, bObj);
      createdBorrowers++;
    }

    // Check if borrower already has an active loan in DB matching this On-DL
    const existingActive = (existingLoans || []).find(l => 
      l.borrower_id === bObj.id && 
      (['active', 'unpaid', 'partial', 'defaulted'].includes((l.status || '').toLowerCase()))
    );

    const releaseIso = new Date(item.dateReleased).toISOString();
    const dueIso = new Date(item.dueDate).toISOString();

    if (existingActive) {
      // Update existing active loan to reflect On-DL status and balance
      await supabase.from('app_loans').update({
        principal_amount: item.principal,
        total_amount: item.balanceToCollect,
        installment_amount: item.balanceToCollect,
        status: 'UNPAID',
        notes: `Updated from Excel onDLLoaner2026 (${item.sheet} - ${item.dlNo})`,
        updated_at: new Date().toISOString()
      }).eq('id', existingActive.id);
      updatedLoans++;
      syncedBalance += item.balanceToCollect;
    } else {
      // Insert new On-DL loan record
      const loanNum = `LN-ONDL-${item.sheet}-${item.dlNo}`;
      const newLoanId = crypto.randomUUID();
      await supabase.from('app_loans').insert({
        id: newLoanId,
        borrower_id: bObj.id,
        loan_number: loanNum,
        loan_type: 'on_demand',
        principal_amount: item.principal,
        total_amount: item.balanceToCollect,
        installment_amount: item.balanceToCollect,
        frequency: 'one_time',
        term: 12,
        term_unit: 'months',
        interest_rate: 0,
        status: 'UNPAID',
        release_date: releaseIso,
        maturity_date: dueIso,
        notes: `Imported from Excel onDLLoaner2026 (${item.sheet} - ${item.dlNo})`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      createdLoans++;
      syncedBalance += item.balanceToCollect;
    }
  }

  console.log('\n========================================================================');
  console.log('              FINAL ON-DL RECONCILIATION SUMMARY');
  console.log('========================================================================');
  console.log(`Excel On-DL Loan Records:              ${finalExcelLoans.length}`);
  console.log(`New Borrowers Created in DB:           ${createdBorrowers}`);
  console.log(`New On-DL Loans Created in DB:         ${createdLoans}`);
  console.log(`Existing Active Loans Updated in DB:   ${updatedLoans}`);
  console.log(`Total Active On-DL Loan Balance:       PHP ${syncedBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log('========================================================================\n');
}

reconcileOnDLFinal().catch(console.error);
