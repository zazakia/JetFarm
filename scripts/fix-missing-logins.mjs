/**
 * fix-missing-logins.mjs
 * 
 * Uses Supabase Management API to:
 * 1. List all auth users and confirm which emails are verified
 * 2. Create missing auth accounts (Main Office)
 * 3. Confirm any unverified emails
 * 
 * Run: node scripts/fix-missing-logins.mjs <SERVICE_ROLE_KEY>
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SERVICE_ROLE_KEY = process.argv[2];

if (!SERVICE_ROLE_KEY) {
    console.error('Usage: node fix-missing-logins.mjs <SERVICE_ROLE_KEY>');
    console.error('Get your service_role key from Supabase dashboard > Settings > API');
    process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    }
});

const QUICK_LOGIN_USERS = [
    { email: 'cybergada@gmail.com', full_name: 'Cybergada Master', role: 'admin' },
    { email: 'admin@poscursor.com', full_name: 'Admin User', role: 'admin' },
    { email: 'collector@poscursor.com', full_name: 'Master Collector', role: 'collector' },
    { email: 'encoder@poscursor.com', full_name: 'Loan Encoder User', role: 'loan_encoder' },
    { email: 'jayson.cayanong@poscursor.com', full_name: 'Jayson Cayanong', role: 'collector' },
    { email: 'cresencio.junco@poscursor.com', full_name: 'Cresencio Junco', role: 'collector' },
    { email: 'gerald.gera@poscursor.com', full_name: 'Gerald Gera', role: 'collector' },
    { email: 'bernie.casera@poscursor.com', full_name: 'Bernie Casera', role: 'collector' },
    { email: 'mainoffice@poscursor.com', full_name: 'Main Office', role: 'collector' },
];

const PASSWORD = '12345678';

async function main() {
    console.log('=== Fixing Missing Logins & Confirming Emails ===\n');

    // 1. List all existing auth users
    const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) {
        console.error('Failed to list users:', listError.message);
        process.exit(1);
    }

    const existingEmailMap = new Map(
        existingUsers.users.map(u => [u.email?.toLowerCase(), u])
    );

    console.log(`Found ${existingUsers.users.length} existing auth users\n`);

    for (const user of QUICK_LOGIN_USERS) {
        const email = user.email.toLowerCase();
        const existing = existingEmailMap.get(email);

        if (!existing) {
            // Create the user
            console.log(`➕ Creating auth user: ${user.full_name} (${email})...`);
            const { data: created, error: createError } = await adminClient.auth.admin.createUser({
                email: email,
                password: PASSWORD,
                email_confirm: true,
                user_metadata: { full_name: user.full_name, role: user.role },
            });

            if (createError) {
                console.error(`   ❌ Failed to create: ${createError.message}`);
            } else {
                console.log(`   ✅ Created with ID: ${created.user.id}`);

                // Ensure profile exists
                const { error: profileError } = await adminClient
                    .from('user_profiles')
                    .upsert({
                        id: created.user.id,
                        email: email,
                        full_name: user.full_name,
                        role: user.role,
                        is_active: true,
                    }, { onConflict: 'id' });

                if (profileError) {
                    console.error(`   ⚠️  Profile upsert failed: ${profileError.message}`);
                } else {
                    console.log(`   ✅ Profile created/updated`);
                }
            }
        } else {
            const isConfirmed = !!existing.email_confirmed_at;
            const status = isConfirmed ? '✅ CONFIRMED' : '⚠️  UNCONFIRMED';
            console.log(`${status}: ${user.full_name} (${email})`);

            if (!isConfirmed) {
                // Confirm email
                const { error: updateError } = await adminClient.auth.admin.updateUserById(existing.id, {
                    email_confirm: true,
                });
                if (updateError) {
                    console.error(`   ❌ Failed to confirm email: ${updateError.message}`);
                } else {
                    console.log(`   ✅ Email confirmed!`);
                }
            }
        }
    }

    console.log('\n=== Done! ===');
    console.log('Run verify-all-logins.mjs to confirm all users can log in.\n');
}

main().catch(console.error);
