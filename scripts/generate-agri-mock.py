import uuid, json

def gen_id(): return str(uuid.uuid4())

sql = ['-- Seed Agri-One Agribusiness Mock Data', 'BEGIN;']

# 1. Land Owners
owners = [
    (gen_id(), 'Don Emilio Viterbo', '+63 917 555 1001', 'Land Bank of the Philippines', '0121-4567-89', 1.15, 30000.0, 'Hacienda Viterbo Principal Landlord'),
    (gen_id(), 'Engr. Maria Santos-Aquino', '+63 918 555 2002', 'BDO Unibank', '1098-7654-32', 1.10, 25000.0, 'Riverside Valley Outgrower Partner'),
    (gen_id(), 'Roberto Dela Cruz Sr.', '+63 920 555 3003', 'Bank of the Philippine Islands', '4321-8765-09', 1.20, 28000.0, 'Central Luzon Cassava Cooperative Lead'),
    (gen_id(), 'Carmen Tan-Sy', '+63 922 555 4004', 'Metropolitan Bank & Trust Co', '2345-6789-01', 1.10, 25000.0, 'Davao Agri-Ventures Landowner'),
    (gen_id(), 'Cap. Rolando Navarro', '+63 927 555 5005', 'Development Bank of the Philippines', '5678-1234-90', 1.25, 35000.0, 'Matutum Highlands Agri Plantation'),
    (gen_id(), 'Anita Lim-Alvarez', '+63 939 555 6006', 'Security Bank', '7890-2345-67', 1.05, 25000.0, 'Batangas Agro-Industrial Estate')
]

sql.append('-- 1. Agri Land Owners')
for o in owners:
    sql.append(f"INSERT INTO public.agri_land_owners (id, name, contact_number, bank_name, account_number, default_per_kilo_rate, default_guaranteed_minimum, notes) VALUES ('{o[0]}', '{o[1]}', '{o[2]}', '{o[3]}', '{o[4]}', {o[5]}, {o[6]}, '{o[7]}') ON CONFLICT (id) DO NOTHING;")

# 2. Parcels
parcels = [
    (gen_id(), 'Parcel Alpha - Hacienda Viterbo North', 'HVN-01', owners[0][0], 35.0, 'Brgy. Tankulan, Manolo Fortich, Bukidnon', '8.3667, 124.8667', 'Volcanic Sandy Loam', 'active'),
    (gen_id(), 'Parcel Beta - Riverside Valley Flatlands', 'RVF-02', owners[1][0], 20.0, 'Brgy. San Jose, Roxas, Isabela', '17.1167, 121.6167', 'Alluvial Clay Loam', 'active'),
    (gen_id(), 'Parcel Gamma - Central Plains Agro', 'CPA-03', owners[2][0], 25.0, 'Brgy. Cristo Rey, Capas, Tarlac', '15.3333, 120.5833', 'Sandy Clay Loam', 'active'),
    (gen_id(), 'Parcel Delta - Mount Matutum Outgrower', 'MMO-04', owners[4][0], 40.0, 'Brgy. Cannery Site, Polomolok, South Cotabato', '6.2167, 125.0667', 'Rich Volcanic Ash Loam', 'harvesting'),
    (gen_id(), 'Parcel Epsilon - Davao Green Hills', 'DGH-05', owners[3][0], 18.5, 'Brgy. New Corella, Davao del Norte', '7.5833, 125.8167', 'Fertile Silt Loam', 'active'),
    (gen_id(), 'Parcel Zeta - Southern Ridge Farm', 'SRF-06', owners[0][0], 22.0, 'Brgy. Dalwangan, Malaybalay, Bukidnon', '8.1500, 125.1333', 'Mountain Clay Loam', 'active'),
    (gen_id(), 'Parcel Eta - Luzon Agro-Valley', 'LAV-07', owners[1][0], 15.0, 'Brgy. Malasin, San Mateo, Isabela', '16.8833, 121.5833', 'River Basin Alluvial', 'available'),
    (gen_id(), 'Parcel Theta - Batangas Highland Farm', 'BHF-08', owners[5][0], 12.0, 'Brgy. Kaylaway, Nasugbu, Batangas', '14.0667, 120.6333', 'Clay Loam', 'available')
]

