/**
 * full-compare-excel-vs-app.js
 *
 * Comprehensive READ-ONLY comparison of ALL loan data in
 *   - Excel: "brayan Import migration cleanup.xlsx"
 *   - App:   Supabase production database (app_loans + app_borrowers + app_collectors + app_payments)
 *
 * This script does NOT change any data.  It produces:
 *   1. Console output summarising counts + discrepancies
 *   2. data/full_comparison_report.json with every field-by-field diff
 */

const xlsx = require('xlsx');
const fs   = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// â”€â”€â”€ Supabase credentials (production) â”€â”€â”€
const SUPABASE_URL  = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// â”€â”€â”€ Excel helpers â”€â”€â”€
function parseExcelDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().split('T')[0];
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().split('T')[0];
  }
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  return null;
}

function normName(n) {
  if (!n) return '';
  return n.toString().toLowerCase().replace(/\s+/g, ' ').replace(/[.,]/g, '').trim();
}

function standardizeCollector(name) {
  const raw = (name || '').toLowerCase().trim();
  if (raw.includes('junco'))    return 'Cresencio Junco';
  if (raw.includes('gera'))     return 'Gerald Gera';
  if (raw.includes('cayanong')) return 'Jason Cayanong';
  if (raw.includes('casera'))   return 'Bernie Casera';
  return name;
}

const IGNORE_KW = ['batch', 'total', 'grand total', 'name of client', 'monthly', 'weekly'];

// â”€â”€â”€ Extract ALL loans from Excel â”€â”€â”€
function extractExcel() {
  const filePath = path.join(__dirname, '..', 'data', 'brayan Import migration cleanup.xlsx');
  console.log('Reading Excel file:', filePath);
  const wb = xlsx.readFile(filePath, { cellStyles: true, cellDates: true });
  const ws = wb.Sheets['DATA of Clients'];
  if (!ws) throw new Error("Sheet 'DATA of Clients' not found!");

  const range = xlsx.utils.decode_range(ws['!ref']);
  const maxRow = range.e.r;

  const excelLoans = [];
  let currentFreq = 'daily';
  let currentBatchName = '';

  for (let r = 0; r <= maxRow; r++) {
    const cellA = ws[xlsx.utils.encode_cell({ r, c: 0 })];
    const valA  = (cellA && cellA.v !== undefined) ? String(cellA.v).trim() : '';
    if (!valA) continue;

    const vLower = valA.toLowerCase();
    if (vLower.includes('batch')) {
      currentBatchName = valA;
      const cellJ = ws[xlsx.utils.encode_cell({ r, c: 9 })];
      const valJ  = cellJ ? String(cellJ.v).toLowerCase() : '';
      currentFreq = (vLower.includes('weekly') || valJ.includes('weekly')) ? 'weekly' : 'daily';
      continue;
    }
    if (IGNORE_KW.some(kw => vLower.startsWith(kw)) || vLower.length < 4) continue;

    const borrowerName = valA;
    const getVal = (c) => { const cell = ws[xlsx.utils.encode_cell({ r, c })]; return cell ? cell.v : null; };

    const address       = String(getVal(1) || '');
    const phone         = String(getVal(2) || '');
    const business      = String(getVal(4) || '');
    const rawCollector  = String(getVal(5) || '');
    const rawDays       = getVal(6) || 0;
    const releaseDate   = parseExcelDate(getVal(9));
    const maturityDate  = parseExcelDate(getVal(10));
    const principal     = parseFloat(getVal(11) || 0);
    const installmentAmt = parseFloat(getVal(12) || 0);
    const totalInterest = parseFloat(getVal(13) || 0);
    const savings       = parseFloat(getVal(14) || 0);
    const deducted      = parseFloat(getVal(15) || 0);
    const insurance     = parseFloat(getVal(16) || 0);
    const totalLoan     = parseFloat(getVal(17) || 0);
    const excelBalance  = parseFloat(getVal(18) || 0);

    let collector = '';
    if (rawCollector && typeof rawCollector === 'string' && rawCollector.length > 3
        && !rawCollector.toLowerCase().includes('collector')) {
      collector = standardizeCollector(rawCollector);
    }

    // Determine Paid Status via cell colour (Theme 5 Tint 0.6)
    let isPaid = false;
    if (cellA.s && cellA.s.fgColor) {
      const fg = cellA.s.fgColor;
      if (fg.theme === 5 && fg.tint !== undefined && Math.abs(fg.tint - 0.6) < 0.1) isPaid = true;
    }

    // Payments from date-header columns
    let headerRowIdx = r - 1;
    while (headerRowIdx >= 0) {
      const hCell = ws[xlsx.utils.encode_cell({ r: headerRowIdx, c: 0 })];
      const hVal  = hCell ? String(hCell.v).toLowerCase() : '';
      if (hVal.includes('name of client')) break;
      headerRowIdx--;
    }

    const payments = [];
    if (headerRowIdx >= 0) {
      for (let c = 19; c < 150; c++) {
        const dateCell   = ws[xlsx.utils.encode_cell({ r: headerRowIdx, c })];
        const amountCell = ws[xlsx.utils.encode_cell({ r, c })];
        const d = parseExcelDate(dateCell?.v);
        if (d && amountCell && amountCell.v) {
          const amt = parseFloat(amountCell.v);
          if (amt > 0) payments.push({ date: d, amount: amt });
        }
      }
    }

    const totalPayments = payments.reduce((s, p) => s + p.amount, 0);

    excelLoans.push({
      rowOrigin: r + 1,
      borrowerName,
      address,
      phone,
      business,
      collector,
      frequency: currentFreq,
      batchName: currentBatchName,
      days: parseInt(String(rawDays)) || 40,
      releaseDate,
      maturityDate,
      principal,
      installmentAmt,
      totalInterest,
      savings,
      deducted,
      insurance,
      totalLoan,
      excelBalance,
      isPaid,
      paymentCount: payments.length,
      totalPayments,
      payments
    });
  }

  console.log(`Excel: Extracted ${excelLoans.length} loan rows`);
  return excelLoans;
}

