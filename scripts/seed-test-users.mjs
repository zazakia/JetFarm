import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env'), override: false });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || supabaseKey;

const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Local-only test logins for the agribusiness variant. The cooperative lending roles (collector,
// loan_encoder, payment_encoder, borrower) went with the lending domain, so only the admin,
// main-office and expenses-encoder accounts are seeded here.
const usersToCreate = [
  { email: 'cybergada@gmail.com', role: 'admin', name: 'Cybergada Master' },
  { email: 'admin@agri-one.com', role: 'admin', name: 'Admin User' },
  { email: 'mainoffice@agri-one.com', role: 'main_office', name: 'Main Office' },
  { email: 'expenses_encoder@agri-one.com', role: 'expenses_encoder', name: 'Expenses Encoder' },
];

async function seedUser(u) {
  console.log(`Checking ${u.email}...`);
  // Try to sign in first to see if they exist
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
     email: u.email,
     password: '12345678'
  });

  let userId = signInData?.user?.id;

  if (!userId) {
    console.log(`${u.email} doesn't exist or wrong password. Try sign up...`);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: u.email,
      password: '12345678',
      options: { data: { full_name: u.name } }
    });
    
    if (signUpError) {
      console.error(`Error signing up ${u.email}:`, signUpError.message);
      return;
    }
    userId = signUpData?.user?.id;
  }

  if (userId) {
    console.log(`Setting role to ${u.role} for ${u.email} (ID: ${userId})`);
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({ id: userId, full_name: u.name, role: u.role, email: u.email, is_active: true });
      
    if (profileError) {
      console.error(`Error updating role for ${u.email}:`, profileError.message);
    } else {
      console.log(`Successfully configured ${u.email}`);
    }
  } else {
    console.error(`Failed to get a user ID for ${u.email}`);
  }
}


async function run() {
  for (const u of usersToCreate) {
    await seedUser(u);
  }
  console.log('Seeding complete.');
}

run();
