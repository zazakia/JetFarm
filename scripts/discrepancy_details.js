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
    console.log('--- RECONCILIATION DISCREPANCY ANALYSIS ---');
    
    const { data: borrowers } = await supabase.from('app_borrowers').select('id, full_name');
    const { data: collectors } = await supabase.from('app_collectors').select('id, full_name');
    const { data: loans } = await supabase.from('app_loans').select('id, borrower_id, collector_id, total_amount').eq('status', 'active');
    
    // Payments for balances
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

    // App Data Structure
    const appData = {};
    loans.forEach(l => {
        const coll = collectors.find(c => c.id === l.collector_id);
        if (!coll) return;
        const cName = coll.full_name;
        if (!appData[cName]) appData[cName] = [];
        
        const bName = bMap[l.borrower_id] || "Unknown";
        const bal = parseFloat(l.total_amount) - (payMap[l.id] || 0);
        appData[cName].push({ name: bName, norm: normalize(bName), balance: bal });
    });

    // Excel Data Structure
    const workbook = xlsx.readFile('./DCM-as-of-march-21.xlsx');
    const excelData = {};
    const sheets = ['JAYSON CAYANONG', 'CRIS JUNCO', 'Gerald Gera'];
    
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
        excelData[s] = [];
        rows.forEach(r => {
            const name = r['Name Of Client'];
            if (!name || typeof name !== 'string' || name.toUpperCase().includes('TOTAL')) return;
            const bal = parseFloat(r['Total Loan Balance']);
            if (!isNaN(bal)) {
                excelData[s].push({ name, norm: normalize(name), balance: bal });
            }
        });
    });

    console.log('\n=== JAYSON CAYANONG ANALYSIS ===');
    const jApp = appData['Jayson Cayanong'] || [];
    const jEx = excelData['JAYSON CAYANONG'] || [];
    
    const onlyInApp = jApp.filter(ap => !jEx.some(ex => ex.norm === ap.norm));
    console.log(`Clients in App but NOT in Excel (${onlyInApp.length}):`);
    onlyInApp.forEach(c => console.log(`  - ${c.name} (Balance: ${c.balance.toLocaleString()})`));

    console.log('\n=== GERALD GERA ANALYSIS ===');
    const gApp = appData['Gerald Gera'] || [];
    const gEx = excelData['Gerald Gera'] || [];
    
    const onlyInExcel = gEx.filter(ex => !gApp.some(ap => ap.norm === ex.norm));
    console.log(`Clients in Excel but NOT in App (${onlyInExcel.length}):`);
    onlyInExcel.forEach(c => console.log(`  - ${c.name} (Balance: ${c.balance.toLocaleString()})`));

}

run().catch(console.error);
