import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
    for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
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
    console.log('🚀 Starting Duplicate Borrower Merge...');
    const { data: borrowers, error } = await supabase.from('app_borrowers').select('id, full_name, member_id');
    if (error) throw error;

    const duplicates = [];
    const threshold = 3; 

    // Find duplicates
    for (let i = 0; i < borrowers.length; i++) {
        for (let j = i + 1; j < borrowers.length; j++) {
            const nameA = borrowers[i].full_name.toLowerCase().trim().replace(/\s+/g, ' ');
            const nameB = borrowers[j].full_name.toLowerCase().trim().replace(/\s+/g, ' ');
            
            let isMatch = false;
            
            if (nameA === nameB) {
                isMatch = true;
            } else {
                const dist = levenshtein(nameA, nameB);
                const minLen = Math.min(nameA.length, nameB.length);
                const dynamicThreshold = minLen < 10 ? 1 : threshold;
                if (dist <= dynamicThreshold) {
                    isMatch = true;
                } else {
                    const partsA = nameA.split(' ').filter(p => p.length > 1);
                    const partsB = nameB.split(' ').filter(p => p.length > 1);
                    if (partsA.length >= 2 && partsB.length >= 2) {
                        const aFirstLast = `${partsA[0]} ${partsA[partsA.length-1]}`;
                        const bFirstLast = `${partsB[0]} ${partsB[partsB.length-1]}`;
                        if (aFirstLast === bFirstLast) {
                            isMatch = true;
                        } else if (partsA.every(p => partsB.includes(p)) || partsB.every(p => partsA.includes(p))) {
                            isMatch = true;
                        }
                    }
                }
            }

            if (isMatch) {
                duplicates.push({ a: borrowers[i], b: borrowers[j] });
            }
        }
    }

    console.log(`⚠️ Found ${duplicates.length} duplicate pairs to merge.`);

    const mergedIds = new Set();
    let mergedCount = 0;

    for (const pair of duplicates) {
        // Skip if either has already been merged/deleted in this run
        if (mergedIds.has(pair.a.id) || mergedIds.has(pair.b.id)) continue;

        // Determine primary: Longer name wins, else alphabetical
        let primary, duplicate;
        if (pair.a.full_name.length > pair.b.full_name.length) {
            primary = pair.a;
            duplicate = pair.b;
        } else if (pair.a.full_name.length < pair.b.full_name.length) {
            primary = pair.b;
            duplicate = pair.a;
        } else {
            // Equal length, pick alphabetically
            if (pair.a.full_name.localeCompare(pair.b.full_name) <= 0) {
                primary = pair.a;
                duplicate = pair.b;
            } else {
                primary = pair.b;
                duplicate = pair.a;
            }
        }

        console.log(`🔄 Merging "${duplicate.full_name}" INTO "${primary.full_name}"`);

        // Reassign Loans
        await supabase.from('app_loans').update({ borrower_id: primary.id }).eq('borrower_id', duplicate.id);
        
        // Reassign Savings
        await supabase.from('app_savings_transactions').update({ borrower_id: primary.id }).eq('borrower_id', duplicate.id);
        
        // Reassign Payments
        await supabase.from('app_payments').update({ borrower_id: primary.id }).eq('borrower_id', duplicate.id);

        // Delete duplicate
        await supabase.from('app_borrowers').delete().eq('id', duplicate.id);
        
        mergedIds.add(duplicate.id);
        mergedCount++;
    }

    console.log(`✨ Merge complete! Deleted ${mergedCount} duplicate borrower records and transferred their data.`);
}

run().catch(console.error);
