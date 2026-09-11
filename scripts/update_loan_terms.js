const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    console.log("Updating loans to 40 weekly terms...");
    
    // We update loans that were inserted as 40 days
    const { data, error } = await supabase
        .from('app_loans')
        .update({
            term: 40,
            term_unit: 'weeks',
            frequency: 'weekly'
        })
        .eq('term', 40)
        .eq('term_unit', 'days');
        
    if (error) {
        console.error("Error updating loans:", error);
    } else {
        console.log("Successfully updated loans!");
    }
}

run();
