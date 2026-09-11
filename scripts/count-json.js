const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'src', 'assets', 'migration_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

let totalPrincipal = 0;
let numLoans = 0;
let numPayments = 0;
let totalPaymentsSum = 0;

for (const b of data.borrowers) {
    for (const l of b.loans) {
        numLoans++;
        totalPrincipal += l.principal;
        let pSum = 0;
        for (const p of l.payments) {
            numPayments++;
            pSum += p.amount;
        }
        totalPaymentsSum += pSum;
    }
}

console.log('--- EXCEL JSON AGGREGATES ---');
console.log(`Total Borrowers: ${data.borrowers.length}`);
console.log(`Total Loans: ${numLoans}`);
console.log(`Total Principal Issued: ₱${totalPrincipal.toLocaleString()}`);
console.log(`Total Payments Logged: ${numPayments}`);
console.log(`Total Cash Collected: ₱${totalPaymentsSum.toLocaleString()}`);