// â”€â”€â”€ Fetch ALL data from Supabase â”€â”€â”€
async function fetchAppData() {
  console.log('Fetching data from Supabase...');

  // Fetch all loans (including paid/active, excluding deleted)
  let allLoans = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('app_loans')
      .select('*')
      .is('deleted_at', null)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) { console.error('Loans fetch error:', error); break; }
    allLoans = allLoans.concat(data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  console.log(`  Loans fetched: ${allLoans.length}`);

  // Fetch all borrowers
  const { data: borrowers, error: be } = await supabase
    .from('app_borrowers')
    .select('*')
    .is('deleted_at', null);
  if (be) console.error('Borrowers error:', be);
  console.log(`  Borrowers fetched: ${(borrowers || []).length}`);

  // Fetch all collectors
  const { data: collectors, error: ce } = await supabase
    .from('app_collectors')
    .select('*')
    .is('deleted_at', null);
  if (ce) console.error('Collectors error:', ce);
  console.log(`  Collectors fetched: ${(collectors || []).length}`);

  // Fetch ALL payments (paginated)
  let allPayments = [];
  page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('app_payments')
      .select('id, loan_id, amount, payment_date')
      .is('deleted_at', null)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) { console.error('Payments fetch error:', error); break; }
    allPayments = allPayments.concat(data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  console.log(`  Payments fetched: ${allPayments.length}`);

  // Build lookup maps
  const borrowerMap = {};
  for (const b of (borrowers || [])) borrowerMap[b.id] = b;

  const collectorMap = {};
  for (const c of (collectors || [])) collectorMap[c.id] = c;

  // Aggregate payments per loan
  const paymentsByLoan = {};
  for (const p of allPayments) {
    if (!paymentsByLoan[p.loan_id]) paymentsByLoan[p.loan_id] = { total: 0, count: 0, payments: [] };
    paymentsByLoan[p.loan_id].total += parseFloat(p.amount || 0);
    paymentsByLoan[p.loan_id].count++;
    paymentsByLoan[p.loan_id].payments.push({
      date: p.payment_date ? p.payment_date.split('T')[0] : null,
      amount: parseFloat(p.amount || 0)
    });
  }

  // Assemble enriched loan records
  const appLoans = allLoans.map(l => {
    const b = borrowerMap[l.borrower_id] || {};
    const c = collectorMap[l.collector_id] || {};
    const pay = paymentsByLoan[l.id] || { total: 0, count: 0, payments: [] };
    const totalAmount = parseFloat(l.total_amount || 0);
    const balance = Math.round((totalAmount - pay.total) * 100) / 100;

    return {
      loanId:         l.id,
      borrowerName:   b.full_name || 'Unknown',
      address:        b.address || '',
      phone:          b.phone || '',
      business:       b.business || '',
      collector:      c.full_name || 'Unknown',
      frequency:      l.frequency || '',
      principal:      parseFloat(l.principal_amount || 0),
      interestRate:   parseFloat(l.interest_rate || 0),
      interestAmount: parseFloat(l.interest_amount || 0),
      totalAmount:    totalAmount,
      installment:    parseFloat(l.installment_amount || 0),
      insurance:      parseFloat(l.insurance_amount || 0),
      deposit:        parseFloat(l.deposit_amount || 0),
      deducted:       parseFloat(l.deducted_amount || 0),
      term:           l.term,
      releaseDate:    l.release_date ? l.release_date.split('T')[0] : null,
      maturityDate:   l.maturity_date ? l.maturity_date.split('T')[0] : null,
      status:         l.status,
      isReloan:       l.is_reloan,
      batch:          l.batch,
      cycle:          l.cycle,
      totalPaid:      Math.round(pay.total * 100) / 100,
      paymentCount:   pay.count,
      balance:        balance,
      loanNumber:     l.loan_number,
    };
  });

  return appLoans;
}

