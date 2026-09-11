import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

// Levenshtein distance implementation
function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

async function run() {
    console.log('🔍 Fetching borrowers from production DB...');
    const { data: borrowers, error } = await supabase.from('app_borrowers').select('id, full_name, member_id');
    
    if (error) {
        console.error('Error fetching borrowers:', error);
        return;
    }

    console.log(`✅ Found ${borrowers.length} borrowers. Checking for near-spelling duplicates...`);
    
    const duplicates = [];
    const threshold = 3; // Max edit distance to be considered a "near spelling"

    for (let i = 0; i < borrowers.length; i++) {
        for (let j = i + 1; j < borrowers.length; j++) {
            const nameA = borrowers[i].full_name.toLowerCase().trim().replace(/\s+/g, ' ');
            const nameB = borrowers[j].full_name.toLowerCase().trim().replace(/\s+/g, ' ');
            
            // Skip exact matches as they should already be handled, but check anyway
            if (nameA === nameB) {
                duplicates.push({ a: borrowers[i].full_name, b: borrowers[j].full_name, distance: 0, reason: 'Exact match' });
                continue;
            }

            const dist = levenshtein(nameA, nameB);
            
            // Adjust threshold based on string length (shorter strings need stricter threshold)
            const minLen = Math.min(nameA.length, nameB.length);
            const dynamicThreshold = minLen < 10 ? 1 : threshold;

            if (dist <= dynamicThreshold) {
                duplicates.push({ a: borrowers[i].full_name, b: borrowers[j].full_name, distance: dist, reason: 'Levenshtein distance' });
                continue;
            }
            
            // Check if they are just flipped or missing middle initial
            // e.g. "John Doe" vs "John H. Doe"
            const partsA = nameA.split(' ').filter(p => p.length > 1);
            const partsB = nameB.split(' ').filter(p => p.length > 1);
            
            if (partsA.length >= 2 && partsB.length >= 2) {
                const aFirstLast = `${partsA[0]} ${partsA[partsA.length-1]}`;
                const bFirstLast = `${partsB[0]} ${partsB[partsB.length-1]}`;
                
                if (aFirstLast === bFirstLast) {
                    duplicates.push({ a: borrowers[i].full_name, b: borrowers[j].full_name, distance: 0, reason: 'First and Last name match (ignoring initials)' });
                } else if (partsA.every(p => partsB.includes(p)) || partsB.every(p => partsA.includes(p))) {
                     duplicates.push({ a: borrowers[i].full_name, b: borrowers[j].full_name, distance: 0, reason: 'All significant words match' });
                }
            }
        }
    }

    if (duplicates.length === 0) {
        console.log('✨ No near-spelling duplicates found!');
    } else {
        console.log(`⚠️ Found ${duplicates.length} potential duplicates:`);
        duplicates.sort((x, y) => x.distance - y.distance).forEach(d => {
            console.log(`   - "${d.a}"  <--->  "${d.b}" (Reason: ${d.reason}${d.distance > 0 ? `, distance: ${d.distance}` : ''})`);
        });
    }
}

run().catch(console.error);
