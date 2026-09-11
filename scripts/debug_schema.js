const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync('.env.test', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[1].trim() === 'EXPO_PUBLIC_SUPABASE_URL' ? match[2].trim() : match[2].trim();
});

// Fix for potentially quoted values
Object.keys(env).forEach(key => {
  env[key] = env[key].replace(/^"|"$/g, '');
});

const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function debug() {
  console.log('Checking tables...');
  
  // Try common table names
  const tables = ['loans', 'borrowers', 'app_loans', 'app_borrowers'];
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`Table ${table} error:`, error.message);
    } else {
      console.log(`Table ${table} count:`, count);
    }
  }

  // Try to find all tables
  const { data, error } = await supabase.rpc('get_tables');
  if (error) {
    console.log('RPC get_tables error:', error.message);
  } else {
    console.log('Tables from RPC:', data);
  }
}

debug();
