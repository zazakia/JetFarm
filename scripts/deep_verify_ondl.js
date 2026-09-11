const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env.production') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function verify() {
    console.log('=== DEEP VERIFICATION OF ON DEMAND LETTER LOANS ===');
    
    // 1. Fetch Loans
    const { data: loans, error: lErr } = await supabase
        .from('app_loans')
        .select(`*`)
        .ilike('loan_type', 'Demand-%');
        
    if (lErr) throw lErr;
    
    // Check borrowers
    const borrowerIds = [...new Set(loans.map(l => l.borrower_id))];
    const { data: borrowers, error: bErr } = await supabase
        .from('app_borrowers')
        .select('id, full_name')
        .in('id', borrowerIds);
        
    if (bErr) throw bErr;
    const borrowerMap = new Map(borrowers.map(b => [b.id, b]));
    
    console.log(`\n--- LOANS ---`);
    console.log(`Total Demand Loans: ${loans.length} (Expected: 29)`);
    
    let sumPrincipal = 0;
    let sumInterest = 0;
    let sumTotal = 0;
    let activeCount = 0;
    let paidCount = 0;
    
    loans.forEach(l => {
        sumPrincipal += Number(l.principal_amount || 0);
        sumInterest += Number(l.interest_amount || 0);
        sumTotal += Number(l.total_amount || 0);
        if (l.status === 'active') activeCount++;
        if (l.status === 'paid') paidCount++;
        
        if (!borrowerMap.has(l.borrower_id)) {
             console.error(`ERROR: Loan ${l.id} has no linked borrower profile!`);
        }
    });
    
    console.log(`Active Loans: ${activeCount}`);
    console.log(`Paid Loans:   ${paidCount}`);
    console.log(`Sum Principal: ₱${sumPrincipal.toLocaleString('en-US', { minimumFractionDigits: 2 })} (Expected: ₱179,624.00)`);
    console.log(`Sum Interest:  ₱${sumInterest.toLocaleString('en-US', { minimumFractionDigits: 2 })} (Expected: ₱19,137.64)`);
    console.log(`Sum Total:     ₱${sumTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} (Expected: ₱205,741.64)`);
    
    const loanIds = loans.map(l => l.id);
    
    if (loanIds.length > 0) {
        // 2. Fetch Penalties
        const { data: penalties, error: pErr } = await supabase
            .from('app_loan_penalties')
            .select('*')
            .in('loan_id', loanIds);
            
        if (pErr) throw pErr;
        
        let sumPenalties = 0;
        penalties.forEach(p => { sumPenalties += Number(p.amount || 0); });
        console.log(`\n--- PENALTIES ---`);
        console.log(`Total Penalties: ${penalties.length} (Expected: 8)`);
        console.log(`Sum Penalties: ₱${sumPenalties.toLocaleString('en-US', { minimumFractionDigits: 2 })} (Expected: ₱5,900.00)`);
        
        // 3. Fetch Payments
        const { data: payments, error: payErr } = await supabase
            .from('app_payments')
            .select('*')
            .in('loan_id', loanIds);
            
        if (payErr) throw payErr;
        
        let sumPayments = 0;
        payments.forEach(p => { sumPayments += Number(p.amount || 0); });
        console.log(`\n--- PAYMENTS ---`);
        console.log(`Total Payments: ${payments.length} (Expected: 1)`);
        console.log(`Sum Payments:  ₱${sumPayments.toLocaleString('en-US', { minimumFractionDigits: 2 })} (Expected: ₱5,000.00)`);
        
        // 4. Fetch Schedules
        const { data: schedules, error: sErr } = await supabase
            .from('app_payment_schedules')
            .select('*')
            .in('loan_id', loanIds);
            
        if (sErr) throw sErr;
        
        let sumSchedules = 0;
        schedules.forEach(s => { sumSchedules += Number(s.scheduled_amount || 0); });
        console.log(`\n--- SCHEDULES ---`);
        console.log(`Total Schedules: ${schedules.length} (Expected: 29)`);
        console.log(`Sum Schedules: ₱${sumSchedules.toLocaleString('en-US', { minimumFractionDigits: 2 })} (Expected: ₱205,741.64)`);
    }

    console.log('\n=== VERIFICATION COMPLETED ===');
}

verify().catch(console.error);
