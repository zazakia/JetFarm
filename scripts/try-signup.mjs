import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const supabaseKey = 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function trySignUp() {
    const { data, error } = await supabase.auth.signUp({
        email: 'collector@poscursor.com',
        password: 'password123'
    });
    
    if (error) {
        console.error('Sign Up Failed:', error.message);
    } else {
        console.log('Sign Up SUCCESS:', data.user?.email);
        console.log('User ID:', data.user?.id);
    }
}

trySignUp();
