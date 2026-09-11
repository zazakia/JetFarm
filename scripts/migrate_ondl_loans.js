const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env.production') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase credentials in .env.production");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const isCommit = process.argv.includes('--commit');

// Mapping dictionary for borrower names to database IDs to prevent duplicate profile creation
const nameMapping = {
  'milben rex balao': '68759dec-40e5-43cd-bd1c-541b00a7bf1c',       // Milben Rex P. Balao
  'raul marcial s. almacin': 'e88dc6c2-1447-4fce-9379-af3b998d2027', // Marcial Raul S. Almacin
  'jociel c. esmero': '22077223-b477-4b79-9906-c760ceca0ad4',        // Jociel G. Esmero
  'milagros villamor': '47ef0075-f2e3-49cd-afe4-a43c28a4bfc6',       // Milagros M. Villamor
  'salvador villamor': '099bb3ff-ec22-496f-99a7-affd6b65c4d7',       // Salvador B. Villamor
  'hazel q. bulacan': 'e1d243eb-7d36-48aa-96eb-9c0bf8e32a37',        // Hazel Bulacan
  'analyn a. cabahug': 'ae6d58cb-36ff-43b6-9428-eaa57cf1f3f1',       // Analyn Cabahug
  'limuel omega': '5a347ae1-53e5-4ad1-9990-1b2f05d22aba',            // Limuel P. Omega
  'jaime cayetano': '90dba04c-15f1-41b8-91b0-29f7a3f516b7'           // Jaime Cayetano Jr.
};

const excelDate = (num) => {
    if (!num || isNaN(num)) return null;
    const date = new Date((num - 25569) * 86400 * 1000);
    return date.toISOString();
};

function splitName(fullName) {
    if (!fullName) return { first: '', last: '', full: '' };
    const cleanName = fullName.trim();
    if (cleanName.includes(',')) {
        const parts = cleanName.split(',').map(p => p.trim());
        return {
            last: parts[0],
            first: parts[1] || '',
            full: `${parts[1] || ''} ${parts[0]}`.trim().replace(/\s+/g, ' ')
        };
    } else {
        const parts = cleanName.split(/\s+/);
        if (parts.length === 1) return { first: parts[0], last: '', full: parts[0] };
        const last = parts.pop();
        const first = parts.join(' ');
        return {
            first: first,
            last: last,
            full: cleanName
        };
    }
}

