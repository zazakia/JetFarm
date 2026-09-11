const xlsx = require('xlsx');

function inspectExcel(filePath) {
    console.log(`Inspecting ${filePath}...`);
    const wb = xlsx.readFile(filePath);
    console.log("Sheet Names:", wb.SheetNames);
    
    for (const sheetName of wb.SheetNames) {
        console.log(`\n--- Sheet: ${sheetName} ---`);
        const ws = wb.Sheets[sheetName];
        const range = xlsx.utils.decode_range(ws['!ref']);
        console.log(`Range: ${ws['!ref']}`);
        
        // Print the first 10 rows
        for (let r = 0; r <= Math.min(10, range.e.r); r++) {
            let rowData = [];
            for (let c = 0; c <= Math.min(30, range.e.c); c++) {
                const cell = ws[xlsx.utils.encode_cell({ r, c })];
                rowData.push(cell ? cell.v : null);
            }
            console.log(`Row ${r}:`, rowData);
        }
    }
}

inspectExcel('docs/SUMMARY.xlsx');
