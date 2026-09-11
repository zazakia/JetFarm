/**
 * migrate-savings-cbu.mjs
 * 
 * Migrates Savings Deposits and CBU (Capital Build-Up / Share Capital)
 * from "savings and cbu2025.xlsx" into Supabase production.
 *
 * Strategy:
 *  - Members are matched by last name against existing app_borrowers
 *  - Savings → app_savings_transactions (type: 'deposit' for monthly, 'opening_balance' for prev year carry-over)
 *  - CBU     → app_savings_transactions (type: 'cbu_deposit' for monthly, 'cbu_opening_balance' for prev year)
 *  - Kiddy   → app_savings_transactions (type: 'kiddy_deposit', linked to separate kiddy borrowers)
 *  - New members not found in DB are created as new app_borrowers
 *
 * Usage: node scripts/migrate-savings-cbu.mjs [--dry-run]
 */

import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(process.cwd(), '.env.production') });

const DRY_RUN = process.argv.includes('--dry-run');
const EXCEL_FILE = path.join(process.cwd(), 'savings and cbu2025.xlsx');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials in .env.production');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseCurrency(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return parseFloat(val.toString().replace(/[^\d.-]/g, '')) || 0;
}

function normalizeName(name) {
    if (!name) return '';
    return name
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[.,]/g, '');
}

/**
 * Extract last name for fuzzy matching.
 * Handles "First M. Last" and "Last, First" formats.
 */
function extractLastName(name) {
    if (!name) return '';
    const clean = name.trim();
    if (clean.includes(',')) {
        return clean.split(',')[0].trim().toLowerCase();
    }
    const parts = clean.split(/\s+/);
    return (parts[parts.length - 1] || '').toLowerCase().replace(/[.,]/g, '');
}

/**
 * Build a matcher: given Excel name, find best matching borrower ID.
 * Priority:
 *  1. Exact full_name match (normalized)
 *  2. Last name + first initial match
 *  3. Last name only match
 */
function buildMatcher(borrowers) {
    const byFullName = new Map();
    const byLastName = new Map();

    for (const b of borrowers) {
        const normFull = normalizeName(b.full_name);
        byFullName.set(normFull, b.id);

        const lastName = extractLastName(b.full_name);
        if (!byLastName.has(lastName)) {
            byLastName.set(lastName, []);
        }
        byLastName.get(lastName).push(b);
    }

    return function match(excelName) {
        const normExcel = normalizeName(excelName);
        // 1. Exact
        if (byFullName.has(normExcel)) return { id: byFullName.get(normExcel), how: 'exact' };

        // 2. Last name match
        const excelLast = extractLastName(excelName);
        const candidates = byLastName.get(excelLast) || [];
        if (candidates.length === 1) return { id: candidates[0].id, how: 'last_name' };

        // 3. Last name + first initial
        const excelParts = normExcel.split(' ');
        const excelFirst = excelParts[0]?.[0] || '';
        if (candidates.length > 1 && excelFirst) {
            const refined = candidates.filter(b => {
                const normB = normalizeName(b.full_name);
                return normB.startsWith(excelFirst);
            });
            if (refined.length === 1) return { id: refined[0].id, how: 'last_name+initial' };
        }

        return null; // no match
    };
}

function splitName(fullName) {
    if (!fullName) return { first: '', last: '', full: '' };
    const clean = fullName.trim();
    if (clean.includes(',')) {
        const parts = clean.split(',').map(p => p.trim());
        return { last: parts[0], first: parts[1] || '', full: `${parts[1] || ''} ${parts[0]}`.trim() };
    }
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return { first: parts[0], last: '', full: parts[0] };
    const last = parts.pop();
    return { first: parts.join(' '), last, full: clean };
}

// Month index → date string in FY
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthDate(year, monthName) {
    const idx = MONTHS.indexOf(monthName.trim().substring(0, 3));
    if (idx === -1) return null;
    // Use 15th of the month as canonical date
    return new Date(year, idx, 15).toISOString();
}

// ─── Parse Savings Sheet ─────────────────────────────────────────────────────

/**
 * Returns array of { name, prevSavings, monthly: [{month, amount}], tsad, interest, total }
 */
