const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function excelDateToJSDate(serial) {
  if (!serial || isNaN(serial)) return null;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  const dateObj = new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
  if (dateObj.getFullYear() > 2100 || dateObj.getFullYear() < 1900) return null;
  return dateObj;
}

function parseHeaderDate(headerStr) {
    if (!headerStr) return null;
    const currentYear = new Date().getFullYear();
    const str = headerStr.toString().trim();
    // Parse things like "March 2-6" -> "March 2 2026"
    const match = str.match(/([A-Za-z]+)\s+(\d+)/);
    if (match) {
        const d = new Date(`${match[1]} ${match[2]}, ${currentYear}`);
        if (!isNaN(d.getTime())) return d;
    }
    return null;
}

function splitName(fullName) {
  if (!fullName) return { first: '', last: '', full: '' };
  const cleanName = fullName.trim();
  if (cleanName.includes(',')) {
    const parts = cleanName.split(',').map(p => p.trim());
    return {
      last: parts[0],
      first: parts[1],
      full: `${parts[1]} ${parts[0]}`.trim().replace(/\s+/g, ' ')
    };
  } else {
    const parts = cleanName.split(/\s+/);
    if (parts.length === 1) return { first: parts[0], last: '', full: parts[0] };
    const last = parts.pop();
    const first = parts.join(' ');
    return { first: first, last: last, full: cleanName };
  }
}

