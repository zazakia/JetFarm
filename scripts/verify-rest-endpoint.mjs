import { readFileSync, existsSync } from 'fs';
import path from 'path';

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

loadEnvFile(path.join(process.cwd(), '.env.local'));

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:46421';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

async function testEndpoint(tableName) {
  const url = `${SUPABASE_URL}/rest/v1/${tableName}?select=*&limit=1`;
  console.log(`Testing GET ${url}...`);
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
      },
    });
    console.log(`  Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`  [OK] Successfully fetched ${tableName} (${data.length} records returned).`);
    } else {
      const errText = await res.text();
      console.error(`  [FAIL] Failed fetching ${tableName}: ${errText}`);
    }
  } catch (err) {
    console.error(`  [ERROR] ${err.message}`);
  }
}

async function main() {
  console.log('Verifying local PostgREST REST API endpoints...\n');
  await testEndpoint('app_loan_applications');
  await testEndpoint('app_guarantors');
  await testEndpoint('app_areas');
}

main();
