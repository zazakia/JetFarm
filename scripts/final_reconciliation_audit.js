const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalize(s) {
    if (!s) return "";
    return s.toString().trim().toUpperCase().replace(/\s+/g, ' ');
}

async function run() {
    console.log('--- LINE-BY-LINE AUDIT: APP VS EXCEL ---');
    console.log('Fetching App Data...');

    const { data: borrowers } = await supabase.from('app_borrowers').select('id, full_name');
    const { data: loans } = await supabase.from('app_loans').select('id, borrower_id, total_amount').eq('status', 'active');
    
    let allPayments = [];
    let from = 0;
    while (true) {
        const { data } = await supabase.from('app_payments').select('loan_id, amount').range(from, from + 999);
        if (!data || data.length === 0) break;
        allPayments = allPayments.concat(data);
        if (data.length < 1000) break;
        from += 1000;
    }
    const payMap = {};
    allPayments.forEach(p => { payMap[p.loan_id] = (payMap[p.loan_id] || 0) + parseFloat(p.amount); });

    const bMap = {};
    borrowers.forEach(b => bMap[b.id] = b.full_name);

    const appLoans = loans.map(l => {
        const name = bMap[l.borrower_id] || "Unknown";
        const bal = parseFloat(l.total_amount) - (payMap[l.id] || 0);
        return { name, norm: normalize(name), balance: bal };
    });

    console.log('Reading Excel Master (DATA of Clients)...');
    const workbook = xlsx.readFile('./DCM-as-of-march-21.xlsx');
    const ws = workbook.Sheets['DATA of Clients'];
    const exRows = xlsx.utils.sheet_to_json(ws, { range: 0 }); // Master sheet usually has headers at Row 1
    
    // Find proper header row if range:0 fails
    let realRows = exRows;
    if (!exRows[0]['Name Of Client']) {
        for (let i = 1; i < 15; i++) {
             const temp = xlsx.utils.sheet_to_json(ws, { range: i });
             if (temp[0] && temp[0]['Name Of Client']) {
                 realRows = temp;
                 break;
             }
        }
    }

    const excelLoans = [];
    realRows.forEach(r => {
        const name = r['Name Of Client'];
        if (!name || typeof name !== 'string' || name.toUpperCase().includes('TOTAL')) return;
        const bal = parseFloat(r['Total Loan Balance']);
        if (!isNaN(bal)) {
            excelLoans.push({ name, norm: normalize(name), balance: bal });
        }
    });

    console.log('\n--- DISCREPANCIES FOUND ---');
    console.log('Client Name'.padEnd(30), '| App Balance'.padStart(15), '| Excel Balance'.padStart(15), '| Difference');
    console.log('-'.repeat(75));

    const allNormNames = new Set([...appLoans.map(a => a.norm), ...excelLoans.map(e => e.norm)]);
    let totalDiff = 0;
    let mismatchCount = 0;

    for (const norm of allNormNames) {
        const app = appLoans.find(a => a.norm === norm);
        const ex = excelLoans.find(e => e.norm === norm);
        
        const appBal = app ? app.balance : 0;
        const exBal = ex ? ex.balance : 0;
        const diff = appBal - exBal;

        if (Math.abs(diff) > 1) {
            const displayName = (app ? app.name : ex.name).substring(0, 30);
            console.log(`${displayName.padEnd(30)} | ₱${appBal.toLocaleString().padStart(12)} | ₱${exBal.toLocaleString().padStart(12)} | ₱${diff.toLocaleString().padStart(10)}`);
            totalDiff += diff;
            mismatchCount++;
        }
    }

    console.log('-'.repeat(75));
    console.log(`Total Discrepancies: ${mismatchCount}`);
    console.log(`Net Difference: ₱${totalDiff.toLocaleString()}`);
    console.log(`\nApp Total: ₱${appLoans.reduce((s,a) => s+a.balance, 0).toLocaleString()}`);
    console.log(`Excel Total: ₱${excelLoans.reduce((s,e) => s+e.balance, 0).toLocaleString()}`);
}

run().catch(console.error);
