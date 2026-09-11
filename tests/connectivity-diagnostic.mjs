import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║     POSCursor Database Connectivity Diagnostic Tool        ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Check environment variables
console.log('📋 ENVIRONMENT VARIABLES CHECK');
console.log('─'.repeat(60));

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

console.log(`${supabaseUrl ? '✅' : '❌'} EXPO_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'SET' : 'NOT SET'}`);
console.log(`${supabaseKey ? '✅' : '❌'} EXPO_PUBLIC_SUPABASE_ANON_KEY: ${supabaseKey ? 'SET' : 'NOT SET'}`);

const envOk = supabaseUrl && supabaseKey;

// Check file structure
console.log('\n💾 WATERMELONDB FILES CHECK');
console.log('─'.repeat(60));

const watermelonFiles = [
  'src/database/index.ts',
  'src/database/schema.ts',
  'src/database/supabase.ts',
  'src/services/SyncService.ts',
  'src/database/models/UserProfile.ts',
  'src/database/models/Borrower.ts',
  'src/database/models/Loan.ts',
  'src/database/models/Payment.ts',
  'src/database/models/PaymentSchedule.ts',
  'src/database/models/Expense.ts',
];

let filesOk = 0;
for (const file of watermelonFiles) {
  const fullPath = path.resolve(path.join(__dirname, '..', file));
  const exists = fs.existsSync(fullPath);
  console.log(`${exists ? '✅' : '❌'} ${file}`);
  if (exists) filesOk++;
}

// Supabase connection test
console.log('\n🌐 SUPABASE CONNECTION TEST');
console.log('─'.repeat(60));

let supabaseConnected = false;

if (envOk) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`, {
      method: 'GET',
      timeout: 5000,
    });

    if (response.ok || response.status === 401 || response.status === 404) {
      console.log('✅ Supabase Server: REACHABLE');
      supabaseConnected = true;
    } else {
      console.log(`❌ Supabase Server: Status ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Supabase Connection: ${error.message}`);
  }
} else {
  console.log('⏭️  Skipped - Environment variables not set');
}

// Check schema definitions
console.log('\n🏗️  DATABASE SCHEMA CHECK');
console.log('─'.repeat(60));

try {
  const schemaPath = path.resolve(path.join(__dirname, '..', 'src/database/schema.ts'));
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  const tables = ['user_profiles', 'borrowers', 'loans', 'payments', 'payment_schedules', 'expenses'];
  let tablesFound = 0;

  for (const table of tables) {
    if (schemaContent.includes(`name: '${table}'`)) {
      console.log(`✅ Table '${table}' defined`);
      tablesFound++;
    } else {
      console.log(`❌ Table '${table}' NOT defined`);
    }
  }

  console.log(`\nTotal: ${tablesFound}/${tables.length} tables found`);
} catch (error) {
  console.log(`❌ Schema check error: ${error.message}`);
}

// Summary
console.log('\n' + '═'.repeat(60));
console.log('📊 CONNECTIVITY SUMMARY');
console.log('═'.repeat(60));

const allOk = envOk && supabaseConnected && filesOk === watermelonFiles.length;

console.log(`Environment Variables    : ${envOk ? '✅ OK' : '❌ MISSING'}`);
console.log(`Supabase Connection      : ${supabaseConnected ? '✅ CONNECTED' : '❌ NOT CONNECTED'}`);
console.log(`WatermelonDB Files       : ${filesOk}/${watermelonFiles.length} ✅`);

console.log('\n' + '═'.repeat(60));
if (allOk) {
  console.log('✅ ALL SYSTEMS READY FOR SYNC');
} else {
  console.log('⚠️  ISSUES DETECTED:');
  if (!envOk) console.log('   • Set environment variables in .env');
  if (!supabaseConnected) console.log('   • Check Supabase URL and API key');
  if (filesOk < watermelonFiles.length) console.log('   • Verify WatermelonDB installation');
}
console.log('═'.repeat(60) + '\n');

process.exit(allOk ? 0 : 1);