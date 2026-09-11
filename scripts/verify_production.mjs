import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.production') });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

async function verify() {
  const tables = [
    'app_borrowers',
    'app_share_capital_transactions',
    'app_loans',
    'app_payments',
    'app_collectors',
    'user_profiles',
  ];

  console.log('=== PRODUCTION DB VERIFICATION ===\n');

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`❌ ${table}: ERROR — ${error.message}`);
    } else {
      console.log(`✅ ${table}: ${count} records`);
    }
  }

  console.log('\n--- Sample Borrowers (first 5) ---');
  const { data: borrowers } = await supabase
    .from('app_borrowers')
    .select('full_name, membership_number, membership_status, address')
    .limit(5);
  console.table(borrowers);

  console.log('\n--- Sample Loans (first 5) ---');
  const { data: loans } = await supabase
    .from('app_loans')
    .select('loan_number, loan_type, principal_amount, status')
    .limit(5);
  console.table(loans);

  console.log('\n--- Sample Payments (first 5) ---');
  const { data: payments } = await supabase
    .from('app_payments')
    .select('amount, payment_date, notes')
    .limit(5);
  console.table(payments);
}

verify().catch(console.error);
