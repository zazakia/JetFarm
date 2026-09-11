import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.production') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') }); // Local overrides if running locally

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Secret Key. Please check your .env files.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const tablesToClear = [
  'app_payments',
  'app_payment_schedules',
  'app_loan_penalties',
  'app_savings_transactions',
  'app_guarantors',
  'app_file_cases',
  'app_loans',
  'app_loan_applications',
  'app_borrowers'
];

async function clearData() {
  console.log(`Connecting to Supabase at: ${supabaseUrl}`);
  
  for (const table of tablesToClear) {
    console.log(`Clearing ${table}...`);
    // Delete all records (requires service role key to bypass RLS effectively if we don't use eq)
    // Supabase JS doesn't have a truncate, so we do a delete where id is not null or delete all
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (error) {
      console.error(`Error clearing ${table}:`, error.message);
    } else {
      console.log(`Successfully cleared ${table}`);
    }
  }
  
  console.log("Finished clearing transaction data.");
}

clearData();
