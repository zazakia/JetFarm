import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Deterministic UUID helper
function deterministicUuid(seedStr) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        hash = (Math.imul(31, hash) + seedStr.charCodeAt(i)) | 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `00000000-0000-4000-8000-${hex.repeat(2).slice(0, 12)}`;
}

const SUPERVISORS = [
    { code: 'AREA-BABYANN', name: 'Area Baby Ann', uuid: '00000000-0000-4000-8000-0000000000a1' },
    { code: 'AREA-CHRISTIAN', name: 'Area Christian', uuid: '00000000-0000-4000-8000-0000000000a2' },
    { code: 'AREA-RENOR', name: 'Area Renor', uuid: '00000000-0000-4000-8000-0000000000a3' },
    { code: 'AREA-JUMAR', name: 'Area Jumar', uuid: '00000000-0000-4000-8000-0000000000a4' },
];

const BRANCHES = [
    { slug: 'ck-tayasan', name: 'Crispy King - Tayasan', supervisorCode: 'AREA-BABYANN', description: 'Tayasan Franchise Branch' },
    { slug: 'ck-ayungon-1', name: 'Crispy King - Ayungon 1', supervisorCode: 'AREA-BABYANN', description: 'Ayungon Branch 1' },
    { slug: 'ck-ayungon-2', name: 'Crispy King - Ayungon 2', supervisorCode: 'AREA-BABYANN', description: 'Ayungon Branch 2' },
    { slug: 'ck-bindoy-1', name: 'Crispy King - Bindoy 1', supervisorCode: 'AREA-BABYANN', description: 'Bindoy Branch 1' },
    { slug: 'ck-bindoy-2', name: 'Crispy King - Bindoy 2', supervisorCode: 'AREA-BABYANN', description: 'Bindoy Branch 2' },
    { slug: 'ck-guihulngan', name: 'Crispy King - Guihulngan', supervisorCode: 'AREA-BABYANN', description: 'Guihulngan City Branch' },
    { slug: 'ck-jimalalud', name: 'Crispy King - Jimalalud', supervisorCode: 'AREA-BABYANN', description: 'Jimalalud Branch' },
    { slug: 'ck-manjuyod', name: 'Crispy King - Manjuyod', supervisorCode: 'AREA-BABYANN', description: 'Manjuyod Branch' },

    { slug: 'ck-bayawan', name: 'Crispy King - Bayawan', supervisorCode: 'AREA-CHRISTIAN', description: 'Bayawan City Branch' },
    { slug: 'ck-mabinay-1', name: 'Crispy King - Mabinay 1', supervisorCode: 'AREA-CHRISTIAN', description: 'Mabinay Branch 1' },
    { slug: 'ck-mabinay-2', name: 'Crispy King - Mabinay 2', supervisorCode: 'AREA-CHRISTIAN', description: 'Mabinay Branch 2' },
    { slug: 'ck-pamplona', name: 'Crispy King - Pamplona', supervisorCode: 'AREA-CHRISTIAN', description: 'Pamplona Branch' },
    { slug: 'ck-sta-agueda', name: 'Crispy King - Sta. Agueda', supervisorCode: 'AREA-CHRISTIAN', description: 'Sta. Agueda Branch' },
    { slug: 'ck-tanjay-1', name: 'Crispy King - Tanjay 1', supervisorCode: 'AREA-CHRISTIAN', description: 'Tanjay City Branch 1' },
    { slug: 'ck-tanjay-2', name: 'Crispy King - Tanjay 2', supervisorCode: 'AREA-CHRISTIAN', description: 'Tanjay City Branch 2' },

    { slug: 'ck-sagay-1', name: 'Crispy King - Sagay 1', supervisorCode: 'AREA-RENOR', description: 'Sagay Branch 1' },
    { slug: 'ck-san-carlos-2', name: 'Crispy King - San Carlos 2', supervisorCode: 'AREA-RENOR', description: 'San Carlos City Branch 2' },
    { slug: 'ck-sagay-2', name: 'Crispy King - Sagay 2', supervisorCode: 'AREA-RENOR', description: 'Sagay Branch 2' },
    { slug: 'ck-san-carlos-1', name: 'Crispy King - San Carlos 1', supervisorCode: 'AREA-RENOR', description: 'San Carlos City Branch 1' },
    { slug: 'ck-quezon', name: 'Crispy King - Quezon', supervisorCode: 'AREA-RENOR', description: 'Quezon Branch' },
    { slug: 'ck-san-carlos-5', name: 'Crispy King - San Carlos 5', supervisorCode: 'AREA-RENOR', description: 'San Carlos City Branch 5' },
    { slug: 'ck-san-carlos-7', name: 'Crispy King - San Carlos 7', supervisorCode: 'AREA-RENOR', description: 'San Carlos City Branch 7' },
    { slug: 'ck-canla-on', name: 'Crispy King - Canla-on', supervisorCode: 'AREA-RENOR', description: 'Canlaon City Branch' },

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
    { name: 'Magnolia Chicken', contact_person: 'Account Representative', phone: '0917-111-0001', tin: '102-345-678-000', payment_terms_days: 15, address: 'San Miguel Foods, Mandaue City, Cebu' },
    { name: 'Bounty Fresh', contact_person: 'Wholesale Delivery Team', phone: '0917-111-0002', tin: '203-456-789-000', payment_terms_days: 15, address: 'Bounty Fresh Food Inc., Bacolod City' },
    { name: 'Ali Agri (Live/Dressed Broilers)', contact_person: 'Broiler Dispatch', phone: '0917-111-0003', tin: '304-567-890-000', payment_terms_days: 7, address: 'Ali Agricultural Farm, Dumaguete City' },
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
    { code: '1000', name: 'ASSETS', account_type: 'asset', normal_balance: 'debit', is_header: true, sort_order: 1 },
    { code: '1010', name: 'Cash on Hand (COH)', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 2 },
    { code: '1020', name: 'Petty Cash Fund', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 3 },
    { code: '1100', name: 'Accounts Receivable', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 10 },
    { code: '1200', name: 'Merchandise Inventory', account_type: 'asset', normal_balance: 'debit', parent_code: '1000', sort_order: 15 },
    { code: '2000', name: 'LIABILITIES', account_type: 'liability', normal_balance: 'credit', is_header: true, sort_order: 100 },
    { code: '2010', name: 'Accounts Payable (Suppliers)', account_type: 'liability', normal_balance: 'credit', parent_code: '2000', sort_order: 101 },
    { code: '2050', name: 'Due to Franchisor (Royalty Payable)', account_type: 'liability', normal_balance: 'credit', parent_code: '2000', sort_order: 105 },
    { code: '3000', name: 'EQUITY', account_type: 'equity', normal_balance: 'credit', is_header: true, sort_order: 200 },
    { code: '3010', name: 'Partner Capital (Viterbo Foods OPC)', account_type: 'equity', normal_balance: 'credit', parent_code: '3000', sort_order: 201 },
    { code: '4000', name: 'REVENUE', account_type: 'income', normal_balance: 'credit', is_header: true, sort_order: 300 },
    { code: '4010', name: 'Fried Chicken Sales', account_type: 'income', normal_balance: 'credit', parent_code: '4000', sort_order: 301 },
    { code: '4020', name: 'Rice Sales', account_type: 'income', normal_balance: 'credit', parent_code: '4000', sort_order: 302 },
    { code: '4030', name: 'Beverage Sales', account_type: 'income', normal_balance: 'credit', parent_code: '4000', sort_order: 303 },
    { code: '4040', name: 'Specialty Sales', account_type: 'income', normal_balance: 'credit', parent_code: '4000', sort_order: 304 },
    { code: '4050', name: 'By-Product Sales (Fats/Skin)', account_type: 'income', normal_balance: 'credit', parent_code: '4000', sort_order: 305 },
    { code: '5000', name: 'COST OF GOODS SOLD', account_type: 'expense', normal_balance: 'debit', is_header: true, sort_order: 400 },
    { code: '5010', name: 'Dressed Chicken Used', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 401 },
    { code: '5020', name: 'Deep Frying Oil', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 402 },
    { code: '5030', name: 'Breading & Gravy Mix', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 403 },
    { code: '5040', name: 'Raw Rice', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 404 },
    { code: '5050', name: 'Beverage Inventory Used', account_type: 'expense', normal_balance: 'debit', parent_code: '5000', sort_order: 405 },
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

const sql = ['BEGIN;'];

// 1. Areas
for (const s of SUPERVISORS) {
    sql.push(`INSERT INTO public.app_areas (id, name, code, is_active) VALUES ('${s.uuid}', '${s.name}', '${s.code}', true) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code;`);
}

// 2. Business Units
const areaMap = new Map(SUPERVISORS.map(s => [s.code, s.uuid]));
for (const b of BRANCHES) {
    const buId = deterministicUuid(`bu-${b.slug}`);
    const areaId = areaMap.get(b.supervisorCode);
    sql.push(`INSERT INTO public.business_units (id, name, slug, module_id, is_active, description, area_id, area_name) VALUES ('${buId}', '${b.name}', '${b.slug}', 'crispy-king', true, '${b.description}', '${areaId}', '${b.supervisorCode}') ON CONFLICT (id) DO NOTHING;`);
}

// 3. Central Commissary Store
const commissaryStoreId = '00000000-0000-4000-8000-0000000000c1';
sql.push(`INSERT INTO public.marketplace_stores (id, name, slug, status, description) VALUES ('${commissaryStoreId}', 'Crispy King Central Commissary', 'ck-main-commissary', 'active', 'Main commissary and distribution hub for 39 branches') ON CONFLICT (id) DO NOTHING;`);

// 4. Products
for (const p of PRODUCTS) {
    const prodId = deterministicUuid(`prod-${p.sku}`);
    sql.push(`INSERT INTO public.marketplace_products (id, store_id, title, sku, price, product_type, stock_quantity, status, description) VALUES ('${prodId}', '${commissaryStoreId}', '${p.title}', '${p.sku}', ${p.price}, '${p.product_type}', ${p.stock_quantity}, 'active', '${p.description}') ON CONFLICT (id) DO NOTHING;`);
}

// 5. Suppliers
for (const s of SUPPLIERS) {
    const supId = deterministicUuid(`sup-${s.name}`);
    sql.push(`INSERT INTO public.suppliers (id, name, contact_person, phone, email, address) VALUES ('${supId}', '${s.name}', '${s.contact_person}', '${s.phone}', 'supplier@crispyking.ph', '${s.address}') ON CONFLICT (id) DO NOTHING;`);
}

// 6. Chart of Accounts
for (const a of COA) {
    const coaId = deterministicUuid(`coa-${a.code}`);
    const parentCode = a.parent_code ? `'${a.parent_code}'` : 'NULL';
    const isHeader = a.is_header ? 'true' : 'false';
    const sortOrder = a.sort_order ? a.sort_order : 'NULL';
    sql.push(`INSERT INTO public.chart_of_accounts (id, code, name, account_type, normal_balance, parent_code, is_header, is_active, sort_order) VALUES ('${coaId}', '${a.code}', '${a.name}', '${a.account_type}', '${a.normal_balance}', ${parentCode}, ${isHeader}, true, ${sortOrder}) ON CONFLICT (id) DO NOTHING;`);
}

sql.push('COMMIT;');

const outPath = path.join(process.cwd(), 'supabase', 'queries', 'seed-crispy-king-mock-data.sql');
fs.writeFileSync(outPath, sql.join('\n') + '\n', 'utf8');
console.log('Written supabase/queries/seed-crispy-king-mock-data.sql');
