const ExcelJS = require('exceljs');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DRY_RUN = true; // SET TO FALSE TO APPLY CHANGES

function normalize(name) {
    if (!name) return '';
    return name.toString().toLowerCase()
        .replace(/\./g, ' ')
        .replace(/,/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function reconcile() {
    console.log(`Starting Reconciliation (DRY_RUN=${DRY_RUN})...`);

    // 1. Fetch all Supabase Borrowers
    console.log('Fetching borrowers...');
    const { data: rawBorrowers, error: bErr } = await supabase.from('app_borrowers').select('id, full_name');
    if (bErr) throw bErr;
    const borrowerMap = {};
    rawBorrowers.forEach(b => borrowerMap[b.id] = b.full_name);

    // 2. Fetch all Active Loans
    console.log('Fetching active loans...');
    const { data: sbLoans, error: lErr } = await supabase.from('app_loans').select('*').eq('status', 'active');
    if (lErr) throw lErr;

    // 3. Fetch all payments
    console.log('Fetching all payments...');
    let allPayments = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase.from('app_payments').select('loan_id, amount, payment_date').range(from, from + 4999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allPayments.push(...data);
        if (data.length < 5000) break;
        from += 5000;
    }
    console.log(`Loaded ${allPayments.length} existing payments.`);

    // 4. Parse Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('DCM-as-of-march-21.xlsx');
    const sheet = workbook.getWorksheet('DATA of Clients');

    let loansToMarkPaid = [];
    let paymentsToImport = [];
    let reductionAmount = 0;
    let importAmount = 0;

    // Headers are on Row 12
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber < 13) return;

        const nameRaw = row.getCell(1).value;
        if (!nameRaw || nameRaw === 'Total') return;

        const nameNorm = normalize(nameRaw);
        const cycle = parseInt(row.getCell(9).value) || 1;
        const excelTotalLoan = parseFloat(row.getCell(18).value) || 0;
        const excelBalance = parseFloat(row.getCell(19).value) || 0;

        // Pattern matching: Find possible loan in DB
        const candidates = sbLoans.filter(l => {
            const sbName = normalize(borrowerMap[l.borrower_id]);
            return sbName === nameNorm && (l.cycle === cycle || !l.cycle);
        });

        if (candidates.length === 0) return;

        // Closest match by total amount
        const dbLoan = candidates.sort((a,b) => Math.abs(a.total_amount - excelTotalLoan) - Math.abs(b.total_amount - excelTotalLoan))[0];

        // Check color
        const fgColor = row.getCell(1).style && row.getCell(1).style.fill && row.getCell(1).style.fill.fgColor;
        const isRed = fgColor && (fgColor.argb === 'FFFF0000' || fgColor.argb === 'FFFFC0CB' || fgColor.theme === 5);

        if (isRed) {
            loansToMarkPaid.push(dbLoan.id);
            const loanPayments = allPayments.filter(p => p.loan_id === dbLoan.id);
            const paid = loanPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
            const balance = (parseFloat(dbLoan.total_amount) || 0) - paid;
            reductionAmount += Math.max(0, balance);
            console.log(`[STATUS] ${nameRaw} (Cycle ${cycle}) is RED. Mark as PAID. (Bal: ${balance.toFixed(2)})`);
        }

        // Check Late Payments (BG-CA)
        for (let col = 59; col <= 79; col++) {
            const amt = parseFloat(row.getCell(col).value);
            if (amt > 0) {
                const dateVal = sheet.getRow(12).getCell(col).value;
                const paidDate = dateVal instanceof Date ? dateVal.toISOString().split('T')[0] : null;

                if (paidDate) {
                    const exists = allPayments.find(p => 
                        p.loan_id === dbLoan.id && 
                        Math.abs(parseFloat(p.amount) - amt) < 0.1 && 
                        p.payment_date === paidDate
                    );

                    if (!exists) {
                        paymentsToImport.push({
                            loan_id: dbLoan.id,
                            borrower_id: dbLoan.borrower_id,
                            amount: amt,
                            payment_date: paidDate,
                            notes: 'Imported from Excel (Late Payment BG-CA)',
                            payment_method: 'cash',
                            status: 'cleared',
                            collector_name: 'System Sync'
                        });
                        importAmount += amt;
                        console.log(`[PAYMENT] ${nameRaw} (Row ${rowNumber}) on ${paidDate}: +PHP ${amt}`);
                    }
                }
            }
        }
    });

    console.log('\n--- RECONCILIATION SUMMARY ---');
    console.log(`Loans to mark as PAID: ${loansToMarkPaid.length}`);
    console.log(`Target Reduction: PHP ${reductionAmount.toFixed(2)}`);
    console.log(`Payments to import: ${paymentsToImport.length}`);
    console.log(`Target Import: PHP ${importAmount.toFixed(2)}`);

    if (!DRY_RUN) {
        if (loansToMarkPaid.length > 0) {
            console.log('UPDATING DB...');
            await supabase.from('app_loans').update({ status: 'paid' }).in('id', loansToMarkPaid);
        }
        if (paymentsToImport.length > 0) {
             for (let i = 0; i < paymentsToImport.length; i += 100) {
                 await supabase.from('app_payments').insert(paymentsToImport.slice(i, i + 100));
             }
        }
        console.log('DONE!');
    }
}

reconcile().catch(console.error);