sql.append('\n-- 2. Agri Parcels')
for p in parcels:
    sql.append(f"INSERT INTO public.agri_parcels (id, name, code, land_owner_id, area_hectares, location_address, gps_coordinates, soil_type, status) VALUES ('{p[0]}', '{p[1]}', '{p[2]}', '{p[3]}', {p[4]}, '{p[5]}', '{p[6]}', '{p[7]}', '{p[8]}') ON CONFLICT (id) DO NOTHING;")

# 3. Investors
investors = [
    (gen_id(), 'BioGreen Agri Ventures Corp.', 'Atty. Fernando Gomez', '+63 917 888 1111', 'fgomez@biogreen.ph', 4.50, 'Anchor BioGreen Investment Partner'),
    (gen_id(), 'San Miguel Agro-Feeds Inc.', 'Engr. Salvador Ramos', '+63 918 888 2222', 'salvador.ramos@smgfeeds.com', 4.80, 'Feed Mill Offtake Contract 2026'),
    (gen_id(), 'Universal Robina Bio-Starch Div.', 'Patricia Co', '+63 920 888 3333', 'patricia.co@urc.com.ph', 4.65, 'Industrial Starch Processing Offtaker'),
    (gen_id(), 'Bukidnon Pioneer Outgrowers Fund', 'Marc Lester Tan', '+63 922 888 4444', 'marc@pioneeroutgrowers.org', 4.40, 'Regional Co-op Investment Facility')
]

sql.append('\n-- 3. Agri Investors')
for i in investors:
    sql.append(f"INSERT INTO public.agri_investors (id, company_name, contact_person, contact_number, email, default_offtake_price_per_kg, notes) VALUES ('{i[0]}', '{i[1]}', '{i[2]}', '{i[3]}', '{i[4]}', {i[5]}, '{i[6]}') ON CONFLICT (id) DO NOTHING;")

# 4. Crop Cycles
cycles = [
    (gen_id(), 'CYC-2026-001', parcels[0][0], investors[0][0], 'Cassava', 'Rayong 72', '2026-01-15', '2026-10-15', None, 35.0, 'harvesting', 875000, 312500, 1400000, 1.15, 30000, 4.50, 'High-yield commercial cassava for BioGreen starch mill'),
    (gen_id(), 'CYC-2026-002', parcels[1][0], investors[1][0], 'Cassava', 'Ku 50', '2026-03-01', '2026-12-01', None, 20.0, 'growing', 500000, 0, 800000, 1.10, 25000, 4.80, 'Feed-grade cassava contracted by San Miguel Agro-Feeds'),
    (gen_id(), 'CYC-2026-003', parcels[2][0], investors[2][0], 'Cassava', 'Golden Yellow', '2026-02-10', '2026-11-10', None, 25.0, 'growing', 625000, 0, 1000000, 1.20, 28000, 4.65, 'High-starch export grade cassava'),
    (gen_id(), 'CYC-2025-004', parcels[3][0], investors[0][0], 'Cassava', 'Rayong 72', '2025-05-01', '2026-02-28', '2026-02-24', 40.0, 'completed', 1000000, 1042000, 1600000, 1.25, 35000, 4.50, 'Exceeded target yield by 4.2% with exceptional starch density'),
    (gen_id(), 'CYC-2026-005', parcels[4][0], investors[3][0], 'Cassava', 'Lakan', '2026-01-20', '2026-10-20', None, 18.5, 'harvesting', 462500, 184000, 740000, 1.10, 25000, 4.40, 'Outgrower batch currently under Phase 1 harvest'),
    (gen_id(), 'CYC-2026-006', parcels[5][0], investors[1][0], 'Cassava', 'Golden Yellow', '2026-09-01', '2027-06-01', None, 22.0, 'planning', 550000, 0, 880000, 1.15, 30000, 4.80, 'Q4 2026 planting scheduled upon land preparation sign-off')
]

