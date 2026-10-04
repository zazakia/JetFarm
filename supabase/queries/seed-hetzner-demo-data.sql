-- ============================================================================
-- JetFarm — Hetzner Supabase Production Mock & Demo Data Seed
-- Multi-domain: Agribusiness Operations, Balanced General Ledger (PAS 41),
-- Regional Branches & Warehouses, Supply Chain Inventory & Stock Movements,
-- Sales Return Workflow (3-Step Draft->Approve->Complete), POS Sessions & Staff
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Agribusiness Chart of Accounts (COA) — CDA & PAS 41 Standards
-- ============================================================================
INSERT INTO public.chart_of_accounts (id, code, name, account_type, normal_balance, is_header, is_active, description, sort_order, created_at, updated_at)
VALUES
    ('c0a00000-0000-4000-8000-000000001240', '1240', 'Biological Assets — Growing Cassava Crops', 'asset', 'debit', false, true, 'PAS 41 fair value of standing unharvested cassava crops', 1240, now(), now()),
    ('c0a00000-0000-4000-8000-000000001245', '1245', 'Agricultural Produce Inventory — Harvested Cassava', 'asset', 'debit', false, true, 'Harvested roots weighed and stored in transit sorting bays', 1245, now(), now()),
    ('c0a00000-0000-4000-8000-000000001246', '1246', 'Agricultural Supplies & Farm Inputs', 'asset', 'debit', false, true, 'Stored fertilizers, herbicides, stems and farm equipment', 1246, now(), now()),
    ('c0a00000-0000-4000-8000-000000002020', '2020', 'SSS Contributions Payable', 'liability', 'credit', false, true, 'Employee and employer SSS statutory contributions', 2020, now(), now()),
    ('c0a00000-0000-4000-8000-000000002021', '2021', 'PhilHealth Contributions Payable', 'liability', 'credit', false, true, 'Employee and employer PhilHealth statutory contributions', 2021, now(), now()),
    ('c0a00000-0000-4000-8000-000000002022', '2022', 'Pag-IBIG Contributions Payable', 'liability', 'credit', false, true, 'Employee and employer Pag-IBIG statutory contributions', 2022, now(), now()),
    ('c0a00000-0000-4000-8000-000000002030', '2030', 'Withholding Tax Payable', 'liability', 'credit', false, true, 'BIR expanded & compensation withholding tax', 2030, now(), now()),
    ('c0a00000-0000-4000-8000-000000002035', '2035', 'Land Owner Settlement Payable', 'liability', 'credit', false, true, 'Accrued weekly guaranteed/tonnage settlement payouts to land owners', 2035, now(), now()),
    ('c0a00000-0000-4000-8000-000000002036', '2036', 'Farm Labor & Harvesters Payable', 'liability', 'credit', false, true, 'Accrued field wages and pakyaw harvesters earnings', 2036, now(), now()),
    ('c0a00000-0000-4000-8000-000000003015', '3015', 'Agribusiness Project Equity / BioGreen Fund', 'equity', 'credit', false, true, 'Investor venture capital and institutional project allocations', 3015, now(), now()),
    ('c0a00000-0000-4000-8000-000000004140', '4140', 'Commercial Cassava Offtake Revenue', 'income', 'credit', false, true, 'Offtake contract revenue from starch mills and feed processors', 4140, now(), now()),
    ('c0a00000-0000-4000-8000-000000004145', '4145', 'Industrial Starch & By-Product Sales', 'income', 'credit', false, true, 'Processed cassava starch, dried chips and organic foliage sales', 4145, now(), now()),
    ('c0a00000-0000-4000-8000-000000005160', '5160', 'Land Lease & Land Owner Production Share', 'expense', 'debit', false, true, 'Tonnage and guaranteed weekly lease settlements paid to landowners', 5160, now(), now()),
    ('c0a00000-0000-4000-8000-000000005161', '5161', 'Farm Labor, Land Prep & Weeding Wages', 'expense', 'debit', false, true, 'Direct farm labor, planting crews and manual harvest labor', 5161, now(), now()),
    ('c0a00000-0000-4000-8000-000000005162', '5162', 'Seeds, Seedlings & Cuttings Cost', 'expense', 'debit', false, true, 'Certified seed stems (Rayong 72, KU50, Lakan)', 5162, now(), now()),
    ('c0a00000-0000-4000-8000-000000005163', '5163', 'Fertilizer, Lime & Soil Nutrients', 'expense', 'debit', false, true, 'Complete 14-14-14, Urea 46-0-0 and agricultural dolomite lime', 5163, now(), now()),
    ('c0a00000-0000-4000-8000-000000005164', '5164', 'Crop Protection & Agrochemicals', 'expense', 'debit', false, true, 'Pre-emergence and post-emergence weed control and bio-fungicides', 5164, now(), now()),
    ('c0a00000-0000-4000-8000-000000005165', '5165', 'Tractor, Fuel & Farm Machinery Services', 'expense', 'debit', false, true, 'Diesel, tractor rotavators, disc plows and maintenance', 5165, now(), now()),
    ('c0a00000-0000-4000-8000-000000005166', '5166', 'Irrigation & Water Management', 'expense', 'debit', false, true, 'Furrow irrigation canal upkeep and water pump rentals', 5166, now(), now()),
    ('c0a00000-0000-4000-8000-000000005167', '5167', 'Post-Harvest Processing & Packaging', 'expense', 'debit', false, true, 'Mechanical washing, root cutting, sorting and chipping costs', 5167, now(), now()),
    ('c0a00000-0000-4000-8000-000000005168', '5168', 'Agricultural Hauling & Freight Services', 'expense', 'debit', false, true, 'Flatbed truck hauling from farmgate to buyer starch mills', 5168, now(), now()),
    ('c0a00000-0000-4000-8000-000000005169', '5169', 'Other Agribusiness Direct Farm Costs', 'expense', 'debit', false, true, 'Field supplies, sacks, weigh scale calibration, permits', 5169, now(), now()),
    ('c0a00000-0000-4000-8000-000000006012', '6012', 'SSS Employer Share', 'expense', 'debit', false, true, 'Employer statutory share for Social Security System', 6012, now(), now()),
    ('c0a00000-0000-4000-8000-000000006013', '6013', 'PhilHealth Employer Share', 'expense', 'debit', false, true, 'Employer statutory share for Philippine Health Insurance', 6013, now(), now()),
    ('c0a00000-0000-4000-8000-000000006014', '6014', 'Pag-IBIG Employer Share', 'expense', 'debit', false, true, 'Employer statutory share for Home Development Mutual Fund', 6014, now(), now())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    account_type = EXCLUDED.account_type,
    normal_balance = EXCLUDED.normal_balance,
    description = EXCLUDED.description,
    is_active = true,
    updated_at = now();

