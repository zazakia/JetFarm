const xlsx = require('xlsx');

function checkDuplicates() {
    console.log('--- Checking all sheets in COLLECTION SHEET.xlsx ---');
    const workbook = xlsx.readFile('./agap docs/COLLECTION SHEET.xlsx');
    
    const allNames = [];
    const nameMap = new Map();

    for (const sheetName of workbook.SheetNames) {
        console.log(`\nProcessing Sheet: ${sheetName}`);
        const sheet = workbook.Sheets[sheetName];
        const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
        
        let nameColIdx = -1;
        
        // find header row
        for (let i = 0; i < Math.min(20, rawData.length); i++) {
            if (rawData[i]) {
                const idx = rawData[i].findIndex(v => typeof v === 'string' && (v.includes('NAME OF BORROWER') || v.includes('Name of Client')));
                if (idx !== -1) {
                    nameColIdx = idx;
                    break;
                }
            }
        }
        
        if (nameColIdx === -1) {
            console.log(`  -> Could not find Name column. Skipping.`);
            continue;
        }

        let sheetNamesCount = 0;
        for (let r = 0; r < rawData.length; r++) {
            const val = rawData[r][nameColIdx];
            if (val && typeof val === 'string') {
                const name = val.trim();
                // skip headers and empty or totals
                if (name.toLowerCase().includes('name') || name.toLowerCase().includes('total')) continue;
                
                sheetNamesCount++;
                allNames.push(name);
                
                const lowerName = name.toLowerCase();
                if (!nameMap.has(lowerName)) {
                    nameMap.set(lowerName, []);
                }
                nameMap.get(lowerName).push(sheetName);
            }
        }
        console.log(`  -> Found ${sheetNamesCount} potential borrower names.`);
    }

    console.log('\n--- Duplication Analysis ---');
    let duplicateCount = 0;
    for (const [name, sheets] of nameMap.entries()) {
        if (sheets.length > 1) {
            duplicateCount++;
            console.log(`"${name}" appears ${sheets.length} times (Sheets: ${sheets.join(', ')})`);
        }
    }
    
    console.log(`\nTotal unique names: ${nameMap.size}`);
    console.log(`Total duplicated names: ${duplicateCount}`);
}

checkDuplicates();
