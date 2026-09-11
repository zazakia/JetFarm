import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.production') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearData() {
  console.log('Clearing data from related tables...');
  
  // Need to clear in correct order due to foreign keys
  const tablesToClear = [
    'app_payments',
    'app_payment_schedules',
    'app_loans',
    'app_loan_applications',
    'app_share_capital_transactions',
    'app_borrowers',
    'app_collectors'
  ];

  for (const table of tablesToClear) {
    console.log(`Deleting all records from ${table}...`);
    // Supabase REST API doesn't allow bulk delete without a filter, so we use neq id = 0 or something similar
    // Or we just fetch all and delete in batches
    let hasMore = true;
    let totalDeleted = 0;
    while(hasMore) {
        const { data, error } = await supabase.from(table).select('id').limit(1000);
        if (error) {
            console.error(`Error fetching from ${table}:`, error);
            hasMore = false;
            break;
        }
        if (!data || data.length === 0) {
            hasMore = false;
            break;
        }
        
        const ids = data.map(r => r.id);
        const { error: deleteError } = await supabase.from(table).delete().in('id', ids);
        if (deleteError) {
            console.error(`Error deleting from ${table}:`, deleteError);
            break;
        }
        totalDeleted += ids.length;
        console.log(`Deleted ${totalDeleted} from ${table}...`);
    }
  }
  
  console.log('Data clearing complete.');
}

clearData().catch(console.error);
