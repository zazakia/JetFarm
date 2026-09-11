import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function testRpcs() {
  const rpcs = ['exec_sql', 'execute_sql', 'run_sql', 'sql', 'exec'];
  for (const rpc of rpcs) {
    const { data, error } = await supabase.rpc(rpc, { sql_query: 'SELECT 1;' });
    if (error) {
      console.log(`  - rpc '${rpc}': ${error.code} - ${error.message}`);
    } else {
      console.log(`  - rpc '${rpc}': SUCCESS!`, data);
    }
  }
}

testRpcs().catch(console.error);
