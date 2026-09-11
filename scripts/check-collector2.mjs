import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const supabaseKey = 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('--- Checking Borrowers ---');
  const { data: borrowers, error: borrowersError } = await supabase
    .from('borrowers')
    .select('id, full_name, collector_id');
  if (borrowersError) console.error('Error:', borrowersError.message);
  else console.log(`Found ${borrowers.length} borrowers.`);

  console.log('\n--- Checking Loans ---');
  const { data: loans, error: loansError } = await supabase
    .from('loans')
    .select('id, status');
  if (loansError) console.error('Error:', loansError.message);
  else console.log(`Found ${loans.length} loans.`);

  console.log('\n--- Checking Payment Schedules ---');
  const { data: schedules, error: schedulesError } = await supabase
    .from('payment_schedules')
    .select('id, status');
  if (schedulesError) console.error('Error:', schedulesError.message);
  else console.log(`Found ${schedules.length} schedules.`);
}

run();
