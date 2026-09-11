/**
 * fix-coa-ids-production.mjs
 *
 * Converts existing chart_of_accounts rows in production to use
 * deterministic MD5-based UUIDs (matching the client-side algorithm)
 * without requiring a management API token.
 *
 * Strategy (avoids needing UPDATE on the primary key via REST):
 *   1. Fetch all non-deleted records
 *   2. For each record whose id != md5(code)::uuid:
 *      a. Soft-delete the old row (sets deleted_at) → unblocks the partial unique index
 *      b. Insert a fresh row with the deterministic id
 *      c. Hard-delete the old soft-deleted row
 *
 * Safe because chart_of_accounts.id is not referenced by any FK
 * (journal_entry_lines references account_code TEXT, not the UUID).
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

function getDeterministicId(code) {
    const md5Hex = crypto.createHash('md5').update(code).digest('hex');
    return [
        md5Hex.substring(0, 8),
        md5Hex.substring(8, 12),
        md5Hex.substring(12, 16),
        md5Hex.substring(16, 20),
        md5Hex.substring(20),
    ].join('-');
}

async function main() {
    console.log('🔍 Fetching chart_of_accounts from production...');
    const { data: records, error: fetchError } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .is('deleted_at', null);

    if (fetchError) throw new Error(`Fetch failed: ${fetchError.message}`);
    console.log(`   Found ${records.length} active records`);

    const toFix = records.filter(r => r.id !== getDeterministicId(r.code));
    const alreadyCorrect = records.length - toFix.length;
    console.log(`   ${alreadyCorrect} already have correct IDs`);
    console.log(`   ${toFix.length} need ID updates\n`);

    if (toFix.length === 0) {
        console.log('✅ Nothing to do — all IDs are already deterministic.');
        return;
    }

    let fixed = 0;
    let failed = 0;

    for (const record of toFix) {
        const newId = getDeterministicId(record.code);
        process.stdout.write(`  [${record.code}] ${record.id.slice(0, 8)}… → ${newId.slice(0, 8)}… `);

        // Step 1: Soft-delete old row (unblocks partial unique index on code)
        const { error: softDeleteError } = await supabase
            .from('chart_of_accounts')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', record.id);

        if (softDeleteError) {
            console.log(`❌ soft-delete failed: ${softDeleteError.message}`);
            failed++;
            continue;
        }

        // Step 2: Insert new row with deterministic ID
        const { error: insertError } = await supabase
            .from('chart_of_accounts')
            .insert({
                id: newId,
                code: record.code,
                name: record.name,
                account_type: record.account_type,
                normal_balance: record.normal_balance,
                parent_code: record.parent_code ?? null,
                is_header: record.is_header ?? false,
                is_active: record.is_active ?? true,
                description: record.description ?? null,
                sort_order: record.sort_order ?? null,
                created_at: record.created_at,
                updated_at: new Date().toISOString(),
                deleted_at: null,
            });

        if (insertError) {
            console.log(`❌ insert failed: ${insertError.message}`);
            // Undo the soft-delete so the old row stays active
            await supabase
                .from('chart_of_accounts')
                .update({ deleted_at: null })
                .eq('id', record.id);
            failed++;
            continue;
        }

        // Step 3: Hard-delete the now-soft-deleted old row
        const { error: deleteError } = await supabase
            .from('chart_of_accounts')
            .delete()
            .eq('id', record.id);

        if (deleteError) {
            // Non-fatal — old row is soft-deleted so it won't affect sync
            console.log(`⚠️  hard-delete skipped: ${deleteError.message}`);
        } else {
            console.log('✅');
        }
        fixed++;
    }

    console.log(`\n✅ Done.  Fixed: ${fixed}  Failed: ${failed}`);
    if (failed > 0) {
        console.warn(`⚠️  ${failed} records could not be updated — check errors above.`);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
