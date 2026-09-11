const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findLorinaLoans() {
    const { data: borrower } = await supabase
        .from('app_borrowers')
        .select('id, full_name')
        .ilike('full_name', '%Lorina%Cagabhion%')
        .single();
    
    if (!borrower) {
        console.log("Lorina not found.");
        return;
    }

    console.log(`Found Borrower: ${borrower.full_name} (${borrower.id})`);

    const { data: loans } = await supabase
        .from('app_loans')
        .select('*')
        .eq('borrower_id', borrower.id)
        .is('deleted_at', null);
    
    console.log(`Found ${loans.length} loans for ${borrower.full_name}:`);
    for (const loan of loans) {
        const { count: pCount } = await supabase.from('app_payments').select('*', { count: 'exact', head: true }).eq('loan_id', loan.id).is('deleted_at', null);
        const { count: sCount } = await supabase.from('app_payment_schedules').select('*', { count: 'exact', head: true }).eq('loan_id', loan.id).is('deleted_at', null);
        console.log(`- ${loan.loan_number} (ID: ${loan.id}): Status: ${loan.status}, Payments: ${pCount}, Schedules: ${sCount}, Created: ${loan.created_at}`);
    }
}

findLorinaLoans().catch(console.error);