sql.append('\n-- 4. Agri Crop Cycles')
for c in cycles:
    act_date = f"'{c[8]}'" if c[8] else 'NULL'
    sql.append(f"INSERT INTO public.agri_crop_cycles (id, cycle_code, parcel_id, investor_id, crop_type, variety, planting_date, target_harvest_date, actual_harvest_date, area_planted_ha, status, expected_yield_kg, total_actual_yield_kg, capital_allocated, land_owner_rate_per_kg, land_owner_guaranteed_min, offtake_price_per_kg, notes) VALUES ('{c[0]}', '{c[1]}', '{c[2]}', '{c[3]}', '{c[4]}', '{c[5]}', '{c[6]}', '{c[7]}', {act_date}, {c[9]}, '{c[10]}', {c[11]}, {c[12]}, {c[13]}, {c[14]}, {c[15]}, {c[16]}, '{c[17]}') ON CONFLICT (id) DO NOTHING;")

# 5. Farm Workers
workers = [
    (gen_id(), 'Danilo Morales', '+63 915 111 0001', 'Tractor Operator', 650.0),
    (gen_id(), 'Eduardo Bautista', '+63 916 111 0002', 'Harvest Scale Lead', 600.0),
    (gen_id(), 'Arnel Mendoza', '+63 917 111 0003', 'Planting Crew Lead', 550.0),
    (gen_id(), 'Rogelio Pascual', '+63 918 111 0004', 'Field Laborer', 480.0),
    (gen_id(), 'Nestor Gutierrez', '+63 919 111 0005', 'Field Laborer', 480.0),
    (gen_id(), 'Vicente De Leon', '+63 920 111 0006', 'Weeder & Maintenance', 480.0),
    (gen_id(), 'Benjamin Flores', '+63 921 111 0007', 'Tractor Operator', 650.0),
    (gen_id(), 'Ferdinand Aguilar', '+63 922 111 0008', 'Harvester', 500.0),
    (gen_id(), 'Renato Soriano', '+63 923 111 0009', 'Harvester', 500.0),
    (gen_id(), 'Jaime Castaneda', '+63 924 111 0010', 'Field Laborer', 480.0)
]

sql.append('\n-- 5. Agri Farm Workers')
for w in workers:
    sql.append(f"INSERT INTO public.agri_farm_workers (id, name, contact_number, specialization, daily_rate, status) VALUES ('{w[0]}', '{w[1]}', '{w[2]}', '{w[3]}', {w[4]}, 'active') ON CONFLICT (id) DO NOTHING;")

# 6. Growth Checkins
sql.append('\n-- 6. Agri Growth Checkins')
stages = [
    ('Vegetative Growth', 45, 'excellent', 'Healthy leaf canopy, zero stem borer infestation.'),
    ('Tuber Initiation', 95, 'good', 'Root thickening observed across test quadrants.'),
    ('Tuber Bulking Phase', 165, 'excellent', 'Rapid girth expansion, soil moisture optimal.'),
    ('Maturity Assessment', 210, 'good', 'Starch content sample test passed 28.5% threshold.')
]
for idx, c in enumerate(cycles[:3]):
    for s_idx, s in enumerate(stages):
        cid = gen_id()
        d = f'2026-0{3 + s_idx}-15'
        sql.append(f"INSERT INTO public.agri_growth_checkins (id, crop_cycle_id, checkin_date, stage, plant_height_cm, health_status, notes) VALUES ('{cid}', '{c[0]}', '{d}', '{s[0]}', {s[1] + idx * 5}, '{s[2]}', '{s[3]}') ON CONFLICT (id) DO NOTHING;")

