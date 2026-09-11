import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const supabaseKey = 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAdmin() {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'admin@poscursor.com',
        password: 'password123'
    });
    
    if (error) {
        console.error('Login Failed:', error.message);
    } else {
        console.log('Login SUCCESS for:', data.user.email);
    }
}

testAdmin();
