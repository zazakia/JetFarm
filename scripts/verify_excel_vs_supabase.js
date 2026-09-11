const xlsx = require('xlsx');

function verify() {
    console.log('--- Starting Verification ---');
    
    // 1. Read Excel Data
    console.log('Reading Excel file...');
    const workbook = xlsx.readFile('./DCM-as-of-march-21.xlsx');
    const sheet = workbook.Sheets['DATA of Clients'];
    const rawData = xlsx.utils.sheet_to_json(sheet, { range: 11 });

    const seenBorrowers = new Set();
    let excelValidLoans = 0;
    let excelTotalPrincipal = 0;
    let excelPaymentCount = 0;
    let excelTotalPayments = 0;
    const dateHeaderPattern = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;

    for (const row of rawData) {
        // EXACT behavior of the original migrate_excel.js inside the loans/borrowers loop
        if (!row['Name Of Client']) continue;
        
        const clientName = row['Name Of Client']?.toString().trim();
        if (clientName === 'Total' || clientName === 'Grand Total' || clientName === 'Name Of Client') continue;

        const nameKey = clientName.toLowerCase();
        seenBorrowers.add(nameKey);

        excelValidLoans++;
        excelTotalPrincipal += parseFloat(row['Loan Amount']) || 0;

        for (const key of Object.keys(row)) {
            if (dateHeaderPattern.test(key)) {
                const val = parseFloat(row[key]);
                if (!isNaN(val) && val > 0) {
                    excelPaymentCount++;
                    excelTotalPayments += val;
                }
            }
        }
    }

    console.log('\n--- Excel Source Stats ---');
    console.log(`Unique Names Found: ${seenBorrowers.size} (Raw names extracted before deduplication/merging)`);
    console.log(`Total Valid Loans: ${excelValidLoans}`);
    console.log(`Total Loan Principal: ${excelTotalPrincipal}`);
    console.log(`Total individual payment instances: ${excelPaymentCount}`);
    console.log(`Total sum of payments: ${excelTotalPayments}`);

    console.log('\nStatus: COMPLETE');
}

verify();
