/**
 * Ensures EXPO_PUBLIC_* are present before `expo export --platform web`.
 * Loads `.env` / `.env.local` from cwd when vars are not already set (e.g. Netlify injects them).
 */
import fs from 'fs';
import path from 'path';

function loadEnvFile(relPath) {
    const full = path.join(process.cwd(), relPath);
    if (!fs.existsSync(full)) return;
    const text = fs.readFileSync(full, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq === -1) continue;
        const key = t.slice(0, eq).trim();
        let val = t.slice(eq + 1).trim();
        if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
        ) {
            val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = val;
    }
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const bad =
    !url ||
    !key ||
    url === 'YOUR_SUPABASE_URL' ||
    key === 'YOUR_SUPABASE_ANON_KEY' ||
    url.includes('YOUR_SUPABASE') ||
    key.includes('YOUR_SUPABASE');

if (bad) {
    console.error(
        '\n[build] Missing or placeholder EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.\n' +
            'Add a .env file in the project root, or set both in Netlify → Site configuration → Environment variables.\n'
    );
    process.exit(1);
}

console.log('[build] EXPO_PUBLIC_SUPABASE_URL is set (export can proceed).');
