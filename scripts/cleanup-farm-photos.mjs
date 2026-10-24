#!/usr/bin/env node
/**
 * scripts/cleanup-farm-photos.mjs
 *
 * Optional cleanup script for the Supabase Storage `farm-photos` bucket.
 * Deletes objects whose `expires_at` metadata is in the past.
 *
 * FREE TIER NOTE:
 * Supabase free gives 1 GB storage.
 * At ~200 KB/photo (compressed), that's ~5,000 photos — years of farm data.
 * Run this script only if you actually need to reclaim space.
 *
 * USAGE:
 *   node scripts/cleanup-farm-photos.mjs              # dry-run (lists what would be deleted)
 *   node scripts/cleanup-farm-photos.mjs --apply      # actually deletes expired objects
 *   node scripts/cleanup-farm-photos.mjs --older-than 90  # delete files older than 90 days regardless of metadata
 *
 * SAFE: only deletes from Storage; never modifies WatermelonDB or Supabase table rows.
 * The WDB record will still have the old URL — a placeholder is shown in the UI.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env
let envVars = {};
try {
    const envContent = readFileSync('.env.local', 'utf-8');
    envContent.split('\n').forEach(line => {
        const [key, ...vals] = line.split('=');
        if (key && !key.startsWith('#')) envVars[key.trim()] = vals.join('=').trim();
    });
} catch {
    // fall through to process.env
}

const SUPABASE_URL = envVars['EXPO_PUBLIC_SUPABASE_URL'] || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars['EXPO_PUBLIC_SUPABASE_ANON_KEY'] || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const BUCKET = 'farm-photos';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local');
    process.exit(1);
}

const isDryRun = !process.argv.includes('--apply');
const olderThanArg = process.argv.indexOf('--older-than');
const olderThanDays = olderThanArg !== -1 ? parseInt(process.argv[olderThanArg + 1]) : null;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function listAllFiles(prefix = '') {
    const allFiles = [];
    let offset = 0;
    const limit = 100;
    while (true) {
        const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
            limit,
            offset,
            sortBy: { column: 'created_at', order: 'asc' },
        });
        if (error) throw error;
        if (!data || data.length === 0) break;
        allFiles.push(...data);
        if (data.length < limit) break;
        offset += limit;
    }
    return allFiles;
}

async function run() {
    console.log(`\n🌾 JetFarm Farm Photos Cleanup`);
    console.log(`   Bucket: ${BUCKET}`);
    console.log(`   Mode: ${isDryRun ? 'DRY RUN (safe — add --apply to delete)' : '⚠️  APPLYING DELETIONS'}`);
    if (olderThanDays) console.log(`   Older-than filter: ${olderThanDays} days`);
    console.log('');

    const now = new Date();
    const cutoffDate = olderThanDays
        ? new Date(now.getTime() - olderThanDays * 24 * 60 * 60 * 1000)
        : null;

    // List top-level folders (growth-checkins, harvest, farm-expenses)
    const { data: folders } = await supabase.storage.from(BUCKET).list('', { limit: 50 });
    const folderNames = (folders || []).filter(f => f.id === null).map(f => f.name);

    if (folderNames.length === 0) {
        console.log('No folders found in bucket. Nothing to clean up.');
        return;
    }

    let totalScanned = 0;
    let toDelete = [];

    for (const folder of folderNames) {
        const files = await listAllFiles(folder);
        totalScanned += files.length;

        for (const file of files) {
            const filePath = `${folder}/${file.name}`;
            const createdAt = file.created_at ? new Date(file.created_at) : null;

            // Check expires_at in metadata
            const expiresAt = file.metadata?.expires_at ? new Date(file.metadata.expires_at) : null;
            const isExpiredByMeta = expiresAt && expiresAt < now;

            // Check age-based cutoff
            const isExpiredByAge = cutoffDate && createdAt && createdAt < cutoffDate;

            if (isExpiredByMeta || isExpiredByAge) {
                const reason = isExpiredByMeta
                    ? `expires_at ${expiresAt?.toISOString()}`
                    : `created ${createdAt?.toISOString()} (>${olderThanDays}d)`;
                console.log(`  🗑  ${filePath}  [${reason}]`);
                toDelete.push(filePath);
            }
        }
    }

    console.log(`\n📊 Scanned ${totalScanned} files across ${folderNames.length} folders`);
    console.log(`   Found ${toDelete.length} expired file(s) to delete`);

    if (toDelete.length === 0) {
        console.log('\n✅ Nothing to delete. Bucket is clean.');
        return;
    }

    if (isDryRun) {
        console.log('\n💡 Re-run with --apply to actually delete these files.');
        return;
    }

    // Delete in batches of 20
    const BATCH_SIZE = 20;
    let deleted = 0;
    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
        const batch = toDelete.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.storage.from(BUCKET).remove(batch);
        if (error) {
            console.error(`  ❌ Batch delete error:`, error.message);
        } else {
            deleted += batch.length;
            console.log(`  ✅ Deleted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} files`);
        }
    }

    console.log(`\n🎉 Done. Deleted ${deleted}/${toDelete.length} expired files.`);
    console.log('⚠️  WDB records still have the old URLs — they will show a broken image placeholder in the app.');
}

run().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
