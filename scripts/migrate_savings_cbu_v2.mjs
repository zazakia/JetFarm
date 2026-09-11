import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.production') });

const DRY_RUN = !process.argv.includes('--apply');
const EXCEL_FILE = path.join(process.cwd(), 'docs/ddd/savings and cbu2025 (1).xlsx');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getLevenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                );
            }
        }
    }
    return matrix[b.length][a.length];
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
        if ('hyperlink' in cellVal) {
            return getCellValueString(cellVal.text || cellVal.hyperlink);
        }
    }
    return cellVal.toString();
}

function cleanAndNormalize(name) {
    if (!name) return '';
    let str = name.toString().toLowerCase().trim();
    str = str.replace(/[.,]/g, '');
    str = str.replace(/\s+/g, ' ');
    if (str.startsWith('ma ')) str = 'maria' + str.substring(2);
    if (str.startsWith('jr') || str.endsWith(' jr')) str = str.replace(' jr', '');
    return str;
}

function getPartsWithoutInitials(normalizedName) {
    const parts = normalizedName.split(' ');
    return parts.filter(p => p.length > 1);
}

function fuzzyMatch(excelName, dbBorrowers) {
    const normExcel = cleanAndNormalize(excelName);
    if (!normExcel) return null;
    const excelParts = getPartsWithoutInitials(normExcel);
    
    // 1. Try exact match on normalized name
    for (const db of dbBorrowers) {
        const normDb = cleanAndNormalize(db.full_name);
        if (normDb === normExcel) {
            return { db, confidence: 'EXACT' };
        }
    }

    // 2. Try match ignoring middle initials
    const excelKey = excelParts.join(' ');
    for (const db of dbBorrowers) {
        const normDb = cleanAndNormalize(db.full_name);
        const dbParts = getPartsWithoutInitials(normDb);
        const dbKey = dbParts.join(' ');
        if (excelKey === dbKey) {
            return { db, confidence: 'IGNORE_INITIALS' };
        }
    }

    // 3. Try Levenshtein match on last name + first name parts
    if (excelParts.length >= 2) {
        const excelLast = excelParts[excelParts.length - 1];
        const excelFirst = excelParts.slice(0, -1).join(' ');

        for (const db of dbBorrowers) {
            const normDb = cleanAndNormalize(db.full_name);
            const dbParts = getPartsWithoutInitials(normDb);
            if (dbParts.length < 2) continue;

            const dbLast = dbParts[dbParts.length - 1];
            const dbFirst = dbParts.slice(0, -1).join(' ');

            const lastDist = getLevenshteinDistance(excelLast, dbLast);
            const firstDist = getLevenshteinDistance(excelFirst, dbFirst);

            if (lastDist === 0 && firstDist <= 3) {
                return { db, confidence: 'FUZZY_CLOSE' };
            }
            if (lastDist <= 1 && firstDist <= 2) {
                return { db, confidence: 'FUZZY_CLOSE' };
            }
        }
    }

    return null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseCurrency(val) {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    if (typeof val === 'object' && val !== null && 'result' in val) {
        return parseCurrency(val.result);
    }
    return parseFloat(val.toString().replace(/[^\d.-]/g, '')) || 0;
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

                const matchedMonth = MONTHS.find(m => valLower.startsWith(m.toLowerCase()));
                if (matchedMonth) {
                    colMap.monthCols.push({ idx: c, month: matchedMonth });
                }
            });
            break;
        }
    }

    return { headerRowNumber, colMap };
}

