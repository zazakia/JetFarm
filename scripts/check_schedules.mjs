import { createClient } from '@supabase/supabase-js';
import pkg from 'dotenv';
const { config } = pkg;
config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    console.log('Checking columns for app_payment_schedules...');
    const { data, error } = await supabase.from('app_payment_schedules').select('*').limit(1);
    if (error) {
        console.error('Error fetching data:', error);
        return;
    }
    if (data && data.length > 0) {
        console.log('Found Columns:', Object.keys(data[0]));
        const required = ['principal_amount', 'interest_amount', 'fees_amount'];
        const missing = required.filter(col => !Object.keys(data[0]).includes(col));
        if (missing.length === 0) {
            console.log('SUCCESS: All breakdown columns are present!');
        } else {
            console.log('MISSING COLUMNS:', missing);
        }
    } else {
        console.log('No data found in app_payment_schedules to inspect columns.');
    }
}

checkColumns();
