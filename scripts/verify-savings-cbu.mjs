/**
 * verify-savings-cbu.mjs
 * 
 * Verifies the savings and CBU migration by cross-checking:
 * 1. Borrower counts vs Excel
 * 2. Opening balance totals vs Excel TSAD/TSM columns
 * 3. Transaction type distribution
 * 4. Spot-checks for known members
 */

import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(process.cwd(), '.env.production') });

const EXCEL_FILE = path.join(process.cwd(), 'docs/ddd/savings and cbu2025 (1).xlsx');
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseCurrency(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    if (typeof val === 'object' && val !== null && 'result' in val) {
        return parseCurrency(val.result);
    }
    return parseFloat(val.toString().replace(/[^\d.-]/g, '')) || 0;
}

function getCellValueString(cellVal) {
    if (cellVal === null || cellVal === undefined) return '';
    if (typeof cellVal === 'string') return cellVal;
    if (typeof cellVal === 'number') return cellVal.toString();
    if (typeof cellVal === 'object') {
        if ('richText' in cellVal && Array.isArray(cellVal.richText)) {
            return cellVal.richText.map(t => t.text || '').join('');
        }
        if ('result' in cellVal) {
            return getCellValueString(cellVal.result);
        }
        if ('text' in cellVal) {
            return getCellValueString(cellVal.text);
        }
    }
    return cellVal.toString();
}

function mapColumns(sheet) {
    let headerRowNumber = -1;
    let colMap = {
        nameIdx: -1,
        acctIdx: -1,
        prevIdx: -1,
        totalIdx: -1,
        monthCols: []
    };

    for (let r = 1; r <= 15; r++) {
        const row = sheet.getRow(r);
        let monthCount = 0;
        let hasMembers = false;
        
        row.eachCell({ includeEmpty: true }, (cell, c) => {
            const val = getCellValueString(cell.value).trim();
            if (!val) return;
            const valLower = val.toLowerCase();
            if (MONTHS.some(m => valLower.startsWith(m.toLowerCase()))) {
                monthCount++;
            }
            if (valLower === 'members' || valLower === 'member') {
                hasMembers = true;
            }
        });

        if (monthCount >= 3 || hasMembers) {
            headerRowNumber = r;
            row.eachCell({ includeEmpty: true }, (cell, c) => {
                const val = getCellValueString(cell.value).trim();
                if (!val) return;
                const valLower = val.toLowerCase();

                if (valLower === 'members' || valLower === 'member' || valLower === 'name') {
                    colMap.nameIdx = c;
                } else if (valLower.includes('account no') || valLower.includes('acct no')) {
                    colMap.acctIdx = c;
                } else if (valLower.includes('from 2024') || valLower.includes('2024 savings') || valLower.includes('opening') || valLower.includes('prev')) {
                    colMap.prevIdx = c;
                } else if (valLower === 'tsm' || valLower === 'tsad' || valLower.startsWith('total')) {
                    colMap.totalIdx = c;
                }
            });
            break;
        }
    }

    return { headerRowNumber, colMap };
}

let passCount = 0;
let failCount = 0;

