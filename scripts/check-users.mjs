import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const supabaseKey = 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('*');
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    console.log(JSON.stringify(data, null, 2));
}

checkUsers();
