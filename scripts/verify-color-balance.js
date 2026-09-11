const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function verify() {
    const data = JSON.parse(fs.readFileSync('loan_mapping.json'));
    const { mapping, excelRows } = data;

    console.log('Fetching active loans from DB...');
    const { data: activeLoans } = await supabase.from('app_loans').select('*').eq('status', 'active');
    
    console.log('Fetching payments...');
    let allPayments = [];
    let from = 0;
    while(true) {
        const { data, error } = await supabase.from('app_payments').select('loan_id, amount, payment_date').range(from, from+4999);
        if(error) throw error;
        if(!data || data.length === 0) break;
        allPayments.push(...data);
        if(data.length < 5000) break;
        from += 5000;
    }

    let statusDiscrepancyAmount = 0;
    const statusCandidates = [];

    for (const m of mapping) {
        const row = excelRows.find(r => r.rowNumber === m.excelRow);
        const l = activeLoans.find(al => al.id === m.loan_id);
        if (!l) continue;

        const fill = row.fill;
        const color = fill && fill.fgColor;
        // Logic: Colored = Red/Pink = Paid
        const isColored = color && (color.theme !== undefined || color.argb !== undefined);
        
        if (isColored) {
            const loanPayments = allPayments.filter(p => p.loan_id === l.id);
            const paid = loanPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
            const bal = (parseFloat(l.total_amount) || 0) - paid;
            if (bal > 0) {
                statusCandidates.push({ name: m.name, balance: bal });
                statusDiscrepancyAmount += bal;
                // console.log(`CANDIDATE: ${m.name} (Row ${m.excelRow}) Bal: ${bal}`);
            }
        }
    }

    console.log(`\nReconciliation Audit Result:`);
    console.log(`Status Discrepancy Amount (Colored Rows): PHP ${statusDiscrepancyAmount.toFixed(2)}`);
    console.log(`Candidate count: ${statusCandidates.length}`);
}

verify().catch(console.error);
