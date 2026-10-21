import { createClient } from '@supabase/supabase-js';

// Reads the target from the environment - this repo is public, so a key committed here is a
// disclosed key. Nothing falls back to a literal.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY before running this script.');
    process.exit(1);
}
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
