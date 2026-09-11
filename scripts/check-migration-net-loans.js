const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Use the verified Supabase credentials
const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const supabaseKey = 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Reading Excel file...');
  const workbook = xlsx.readFile('data/brayan Import migration cleanup.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const excelData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  // Header is at index 47 (Row 48)
  const header = excelData[47];
  const rows = excelData.slice(48);

  const colIdx = {
    name: header.indexOf('Name Of Client'),
    principal: header.indexOf('Loan Amount'),
    netLoan: header.indexOf('Net Loan'),
    dateRelease: header.indexOf('Date Release'),
    totalLoan: header.indexOf('Total Loan'),
    balance: header.indexOf('Total Loan Balance')
  };

  console.log('Fetching database records...');
  // Fetch borrowers
  const { data: borrowers, error: bError } = await supabase
    .from('app_borrowers')
    .select('id, full_name');

  if (bError) {
    console.error('Error fetching borrowers:', bError);
    process.exit(1);
  }

  // Fetch all loans
  const { data: loans, error: lError } = await supabase
    .from('app_loans')
    .select('*')
    .order('release_date', { ascending: false });

  if (lError) {
    console.error('Error fetching loans:', lError);
    process.exit(1);
  }

  const results = [];
  const mismatches = [];

  for (const row of rows) {
    const name = row[colIdx.name];
    if (!name) continue;

    const excelPrincipal = parseFloat(row[colIdx.principal]);
    const excelNetLoan = parseFloat(row[colIdx.netLoan]);
    
    if (isNaN(excelPrincipal) || isNaN(excelNetLoan)) continue;

    // Find borrower in DB
    const matchingBorrower = borrowers.find(b => {
      const dbName = b.full_name.toLowerCase().trim();
      const exName = name.toLowerCase().trim();
      return dbName === exName || dbName.includes(exName) || exName.includes(dbName);
    });

    if (!matchingBorrower) {
      results.push({ name, status: 'BORROWER_NOT_FOUND' });
      continue;
    }

    // Find loan in DB for this borrower
    const dbLoans = loans.filter(l => l.borrower_id === matchingBorrower.id);
    
    // Match by principal amount
    const matchingLoan = dbLoans.find(l => Math.abs(l.principal_amount - excelPrincipal) < 0.01);

    if (!matchingLoan) {
      results.push({ name, excelPrincipal, status: 'LOAN_NOT_FOUND' });
      continue;
    }

    // FORMULA: Net Release = Principal - Previous Balance
    // In DB, deducted_amount represents the Previous Balance
    const appDeducted = matchingLoan.deducted_amount || 0;
    const appNetRelease = matchingLoan.principal_amount - appDeducted;
    
    // Excel Net Loan is the expected Net Release
    const expectedDeducted = excelPrincipal - excelNetLoan;

    if (Math.abs(appNetRelease - excelNetLoan) > 0.01) {
      mismatches.push({
        borrower: matchingBorrower.full_name,
        loanId: matchingLoan.id,
        loanNumber: matchingLoan.loan_number,
        loanDate: matchingLoan.release_date,
        excelPrincipal,
        excelNetLoan,
        appNetRelease,
        appDeducted,
        expectedDeducted,
        diff: appNetRelease - excelNetLoan
      });
    } else {
      results.push({
        borrower: matchingBorrower.full_name,
        loanNumber: matchingLoan.loan_number,
        status: 'MATCH'
      });
    }
  }

  const output = {
    summary: {
      totalExcelRows: rows.length,
      matches: results.filter(r => r.status === 'MATCH').length,
      mismatches: mismatches.length,
      borrowerNotFound: results.filter(r => r.status === 'BORROWER_NOT_FOUND').length,
      loanNotFound: results.filter(r => r.status === 'LOAN_NOT_FOUND').length
    },
    mismatches,
    other: results.filter(r => r.status !== 'MATCH')
  };

  fs.writeFileSync('data/migration_net_loan_report.json', JSON.stringify(output, null, 2));
  console.log(`Done. Found ${mismatches.length} mismatches. Report saved to data/migration_net_loan_report.json`);
}

run();
