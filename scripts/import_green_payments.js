const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const wb = XLSX.readFile('data/brayan Import migration cleanup.xlsx', { cellStyles: true });
const ws = wb.Sheets['DATA of Clients'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const BH_COL = 59;
const CA_COL = 78;

// Production Supabase
const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const supabaseAnonKey = 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Section header rows with their batch info
const sectionRows = [
    { batch: '1R', row: 26 }, { batch: '3', row: 88 }, { batch: '3R', row: 111 },
    { batch: '4', row: 129 }, { batch: '4R', row: 154 }, { batch: '11R', row: 407 },
];

// Green rows identified
const greenRowDefs = [
    { row: 28, name: 'Maria Camila Lahoylahoy', sectionRow: 26 },
    { row: 34, name: 'Celerina R. Decio', sectionRow: 26 },
    { row: 42, name: 'Warlito R. Decio', sectionRow: 26 },
    { row: 44, name: 'Arcelene B. Castro', sectionRow: 26 },
    { row: 90, name: 'Marielle R. Decio', sectionRow: 88 },
    { row: 113, name: 'Emelita D. Tuico', sectionRow: 111 },
    { row: 145, name: 'Gleceria J. Teves', sectionRow: 129 },
    { row: 155, name: 'Ma. Jocelyn S. Rodriguez', sectionRow: 154 },
    { row: 166, name: 'Mario P. Pawa-an Jr.', sectionRow: 154 },
    { row: 417, name: 'Amy S. Abrahan', sectionRow: 407 },
];

// Function to get the next business day (skipping Sundays)
function nextBusinessDay(date) {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    // Skip Sunday (day 0)
    if (next.getDay() === 0) {
        next.setDate(next.getDate() + 1);
    }
    return next;
}

// For each section, get the last date from BG column and generate dates for BH onward
function getDatesForSection(sectionHeaderRow) {
    const headerRow = data[sectionHeaderRow];
    if (!headerRow) return {};
    
    // Collect all dates in the header row to find the pattern
    const dates = [];
    for (let c = 19; c <= 80; c++) {
        const v = headerRow[c];
        if (typeof v === 'number' && v > 40000 && v < 50000) {
            const d = XLSX.SSF.parse_date_code(v);
            dates.push({ col: c, date: new Date(d.y, d.m - 1, d.d) });
        }
    }
    
    if (dates.length === 0) return {};
    
    // Last date is at BG (col 58)
    const lastDate = dates[dates.length - 1].date;
    
    // Generate dates for BH (59) through CA (78)
    const dateMap = {};
    let currentDate = new Date(lastDate);
    for (let c = BH_COL; c <= CA_COL; c++) {
        currentDate = nextBusinessDay(currentDate);
        dateMap[c] = new Date(currentDate);
    }
    
    return dateMap;
}

// Normalize name for matching
function normName(n) {
    if (!n) return '';
    return n.toString().toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[.,]/g, '')
        .trim();
}

