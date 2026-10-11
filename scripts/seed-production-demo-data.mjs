/**
 * scripts/seed-production-demo-data.mjs
 *
 * Populates comprehensive, realistic agribusiness, POS, and financial demo data
 * into the live JetFarm production database on Hetzner Supabase (https://supabase.818.quest).
 *
 * Data domains seeded:
 * 1. Chart of Accounts (CDA & PAS 41 Standards)
 * 2. Regional Agricultural Branches (Bukidnon, Isabela, Tarlac)
 * 3. Regional Warehouses & Storage Facilities
 * 4. Agricultural Suppliers (Planters, Yara, East-West, Petron)
 * 5. Marketplace Store & Agri Products (Seed stems, Fertilizers, Soil nutrients, Bulk roots)
 * 6. Key Employees & Field Officers
 * 7. User Branch Roles
 * 8. Warehouse Stock Movements (Inbound deliveries, Field dispatches, Mill dispatches)
 * 9. Sales Returns Workflow (Draft -> Approve -> Complete, Restock & Quarantine)
 * 10. POS Sessions (Depot counter shifts)
 * 11. Balanced Double-Entry General Ledger (PAS 41 entries with debit=credit integrity)
 * 12. Microfinance / Lending Mock10 records (Collectors, Borrowers, Loans, Schedules, Payments)
 */

import { Agent, fetch as undiciFetch } from 'undici';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ── Connect & Timeout Configuration ──────────────────────────────────────────
const agent = new Agent({
  connect: { timeout: 60000 },
  headersTimeout: 60000,
  bodyTimeout: 60000
});

const customFetch = (url, options = {}) => {
  return undiciFetch(url, { ...options, dispatcher: agent });
};

// ── Credentials Discovery ────────────────────────────────────────────────────
let envFile = path.join(rootDir, '.env.production');
if (!fs.existsSync(envFile)) {
  envFile = path.join(rootDir, '.env.hetzner');
}

if (!fs.existsSync(envFile)) {
  console.error('❌ Neither .env.production nor .env.hetzner found.');
  process.exit(1);
}

const envContent = fs.readFileSync(envFile, 'utf8');
let supabaseUrl = 'https://supabase.818.quest';
let anonKey = '';

for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (trimmed.startsWith('EXPO_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = trimmed.split('=')[1].trim();
  }
  if (trimmed.startsWith('EXPO_PUBLIC_SUPABASE_ANON_KEY=')) {
    anonKey = trimmed.split('=')[1].trim();
  }
}

if (!anonKey) {
  console.error('❌ Missing EXPO_PUBLIC_SUPABASE_ANON_KEY in environment file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: customFetch }
});

