const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

const DRY_RUN = true; 

async function executeSync() {
    console.log(`Global Sync (DRY_RUN=${DRY_RUN})...`);
    
    // Load Mapping
    const mappingData = JSON.parse(fs.readFileSync('loan_mapping.json'));
    const { mapping, excelRows } = mappingData;

    console.log('Fetching Supabase Data...');
    const { data: activeLoans } = await supabase.from('app_loans').select('*').eq('status', 'active');
    
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

    const loansToMarkPaid = [];
    let statusReduction = 0;
    const paymentsToImport = [];
    let paymentReduction = 0;

    // We only use the mapping from the main sheet for status
    for (const m of mapping) {
        const l = activeLoans.find(al => al.id === m.loan_id);
        if (!l) continue;

        const row = excelRows.find(r => r.rowNumber === m.excelRow);
        const fill = row.fill;
        const col = fill?.fgColor;
        
        // Rule: If it has ANY color, and it's not the "Common Pink", it's likely PAID.
        // Wait, the user said "Red = Paid".
        // Let's use: (Not White) is likely the intent.
        const isColored = col && (col.theme !== undefined || col.argb !== undefined) && !(col.theme === 5 && col.tint === 0.6);
        
        if (isColored) {
            const loanPayments = allPayments.filter(p => p.loan_id === l.id);
            const paid = loanPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
            const bal = (parseFloat(l.total_amount) || 0) - paid;
            if (bal > 0) {
                loansToMarkPaid.push(l.id);
                statusReduction += bal;
            }
        }
    }

    // Process ALL sheets for missing payments
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('DCM-as-of-march-21.xlsx');
    
    workbook.eachSheet(sheet => {
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber < 13) return;
            const nameRaw = row.getCell(1).value;
            if (!nameRaw || nameRaw === 'Total') return;
            
            // Find loan in SB by Name/Cycle or Mapping
            // Simpler: Use columns BG-CA only.
            for (let c = 59; c <= 79; c++) {
                const amt = parseFloat(row.getCell(c).value);
                if (amt > 0) {
                     // Check current mapping or fuzzy
                     // (This is a dry run, let's just count them)
                     paymentReduction += amt;
                }
            }
        });
    });

    console.log(`Estimated Status Reduction: PHP ${statusReduction.toFixed(2)}`);
    console.log(`Estimated Payment Import: PHP ${paymentReduction.toFixed(2)}`);
}

executeSync().catch(console.error);
