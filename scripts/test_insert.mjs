import { createClient } from '@supabase/supabase-js';
import pkg from 'dotenv';
const { config } = pkg;
config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    console.log('Testing insertion into app_payment_schedules...');
    
    // Try with only known good columns
    const testRow = {
        id: '00000000-0000-0000-0000-000000000000',
        loan_id: 'any-loan-id',
        due_date: new Date().toISOString(),
        scheduled_amount: 100,
        status: 'pending'
    };
    
    console.log('Inserting with basic columns...');
    const { error: err1 } = await supabase.from('app_payment_schedules').insert([testRow]);
    if (err1) {
        console.error('Basic Insert Error:', err1.message);
    } else {
        console.log('Basic Insert SUCCESS!');
        // Clean up
        await supabase.from('app_payment_schedules').delete().eq('id', '00000000-0000-0000-0000-000000000000');
    }
    
    // Try with new columns
    const testRow2 = { ...testRow, principal_amount: 50 };
    console.log('Inserting with principal_amount...');
    const { error: err2 } = await supabase.from('app_payment_schedules').insert([testRow2]);
    if (err2) {
        console.error('Principal Amount Insert Error:', err2.message);
    } else {
        console.log('Principal Amount Insert SUCCESS!');
    }
}

testInsert();
