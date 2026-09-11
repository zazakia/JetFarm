import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const collectors = [
    { name: 'Bernie Casera', email: 'bernie.casera@poscursor.com' },
    { name: 'Cresencio Junco', email: 'cresencio.junco@poscursor.com' },
    { name: 'Gerald Gera', email: 'gerald.gera@poscursor.com' }
];

const passwords = ['12345678', 'password123'];

async function verify() {
    console.log('--- Verifying Collector Logins ---');
    for (const collector of collectors) {
        console.log(`Checking ${collector.name} (${collector.email})...`);
        let loggedIn = false;
        let finalUserId = null;

        for (const pwd of passwords) {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: collector.email,
                password: pwd
            });

            if (!error) {
                console.log(`  [SUCCESS] Signed in with password: ${pwd}`);
                loggedIn = true;
                finalUserId = data.user.id;
                break;
            } else {
                console.log(`  [DEBUG] Password ${pwd} failed: ${error.message}`);
            }
        }

        if (!loggedIn) {
            console.error(`  [FAILED] All password attempts failed for ${collector.email}`);
        } else {
            // Check role in profile
            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', finalUserId)
                .single();
            
            if (profileError) {
                console.error(`  [ERROR] Profile fetch error: ${profileError.message}`);
            } else {
                console.log(`  [INFO] Profile Role: ${profile.role}, Active: ${profile.is_active}`);
            }
        }
        console.log('---');
    }
}

verify();