-- ============================================================================
-- 2. Regional Agricultural Branches
-- ============================================================================
INSERT INTO public.branches (id, name, code, is_hq, is_active, created_at, updated_at)
VALUES
    ('c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', 'Northern Mindanao Agri Hub (Bukidnon)', 'AGRI-BUK-01', false, true, now(), now()),
    ('c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1002', 'Isabela Crop Operations Center', 'AGRI-ISA-02', false, true, now(), now()),
    ('c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1003', 'Central Luzon Logistics & Starch Hub', 'AGRI-TAR-03', false, true, now(), now())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    is_active = true,
    updated_at = now();

-- ============================================================================
-- 3. Regional Warehouses & Storage Facilities
-- ============================================================================
INSERT INTO public.warehouses (id, branch_id, name, type, is_active, created_at, updated_at)
VALUES
    ('d52b3e89-69c2-4e2b-9f3c-8c1b4d0e2001', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', 'Bukidnon Central Seedling & Input Depot', 'store', true, now(), now()),
    ('d52b3e89-69c2-4e2b-9f3c-8c1b4d0e2002', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', 'Manolo Fortich Field Harvest Sorting Bay', 'transit', true, now(), now()),
    ('d52b3e89-69c2-4e2b-9f3c-8c1b4d0e2003', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1002', 'Isabela Staging & Weighing Hub', 'transit', true, now(), now()),
    ('d52b3e89-69c2-4e2b-9f3c-8c1b4d0e2004', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1003', 'Tarlac Agro-Industrial Silo', 'store', true, now(), now())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    is_active = true,
    updated_at = now();

-- ============================================================================
-- 4. Agricultural Suppliers
-- ============================================================================
INSERT INTO public.suppliers (id, name, contact_person, phone, email, address, created_at, updated_at)
VALUES
    ('e63c4f99-70d3-4f3c-a04d-9d2c5e1f3001', 'Planters Products Inc.', 'Eduardo Tan (National Sales)', '+63 917 800 1100', 'etan@plantersproducts.ph', 'Planters Products Bldg, Esteban St, Legaspi Village, Makati City', now(), now()),
    ('e63c4f99-70d3-4f3c-a04d-9d2c5e1f3002', 'Yara Fertilizers Philippines', 'Marivic Soriano (Agri Lead)', '+63 918 800 2200', 'marivic.soriano@yara.com', 'Unit 14B High Street Corporate Plaza, BGC, Taguig City', now(), now()),
    ('e63c4f99-70d3-4f3c-a04d-9d2c5e1f3003', 'East-West Seed Commercial Division', 'Dr. Roberto Guinto', '+63 920 800 3300', 'rguinto@eastwestseed.com', 'Km 54 Cagayan Valley Road, Sampaloc, San Rafael, Bulacan', now(), now()),
    ('e63c4f99-70d3-4f3c-a04d-9d2c5e1f3004', 'Petron Bulk Agro-Fuels & Logistics', 'Ramon Del Rosario', '+63 922 800 4400', 'bulk.agro@petron.com', 'Petron Terminal Complex, Macabalan, Cagayan de Oro City', now(), now())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    contact_person = EXCLUDED.contact_person,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    address = EXCLUDED.address,
    updated_at = now();

-- ============================================================================
-- 5. Agri Marketplace Store & Agricultural Products
-- ============================================================================
INSERT INTO public.marketplace_stores (id, name, slug, description, category, status, holiday_mode, rating, commission_tier, created_at, updated_at)
VALUES
    ('f74d5a09-81e4-4a4d-b15e-ae3d6f2a4001', 'JetFarm Agri-Hub & Farm Gate Market', 'jetfarm-agri-hub', 'Official supply depot for cassava seed stems, biological fertilizers, and farm inputs', 'Agribusiness', 'active', false, 4.95, 'standard', now(), now())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    status = 'active',
    updated_at = now();

INSERT INTO public.marketplace_products (id, store_id, title, description, product_type, price, compare_at_price, stock_quantity, sku, status, created_at, updated_at)
VALUES
    ('a11b2c3d-0001-4000-8000-000000000001', 'f74d5a09-81e4-4a4d-b15e-ae3d6f2a4001', 'Certified Rayong 72 Seed Stems (100 pcs/bundle)', 'High-yield starch variety cassava stalks, disease-free certified cuttings', 'seed_stem', 350.00, 400.00, 1500, 'AGRI-STEM-R72', 'active', now(), now()),
    ('a11b2c3d-0002-4000-8000-000000000002', 'f74d5a09-81e4-4a4d-b15e-ae3d6f2a4001', 'KU 50 Cassava Seed Stems (100 pcs/bundle)', 'Drought-tolerant industrial feed variety cuttings for heavy clay soils', 'seed_stem', 380.00, 420.00, 1200, 'AGRI-STEM-KU50', 'active', now(), now()),
    ('a11b2c3d-0003-4000-8000-000000000003', 'f74d5a09-81e4-4a4d-b15e-ae3d6f2a4001', 'Complete Fertilizer 14-14-14 (50kg sack)', 'Balanced basal macro-nutrient fertilizer for root thickening and starch bulking', 'fertilizer', 1950.00, 2100.00, 450, 'AGRI-FERT-1414', 'active', now(), now()),
    ('a11b2c3d-0004-4000-8000-000000000004', 'f74d5a09-81e4-4a4d-b15e-ae3d6f2a4001', 'Urea Fertilizer 46-0-0 (50kg sack)', 'High nitrogen top-dress fertilizer for rapid vegetative canopy formation', 'fertilizer', 2100.00, 2250.00, 380, 'AGRI-FERT-UREA', 'active', now(), now()),
    ('a11b2c3d-0005-4000-8000-000000000005', 'f74d5a09-81e4-4a4d-b15e-ae3d6f2a4001', 'Agricultural Dolomite Lime (50kg sack)', 'Soil conditioner for acid neutralization and magnesium supplementation', 'fertilizer', 420.00, 480.00, 600, 'AGRI-LIME-DOLO', 'active', now(), now()),
    ('a11b2c3d-0006-4000-8000-000000000006', 'f74d5a09-81e4-4a4d-b15e-ae3d6f2a4001', 'Fresh Cassava Roots — Grade A Commercial (1 MT)', 'Bulk fresh cassava tubers >5cm diameter with 28%+ starch density', 'produce', 4500.00, 4800.00, 85, 'AGRI-ROOT-GRA', 'active', now(), now()),
    ('a11b2c3d-0007-4000-8000-000000000007', 'f74d5a09-81e4-4a4d-b15e-ae3d6f2a4001', 'Dried Cassava Feed Chips (50kg sack)', 'Sun-dried cassava chips with moisture <14% for animal feed milling', 'produce', 550.00, 600.00, 500, 'AGRI-CHIP-IND', 'active', now(), now())
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    stock_quantity = EXCLUDED.stock_quantity,
    status = 'active',
    updated_at = now();

-- ============================================================================
-- 6. Key Employees & Farm Officers
-- ============================================================================
INSERT INTO public.employees (id, employee_code, first_name, last_name, middle_name, position, branch_id, daily_rate, hire_date, sss_number, philhealth_number, pagibig_number, tin, phone, is_active, created_at, updated_at)
VALUES
    ('b11e22f3-0001-4000-8000-000000000001', 'EMP-AGRI-001', 'Armando', 'Mercado', 'Reyes', 'Lead Agronomist & Field Specialist', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', 1200.00, '2025-01-15', '04-1234567-1', '12-000123456-7', '1234-5678-9012', '201-345-678-000', '+63 917 333 1111', true, now(), now()),
    ('b11e22f3-0002-4000-8000-000000000002', 'EMP-AGRI-002', 'Joel', 'Villanueva', 'Castro', 'Farm Operations & Tractor Fleet Lead', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', 950.00, '2025-02-01', '04-1234567-2', '12-000123456-8', '1234-5678-9013', '201-345-678-001', '+63 918 333 2222', true, now(), now()),
    ('b11e22f3-0003-4000-8000-000000000003', 'EMP-AGRI-003', 'Marites', 'Bautista', 'Flores', 'Agri Warehouse Custodian', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', 750.00, '2025-03-01', '04-1234567-3', '12-000123456-9', '1234-5678-9014', '201-345-678-002', '+63 919 333 3333', true, now(), now()),
    ('b11e22f3-0004-4000-8000-000000000004', 'EMP-AGRI-004', 'Reynaldo', 'Dizon', 'Soriano', 'Field Weighbridge & QC Inspector', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', 700.00, '2025-03-15', '04-1234567-4', '12-000123456-0', '1234-5678-9015', '201-345-678-003', '+63 920 333 4444', true, now(), now()),
    ('b11e22f3-0005-4000-8000-000000000005', 'EMP-AGRI-005', 'Catherine', 'Soriano', 'Tan', 'Agri Financial Accountant', '57b9511f-df41-4c41-9753-6f584c09cf89', 1100.00, '2025-01-10', '04-1234567-5', '12-000123456-1', '1234-5678-9016', '201-345-678-004', '+63 921 333 5555', true, now(), now())
ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    position = EXCLUDED.position,
    daily_rate = EXCLUDED.daily_rate,
    is_active = true,
    updated_at = now();

-- ============================================================================
-- 7. User Branch Roles
-- ============================================================================
INSERT INTO public.user_branch_roles (id, user_id, branch_id, role, created_at, updated_at)
VALUES
    ('c11d22e3-0001-4000-8000-000000000001', '00000000-0000-0000-0000-000000000002', '57b9511f-df41-4c41-9753-6f584c09cf89', 'admin', now(), now()),
    ('c11d22e3-0002-4000-8000-000000000002', '00000000-0000-0000-0000-000000000002', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', 'manager', now(), now()),
    ('c11d22e3-0003-4000-8000-000000000003', '00000000-0000-0000-0000-000000000001', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', 'supervisor', now(), now())
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    updated_at = now();

-- ============================================================================
-- 8. Warehouse Stock Movements (Supply Chain Inventory Records)
-- ============================================================================
INSERT INTO public.stock_movements (
    id, product_id, product_source, module_id, movement_type, 
    quantity_in, quantity_out, quantity_balance, unit_cost, total_cost, 
    reference_number, source_table, movement_date, notes, performed_by, 
    warehouse_id, branch_id, created_at, updated_at
)
VALUES
    -- Inbound purchase: 200 bags 14-14-14 into Bukidnon Input Depot
    ('f22a33b4-0001-4000-8000-000000000001', 'a11b2c3d-0003-4000-8000-000000000003', 'marketplace_products', 'agribusiness', 'in', 
     200, 0, 200, 1950.00, 390000.00, 'PO-PLANTERS-2026-001', 'procurement_orders', now() - interval '60 days', 'Initial basal fertilizer delivery from Planters Products', 'EMP-AGRI-003', 
     'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2001', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', now(), now()),

    -- Inbound purchase: 150 bags Urea into Bukidnon Input Depot
    ('f22a33b4-0002-4000-8000-000000000002', 'a11b2c3d-0004-4000-8000-000000000004', 'marketplace_products', 'agribusiness', 'in', 
     150, 0, 150, 2100.00, 315000.00, 'PO-YARA-2026-002', 'procurement_orders', now() - interval '55 days', 'Bulk urea procurement for mid-cycle top-dress', 'EMP-AGRI-003', 
     'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2001', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', now(), now()),

    -- Outbound field dispatch: 140 bags 14-14-14 to Parcel Alpha (Hacienda Viterbo North)
    ('f22a33b4-0003-4000-8000-000000000003', 'a11b2c3d-0003-4000-8000-000000000003', 'marketplace_products', 'agribusiness', 'out', 
     0, 140, 60, 1950.00, 273000.00, 'DISPATCH-ALPHA-01', 'agri_farm_expenses', now() - interval '45 days', 'Basal application dispatch to Parcel Alpha (35 ha)', 'EMP-AGRI-002', 
     'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2001', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', now(), now()),

    -- Inbound harvest intake: Batch 2026-09A (17,340 kg fresh cassava roots) into Sorting Bay
    ('f22a33b4-0004-4000-8000-000000000004', 'a11b2c3d-0006-4000-8000-000000000006', 'marketplace_products', 'agribusiness', 'in', 
     17.34, 0, 17.34, 4500.00, 78030.00, 'BATCH-2026-09A', 'agri_harvest_logs', now() - interval '14 days', 'Weighed-in fresh roots from Parcel Alpha via RAE-4581', 'EMP-AGRI-004', 
     'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2002', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', now(), now()),

    -- Inbound harvest intake: Batch 2026-09B (19,750 kg fresh cassava roots) into Sorting Bay
    ('f22a33b4-0005-4000-8000-000000000005', 'a11b2c3d-0006-4000-8000-000000000006', 'marketplace_products', 'agribusiness', 'in', 
     19.75, 0, 37.09, 4500.00, 88875.00, 'BATCH-2026-09B', 'agri_harvest_logs', now() - interval '13 days', 'Weighed-in fresh roots from Parcel Alpha via NBD-9023', 'EMP-AGRI-004', 
     'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2002', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', now(), now()),

    -- Outbound dispatch: Direct mill delivery of Batch 09A & 09B to BioGreen Starch Mill
    ('f22a33b4-0006-4000-8000-000000000006', 'a11b2c3d-0006-4000-8000-000000000006', 'marketplace_products', 'agribusiness', 'out', 
     0, 37.09, 0, 4500.00, 166905.00, 'DISPATCH-BIOGREEN-01', 'agri_investor_ledgers', now() - interval '12 days', 'Dispatched 37.09 MT fresh tubers to BioGreen mill', 'EMP-AGRI-004', 
     'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2002', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', now(), now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 9. Sales Returns Workflow (Step 1 Draft -> Step 2 Approve -> Step 3 Complete)
-- Enforces: Restock good items, quarantine/dispose damaged items, base UOM conversion
-- ============================================================================
-- Return 1: COMPLETED — Customer returned 2 unopened fertilizer sacks; restocked to shelf
INSERT INTO public.sales_returns (
    id, return_number, customer_name, branch_id, warehouse_id, status, reason, 
    total_refund_amount, refund_method, created_by, approved_by, approved_at, completed_at, 
    notes, created_at, updated_at
)
VALUES (
    'e77a11b2-0001-4000-8000-000000000001', 'SR-2026-001', 'Don Emilio Viterbo (Cassava Farm Partner)', 
    'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', 'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2001', 'completed', 
    'Over-estimated parcel fertilization requirements; 2 sacks unopened', 3900.00, 'cash', 
    'EMP-AGRI-003', 'Cybergada Master', now() - interval '5 days', now() - interval '5 days', 
    'Inspected by QC inspector. Sacks intact with manufacturer seal. Restocked to shelf.', now(), now()
)
ON CONFLICT (id) DO UPDATE SET status = 'completed', updated_at = now();

INSERT INTO public.sales_return_lines (
    id, sales_return_id, product_id, product_name, sku, return_quantity, 
    uom, uom_multiplier, base_quantity, unit_price, total_amount, 
    condition, restock_action, created_at, updated_at
)
VALUES (
    'e88a22b3-0001-4000-8000-000000000001', 'e77a11b2-0001-4000-8000-000000000001', 
    'a11b2c3d-0003-4000-8000-000000000003', 'Complete Fertilizer 14-14-14 (50kg sack)', 'AGRI-FERT-1414', 
    2, 'sack', 1, 2, 1950.00, 3900.00, 
    'good', 'restocked', now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- Restock stock movement for Return 1 (Stock goes up on warehouse shelf)
INSERT INTO public.stock_movements (
    id, product_id, product_source, module_id, movement_type, 
    quantity_in, quantity_out, quantity_balance, unit_cost, total_cost, 
    reference_number, source_table, source_id, movement_date, notes, 
    performed_by, warehouse_id, branch_id, created_at, updated_at
)
VALUES (
    'f22a33b4-0007-4000-8000-000000000007', 'a11b2c3d-0003-4000-8000-000000000003', 'marketplace_products', 
    'agribusiness', 'in', 2, 0, 62, 1950.00, 3900.00, 
    'SR-2026-001', 'sales_returns', 'e77a11b2-0001-4000-8000-000000000001', now() - interval '5 days', 
    'Restocked 2 sacks Complete 14-14-14 from customer return SR-2026-001', 'EMP-AGRI-003', 
    'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2001', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- Return 2: COMPLETED — Customer returned damaged stems; NOT restocked into sellable inventory
INSERT INTO public.sales_returns (
    id, return_number, customer_name, branch_id, warehouse_id, status, reason, 
    total_refund_amount, refund_method, created_by, approved_by, approved_at, completed_at, 
    notes, created_at, updated_at
)
VALUES (
    'e77a11b2-0002-4000-8000-000000000002', 'SR-2026-002', 'Engr. Maria Santos-Aquino (Riverside Partner)', 
    'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1002', 'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2003', 'completed', 
    '2 bundles of stems crushed during flatbed truck transit; nodes desiccated', 700.00, 'credit_note', 
    'EMP-AGRI-004', 'Cybergada Master', now() - interval '3 days', now() - interval '3 days', 
    'QC inspection confirmed stems desiccated and cracked. Sent to compost pit (disposed). NOT restocked.', now(), now()
)
ON CONFLICT (id) DO UPDATE SET status = 'completed', updated_at = now();

INSERT INTO public.sales_return_lines (
    id, sales_return_id, product_id, product_name, sku, return_quantity, 
    uom, uom_multiplier, base_quantity, unit_price, total_amount, 
    condition, restock_action, created_at, updated_at
)
VALUES (
    'e88a22b3-0002-4000-8000-000000000002', 'e77a11b2-0002-4000-8000-000000000002', 
    'a11b2c3d-0001-4000-8000-000000000001', 'Certified Rayong 72 Seed Stems (100 pcs/bundle)', 'AGRI-STEM-R72', 
    2, 'bundle', 100, 200, 350.00, 700.00, 
    'damaged', 'disposed', now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- Return 3: APPROVED — Supervisor approved, awaiting warehouse counter receipt
INSERT INTO public.sales_returns (
    id, return_number, customer_name, branch_id, warehouse_id, status, reason, 
    total_refund_amount, refund_method, created_by, approved_by, approved_at, completed_at, 
    notes, created_at, updated_at
)
VALUES (
    'e77a11b2-0003-4000-8000-000000000003', 'SR-2026-003', 'Roberto Dela Cruz Sr. (Central Luzon Co-op)', 
    'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1003', 'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2004', 'approved', 
    'Excess 3 bundles KU 50 stems from Capas parcel delivery', 1140.00, 'credit_note', 
    'EMP-AGRI-001', 'Cybergada Master', now() - interval '1 day', NULL, 
    'Approved by supervisor. Awaiting physical turnover and batch validation.', now(), now()
)
ON CONFLICT (id) DO UPDATE SET status = 'approved', updated_at = now();

INSERT INTO public.sales_return_lines (
    id, sales_return_id, product_id, product_name, sku, return_quantity, 
    uom, uom_multiplier, base_quantity, unit_price, total_amount, 
    condition, restock_action, created_at, updated_at
)
VALUES (
    'e88a22b3-0003-4000-8000-000000000003', 'e77a11b2-0003-4000-8000-000000000003', 
    'a11b2c3d-0002-4000-8000-000000000002', 'KU 50 Cassava Seed Stems (100 pcs/bundle)', 'AGRI-STEM-KU50', 
    3, 'bundle', 100, 300, 380.00, 1140.00, 
    'good', 'restocked', now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- Return 4: DRAFT — Customer submitted request, pending review
INSERT INTO public.sales_returns (
    id, return_number, customer_name, branch_id, warehouse_id, status, reason, 
    total_refund_amount, refund_method, created_by, approved_by, approved_at, completed_at, 
    notes, created_at, updated_at
)
VALUES (
    'e77a11b2-0004-4000-8000-000000000004', 'SR-2026-004', 'Carmen Tan-Sy (Davao Agri-Ventures)', 
    'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', 'd52b3e89-69c2-4e2b-9f3c-8c1b4d0e2001', 'draft', 
    'Ordered Dolomite lime instead of Complete 14-14-14', 840.00, 'cash', 
    'EMP-AGRI-003', NULL, NULL, NULL, 
    'Pending supervisor signature and original official receipt verification.', now(), now()
)
ON CONFLICT (id) DO UPDATE SET status = 'draft', updated_at = now();

INSERT INTO public.sales_return_lines (
    id, sales_return_id, product_id, product_name, sku, return_quantity, 
    uom, uom_multiplier, base_quantity, unit_price, total_amount, 
    condition, restock_action, created_at, updated_at
)
VALUES (
    'e88a22b3-0004-4000-8000-000000000004', 'e77a11b2-0004-4000-8000-000000000004', 
    'a11b2c3d-0005-4000-8000-000000000005', 'Agricultural Dolomite Lime (50kg sack)', 'AGRI-LIME-DOLO', 
    2, 'sack', 1, 2, 420.00, 840.00, 
    'good', 'restocked', now(), now()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 10. POS Sessions (Agri Farm Gate Depot Counter)
-- ============================================================================
INSERT INTO public.pos_sessions (
    id, branch_id, cashier_id, terminal_id, opened_at, closed_at, 
    opening_float, closing_cash_expected, closing_cash_actual, variance_amount, 
    status, notes, created_at, updated_at
)
VALUES
    ('d11b22c3-0001-4000-8000-000000000001', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', 'mock10-profile-04', 'POS-TERM-AGRI-01', 
     now() - interval '1 day', now() - interval '16 hours', 5000.00, 48500.00, 48500.00, 0.00, 
     'closed', 'Shift balanced with zero discrepancy. Gross retail sales: ₱43,500.', now(), now()),
    ('d11b22c3-0002-4000-8000-000000000002', 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', 'mock10-profile-04', 'POS-TERM-AGRI-01', 
     now() - interval '4 hours', NULL, 5000.00, NULL, NULL, NULL, 
     'open', 'Active morning farm-gate sales session', now(), now())
ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    updated_at = now();

-- ============================================================================
-- 11. Balanced Double-Entry General Ledger Entries (Strict PAS 41 Compliance)
-- In compliance with trg_enforce_balanced_journal trigger:
-- Step A: Insert journal_entries with is_posted = FALSE
-- Step B: Insert journal_entry_lines (debits == credits exactly)
-- Step C: UPDATE journal_entries SET is_posted = TRUE to trigger validation & stamp totals
-- ============================================================================

-- Step A: Insert Headers
INSERT INTO public.journal_entries (
    id, entry_date, reference_number, description, entry_type, journal_type, 
    source_table, posted_by, is_posted, total_debit, total_credit, 
    fiscal_year, fiscal_month, branch_id, created_at, updated_at
)
VALUES
    -- JE 1: BioGreen Initial Venture Capital Placement (₱1,400,000.00)
    ('00000001-0000-4000-8000-000000000001', '2026-01-10 09:00:00+08', 'JE-AGRI-2026-001', 
     'BioGreen Capital Placement for CYC-2026-001 (Hacienda Viterbo North)', 'auto', 'general', 
     'agri_investor_ledgers', 'Cybergada Master', false, 0, 0, 2026, 1, 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', now(), now()),

    -- JE 2: Deep Plowing & Heavy Tractor Land Prep for Parcel Alpha (₱175,000.00)
    ('00000001-0000-4000-8000-000000000002', '2026-01-12 14:00:00+08', 'JE-AGRI-2026-002', 
     'Tractor deep plowing & rotavator harrowing (35 ha) — Parcel Alpha', 'auto', 'cash_disbursement', 
     'agri_farm_expenses', 'Cybergada Master', false, 0, 0, 2026, 1, 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', now(), now()),

    -- JE 3: Certified Rayong 72 High-Density Seed Stems (₱105,000.00)
    ('00000001-0000-4000-8000-000000000003', '2026-01-14 11:30:00+08', 'JE-AGRI-2026-003', 
     'Certified Rayong 72 high-density stem cuttings for CYC-2026-001', 'auto', 'purchase', 
     'agri_farm_expenses', 'Cybergada Master', false, 0, 0, 2026, 1, 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', now(), now()),

    -- JE 4: Basal Fertilizer Application Complete 14-14-14 (₱210,000.00)
    ('00000001-0000-4000-8000-000000000004', '2026-02-15 10:00:00+08', 'JE-AGRI-2026-004', 
     'Complete 14-14-14 basal fertilizer application (140 bags)', 'auto', 'purchase', 
     'agri_farm_expenses', 'Cybergada Master', false, 0, 0, 2026, 2, 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', now(), now()),

    -- JE 5: Urea 46-0-0 Top-Dress Canopy Application (₱98,000.00)
    ('00000001-0000-4000-8000-000000000005', '2026-04-10 15:00:00+08', 'JE-AGRI-2026-005', 
     'Urea 46-0-0 top-dress application for vegetative canopy (70 bags)', 'auto', 'purchase', 
     'agri_farm_expenses', 'Cybergada Master', false, 0, 0, 2026, 4, 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', now(), now()),

    -- JE 6: Pakyaw Planting Crew Wages (₱42,000.00)
    ('00000001-0000-4000-8000-000000000006', '2026-01-18 17:00:00+08', 'JE-AGRI-2026-006', 
     'Planting stem insertion crew pakyaw contract (35 ha)', 'auto', 'cash_disbursement', 
     'agri_labor_logs', 'Cybergada Master', false, 0, 0, 2026, 1, 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', now(), now()),

    -- JE 7: Weeding & Mechanical Care Wages (₱42,000.00)
    ('00000001-0000-4000-8000-000000000007', '2026-05-20 16:30:00+08', 'JE-AGRI-2026-007', 
     'Mechanical inter-row cultivator weed suppression & labor', 'auto', 'cash_disbursement', 
     'agri_farm_expenses', 'Cybergada Master', false, 0, 0, 2026, 5, 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', now(), now()),

    -- JE 8: Land Owner Settlement Week 1 Payout to Don Emilio Viterbo (₱88,423.50)
    ('00000001-0000-4000-8000-000000000008', '2026-09-21 11:00:00+08', 'JE-AGRI-2026-008', 
     'Weekly Landowner Settlement Week 1 — Don Emilio Viterbo (76,890 kg @ ₱1.15/kg)', 'auto', 'cash_disbursement', 
     'agri_weekly_settlements', 'Cybergada Master', false, 0, 0, 2026, 9, 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', now(), now()),

    -- JE 9: Commercial Offtake Delivery to BioGreen Starch Mill (₱346,005.00)
    ('00000001-0000-4000-8000-000000000009', '2026-09-20 16:00:00+08', 'JE-AGRI-2026-009', 
     'Harvest Offtake Delivery Week 1 — 76,890 kg @ ₱4.50/kg to BioGreen Mill', 'auto', 'sales', 
     'agri_investor_ledgers', 'Cybergada Master', false, 0, 0, 2026, 9, 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', now(), now()),

    -- JE 10: San Miguel Agro-Feeds Offtake Contract Financing (₱800,000.00)
    ('00000001-0000-4000-8000-000000000010', '2026-02-25 10:00:00+08', 'JE-AGRI-2026-010', 
     'San Miguel Agro-Feeds Inflow for Isabela CYC-2026-002', 'auto', 'general', 
     'agri_investor_ledgers', 'Cybergada Master', false, 0, 0, 2026, 2, 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1002', now(), now()),

    -- JE 11: Biological Asset Fair Value Recognition (PAS 41) (₱350,000.00)
    ('00000001-0000-4000-8000-000000000011', '2026-06-30 18:00:00+08', 'JE-AGRI-2026-011', 
     'Mid-cycle biological asset valuation for Parcel Alpha & Beta standing crops', 'adjusting', 'general', 
     'agri_crop_cycles', 'Cybergada Master', false, 0, 0, 2026, 6, 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', now(), now()),

    -- JE 12: Stored Produce Inventory at Farm Gate Sorting Bay (₱150,000.00)
    ('00000001-0000-4000-8000-000000000012', '2026-09-22 17:00:00+08', 'JE-AGRI-2026-012', 
     'Harvest produce inventory transfer from biological assets to sorting bay', 'adjusting', 'inventory', 
     'agri_harvest_logs', 'Cybergada Master', false, 0, 0, 2026, 9, 'c41a2e79-58b1-4d1a-8e2b-7b0a3c9e1001', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Step B: Insert Lines for each Journal Entry (Debits = Credits)
INSERT INTO public.journal_entry_lines (
    id, journal_entry_id, account_code, account_name, 
    debit_amount, credit_amount, description, business_unit_id, 
    module_source_table, created_at, updated_at
)
VALUES
    -- JE 1 Lines (₱1,400,000.00)
    ('00000002-0000-4000-8000-000000000101', '00000001-0000-4000-8000-000000000001', '1010', 'Cash on Hand (COH)', 1400000.00, 0.00, 'BioGreen venture capital inflow', 'agribusiness', 'agri_investor_ledgers', now(), now()),
    ('00000002-0000-4000-8000-000000000102', '00000001-0000-4000-8000-000000000001', '3015', 'Agribusiness Project Equity / BioGreen Fund', 0.00, 1400000.00, 'BioGreen venture capital inflow', 'agribusiness', 'agri_investor_ledgers', now(), now()),

    -- JE 2 Lines (₱175,000.00)
    ('00000002-0000-4000-8000-000000000201', '00000001-0000-4000-8000-000000000002', '5165', 'Tractor, Fuel & Farm Machinery Services', 175000.00, 0.00, 'Tractor plowing & harrowing', 'agribusiness', 'agri_farm_expenses', now(), now()),
    ('00000002-0000-4000-8000-000000000202', '00000001-0000-4000-8000-000000000002', '1010', 'Cash on Hand (COH)', 0.00, 175000.00, 'Tractor plowing & harrowing', 'agribusiness', 'agri_farm_expenses', now(), now()),

    -- JE 3 Lines (₱105,000.00)
    ('00000002-0000-4000-8000-000000000301', '00000001-0000-4000-8000-000000000003', '5162', 'Seeds, Seedlings & Cuttings Cost', 105000.00, 0.00, 'Rayong 72 cuttings purchase', 'agribusiness', 'agri_farm_expenses', now(), now()),
    ('00000002-0000-4000-8000-000000000302', '00000001-0000-4000-8000-000000000003', '3015', 'Agribusiness Project Equity / BioGreen Fund', 0.00, 105000.00, 'Investor funded seed cuttings', 'agribusiness', 'agri_farm_expenses', now(), now()),

    -- JE 4 Lines (₱210,000.00)
    ('00000002-0000-4000-8000-000000000401', '00000001-0000-4000-8000-000000000004', '5163', 'Fertilizer, Lime & Soil Nutrients', 210000.00, 0.00, 'Complete 14-14-14 basal fertilizer', 'agribusiness', 'agri_farm_expenses', now(), now()),
    ('00000002-0000-4000-8000-000000000402', '00000001-0000-4000-8000-000000000004', '3015', 'Agribusiness Project Equity / BioGreen Fund', 0.00, 210000.00, 'Investor funded fertilizer', 'agribusiness', 'agri_farm_expenses', now(), now()),

    -- JE 5 Lines (₱98,000.00)
    ('00000002-0000-4000-8000-000000000501', '00000001-0000-4000-8000-000000000005', '5163', 'Fertilizer, Lime & Soil Nutrients', 98000.00, 0.00, 'Urea 46-0-0 top-dress fertilizer', 'agribusiness', 'agri_farm_expenses', now(), now()),
    ('00000002-0000-4000-8000-000000000502', '00000001-0000-4000-8000-000000000005', '3015', 'Agribusiness Project Equity / BioGreen Fund', 0.00, 98000.00, 'Investor funded urea', 'agribusiness', 'agri_farm_expenses', now(), now()),

    -- JE 6 Lines (₱42,000.00)
    ('00000002-0000-4000-8000-000000000601', '00000001-0000-4000-8000-000000000006', '5161', 'Farm Labor, Land Prep & Weeding Wages', 42000.00, 0.00, 'Planting stem insertion contract', 'agribusiness', 'agri_labor_logs', now(), now()),
    ('00000002-0000-4000-8000-000000000602', '00000001-0000-4000-8000-000000000006', '1010', 'Cash on Hand (COH)', 0.00, 42000.00, 'Planting stem insertion contract', 'agribusiness', 'agri_labor_logs', now(), now()),

    -- JE 7 Lines (₱42,000.00)
    ('00000002-0000-4000-8000-000000000701', '00000001-0000-4000-8000-000000000007', '5161', 'Farm Labor, Land Prep & Weeding Wages', 42000.00, 0.00, 'Weed suppression cultivator pass', 'agribusiness', 'agri_farm_expenses', now(), now()),
    ('00000002-0000-4000-8000-000000000702', '00000001-0000-4000-8000-000000000007', '1010', 'Cash on Hand (COH)', 0.00, 42000.00, 'Weed suppression cultivator pass', 'agribusiness', 'agri_farm_expenses', now(), now()),

    -- JE 8 Lines (₱88,423.50)
    ('00000002-0000-4000-8000-000000000801', '00000001-0000-4000-8000-000000000008', '5160', 'Land Lease & Land Owner Production Share', 88423.50, 0.00, 'Week 1 land owner settlement', 'agribusiness', 'agri_weekly_settlements', now(), now()),
    ('00000002-0000-4000-8000-000000000802', '00000001-0000-4000-8000-000000000008', '1010', 'Cash on Hand (COH)', 0.00, 88423.50, 'Week 1 land owner settlement', 'agribusiness', 'agri_weekly_settlements', now(), now()),

    -- JE 9 Lines (₱346,005.00)
    ('00000002-0000-4000-8000-000000000901', '00000001-0000-4000-8000-000000000009', '1010', 'Cash on Hand (COH)', 346005.00, 0.00, 'Week 1 offtake revenue received', 'agribusiness', 'agri_investor_ledgers', now(), now()),
    ('00000002-0000-4000-8000-000000000902', '00000001-0000-4000-8000-000000000009', '4140', 'Commercial Cassava Offtake Revenue', 0.00, 346005.00, 'Week 1 offtake revenue recognized', 'agribusiness', 'agri_investor_ledgers', now(), now()),

    -- JE 10 Lines (₱800,000.00)
    ('00000002-0000-4000-8000-000000001001', '00000001-0000-4000-8000-000000000010', '1010', 'Cash on Hand (COH)', 800000.00, 0.00, 'San Miguel project placement', 'agribusiness', 'agri_investor_ledgers', now(), now()),
    ('00000002-0000-4000-8000-000000001002', '00000001-0000-4000-8000-000000000010', '3015', 'Agribusiness Project Equity / BioGreen Fund', 0.00, 800000.00, 'San Miguel project placement', 'agribusiness', 'agri_investor_ledgers', now(), now()),

    -- JE 11 Lines (₱350,000.00)
    ('00000002-0000-4000-8000-000000001101', '00000001-0000-4000-8000-000000000011', '1240', 'Biological Assets — Growing Cassava Crops', 350000.00, 0.00, 'Accrual of biological growth', 'agribusiness', 'agri_crop_cycles', now(), now()),
    ('00000002-0000-4000-8000-000000001102', '00000001-0000-4000-8000-000000000011', '4140', 'Commercial Cassava Offtake Revenue', 0.00, 350000.00, 'Unharvested agricultural gain', 'agribusiness', 'agri_crop_cycles', now(), now()),

    -- JE 12 Lines (₱150,000.00)
    ('00000002-0000-4000-8000-000000001201', '00000001-0000-4000-8000-000000000012', '1245', 'Agricultural Produce Inventory — Harvested Cassava', 150000.00, 0.00, 'Harvest produce transfer', 'agribusiness', 'agri_harvest_logs', now(), now()),
    ('00000002-0000-4000-8000-000000001202', '00000001-0000-4000-8000-000000000012', '1240', 'Biological Assets — Growing Cassava Crops', 0.00, 150000.00, 'Biological harvest transfer', 'agribusiness', 'agri_harvest_logs', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Step C: Post all Journal Entries (Trigger will validate debits == credits and stamp totals)
UPDATE public.journal_entries 
SET is_posted = true 
WHERE id IN (
    '00000001-0000-4000-8000-000000000001',
    '00000001-0000-4000-8000-000000000002',
    '00000001-0000-4000-8000-000000000003',
    '00000001-0000-4000-8000-000000000004',
    '00000001-0000-4000-8000-000000000005',
    '00000001-0000-4000-8000-000000000006',
    '00000001-0000-4000-8000-000000000007',
    '00000001-0000-4000-8000-000000000008',
    '00000001-0000-4000-8000-000000000009',
    '00000001-0000-4000-8000-000000000010',
    '00000001-0000-4000-8000-000000000011',
    '00000001-0000-4000-8000-000000000012'
);

COMMIT;

-- Reload PostgREST schema cache to immediately reflect all modifications
NOTIFY pgrst, 'reload schema';