async function migrate() {
    console.log(`=== ON DEMAND LETTER LOANS MIGRATION (${isCommit ? 'COMMIT' : 'DRY-RUN'}) ===`);
    
    // 1. Fetch all existing borrowers from DB to match directly where possible
    const { data: dbBorrowers, error: bErr } = await supabase.from('app_borrowers').select('id, full_name');
    if (bErr) throw bErr;
    
    const dbBorrowerMap = new Map();
    dbBorrowers.forEach(b => {
        dbBorrowerMap.set(b.full_name.toLowerCase().replace(/\s+/g, ' '), b.id);
    });
    
    // 2. Read Excel
    const file = path.join(process.cwd(), 'docs/onDLLoaner2026 (1).xlsx');
    const wb = xlsx.readFile(file);
    
    const rawLoans = [];
    
    // Helper to read a sheet
    const parseSheet = (sheetName) => {
        const sheet = wb.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        for (let i = 7; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;
            
            const dlNo = row[0] ? String(row[0]).trim() : '';
            if (dlNo.includes('Nothing Follows') || dlNo.includes('xxxxxx') || dlNo.toLowerCase().includes('total')) {
                continue;
            }
            if (!dlNo && (!row[1] || String(row[1]).trim() === '')) {
                continue;
            }
            
            const name = row[1] ? String(row[1]).trim() : '';
            const loanAmount = typeof row[4] === 'number' ? row[4] : 0;
            const dateReleased = excelDate(row[5]);
            const dueDate = excelDate(row[6]);
            const dueAmount = typeof row[8] === 'number' ? row[8] : 0;
            const interest = typeof row[10] === 'number' ? row[10] : 0;
            const penalty = typeof row[12] === 'number' ? row[12] : 0;
            const total = typeof row[14] === 'number' ? row[14] : 0;
            const payment = typeof row[16] === 'number' ? row[16] : 0;
            const remaining = typeof row[18] === 'number' ? row[18] : 0;
            
            rawLoans.push({
                sheet: sheetName,
                dlNo,
                name,
                loanAmount,
                dateReleased,
                dueDate,
                dueAmount,
                interest,
                penalty,
                total,
                payment,
                remaining
            });
        }
    };
    
    parseSheet('OnDL2025');
    parseSheet('OnDL2026');
    
    console.log(`Loaded ${rawLoans.length} total loan rows from Excel.`);
    
    // 3. Deduplicate loans
    // Let's identify unique loans. If two rows have the same borrower, same release date, and same principal amount, they represent the same loan.
    // We will keep the latest sheet's row (OnDL2026 is preferred over OnDL2025).
    const uniqueLoansMap = new Map();
    
    rawLoans.forEach(l => {
        // Standardize name for matching key
        const normName = l.name.toLowerCase().replace(/\s+/g, ' ');
        const dateKey = l.dateReleased ? l.dateReleased.split('T')[0] : 'nodate';
        const key = `${normName}_${dateKey}_${l.loanAmount}`;
        
        if (uniqueLoansMap.has(key)) {
            // Compare which one is more recent or preferred
            const existing = uniqueLoansMap.get(key);
            if (l.sheet === 'OnDL2026') {
                // Prefer OnDL2026 because it has the most updated status, payments, and 2026- prefix DL No if renamed
                uniqueLoansMap.set(key, l);
            }
        } else {
            uniqueLoansMap.set(key, l);
        }
    });
    
    const uniqueLoans = Array.from(uniqueLoansMap.values());
    console.log(`Deduplicated to ${uniqueLoans.length} unique loans.`);
    
    // 4. Resolve Borrowers
    const borrowersToCreate = [];
    const nameToBorrowerId = {};
    
    // Local cache for newly created borrowers in this run
    const localCreatedBorrowerMap = new Map();
    
    for (const l of uniqueLoans) {
        const normName = l.name.toLowerCase().replace(/\s+/g, ' ');
        
        let borrowerId = null;
        
        // Check fuzzy mapping dictionary first
        if (nameMapping[normName]) {
            borrowerId = nameMapping[normName];
        } else if (dbBorrowerMap.has(normName)) {
            // Match direct database
            borrowerId = dbBorrowerMap.get(normName);
        } else if (localCreatedBorrowerMap.has(normName)) {
            borrowerId = localCreatedBorrowerMap.get(normName);
        }
        
        if (!borrowerId) {
            // Must create a new borrower
            borrowerId = crypto.randomUUID();
            const { first, last, full } = splitName(l.name);
            
            borrowersToCreate.push({
                id: borrowerId,
                full_name: full,
                first_name: first,
                last_name: last,
                membership_status: 'Active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            
            localCreatedBorrowerMap.set(normName, borrowerId);
            console.log(`Will create borrower: "${full}" (ID: ${borrowerId})`);
        }
        
        nameToBorrowerId[normName] = borrowerId;
    }
    
    console.log(`Borrowers to create: ${borrowersToCreate.length}`);
    
    // 5. Build inserts for Loans, Payments, Penalties, and Schedules
    const loansToInsert = [];
    const paymentsToInsert = [];
    const penaltiesToInsert = [];
    const schedulesToInsert = [];
    
    uniqueLoans.forEach(l => {
        const normName = l.name.toLowerCase().replace(/\s+/g, ' ');
        const borrowerId = nameToBorrowerId[normName];
        
        const loanId = crypto.randomUUID();
        
        // If loan was removed in 2026 sheet, mark as paid. If remaining balance is <= 0, mark as paid.
        // Wait, what about loans only in 2025? (e.g. Shalou, Milben, Dorotea)
        // Since they are not in 2026 sheet, they are marked as paid.
        let status = 'active';
        if (l.sheet === 'OnDL2025' && !rawLoans.some(r => r.sheet === 'OnDL2026' && r.name === l.name)) {
            status = 'paid';
        } else if (l.remaining <= 0) {
            status = 'paid';
        }
        
        loansToInsert.push({
            id: loanId,
            borrower_id: borrowerId,
            loan_number: l.dlNo,
            loan_type: 'Demand-' + l.dlNo,
            principal_amount: l.loanAmount,
            interest_rate: 2, // 2% flat per month
            interest_type: 'flat',
            term: 5, // 5 months
            term_unit: 'months',
            frequency: 'monthly',
            total_amount: l.total,
            installment_amount: 0,
            interest_amount: l.interest,
            release_date: l.dateReleased,
            maturity_date: l.dueDate,
            status: status,
            is_delinquent: status === 'active',
            delinquent_since: status === 'active' ? (l.dueDate ? new Date(l.dueDate).getTime() : Date.now()) : null,
            notes: `Migrated from onDLLoaner2026.xlsx (${l.sheet})`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        
        // Penalty record
        if (l.penalty > 0) {
            const pDate = l.dueDate ? new Date(l.dueDate).getTime() : Date.now();
            penaltiesToInsert.push({
                id: crypto.randomUUID(),
                loan_id: loanId,
                amount: l.penalty,
                penalty_date: pDate,
                reason: 'Excel Migration Gap (Penalty)',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        }
        
        // Payment record
        if (l.payment > 0) {
            paymentsToInsert.push({
                id: crypto.randomUUID(),
                loan_id: loanId,
                borrower_id: borrowerId,
                amount: l.payment,
                payment_date: new Date().toISOString(),
                notes: 'Migrated payment',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        }
        
        // Schedule record
        schedulesToInsert.push({
            id: crypto.randomUUID(),
            loan_id: loanId,
            due_date: l.dueDate || new Date().toISOString(),
            scheduled_amount: l.total,
            status: status === 'paid' ? 'paid' : 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
    });
    
    console.log(`Loans to insert: ${loansToInsert.length}`);
    console.log(`Penalties to insert: ${penaltiesToInsert.length}`);
    console.log(`Payments to insert: ${paymentsToInsert.length}`);
    console.log(`Schedules to insert: ${schedulesToInsert.length}`);
    
    // 6. Execute inserts if --commit
    if (isCommit) {
        console.log('Cleaning up existing Demand loans, schedules, payments, and penalties...');
        const { data: existingLoans, error: fetchErr } = await supabase
            .from('app_loans')
            .select('id')
            .ilike('loan_type', 'Demand-%');
        
        if (fetchErr) console.error('Error fetching existing loans for cleanup:', fetchErr.message);
        
        if (existingLoans && existingLoans.length > 0) {
            const loanIds = existingLoans.map(l => l.id);
            console.log(`Found ${loanIds.length} existing Demand loans in DB. Removing related records...`);
            
            const { error: delSchedErr } = await supabase.from('app_payment_schedules').delete().in('loan_id', loanIds);
            if (delSchedErr) console.error('Error cleaning schedules:', delSchedErr.message);
            
            const { error: delPayErr } = await supabase.from('app_payments').delete().in('loan_id', loanIds);
            if (delPayErr) console.error('Error cleaning payments:', delPayErr.message);
            
            const { error: delPenErr } = await supabase.from('app_loan_penalties').delete().in('loan_id', loanIds);
            if (delPenErr) console.error('Error cleaning penalties:', delPenErr.message);
            
            const { error: delLoanErr } = await supabase.from('app_loans').delete().in('id', loanIds);
            if (delLoanErr) console.error('Error cleaning loans:', delLoanErr.message);
        }

        if (borrowersToCreate.length > 0) {
            console.log('Inserting borrowers...');
            const { error: bErr } = await supabase.from('app_borrowers').insert(borrowersToCreate);
            if (bErr) throw bErr;
            console.log('Borrowers inserted successfully.');
        }
        
        if (loansToInsert.length > 0) {
            console.log('Inserting loans...');
            const { error: lErr } = await supabase.from('app_loans').insert(loansToInsert);
            if (lErr) throw lErr;
            console.log('Loans inserted successfully.');
        }
        
        if (penaltiesToInsert.length > 0) {
            console.log('Inserting penalties...');
            const { error: pErr } = await supabase.from('app_loan_penalties').insert(penaltiesToInsert);
            if (pErr) throw pErr;
            console.log('Penalties inserted successfully.');
        }
        
        if (paymentsToInsert.length > 0) {
            console.log('Inserting payments...');
            const { error: payErr } = await supabase.from('app_payments').insert(paymentsToInsert);
            if (payErr) throw payErr;
            console.log('Payments inserted successfully.');
        }
        
        if (schedulesToInsert.length > 0) {
            console.log('Inserting schedules...');
            const { error: sErr } = await supabase.from('app_payment_schedules').insert(schedulesToInsert);
            if (sErr) throw sErr;
            console.log('Payment schedules inserted successfully.');
        }
        
        console.log('=== MIGRATION COMPLETED SUCCESSFULLY ===');
    } else {
        console.log('\nDRY-RUN completed. Use node scripts/migrate_ondl_loans.js --commit to perform migration.');
    }
}

migrate().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
