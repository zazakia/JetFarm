const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const envFiles = [
    '.env.local',
    '.env.development',
    '.env.test',
    '.env',
].filter(Boolean);

for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath, override: false });
    }
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verify() {
    console.log('Starting deep verification...');
    const workbook = xlsx.readFile('./DCM-as-of-march-21.xlsx');
    const sheet = workbook.Sheets['DATA of Clients'];
    const rawData = xlsx.utils.sheet_to_json(sheet, { range: 11 });

    // Normalize names and attach generated loan numbers (matching migration logic)
    rawData.forEach((r, index) => {
        if (r['Name Of Client']) r['Name Of Client'] = r['Name Of Client'].toString().trim().replace(/\s+/g, ' ');
        const loanType = (r['Daily'] && parseFloat(r['Daily']) > 0) ? 'daily' : 'weekly';
        r._generatedLoanNumber = `LN-${loanType.toUpperCase()}-${String(index + 1).padStart(4, '0')}`;
    });

    const borrowersFromExcel = [...new Set(rawData.map(r => r['Name Of Client']).filter(n => n && n !== 'Total'))];
    const sampledNames = borrowersFromExcel.sort(() => 0.5 - Math.random()).slice(0, 20);
    
    // Always include Florenda
    if (!sampledNames.includes('Florenda N. Cimene')) sampledNames.push('Florenda N. Cimene');

    console.log(`Auditing ${sampledNames.length} borrowers...`);

    const results = [];

    for (const name of sampledNames) {
        console.log(`Checking ${name}...`);
        
        // 1. Get borrower and loans from DB
        const { data: borrower } = await supabase.from('app_borrowers').select('id').eq('full_name', name).single();
        if (!borrower) {
            console.error(`Borrower ${name} not found in DB!`);
            continue;
        }

        const { data: dbLoans } = await supabase.from('app_loans').select('*').eq('borrower_id', borrower.id).order('release_date', { ascending: true });
        
        // 2. Get corresponding rows from Excel
        const excelRows = rawData.filter(r => r['Name Of Client'] === name);
        
        if (dbLoans.length !== excelRows.length) {
            results.push({ name, error: `Loan count mismatch! Excel: ${excelRows.length}, DB: ${dbLoans.length}` });
            continue;
        }

        const borrowerResult = { name, loans: [] };

        for (let i = 0; i < dbLoans.length; i++) {
            const dbLoan = dbLoans[i];
            const excelRow = excelRows.find(r => r._generatedLoanNumber === dbLoan.loan_number);

            if (!excelRow) {
                borrowerResult.loans.push({ loanNumber: dbLoan.loan_number, error: 'Not found in sampled Excel rows' });
                continue;
            }

            // Calculate payments from DB
            const { data: dbPayments } = await supabase.from('app_payments').select('amount').eq('loan_id', dbLoan.id);
            const totalPaidDB = dbPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
            
            // Excel Values
            const excelTotalLoan = parseFloat(excelRow['Total Loan']) || 0;
            const excelBalance = parseFloat(excelRow['Total Loan Balance']) || 0;
            const excelPayments = parseFloat(excelRow['Total Payment ']) || parseFloat(excelRow['Total Payment']) || 0;

            // Mathematical Checks
            const dbBalance = excelTotalLoan - totalPaidDB;
            const balanceDiff = Math.abs(dbBalance - excelBalance);
            
            // If it's a rollover, the DB balance should be 0 because of the clearing payment
            const isRollover = (i < dbLoans.length - 1); // If it's not the latest loan
            const expectedDBBalance = isRollover ? 0 : excelBalance;
            const actualDBBalanceDiff = Math.abs(dbBalance - expectedDBBalance);

            borrowerResult.loans.push({
                loanNumber: dbLoan.loan_number,
                excelTotal: excelTotalLoan,
                excelPaid: excelPayments,
                dbPaid: totalPaidDB,
                excelBalance: excelBalance,
                dbBalanceCalculated: dbBalance,
                status: dbLoan.status,
                isRollover,
                valid: actualDBBalanceDiff < 2
            });
        }
        results.push(borrowerResult);
    }

    console.log('\n--- VERIFICATION REPORT ---');
    results.forEach(r => {
        if (r.error) {
            console.log(`[FAIL] ${r.name}: ${r.error}`);
        } else {
            console.log(`[PASS] ${r.name}`);
            r.loans.forEach(l => {
                if (l.error) {
                    console.log(`  ✗ Loan ${l.loanNumber}: ERROR | ${l.error}`);
                } else {
                    const statusIcon = l.valid ? '✓' : '✗';
                    console.log(`  ${statusIcon} Loan ${l.loanNumber}: ${l.status.toUpperCase()} | Excel Bal: ${l.excelBalance} | DB Bal: ${l.dbBalanceCalculated} | Valid: ${l.valid}`);
                }
            });
        }
    });
}

verify().catch(console.error);