// â”€â”€â”€ Field-by-field comparison â”€â”€â”€
function compareRow(ex, app) {
  const diffs = [];

  function cmp(field, exVal, appVal, tolerance = 0.5) {
    if (exVal === null && appVal === null) return;
    if (exVal === null || appVal === null) {
      if (exVal || appVal) diffs.push({ field, excel: exVal, app: appVal });
      return;
    }
    if (typeof exVal === 'number' && typeof appVal === 'number') {
      if (Math.abs(exVal - appVal) > tolerance) {
        diffs.push({ field, excel: exVal, app: appVal, diff: Math.round((exVal - appVal) * 100) / 100 });
      }
    } else if (String(exVal) !== String(appVal)) {
      diffs.push({ field, excel: exVal, app: appVal });
    }
  }

  cmp('principal',       ex.principal,       app.principal);
  cmp('totalLoan',       ex.totalLoan,       app.totalAmount);
  cmp('installment',     ex.installmentAmt,  app.installment);
  cmp('insurance',       ex.insurance,       app.insurance);
  cmp('totalInterest',   ex.totalInterest,   app.interestAmount);
  cmp('balance',         ex.excelBalance,    app.balance, 1);
  cmp('totalPayments',   ex.totalPayments,   app.totalPaid, 1);
  cmp('paymentCount',    ex.paymentCount,    app.paymentCount, 0);
  cmp('releaseDate',     ex.releaseDate,     app.releaseDate);
  cmp('maturityDate',    ex.maturityDate,    app.maturityDate);
  cmp('deducted',        ex.deducted,        app.deducted);

  // Collector comparison (soft)
  const exColl  = normName(ex.collector);
  const appColl = normName(app.collector);
  if (exColl && appColl && !appColl.includes(exColl.split(' ')[0]) && !exColl.includes(appColl.split(' ')[0])) {
    diffs.push({ field: 'collector', excel: ex.collector, app: app.collector });
  }

  // Frequency comparison (soft)
  if (ex.frequency && app.frequency && ex.frequency !== app.frequency) {
    diffs.push({ field: 'frequency', excel: ex.frequency, app: app.frequency });
  }

  return diffs;
}

