const xlsx = require('xlsx');

function migrate() {
    const workbook = xlsx.readFile('./data/DCM-as-of-march-21 - Copy.xlsx');
    const sheet = workbook.Sheets['DATA of Clients'];
    const rawData = xlsx.utils.sheet_to_json(sheet, { range: 11 });

    const susanRecords = rawData.filter(r => r['Name Of Client']?.toString().includes('Susan B. Guevarra'));
    if (susanRecords.length > 0) {
        console.log('--- Susan B. Guevarra Data ---');
        susanRecords.forEach((r, i) => {
            console.log(`Record ${i + 1}:`);
            console.log(JSON.stringify(r, null, 2));
        });
    } else {
        console.log('Susan B. Guevarra not found');
    }
}

migrate();
