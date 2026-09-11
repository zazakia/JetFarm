
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

const envFiles = [
    '.env.local',
    process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}.local` : null,
    process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : null,
    '.env',
].filter(Boolean);

for (const envFile of envFiles) {
    dotenv.config({ path: path.join(process.cwd(), envFile), override: false });
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing connection to:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
    try {
        const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        if (error) {
            console.error('Connection failed:', error.message);
            process.exit(1);
        }
        console.log('Connection successful! Data found.');
        process.exit(0);
    } catch (err) {
        console.error('Unexpected error:', err);
        process.exit(1);
    }
}

testConnection();