function check(label, condition, detail = '') {
    if (condition) {
        console.log(`  ✅ ${label}${detail ? ' — ' + detail : ''}`);
        passCount++;
    } else {
        console.log(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
        failCount++;
    }
}

async function verify() {
    console.log('\n' + '='.repeat(60));
    console.log('SAVINGS & CBU MIGRATION VERIFICATION');
    console.log('='.repeat(60) + '\n');

    // ── Load Excel ─────────────────────────────────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_FILE);

    // Expected Savings from Savings2025
    const savSheet = workbook.getWorksheet('Savings2025');
    const { headerRowNumber: savHeaderRow, colMap: savColMap } = mapColumns(savSheet);
    let excelSavingsTotal = 0;
    let expectedSavingsCount = 0;

    savSheet.eachRow((row, rowNumber) => {
        if (rowNumber <= savHeaderRow) return;
        // Skip kiddy section starting around row 84
        if (rowNumber >= 84) return;

        const name = getCellValueString(row.getCell(savColMap.nameIdx).value).trim();
        if (!name || name.toLowerCase() === 'members' || name.toLowerCase().includes('total') || name.toLowerCase().includes('interest per')) return;

        const prevSavings = parseCurrency(row.getCell(savColMap.prevIdx).value);
        if (prevSavings > 0) {
            excelSavingsTotal += prevSavings;
            expectedSavingsCount++;
        }
    });

    // Expected CBU from SCPR2025
    const scprSheet = workbook.getWorksheet('SCPR2025');
    const { headerRowNumber: cbuHeaderRow, colMap: cbuColMap } = mapColumns(scprSheet);
    let excelCBUTotal = 0;
    let expectedCbuCount = 0;

    scprSheet.eachRow((row, rowNumber) => {
        if (rowNumber <= cbuHeaderRow) return;
        const name = getCellValueString(row.getCell(cbuColMap.nameIdx).value).trim();
        if (!name || name.toLowerCase() === 'members' || name.toLowerCase().includes('total') || name.toLowerCase().includes('interest per')) return;
        
        // Skip metadata headers and non-individual entries
        const nameLower = name.toLowerCase();
        if (nameLower.includes('cda registration') || 
            nameLower.includes('as of fy') || 
            nameLower.includes('computation of') || 
            nameLower.includes('brgy') || 
            nameLower.includes('ormoc city') ||
            nameLower.includes('poscursor')) return;

        const fromPrev = parseCurrency(row.getCell(cbuColMap.prevIdx).value);
        if (fromPrev > 0) {
            excelCBUTotal += fromPrev;
            expectedCbuCount++;
        }
    });

    // ── Query Supabase ──────────────────────────────────────────────────────────
    const { count: totalBorrowers } = await supabase
        .from('app_borrowers')
        .select('*', { count: 'exact', head: true });

    const { count: totalSavings } = await supabase
        .from('app_savings_transactions')
        .select('*', { count: 'exact', head: true });

    const { count: totalCbu } = await supabase
        .from('app_share_capital_transactions')
        .select('*', { count: 'exact', head: true });

    // Get all savings transactions
    const { data: allSavings } = await supabase
        .from('app_savings_transactions')
        .select('borrower_id, type, amount, notes, reference_id');

    // Get all CBU transactions
    const { data: allCbu } = await supabase
        .from('app_share_capital_transactions')
        .select('member_id, transaction_type, amount, notes, reference_number');

    const txByType = {};
    let dbSavingsOBTotal = 0;
    let dbCBUOBTotal = 0;

    for (const tx of allSavings || []) {
        txByType[tx.type] = (txByType[tx.type] || 0) + 1;
        if (tx.type === 'opening_balance') {
            dbSavingsOBTotal += tx.amount;
        }
    }

    for (const tx of allCbu || []) {
        txByType[tx.transaction_type] = (txByType[tx.transaction_type] || 0) + 1;
        if (tx.transaction_type === 'Migration Balance') {
            dbCBUOBTotal += tx.amount;
        }
    }

    // ── Section 1: Counts ───────────────────────────────────────────────────────
    console.log('📊 SECTION 1: Record Counts');
    check('Total borrowers > 100', totalBorrowers >= 100, `${totalBorrowers} borrowers`);
    check(`Total savings transactions >= ${totalSavings}`, totalSavings >= 30, `${totalSavings} transactions`);
    check(`Total CBU transactions >= ${totalCbu}`, totalCbu >= 90, `${totalCbu} transactions`);
    
    check(`Savings opening balances = ${expectedSavingsCount}`,
        (txByType['opening_balance'] || 0) === expectedSavingsCount,
        `got ${txByType['opening_balance'] || 0}`);
        
    check(`CBU opening balances = ${expectedCbuCount}`,
        (txByType['Migration Balance'] || 0) === expectedCbuCount,
        `got ${txByType['Migration Balance'] || 0}`);

    // ── Section 2: Amount Totals ────────────────────────────────────────────────
    console.log('\n💰 SECTION 2: Amount Totals');

    const savDiff = Math.abs(dbSavingsOBTotal - excelSavingsTotal);
    const cbuDiff = Math.abs(dbCBUOBTotal - excelCBUTotal);

    console.log(`  Excel savings carry-forward total  : PHP ${excelSavingsTotal.toFixed(2)}`);
    console.log(`  DB savings opening balances total  : PHP ${dbSavingsOBTotal.toFixed(2)}`);
    check('Savings opening balances match Excel (within PHP 1)', savDiff < 1, `diff: ${savDiff.toFixed(2)}`);

    console.log(`  Excel CBU carry-forward total      : PHP ${excelCBUTotal.toFixed(2)}`);
    console.log(`  DB CBU opening balances total      : PHP ${dbCBUOBTotal.toFixed(2)}`);
    check('CBU opening balances match Excel (within PHP 1)', cbuDiff < 1, `diff: ${cbuDiff.toFixed(2)}`);

    // ── Section 3: Spot Checks ──────────────────────────────────────────────────
    console.log('\n🔎 SECTION 3: Spot Checks');

    // Spot-check Allen L. Gubalane: CBU opening balance=2182.65, savings opening balance=469.15
    const { data: allenBorrower } = await supabase
        .from('app_borrowers')
        .select('id, full_name')
        .ilike('full_name', '%gubalane%')
        .limit(1);

    if (allenBorrower?.[0]) {
        const allenId = allenBorrower[0].id;
        
        const { data: allenSavTx } = await supabase
            .from('app_savings_transactions')
            .select('type, amount')
            .eq('borrower_id', allenId)
            .eq('type', 'opening_balance');

        const { data: allenCbuTx } = await supabase
            .from('app_share_capital_transactions')
            .select('transaction_type, amount')
            .eq('member_id', allenId)
            .eq('transaction_type', 'Migration Balance');

        const allenCBUOB = allenCbuTx?.[0]?.amount || 0;
        const allenSavOB = allenSavTx?.[0]?.amount || 0;

        check(`Allen Gubalane CBU = PHP 2182.65`,
            Math.abs(allenCBUOB - 2182.65) < 0.01,
            `got ${allenCBUOB}`);
        check(`Allen Gubalane Savings = PHP 469.15`,
            Math.abs(allenSavOB - 469.15) < 0.01,
            `got ${allenSavOB}`);
    } else {
        check('Allen Gubalane found in DB', false, 'Not found');
    }

    // Spot-check Crisencia R. Ruiz: CBU=7061.03, savings=4497.40
    const { data: crisBorrower } = await supabase
        .from('app_borrowers')
        .select('id, full_name')
        .ilike('full_name', '%ruiz%')
        .limit(1);

    if (crisBorrower?.[0]) {
        const crisId = crisBorrower[0].id;
        
        const { data: crisSavTx } = await supabase
            .from('app_savings_transactions')
            .select('type, amount')
            .eq('borrower_id', crisId)
            .eq('type', 'opening_balance');

        const { data: crisCbuTx } = await supabase
            .from('app_share_capital_transactions')
            .select('transaction_type, amount')
            .eq('member_id', crisId)
            .eq('transaction_type', 'Migration Balance');

        const crisCBUOB = crisCbuTx?.[0]?.amount || 0;
        const crisSavOB = crisSavTx?.[0]?.amount || 0;

        check(`Crisencia Ruiz CBU = PHP 7061.03`,
            Math.abs(crisCBUOB - 7061.03) < 0.01,
            `got ${crisCBUOB}`);
        check(`Crisencia Ruiz Savings = PHP 4497.40`,
            Math.abs(crisSavOB - 4497.4) < 0.01,
            `got ${crisSavOB}`);
    } else {
        check('Crisencia Ruiz found in DB', false, 'Not found');
    }

    // ── Section 4: Transaction Type Summary ────────────────────────────────────
    console.log('\n📋 SECTION 4: Transaction Type Summary');
    for (const [type, count] of Object.entries(txByType)) {
        console.log(`  ${type.padEnd(25)} : ${count}`);
    }

    // ── Final result ───────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(60));
    console.log(`RESULT: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('='.repeat(60) + '\n');

    if (failCount > 0) {
        process.exit(1);
    }
}

verify().catch(err => {
    console.error('❌ Verification failed:', err.message);
    process.exit(1);
});
