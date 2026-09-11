import { Client } from 'pg';
const c = new Client({ connectionString: 'postgresql://postgres:Qweasd145698%40@db.YOUR_SUPABASE_PROJECT.supabase.co:5432/postgres', ssl: { rejectUnauthorized: false } });
await c.connect();

const auth = await c.query("SELECT id, email, encrypted_password, email_confirmed_at, banned_until FROM auth.users WHERE email='cybergada@gmail.com'");
console.log('auth.users:', auth.rows);

const profile = await c.query("SELECT * FROM user_profiles WHERE email='cybergada@gmail.com'");
console.log('user_profiles:', profile.rows);

await c.end();
