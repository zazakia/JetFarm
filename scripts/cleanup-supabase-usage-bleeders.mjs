/**
 * One-shot production cleanup for Supabase ingress/storage bleeders:
 * - Delete obsolete versioned APKs from `downloads`
 * - Clear brand.logo_base64 blob from app_settings
 * - Scrub oversized app_action_logs payloads (especially logo audits)
 *
 * Usage: node scripts/cleanup-supabase-usage-bleeders.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { listObsoleteApkObjectNames } = require('./apkStorageRetention.js');

const env = readFileSync('.env.production', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
};

const url = get('EXPO_PUBLIC_SUPABASE_URL') || get('SUPABASE_URL');
const key = get('SUPABASE_SECRET_KEY') || get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !key) {
  console.error('Missing Supabase credentials in .env.production');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

console.log('Cleaning production project:', url);

const { data: objects, error: listError } = await sb.storage.from('downloads').list('', { limit: 1000 });
if (listError) {
  console.error('Failed listing downloads:', listError.message);
} else {
  const obsolete = listObsoleteApkObjectNames((objects || []).map((o) => o.name));
  console.log('Storage before:', (objects || []).map((o) => o.name));
  if (obsolete.length === 0) {
    console.log('No obsolete versioned APKs to delete.');
  } else {
    const { error: removeError } = await sb.storage.from('downloads').remove(obsolete);
    if (removeError) {
      console.error('Failed deleting APKs:', removeError.message);
    } else {
      console.log('Deleted obsolete APKs:', obsolete.join(', '));
    }
  }
}

const { data: logoRows, error: logoErr } = await sb
  .from('app_settings')
  .select('id,key,value')
  .eq('key', 'brand.logo_base64');
if (logoErr) {
  console.error('Failed reading logo setting:', logoErr.message);
} else {
  for (const row of logoRows || []) {
    const before = (row.value || '').length;
    if (before === 0) {
      console.log(`Logo setting ${row.id} already empty.`);
      continue;
    }
    const { error } = await sb.from('app_settings').update({ value: '' }).eq('id', row.id);
    if (error) console.error('Failed clearing logo setting:', error.message);
    else console.log(`Cleared logo setting ${row.id} (was ${before} chars).`);
  }
}

const { data: heavyLogs, error: logErr } = await sb
  .from('app_action_logs')
  .select('id,entity_type,entity_id,old_data,new_data')
  .or('entity_id.eq.setting-brand-logo-base64,entity_type.eq.app_settings');
if (logErr) {
  console.error('Failed reading action logs:', logErr.message);
} else {
  let scrubbed = 0;
  for (const row of heavyLogs || []) {
    const oldLen = (row.old_data || '').length;
    const newLen = (row.new_data || '').length;
    if (oldLen + newLen < 2000 && !(row.new_data || '').includes('data:image')) continue;

    const safe = {
      old_data: oldLen > 200
        ? `[omitted:cleaned:${oldLen} chars]`
        : row.old_data || '',
      new_data: newLen > 200
        ? JSON.stringify({
            key: 'brand.logo_base64',
            value: `[omitted:cleaned:${newLen} chars]`,
            note: 'Scrubbed oversized branding audit payload',
          })
        : row.new_data || '',
    };
    const { error } = await sb.from('app_action_logs').update(safe).eq('id', row.id);
    if (error) console.error('Failed scrubbing action log', row.id, error.message);
    else scrubbed += 1;
  }
  console.log(`Scrubbed ${scrubbed} oversized action log(s).`);
}

const { data: afterObjects } = await sb.storage.from('downloads').list('', { limit: 1000 });
console.log('Storage after:', (afterObjects || []).map((o) => `${o.name}:${o.metadata?.size || 0}`));

const { data: logoAfter } = await sb.from('app_settings').select('key,value').eq('key', 'brand.logo_base64');
for (const row of logoAfter || []) {
  console.log(`Logo setting now chars=${(row.value || '').length}`);
}

console.log('Cleanup complete.');