function parseSavingsSheet(wb, sheetName, fyYear) {
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];

    const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const members = [];

    // Header row is row 7 (index 7). Detect month columns.
    const headerRow = data[7] || [];
    const monthCols = [];
    let prevSavingsCol = -1;
    let tsadCol = -1;
    let interestCol = -1;
    let totalCol = -1;

    for (let c = 0; c < headerRow.length; c++) {
        const h = headerRow[c]?.toString().trim();
        if (!h) continue;
        const h3 = h.substring(0, 3);
        if (MONTHS.includes(h3)) monthCols.push({ col: c, month: h3 });
        if (h.match(/^20\d\d.?Savings?|^2\d\d\d Savings?|^Prev/i)) prevSavingsCol = c;
        if (h === 'TSAD') tsadCol = c;
        if (h.match(/Int/i) && h.match(/TSAD|interest/i)) interestCol = c;
        if (h.match(/Total/i)) totalCol = c;
    }

    // Auto-detect prevSavings as col 2 if not found
    if (prevSavingsCol === -1) prevSavingsCol = 2;
    if (tsadCol === -1) tsadCol = prevSavingsCol + MONTHS.length + 1;

    for (let i = 8; i < data.length; i++) {
        const row = data[i];
        const no = row[0];
        const name = row[1]?.toString().trim();
        if (!name || typeof no !== 'number' || no <= 0) continue;
        if (name.toLowerCase().includes('interest per')) continue;

        const monthly = monthCols
            .map(({ col, month }) => ({ month, amount: parseCurrency(row[col]) }))
            .filter(m => m.amount > 0);

        members.push({
            name,
            prevSavings: parseCurrency(row[prevSavingsCol]),
            monthly,
            tsad: parseCurrency(row[tsadCol]),
            interest: interestCol >= 0 ? parseCurrency(row[interestCol]) : 0,
            total: totalCol >= 0 ? parseCurrency(row[totalCol]) : 0,
            fyYear,
        });
    }

    return members;
}

// ─── Parse SCPR (CBU) Sheet ──────────────────────────────────────────────────

/**
 * Returns array of { name, acctNo, fromPrev, monthly: [{month, amount}], tsm, iosc, patronage }
 */
function parseCBUSheet(wb, sheetName, fyYear) {
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];

    const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const members = [];

    // Headers at row 7
    const headerRow = data[7] || [];
    const monthCols = [];
    let acctNoCol = -1;
    let fromPrevCol = 3; // default
    let tsmCol = -1;

    for (let c = 0; c < headerRow.length; c++) {
        const h = headerRow[c]?.toString().trim();
        if (!h) continue;
        const h3 = h.substring(0, 3);
        if (MONTHS.includes(h3)) monthCols.push({ col: c, month: h3 });
        if (h.match(/Account.?No/i)) acctNoCol = c;
        if (h.match(/From \d{4}/i)) fromPrevCol = c;
        if (h === 'TSM') tsmCol = c;
    }

    // SCPR2025 has account numbers at col 2
    if (acctNoCol === -1 && headerRow[2]?.toString().match(/Account/i)) acctNoCol = 2;

    // Data rows: SCPR2025 starts at row 10, older at row 9
    const startRow = data[9]?.[0] === '' ? 10 : 9;

    for (let i = startRow; i < data.length; i++) {
        const row = data[i];
        const no = row[0];
        const name = row[1]?.toString().trim();
        if (!name || typeof no !== 'number' || no <= 0) continue;

        const acctNo = acctNoCol >= 0 ? (row[acctNoCol]?.toString().trim() || null) : null;

        // Monthly columns — skip "Add'l CBU" subcolumns (only take main month cols)
        const monthlyMap = {};
        for (const { col, month } of monthCols) {
            const amt = parseCurrency(row[col]);
            if (amt > 0 && !monthlyMap[month]) monthlyMap[month] = amt;
        }
        const monthly = Object.entries(monthlyMap).map(([month, amount]) => ({ month, amount }));

        members.push({
            name,
            acctNo,
            fromPrev: parseCurrency(row[fromPrevCol]),
            monthly,
            tsm: tsmCol >= 0 ? parseCurrency(row[tsmCol]) : 0,
            fyYear,
        });
    }

    return members;
}

