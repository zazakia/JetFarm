import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

async function run() {
    console.log('--- DB VS EXCEL COMPARISON ---');
    
    // 1. Borrowers
    const { count: bCount } = await supabase.from('app_borrowers').select('*', { count: 'exact', head: true });
    console.log(`Borrowers in DB: ${bCount} | Expected from Excel: 140`);

    // 2. Savings
    const { data: sData } = await supabase.from('app_savings_transactions').select('amount');
    const sTotal = sData.reduce((sum, r) => sum + Number(r.amount), 0);
    console.log(`Savings Txs in DB: ${sData.length} | Expected: 140`);
    console.log(`Savings Total in DB: ${sTotal.toFixed(2)} | Expected: 369318.63 (Excel combined CBU/Savings)`);

    // 3. Loans
    const { data: lData } = await supabase.from('app_loans').select('total_amount, principal_amount');
    const lTotal = lData.reduce((sum, r) => sum + Number(r.total_amount), 0);
    console.log(`Unpaid Loans in DB: ${lData.length} | Expected: 29 (Deduplicated)`);
    console.log(`Loans Total Balance in DB: ${lTotal.toFixed(2)} | Expected: 200741.64`);

    // 4. Cash Transactions
    const { data: cData } = await supabase.from('app_cash_transactions').select('type, amount');
    const cIn = cData.filter(x => x.type === 'in').reduce((sum, r) => sum + Number(r.amount), 0);
    const cOut = cData.filter(x => x.type === 'out').reduce((sum, r) => sum + Number(r.amount), 0);
    const cNet = cIn - cOut;
    console.log(`Cash Transactions in DB: ${cData.length} | Expected: 2 (1 in, 1 out)`);
    console.log(`Net Cash on Hand in DB: ${cNet.toFixed(2)} | Expected: 433227.14`);
}

run().catch(console.error);
