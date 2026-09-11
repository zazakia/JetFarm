import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAltUrl = 'http://127.0.0.1:54321'; // Standard Supabase port
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing credentials in .env.local');
  process.exit(1);
}

// Try both URLs if one fails
async function setupMember() {
  const urls = [supabaseUrl, supabaseAltUrl];
  let supabase;
  
  for (const url of urls) {
    console.log(`Trying to connect to ${url}...`);
    supabase = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    try {
      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email: 'member.test@poscursor.com',
        password: '12345678',
        email_confirm: true,
        user_metadata: { full_name: 'Test Member' }
      });

      if (userError) {
        if (userError.message.includes('already registered')) {
          console.log('User already exists, updating...');
          const { data: listData } = await supabase.auth.admin.listUsers();
          const existingUser = listData.users.find(u => u.email === 'member.test@poscursor.com');
          if (existingUser) {
            const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
              email_confirm: true,
              password: '12345678'
            });
            if (updateError) throw updateError;
            await finishSetup(supabase, existingUser.id);
            return;
          }
        }
        throw userError;
      }

      console.log('User created:', userData.user.id);
      await finishSetup(supabase, userData.user.id);
      return;
    } catch (e) {
      console.warn(`Failed on ${url}: ${e.message}`);
    }
  }
}

async function finishSetup(supabase, userId) {
  // 1. Create Profile
  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert({
      id: userId,
      full_name: 'Test Member',
      role: 'borrower',
      email: 'member.test@poscursor.com',
      is_active: true
    });

  if (profileError) {
    console.error('Profile error:', profileError);
    return;
  }
  console.log('Profile setup done.');

  // 2. Create Borrower record
  const { error: borrowerError } = await supabase
    .from('app_borrowers')
    .upsert({
      auth_id: userId,
      full_name: 'Test Member'
    }, { onConflict: 'auth_id' });

  if (borrowerError) {
    console.error('Borrower record error:', borrowerError);
    return;
  }
  console.log('Borrower setup done.');
}

setupMember().catch(console.error);
