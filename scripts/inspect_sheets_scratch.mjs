import xlsx from 'xlsx';
import path from 'path';

const docsDir = './docs poscursor';

function inspect(file) {
    console.log(`\n================ INSPECTING ${file} ================`);
    const wb = xlsx.readFile(path.join(docsDir, file));
    console.log('Sheets:', wb.SheetNames);
    for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`\nSheet: ${sheetName} | Total Rows: ${data.length}`);
        // print first 10 rows
        for (let i = 0; i < Math.min(10, data.length); i++) {
            console.log(`Row ${i}:`, data[i]?.slice(0, 15));
        }
    }
}

inspect('MEMBERSHIP REGISTRY and SHARE AND TRANSFER BOOK.xls2025.xls');
inspect('2024-LOANERS.xlsx');
inspect('2025-LOANERS.xlsx');