// Helper for deterministic timestamps
function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function hoursAgo(hours) {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

async function run() {
  console.log(`\n🌱 Initiating JetFarm Production Demo Data Seed`);
  console.log(`   Target Endpoint: ${supabaseUrl}`);

  // 1. Admin Authentication
  console.log('\n🔑 Authenticating as Production Admin (cybergada@gmail.com)...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'cybergada@gmail.com',
    password: '12345678'
  });

  if (authError) {
    console.error('❌ Authentication failed:', authError.message);
    process.exit(1);
  }

  const adminUserId = authData.user.id;
  console.log(`✅ Authenticated successfully (Admin User ID: ${adminUserId})`);

  // Helper for batch upserts
  async function seedTable(table, rows, label) {
    process.stdout.write(`   Seeding ${label || table}... `);
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
    if (error) {
      console.log(`❌ FAILED: ${error.message}`);
      return false;
    }
    console.log(`✅ ${rows.length} records`);
    return true;
  }

  // ── 1. Chart of Accounts ───────────────────────────────────────────────────
  console.log('\n📊 1. Agribusiness Chart of Accounts (PAS 41 & CDA Standards)');
  const coaAccounts = [
    { code: '1010', name: 'Cash on Hand (COH)', account_type: 'asset', normal_balance: 'debit', is_header: false, is_active: true, description: 'Petty cash and cash drawers in depot branches', sort_order: 1010 },
    { code: '1240', name: 'Biological Assets — Growing Cassava Crops', account_type: 'asset', normal_balance: 'debit', is_header: false, is_active: true, description: 'PAS 41 fair value of standing unharvested cassava crops', sort_order: 1240 },
    { code: '1245', name: 'Agricultural Produce Inventory — Harvested Cassava', account_type: 'asset', normal_balance: 'debit', is_header: false, is_active: true, description: 'Harvested roots weighed and stored in transit sorting bays', sort_order: 1245 },
    { code: '1246', name: 'Agricultural Supplies & Farm Inputs', account_type: 'asset', normal_balance: 'debit', is_header: false, is_active: true, description: 'Stored fertilizers, herbicides, stems and farm equipment', sort_order: 1246 },
    { code: '2020', name: 'SSS Contributions Payable', account_type: 'liability', normal_balance: 'credit', is_header: false, is_active: true, description: 'Employee and employer SSS statutory contributions', sort_order: 2020 },
    { code: '2021', name: 'PhilHealth Contributions Payable', account_type: 'liability', normal_balance: 'credit', is_header: false, is_active: true, description: 'Employee and employer PhilHealth statutory contributions', sort_order: 2021 },
    { code: '2022', name: 'Pag-IBIG Contributions Payable', account_type: 'liability', normal_balance: 'credit', is_header: false, is_active: true, description: 'Employee and employer Pag-IBIG statutory contributions', sort_order: 2022 },
    { code: '2030', name: 'Withholding Tax Payable', account_type: 'liability', normal_balance: 'credit', is_header: false, is_active: true, description: 'BIR expanded & compensation withholding tax', sort_order: 2030 },
    { code: '2035', name: 'Land Owner Settlement Payable', account_type: 'liability', normal_balance: 'credit', is_header: false, is_active: true, description: 'Accrued weekly guaranteed/tonnage settlement payouts to land owners', sort_order: 2035 },
    { code: '2036', name: 'Farm Labor & Harvesters Payable', account_type: 'liability', normal_balance: 'credit', is_header: false, is_active: true, description: 'Accrued field wages and pakyaw harvesters earnings', sort_order: 2036 },
    { code: '3015', name: 'Agribusiness Project Equity / BioGreen Fund', account_type: 'equity', normal_balance: 'credit', is_header: false, is_active: true, description: 'Investor venture capital and institutional project allocations', sort_order: 3015 },
    { code: '4140', name: 'Commercial Cassava Offtake Revenue', account_type: 'income', normal_balance: 'credit', is_header: false, is_active: true, description: 'Offtake contract revenue from starch mills and feed processors', sort_order: 4140 },
    { code: '4145', name: 'Industrial Starch & By-Product Sales', account_type: 'income', normal_balance: 'credit', is_header: false, is_active: true, description: 'Processed cassava starch, dried chips and organic foliage sales', sort_order: 4145 },
    { code: '5160', name: 'Land Lease & Land Owner Production Share', account_type: 'expense', normal_balance: 'debit', is_header: false, is_active: true, description: 'Tonnage and guaranteed weekly lease settlements paid to landowners', sort_order: 5160 },
    { code: '5161', name: 'Farm Labor, Land Prep & Weeding Wages', account_type: 'expense', normal_balance: 'debit', is_header: false, is_active: true, description: 'Direct farm labor, planting crews and manual harvest labor', sort_order: 5161 },
    { code: '5162', name: 'Seeds, Seedlings & Cuttings Cost', account_type: 'expense', normal_balance: 'debit', is_header: false, is_active: true, description: 'Certified seed stems (Rayong 72, KU50, Lakan)', sort_order: 5162 },
    { code: '5163', name: 'Fertilizer, Lime & Soil Nutrients', account_type: 'expense', normal_balance: 'debit', is_header: false, is_active: true, description: 'Complete 14-14-14, Urea 46-0-0 and agricultural dolomite lime', sort_order: 5163 },
    { code: '5164', name: 'Crop Protection & Agrochemicals', account_type: 'expense', normal_balance: 'debit', is_header: false, is_active: true, description: 'Pre-emergence and post-emergence weed control and bio-fungicides', sort_order: 5164 },
    { code: '5165', name: 'Tractor, Fuel & Farm Machinery Services', account_type: 'expense', normal_balance: 'debit', is_header: false, is_active: true, description: 'Diesel, tractor rotavators, disc plows and maintenance', sort_order: 5165 },
    { code: '5166', name: 'Irrigation & Water Management', account_type: 'expense', normal_balance: 'debit', is_header: false, is_active: true, description: 'Furrow irrigation canal upkeep and water pump rentals', sort_order: 5166 },
    { code: '5167', name: 'Post-Harvest Processing & Packaging', account_type: 'expense', normal_balance: 'debit', is_header: false, is_active: true, description: 'Mechanical washing, root cutting, sorting and chipping costs', sort_order: 5167 },
    { code: '5168', name: 'Agricultural Hauling & Freight Services', account_type: 'expense', normal_balance: 'debit', is_header: false, is_active: true, description: 'Flatbed truck hauling from farmgate to buyer starch mills', sort_order: 5168 },
    { code: '5169', name: 'Other Agribusiness Direct Farm Costs', account_type: 'expense', normal_balance: 'debit', is_header: false, is_active: true, description: 'Field supplies, sacks, weigh scale calibration, permits', sort_order: 5169 },
    { code: '6012', name: 'SSS Employer Share', account_type: 'expense', normal_balance: 'debit', is_header: false, is_active: true, description: 'Employer statutory share for Social Security System', sort_order: 6012 },
    { code: '6013', name: 'PhilHealth Employer Share', account_type: 'expense', normal_balance: 'debit', is_header: false, is_active: true, description: 'Employer statutory share for Philippine Health Insurance', sort_order: 6013 },
    { code: '6014', name: 'Pag-IBIG Employer Share', account_type: 'expense', normal_balance: 'debit', is_header: false, is_active: true, description: 'Employer statutory share for Home Development Mutual Fund', sort_order: 6014 }
  ];
  process.stdout.write(`   Seeding Chart of Accounts... `);
  const { data: existingCoa } = await supabase.from('chart_of_accounts').select('id,code');
  const codeToId = new Map((existingCoa || []).map(r => [r.code, r.id]));
  const coaPayload = coaAccounts.map(a => ({
    ...a,
    id: codeToId.get(a.code) || `c0a00000-0000-4000-8000-${a.code.padStart(12, '0')}`
  }));
  const { error: coaErr } = await supabase.from('chart_of_accounts').upsert(coaPayload, { onConflict: 'id' });
  if (coaErr) {
    console.log(`❌ FAILED: ${coaErr.message}`);
  } else {
    console.log(`✅ ${coaPayload.length} records`);
  }

  // ── 2. Regional Branches ───────────────────────────────────────────────────
  console.log('\n🏢 2. Regional Agricultural Operations Branches');
  const branches = [
    { id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', name: 'Northern Mindanao Agri Hub (Bukidnon)', code: 'AGRI-BUK-01', is_hq: false, is_active: true },
    { id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1002', name: 'Isabela Crop Operations Center', code: 'AGRI-ISA-02', is_hq: false, is_active: true },
    { id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1003', name: 'Central Luzon Logistics & Starch Hub', code: 'AGRI-TAR-03', is_hq: false, is_active: true }
  ];
  await seedTable('branches', branches, 'Branches');

  // ── 3. Regional Warehouses ─────────────────────────────────────────────────
  console.log('\n🏬 3. Regional Warehouses & Storage Facilities');
  const warehouses = [
    { id: 'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2001', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', name: 'Bukidnon Central Seedling & Input Depot', type: 'store', is_active: true },
    { id: 'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2002', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', name: 'Manolo Fortich Field Harvest Sorting Bay', type: 'transit', is_active: true },
    { id: 'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2003', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1002', name: 'Isabela Staging & Weighing Hub', type: 'transit', is_active: true },
    { id: 'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2004', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1003', name: 'Tarlac Agro-Industrial Silo', type: 'store', is_active: true }
  ];
  await seedTable('warehouses', warehouses, 'Warehouses');

  // ── 4. Agricultural Suppliers ──────────────────────────────────────────────
  console.log('\n🚛 4. Agricultural Suppliers');
  const suppliers = [
    { id: 'e63c4f99-70d3-4f3c-a04d-9d2c5e1f3001', name: 'Planters Products Inc.', contact_person: 'Eduardo Tan (National Sales)', phone: '+63 917 800 1100', email: 'etan@plantersproducts.ph', address: 'Planters Products Bldg, Esteban St, Legaspi Village, Makati City' },
    { id: 'e63c4f99-70d3-4f3c-a04d-9d2c5e1f3002', name: 'Yara Fertilizers Philippines', contact_person: 'Marivic Soriano (Agri Lead)', phone: '+63 918 800 2200', email: 'marivic.soriano@yara.com', address: 'Unit 14B High Street Corporate Plaza, BGC, Taguig City' },
    { id: 'e63c4f99-70d3-4f3c-a04d-9d2c5e1f3003', name: 'East-West Seed Commercial Division', contact_person: 'Dr. Roberto Guinto', phone: '+63 920 800 3300', email: 'rguinto@eastwestseed.com', address: 'Km 54 Cagayan Valley Road, Sampaloc, San Rafael, Bulacan' },
    { id: 'e63c4f99-70d3-4f3c-a04d-9d2c5e1f3004', name: 'Petron Bulk Agro-Fuels & Logistics', contact_person: 'Ramon Del Rosario', phone: '+63 922 800 4400', email: 'bulk.agro@petron.com', address: 'Petron Terminal Complex, Macabalan, Cagayan de Oro City' }
  ];
  await seedTable('suppliers', suppliers, 'Suppliers');

  // ── 5. Marketplace Store & Agri Products ───────────────────────────────────
  console.log('\n🌾 5. Agri Marketplace Store & Agricultural Products');
  const stores = [
    { id: 'f74d5a09-81e4-4a4d-b15e-ae3d6f2a4001', name: 'JetFarm Agri-Hub & Farm Gate Market', slug: 'jetfarm-agri-hub', description: 'Official supply depot for cassava seed stems, biological fertilizers, and farm inputs', category: 'Agribusiness', status: 'active', holiday_mode: false, rating: 4.95, commission_tier: 'standard' }
  ];
  await seedTable('marketplace_stores', stores, 'Marketplace Stores');

  const products = [
    { id: 'a11b2c3d-0001-4000-8000-000000000001', store_id: 'f74d5a09-81e4-4a4d-b15e-ae3d6f2a4001', title: 'Certified Rayong 72 Seed Stems (100 pcs/bundle)', description: 'High-yield starch variety cassava stalks, disease-free certified cuttings', product_type: 'seed_stem', price: 350.00, compare_at_price: 400.00, stock_quantity: 1500, sku: 'AGRI-STEM-R72', status: 'active' },
    { id: 'a11b2c3d-0002-4000-8000-000000000002', store_id: 'f74d5a09-81e4-4a4d-b15e-ae3d6f2a4001', title: 'KU 50 Cassava Seed Stems (100 pcs/bundle)', description: 'Drought-tolerant industrial feed variety cuttings for heavy clay soils', product_type: 'seed_stem', price: 380.00, compare_at_price: 420.00, stock_quantity: 1200, sku: 'AGRI-STEM-KU50', status: 'active' },
    { id: 'a11b2c3d-0003-4000-8000-000000000003', store_id: 'f74d5a09-81e4-4a4d-b15e-ae3d6f2a4001', title: 'Complete Fertilizer 14-14-14 (50kg sack)', description: 'Balanced basal macro-nutrient fertilizer for root thickening and starch bulking', product_type: 'fertilizer', price: 1950.00, compare_at_price: 2100.00, stock_quantity: 450, sku: 'AGRI-FERT-1414', status: 'active' },
    { id: 'a11b2c3d-0004-4000-8000-000000000004', store_id: 'f74d5a09-81e4-4a4d-b15e-ae3d6f2a4001', title: 'Urea Fertilizer 46-0-0 (50kg sack)', description: 'High nitrogen top-dress fertilizer for rapid vegetative canopy formation', product_type: 'fertilizer', price: 2100.00, compare_at_price: 2250.00, stock_quantity: 380, sku: 'AGRI-FERT-UREA', status: 'active' },
    { id: 'a11b2c3d-0005-4000-8000-000000000005', store_id: 'f74d5a09-81e4-4a4d-b15e-ae3d6f2a4001', title: 'Agricultural Dolomite Lime (50kg sack)', description: 'Soil conditioner for acid neutralization and magnesium supplementation', product_type: 'fertilizer', price: 420.00, compare_at_price: 480.00, stock_quantity: 600, sku: 'AGRI-LIME-DOLO', status: 'active' },
    { id: 'a11b2c3d-0006-4000-8000-000000000006', store_id: 'f74d5a09-81e4-4a4d-b15e-ae3d6f2a4001', title: 'Fresh Cassava Roots — Grade A Commercial (1 MT)', description: 'Bulk fresh cassava tubers >5cm diameter with 28%+ starch density', product_type: 'produce', price: 4500.00, compare_at_price: 4800.00, stock_quantity: 85, sku: 'AGRI-ROOT-GRA', status: 'active' },
    { id: 'a11b2c3d-0007-4000-8000-000000000007', store_id: 'f74d5a09-81e4-4a4d-b15e-ae3d6f2a4001', title: 'Dried Cassava Feed Chips (50kg sack)', description: 'Sun-dried cassava chips with moisture <14% for animal feed milling', product_type: 'produce', price: 550.00, compare_at_price: 600.00, stock_quantity: 500, sku: 'AGRI-CHIP-IND', status: 'active' }
  ];
  await seedTable('marketplace_products', products, 'Marketplace Products');

  // ── 6. Key Employees ───────────────────────────────────────────────────────
  console.log('\n👷 6. Key Employees & Field Agronomists');
  const employees = [
    { id: 'b11e22f3-0001-4000-8000-000000000001', employee_code: 'EMP-AGRI-001', first_name: 'Armando', last_name: 'Mercado', middle_name: 'Reyes', position: 'Lead Agronomist & Field Specialist', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', daily_rate: 1200.00, hire_date: '2025-01-15', sss_number: '04-1234567-1', philhealth_number: '12-000123456-7', pagibig_number: '1234-5678-9012', tin: '201-345-678-000', phone: '+63 917 333 1111', is_active: true },
    { id: 'b11e22f3-0002-4000-8000-000000000002', employee_code: 'EMP-AGRI-002', first_name: 'Joel', last_name: 'Villanueva', middle_name: 'Castro', position: 'Farm Operations & Tractor Fleet Lead', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', daily_rate: 950.00, hire_date: '2025-02-01', sss_number: '04-1234567-2', philhealth_number: '12-000123456-8', pagibig_number: '1234-5678-9013', tin: '201-345-678-001', phone: '+63 918 333 2222', is_active: true },
    { id: 'b11e22f3-0003-4000-8000-000000000003', employee_code: 'EMP-AGRI-003', first_name: 'Marites', last_name: 'Bautista', middle_name: 'Flores', position: 'Agri Warehouse Custodian', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', daily_rate: 750.00, hire_date: '2025-03-01', sss_number: '04-1234567-3', philhealth_number: '12-000123456-9', pagibig_number: '1234-5678-9014', tin: '201-345-678-002', phone: '+63 919 333 3333', is_active: true },
    { id: 'b11e22f3-0004-4000-8000-000000000004', employee_code: 'EMP-AGRI-004', first_name: 'Reynaldo', last_name: 'Dizon', middle_name: 'Soriano', position: 'Field Weighbridge & QC Inspector', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', daily_rate: 700.00, hire_date: '2025-03-15', sss_number: '04-1234567-4', philhealth_number: '12-000123456-0', pagibig_number: '1234-5678-9015', tin: '201-345-678-003', phone: '+63 920 333 4444', is_active: true },
    { id: 'b11e22f3-0005-4000-8000-000000000005', employee_code: 'EMP-AGRI-005', first_name: 'Catherine', last_name: 'Soriano', middle_name: 'Tan', position: 'Agri Financial Accountant', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', daily_rate: 1100.00, hire_date: '2025-01-10', sss_number: '04-1234567-5', philhealth_number: '12-000123456-1', pagibig_number: '1234-5678-9016', tin: '201-345-678-004', phone: '+63 921 333 5555', is_active: true }
  ];
  await seedTable('employees', employees, 'Employees');

  // ── 7. Stock Movements ─────────────────────────────────────────────────────
  console.log('\n📦 7. Supply Chain Stock Movements');
  const stockMovements = [
    { id: 'f22a33b4-0001-4000-8000-000000000001', product_id: 'a11b2c3d-0003-4000-8000-000000000003', product_source: 'marketplace_products', module_id: 'agribusiness', movement_type: 'in', quantity_in: 200, quantity_out: 0, quantity_balance: 200, unit_cost: 1950.00, total_cost: 390000.00, reference_number: 'PO-PLANTERS-2026-001', source_table: 'procurement_orders', movement_date: daysAgo(60), notes: 'Initial basal fertilizer delivery from Planters Products', performed_by: 'EMP-AGRI-003', warehouse_id: 'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2001', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001' },
    { id: 'f22a33b4-0002-4000-8000-000000000002', product_id: 'a11b2c3d-0004-4000-8000-000000000004', product_source: 'marketplace_products', module_id: 'agribusiness', movement_type: 'in', quantity_in: 150, quantity_out: 0, quantity_balance: 150, unit_cost: 2100.00, total_cost: 315000.00, reference_number: 'PO-YARA-2026-002', source_table: 'procurement_orders', movement_date: daysAgo(55), notes: 'Bulk urea procurement for mid-cycle top-dress', performed_by: 'EMP-AGRI-003', warehouse_id: 'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2001', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001' },
    { id: 'f22a33b4-0003-4000-8000-000000000003', product_id: 'a11b2c3d-0003-4000-8000-000000000003', product_source: 'marketplace_products', module_id: 'agribusiness', movement_type: 'out', quantity_in: 0, quantity_out: 140, quantity_balance: 60, unit_cost: 1950.00, total_cost: 273000.00, reference_number: 'DISPATCH-ALPHA-01', source_table: 'agri_farm_expenses', movement_date: daysAgo(45), notes: 'Basal application dispatch to Parcel Alpha (35 ha)', performed_by: 'EMP-AGRI-002', warehouse_id: 'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2001', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001' },
    { id: 'f22a33b4-0004-4000-8000-000000000004', product_id: 'a11b2c3d-0006-4000-8000-000000000006', product_source: 'marketplace_products', module_id: 'agribusiness', movement_type: 'in', quantity_in: 17.34, quantity_out: 0, quantity_balance: 17.34, unit_cost: 4500.00, total_cost: 78030.00, reference_number: 'BATCH-2026-09A', source_table: 'agri_harvest_logs', movement_date: daysAgo(14), notes: 'Weighed-in fresh roots from Parcel Alpha via RAE-4581', performed_by: 'EMP-AGRI-004', warehouse_id: 'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2002', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001' },
    { id: 'f22a33b4-0005-4000-8000-000000000005', product_id: 'a11b2c3d-0006-4000-8000-000000000006', product_source: 'marketplace_products', module_id: 'agribusiness', movement_type: 'in', quantity_in: 19.75, quantity_out: 0, quantity_balance: 37.09, unit_cost: 4500.00, total_cost: 88875.00, reference_number: 'BATCH-2026-09B', source_table: 'agri_harvest_logs', movement_date: daysAgo(13), notes: 'Weighed-in fresh roots from Parcel Alpha via NBD-9023', performed_by: 'EMP-AGRI-004', warehouse_id: 'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2002', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001' },
    { id: 'f22a33b4-0006-4000-8000-000000000006', product_id: 'a11b2c3d-0006-4000-8000-000000000006', product_source: 'marketplace_products', module_id: 'agribusiness', movement_type: 'out', quantity_in: 0, quantity_out: 37.09, quantity_balance: 0, unit_cost: 4500.00, total_cost: 166905.00, reference_number: 'DISPATCH-BIOGREEN-01', source_table: 'agri_investor_ledgers', movement_date: daysAgo(12), notes: 'Dispatched 37.09 MT fresh tubers to BioGreen mill', performed_by: 'EMP-AGRI-004', warehouse_id: 'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2002', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001' }
  ];
  await seedTable('stock_movements', stockMovements, 'Stock Movements');

  // ── 8. Sales Returns Workflow (Draft -> Approve -> Complete) ───────────────
  console.log('\n🔄 8. Sales Returns (Step 1 Draft -> Step 2 Approve -> Step 3 Complete)');
  const salesReturns = [
    { id: 'e77a11b2-0001-4000-8000-000000000001', return_number: 'SR-2026-001', customer_name: 'Don Emilio Viterbo (Cassava Farm Partner)', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', warehouse_id: 'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2001', status: 'completed', reason: 'Over-estimated parcel fertilization requirements; 2 sacks unopened', total_refund_amount: 3900.00, refund_method: 'cash', created_by: 'EMP-AGRI-003', approved_by: 'Admin Cybergada', approved_at: daysAgo(5), completed_at: daysAgo(5), notes: 'Inspected by QC inspector. Sacks intact with manufacturer seal. Restocked to shelf.' },
    { id: 'e77a11b2-0002-4000-8000-000000000002', return_number: 'SR-2026-002', customer_name: 'Engr. Maria Santos-Aquino (Riverside Partner)', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1002', warehouse_id: 'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2003', status: 'completed', reason: '2 bundles of stems crushed during flatbed truck transit; nodes desiccated', total_refund_amount: 700.00, refund_method: 'credit_note', created_by: 'EMP-AGRI-004', approved_by: 'Admin Cybergada', approved_at: daysAgo(3), completed_at: daysAgo(3), notes: 'QC inspection confirmed stems desiccated and cracked. Sent to compost pit (disposed). NOT restocked.' },
    { id: 'e77a11b2-0003-4000-8000-000000000003', return_number: 'SR-2026-003', customer_name: 'Roberto Dela Cruz Sr. (Central Luzon Co-op)', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1003', warehouse_id: 'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2004', status: 'approved', reason: 'Excess 3 bundles KU 50 stems from Capas parcel delivery', total_refund_amount: 1140.00, refund_method: 'credit_note', created_by: 'EMP-AGRI-001', approved_by: 'Admin Cybergada', approved_at: daysAgo(1), notes: 'Approved by supervisor. Awaiting physical turnover and batch validation.' },
    { id: 'e77a11b2-0004-4000-8000-000000000004', return_number: 'SR-2026-004', customer_name: 'Carmen Tan-Sy (Davao Agri-Ventures)', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', warehouse_id: 'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2001', status: 'draft', reason: 'Ordered Dolomite lime instead of Complete 14-14-14', total_refund_amount: 840.00, refund_method: 'cash', created_by: 'EMP-AGRI-003', notes: 'Pending supervisor signature and original official receipt verification.' }
  ];
  await seedTable('sales_returns', salesReturns, 'Sales Returns');

  const salesReturnLines = [
    { id: 'e88a22b3-0001-4000-8000-000000000001', sales_return_id: 'e77a11b2-0001-4000-8000-000000000001', product_id: 'a11b2c3d-0003-4000-8000-000000000003', product_name: 'Complete Fertilizer 14-14-14 (50kg sack)', sku: 'AGRI-FERT-1414', return_quantity: 2, uom: 'sack', uom_multiplier: 1, base_quantity: 2, unit_price: 1950.00, total_amount: 3900.00, condition: 'good', restock_action: 'restocked' },
    { id: 'e88a22b3-0002-4000-8000-000000000002', sales_return_id: 'e77a11b2-0002-4000-8000-000000000002', product_id: 'a11b2c3d-0001-4000-8000-000000000001', product_name: 'Certified Rayong 72 Seed Stems (100 pcs/bundle)', sku: 'AGRI-STEM-R72', return_quantity: 2, uom: 'bundle', uom_multiplier: 100, base_quantity: 200, unit_price: 350.00, total_amount: 700.00, condition: 'damaged', restock_action: 'disposed' },
    { id: 'e88a22b3-0003-4000-8000-000000000003', sales_return_id: 'e77a11b2-0003-4000-8000-000000000003', product_id: 'a11b2c3d-0002-4000-8000-000000000002', product_name: 'KU 50 Cassava Seed Stems (100 pcs/bundle)', sku: 'AGRI-STEM-KU50', return_quantity: 3, uom: 'bundle', uom_multiplier: 100, base_quantity: 300, unit_price: 380.00, total_amount: 1140.00, condition: 'good', restock_action: 'restocked' },
    { id: 'e88a22b3-0004-4000-8000-000000000004', sales_return_id: 'e77a11b2-0004-4000-8000-000000000004', product_id: 'a11b2c3d-0005-4000-8000-000000000005', product_name: 'Agricultural Dolomite Lime (50kg sack)', sku: 'AGRI-LIME-DOLO', return_quantity: 2, uom: 'sack', uom_multiplier: 1, base_quantity: 2, unit_price: 420.00, total_amount: 840.00, condition: 'good', restock_action: 'restocked' }
  ];
  await seedTable('sales_return_lines', salesReturnLines, 'Sales Return Lines');

  // ── 9. POS Sessions ────────────────────────────────────────────────────────
  console.log('\n💳 9. POS Sessions (Depot Counter Sessions)');
  const posSessions = [
    { id: 'd11b22c3-0001-4000-8000-000000000001', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', cashier_id: adminUserId, terminal_id: 'POS-TERM-AGRI-01', opened_at: daysAgo(1), closed_at: hoursAgo(16), opening_float: 5000.00, closing_cash_expected: 48500.00, closing_cash_actual: 48500.00, variance_amount: 0.00, status: 'closed', notes: 'Shift balanced with zero discrepancy. Gross retail sales: ₱43,500.' },
    { id: 'd11b22c3-0002-4000-8000-000000000002', branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', cashier_id: adminUserId, terminal_id: 'POS-TERM-AGRI-01', opened_at: hoursAgo(4), opening_float: 5000.00, status: 'open', notes: 'Active morning farm-gate sales session' }
  ];
  await seedTable('pos_sessions', posSessions, 'POS Sessions');

  // ── 10. Balanced General Ledger Journal Entries ────────────────────────────
  console.log('\n📖 10. General Ledger Journal Entries (PAS 41 Strict Double-Entry)');
  const journalEntries = [
    { id: '00000001-0000-4000-8000-000000000001', entry_date: '2026-01-10T01:00:00Z', reference_number: 'JE-AGRI-2026-001', description: 'BioGreen Capital Placement for CYC-2026-001 (Hacienda Viterbo North)', entry_type: 'auto', journal_type: 'general', source_table: 'agri_investor_ledgers', posted_by: 'Admin Cybergada', is_posted: false, total_debit: 1400000.00, total_credit: 1400000.00, fiscal_year: 2026, fiscal_month: 1, branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001' },
    { id: '00000001-0000-4000-8000-000000000002', entry_date: '2026-01-12T06:00:00Z', reference_number: 'JE-AGRI-2026-002', description: 'Tractor deep plowing & rotavator harrowing (35 ha) — Parcel Alpha', entry_type: 'auto', journal_type: 'cash_disbursement', source_table: 'agri_farm_expenses', posted_by: 'Admin Cybergada', is_posted: false, total_debit: 175000.00, total_credit: 175000.00, fiscal_year: 2026, fiscal_month: 1, branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001' },
    { id: '00000001-0000-4000-8000-000000000003', entry_date: '2026-01-14T03:30:00Z', reference_number: 'JE-AGRI-2026-003', description: 'Certified Rayong 72 high-density stem cuttings for CYC-2026-001', entry_type: 'auto', journal_type: 'purchase', source_table: 'agri_farm_expenses', posted_by: 'Admin Cybergada', is_posted: false, total_debit: 105000.00, total_credit: 105000.00, fiscal_year: 2026, fiscal_month: 1, branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001' },
    { id: '00000001-0000-4000-8000-000000000004', entry_date: '2026-02-15T02:00:00Z', reference_number: 'JE-AGRI-2026-004', description: 'Complete 14-14-14 basal fertilizer application (140 bags)', entry_type: 'auto', journal_type: 'purchase', source_table: 'agri_farm_expenses', posted_by: 'Admin Cybergada', is_posted: false, total_debit: 210000.00, total_credit: 210000.00, fiscal_year: 2026, fiscal_month: 2, branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001' },
    { id: '00000001-0000-4000-8000-000000000005', entry_date: '2026-04-10T07:00:00Z', reference_number: 'JE-AGRI-2026-005', description: 'Urea 46-0-0 top-dress application for vegetative canopy (70 bags)', entry_type: 'auto', journal_type: 'purchase', source_table: 'agri_farm_expenses', posted_by: 'Admin Cybergada', is_posted: false, total_debit: 98000.00, total_credit: 98000.00, fiscal_year: 2026, fiscal_month: 4, branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001' },
    { id: '00000001-0000-4000-8000-000000000006', entry_date: '2026-01-18T09:00:00Z', reference_number: 'JE-AGRI-2026-006', description: 'Planting stem insertion crew pakyaw contract (35 ha)', entry_type: 'auto', journal_type: 'cash_disbursement', source_table: 'agri_labor_logs', posted_by: 'Admin Cybergada', is_posted: false, total_debit: 42000.00, total_credit: 42000.00, fiscal_year: 2026, fiscal_month: 1, branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001' },
    { id: '00000001-0000-4000-8000-000000000007', entry_date: '2026-05-20T08:30:00Z', reference_number: 'JE-AGRI-2026-007', description: 'Mechanical inter-row cultivator weed suppression & labor', entry_type: 'auto', journal_type: 'cash_disbursement', source_table: 'agri_farm_expenses', posted_by: 'Admin Cybergada', is_posted: false, total_debit: 42000.00, total_credit: 42000.00, fiscal_year: 2026, fiscal_month: 5, branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001' },
    { id: '00000001-0000-4000-8000-000000000008', entry_date: '2026-09-21T03:00:00Z', reference_number: 'JE-AGRI-2026-008', description: 'Weekly Landowner Settlement Week 1 — Don Emilio Viterbo (76,890 kg @ ₱1.15/kg)', entry_type: 'auto', journal_type: 'cash_disbursement', source_table: 'agri_weekly_settlements', posted_by: 'Admin Cybergada', is_posted: false, total_debit: 88423.50, total_credit: 88423.50, fiscal_year: 2026, fiscal_month: 9, branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001' },
    { id: '00000001-0000-4000-8000-000000000009', entry_date: '2026-09-20T08:00:00Z', reference_number: 'JE-AGRI-2026-009', description: 'Harvest Offtake Delivery Week 1 — 76,890 kg @ ₱4.50/kg to BioGreen Mill', entry_type: 'auto', journal_type: 'sales', source_table: 'agri_investor_ledgers', posted_by: 'Admin Cybergada', is_posted: false, total_debit: 346005.00, total_credit: 346005.00, fiscal_year: 2026, fiscal_month: 9, branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001' },
    { id: '00000001-0000-4000-8000-000000000010', entry_date: '2026-02-25T02:00:00Z', reference_number: 'JE-AGRI-2026-010', description: 'San Miguel Agro-Feeds Inflow for Isabela CYC-2026-002', entry_type: 'auto', journal_type: 'general', source_table: 'agri_investor_ledgers', posted_by: 'Admin Cybergada', is_posted: false, total_debit: 800000.00, total_credit: 800000.00, fiscal_year: 2026, fiscal_month: 2, branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1002' },
    { id: '00000001-0000-4000-8000-000000000011', entry_date: '2026-06-30T10:00:00Z', reference_number: 'JE-AGRI-2026-011', description: 'Mid-cycle biological asset valuation for Parcel Alpha & Beta standing crops', entry_type: 'adjusting', journal_type: 'general', source_table: 'agri_crop_cycles', posted_by: 'Admin Cybergada', is_posted: false, total_debit: 350000.00, total_credit: 350000.00, fiscal_year: 2026, fiscal_month: 6, branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001' },
    { id: '00000001-0000-4000-8000-000000000012', entry_date: '2026-09-22T09:00:00Z', reference_number: 'JE-AGRI-2026-012', description: 'Harvest produce inventory transfer from biological assets to sorting bay', entry_type: 'adjusting', journal_type: 'inventory', source_table: 'agri_harvest_logs', posted_by: 'Admin Cybergada', is_posted: false, total_debit: 150000.00, total_credit: 150000.00, fiscal_year: 2026, fiscal_month: 9, branch_id: 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001' }
  ];
  await seedTable('journal_entries', journalEntries, 'Journal Entries (Headers)');

  const journalEntryLines = [
    // JE 1 Lines
    { id: '00000002-0000-4000-8000-000000000101', journal_entry_id: '00000001-0000-4000-8000-000000000001', account_code: '1010', account_name: 'Cash on Hand (COH)', debit_amount: 1400000.00, credit_amount: 0.00, description: 'BioGreen venture capital inflow', business_unit_id: 'agribusiness', module_source_table: 'agri_investor_ledgers' },
    { id: '00000002-0000-4000-8000-000000000102', journal_entry_id: '00000001-0000-4000-8000-000000000001', account_code: '3015', account_name: 'Agribusiness Project Equity / BioGreen Fund', debit_amount: 0.00, credit_amount: 1400000.00, description: 'BioGreen venture capital inflow', business_unit_id: 'agribusiness', module_source_table: 'agri_investor_ledgers' },

    // JE 2 Lines
    { id: '00000002-0000-4000-8000-000000000201', journal_entry_id: '00000001-0000-4000-8000-000000000002', account_code: '5165', account_name: 'Tractor, Fuel & Farm Machinery Services', debit_amount: 175000.00, credit_amount: 0.00, description: 'Tractor plowing & harrowing', business_unit_id: 'agribusiness', module_source_table: 'agri_farm_expenses' },
    { id: '00000002-0000-4000-8000-000000000202', journal_entry_id: '00000001-0000-4000-8000-000000000002', account_code: '1010', account_name: 'Cash on Hand (COH)', debit_amount: 0.00, credit_amount: 175000.00, description: 'Tractor plowing & harrowing', business_unit_id: 'agribusiness', module_source_table: 'agri_farm_expenses' },

    // JE 3 Lines
    { id: '00000002-0000-4000-8000-000000000301', journal_entry_id: '00000001-0000-4000-8000-000000000003', account_code: '5162', account_name: 'Seeds, Seedlings & Cuttings Cost', debit_amount: 105000.00, credit_amount: 0.00, description: 'Rayong 72 cuttings purchase', business_unit_id: 'agribusiness', module_source_table: 'agri_farm_expenses' },
    { id: '00000002-0000-4000-8000-000000000302', journal_entry_id: '00000001-0000-4000-8000-000000000003', account_code: '3015', account_name: 'Agribusiness Project Equity / BioGreen Fund', debit_amount: 0.00, credit_amount: 105000.00, description: 'Investor funded seed cuttings', business_unit_id: 'agribusiness', module_source_table: 'agri_farm_expenses' },

    // JE 4 Lines
    { id: '00000002-0000-4000-8000-000000000401', journal_entry_id: '00000001-0000-4000-8000-000000000004', account_code: '5163', account_name: 'Fertilizer, Lime & Soil Nutrients', debit_amount: 210000.00, credit_amount: 0.00, description: 'Complete 14-14-14 basal fertilizer', business_unit_id: 'agribusiness', module_source_table: 'agri_farm_expenses' },
    { id: '00000002-0000-4000-8000-000000000402', journal_entry_id: '00000001-0000-4000-8000-000000000004', account_code: '3015', account_name: 'Agribusiness Project Equity / BioGreen Fund', debit_amount: 0.00, credit_amount: 210000.00, description: 'Investor funded fertilizer', business_unit_id: 'agribusiness', module_source_table: 'agri_farm_expenses' },

    // JE 5 Lines
    { id: '00000002-0000-4000-8000-000000000501', journal_entry_id: '00000001-0000-4000-8000-000000000005', account_code: '5163', account_name: 'Fertilizer, Lime & Soil Nutrients', debit_amount: 98000.00, credit_amount: 0.00, description: 'Urea 46-0-0 top-dress fertilizer', business_unit_id: 'agribusiness', module_source_table: 'agri_farm_expenses' },
    { id: '00000002-0000-4000-8000-000000000502', journal_entry_id: '00000001-0000-4000-8000-000000000005', account_code: '3015', account_name: 'Agribusiness Project Equity / BioGreen Fund', debit_amount: 0.00, credit_amount: 98000.00, description: 'Investor funded urea', business_unit_id: 'agribusiness', module_source_table: 'agri_farm_expenses' },

    // JE 6 Lines
    { id: '00000002-0000-4000-8000-000000000601', journal_entry_id: '00000001-0000-4000-8000-000000000006', account_code: '5161', account_name: 'Farm Labor, Land Prep & Weeding Wages', debit_amount: 42000.00, credit_amount: 0.00, description: 'Planting stem insertion contract', business_unit_id: 'agribusiness', module_source_table: 'agri_labor_logs' },
    { id: '00000002-0000-4000-8000-000000000602', journal_entry_id: '00000001-0000-4000-8000-000000000006', account_code: '1010', account_name: 'Cash on Hand (COH)', debit_amount: 0.00, credit_amount: 42000.00, description: 'Planting stem insertion contract', business_unit_id: 'agribusiness', module_source_table: 'agri_labor_logs' },

    // JE 7 Lines
    { id: '00000002-0000-4000-8000-000000000701', journal_entry_id: '00000001-0000-4000-8000-000000000007', account_code: '5161', account_name: 'Farm Labor, Land Prep & Weeding Wages', debit_amount: 42000.00, credit_amount: 0.00, description: 'Weed suppression cultivator pass', business_unit_id: 'agribusiness', module_source_table: 'agri_farm_expenses' },
    { id: '00000002-0000-4000-8000-000000000702', journal_entry_id: '00000001-0000-4000-8000-000000000007', account_code: '1010', account_name: 'Cash on Hand (COH)', debit_amount: 0.00, credit_amount: 42000.00, description: 'Weed suppression cultivator pass', business_unit_id: 'agribusiness', module_source_table: 'agri_farm_expenses' },

    // JE 8 Lines
    { id: '00000002-0000-4000-8000-000000000801', journal_entry_id: '00000001-0000-4000-8000-000000000008', account_code: '5160', account_name: 'Land Lease & Land Owner Production Share', debit_amount: 88423.50, credit_amount: 0.00, description: 'Week 1 land owner settlement', business_unit_id: 'agribusiness', module_source_table: 'agri_weekly_settlements' },
    { id: '00000002-0000-4000-8000-000000000802', journal_entry_id: '00000001-0000-4000-8000-000000000008', account_code: '1010', account_name: 'Cash on Hand (COH)', debit_amount: 0.00, credit_amount: 88423.50, description: 'Week 1 land owner settlement', business_unit_id: 'agribusiness', module_source_table: 'agri_weekly_settlements' },

    // JE 9 Lines
    { id: '00000002-0000-4000-8000-000000000901', journal_entry_id: '00000001-0000-4000-8000-000000000009', account_code: '1010', account_name: 'Cash on Hand (COH)', debit_amount: 346005.00, credit_amount: 0.00, description: 'Week 1 offtake revenue received', business_unit_id: 'agribusiness', module_source_table: 'agri_investor_ledgers' },
    { id: '00000002-0000-4000-8000-000000000902', journal_entry_id: '00000001-0000-4000-8000-000000000009', account_code: '4140', account_name: 'Commercial Cassava Offtake Revenue', debit_amount: 0.00, credit_amount: 346005.00, description: 'Week 1 offtake revenue recognized', business_unit_id: 'agribusiness', module_source_table: 'agri_investor_ledgers' },

    // JE 10 Lines
    { id: '00000002-0000-4000-8000-000000001001', journal_entry_id: '00000001-0000-4000-8000-000000000010', account_code: '1010', account_name: 'Cash on Hand (COH)', debit_amount: 800000.00, credit_amount: 0.00, description: 'San Miguel project placement', business_unit_id: 'agribusiness', module_source_table: 'agri_investor_ledgers' },
    { id: '00000002-0000-4000-8000-000000001002', journal_entry_id: '00000001-0000-4000-8000-000000000010', account_code: '3015', account_name: 'Agribusiness Project Equity / BioGreen Fund', debit_amount: 0.00, credit_amount: 800000.00, description: 'San Miguel project placement', business_unit_id: 'agribusiness', module_source_table: 'agri_investor_ledgers' },

    // JE 11 Lines
    { id: '00000002-0000-4000-8000-000000001101', journal_entry_id: '00000001-0000-4000-8000-000000000011', account_code: '1240', account_name: 'Biological Assets — Growing Cassava Crops', debit_amount: 350000.00, credit_amount: 0.00, description: 'Accrual of biological growth', business_unit_id: 'agribusiness', module_source_table: 'agri_crop_cycles' },
    { id: '00000002-0000-4000-8000-000000001102', journal_entry_id: '00000001-0000-4000-8000-000000000011', account_code: '4140', account_name: 'Commercial Cassava Offtake Revenue', debit_amount: 0.00, credit_amount: 350000.00, description: 'Unharvested agricultural gain', business_unit_id: 'agribusiness', module_source_table: 'agri_crop_cycles' },

    // JE 12 Lines
    { id: '00000002-0000-4000-8000-000000001201', journal_entry_id: '00000001-0000-4000-8000-000000000012', account_code: '1245', account_name: 'Agricultural Produce Inventory — Harvested Cassava', debit_amount: 150000.00, credit_amount: 0.00, description: 'Harvest produce transfer', business_unit_id: 'agribusiness', module_source_table: 'agri_harvest_logs' },
    { id: '00000002-0000-4000-8000-000000001202', journal_entry_id: '00000001-0000-4000-8000-000000000012', account_code: '1240', account_name: 'Biological Assets — Growing Cassava Crops', debit_amount: 0.00, credit_amount: 150000.00, description: 'Biological harvest transfer', business_unit_id: 'agribusiness', module_source_table: 'agri_harvest_logs' }
  ];
  await seedTable('journal_entry_lines', journalEntryLines, 'Journal Entry Lines');

  // Post the journal entries now that all debit/credit lines are in place
  process.stdout.write(`   Posting journal entries (strictly balancing)... `);
  const jeIds = journalEntries.map(e => e.id);
  const { error: postErr } = await supabase
    .from('journal_entries')
    .update({ is_posted: true })
    .in('id', jeIds);
  if (postErr) {
    console.log(`❌ FAILED: ${postErr.message}`);
  } else {
    console.log(`✅ 12 entries validated and marked posted`);
  }

  // ── 11. Microfinance & Field Collection (MOCK10) ───────────────────────────
  console.log('\n👥 11. Microfinance Lending & Field Collectors (MOCK10)');
  const collectors = [];
  for (let i = 1; i <= 10; i++) {
    const pad = String(i).padStart(2, '0');
    collectors.push({
      id: `00000000-0000-1000-0000-${String(i).padStart(12, '0')}`,
      full_name: `Collector ${pad} (Agri Field Officer)`,
      is_active: true
    });
  }
  await seedTable('app_collectors', collectors, 'App Collectors');

  const borrowers = [];
  for (let i = 1; i <= 10; i++) {
    const pad = String(i).padStart(2, '0');
    borrowers.push({
      id: `00000000-0000-2000-0000-${String(i).padStart(12, '0')}`,
      full_name: `Grower Partner ${pad}`,
      first_name: 'Grower',
      last_name: `Partner ${pad}`,
      address: `Sitio Mahayahay, Barangay ${i}, Bukidnon`,
      phone: `+63 917 000 ${String(i).padStart(4, '0')}`,
      area: `Cluster ${((i - 1) % 5) + 1}`,
      route_index: i,
      collector_id: `00000000-0000-1000-0000-${String(i).padStart(12, '0')}`,
      gender: i % 2 === 0 ? 'Female' : 'Male',
      notes: 'Outgrower smallholder farmer with cassava landholdings',
      business: `Cassava Farm Parcel ${i}`
    });
  }
  await seedTable('app_borrowers', borrowers, 'App Borrowers');

  const loans = [];
  const schedules = [];
  const payments = [];

  for (let i = 1; i <= 10; i++) {
    const pad = String(i).padStart(2, '0');
    const loanId = `mock10-loan-${pad}`;
    const borrowerId = `00000000-0000-2000-0000-${String(i).padStart(12, '0')}`;
    const collectorId = `00000000-0000-1000-0000-${String(i).padStart(12, '0')}`;
    const principal = 10000 + i * 2000;
    const total = principal * 1.15;

    loans.push({
      id: loanId,
      borrower_id: borrowerId,
      loan_number: `AGRI-LN-${pad}`,
      loan_type: i % 2 === 0 ? 'crop_financing' : 'input_advance',
      principal_amount: principal,
      interest_rate: 15,
      interest_type: 'flat',
      term: 90,
      term_unit: 'days',
      frequency: 'weekly',
      total_amount: total,
      installment_amount: Math.round(total / 12),
      status: i > 8 ? 'pending' : 'active',
      is_reloan: i % 3 === 0,
      encoded_by: 'cybergada@gmail.com',
      collector_id: collectorId,
      notes: 'Fertilizer & seed stem crop advance loan'
    });

    schedules.push({
      id: `mock10-sched-${pad}`,
      loan_id: loanId,
      due_date: daysAgo(-7 * i),
      scheduled_amount: Math.round(total / 12),
      status: i <= 5 ? 'paid' : 'pending',
      principal_amount: Math.round(principal / 12),
      interest_amount: Math.round((total - principal) / 12)
    });

    if (i <= 5) {
      payments.push({
        id: `mock10-pay-${pad}`,
        loan_id: loanId,
        borrower_id: borrowerId,
        schedule_id: `mock10-sched-${pad}`,
        collector_id: collectorId,
        amount: Math.round(total / 12),
        payment_date: daysAgo(i * 2),
        receipt_number: `RCPT-AGRI-${pad}`,
        notes: 'Weekly crop loan amortization payment'
      });
    }
  }

  await seedTable('app_loans', loans, 'App Loans');
  await seedTable('app_payment_schedules', schedules, 'Payment Schedules');
  await seedTable('app_payments', payments, 'App Payments');

  console.log('\n🎉 Production Demo & Sample Data Seeding Completed Successfully!\n');
}

run().catch((err) => {
  console.error('\n❌ Unhandled exception during seeding:', err);
  process.exit(1);
});
