import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set in the environment
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Utility script to migrate legacy AGAP data into the new POSCursor schema.
 * Expected format is a JSON file exported from the legacy system.
 * 
 * Usage: 
 * ts-node scripts/migrate-agap.ts ./path-to-legacy-data.json
 */
async function main() {
    const dataFilePath = process.argv[2];
    if (!dataFilePath) {
        console.error('Usage: ts-node migrate-agap.ts <path-to-data.json>');
        process.exit(1);
    }

    const resolvedPath = path.resolve(process.cwd(), dataFilePath);
    if (!fs.existsSync(resolvedPath)) {
        console.error(`File not found: ${resolvedPath}`);
        process.exit(1);
    }

    console.log(`Loading data from ${resolvedPath}...`);
    const rawData = fs.readFileSync(resolvedPath, 'utf8');
    const legacyData = JSON.parse(rawData);

    // 1. Migrate Areas
    console.log('\n--- Migrating Areas ---');
    if (legacyData.areas && Array.isArray(legacyData.areas)) {
        const { data: areas, error: areaError } = await supabase
            .from('app_areas')
            .upsert(legacyData.areas, { onConflict: 'id' })
            .select();

        if (areaError) {
            console.error('Failed to migrate areas:', areaError.message);
        } else {
            console.log(`Successfully migrated ${areas?.length} areas.`);
        }
    } else {
        console.log('No area data found in JSON payload.');
    }

    // 2. Migrate Solidarity Groups (Collection Groups)
    console.log('\n--- Migrating Solidarity Groups ---');
    if (legacyData.groups && Array.isArray(legacyData.groups)) {
        const formattedGroups = legacyData.groups.map((g: any) => ({
            ...g,
            group_type: 'agap_solidarity',
            is_active: true
        }));

        const { data: groups, error: groupError } = await supabase
            .from('collection_groups')
            .upsert(formattedGroups, { onConflict: 'id' })
            .select();

        if (groupError) {
            console.error('Failed to migrate groups:', groupError.message);
        } else {
            console.log(`Successfully migrated ${groups?.length} solidarity groups.`);
        }
    } else {
        console.log('No group data found in JSON payload.');
    }

    // 3. Migrate Borrowers (Members)
    console.log('\n--- Migrating Borrowers ---');
    if (legacyData.borrowers && Array.isArray(legacyData.borrowers)) {
        const { data: borrowers, error: borrowerError } = await supabase
            .from('app_borrowers')
            .upsert(legacyData.borrowers, { onConflict: 'id' })
            .select();

        if (borrowerError) {
            console.error('Failed to migrate borrowers:', borrowerError.message);
        } else {
            console.log(`Successfully migrated ${borrowers?.length} borrowers.`);
        }
    } else {
        console.log('No borrower data found in JSON payload.');
    }

    console.log('\nMigration script execution completed.');
}

main().catch(err => {
    console.error('Unhandled execution error:', err);
    process.exit(1);
});