// â”€â”€â”€ Main â”€â”€â”€
async function main() {
  console.log('================================================================');
  console.log('  FULL COMPARISON: Excel vs App (read-only, no data changes)');
  console.log('================================================================\n');

  const excelLoans = extractExcel();
  const appLoans   = await fetchAppData();

  // Group app loans by normalised borrower name
  const appByName = {};
  for (const a of appLoans) {
    const key = normName(a.borrowerName);
    if (!appByName[key]) appByName[key] = [];
    appByName[key].push(a);
  }

  // Group excel by normalised name
  const excelByName = {};
  for (const e of excelLoans) {
    const key = normName(e.borrowerName);
    if (!excelByName[key]) excelByName[key] = [];
    excelByName[key].push(e);
  }

  const matched     = [];
  const mismatched  = [];
  const excelOnly   = [];
  const appNamesCopy = new Set(Object.keys(appByName));

  // For each borrower in Excel, try to match against app
  for (const [nameKey, exLoans] of Object.entries(excelByName)) {
    if (!appByName[nameKey]) {
      for (const ex of exLoans) {
        excelOnly.push({
          row: ex.rowOrigin,
          name: ex.borrowerName,
          collector: ex.collector,
          principal: ex.principal,
          totalLoan: ex.totalLoan,
          balance: ex.excelBalance,
          status: ex.isPaid ? 'paid' : 'active',
          frequency: ex.frequency,
          batch: ex.batchName
        });
      }
      continue;
    }

    appNamesCopy.delete(nameKey);
    const appEntries = appByName[nameKey];

    // Match each excel loan to an app loan by principal amount + status
    for (const ex of exLoans) {
      let bestMatch = null;
      let bestScore = -1;

      for (const a of appEntries) {
        let score = 0;
        // Principal match
        if (Math.abs(ex.principal - a.principal) < 1) score += 10;
        // Total loan match
        if (Math.abs(ex.totalLoan - a.totalAmount) < 1) score += 5;
        // Status match
        const exStatus = ex.isPaid ? 'paid' : 'active';
        if (exStatus === a.status) score += 3;
        // Installment match
        if (Math.abs(ex.installmentAmt - a.installment) < 1) score += 2;
        // Release date match
        if (ex.releaseDate === a.releaseDate) score += 2;

        if (score > bestScore) {
          bestScore = score;
          bestMatch = a;
        }
      }

      if (!bestMatch) {
        excelOnly.push({
          row: ex.rowOrigin,
          name: ex.borrowerName,
          collector: ex.collector,
          principal: ex.principal,
          totalLoan: ex.totalLoan,
          balance: ex.excelBalance,
          status: ex.isPaid ? 'paid' : 'active',
          frequency: ex.frequency,
          batch: ex.batchName
        });
        continue;
      }

      const diffs = compareRow(ex, bestMatch);

      const entry = {
        row: ex.rowOrigin,
        name: ex.borrowerName,
        appLoanId: bestMatch.loanId,
        appLoanNumber: bestMatch.loanNumber,
        collector_excel: ex.collector,
        collector_app: bestMatch.collector,
        excelStatus: ex.isPaid ? 'paid' : 'active',
        appStatus: bestMatch.status,
        principal_excel: ex.principal,
        principal_app: bestMatch.principal,
        totalLoan_excel: ex.totalLoan,
        totalLoan_app: bestMatch.totalAmount,
        installment_excel: ex.installmentAmt,
        installment_app: bestMatch.installment,
        insurance_excel: ex.insurance,
        insurance_app: bestMatch.insurance,
        interest_excel: ex.totalInterest,
        interest_app: bestMatch.interestAmount,
        balance_excel: ex.excelBalance,
        balance_app: bestMatch.balance,
        balance_diff: Math.round((ex.excelBalance - bestMatch.balance) * 100) / 100,
        totalPaid_excel: ex.totalPayments,
        totalPaid_app: bestMatch.totalPaid,
        totalPaid_diff: Math.round((ex.totalPayments - bestMatch.totalPaid) * 100) / 100,
        paymentCount_excel: ex.paymentCount,
        paymentCount_app: bestMatch.paymentCount,
        releaseDate_excel: ex.releaseDate,
        releaseDate_app: bestMatch.releaseDate,
        maturityDate_excel: ex.maturityDate,
        maturityDate_app: bestMatch.maturityDate,
        deducted_excel: ex.deducted,
        deducted_app: bestMatch.deducted,
        frequency_excel: ex.frequency,
        frequency_app: bestMatch.frequency,
        diffs
      };

      if (diffs.length === 0) {
        matched.push(entry);
      } else {
        mismatched.push(entry);
      }
    }
  }

  // App-only loans
  const appOnly = [];
  for (const key of appNamesCopy) {
    for (const a of appByName[key]) {
      appOnly.push({
        loanId: a.loanId,
        name: a.borrowerName,
        collector: a.collector,
        principal: a.principal,
        totalAmount: a.totalAmount,
        balance: a.balance,
        status: a.status,
        loanNumber: a.loanNumber
      });
    }
  }

  // Sort mismatches by balance diff descending
  mismatched.sort((a, b) => Math.abs(b.balance_diff) - Math.abs(a.balance_diff));

  // â”€â”€â”€ Console Report â”€â”€â”€
  console.log('\n================================================================');
  console.log('                    COMPARISON RESULTS');
  console.log('================================================================');
  console.log(`Excel total loan rows:        ${excelLoans.length}`);
  console.log(`App total loans (non-deleted): ${appLoans.length}`);
  console.log(`  Active:                     ${appLoans.filter(l => l.status === 'active').length}`);
  console.log(`  Paid:                       ${appLoans.filter(l => l.status === 'paid').length}`);
  console.log(`  Other:                      ${appLoans.filter(l => l.status !== 'active' && l.status !== 'paid').length}`);
  console.log('----------------------------------------------------------------');
  console.log(`Matched (all values equal):   ${matched.length}`);
  console.log(`Mismatched (some diffs):      ${mismatched.length}`);
  console.log(`Excel-Only (not in app):      ${excelOnly.length}`);
  console.log(`App-Only (not in excel):      ${appOnly.length}`);
  console.log('================================================================\n');

  // Aggregate totals
  const excelTotalPrincipal = excelLoans.reduce((s, e) => s + e.principal, 0);
  const excelTotalLoan      = excelLoans.reduce((s, e) => s + e.totalLoan, 0);
  const excelTotalBalance   = excelLoans.reduce((s, e) => s + e.excelBalance, 0);
  const excelTotalPaid      = excelLoans.reduce((s, e) => s + e.totalPayments, 0);
  const appTotalPrincipal   = appLoans.reduce((s, a) => s + a.principal, 0);
  const appTotalAmount      = appLoans.reduce((s, a) => s + a.totalAmount, 0);
  const appTotalBalance     = appLoans.reduce((s, a) => s + a.balance, 0);
  const appTotalPaid        = appLoans.reduce((s, a) => s + a.totalPaid, 0);

  console.log('=== AGGREGATE TOTALS ===');
  console.log(`                       Excel               App                 Difference`);
  console.log(`Total Principal:       â‚±${excelTotalPrincipal.toFixed(2).padStart(14)}   â‚±${appTotalPrincipal.toFixed(2).padStart(14)}   â‚±${(excelTotalPrincipal - appTotalPrincipal).toFixed(2).padStart(14)}`);
  console.log(`Total Loan:            â‚±${excelTotalLoan.toFixed(2).padStart(14)}   â‚±${appTotalAmount.toFixed(2).padStart(14)}   â‚±${(excelTotalLoan - appTotalAmount).toFixed(2).padStart(14)}`);
  console.log(`Total Balance:         â‚±${excelTotalBalance.toFixed(2).padStart(14)}   â‚±${appTotalBalance.toFixed(2).padStart(14)}   â‚±${(excelTotalBalance - appTotalBalance).toFixed(2).padStart(14)}`);
  console.log(`Total Paid:            â‚±${excelTotalPaid.toFixed(2).padStart(14)}   â‚±${appTotalPaid.toFixed(2).padStart(14)}   â‚±${(excelTotalPaid - appTotalPaid).toFixed(2).padStart(14)}`);

  // â”€â”€â”€ Print mismatches â”€â”€â”€
  if (mismatched.length > 0) {
    console.log('\n=== TOP MISMATCHES (by balance diff) ===');
    console.log('Row | Name'.padEnd(40) + ' | BalDiff'.padStart(12) + ' | PaidDiff'.padStart(12) + ' | Diff Fields');
    console.log('-'.repeat(120));
    for (const m of mismatched.slice(0, 50)) {
      const diffFields = m.diffs.map(d => d.field).join(', ');
      console.log(
        `${String(m.row).padStart(3)} | ${m.name.padEnd(34)} | ` +
        `${m.balance_diff.toFixed(2).padStart(10)} | ` +
        `${m.totalPaid_diff.toFixed(2).padStart(10)} | ` +
        diffFields
      );
    }
    if (mismatched.length > 50) {
      console.log(`  ... and ${mismatched.length - 50} more mismatches (see JSON report)`);
    }
  }

  if (excelOnly.length > 0) {
    console.log('\n=== EXCEL-ONLY LOANS (not found in app) ===');
    for (const e of excelOnly.slice(0, 30)) {
      console.log(`  Row ${e.row}: ${e.name.padEnd(30)} | P:â‚±${e.principal.toFixed(2)} | Bal:â‚±${e.balance.toFixed(2)} | ${e.status} | ${e.collector}`);
    }
    if (excelOnly.length > 30) console.log(`  ... and ${excelOnly.length - 30} more`);
  }

  if (appOnly.length > 0) {
    console.log('\n=== APP-ONLY LOANS (not in excel) ===');
    for (const a of appOnly.slice(0, 30)) {
      console.log(`  ${a.name.padEnd(30)} | P:â‚±${a.principal.toFixed(2)} | Bal:â‚±${a.balance.toFixed(2)} | ${a.status} | ${a.collector}`);
    }
    if (appOnly.length > 30) console.log(`  ... and ${appOnly.length - 30} more`);
  }

  // Diff field frequency analysis
  const fieldFreq = {};
  for (const m of mismatched) {
    for (const d of m.diffs) {
      fieldFreq[d.field] = (fieldFreq[d.field] || 0) + 1;
    }
  }
  if (Object.keys(fieldFreq).length > 0) {
    console.log('\n=== MISMATCH FIELD FREQUENCY ===');
    const sorted = Object.entries(fieldFreq).sort((a, b) => b[1] - a[1]);
    for (const [field, count] of sorted) {
      console.log(`  ${field.padEnd(20)} ${count} occurrences`);
    }
  }

  // â”€â”€â”€ Save JSON report â”€â”€â”€
  const report = {
    generated_at: new Date().toISOString(),
    summary: {
      excel_total_loans: excelLoans.length,
      app_total_loans: appLoans.length,
      app_active_loans: appLoans.filter(l => l.status === 'active').length,
      app_paid_loans: appLoans.filter(l => l.status === 'paid').length,
      matched: matched.length,
      mismatched: mismatched.length,
      excel_only: excelOnly.length,
      app_only: appOnly.length,
    },
    aggregates: {
      excel: {
        total_principal: Math.round(excelTotalPrincipal * 100) / 100,
        total_loan: Math.round(excelTotalLoan * 100) / 100,
        total_balance: Math.round(excelTotalBalance * 100) / 100,
        total_paid: Math.round(excelTotalPaid * 100) / 100,
      },
      app: {
        total_principal: Math.round(appTotalPrincipal * 100) / 100,
        total_loan: Math.round(appTotalAmount * 100) / 100,
        total_balance: Math.round(appTotalBalance * 100) / 100,
        total_paid: Math.round(appTotalPaid * 100) / 100,
      },
      differences: {
        principal: Math.round((excelTotalPrincipal - appTotalPrincipal) * 100) / 100,
        total_loan: Math.round((excelTotalLoan - appTotalAmount) * 100) / 100,
        balance: Math.round((excelTotalBalance - appTotalBalance) * 100) / 100,
        paid: Math.round((excelTotalPaid - appTotalPaid) * 100) / 100,
      }
    },
    mismatch_field_frequency: fieldFreq,
    mismatched,
    matched,
    excel_only: excelOnly,
    app_only: appOnly
  };

  const outPath = path.join(__dirname, '..', 'data', 'full_comparison_report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report saved to: ${outPath}`);
  console.log('Done.');
}

main().catch(console.error);
