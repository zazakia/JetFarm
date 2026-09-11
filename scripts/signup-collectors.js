const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const supabaseAnonKey = 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function setupCollectors() {
    const collectors = [
        { email: 'cresencio.junco@poscursor.com', fullName: 'Cresencio Junco' },
        { email: 'gerald.gera@poscursor.com', fullName: 'Gerald Gera' }
    ];

    for (const collector of collectors) {
        console.log(`Signing up ${collector.fullName} (${collector.email})...`);
        const { data, error } = await supabase.auth.signUp({
            email: collector.email,
            password: 'password123',
            options: {
                data: {
                    full_name: collector.fullName,
                    role: 'collector'
                }
            }
        });

        if (error) {
            console.error(`Error signing up ${collector.email}:`, error.message);
        } else {
            console.log(`Successfully signed up ${collector.email}. User ID: ${data.user.id}`);
        }
    }
}

setupCollectors();
