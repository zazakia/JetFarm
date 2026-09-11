/**
 * DIAGNOSTIC TOOL: Check Supabase Schema
 * Run this to identify actual column types and fix SCHEMA_COLUMN_TYPES mapping
 * 
 * Usage:
 * 1. Import this function in your debug/admin screen
 * 2. Call checkSupabaseSchema()
 * 3. Check console output to see actual column types
 * 4. Update SCHEMA_COLUMN_TYPES in SyncService.ts based on findings
 */

import { supabase } from '../database/supabase';

export async function checkSupabaseSchema() {
    console.log('=== SUPABASE SCHEMA DIAGNOSTIC ===');
    
    const tables = [
        'borrowers',
        'loans',
        'payments',
        'payment_schedules',
        'user_profiles',
        'expenses',
        'cash_transactions',
        'collection_logs',
    ];

    for (const tableName of tables) {
        try {
            // Get table metadata from information_schema
            const { data, error } = await supabase
                .from('information_schema.columns')
                .select('column_name, data_type, is_nullable')
                .eq('table_schema', 'public')
                .eq('table_name', tableName);

            if (error) {
                console.warn(`Failed to fetch schema for ${tableName}:`, error.message);
                continue;
            }

            console.log(`\n### ${tableName.toUpperCase()} ###`);
            const columns = data || [];
            
            // Filter for date/ID fields
            const relevantColumns = columns.filter((col: any) =>
                col.column_name.includes('_at') ||
                col.column_name.includes('_date') ||
                col.column_name.includes('_id') ||
                col.column_name === 'id'
            );

            for (const col of relevantColumns) {
                console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
            }

        } catch (err) {
            console.error(`Error checking schema for ${tableName}:`, err);
        }
    }

    console.log('\n=== END SCHEMA DIAGNOSTIC ===');
}

/**
 * Alternative: Quick check by fetching and inspecting actual records
 */
export async function inspectSampleRecords() {
    console.log('=== SAMPLE RECORD INSPECTION ===');
    
    const tables = ['borrowers', 'loans', 'payments'];

    for (const tableName of tables) {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(1);

            if (error) {
                console.warn(`Failed to fetch from ${tableName}:`, error.message);
                continue;
            }

            if (data && data.length > 0) {
                console.log(`\n### ${tableName} (sample) ###`);
                const record = data[0];
                
                Object.entries(record).forEach(([key, value]) => {
                    const type = typeof value;
                    console.log(`  ${key}: ${type} = ${JSON.stringify(value)}`);
                });
            }

        } catch (err) {
            console.error(`Error inspecting ${tableName}:`, err);
        }
    }

    console.log('\n=== END INSPECTION ===');
}

/**
 * Identify problematic records that are failing foreign key constraints
 */
export async function findOrphanRecords() {
    console.log('=== FINDING ORPHAN RECORDS ===');

    try {
        // Find borrowers without valid collector_id
        const { data: orphanBorrowers, error: borrowerErr } = await supabase
            .from('borrowers')
            .select('id, collector_id, created_by')
            .or('collector_id.is.null,created_by.is.null')
            .limit(10);

        if (borrowerErr) {
            console.warn('Error finding orphan borrowers:', borrowerErr.message);
        } else if (orphanBorrowers && orphanBorrowers.length > 0) {
            console.warn(`Found ${orphanBorrowers.length} borrowers with missing foreign keys:`);
            orphanBorrowers.forEach((b: any) => {
                console.warn(`  ID: ${b.id}, collector_id: ${b.collector_id}, created_by: ${b.created_by}`);
            });
        } else {
            console.log('✓ No orphan borrowers found');
        }

        // Find loans without valid borrower_id
        const { data: orphanLoans, error: loanErr } = await supabase
            .from('loans')
            .select('id, borrower_id, collector_id')
            .or('borrower_id.is.null,collector_id.is.null')
            .limit(10);

        if (loanErr) {
            console.warn('Error finding orphan loans:', loanErr.message);
        } else if (orphanLoans && orphanLoans.length > 0) {
            console.warn(`Found ${orphanLoans.length} loans with missing foreign keys:`);
            orphanLoans.forEach((l: any) => {
                console.warn(`  ID: ${l.id}, borrower_id: ${l.borrower_id}, collector_id: ${l.collector_id}`);
            });
        } else {
            console.log('✓ No orphan loans found');
        }

    } catch (err) {
        console.error('Error checking for orphans:', err);
    }

    console.log('\n=== END ORPHAN CHECK ===');
}

/**
 * Test record creation with foreign keys
 */
export async function testRecordCreation() {
    console.log('=== TESTING RECORD CREATION ===');

    try {
        // First, get a valid collector ID
        const { data: collectors, error: collectorErr } = await supabase
            .from('user_profiles')
            .select('id, role')
            .eq('role', 'collector')
            .limit(1);

        if (collectorErr || !collectors || collectors.length === 0) {
            console.error('No collectors found. Cannot test.');
            return;
        }

        const collectorId = collectors[0].id;
        console.log(`Using collector: ${collectorId}`);

        // Try creating a test borrower
        const testBorrower = {
            id: `test-${Date.now()}`,
            name: 'Test Borrower',
            phone: '1234567890',
            collector_id: collectorId,
            created_by: collectorId,
            area: 'Test Area',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const { error: insertErr, data: inserted } = await supabase
            .from('borrowers')
            .insert([testBorrower]);

        if (insertErr) {
            console.error('Failed to insert test borrower:', insertErr.message);
        } else {
            console.log('✓ Successfully inserted test borrower:', inserted);
            
            // Clean up
            await supabase.from('borrowers').delete().eq('id', testBorrower.id);
            console.log('✓ Cleaned up test record');
        }

    } catch (err) {
        console.error('Error during test:', err);
    }

    console.log('\n=== END CREATION TEST ===');
}