async function main() {
    console.log('====================================================');
    console.log(`   SAVINGS & CBU EXCEL DATA IMPORT SYSTEM v2.0   `);
    console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN (Simulated)' : '🚀 LIVE (Applying changes)'}`);
    console.log('====================================================\n');

    // 1. Fetch DB Borrowers
    console.log('👥 Fetching borrowers from Supabase...');
    const { data: dbBorrowers, error: bErr } = await supabase
        .from('app_borrowers')
        .select('*');
    if (bErr) throw bErr;
    console.log(`   Fetched ${dbBorrowers.length} borrowers.`);

    // 2. Perform Borrower De-duplication / Merging (e.g. Paul Espinosa)
    const normalizedToBorrowers = new Map();
    for (const b of dbBorrowers) {
        const norm = cleanAndNormalize(b.full_name);
        const list = normalizedToBorrowers.get(norm) ?? [];
        list.push(b);
        normalizedToBorrowers.set(norm, list);
    }

    const duplicates = [];
    for (const [norm, list] of normalizedToBorrowers.entries()) {
        if (list.length > 1) {
            const withNum = list.find(b => b.membership_number !== null && b.membership_number !== '');
            const withoutNum = list.find(b => b.membership_number === null || b.membership_number === '');

            if (withNum && withoutNum) {
                duplicates.push({ keep: withNum, discard: withoutNum });
            }
        }
    }

    if (duplicates.length > 0) {
        console.log(`\n⚠️ Found ${duplicates.length} duplicate borrower records to merge/clean:`);
        for (const dup of duplicates) {
            console.log(`  - Keep: "${dup.keep.full_name}" (${dup.keep.membership_number || 'N/A'}, ID: ${dup.keep.id})`);
            console.log(`  - Discard: "${dup.discard.full_name}" (${dup.discard.membership_number || 'N/A'}, ID: ${dup.discard.id})`);
            
            if (!DRY_RUN) {
                console.log(`    Relinking savings transactions...`);
                await supabase.from('app_savings_transactions').update({ borrower_id: dup.keep.id }).eq('borrower_id', dup.discard.id);
                console.log(`    Relinking share capital transactions...`);
                await supabase.from('app_share_capital_transactions').update({ member_id: dup.keep.id }).eq('member_id', dup.discard.id);
                console.log(`    Deleting duplicate borrower...`);
                await supabase.from('app_borrowers').delete().eq('id', dup.discard.id);
                console.log(`    ✅ Merge complete!`);
            } else {
                console.log(`    [Dry Run] Would merge transactions and delete duplicate borrower.`);
            }
        }
    }

    // 3. Load Excel Workbook
    console.log(`\n📂 Loading Excel workbook: ${EXCEL_FILE}`);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(EXCEL_FILE);

    // 4. Process SCPR2025 (CBU)
    const scprSheet = workbook.getWorksheet('SCPR2025');
    const { headerRowNumber: cbuHeaderRow, colMap: cbuColMap } = mapColumns(scprSheet);
    
    console.log(`\n📊 Processing CBU/Share Capital (SCPR2025) using header row ${cbuHeaderRow}...`);

    const cbuInserts = [];
    const now = Date.now();

    scprSheet.eachRow((row, rowNumber) => {
        if (rowNumber <= cbuHeaderRow) return;
        const nameVal = row.getCell(cbuColMap.nameIdx).value;
        const name = getCellValueString(nameVal).trim();
        if (!name || name.toLowerCase() === 'members' || name.toLowerCase().includes('total') || name.toLowerCase().includes('interest per')) return;

        const accountNo = cbuColMap.acctIdx >= 0 ? (getCellValueString(row.getCell(cbuColMap.acctIdx).value).trim() || null) : null;
        const fromPrev = parseCurrency(row.getCell(cbuColMap.prevIdx).value);

        // Match member
        const match = fuzzyMatch(name, dbBorrowers);
        if (!match) {
            console.log(`   ❌ Could not match Excel member "${name}" in DB.`);
            return;
        }

        // CBU carry forward opening balance
        if (fromPrev > 0) {
            cbuInserts.push({
                id: crypto.randomUUID(),
                member_id: match.db.id,
                transaction_type: 'Migration Balance',
                share_type: 'COMMON',
                number_of_shares: Math.floor(fromPrev / 100),
                par_value: 100,
                amount: fromPrev,
                running_balance_shares: Math.floor(fromPrev / 100),
                running_balance_amount: fromPrev,
                reference_number: accountNo || 'CBU-OB-2025',
                date: new Date('2024-12-31T23:59:59.000Z').getTime(),
                notes: `Historical 2024 CBU opening balance from Excel sheet`,
                created_at: now,
                updated_at: now,
                deleted_at: null
            });
        }
    });

    console.log(`   Prepared ${cbuInserts.length} CBU transactions to insert.`);

    // 5. Process Regular Savings (Savings2025)
    const savSheet = workbook.getWorksheet('Savings2025');
    const { headerRowNumber: savHeaderRow, colMap: savColMap } = mapColumns(savSheet);

    console.log(`\n💰 Processing Regular Savings (Savings2025) using header row ${savHeaderRow}...`);

    const savingsInserts = [];

    savSheet.eachRow((row, rowNumber) => {
        if (rowNumber <= savHeaderRow) return;
        const nameVal = row.getCell(savColMap.nameIdx).value;
        const name = getCellValueString(nameVal).trim();
        if (!name || name.toLowerCase() === 'members' || name.toLowerCase().includes('total') || name.toLowerCase().includes('interest per')) return;

        const prevSavings = parseCurrency(row.getCell(savColMap.prevIdx).value);

        // Match member
        const match = fuzzyMatch(name, dbBorrowers);
        if (!match) {
            console.log(`   ❌ Could not match Excel member "${name}" in DB.`);
            return;
        }

        // Regular savings carry forward opening balance
        if (prevSavings > 0) {
            savingsInserts.push({
                id: crypto.randomUUID(),
                borrower_id: match.db.id,
                type: 'opening_balance',
                amount: prevSavings,
                reference_id: 'SAV-OB-2025',
                date: new Date('2024-12-31T23:59:59.000Z').toISOString(),
                notes: `Historical 2024 savings opening balance from Excel sheet`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                deleted_at: null
            });
        }
    });

    console.log(`   Prepared ${savingsInserts.length} Savings transactions to insert.`);

    // 6. DB Updates Execution
    if (!DRY_RUN) {
        console.log('\n🧹 Cleaning up old duplicate CBU and savings migration records in production DB...');
        
        // Clear only the migration/opening balances
        const { error: delCbuErr } = await supabase
            .from('app_share_capital_transactions')
            .delete()
            .or('transaction_type.eq.Migration Balance,reference_number.eq.CBU-OB-2025');
        if (delCbuErr) throw delCbuErr;

        const { error: delSavErr } = await supabase
            .from('app_savings_transactions')
            .delete()
            .eq('reference_id', 'SAV-OB-2025');
        if (delSavErr) throw delSavErr;

        console.log('   Cleaned old records.');

        // Insert new CBU
        if (cbuInserts.length > 0) {
            console.log(`💾 Inserting ${cbuInserts.length} CBU records...`);
            const { error: insCbuErr } = await supabase.from('app_share_capital_transactions').insert(cbuInserts);
            if (insCbuErr) throw insCbuErr;
            console.log('   CBU records inserted.');
        }

        // Insert new Savings
        if (savingsInserts.length > 0) {
            console.log(`💾 Inserting ${savingsInserts.length} Savings records...`);
            const { error: insSavErr } = await supabase.from('app_savings_transactions').insert(savingsInserts);
            if (insSavErr) throw insSavErr;
            console.log('   Savings records inserted.');
        }

        console.log('\n✅ Database update successfully completed!');
    } else {
        console.log('\n🔎 [Dry Run] Would delete duplicate CBU/Savings transactions and insert the new matched records.');
    }
}

main().catch(console.error);
