const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');
const crypto = require('crypto');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function masterImportDetailed() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('DCM-as-of-march-21.xlsx');
  const sheet = workbook.getWorksheet('DATA of Clients');

  // 1. Get Date Headers from Row 12 (Cols 20 to 80)
  const r12 = sheet.getRow(12);
  const headerDates = {};
  for (let j = 20; j <= 80; j++) {
    const val = r12.getCell(j).value;
    if (val instanceof Date) {
      headerDates[j] = val.toISOString().split('T')[0];
    } else if (val && val.result instanceof Date) {
       headerDates[j] = val.result.toISOString().split('T')[0];
    }
  }

  // 2. Pre-extract collectors for mapping
  const { data: collectors } = await supabase.from('app_collectors').select('id, full_name');
  const collectorMap = {};
  collectors.forEach(c => collectorMap[c.full_name.toLowerCase()] = c.id);

  // 3. Pre-fetch existing borrowers and loans for idempotency
  console.log('Fetching existing borrowers and loans...');
  const { data: existingBorrowers } = await supabase.from('app_borrowers').select('id, full_name');
  const borrowerIdMap = {};
  existingBorrowers.forEach(b => borrowerIdMap[b.full_name.toLowerCase().trim()] = b.id);

  const { data: existingLoans } = await supabase.from('app_loans').select('id, loan_number');
  const loanIdMap = {};
  existingLoans.forEach(l => loanIdMap[l.loan_number] = l.id);

  const { data: existingPayments } = await supabase.from('app_payments').select('loan_id, amount, payment_date');

  // 4. First Pass: Create Missing Borrowers
  let newestCycles = {};
  for (let i = 13; i <= 688; i++) {
    const row = sheet.getRow(i);
    const nameRaw = row.getCell(1).value;
    if (!nameRaw || nameRaw === 'Total' || nameRaw === 'Name Of Client') continue;
    const name = nameRaw.toString().toLowerCase().trim();
    const cycle = parseInt(row.getCell(9).value) || 1;
    if (!newestCycles[name] || cycle > newestCycles[name].cycle) {
      newestCycles[name] = { cycle, rowNumber: i, nameRaw };
    }
  }

  console.log(`--- RECONCILING MASTER IMPORT ---`);
  
  for (const name of Object.keys(newestCycles)) {
    if (borrowerIdMap[name]) continue; // Skip if exists

    const meta = newestCycles[name];
    const row = sheet.getRow(meta.rowNumber);
    const bId = crypto.randomUUID();
    
    // Detailed Info
    const phone = row.getCell(3).value ? row.getCell(3).value.toString().trim() : null;
    const baseAddress = row.getCell(2).value ? row.getCell(2).value.toString().trim() : '';
    const business = row.getCell(5).value ? row.getCell(5).value.toString().trim() : '';
    const fullAddress = business ? `${baseAddress} | Biz: ${business}` : baseAddress;

    const { error: bErr } = await supabase.from('app_borrowers').insert([{
      id: bId,
      full_name: meta.nameRaw.toString().trim(),
      address: fullAddress || 'Unknown',
      phone: phone
    }]);
    if (!bErr) borrowerIdMap[name] = bId;
    else console.error(`Error borrower ${meta.nameRaw}:`, bErr);
  }

  // 5. Second Pass: Reconcile 613 Loans and Payments
  const lastRow = sheet.actualRowCount;
  for (let i = 13; i <= lastRow; i++) {
    const row = sheet.getRow(i);
    const nameRaw = row.getCell(1).value;
    if (!nameRaw || nameRaw === 'Total' || nameRaw === 'Name Of Client') continue;

    const name = nameRaw.toString().toLowerCase().trim();
    if (name.includes('batch')) continue;
    const loanNum = 'LN-DAILY-' + (i - 12).toString().padStart(4, '0');
    const cycle = parseInt(row.getCell(9).value) || 1;
    const collectorName = row.getCell(6).value ? row.getCell(6).value.toString().toLowerCase().trim() : 'unknown';

    // Dates & Metadata
    const relDateVal = row.getCell(10).value;
    const matDateVal = row.getCell(11).value;
    const relDate = (relDateVal instanceof Date) ? relDateVal.toISOString() : null;
    const matDate = (matDateVal instanceof Date) ? matDateVal.toISOString() : null;
    const coMaker = row.getCell(4).value ? row.getCell(4).value.toString().trim() : '';
    const batch = row.getCell(8).value ? row.getCell(8).value.toString().trim() : null;
    
    // Status Logic
    const fill = row.getCell(1).style.fill;
    const isOrange = fill && (fill.fgColor?.argb === 'FFFFC000' || fill.fgColor?.theme === 5);
    const isNewest = newestCycles[name] && newestCycles[name].cycle === cycle;
    const status = (isNewest && !isOrange) ? 'active' : 'paid';

    const getVal = (col) => {
      const v = row.getCell(col).value;
      return (v && typeof v === 'object' ? (v.result !== undefined ? v.result : v.formula) : v) || 0;
    };

    const principal = parseFloat(getVal(12)) || 0;
    if (principal <= 0) continue;

    const installment = parseFloat(getVal(13)) || 0;
    const interest = parseFloat(getVal(14)) || 0;
    const deposit = 0; // Column 16 is "Net Loan", and user says savings/deposit is only for weekly loans.
    const insurance = parseFloat(getVal(17)) || 0;
    const totalAmount = parseFloat(getVal(18)) || 0;

    let loanId = loanIdMap[loanNum];
    
    if (loanId) {
      // Update existing loan with insurance and deposit
      await supabase.from('app_loans').update({
        deposit_amount: deposit,
        insurance_amount: insurance,
        interest_amount: interest,
        total_amount: totalAmount,
        installment_amount: installment
      }).eq('id', loanId);
    } else {
      // Create Loan
      loanId = crypto.randomUUID();
      const { error: lErr } = await supabase.from('app_loans').insert([{
        id: loanId,
        borrower_id: borrowerIdMap[name],
        loan_number: loanNum,
        collector_id: collectorMap[collectorName] || collectorMap['jayson cayanong'],
        principal_amount: principal,
        interest_amount: interest,
        total_amount: totalAmount,
        installment_amount: installment,
        deposit_amount: deposit,
        insurance_amount: insurance,
        status: status,
        cycle: cycle,
        release_date: relDate,
        maturity_date: matDate,
        batch: batch,
        notes: coMaker ? `Co-Maker: ${coMaker}` : null
      }]);

      if (lErr) {
        console.error(`Error loan ${loanNum}:`, lErr);
        continue;
      }
      loanIdMap[loanNum] = loanId;
    }

    // Individual Payments (Cols 20-80)
    let paymentsToInsert = [];
    for (let j = 20; j <= 80; j++) {
      const pVal = parseFloat(row.getCell(j).value) || 0;
      if (pVal > 0 && headerDates[j]) {
        // Check if payment already exists
        const exists = existingPayments.find(p => p.loan_id === loanId && Math.abs(p.amount - pVal) < 0.01 && p.payment_date.split('T')[0] === headerDates[j]);
        if (!exists) {
          paymentsToInsert.push({
            id: crypto.randomUUID(),
            loan_id: loanId,
            amount: pVal,
            payment_date: headerDates[j]
          });
        }
      }
    }

    if (paymentsToInsert.length > 0) {
      const { error: pErr } = await supabase.from('app_payments').insert(paymentsToInsert);
      if (pErr) console.error(`Error payments for ${loanNum}:`, pErr);
    }
    process.stdout.write('.');
  }

  console.log(`\n--- RECONCILIATION COMPLETE ---`);
}

masterImportDetailed().catch(console.error);
