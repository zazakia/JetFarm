const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalizeName(name) {
    if (!name) return "";
    return name.toString()
        .trim()
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .replace(/\s[A-Z]\.\s/g, ' ')
        .replace(/\s[A-Z]\./g, ' ');
}

async function getAllPayments() {
    console.log('Fetching all payments in batches...');
    let allPayments = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('app_payments')
            .select('loan_id, amount')
            .range(from, from + batchSize - 1);
        
        if (error) throw error;
        allPayments = allPayments.concat(data);
        
        if (data.length < batchSize) hasMore = false;
        else from += batchSize;
        
        process.stdout.write(`\rFetched ${allPayments.length} payments...`);
    }
    console.log('\nPayment fetch complete.');
    return allPayments;
}

async function getAppData() {
    console.log('Fetching active loans...');
    const { data: loans, error: lErr } = await supabase.from('app_loans').select('*').eq('status', 'active');
    if (lErr) throw lErr;

    console.log('Fetching borrowers...');
    const { data: borrowers, error: bErr } = await supabase.from('app_borrowers').select('id, full_name');
    if (bErr) throw bErr;

    const payments = await getAllPayments();

    const borrowerMap = {};
    borrowers.forEach(b => borrowerMap[b.id] = b.full_name);

    const paymentMap = {};
    payments.forEach(p => {
        if (!paymentMap[p.loan_id]) paymentMap[p.loan_id] = 0;
        paymentMap[p.loan_id] += parseFloat(p.amount);
    });

    return loans.map(l => {
        const totalPaid = paymentMap[l.id] || 0;
        return {
            id: l.id,
            name: normalizeName(borrowerMap[l.borrower_id]),
            orig_name: borrowerMap[l.borrower_id] || "Unknown",
            total_amount: parseFloat(l.total_amount),
            paid_in_app: totalPaid,
            balance_in_app: parseFloat(l.total_amount) - totalPaid,
            collector_id: l.collector_id
        };
    });
}

function getExcelCollectorData(filePath) {
    console.log('Reading Excel data...');
    const workbook = xlsx.readFile(filePath);
    const collectorSheets = ['JAYSON CAYANONG', 'CRIS JUNCO', 'Gerald Gera'];
    const excelLoans = [];

    for (const sheetName of collectorSheets) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        
        const rawData = xlsx.utils.sheet_to_json(sheet, { range: 6 });
        
        for (const row of rawData) {
            const name = normalizeName(row['Name Of Client']);
            if (!name || name === 'TOTAL' || name === 'NAME OF CLIENT' || name.includes('COLLECTION')) continue;
            
            const balance = parseFloat(row['Total Loan Balance']);
            if (isNaN(balance)) continue;

            excelLoans.push({
                name: name,
                orig_name: row['Name Of Client'],
                balance: balance,
                collector: sheetName
            });
        }
    }
    return excelLoans;
}

async function sync() {
    const appLoans = await getAppData();
    const excelLoans = getExcelCollectorData('./DCM-as-of-march-21.xlsx');
    
    console.log(`\nApp Active Loans: ${appLoans.length}`);
    console.log(`Excel Records: ${excelLoans.length}`);

    const adjustments = [];
    const unmatchedExcel = [];
    
    for (const ex of excelLoans) {
        let match = appLoans.find(a => a.name === ex.name);
        
        if (!match && ex.name.length > 5) {
            match = appLoans.find(a => a.name.includes(ex.name) || ex.name.includes(a.name));
        }

        if (match) {
            const diff = match.balance_in_app - ex.balance;
            // Only adjust if the difference is meaningful (> 1 peso)
            if (Math.abs(diff) > 1) { 
                adjustments.push({
                    loan_id: match.id,
                    name: match.orig_name,
                    app_bal: match.balance_in_app,
                    ex_bal: ex.balance,
                    adjustment: diff,
                    collector_id: match.collector_id
                });
            }
        } else {
            unmatchedExcel.push(ex);
        }
    }

    // Filter to only show App > Excel (missing payments)
    const missingPayments = adjustments.filter(a => a.adjustment > 1);
    
    console.log('\n--- PROPOSED ADJUSTMENTS (Missing Payments in App) ---');
    missingPayments.sort((a,b) => b.adjustment - a.adjustment);
    
    let totalAdjValue = 0;
    for (const adj of missingPayments) {
        console.log(`[ADJ] ${adj.name.padEnd(30)}: App ${adj.app_bal.toFixed(0).padStart(6)} | Ex ${adj.ex_bal.toFixed(0).padStart(6)} | Missing ${adj.adjustment.toFixed(0).padStart(6)}`);
        totalAdjValue += adj.adjustment;
    }
    
    console.log(`\nTotal Missing Payments Found: ${missingPayments.length}`);
    console.log(`Total Value to Recover: ₱${totalAdjValue.toLocaleString()}`);

    const isDryRun = process.argv.includes('--dry-run');
    if (isDryRun) {
        console.log('\n--- DRY RUN: No changes made to database ---');
        return;
    }

    if (process.argv.includes('--execute')) {
        console.log('\n--- EXECUTING SYNC ---');
        for (const adj of missingPayments) {
            const { error } = await supabase.from('app_payments').insert({
                id: crypto.randomUUID(),
                loan_id: adj.loan_id,
                amount: adj.adjustment,
                payment_date: '2026-03-21T00:00:00Z',
                notes: 'Reconciliation sync from DCM-as-of-march-21.xlsx',
                collector_id: adj.collector_id,
                created_at: new Date().toISOString()
            });
            
            if (error) {
                console.error(`Error for ${adj.name}: ${error.message}`);
            } else {
                console.log(`Recovered ₱${adj.adjustment} for ${adj.name}`);
            }
        }
        console.log('\nSync Complete!');
    } else {
        console.log('\nUse --execute to apply these changes.');
    }
}

sync().catch(err => {
    console.error(err);
    process.exit(1);
});