# 7. Harvest Logs (Truck scale weights)
sql.append('\n-- 7. Agri Harvest Logs')
harvest_entries = [
    (cycles[0][0], parcels[0][0], '2026-09-18', 'BATCH-2026-09A', 28540, 11200, 17340, 'Grade A', 'RAE-4581', 'Eduardo Bautista', 'Cassava starch content 29.2%'),
    (cycles[0][0], parcels[0][0], '2026-09-19', 'BATCH-2026-09B', 31200, 11450, 19750, 'Grade A', 'NBD-9023', 'Eduardo Bautista', 'Clean roots, minimal soil adhering'),
    (cycles[0][0], parcels[0][0], '2026-09-20', 'BATCH-2026-09C', 29800, 11100, 18700, 'Grade A', 'KLA-2194', 'Eduardo Bautista', 'Direct dispatched to BioGreen starch mill'),
    (cycles[0][0], parcels[0][0], '2026-09-21', 'BATCH-2026-09D', 32450, 11350, 21100, 'Grade A', 'WOB-8812', 'Eduardo Bautista', 'Excellent root diameter (>5cm)'),
    (cycles[4][0], parcels[4][0], '2026-09-15', 'BATCH-DGH-01', 26400, 10800, 15600, 'Grade A', 'LAK-1102', 'Danilo Morales', 'Davao Green Hills harvest kick-off'),
    (cycles[4][0], parcels[4][0], '2026-09-17', 'BATCH-DGH-02', 28150, 10900, 17250, 'Grade B', 'LAK-1102', 'Danilo Morales', 'Slight moisture from rain, cleared for feed processing')
]
for h in harvest_entries:
    hid = gen_id()
    sql.append(f"INSERT INTO public.agri_harvest_logs (id, crop_cycle_id, parcel_id, harvest_date, batch_number, gross_weight_kg, tare_weight_kg, net_weight_kg, quality_grade, truck_plate_number, weigh_in_supervisor, notes) VALUES ('{hid}', '{h[0]}', '{h[1]}', '{h[2]}', '{h[3]}', {h[4]}, {h[5]}, {h[6]}, '{h[7]}', '{h[8]}', '{h[9]}', '{h[10]}') ON CONFLICT (id) DO NOTHING;")

# 8. Farm Expenses
sql.append('\n-- 8. Agri Farm Expenses')
expenses = [
    (cycles[0][0], parcels[0][0], '2026-01-10', 'Land Preparation', 'Tractor deep plowing & harrowing (35 ha)', 175000.0, 'jet'),
    (cycles[0][0], parcels[0][0], '2026-01-14', 'Stems & Planting', 'Certified Rayong 72 high-density stem cuttings', 105000.0, 'investor'),
    (cycles[0][0], parcels[0][0], '2026-02-15', 'Fertilizer', 'Complete 14-14-14 basal fertilizer application (140 bags)', 210000.0, 'investor'),
    (cycles[0][0], parcels[0][0], '2026-04-10', 'Fertilizer', 'Urea 46-0-0 top-dress application (70 bags)', 98000.0, 'investor'),
    (cycles[0][0], parcels[0][0], '2026-05-20', 'Weeding & Care', 'Mechanical inter-row cultivator weed suppression', 42000.0, 'jet'),
    (cycles[1][0], parcels[1][0], '2026-02-20', 'Land Preparation', 'Isabela riverbed tractor rotavator pass (20 ha)', 100000.0, 'jet'),
    (cycles[1][0], parcels[1][0], '2026-03-02', 'Stems & Planting', 'Ku 50 stem stalks and treatment fungicide dip', 60000.0, 'investor'),
    (cycles[1][0], parcels[1][0], '2026-04-05', 'Fertilizer', 'Agricultural dolomite lime for soil neutralization', 35000.0, 'investor'),
    (cycles[2][0], parcels[2][0], '2026-02-05', 'Land Preparation', 'Furrowing and bed preparation (25 ha)', 125000.0, 'jet'),
    (cycles[2][0], parcels[2][0], '2026-03-12', 'Fertilizer', 'NPK 16-16-16 slow release blend', 150000.0, 'investor')
]
for e in expenses:
    eid = gen_id()
    sql.append(f"INSERT INTO public.agri_farm_expenses (id, crop_cycle_id, parcel_id, expense_date, category, description, amount, paid_by) VALUES ('{eid}', '{e[0]}', '{e[1]}', '{e[2]}', '{e[3]}', '{e[4]}', {e[5]}, '{e[6]}') ON CONFLICT (id) DO NOTHING;")

