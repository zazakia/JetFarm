const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function splitName(fullName) {
    if (!fullName) return { first: '', last: '', full: '' };
    const cleanName = fullName.trim();
    if (cleanName.includes(',')) {
        const parts = cleanName.split(',').map(p => p.trim());
        return {
            last: parts[0],
            first: parts[1],
            full: `${parts[1]} ${parts[0]}`.trim().replace(/\s+/g, ' ')
        };
    } else {
        const parts = cleanName.split(/\s+/);
        if (parts.length === 1) return { first: parts[0], last: '', full: parts[0] };
        const last = parts.pop();
        const first = parts.join(' ');
        return {
            first: first,
            last: last,
            full: cleanName
        };
    }
}

async function run() {
    console.log('Fetching borrowers...');
    const { data: borrowers } = await supabase.from('app_borrowers').select('id, full_name');
    if (!borrowers) return;

    console.log(`Processing ${borrowers.length} borrowers...`);
    for (const b of borrowers) {
        const { first, last, full } = splitName(b.full_name);
        await supabase.from('app_borrowers').update({
            full_name: full,
            first_name: first,
            last_name: last,
            updated_at: new Date().toISOString()
        }).eq('id', b.id);
    }
    console.log('Done!');
}

run();
