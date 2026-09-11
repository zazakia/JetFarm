import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProject() {
  console.log('Checking project:', supabaseUrl);
  const { data, count, error } = await supabase
    .from('app_borrowers')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    if (error.code === 'PGRST116') {
        console.log('Table app_borrowers not found.');
    } else {
        console.error('Error selecting from app_borrowers:', error.message);
    }
  } else {
    console.log('Successfully selected from app_borrowers. Row count:', count);
  }
}

checkProject().catch(console.error);
