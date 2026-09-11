import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const supabaseKey = 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function authAndLink() {
    // 1. Sign In
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'collector@poscursor.com',
        password: 'password123'
    });
    
    if (authError) {
        console.error('Sign In Failed:', authError.message);
        return;
    }
    
    console.log('Signed in as:', authData.user.id);
    
    // 2. Update Profile with SESSION
    const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
            id: authData.user.id,
            full_name: 'Juan Dela Cruz',
            role: 'collector',
            is_active: true
        });
    
    if (profileError) {
        console.error('Failed to link profile after login:', profileError.message);
    } else {
        console.log('Profile successfully linked after login!');
    }
}

authAndLink();
