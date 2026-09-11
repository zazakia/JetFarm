const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const supabaseAnonKey = 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function setupBernie() {
    console.log('Signing up Bernie Casera (bernie.casera@poscursor.com)...');
    const { data, error } = await supabase.auth.signUp({
        email: 'bernie.casera@poscursor.com',
        password: 'password123',
        options: {
            data: {
                full_name: 'Bernie Casera',
                role: 'collector'
            }
        }
    });

    if (error) {
        console.error('Error signing up Bernie:', error.message);
    } else {
        console.log('Successfully signed up Bernie. User ID:', data.user.id);
    }
}

setupBernie();
