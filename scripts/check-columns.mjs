import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkColumns() {
  const tables = ['app_loans', 'app_borrowers', 'app_share_capital_transactions', 'app_savings_transactions', 'app_payments'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`Error checking ${table}:`, error);
    } else if (data && data.length > 0) {
      console.log(`\nColumns for ${table}:`, Object.keys(data[0]));
    } else {
      console.log(`\nNo data in ${table}`);
    }
  }
}

checkColumns();
