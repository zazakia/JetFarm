const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env.production') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getWords(name) {
    return name.toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter(w => w.length > 0).sort();
}

// Simple Levenshtein distance
function distance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    let matrix = [];
    for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
    for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}

async function findDuplicates() {
    console.log('Fetching borrowers...');
    const { data: borrowers, error } = await supabase.from('app_borrowers').select('id, full_name, created_at').is('deleted_at', null);
    if (error) throw error;
    
    console.log(`Found ${borrowers.length} active borrowers.`);
    
    const potentialDuplicates = [];
    
    for (let i = 0; i < borrowers.length; i++) {
        for (let j = i + 1; j < borrowers.length; j++) {
            const b1 = borrowers[i];
            const b2 = borrowers[j];
            
            const words1 = getWords(b1.full_name);
            const words2 = getWords(b2.full_name);
            
            // Check exact same words (reversed names)
            if (words1.join(' ') === words2.join(' ')) {
                potentialDuplicates.push({ b1, b2, reason: 'Exact words match (reversed or shuffled)' });
                continue;
            }
            
            // Check high similarity
            const n1 = b1.full_name.toUpperCase().replace(/[^A-Z\s]/g, '').trim();
            const n2 = b2.full_name.toUpperCase().replace(/[^A-Z\s]/g, '').trim();
            
            if (n1 === n2) {
                potentialDuplicates.push({ b1, b2, reason: 'Exact match ignoring special chars' });
                continue;
            }
            
            const dist = distance(n1, n2);
            const maxLen = Math.max(n1.length, n2.length);
            if (maxLen > 5 && dist <= 2) {
                potentialDuplicates.push({ b1, b2, reason: `Levenshtein distance ${dist}` });
                continue;
            }
        }
    }
    
    console.log(`\nFound ${potentialDuplicates.length} potential duplicate pairs:\n`);
    for (const pair of potentialDuplicates) {
        console.log(`- [${pair.reason}]`);
        console.log(`  1: ${pair.b1.full_name} (${pair.b1.id}) - Created: ${pair.b1.created_at}`);
        console.log(`  2: ${pair.b2.full_name} (${pair.b2.id}) - Created: ${pair.b2.created_at}`);
        console.log('');
    }
}

findDuplicates().catch(console.error);