# 9. Labor Logs
sql.append('\n-- 9. Agri Labor Logs')
tasks = [
    ('Tractor plowing & furrowing', 'daily', 5, 650.0, 3250.0),
    ('Planting stem insertion crew', 'pakyaw', 35, 1200.0, 42000.0),
    ('Post-emergence herbicide spray', 'daily', 8, 480.0, 3840.0),
    ('Fertilizer side-dressing application', 'daily', 10, 480.0, 4800.0),
    ('Harvest manual uprooting & cutting', 'pakyaw', 20, 1500.0, 30000.0),
    ('Truck scale terminal loading', 'daily', 4, 600.0, 2400.0)
]
for idx, t in enumerate(tasks):
    lid = gen_id()
    wid = workers[idx % len(workers)][0]
    cid = cycles[0][0]
    sql.append(f"INSERT INTO public.agri_labor_logs (id, worker_id, crop_cycle_id, work_date, task, rate_type, units_completed, rate_per_unit, total_pay, payment_status, notes) VALUES ('{lid}', '{wid}', '{cid}', '2026-09-{10+idx}', '{t[0]}', '{t[1]}', {t[2]}, {t[3]}, {t[4]}, 'paid', 'Verified by Field Supervisor') ON CONFLICT (id) DO NOTHING;")

# 10. Weekly Settlements (Land Owner payouts)
sql.append('\n-- 10. Agri Weekly Settlements')
settlements = [
    (cycles[0][0], owners[0][0], 1, '2026-09-14', '2026-09-20', 76890, 1.15, 88423.5, 30000.0, 88423.5, 0.0, 88423.5, 'paid', '2026-09-21', 'OR-SET-00109', json.dumps({'kilos': 76890, 'rate': 1.15, 'formula': 'MAX(kilos * rate, guaranteed_min)'})),
    (cycles[0][0], owners[0][0], 2, '2026-09-21', '2026-09-27', 154200, 1.15, 177330.0, 30000.0, 177330.0, 88423.5, 88906.5, 'approved', '2026-09-28', 'OR-SET-00115', json.dumps({'kilos': 77310, 'rate': 1.15, 'formula': 'Cumulative tranche reconciliation'}))
]
for s in settlements:
    sid = gen_id()
    sql.append(f"INSERT INTO public.agri_weekly_settlements (id, crop_cycle_id, land_owner_id, week_number, week_start_date, week_end_date, cumulative_kilos, rate_per_kilo, raw_kilo_earnings, guaranteed_minimum, target_cumulative_payout, previous_cumulative_payout, net_payout_due_this_week, payment_status, disbursement_date, receipt_reference, calculation_breakdown_json) VALUES ('{sid}', '{s[0]}', '{s[1]}', {s[2]}, '{s[3]}', '{s[4]}', {s[5]}, {s[6]}, {s[7]}, {s[8]}, {s[9]}, {s[10]}, {s[11]}, '{s[12]}', '{s[13]}', '{s[14]}', '{s[15]}') ON CONFLICT (id) DO NOTHING;")

# 11. Investor Ledgers
sql.append('\n-- 11. Agri Investor Ledgers')
ledgers = [
    (investors[0][0], cycles[0][0], '2026-01-10', 'capital_inflow', 0, 0, 1400000.0, 1400000.0, 'Tranche 1 initial project capital funding'),
    (investors[0][0], cycles[0][0], '2026-09-20', 'offtake_payout', 76890, 4.50, 346005.0, 1053995.0, 'Week 1 harvested cassava offtake delivery credit'),
    (investors[1][0], cycles[1][0], '2026-02-25', 'capital_inflow', 0, 0, 800000.0, 800000.0, 'Feed mill contract financing tranche'),
    (investors[2][0], cycles[2][0], '2026-02-05', 'capital_inflow', 0, 0, 1000000.0, 1000000.0, 'Starch division capital placement')
]
for l in ledgers:
    lid = gen_id()
    sql.append(f"INSERT INTO public.agri_investor_ledgers (id, investor_id, crop_cycle_id, transaction_date, type, kilos_received, price_per_kilo, amount, balance_running, notes) VALUES ('{lid}', '{l[0]}', '{l[1]}', '{l[2]}', '{l[3]}', {l[4]}, {l[5]}, {l[6]}, {l[7]}, '{l[8]}') ON CONFLICT (id) DO NOTHING;")

sql.append('COMMIT;')

import os
os.makedirs('supabase/queries', exist_ok=True)
with open('supabase/queries/seed-agri-one-mock-data.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql) + '\n')

print('Generated supabase/queries/seed-agri-one-mock-data.sql successfully!')
