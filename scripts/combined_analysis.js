const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalize(s) {
    return s ? s.toString().trim().toUpperCase().replace(/\s+/g, ' ') : "";
}

async function run() {
    console.log('--- COMBINED RECONCILIATION ANALYSIS ---');
    
    const { data: borrowers } = await supabase.from('app_borrowers').select('id, full_name');
    const { data: collectors } = await supabase.from('app_collectors').select('id, full_name');
    const { data: loans } = await supabase.from('app_loans').select('id, borrower_id, collector_id, total_amount').eq('status', 'active');
    
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

    // App Totals (Combined)
    let appTotal = 0;
    let appCount = 0;
    const targetCollectors = ['Jayson Cayanong', 'Gerald Gera'];
    
    loans.forEach(l => {
        const coll = collectors.find(c => c.id === l.collector_id);
        if (coll && targetCollectors.includes(coll.full_name)) {
            const bal = parseFloat(l.total_amount) - (payMap[l.id] || 0);
            appTotal += bal;
            appCount += 1;
        }
    });

    // Excel Totals (Combined)
    const workbook = xlsx.readFile('./DCM-as-of-march-21.xlsx');
    let excelTotal = 0;
    let excelCount = 0;
    
    const sheets = ['JAYSON CAYANONG', 'Gerald Gera'];
    sheets.forEach(s => {
        const ws = workbook.Sheets[s];
        if (!ws) return;
        const sheetData = xlsx.utils.sheet_to_json(ws, { header: 1 });
        let headerIndex = -1;
        for (let i = 0; i < Math.min(sheetData.length, 50); i++) {
            if (sheetData[i] && sheetData[i].some(cell => cell && cell.toString().toUpperCase().includes('NAME OF CLIENT'))) {
                headerIndex = i;
                break;
            }
        }
        if (headerIndex === -1) return;
        const rows = xlsx.utils.sheet_to_json(ws, { range: headerIndex });
        rows.forEach(r => {
            const name = r['Name Of Client'];
            if (!name || typeof name !== 'string' || name.toUpperCase().includes('TOTAL')) return;
            const bal = parseFloat(r['Total Loan Balance']);
            if (!isNaN(bal)) {
                excelTotal += bal;
                excelCount += 1;
            }
        });
    });

    console.log(`\n=== Jayson + Gerald Combined ===`);
    console.log(`App (Combined): ${appCount} clients | ₱${appTotal.toLocaleString()}`);
    console.log(`EXCEL (Combined): ${excelCount} clients | ₱${excelTotal.toLocaleString()}`);
    console.log(`Variance: ₱${(appTotal - excelTotal).toLocaleString()}`);
}

run().catch(console.error);
