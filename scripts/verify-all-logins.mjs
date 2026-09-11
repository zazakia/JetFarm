import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// All the quick login users from login.tsx hardcoded list
const quickLoginUsers = [
    { id: 'cybergada', full_name: 'Cybergada Master', role: 'admin', email: 'cybergada@gmail.com' },
    { id: 'admin', full_name: 'Admin User', role: 'admin', email: 'admin@poscursor.com' },
    { id: 'master_collector', full_name: 'Master Collector', role: 'collector', email: 'collector@poscursor.com' },
    { id: 'encoder', full_name: 'Loan Encoder User', role: 'loan_encoder', email: 'encoder@poscursor.com' },
    { id: 'jayson', full_name: 'Jayson Cayanong', role: 'collector', email: 'jayson.cayanong@poscursor.com' },
    { id: 'cresencio', full_name: 'Cresencio Junco', role: 'collector', email: 'cresencio.junco@poscursor.com' },
    { id: 'gerald', full_name: 'Gerald Gera', role: 'collector', email: 'gerald.gera@poscursor.com' },
    { id: 'bernie', full_name: 'Bernie Casera', role: 'collector', email: 'bernie.casera@poscursor.com' },
    { id: 'main_office', full_name: 'Main Office', role: 'collector', email: 'mainoffice@poscursor.com' },
];

const PASSWORD = '12345678';

async function verifyAll() {
    console.log('=== Verifying All Quick Login Users ===');
    console.log(`Production: ${SUPABASE_URL}\n`);

    const results = [];

    for (const user of quickLoginUsers) {
        process.stdout.write(`Testing ${user.full_name} (${user.email})... `);

        const { data, error } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: PASSWORD,
        });

        if (error) {
            process.stdout.write(`❌ FAILED: ${error.message}\n`);
            results.push({ ...user, success: false, error: error.message });
        } else {
            process.stdout.write(`✅ SUCCESS (uid: ${data.user.id.slice(0, 8)}...)\n`);
            results.push({ ...user, success: true, uid: data.user.id });
            // sign out after test
            await supabase.auth.signOut();
        }
    }

    console.log('\n=== SUMMARY ===');
    const passed = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ PASSED: ${passed.length}/${results.length}`);
    if (passed.length > 0) {
        passed.forEach(u => console.log(`   - ${u.full_name} (${u.email})`));
    }

    console.log(`\n❌ FAILED: ${failed.length}/${results.length}`);
    if (failed.length > 0) {
        failed.forEach(u => console.log(`   - ${u.full_name} (${u.email}): ${u.error}`));
    }

    return { passed, failed };
}

verifyAll().catch(console.error);
