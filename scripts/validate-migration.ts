import { createClient } from '@supabase/supabase-js';

// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set in the environment
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Utility script to validate the integrity of migrated AGAP data.
 * 
 * Usage: 
 * ts-node scripts/validate-migration.ts
 */
async function main() {
    console.log('--- Validating Migration Integrity ---');

    // 1. Check Areas
    const { count: areaCount, error: areaError } = await supabase
        .from('app_areas')
        .select('*', { count: 'exact', head: true });

    if (areaError) {
        console.error('Error checking areas:', areaError.message);
    } else {
        console.log(`Total Areas found: ${areaCount}`);
    }

    // 2. Check Solidarity Groups
    const { count: groupCount, error: groupError } = await supabase
        .from('collection_groups')
        .select('*', { count: 'exact', head: true })
        .eq('group_type', 'agap_solidarity');

    if (groupError) {
        console.error('Error checking solidarity groups:', groupError.message);
    } else {
        console.log(`Total Solidarity Groups found: ${groupCount}`);
    }

    // 3. Check Borrowers
    const { count: borrowerCount, error: borrowerError } = await supabase
        .from('app_borrowers')
        .select('*', { count: 'exact', head: true });

    if (borrowerError) {
        console.error('Error checking borrowers:', borrowerError.message);
    } else {
        console.log(`Total Borrowers found: ${borrowerCount}`);
    }

    // 4. Orphaned Borrowers (Borrowers without an area_id)
    const { count: orphanedBorrowers, error: orphanError } = await supabase
        .from('app_borrowers')
        .select('*', { count: 'exact', head: true })
        .is('area_id', null);

    if (orphanError) {
        console.error('Error checking orphaned borrowers:', orphanError.message);
    } else {
        if (orphanedBorrowers && orphanedBorrowers > 0) {
            console.warn(`WARNING: Found ${orphanedBorrowers} borrowers without an assigned area.`);
        } else {
            console.log('All borrowers have assigned areas.');
        }
    }

    console.log('\nValidation completed.');
}

main().catch(err => {
    console.error('Unhandled execution error:', err);
    process.exit(1);
});