// ─── Parse Kiddy Sheet ───────────────────────────────────────────────────────

function parseKiddySheet(wb, sheetName, fyYear) {
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];

    const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const members = [];
    const headerRow = data[7] || [];
    const monthCols = [];
    let prevSavingsCol = 2;

    for (let c = 0; c < headerRow.length; c++) {
        const h = headerRow[c]?.toString().trim();
        if (!h) continue;
        const h3 = h.substring(0, 3);
        if (MONTHS.includes(h3)) monthCols.push({ col: c, month: h3 });
    }

    for (let i = 8; i < data.length; i++) {
        const row = data[i];
        const no = row[0];
        const name = row[1]?.toString().trim();
        if (!name || typeof no !== 'number' || no <= 0) continue;
        if (name.toLowerCase().includes('interest per')) continue;

        const monthly = monthCols
            .map(({ col, month }) => ({ month, amount: parseCurrency(row[col]) }))
            .filter(m => m.amount > 0);

        members.push({
            name,
            prevSavings: parseCurrency(row[prevSavingsCol]),
            monthly,
            fyYear,
        });
    }

    return members;
}

// ─── Batch Insert ─────────────────────────────────────────────────────────────

async function batchInsert(table, records, batchSize = 50) {
    let ok = 0;
    let skipped = 0;
    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        if (DRY_RUN) {
            ok += batch.length;
            continue;
        }
        const { error } = await supabase.from(table).insert(batch);
        if (error) {
            if (error.code === '23505') {
                console.log(`    ⚠ ${batch.length} duplicates skipped`);
                skipped += batch.length;
            } else {
                console.error(`    ❌ Insert error: ${error.message}`);
                throw error;
            }
        } else {
            ok += batch.length;
        }
    }
    return { ok, skipped };
}

// ─── Main Migration ───────────────────────────────────────────────────────────

