const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'src', 'assets', 'migration_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

const targets = ['Florenda N. Cimene', 'Adrian Zuela', 'cimen', 'zuela'];

console.log('--- Analysing Borrowers ---');
for (const b of data.borrowers) {
    const nameLower = b.name.toLowerCase();
    if (targets.some(t => nameLower.includes(t.toLowerCase()))) {
        console.log(`Borrower: ${b.name}`);
        console.log(`Total Loans: ${b.loans.length}`);
        let activeCount = 0;
        b.loans.forEach((loan, idx) => {
            console.log(`  Loan [Row ${loan.rowOrigin}]:`);
            console.log(`    isPaid: ${loan.isPaid}  | excelBalance: ${loan.excelBalance}`);
            console.log(`    releaseDate: ${loan.releaseDate ? new Date(loan.releaseDate).toISOString() : 'None'}`);
            console.log(`    principal: ${loan.principal}`);
            if (!loan.isPaid) activeCount++;
        });
        console.log(`  Active Loans Count: ${activeCount}`);
        console.log('------------------------------');
    }
}
