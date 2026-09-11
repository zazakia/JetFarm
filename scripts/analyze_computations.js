const xlsx = require('xlsx');

function analyzeComputations() {
    const workbook = xlsx.readFile('./agap docs/COLLECTION SHEET.xlsx');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
    
    let subHeaderRowIdx = -1;
    for (let i = 0; i < 20; i++) {
        if (rawData[i] && rawData[i].includes('NAME OF BORROWER')) {
            subHeaderRowIdx = i + 1;
            break;
        }
    }
    
    let count = 0;
    
    for (let r = subHeaderRowIdx + 50; r < subHeaderRowIdx + 100; r++) {
        const row = rawData[r];
        if (!row) continue;
        
        const name = row[0];
        if (!name || typeof name !== 'string' || name.toLowerCase().includes('total')) continue;
        
        const loanAmount = parseFloat(row[3]) || 0;
        const weeklyPayment = parseFloat(row[11]) || 0;
        
        if (loanAmount > 0 && weeklyPayment > 0) {
            const expectedWeeklyWithout10 = (loanAmount * 1.4) / 20;
            const expectedWeeklyWith10 = expectedWeeklyWithout10 + 10;
            
            console.log(`Borrower: ${name}`);
            console.log(`  Loan Amount: ${loanAmount}`);
            console.log(`  Weekly Payment: ${weeklyPayment}`);
            console.log(`  Formula Match (40% interest / 20 + 10): ${Math.abs(expectedWeeklyWith10 - weeklyPayment) < 1 ? 'YES' : 'NO (Expected: ' + expectedWeeklyWith10 + ')'}`);
            console.log('----------------------------');
            
            count++;
        }
        if (count >= 5) break;
    }
}

analyzeComputations();
