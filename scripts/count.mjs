import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error('Missing keys');
const supabase = createClient(supabaseUrl, supabaseKey);
async function check() {
  const { count: c1 } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true });
  const { count: c2 } = await supabase.from('journal_entry_lines').select('*', { count: 'exact', head: true });
  console.log('journal_entries:', c1, 'lines:', c2);
}
check();
