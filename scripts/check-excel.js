const xlsx = require('xlsx');

function checkFile(filePath) {
    console.log(`\n--- Checking ${filePath} ---`);
    try {
        const workbook = xlsx.readFile(filePath);
        
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            if (data.length > 0) {
                console.log(`\nSheet '${sheetName}' (First 6 rows):`);
                for (let i = 0; i < 6 && i < data.length; i++) {
                    console.log(`Row ${i}:`, data[i]);
                }
            }
        }
    } catch (err) {
        console.error('Error reading file:', err.message);
    }
}

checkFile('d:/GitHub/POS Cursor/docs poscursor/2025-LOANERS.xlsx');
checkFile('d:/GitHub/POS Cursor/docs poscursor/MEMBERSHIP REGISTRY and SHARE AND TRANSFER BOOK.xls2025.xls');