async function migrate() {
  console.log('Starting COLLECTION SHEET.xlsx migration...');
  const workbook = xlsx.readFile('./agap docs/COLLECTION SHEET.xlsx');
  
  // We process the first sheet
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
  console.log(`Found ${rawData.length} rows in ${sheetName}.`);

  // Find header rows
  let mainHeaderRowIdx = -1;
  let subHeaderRowIdx = -1;
  
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
      if (rawData[i] && rawData[i].includes('NAME OF BORROWER')) {
          mainHeaderRowIdx = i;
          subHeaderRowIdx = i + 1;
          break;
      }
  }

  if (mainHeaderRowIdx === -1) {
      console.error("Could not find header row with 'NAME OF BORROWER'");
      process.exit(1);
  }

  const mainHeaders = rawData[mainHeaderRowIdx];
  const subHeaders = rawData[subHeaderRowIdx];
  
  const colMap = {
      name: mainHeaders.indexOf('NAME OF BORROWER'),
      id: mainHeaders.indexOf('ID NO.'),
      address: mainHeaders.indexOf('ADDRESS'),
      loanAmount: mainHeaders.indexOf('LOAN AMOUNT'),
      releaseDate: mainHeaders.indexOf('RELEASE DATE'),
      maturityDate: mainHeaders.indexOf('MATURITY DATE'),
      cycle: mainHeaders.indexOf('NO. OF CYCLE'),
      weeklyPayment: mainHeaders.indexOf('WEEKLY PAYMENT'),
      totalDue: mainHeaders.indexOf('TOTAL DUE'),
  };

  // Payment columns start where subHeaders have string values (like "March 2-6")
  const paymentCols = [];
  for (let c = colMap.totalDue + 1; c < subHeaders.length; c++) {
      if (typeof subHeaders[c] === 'string' || typeof subHeaders[c] === 'number') {
          paymentCols.push({ index: c, header: subHeaders[c] });
      }
  }

  const { data: dbBorrowers } = await supabase.from('app_borrowers').select('id, full_name');
  const seenBorrowers = new Map();
  if (dbBorrowers) {
    dbBorrowers.forEach(b => seenBorrowers.set(b.full_name.toLowerCase(), b.id));
  }

  const { data: dbLoans } = await supabase.from('app_loans').select('loan_number, borrower_id');
  const seenLoans = new Set();
  if (dbLoans) {
    dbLoans.forEach(l => seenLoans.add(`${l.borrower_id}-${l.loan_number}`));
  }

  const borrowersToInsert = [];
  const loansToInsert = [];
  const paymentsToInsert = [];

  let count = 0;
  for (let r = subHeaderRowIdx + 1; r < rawData.length; r++) {
      const row = rawData[r];
      if (!row) continue;
      
      const fullNameRaw = row[colMap.name]?.toString().trim();
      if (!fullNameRaw) continue;

      count++;
      
      const address = row[colMap.address]?.toString() || null;
      let loanAmountRaw = row[colMap.loanAmount]?.toString() || '';
      loanAmountRaw = loanAmountRaw.replace(/[₱,]/g, '').trim();
      const loanAmount = parseFloat(loanAmountRaw) || 0;
      
      const cycle = parseInt(row[colMap.cycle]) || null;
      const weeklyPayment = parseFloat(row[colMap.weeklyPayment]) || 0;
      
      let releaseDate = row[colMap.releaseDate];
      if (typeof releaseDate === 'number') releaseDate = excelDateToJSDate(releaseDate)?.toISOString() || null;
      else if (typeof releaseDate === 'string' && !isNaN(Date.parse(releaseDate))) {
          const d = new Date(releaseDate);
          releaseDate = (d.getFullYear() > 1900 && d.getFullYear() < 2100) ? d.toISOString() : null;
      } else releaseDate = null;
      
      let maturityDate = row[colMap.maturityDate];
      if (typeof maturityDate === 'number') maturityDate = excelDateToJSDate(maturityDate)?.toISOString() || null;
      else if (typeof maturityDate === 'string' && !isNaN(Date.parse(maturityDate))) {
          const d = new Date(maturityDate);
          maturityDate = (d.getFullYear() > 1900 && d.getFullYear() < 2100) ? d.toISOString() : null;
      } else maturityDate = null;

      const { first, last, full: clientName } = splitName(fullNameRaw);
      const nameKey = clientName.toLowerCase();

      let borrowerId;
      if (seenBorrowers.has(nameKey)) {
          borrowerId = seenBorrowers.get(nameKey);
      } else {
          const existingQueued = borrowersToInsert.find(b => b.full_name.toLowerCase() === nameKey);
          if (existingQueued) {
              borrowerId = existingQueued.id;
          } else {
              borrowerId = crypto.randomUUID();
              borrowersToInsert.push({
                  id: borrowerId,
                  full_name: clientName,
                  first_name: first,
                  last_name: last,
                  address: address,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
              });
              seenBorrowers.set(nameKey, borrowerId);
          }
      }

      let loanId = null;
      if (loanAmount > 0) {
          const loanNumber = `LNW-${count.toString().padStart(4, '0')}-C${cycle || 1}`;
          const loanKey = `${borrowerId}-${loanNumber}`;
          
          if (!seenLoans.has(loanKey)) {
              loanId = crypto.randomUUID();
              loansToInsert.push({
                  id: loanId,
                  borrower_id: borrowerId,
                  loan_number: loanNumber,
                  principal_amount: loanAmount,
                  interest_rate: 0,
                  interest_type: 'flat',
                  term: 4, // Unknown, defaulting to 4 weeks based on weekly
                  term_unit: 'weeks',
                  frequency: 'weekly',
                  total_amount: loanAmount,
                  installment_amount: weeklyPayment > 0 ? weeklyPayment : (loanAmount / 4),
                  release_date: releaseDate,
                  maturity_date: maturityDate,
                  status: 'active',
                  cycle: cycle,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
              });
              seenLoans.add(loanKey);
          }
      }

      // Extract payments
      if (loanId) {
          for (const pc of paymentCols) {
              const paymentAmtRaw = row[pc.index];
              if (!paymentAmtRaw) continue;
              const paymentAmt = parseFloat(paymentAmtRaw.toString().replace(/[₱,]/g, ''));
              
              if (paymentAmt > 0) {
                  let paymentDate = parseHeaderDate(pc.header);
                  if (typeof pc.header === 'number') {
                      paymentDate = excelDateToJSDate(pc.header);
                  }
                  
                  paymentsToInsert.push({
                      id: crypto.randomUUID(),
                      loan_id: loanId,
                      amount: paymentAmt,
                      payment_date: paymentDate ? paymentDate.toISOString() : (releaseDate || new Date().toISOString()),
                      notes: `Extracted from column ${pc.header}`,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                  });
              }
          }
      }
  }

  // Batch Inserts
  if (borrowersToInsert.length > 0) {
    console.log(`Inserting ${borrowersToInsert.length} new borrowers...`);
    for (let i = 0; i < borrowersToInsert.length; i += 50) {
        const { error } = await supabase.from('app_borrowers').insert(borrowersToInsert.slice(i, i + 50));
        if (error) throw new Error(`Error inserting borrowers: ${error.message}`);
    }
  }

  if (loansToInsert.length > 0) {
    console.log(`Inserting ${loansToInsert.length} new loans...`);
    for (let i = 0; i < loansToInsert.length; i += 50) {
        const { error } = await supabase.from('app_loans').insert(loansToInsert.slice(i, i + 50));
        if (error) throw new Error(`Error inserting loans: ${error.message}`);
    }
  }

  if (paymentsToInsert.length > 0) {
    console.log(`Inserting ${paymentsToInsert.length} new payments...`);
    for (let i = 0; i < paymentsToInsert.length; i += 50) {
        const { error } = await supabase.from('app_payments').insert(paymentsToInsert.slice(i, i + 50));
        if (error) throw new Error(`Error inserting payments: ${error.message}`);
    }
  }

  console.log("Migration from COLLECTION SHEET.xlsx Complete!");
}

migrate().catch(err => { console.error(err); process.exit(1); });
