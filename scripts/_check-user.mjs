import { Client } from 'pg';
const c = process.env.SUPABASE_DB_URL;
if (!c) {
    console.error('SUPABASE_DB_URL is not set. Connection strings are never hardcoded in this repo - export it before running this script.');
    process.exit(1);
}
await c.connect();

const auth = await c.query("SELECT id, email, encrypted_password, email_confirmed_at, banned_until FROM auth.users WHERE email='cybergada@gmail.com'");
console.log('auth.users:', auth.rows);

const profile = await c.query("SELECT * FROM user_profiles WHERE email='cybergada@gmail.com'");
console.log('user_profiles:', profile.rows);

await c.end();
