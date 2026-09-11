const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load excel data
const excelLoans = JSON.parse(fs.readFileSync('excel_loans.json', 'utf8'));

// Production Supabase
const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const supabaseAnonKey = 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function normName(n) {
    if (!n) return '';
    return n.toString().toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[.,]/g, '')
        .trim();
}

async function compare() {
    console.log('Fetching app data...');
    
    // Get all active loans
    const { data: loans, error: le } = await supabase
        .from('app_loans')
        .select('id, borrower_id, loan_number, principal_amount, total_amount, installment_amount, collector_id, status, batch, cycle')
        .eq('status', 'active')
        .is('deleted_at', null);
    if (le) { console.error('Loans error:', le); return; }
    
    // Get borrowers
    const { data: borrowers, error: be } = await supabase
        .from('app_borrowers')
        .select('id, full_name, address');
    if (be) { console.error('Borrowers error:', be); return; }
    
    // Get collectors
    const { data: collectors, error: ce } = await supabase
        .from('app_collectors')
        .select('id, full_name');
    if (ce) { console.error('Collectors error:', ce); return; }
    
    // Get all payments grouped
    const { data: payments, error: pe } = await supabase
        .from('app_payments')
        .select('loan_id, amount')
        .is('deleted_at', null);
    if (pe) { console.error('Payments error:', pe); return; }
    
    // Aggregate payments
    const paymentMap = {};
    for (const p of payments) {
        if (!paymentMap[p.loan_id]) paymentMap[p.loan_id] = 0;
        paymentMap[p.loan_id] += parseFloat(p.amount || 0);
    }
    
    const borrowerMap = {};
    for (const b of borrowers) borrowerMap[b.id] = b;
    const collectorMap = {};
    for (const c of collectors) collectorMap[c.id] = c;
    
    // Build app data with computed balance
    const appData = loans.map(l => {
        const b = borrowerMap[l.borrower_id] || {};
        const c = collectorMap[l.collector_id] || {};
        const totalPaid = paymentMap[l.id] || 0;
        const balance = parseFloat(l.total_amount || 0) - totalPaid;
        return {
            borrower_name: b.full_name || 'Unknown',
            address: b.address || '',
            collector: c.full_name || 'Unknown',
            principal: parseFloat(l.principal_amount || 0),
            total_amount: parseFloat(l.total_amount || 0),
            installment: parseFloat(l.installment_amount || 0),
            total_paid: totalPaid,
            balance: Math.round(balance * 100) / 100,
            loan_number: l.loan_number,
            batch: l.batch,
            cycle: l.cycle
        };
    });
    
    console.log('App active loans:', appData.length);
    
    // For each borrower in the Excel, get only the LATEST loan (highest batch/cycle)
    // Group Excel loans by normalized name
    const excelByName = {};
    for (const ex of excelLoans) {
        const key = normName(ex.name);
        if (!key || key === 'name of client' || key.includes('collector')) continue;
        if (!excelByName[key]) excelByName[key] = [];
        excelByName[key].push(ex);
    }
    
    // For each name, pick the loan with the highest batch then highest cycle
    const latestExcel = {};
    for (const [key, list] of Object.entries(excelByName)) {
        // Sort by batch desc, then cycle desc
        list.sort((a, b) => {
            const batchDiff = (b.batch || 0) - (a.batch || 0);
            if (batchDiff !== 0) return batchDiff;
            return (b.cycle || 0) - (a.cycle || 0);
        });
        latestExcel[key] = list[0]; // take the latest
    }
    
    console.log('Unique borrowers in Excel (latest loan only):', Object.keys(latestExcel).length);
    
    // Build app map by normalized name
    const appByName = {};
    for (const a of appData) {
        const key = normName(a.borrower_name);
        if (!appByName[key]) appByName[key] = [];
        appByName[key].push(a);
    }
    
    // Compare latest Excel vs App
    const matches = [];
    const mismatches = [];
    const excelOnly = [];
    const appNames = new Set(Object.keys(appByName));
    
    for (const [key, ex] of Object.entries(latestExcel)) {
        const exBalance = parseFloat(ex.total_loan_balance) || 0;
        const exLoanAmt = parseFloat(ex.loan_amount) || 0;
        const exTotalLoan = parseFloat(ex.total_loan) || 0;
        
        if (appByName[key]) {
            appNames.delete(key);
            const appEntries = appByName[key];
            
            // Try to match by principal amount
            let bestMatch = null;
            for (const a of appEntries) {
                if (a.principal === exLoanAmt) {
                    bestMatch = a;
                    break;
                }
            }
            if (!bestMatch) bestMatch = appEntries[0];
            
            const diff = Math.round((exBalance - bestMatch.balance) * 100) / 100;
            
            const entry = {
                name: ex.name,
                collector_excel: ex.collector,
                collector_app: bestMatch.collector,
                loan_amount_excel: exLoanAmt,
                loan_amount_app: bestMatch.principal,
                total_loan_excel: exTotalLoan,
                total_loan_app: bestMatch.total_amount,
                excel_balance: exBalance,
                app_balance: bestMatch.balance,
                difference: diff,
                batch: ex.batch,
                cycle: ex.cycle
            };
            
            if (Math.abs(diff) < 1) {
                matches.push(entry);
            } else {
                mismatches.push(entry);
            }
        } else {
            excelOnly.push({
                name: ex.name,
                collector: ex.collector,
                loan_amount: exLoanAmt,
                balance: exBalance,
                batch: ex.batch,
                cycle: ex.cycle
            });
        }
    }
    
    // App-only
    const appOnlyList = [...appNames].map(k => {
        const a = appByName[k][0];
        return { name: a.borrower_name, collector: a.collector, balance: a.balance, principal: a.principal };
    });
    
    // Sort mismatches by abs difference desc
    mismatches.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    
    console.log('\n========================================');
    console.log('         COMPARISON RESULTS');
    console.log('========================================');
    console.log('Balances MATCH:     ' + matches.length);
    console.log('Balances DIFFER:    ' + mismatches.length);
    console.log('Excel-only:         ' + excelOnly.length);
    console.log('App-only:           ' + appOnlyList.length);
    console.log('========================================');
    
    console.log('\n=== MISMATCHES (sorted by difference) ===');
    console.log('Name'.padEnd(35) + ' | ' + 'Excel Bal'.padStart(12) + ' | ' + 'App Bal'.padStart(12) + ' | ' + 'Diff'.padStart(12) + ' | Collector');
    console.log('-'.repeat(110));
    for (const m of mismatches) {
        console.log(
            m.name.padEnd(35) + ' | ' +
            m.excel_balance.toFixed(2).padStart(12) + ' | ' +
            m.app_balance.toFixed(2).padStart(12) + ' | ' +
            m.difference.toFixed(2).padStart(12) + ' | ' +
            m.collector_excel
        );
    }
    
    if (excelOnly.length > 0) {
        console.log('\n=== EXCEL-ONLY (not found in app) ===');
        for (const e of excelOnly) {
            console.log(e.name.padEnd(35) + ' | Balance: ' + (e.balance || 0).toFixed(2).padStart(10) + ' | ' + e.collector);
        }
    }
    
    if (appOnlyList.length > 0) {
        console.log('\n=== APP-ONLY (not found in excel) ===');
        for (const a of appOnlyList) {
            console.log(a.name.padEnd(35) + ' | Balance: ' + (a.balance || 0).toFixed(2).padStart(10) + ' | ' + a.collector);
        }
    }
    
    // Save full report
    const report = {
        summary: {
            total_unique_excel: Object.keys(latestExcel).length,
            total_app: appData.length,
            matched: matches.length,
            mismatched: mismatches.length,
            excel_only: excelOnly.length,
            app_only: appOnlyList.length,
            total_excel_balance: mismatches.reduce((s, m) => s + m.excel_balance, 0) + matches.reduce((s, m) => s + m.excel_balance, 0),
            total_app_balance: mismatches.reduce((s, m) => s + m.app_balance, 0) + matches.reduce((s, m) => s + m.app_balance, 0)
        },
        mismatches,
        matches,
        excel_only: excelOnly,
        app_only: appOnlyList
    };
    
    fs.writeFileSync('comparison_report.json', JSON.stringify(report, null, 2));
    console.log('\nFull report saved to comparison_report.json');
}

compare().catch(console.error);
