const xlsx = require('xlsx');

async function verify() {
  const workbook = xlsx.readFile('DCM-as-of-march-21.xlsx');
  const sheet = workbook.Sheets["DATA of Clients"];
  const data = xlsx.utils.sheet_to_json(sheet, { range: 11, defval: null });
  
  let mismatches = 0;
  let matches = 0;
  let totalBalanceDiff = 0;

  let computedBalancesSum = 0;
  let excelBalancesSum = 0;

  const dateHeaderPattern = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;

  for (const row of data) {
    if (!row || !row['Name Of Client'] || row['Name Of Client'] === 'Total') continue;

    const excelName = row['Name Of Client'].toString().trim();
    
    const principal = parseFloat(row['Loan Amount']) || 0;
    const interest = parseFloat(row['Interest']) || 0;
    const excelBalance = parseFloat(row['Total Loan Balance']) || 0;

    let totalPayments = 0;
    for (const key of Object.keys(row)) {
        if (dateHeaderPattern.test(key)) {
            const val = parseFloat(row[key]);
            if (!isNaN(val) && val > 0) totalPayments += val;
        }
    }
    
    // As per migration discussion, total loan was treated as principal + interest
    const computedBalance = (principal + interest) - totalPayments;
    
    computedBalancesSum += computedBalance;
    excelBalancesSum += excelBalance;
    
    // allow a 2 peso difference due to rounding
    if (Math.abs(computedBalance - excelBalance) > 2) {
       mismatches++;
       totalBalanceDiff += Math.abs(computedBalance - excelBalance);
       if (mismatches < 10) {
          console.log(`Mismatch for ${excelName}: Excel says ${excelBalance.toFixed(2)}, Computed says ${computedBalance.toFixed(2)} (Principal: ${principal}, Int: ${interest}, Payments: ${totalPayments})`);
       }
    } else {
       matches++;
    }
  }
  
  console.log(`\nVerification complete:`);
  console.log(`${matches} loans matching perfectly or within 2 pesos.`);
  console.log(`${mismatches} loans have a mismatched balance.`);
  if (mismatches > 0) {
    console.log(`Average difference for mismatches: ${(totalBalanceDiff / mismatches).toFixed(2)}`);
  }
  console.log(`Total Computed Balance Error Spread: Sum of Computed=${computedBalancesSum.toFixed(2)} vs Sum of Excel=${excelBalancesSum.toFixed(2)}`);
}

verify().catch(console.error);
