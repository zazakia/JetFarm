const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

const DRY_RUN = false; 

const TARGET_STATUS_NAMES = [
    'arlene g. omapoy', 'Rowena Misperos', 'Maria Rogelyn Sestoso', 'Hipolito Alao', 
    'Cristina Tidoy', 'Angelie Andrade', 'Michelle Galaging', 'Luzviminda G. Ybanez', 
    'Joey E. Peroso', 'Cindy A. Pastoril', 'Jonessa Doguiles', 'Florenda N. Cimene', 
    'Rosanna T. Germano', 'Dionesia Rosal', 'Cerlita Abastas', 'Arah C. Gastardo', 
    'Jemaima L. Gonzales', 'Cleofe Sasing', 'Gerry G. Casero', 'Nenita L.Orellano', 
    'Susan B. Guevarra', 'Mark Anthony Pastoril', 'Genara A. Cantiga', 'Fe B. Garbe'
];

async function executeSync() {
    console.log(`Starting Final Sync Execution (DRY_RUN=${DRY_RUN})...`);
    
    // 1. Load Mapping
    const mappingData = JSON.parse(fs.readFileSync('loan_mapping.json'));
    const { mapping, excelRows } = mappingData;

    // 2. Fetch Active Loans & Payments
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

    // 3. Process Status Updates
    for (const m of mapping) {
        const l = activeLoans.find(al => al.id === m.loan_id);
        if (!l) continue;

        const row = excelRows.find(r => r.rowNumber === m.excelRow);
        const col = row.fill?.fgColor;
        
        // Finalized Paid Indicator: Match by Name or Archive block
        const isPaid = (m.excelRow >= 690) || 
                       TARGET_STATUS_NAMES.some(n => m.name.toLowerCase().includes(n.toLowerCase()));
        
        if (isPaid) {
            const loanPayments = allPayments.filter(p => p.loan_id === l.id);
            const paid = loanPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
            const bal = (parseFloat(l.total_amount) || 0) - paid;
            if (bal > 0) {
                loansToMarkPaid.push(l.id);
                statusReduction += bal;
                // console.log(`[STATUS] ${m.name} (Row ${m.excelRow}) Bal: ${bal.toFixed(2)} -> Mark PAID`);
            }
        }
    }

    // 4. Process Payment Imports (Late payments BG-CA)
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('DCM-as-of-march-21.xlsx');
    const sheet = workbook.getWorksheet('DATA of Clients');

    for (const m of mapping) {
        const row = sheet.getRow(m.excelRow);
        // Columns BG to CA are 59 to 79
        for (let c = 59; c <= 79; c++) {
            const amt = parseFloat(row.getCell(c).value);
            if (amt > 0) {
                const dateVal = sheet.getRow(12).getCell(c).value;
                const dateStr = dateVal instanceof Date ? dateVal.toISOString().split('T')[0] : null;
                if (!dateStr) continue;

                // Check if already in SB
                const exists = allPayments.find(p => p.loan_id === m.loan_id && Math.abs(p.amount - amt) < 0.1 && p.payment_date === dateStr);
                if (!exists) {
                    paymentsToImport.push({
                        loan_id: m.loan_id,
                        borrower_id: activeLoans.find(l => l.id === m.loan_id)?.borrower_id,
                        amount: amt,
                        payment_date: dateStr,
                        notes: 'Imported from Excel (Late Payment BG-CA)',
                        payment_method: 'cash',
                        status: 'cleared',
                        collector_name: 'System Sync'
                    });
                    paymentReduction += amt;
                    // console.log(`[PAYMENT] ${m.name} ${dateStr}: PHP ${amt}`);
                }
            }
        }
    }

    console.log('\n--- FINAL RECONCILIATION SUMMARY ---');
    console.log(`Loans to mark PAID: ${loansToMarkPaid.length}`);
    console.log(`Status Reduction: PHP ${statusReduction.toFixed(2)}`);
    console.log(`Payments to import: ${paymentsToImport.length}`);
    console.log(`Payment Reduction: PHP ${paymentReduction.toFixed(2)}`);
    console.log(`TOTAL RECONCILIATION IMPACT: PHP ${(statusReduction + paymentReduction).toFixed(2)}`);
    console.log(`TARGET: PHP 20345.00`);

    if (!DRY_RUN) {
        console.log('\nAPPLYING CHANGES...');
        if (loansToMarkPaid.length > 0) {
            await supabase.from('app_loans').update({ status: 'paid' }).in('id', loansToMarkPaid);
        }
        if (paymentsToImport.length > 0) {
            for (let i = 0; i < paymentsToImport.length; i += 100) {
                await supabase.from('app_payments').insert(paymentsToImport.slice(i, i + 100));
            }
        }
        console.log('SYNC COMPLETE!');
    }
}

executeSync().catch(console.error);
