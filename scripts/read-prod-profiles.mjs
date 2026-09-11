import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function readProfiles() {
    console.log('=== Reading user_profiles from YOUR_SUPABASE_PROJECT ===');
    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, role, full_name, is_active');

    if (error) {
        console.error('Error fetching user_profiles:', error);
    } else {
        console.log(`Fetched ${data?.length} profiles:`);
        console.log(JSON.stringify(data, null, 2));
    }
}

readProfiles().catch(console.error);
