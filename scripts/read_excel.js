const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('data/brayan Import migration cleanup.xlsx');
const ws = wb.Sheets['DATA of Clients'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

// Row 2 (index 2) is the header
const header = data[2];
console.log('Headers:', JSON.stringify(header.slice(0, 20)));

// Extract loan data starting from row 3
const loans = [];
for (let i = 3; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue; // skip empty rows
    
    const name = row[0];
    if (typeof name !== 'string' || name.trim() === '') continue;
    // Skip summary/total rows
    if (name.toLowerCase().includes('total') || name.toLowerCase().includes('batch')) continue;
    
    const address = row[1] || '';
    const totalLoanBalance = row[2]; // Column C - "Total Loan Balance" (first occurrence)
    const coMaker = row[3] || '';
    const business = row[4] || '';
    const collector = row[5] || '';
    const days = row[6];
    const batch = row[7];
    const cycle = row[8];
    const dateRelease = row[9];
    const endDate = row[10];
    const loanAmount = row[11]; // "Loan Amount"
    const daily = row[12]; // "Daily"
    const interest = row[13]; // "Interest"
    const totalPayment = row[14]; // "Total Payment"
    const netLoan = row[15]; // "Net Loan"
    const insurance = row[16]; // "Insurance"
    const totalLoan = row[17]; // "Total Loan" (principal + interest)
    const totalLoanBalance2 = row[18]; // Column S - second "Total Loan Balance"
    
    loans.push({
        name: name.toString().trim(),
        address: (address || '').toString().trim(),
        collector: (collector || '').toString().trim(),
        loan_amount: loanAmount,
        total_loan: totalLoan,
        total_loan_balance: totalLoanBalance2 !== undefined ? totalLoanBalance2 : totalLoanBalance,
        daily_installment: daily,
        batch,
        cycle
    });
}

console.log('Total loans extracted:', loans.length);

// Group by collector
const byCollector = {};
for (const l of loans) {
    const c = l.collector || 'Unknown';
    if (!byCollector[c]) byCollector[c] = [];
    byCollector[c].push(l);
}

for (const [c, list] of Object.entries(byCollector)) {
    console.log(c + ': ' + list.length + ' loans');
}

fs.writeFileSync('excel_loans.json', JSON.stringify(loans, null, 2));
console.log('Saved to excel_loans.json');
