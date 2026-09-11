const ExcelJS = require('exceljs');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

function normalize(name) {
    if (!name) return '';
    return name.toString().toLowerCase()
        .replace(/\./g, ' ')
        .replace(/,/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function buildMap() {
    console.log('Building Mapping Table...');
    
    // 1. Fetch all Supabase loans and borrowers
    const { data: borrowers } = await supabase.from('app_borrowers').select('id, full_name');
    const bMap = {};
    if (borrowers) borrowers.forEach(b => bMap[b.id] = b.full_name);

    const { data: loans } = await supabase.from('app_loans').select('id, loan_number, borrower_id, total_amount, status');
    if (!loans) return;
    
    // 2. Parse Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('DCM-as-of-march-21.xlsx');
    const sheet = workbook.getWorksheet('DATA of Clients');

    const excelRows = [];
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber < 13) return;
        const name = row.getCell(1).value;
        if (!name || name === 'Total') return;
        const bal = row.getCell(19).value;
        const balVal = (bal && bal.result !== undefined) ? bal.result : bal;
        excelRows.push({
            rowNumber,
            name: name.toString(),
            nameNorm: normalize(name),
            balance: parseFloat(balVal) || 0,
            fill: row.getCell(1).style.fill
        });
    });

    console.log(`Excel: ${excelRows.length} rows. DB: ${loans.length} loans.`);

    const mapping = [];
    let exactMatches = 0;
    
    for (const loan of loans) {
        if (!loan.loan_number) continue;
        const sbName = normalize(bMap[loan.borrower_id]);
        
        const matches = excelRows.filter(r => r.nameNorm === sbName);
        
        if (matches.length === 1) {
            mapping.push({ loan_id: loan.id, loan_num: loan.loan_number, excelRow: matches[0].rowNumber, name: matches[0].name });
            exactMatches++;
        } else if (matches.length > 1) {
            const numPart = parseInt(loan.loan_number.split('-')[2]) || 0;
            const expectedRow = numPart + 15;
            const best = matches.sort((a,b) => Math.abs(a.rowNumber - expectedRow) - Math.abs(b.rowNumber - expectedRow))[0];
            mapping.push({ loan_id: loan.id, loan_num: loan.loan_number, excelRow: best.rowNumber, name: best.name });
            exactMatches++;
        }
    }

    console.log(`Matched ${exactMatches} loans.`);
    fs.writeFileSync('loan_mapping.json', JSON.stringify({ mapping, excelRows }, null, 2));
    console.log('Saved mapping to loan_mapping.json');
}

buildMap().catch(console.error);