async function main() {
    // 1. Get all app loans with borrower info
    console.log('Fetching app data...');
    
    const { data: loans, error: le } = await supabase
        .from('app_loans')
        .select('id, borrower_id, loan_number, principal_amount, total_amount, status, collector_id')
        .eq('status', 'active')
        .is('deleted_at', null);
    if (le) { console.error('Loans error:', le); return; }
    
    const { data: borrowers, error: be } = await supabase
        .from('app_borrowers')
        .select('id, full_name');
    if (be) { console.error('Borrowers error:', be); return; }
    
    const { data: collectors, error: ce } = await supabase
        .from('app_collectors')
        .select('id, full_name');
    if (ce) { console.error('Collectors error:', ce); return; }
    
    // Get existing payments to avoid duplicates
    const { data: existingPayments, error: epe } = await supabase
        .from('app_payments')
        .select('loan_id, amount, payment_date')
        .is('deleted_at', null);
    if (epe) { console.error('Existing payments error:', epe); return; }
    
    const borrowerMap = {};
    for (const b of borrowers) borrowerMap[b.id] = b;
    
    // Build loans by borrower name
    const loansByName = {};
    for (const l of loans) {
        const b = borrowerMap[l.borrower_id];
        if (!b) continue;
        const key = normName(b.full_name);
        if (!loansByName[key]) loansByName[key] = [];
        loansByName[key].push({ ...l, borrower_name: b.full_name });
    }
    
    // Build existing payment lookup (loan_id + date -> amount)
    const existingPaymentSet = new Set();
    for (const p of existingPayments) {
        existingPaymentSet.add(`${p.loan_id}_${p.payment_date}_${parseFloat(p.amount)}`);
    }
    
    console.log(`Found ${loans.length} active loans, ${existingPayments.length} existing payments`);
    
    // 2. Process each green row
    const allPaymentsToInsert = [];
    const skipped = [];
    const notFound = [];
    
    for (const gr of greenRowDefs) {
        const row = data[gr.row];
        if (!row) { console.log(`Row ${gr.row} not found!`); continue; }
        
        const name = String(row[0]).trim();
        const key = normName(name);
        
        // Get date mapping for this section
        const dateMap = getDatesForSection(gr.sectionRow);
        
        // Find matching loan in app
        const appLoans = loansByName[key];
        if (!appLoans || appLoans.length === 0) {
            console.log(`❌ NOT FOUND in app: ${name}`);
            notFound.push(name);
            continue;
        }
        
        // Use first matching loan (or match by principal if multiple)
        const excelLoanAmt = parseFloat(row[11]) || 0; // Column L
        let loan = appLoans[0];
        for (const l of appLoans) {
            if (parseFloat(l.principal_amount) === excelLoanAmt) {
                loan = l;
                break;
            }
        }
        
        console.log(`\n✅ ${name} -> Loan ${loan.id} (Principal: ₱${loan.principal_amount})`);
        
        // Extract payments from BH-CA
        for (let c = BH_COL; c <= CA_COL; c++) {
            const v = row[c];
            if (v === undefined || v === null || v === '' || typeof v !== 'number' || v <= 0) continue;
            
            const paymentDate = dateMap[c];
            if (!paymentDate) {
                console.log(`  ⚠️ No date mapping for column ${XLSX.utils.encode_col(c)}`);
                continue;
            }
            
            const dateStr = paymentDate.toISOString().split('T')[0];
            const amount = v;
            
            // Check for duplicate
            const dupeKey = `${loan.id}_${dateStr}_${amount}`;
            if (existingPaymentSet.has(dupeKey)) {
                console.log(`  ⏭️ SKIP (duplicate): ${dateStr} ₱${amount}`);
                skipped.push({ name, date: dateStr, amount });
                continue;
            }
            
            console.log(`  💰 ${dateStr}: ₱${amount} (col ${XLSX.utils.encode_col(c)})`);
            
            allPaymentsToInsert.push({
                id: uuidv4(),
                loan_id: loan.id,
                collector_id: loan.collector_id,
                amount: amount,
                payment_date: dateStr + 'T08:00:00+08:00',
                notes: `Excel import BH-CA (col ${XLSX.utils.encode_col(c)})`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        }
    }
    
    console.log('\n========================================');
    console.log('           IMPORT SUMMARY');
    console.log('========================================');
    console.log(`Green rows processed:  ${greenRowDefs.length}`);
    console.log(`Not found in app:     ${notFound.length}`);
    console.log(`Payments to insert:   ${allPaymentsToInsert.length}`);
    console.log(`Skipped (duplicates): ${skipped.length}`);
    console.log(`Total amount:         ₱${allPaymentsToInsert.reduce((s, p) => s + p.amount, 0).toFixed(2)}`);
    
    if (notFound.length > 0) {
        console.log('\nNot found:', notFound.join(', '));
    }
    
    // Print payment details per borrower
    console.log('\n=== PAYMENT DETAILS ===');
    const byBorrower = {};
    for (const p of allPaymentsToInsert) {
        const name = greenRowDefs.find(g => {
            const appLoans = loansByName[normName(g.name)];
            return appLoans && appLoans.some(l => l.id === p.loan_id);
        })?.name || 'Unknown';
        if (!byBorrower[name]) byBorrower[name] = [];
        byBorrower[name].push(p);
    }
    
    for (const [name, payments] of Object.entries(byBorrower)) {
        const total = payments.reduce((s, p) => s + p.amount, 0);
        console.log(`${name}: ${payments.length} payments, total ₱${total}`);
        for (const p of payments) {
            console.log(`  ${p.payment_date}: ₱${p.amount}`);
        }
    }
    
    // Save for review before inserting
    fs.writeFileSync('payments_to_import.json', JSON.stringify(allPaymentsToInsert, null, 2));
    console.log('\n✅ Saved to payments_to_import.json for review');
    console.log('Run with --execute flag to actually insert into database');
    
    // If --execute flag, insert payments
    if (process.argv.includes('--execute')) {
        console.log('\n🚀 INSERTING PAYMENTS INTO DATABASE...');
        
        // Insert in batches of 20
        for (let i = 0; i < allPaymentsToInsert.length; i += 20) {
            const batch = allPaymentsToInsert.slice(i, i + 20);
            const { error } = await supabase.from('app_payments').insert(batch);
            if (error) {
                console.error(`Error inserting batch ${i}: ${error.message}`);
                return;
            }
            console.log(`  Inserted batch ${i / 20 + 1} (${batch.length} records)`);
        }
        
        console.log('✅ ALL PAYMENTS INSERTED SUCCESSFULLY!');
    }
}

main().catch(console.error);