async function migrate() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`SAVINGS & CBU MIGRATION — ${DRY_RUN ? '[DRY RUN]' : '[LIVE]'}`);
    console.log(`${'='.repeat(60)}\n`);

    // ── 1. Load Excel ──────────────────────────────────────────────────────────
    console.log('📂 Loading Excel file...');
    const wb = xlsx.readFile(EXCEL_FILE);
    console.log(`   Sheets: ${wb.SheetNames.join(', ')}\n`);

    // ── 2. Load existing borrowers ─────────────────────────────────────────────
    console.log('👥 Loading existing borrowers from Supabase...');
    const { data: existingBorrowers, error: bErr } = await supabase
        .from('app_borrowers')
        .select('id, full_name, first_name, last_name');
    if (bErr) throw new Error(`Failed to load borrowers: ${bErr.message}`);
    console.log(`   Found ${existingBorrowers.length} existing borrowers.\n`);

    const match = buildMatcher(existingBorrowers);
    const borrowersByNorm = new Map(existingBorrowers.map(b => [normalizeName(b.full_name), b.id]));

    // Track new borrowers to create
    const newBorrowers = new Map(); // normName → {id, record}
    const nameToId = new Map(); // normName → id (covers both existing and new)

    // Pre-fill from existing
    for (const b of existingBorrowers) {
        nameToId.set(normalizeName(b.full_name), b.id);
    }

    function resolveOrCreate(excelName, extra = {}) {
        const normExcel = normalizeName(excelName);

        // Already resolved
        if (nameToId.has(normExcel)) return nameToId.get(normExcel);

        // Try matching
        const found = match(excelName);
        if (found) {
            nameToId.set(normExcel, found.id);
            return found.id;
        }

        // New borrower
        if (!newBorrowers.has(normExcel)) {
            const { first, last, full } = splitName(excelName);
            const id = crypto.randomUUID();
            const now = new Date().toISOString();
            newBorrowers.set(normExcel, {
                id,
                record: {
                    id,
                    full_name: excelName.trim(),
                    first_name: first,
                    last_name: last,
                    created_at: now,
                    updated_at: now,
                    ...extra,
                },
            });
            nameToId.set(normExcel, id);
        }
        return newBorrowers.get(normExcel).id;
    }

    // ── 3. Parse all FY2025 data ───────────────────────────────────────────────

    // Savings2025
    console.log('💰 Parsing Savings2025...');
    const savings2025 = parseSavingsSheet(wb, 'Savings2025', 2025);
    console.log(`   ${savings2025.length} savings members found.`);

    // SCPR2025 (CBU)
    console.log('📊 Parsing SCPR2025 (CBU)...');
    const cbu2025 = parseCBUSheet(wb, 'SCPR2025', 2025);
    console.log(`   ${cbu2025.length} CBU members found.`);

    // KIDDY2024 (most recent kiddy data)
    console.log('👶 Parsing KIDDY2024...');
    const kiddy2024 = parseKiddySheet(wb, 'KIDDY2024', 2024);
    console.log(`   ${kiddy2024.length} kiddy members found.\n`);

    // ── 4. Build transactions ──────────────────────────────────────────────────
    const now = new Date().toISOString();
    const savingsTransactions = [];
    const unmatched = [];

    // — Savings2025 —
    console.log('🔗 Matching Savings2025 members...');
    let savMatchOk = 0, savMatchNew = 0;
    for (const m of savings2025) {
        const borrowerId = resolveOrCreate(m.name);
        const isNew = newBorrowers.has(normalizeName(m.name));
        if (isNew) { savMatchNew++; } else { savMatchOk++; }

        // Opening balance (carry-forward from 2024)
        if (m.prevSavings > 0) {
            savingsTransactions.push({
                id: crypto.randomUUID(),
                borrower_id: borrowerId,
                type: 'opening_balance',
                amount: m.prevSavings,
                date: new Date(2025, 0, 1).toISOString(), // Jan 1 2025
                notes: `Savings opening balance FY2025 (carried from 2024)`,
                reference_id: `SAV-OB-2025-${normalizeName(m.name).replace(/\s+/g, '-')}`,
                created_at: now,
                updated_at: now,
            });
        }

        // Monthly deposits
        for (const { month, amount } of m.monthly) {
            if (amount <= 0) continue;
            savingsTransactions.push({
                id: crypto.randomUUID(),
                borrower_id: borrowerId,
                type: 'deposit',
                amount,
                date: monthDate(2025, month),
                notes: `Savings deposit - ${month} 2025`,
                reference_id: `SAV-${month.toUpperCase()}-2025-${normalizeName(m.name).replace(/\s+/g, '-')}`,
                created_at: now,
                updated_at: now,
            });
        }
    }
    console.log(`   Matched: ${savMatchOk} existing, ${savMatchNew} new to create.`);

    // — SCPR2025 (CBU) —
    console.log('🔗 Matching SCPR2025 CBU members...');
    let cbuMatchOk = 0, cbuMatchNew = 0;
    for (const m of cbu2025) {
        const borrowerId = resolveOrCreate(m.name);
        const isNew = newBorrowers.has(normalizeName(m.name));
        if (isNew) { cbuMatchNew++; } else { cbuMatchOk++; }

        // CBU opening balance (from 2024)
        if (m.fromPrev > 0) {
            savingsTransactions.push({
                id: crypto.randomUUID(),
                borrower_id: borrowerId,
                type: 'cbu_opening_balance',
                amount: m.fromPrev,
                date: new Date(2025, 0, 1).toISOString(),
                notes: `CBU opening balance FY2025 (carried from 2024)${m.acctNo ? ` | Acct: ${m.acctNo}` : ''}`,
                reference_id: `CBU-OB-2025-${m.acctNo || normalizeName(m.name).replace(/\s+/g, '-')}`,
                created_at: now,
                updated_at: now,
            });
        }

        // Monthly CBU contributions
        for (const { month, amount } of m.monthly) {
            if (amount <= 0) continue;
            savingsTransactions.push({
                id: crypto.randomUUID(),
                borrower_id: borrowerId,
                type: 'cbu_deposit',
                amount,
                date: monthDate(2025, month),
                notes: `CBU contribution - ${month} 2025${m.acctNo ? ` | Acct: ${m.acctNo}` : ''}`,
                reference_id: `CBU-${month.toUpperCase()}-2025-${m.acctNo || normalizeName(m.name).replace(/\s+/g, '-')}`,
                created_at: now,
                updated_at: now,
            });
        }
    }
    console.log(`   Matched: ${cbuMatchOk} existing, ${cbuMatchNew} new to create.`);

    // — KIDDY2024 —
    console.log('🔗 Matching KIDDY2024 members...');
    let kiddyMatchOk = 0, kiddyMatchNew = 0;
    for (const m of kiddy2024) {
        // Kiddy members get their own borrower records with a note
        const normName = normalizeName(m.name);
        const borrowerId = resolveOrCreate(m.name, { notes: 'Kiddy savings member (child)' });
        const isNew = newBorrowers.has(normName);
        if (isNew) { kiddyMatchNew++; } else { kiddyMatchOk++; }

        if (m.prevSavings > 0) {
            savingsTransactions.push({
                id: crypto.randomUUID(),
                borrower_id: borrowerId,
                type: 'kiddy_opening_balance',
                amount: m.prevSavings,
                date: new Date(2024, 0, 1).toISOString(),
                notes: `Kiddy savings opening balance FY2024`,
                reference_id: `KIDDY-OB-2024-${normName.replace(/\s+/g, '-')}`,
                created_at: now,
                updated_at: now,
            });
        }

        for (const { month, amount } of m.monthly) {
            if (amount <= 0) continue;
            savingsTransactions.push({
                id: crypto.randomUUID(),
                borrower_id: borrowerId,
                type: 'kiddy_deposit',
                amount,
                date: monthDate(2024, month),
                notes: `Kiddy savings deposit - ${month} 2024`,
                reference_id: `KIDDY-${month.toUpperCase()}-2024-${normName.replace(/\s+/g, '-')}`,
                created_at: now,
                updated_at: now,
            });
        }
    }
    console.log(`   Matched: ${kiddyMatchOk} existing, ${kiddyMatchNew} new to create.\n`);

    // ── 5. Summary ─────────────────────────────────────────────────────────────
    console.log('📋 MIGRATION SUMMARY');
    console.log('─'.repeat(40));
    console.log(`  New borrowers to create : ${newBorrowers.size}`);
    console.log(`  Savings transactions    : ${savingsTransactions.length}`);
    console.log(`    - Opening balances    : ${savingsTransactions.filter(t => t.type.includes('opening')).length}`);
    console.log(`    - Monthly savings     : ${savingsTransactions.filter(t => t.type === 'deposit').length}`);
    console.log(`    - Monthly CBU         : ${savingsTransactions.filter(t => t.type === 'cbu_deposit').length}`);
    console.log(`    - Kiddy               : ${savingsTransactions.filter(t => t.type.includes('kiddy')).length}`);
    console.log('');

    if (DRY_RUN) {
        console.log('🔎 DRY RUN — no data written.\n');
        console.log('New borrowers (sample 5):');
        for (const [, { record }] of [...newBorrowers.entries()].slice(0, 5)) {
            console.log('  ', record.full_name);
        }
        console.log('\nTransaction types:');
        const types = {};
        for (const t of savingsTransactions) types[t.type] = (types[t.type] || 0) + 1;
        console.log(JSON.stringify(types, null, 2));
        return;
    }

    // ── 6. Insert new borrowers ────────────────────────────────────────────────
    const newBorrowerRecords = [...newBorrowers.values()].map(v => v.record);
    if (newBorrowerRecords.length > 0) {
        console.log(`👤 Creating ${newBorrowerRecords.length} new borrowers...`);
        const { ok, skipped } = await batchInsert('app_borrowers', newBorrowerRecords);
        console.log(`   ✅ ${ok} inserted, ${skipped} skipped.\n`);
    } else {
        console.log('👤 No new borrowers to create.\n');
    }

    // ── 7. Insert savings transactions ─────────────────────────────────────────
    if (savingsTransactions.length > 0) {
        console.log(`💾 Inserting ${savingsTransactions.length} savings transactions...`);
        const { ok, skipped } = await batchInsert('app_savings_transactions', savingsTransactions);
        console.log(`   ✅ ${ok} inserted, ${skipped} skipped.\n`);
    }

    console.log('✅ MIGRATION COMPLETE!\n');
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
