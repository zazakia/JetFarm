import xlsx from 'xlsx';
import path from 'path';

function excelDateToJSDate(serial) {
  if (!serial || isNaN(serial)) return null;
  if (typeof serial === 'string') {
      const parsed = Date.parse(serial);
      return isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  const utc_days  = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;                                        
  const date_info = new Date(utc_value * 1000);
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), 0, 0, 0).toISOString();
}

function parseCurrency(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  return parseFloat(str.toString().replace(/[^\d.-]/g, '')) || 0;
}

function splitName(fullName) {
    if (!fullName) return { first: '', last: '', full: '' };
    const cleanName = fullName.trim();
    if (cleanName.includes(',')) {
        const parts = cleanName.split(',').map(p => p.trim());
        return {
            last: parts[0],
            first: parts[1] || '',
            full: `${parts[1] || ''} ${parts[0]}`.trim().replace(/\s+/g, ' ')
        };
    } else {
        const parts = cleanName.split(/\s+/);
        if (parts.length === 1) return { first: parts[0], last: '', full: parts[0] };
        const last = parts.pop();
        const first = parts.join(' ');
        return {
            first: first,
            last: last,
            full: cleanName
        };
    }
}

async function dryRun() {
    console.log('--- DRY RUN MIGRATION ---');
    
    // 1. Parse Membership Registry
    const registryPath = path.join(process.cwd(), 'docs poscursor/MEMBERSHIP REGISTRY and SHARE AND TRANSFER BOOK.xls2025.xls');
    const registryWb = xlsx.readFile(registryPath);
    const registrySheet = registryWb.Sheets['2025'];
    const registryData = xlsx.utils.sheet_to_json(registrySheet, { header: 1 });
    
    const borrowers = [];
    const shares = [];
    const nameToBorrowerId = {};
    
    for (let i = 3; i < registryData.length; i++) {
        const row = registryData[i];
        if (!row || row.length === 0 || !row[1]) continue;
        
        const fullName = row[1]?.toString().trim();
        if (!fullName || fullName.toLowerCase() === 'full name of members' || fullName === 'NAME') continue;
        
        const { first, last, full: cleanName } = splitName(fullName);
        const borrowerId = `uuid-${borrowers.length + 1}`;
        nameToBorrowerId[cleanName.toLowerCase()] = borrowerId;
        nameToBorrowerId[last.toLowerCase()] = borrowerId;
        
        let dateAccepted = row[5] ? excelDateToJSDate(row[5]) : null;
        let dateOfBirth = row[13] ? excelDateToJSDate(row[13]) : null;
        
        borrowers.push({
            id: borrowerId,
            full_name: cleanName,
            membership_number: row[3]?.toString() || null,
            address: row[12]?.toString() || null,
            source_of_income: row[18]?.toString() || null,
            membership_status: row[22] ? 'Withdrawn' : 'Active',
        });
        
        const shareAmount = parseCurrency(row[11]); 
        if (shareAmount > 0) {
            shares.push({
                member_id: borrowerId,
                amount: shareAmount,
                number_of_shares: parseInt(row[9]) || 0
            });
        }
    }
    
    // 2. Parse Loans (2025-LOANERS.xlsx)
    const loansPath = path.join(process.cwd(), 'docs poscursor/2025-LOANERS.xlsx');
    const loansWb = xlsx.readFile(loansPath);
    
    const loans = [];
    const payments = [];
    
    const processLoanSheet = (sheetName) => {
        const sheet = loansWb.Sheets[sheetName];
        if (!sheet) return;
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        let count = 0;
        for (let i = 2; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0 || !row[1]) continue;
            
            const loanerName = row[1]?.toString().trim();
            if (!loanerName || loanerName === 'LOANER') continue;
            
            const { full: cleanName, last } = splitName(loanerName);
            let borrowerId = nameToBorrowerId[cleanName.toLowerCase()] || nameToBorrowerId[last.toLowerCase()];
            
            if (!borrowerId) {
                borrowerId = `new-uuid-${borrowers.length + 1}`;
                nameToBorrowerId[cleanName.toLowerCase()] = borrowerId;
                borrowers.push({
                    id: borrowerId,
                    full_name: cleanName,
                    notes: 'Created from Loans sheet (not in registry)'
                });
            }
            
            count++;
            const loanGranted = parseCurrency(row[8]);
            if (loanGranted > 0) {
                const loanId = `loan-${loans.length + 1}`;
                loans.push({
                    id: loanId,
                    borrower_id: borrowerId,
                    loan_type: row[2]?.toString() || null,
                    principal_amount: loanGranted,
                    status: (row[15]?.toString().toLowerCase() === 'paid') ? 'paid' : 'active',
                });
                
                const paymentMade = parseCurrency(row[13]);
                if (paymentMade > 0) {
                    payments.push({
                        loan_id: loanId,
                        amount: paymentMade
                    });
                }
            }
        }
    };
    
    processLoanSheet('2024loaners');
    processLoanSheet('2025loaners');
    processLoanSheet('2026loaners');

    console.log(`\n--- SUMMARY OF DATA TO BE MIGRATED ---`);
    console.log(`Total Borrowers: ${borrowers.length}`);
    console.log(`Total Initial Share Capital Deposits: ${shares.length}`);
    console.log(`Total Loans: ${loans.length}`);
    console.log(`Total Payments: ${payments.length}`);
    
    console.log(`\nSample Borrowers (first 3):`);
    console.log(borrowers.slice(0, 3));
    
    console.log(`\nSample Loans (first 3):`);
    console.log(loans.slice(0, 3));
    
    console.log(`\nSample Payments (first 3):`);
    console.log(payments.slice(0, 3));
}

dryRun().catch(console.error);
