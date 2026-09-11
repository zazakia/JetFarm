const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function normalize(s) {
    return s ? s.toString().trim().toUpperCase().replace(/\s+/g, '') : "";
}

async function run() {
    console.log('Generating Final Per-Collector Report...');
    
    const { data: collectors } = await supabase.from('app_collectors').select('id, full_name');
    const { data: loans } = await supabase.from('app_loans').select('id, collector_id, total_amount').eq('status', 'active');
    
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

    const appSummary = {};
    collectors.forEach(c => {
        appSummary[normalize(c.full_name)] = { name: c.full_name, total: 0, count: 0 };
    });
    loans.forEach(l => {
        const coll = collectors.find(c => c.id === l.collector_id);
        if (coll) {
            const norm = normalize(coll.full_name);
            const bal = parseFloat(l.total_amount) - (payMap[l.id] || 0);
            appSummary[norm].total += bal;
            appSummary[norm].count += 1;
        }
    });

    const workbook = xlsx.readFile('./DCM-as-of-march-21.xlsx');
    const exSummary = {};
    const sheets = ['JAYSON CAYANONG', 'CRIS JUNCO', 'Gerald Gera'];
    
    sheets.forEach(s => {
        const ws = workbook.Sheets[s];
        if (!ws) return;
        const sheetData = xlsx.utils.sheet_to_json(ws, { header: 1 });
        let headerIndex = -1;
        for (let i = 0; i < Math.min(sheetData.length, 50); i++) {
            const row = sheetData[i];
            if (row && row.some(cell => cell && typeof cell === 'string' && cell.toUpperCase().includes('NAME OF CLIENT'))) {
                headerIndex = i;
                break;
            }
        }

        if (headerIndex === -1) {
            console.log(`Warning: Header not found in sheet ${s}`);
            // Fallback to range 6 for CRIS JUNCO
            if (s === 'CRIS JUNCO') headerIndex = 6;
            else return;
        }

        const rows = xlsx.utils.sheet_to_json(ws, { range: headerIndex });
        let total = 0;
        let count = 0;
        rows.forEach(r => {
            const name = r['Name Of Client'];
            if (!name || typeof name !== 'string' || name.toUpperCase().includes('TOTAL')) return;
            const bal = parseFloat(r['Total Loan Balance']);
            if (!isNaN(bal)) { total += bal; count += 1; }
        });
        exSummary[normalize(s)] = { total, count, sheetName: s };
    });

    console.log('\n--- VERIFIED GLOBAL RECONCILIATION ---');
    console.log('Collector'.padEnd(23), '| Clients (App/Ex) | Balance (App)     | Balance (Excel)   | Variance');
    console.log('-'.repeat(95));

    const specialMap = { 'CRESENCIOJUNCO': 'CRISJUNCO' };

    for (const app of collectors) {
        const appNorm = normalize(app.full_name);
        if (appNorm === 'OFFICE') continue;
        
        const exKey = specialMap[appNorm] || appNorm;
        const appData = appSummary[appNorm] || { total: 0, count: 0, name: app.full_name };
        const exData = exSummary[exKey] || { total: 0, count: 0 };
        
        const variance = appData.total - exData.total;
        const clients = `${appData.count.toString().padStart(3)} / ${exData.count.toString().padStart(3)}`;
        
        console.log(`${app.full_name.padEnd(23)} | ${clients.padEnd(16)} | ₱${appData.total.toLocaleString().padStart(12)} | ₱${exData.total.toLocaleString().padStart(12)} | ₱${variance.toLocaleString().padStart(12)}`);
    }
}

run().catch(console.error);
