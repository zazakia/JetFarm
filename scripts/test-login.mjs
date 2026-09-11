import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const supabaseKey = 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSignIn() {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'cybergada@gmail.com',
        password: 'Qq12345678@'
    });
    
    if (error) {
        console.error('Login Failed:', error.message);
    } else {
        console.log('Login Successful for:', data.user.email);
        console.log('User ID:', data.user.id);
    }
}

testSignIn();
