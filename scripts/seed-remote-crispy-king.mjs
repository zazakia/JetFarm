#!/usr/bin/env node
/**
 * scripts/seed-remote-crispy-king.mjs
 *
 * Populates Crispy King master data on the remote Supabase production database:
 * 1. 4 App Areas (Supervisors: Baby Ann, Christian, Renor, Jumar)
 * 2. 39 Business Units / Branches scoped to their respective areas
 * 3. 3 Broiler & Commissary Suppliers (Magnolia, Bounty Fresh, Ali Agri)
 * 4. Master Commissary Store + 12 Menu Products
 * 5. Full QSR Chart of Accounts (Assets, Liabilities, Equity, Revenue, COGS, OPEX)
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Deterministic UUID helper for stable idempotent seeds
function deterministicUuid(seedStr) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        hash = (Math.imul(31, hash) + seedStr.charCodeAt(i)) | 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `00000000-0000-4000-8000-${hex.repeat(2).slice(0, 12)}`;
}

// 1. Read production env
const envPath = resolve(process.cwd(), '.env.production');
if (!existsSync(envPath)) {
    console.error('Error: .env.production file not found.');
    process.exit(1);
}

const envContent = readFileSync(envPath, 'utf8');
let supabaseUrl = '';
let supabaseKey = '';

for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('EXPO_PUBLIC_SUPABASE_URL=')) {
        supabaseUrl = trimmed.split('=')[1].trim();
    }
    if (trimmed.startsWith('SUPABASE_SECRET_KEY=')) {
        supabaseKey = trimmed.split('=')[1].trim();
    }
}

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.production');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Define Crispy King Entities
const SUPERVISORS = [
    { code: 'AREA-BABYANN', name: 'Area Baby Ann', uuid: '00000000-0000-4000-8000-0000000000a1' },
    { code: 'AREA-CHRISTIAN', name: 'Area Christian', uuid: '00000000-0000-4000-8000-0000000000a2' },
    { code: 'AREA-RENOR', name: 'Area Renor', uuid: '00000000-0000-4000-8000-0000000000a3' },
    { code: 'AREA-JUMAR', name: 'Area Jumar', uuid: '00000000-0000-4000-8000-0000000000a4' },
];

const BRANCHES = [
    // Area Baby Ann (8)
    { slug: 'ck-tayasan', name: 'Crispy King - Tayasan', supervisorCode: 'AREA-BABYANN', description: 'Tayasan Franchise Branch' },
    { slug: 'ck-ayungon-1', name: 'Crispy King - Ayungon 1', supervisorCode: 'AREA-BABYANN', description: 'Ayungon Branch 1' },
    { slug: 'ck-ayungon-2', name: 'Crispy King - Ayungon 2', supervisorCode: 'AREA-BABYANN', description: 'Ayungon Branch 2' },
    { slug: 'ck-bindoy-1', name: 'Crispy King - Bindoy 1', supervisorCode: 'AREA-BABYANN', description: 'Bindoy Branch 1' },
    { slug: 'ck-bindoy-2', name: 'Crispy King - Bindoy 2', supervisorCode: 'AREA-BABYANN', description: 'Bindoy Branch 2' },
    { slug: 'ck-guihulngan', name: 'Crispy King - Guihulngan', supervisorCode: 'AREA-BABYANN', description: 'Guihulngan City Branch' },
    { slug: 'ck-jimalalud', name: 'Crispy King - Jimalalud', supervisorCode: 'AREA-BABYANN', description: 'Jimalalud Branch' },
    { slug: 'ck-manjuyod', name: 'Crispy King - Manjuyod', supervisorCode: 'AREA-BABYANN', description: 'Manjuyod Branch' },

    // Area Christian (7)
    { slug: 'ck-bayawan', name: 'Crispy King - Bayawan', supervisorCode: 'AREA-CHRISTIAN', description: 'Bayawan City Branch' },
    { slug: 'ck-mabinay-1', name: 'Crispy King - Mabinay 1', supervisorCode: 'AREA-CHRISTIAN', description: 'Mabinay Branch 1' },
    { slug: 'ck-mabinay-2', name: 'Crispy King - Mabinay 2', supervisorCode: 'AREA-CHRISTIAN', description: 'Mabinay Branch 2' },
    { slug: 'ck-pamplona', name: 'Crispy King - Pamplona', supervisorCode: 'AREA-CHRISTIAN', description: 'Pamplona Branch' },
    { slug: 'ck-sta-agueda', name: 'Crispy King - Sta. Agueda', supervisorCode: 'AREA-CHRISTIAN', description: 'Sta. Agueda Branch' },
    { slug: 'ck-tanjay-1', name: 'Crispy King - Tanjay 1', supervisorCode: 'AREA-CHRISTIAN', description: 'Tanjay City Branch 1' },
    { slug: 'ck-tanjay-2', name: 'Crispy King - Tanjay 2', supervisorCode: 'AREA-CHRISTIAN', description: 'Tanjay City Branch 2' },

    // Area Renor (8)
    { slug: 'ck-sagay-1', name: 'Crispy King - Sagay 1', supervisorCode: 'AREA-RENOR', description: 'Sagay Branch 1' },
    { slug: 'ck-san-carlos-2', name: 'Crispy King - San Carlos 2', supervisorCode: 'AREA-RENOR', description: 'San Carlos City Branch 2' },
    { slug: 'ck-sagay-2', name: 'Crispy King - Sagay 2', supervisorCode: 'AREA-RENOR', description: 'Sagay Branch 2' },
    { slug: 'ck-san-carlos-1', name: 'Crispy King - San Carlos 1', supervisorCode: 'AREA-RENOR', description: 'San Carlos City Branch 1' },
    { slug: 'ck-quezon', name: 'Crispy King - Quezon', supervisorCode: 'AREA-RENOR', description: 'Quezon Branch' },
    { slug: 'ck-san-carlos-5', name: 'Crispy King - San Carlos 5', supervisorCode: 'AREA-RENOR', description: 'San Carlos City Branch 5' },
    { slug: 'ck-san-carlos-7', name: 'Crispy King - San Carlos 7', supervisorCode: 'AREA-RENOR', description: 'San Carlos City Branch 7' },
    { slug: 'ck-canla-on', name: 'Crispy King - Canla-on', supervisorCode: 'AREA-RENOR', description: 'Canlaon City Branch' },

    // Area Jumar (16)
    { slug: 'ck-locsin', name: 'Crispy King - Locsin', supervisorCode: 'AREA-JUMAR', description: 'Locsin Dumaguete Branch' },
    { slug: 'ck-noph', name: 'Crispy King - NOPH', supervisorCode: 'AREA-JUMAR', description: 'NOPH Dumaguete Branch' },
    { slug: 'ck-zambo', name: 'Crispy King - Zambo', supervisorCode: 'AREA-JUMAR', description: 'Zamboanguita Branch' },
    { slug: 'ck-daro', name: 'Crispy King - Daro', supervisorCode: 'AREA-JUMAR', description: 'Daro Dumaguete Branch' },
    { slug: 'ck-sta-rosa', name: 'Crispy King - Sta. Rosa', supervisorCode: 'AREA-JUMAR', description: 'Sta. Rosa Branch' },
    { slug: 'ck-dalaguete', name: 'Crispy King - Dalaguete', supervisorCode: 'AREA-JUMAR', description: 'Dalaguete Cebu Branch' },
    { slug: 'ck-bacong-1', name: 'Crispy King - Bacong 1', supervisorCode: 'AREA-JUMAR', description: 'Bacong Branch 1' },
    { slug: 'ck-batinguel', name: 'Crispy King - Batinguel', supervisorCode: 'AREA-JUMAR', description: 'Batinguel Dumaguete Branch' },
    { slug: 'ck-junob', name: 'Crispy King - Junob', supervisorCode: 'AREA-JUMAR', description: 'Junob Dumaguete Branch' },
    { slug: 'ck-bagacay', name: 'Crispy King - Bagacay', supervisorCode: 'AREA-JUMAR', description: 'Bagacay Benchmark Branch' },
    { slug: 'ck-larena', name: 'Crispy King - Larena', supervisorCode: 'AREA-JUMAR', description: 'Larena Siquijor Branch' },
    { slug: 'ck-bacong-2', name: 'Crispy King - Bacong 2', supervisorCode: 'AREA-JUMAR', description: 'Bacong Branch 2' },
    { slug: 'ck-lilo-an', name: 'Crispy King - Lilo-an', supervisorCode: 'AREA-JUMAR', description: 'Liloan Cebu Branch' },
    { slug: 'ck-tinago', name: 'Crispy King - Tinago', supervisorCode: 'AREA-JUMAR', description: 'Tinago Dumaguete Branch' },
    { slug: 'ck-santander', name: 'Crispy King - Santander', supervisorCode: 'AREA-JUMAR', description: 'Santander Cebu Branch' },
    { slug: 'ck-dumaguete-port', name: 'Crispy King - Dumaguete Port', supervisorCode: 'AREA-JUMAR', description: 'Dumaguete Port Terminal Branch' },
];

const SUPPLIERS = [
    {
        name: 'Magnolia Chicken',
        contact_person: 'Account Representative',
        phone: '0917-111-0001',
        tin: '102-345-678-000',
        payment_terms_days: 15,
        address: 'San Miguel Foods, Mandaue City, Cebu',
    },
    {
        name: 'Bounty Fresh',
        contact_person: 'Wholesale Delivery Team',
        phone: '0917-111-0002',
        tin: '203-456-789-000',
        payment_terms_days: 15,
        address: 'Bounty Fresh Food Inc., Bacolod City',
    },
    {
        name: 'Ali Agri (Live/Dressed Broilers)',
        contact_person: 'Broiler Dispatch',
        phone: '0917-111-0003',
        tin: '304-567-890-000',
        payment_terms_days: 7,
        address: 'Ali Agricultural Farm, Dumaguete City',
    },
];

const PRODUCTS = [
    { sku: 'CK-SCUT', title: 'Special Cut Fried Chicken', price: 50.0, product_type: 'chicken', stock_quantity: 500, description: 'Crispy deep-fried golden brown chicken piece with savory gravy' },
    { sku: 'CK-RICE', title: 'Cooked Rice', price: 15.0, product_type: 'sides', stock_quantity: 1000, description: 'Steamed fragrant white rice' },
    { sku: 'CK-SD10', title: 'Softdrinks 1.0L', price: 45.0, product_type: 'drinks', stock_quantity: 200, description: '1.0 Liter bottled soda' },
    { sku: 'CK-SD15', title: 'Softdrinks 1.5L', price: 65.0, product_type: 'drinks', stock_quantity: 150, description: '1.5 Liter bottled soda' },
    { sku: 'CK-NECK', title: 'Chicken Neck', price: 20.0, product_type: 'specialty', stock_quantity: 300, description: 'Crispy seasoned fried chicken neck piece' },
    { sku: 'CK-FLT', title: 'Chicken Fillet', price: 45.0, product_type: 'specialty', stock_quantity: 250, description: 'Boneless tender chicken fillet' },
    { sku: 'CK-BOLA', title: 'Bola-Bola', price: 20.0, product_type: 'specialty', stock_quantity: 400, description: 'Crispy chicken meatballs' },
    { sku: 'CK-LUMP', title: 'Lumpia', price: 15.0, product_type: 'specialty', stock_quantity: 400, description: 'Crispy fried spring roll' },
    { sku: 'CK-NGOH', title: 'Ngohiong', price: 20.0, product_type: 'specialty', stock_quantity: 350, description: 'Spiced deep fried five-spice roll' },
    { sku: 'CK-ATSR', title: 'Atsara', price: 10.0, product_type: 'condiments', stock_quantity: 300, description: 'Pickled sweet and sour papaya' },
    { sku: 'CK-FATS', title: 'Chicken Fats (Wholesale)', price: 50.0, product_type: 'by-product', stock_quantity: 100, description: 'Raw chicken fat by-product (per kg)' },
    { sku: 'CK-SKIN', title: 'Chicken Skin (Wholesale)', price: 80.0, product_type: 'by-product', stock_quantity: 100, description: 'Raw chicken skin by-product (per kg)' },
];

const COA = [
    // ASSETS
    { code: '1000', name: 'ASSETS', account_type: 'asset', normal_balance: 'debit', is_header: true, sort_order: 1 },
    { code: '1010', name: 'Cash on Hand (COH)', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 2 },
    { code: '1020', name: 'Petty Cash Fund', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 3 },
    { code: '1100', name: 'Accounts Receivable', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 10 },
    { code: '1200', name: 'Merchandise Inventory', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 15, description: 'Raw Chicken, Fried Chicken, Rice, Oil, Breading, Drinks' },

    // LIABILITIES
    { code: '2000', name: 'LIABILITIES', account_type: 'liability', normal_balance: 'credit', is_header: true, sort_order: 100 },
    { code: '2010', name: 'Accounts Payable (Suppliers)', account_type: 'liability', normal_balance: 'credit', parent_code: '2000', sort_order: 101 },
    { code: '2050', name: 'Due to Franchisor (Royalty Payable)', account_type: 'liability', normal_balance: 'credit', parent_code: '2000', sort_order: 105 },

    // EQUITY
    { code: '3000', name: 'EQUITY', account_type: 'equity', normal_balance: 'credit', is_header: true, sort_order: 200 },
    { code: '3010', name: 'Partner Capital (Viterbo Foods OPC)', account_type: 'equity', normal_balance: 'credit', parent_code: '3000', sort_order: 201 },

    // REVENUE
    { code: '4000', name: 'REVENUE', account_type: 'income', normal_balance: 'credit', is_header: true, sort_order: 300 },
    { code: '4010', name: 'Fried Chicken Sales', account_type: 'income', normal_balance: 'credit', parent_code: '4000', sort_order: 301 },
    { code: '4020', name: 'Rice Sales', account_type: 'income', normal_balance: 'credit', parent_code: '4000', sort_order: 302 },
    { code: '4030', name: 'Beverage Sales', account_type: 'income', normal_balance: 'credit', parent_code: '4000', sort_order: 303 },
    { code: '4040', name: 'Specialty Sales', account_type: 'income', normal_balance: 'credit', parent_code: '4000', sort_order: 304 },
    { code: '4050', name: 'By-Product Sales (Fats/Skin)', account_type: 'income', normal_balance: 'credit', parent_code: '4000', sort_order: 305 },

    // COGS
    { code: '5000', name: 'COST OF GOODS SOLD', account_type: 'expense', normal_balance: 'debit', is_header: true, sort_order: 400 },
    { code: '5010', name: 'Dressed Chicken Used', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 401 },
    { code: '5020', name: 'Deep Frying Oil', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 402 },
    { code: '5030', name: 'Breading & Gravy Mix', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 403 },
    { code: '5040', name: 'Raw Rice', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 404 },
    { code: '5050', name: 'Beverage Inventory Used', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 405 },

    // OPEX
    { code: '5100', name: 'Spoilage & Bad Orders', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 410 },
    { code: '6000', name: 'OPERATING EXPENSES', account_type: 'expense', normal_balance: 'debit', is_header: true, sort_order: 500 },
    { code: '6010', name: 'Crew Salaries & Wages', account_type: 'expense', normal_balance: 'debit', parent_code: '6000', sort_order: 501 },
    { code: '6020', name: 'Store Rent', account_type: 'expense', normal_balance: 'debit', parent_code: '6000', sort_order: 502 },
    { code: '6030', name: 'LPG Cooking Gas', account_type: 'expense', normal_balance: 'debit', parent_code: '6000', sort_order: 503 },
    { code: '6040', name: 'Electricity', account_type: 'expense', normal_balance: 'debit', parent_code: '6000', sort_order: 504 },
    { code: '6050', name: 'Tap Water', account_type: 'expense', normal_balance: 'debit', parent_code: '6000', sort_order: 505 },
    { code: '6060', name: 'Packaging & Paper Bags', account_type: 'expense', normal_balance: 'debit', parent_code: '6000', sort_order: 506 },
    { code: '6070', name: 'Local Taxes & BIR', account_type: 'expense', normal_balance: 'debit', parent_code: '6000', sort_order: 507 },
    { code: '6080', name: 'Team Leader Allowance', account_type: 'expense', normal_balance: 'debit', parent_code: '6000', sort_order: 508 },
    { code: '6090', name: 'Repair & Maintenance', account_type: 'expense', normal_balance: 'debit', parent_code: '6000', sort_order: 509 },
];

async function seedRemote() {
    console.log('--- Crispy King Remote Supabase Seed ---');
    console.log(`Endpoint: ${supabaseUrl}`);

    // 1. Seed Areas
    console.log('\n1. Seeding 4 Areas...');
    const areaRows = SUPERVISORS.map(s => ({
        id: s.uuid,
        name: s.name,
        code: s.code,
        is_active: true,
    }));
    const { error: areaErr } = await supabase.from('app_areas').upsert(areaRows, { onConflict: 'id' });
    if (areaErr) throw new Error(`Failed to upsert areas: ${areaErr.message}`);
    console.log(`✓ 4 Areas upserted successfully.`);

    // 2. Seed Branches (Business Units)
    console.log('\n2. Seeding 39 Branches (Business Units)...');
    const areaMap = new Map(SUPERVISORS.map(s => [s.code, s.uuid]));
    const buRows = BRANCHES.map(b => ({
        id: deterministicUuid(`bu-${b.slug}`),
        name: b.name,
        slug: b.slug,
        module_id: 'crispy-king',
        is_active: true,
        description: b.description,
        area_id: areaMap.get(b.supervisorCode) || null,
        area_name: b.supervisorCode,
    }));
    const { error: buErr } = await supabase.from('business_units').upsert(buRows, { onConflict: 'id' });
    if (buErr) throw new Error(`Failed to upsert business units: ${buErr.message}`);
    console.log(`✓ 39 Branches upserted successfully.`);

    // 3. Seed Main Commissary Store
    console.log('\n3. Seeding Main Commissary Store...');
    const commissaryStoreId = '00000000-0000-4000-8000-0000000000c1';
    const { error: storeErr } = await supabase.from('marketplace_stores').upsert({
        id: commissaryStoreId,
        name: 'Crispy King Central Commissary',
        slug: 'ck-main-commissary',
        status: 'active',
        description: 'Main commissary and distribution hub for 39 branches',
    }, { onConflict: 'id' });
    if (storeErr) throw new Error(`Failed to upsert commissary store: ${storeErr.message}`);
    console.log(`✓ Central Commissary Store active.`);

    // 4. Seed Master Products
    console.log('\n4. Seeding 12 Master Products...');
    const productRows = PRODUCTS.map(p => ({
        id: deterministicUuid(`prod-${p.sku}`),
        store_id: commissaryStoreId,
        title: p.title,
        sku: p.sku,
        price: p.price,
        product_type: p.product_type,
        stock_quantity: p.stock_quantity,
        status: 'active',
        description: p.description,
    }));
    const { error: prodErr } = await supabase.from('marketplace_products').upsert(productRows, { onConflict: 'id' });
    if (prodErr) throw new Error(`Failed to upsert products: ${prodErr.message}`);
    console.log(`✓ 12 Menu and wholesale products upserted successfully.`);

    // 5. Seed Suppliers
    console.log('\n5. Seeding 3 Primary Suppliers...');
    const supplierRows = SUPPLIERS.map(s => ({
        id: deterministicUuid(`sup-${s.name}`),
        name: s.name,
        contact_person: s.contact_person,
        phone: s.phone,
        tin: s.tin,
        payment_terms_days: s.payment_terms_days,
        address: s.address,
        is_active: true,
    }));
    const { error: supErr } = await supabase.from('suppliers').upsert(supplierRows, { onConflict: 'id' });
    if (supErr) throw new Error(`Failed to upsert suppliers: ${supErr.message}`);
    console.log(`✓ 3 Suppliers upserted successfully.`);

    // 6. Seed Chart of Accounts
    console.log('\n6. Seeding Standard QSR Chart of Accounts...');
    const coaRows = COA.map(a => ({
        id: deterministicUuid(`coa-${a.code}`),
        code: a.code,
        name: a.name,
        account_type: a.account_type,
        normal_balance: a.normal_balance,
        parent_code: a.parent_code || null,
        is_header: a.is_header || false,
        is_active: true,
        description: a.description || null,
        sort_order: a.sort_order || null,
    }));
    const { error: coaErr } = await supabase.from('chart_of_accounts').upsert(coaRows, { onConflict: 'id' });
    if (coaErr) throw new Error(`Failed to upsert COA: ${coaErr.message}`);
    console.log(`✓ ${COA.length} Standard QSR COA accounts upserted successfully.`);

    console.log('\n=== Remote Supabase Seed Completed Successfully ===\n');
}

seedRemote().catch(err => {
    console.error('\nSeed failed with error:', err);
    process.exit(1);
});
