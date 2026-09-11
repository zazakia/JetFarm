import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function inspectBorrowerLoans() {
  const targetNames = [
    'SHALOU J. BALAO',
    'DOROTEA B. JUMAO-AS',
    'HAZEL Q. BULACAN',
    'RODINA A. ALVARADO',
    'CONCEPCION B. CRUZ',
    'ANALYN CABAHUG',
    'PURISIMO ABRENILLO',
    'TIRSO L. CAYANONG'
  ];

  console.log('=== INSPECTING DB LOANS FOR SAMPLE EXCEL ON-DL BORROWERS ===\n');

  for (const name of targetNames) {
    const clean = name.toLowerCase().replace(/[^a-z ]/g, '');
    const { data: borrowers } = await supabase.from('app_borrowers').select('*');
    const borrower = (borrowers || []).find(b => (b.full_name || '').toLowerCase().replace(/[^a-z ]/g, '').includes(clean.split(' ')[0]) && (b.full_name || '').toLowerCase().replace(/[^a-z ]/g, '').includes(clean.split(' ').pop()));

    if (!borrower) {
      console.log(`❌ Borrower "${name}": NOT FOUND IN DB`);
      continue;
    }

    const { data: loans } = await supabase
      .from('app_loans')
      .select('*')
      .eq('borrower_id', borrower.id);

    console.log(`👤 ${borrower.full_name} (${borrower.membership_number || borrower.id}): ${loans.length} loans in DB`);
    for (const l of loans) {
      console.log(`   └─ Loan: ${l.loan_number} | Principal: ₱${l.principal_amount} | Total: ₱${l.total_amount} | Paid: ₱${l.paid_amount} | Status: ${l.status}`);
    }
  }
}

inspectBorrowerLoans().catch(console.error);
