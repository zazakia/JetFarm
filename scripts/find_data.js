const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function check(url, key) {
  console.log(`Checking ${url}...`);
  const supabase = createClient(url, key);
  const tables = ['loans', 'borrowers', 'app_loans', 'app_borrowers'];
  for (const table of tables) {
    try {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (!error && count !== null) {
        console.log(`  Table ${table} has ${count} rows.`);
      }
    } catch (e) {}
  }
}

const envs = [
  { url: 'https://YOUR_SUPABASE_PROJECT.supabase.co', key: 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs' },
  { url: 'https://YOUR_SUPABASE_PROJECT.supabase.co', key: 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs' },
  { url: 'https://YOUR_SUPABASE_PROJECT.supabase.co', key: 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs' }
];

async function run() {
  for (const env of envs) {
    await check(env.url, env.key);
  }
}

run();
