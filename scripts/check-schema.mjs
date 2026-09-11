import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const supabaseKey = 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    const { data, error } = await supabase.rpc('get_table_info', { t_name: 'user_profiles' });
    
    if (error) {
        // Fallback: try querying a non-existent column to force an error with column names
        const { data: d2, error: e2 } = await supabase
            .from('user_profiles')
            .select('non_existent_column_for_debug');
        console.error('Schema Error Info:', e2?.message);
        return;
    }
    
    console.log(data);
}

checkSchema();
