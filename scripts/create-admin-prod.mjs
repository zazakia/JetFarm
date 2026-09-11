import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tigydhnptczbhvqwhiyh.supabase.co';
const supabaseServiceKey = 'sb_secret_ol8W_ecINarfdG4SunrfOw_qaSo0q6F';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  console.log('Creating user cybergada@gmail.com...');
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'cybergada@gmail.com',
    password: '12345678',
    email_confirm: true,
    user_metadata: { role: 'admin' }
  });

  if (error) {
    if (error.message.includes('already been registered')) {
      console.log('User already exists, updating password instead...');
      // Fetch user by email to get ID? Supabase admin.createUser doesn't return ID if it fails.
      // We can use admin.listUsers
      const { data: usersData } = await supabase.auth.admin.listUsers();
      const user = usersData.users.find(u => u.email === 'cybergada@gmail.com');
      if (user) {
        const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
          user.id,
          { password: '12345678', email_confirm: true, user_metadata: { role: 'admin' } }
        );
        if (updateError) {
          console.error('Failed to update password:', updateError.message);
        } else {
          console.log('User password updated successfully! ID:', updateData.user.id);
        }
      }
    } else {
      console.error('Error creating user:', error.message);
    }
  } else {
    console.log('User created successfully:', data.user.id);
  }
}

run();
