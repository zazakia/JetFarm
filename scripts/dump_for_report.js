const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// try multiple .env locations
const envs = ['.env', '.env.local', '.env.development'];
for (const env of envs) {
    if (fs.existsSync(env)) {
        dotenv.config({ path: env });
    }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
    console.error("EXPO_PUBLIC_SUPABASE_ANON_KEY is missing from environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDatabase() {
    // 1. Fetch borrowers
    const { data: borrowers, error: borrowersError } = await supabase
        .from('app_borrowers')
        .select('id, first_name, last_name, suffix, address');
        
    if (borrowersError) {
        console.error("borrowers error", borrowersError);
        process.exit(1);
    }
    
    // 2. Fetch active loans
    const { data: loans, error: loansError } = await supabase
        .from('app_loans')
        .select('id, borrower_id, loan_number, principal_amount, total_amount, balance, status');
        
    if (loansError) {
        console.error("loans error", loansError);
        process.exit(1);
    }

    // 3. Map balances to borrowers
    const report = [];
    const borrowerMap = new Map();
    for (const b of borrowers) {
        borrowerMap.set(b.id, b);
    }

    for (const l of loans) {
        if (l.status !== 'active') continue;
        const b = borrowerMap.get(l.borrower_id);
        if (b) {
            const name = `${b.first_name} ${b.last_name} ${b.suffix || ''}`.trim();
            report.push({
                name,
                address: b.address,
                loan_number: l.loan_number,
                total_amount: l.total_amount,
                balance: l.balance
            });
        }
    }

    fs.writeFileSync('db_dump.json', JSON.stringify(report, null, 2));
    console.log("Dumped to db_dump.json, found " + report.length + " active loans.");
}

checkDatabase();
