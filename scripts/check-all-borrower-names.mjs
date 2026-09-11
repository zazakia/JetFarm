import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkAllBorrowerNames() {
  const { data: borrowers } = await supabase
    .from('app_borrowers')
    .select('id, full_name, membership_number, created_at')
    .is('deleted_at', null)
    .order('full_name', { ascending: true });

  console.log(`=== ACTIVE NON-DELETED BORROWERS IN PROD DB (${borrowers.length} total) ===\n`);

  const nameCounts = new Map();
  for (const b of borrowers) {
    const name = (b.full_name || '').toUpperCase().trim();
    nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
  }

  let dupCount = 0;
  for (const [name, count] of nameCounts.entries()) {
    if (count > 1) {
      console.log(`⚠️ DUPLICATE REMAINING: "${name}" (${count} instances)`);
      dupCount++;
    }
  }

  if (dupCount === 0) {
    console.log('✅ ZERO DUPLICATES FOUND! All borrower records in production DB are unique and clean.');
  }
}

checkAllBorrowerNames().catch(console.error);
