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
    return { last: parts[0], first: parts[1], full: `${parts[1]} ${parts[0]}`.trim().replace(/\s+/g, ' ') };
  } else {
    const parts = cleanName.split(/\s+/);
    if (parts.length === 1) return { first: parts[0], last: '', full: parts[0] };
    const last = parts.pop();
    const first = parts.join(' ');
    return { first: first, last: last, full: cleanName };
  }
}

function extractDateFromSheetName(name) {
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const lowerName = name.toLowerCase();
    for (const m of months) {
        if (lowerName.includes(m)) {
            const regex = new RegExp(`(${m}\\s+\\d{1,2},?\\s*\\d{4}|${m}\\s+\\d{1,2})`, 'i');
            const match = name.match(regex);
            if (match) {
                let dStr = match[1];
                if (!/\d{4}/.test(dStr)) dStr += ` ${new Date().getFullYear()}`;
                const d = new Date(dStr);
                if (!isNaN(d.getTime())) return d.getTime();
            }
        }
    }
    return 0; // Epoch for unknown
}

function extractGroupFromSheetName(name) {
    let clean = name.replace(/(january|february|march|april|may|june|july|august|september|october|november|december).*/i, '').trim();
    if (!clean) clean = name;
    if (clean.length > 50) clean = clean.substring(0, 50);
    return clean;
}

async function migrate() {
  console.log('Starting COMPLEX COLLECTION SHEET.xlsx migration...');
  
  console.log('Wiping previous test data...');
  await supabase.from('app_payments').delete().like('notes', 'Extracted from column%');
  await supabase.from('app_loans').delete().like('loan_number', 'LNW-%');
  
  const workbook = xlsx.readFile('./agap docs/COLLECTION SHEET.xlsx');
  
  const { data: dbBorrowers } = await supabase.from('app_borrowers').select('id, full_name, group');
  const dbBorrowerMap = new Map();
  if (dbBorrowers) {
    dbBorrowers.forEach(b => dbBorrowerMap.set(b.full_name.toLowerCase(), b));
  }

  const borrowerRecords = new Map();

  console.log('Parsing all sheets...');
  for (const sheetName of workbook.SheetNames) {
      const sheetDate = extractDateFromSheetName(sheetName);
      const sheetGroup = extractGroupFromSheetName(sheetName);
      const sheet = workbook.Sheets[sheetName];
      const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
      
      let nameColIdx = -1, addressColIdx = -1, loanAmtColIdx = -1, subHeaderRowIdx = -1;
      
      for (let i = 0; i < Math.min(20, rawData.length); i++) {
          if (rawData[i]) {
              const nameIdx = rawData[i].findIndex(v => typeof v === 'string' && (v.includes('NAME OF BORROWER') || v.includes('Name of Client')));
              if (nameIdx !== -1) {
                  nameColIdx = nameIdx;
                  addressColIdx = rawData[i].indexOf('ADDRESS');
                  loanAmtColIdx = rawData[i].findIndex(v => typeof v === 'string' && v.includes('LOAN AMOUNT'));
                  subHeaderRowIdx = i + 1;
                  break;
              }
          }
      }
      
      if (nameColIdx === -1) continue;

      const subHeaders = rawData[subHeaderRowIdx] || [];
      const paymentCols = [];
      for (let c = 0; c < subHeaders.length; c++) {
          if ((typeof subHeaders[c] === 'string' && /^[a-zA-Z]+\s+\d+/.test(subHeaders[c])) || typeof subHeaders[c] === 'number') {
              paymentCols.push({ index: c, header: subHeaders[c] });
          }
      }

      for (let r = subHeaderRowIdx + 1; r < rawData.length; r++) {
          const row = rawData[r];
          if (!row) continue;
          
          const val = row[nameColIdx];
          if (val && typeof val === 'string') {
              const name = val.trim();
              if (name.toLowerCase().includes('name') || name.toLowerCase().includes('total') || name.toLowerCase() === 'grand total') continue;
              
              const address = addressColIdx !== -1 ? row[addressColIdx] : null;
              let loanAmt = 0;
              if (loanAmtColIdx !== -1 && row[loanAmtColIdx]) {
                  loanAmt = parseFloat(row[loanAmtColIdx].toString().replace(/[₱,]/g, '')) || 0;
              }
              
              const payments = [];
              for (const pc of paymentCols) {
                  const amtRaw = row[pc.index];
                  if (amtRaw) {
                      const amt = parseFloat(amtRaw.toString().replace(/[₱,]/g, ''));
                      if (amt > 0) {
                          let pDate = parseHeaderDate(pc.header);
                          if (typeof pc.header === 'number') pDate = excelDateToJSDate(pc.header);
                          if (pDate) {
                              payments.push({ amount: amt, date: pDate, header: pc.header });
                          }
                      }
                  }
              }

              const { first, last, full } = splitName(name);
              const key = full.toLowerCase();
              
              if (!borrowerRecords.has(key)) {
                  borrowerRecords.set(key, {
                      full_name: full, first_name: first, last_name: last,
                      address: address, group: sheetGroup,
                      timeline: []
                  });
              } else {
                  // Update group to latest non-empty
                  if (sheetGroup && sheetGroup.length > borrowerRecords.get(key).group.length) {
                      borrowerRecords.get(key).group = sheetGroup;
                  }
              }
              
              borrowerRecords.get(key).timeline.push({
                  sheetDate, loanAmt, payments
              });
          }
      }
  }

  console.log(`Extracted data for ${borrowerRecords.size} unique borrowers. Mapping rollovers...`);
  
  const borrowersToInsert = [];
  const borrowersToUpdate = [];
  const loansToInsert = [];
  const paymentsToInsert = [];
  
  let newBorrowerCount = 0;
  let newLoanCount = 0;
  let rolloverCount = 0;
  let paymentCount = 0;

  for (const [key, data] of borrowerRecords.entries()) {
      let bId = crypto.randomUUID();
      const existing = dbBorrowerMap.get(key);
      if (existing) {
          bId = existing.id;
          if (existing.group !== data.group && data.group) {
              borrowersToUpdate.push({ id: bId, group: data.group });
          }
      } else {
          borrowersToInsert.push({
              id: bId, full_name: data.full_name, first_name: data.first_name, last_name: data.last_name,
              address: data.address, group: data.group,
              created_at: new Date().toISOString(), updated_at: new Date().toISOString()
          });
          newBorrowerCount++;
      }
      
      // Sort timeline chronologically
      data.timeline.sort((a, b) => a.sheetDate - b.sheetDate);
      
      let currentLoanAmt = null;
      let currentLoanId = null;
      let loanSeq = 1;
      let seenPaymentDates = new Set();
      
      for (const entry of data.timeline) {
          if (entry.loanAmt > 0) {
              if (currentLoanAmt === null || currentLoanAmt !== entry.loanAmt) {
                  // Rollover! or First loan
                  const prevLoanId = currentLoanId;
                  currentLoanId = crypto.randomUUID();
                  currentLoanAmt = entry.loanAmt;
                  seenPaymentDates = new Set();
                  
                  if (prevLoanId) rolloverCount++;
                  newLoanCount++;
                  
                  const loanNumber = `LNW-${newBorrowerCount.toString().padStart(4, '0')}-${loanSeq++}`;
                  
                  loansToInsert.push({
                      id: currentLoanId,
                      borrower_id: bId,
                      loan_number: loanNumber,
                      principal_amount: currentLoanAmt,
                      interest_rate: 0,
                      interest_type: 'flat',
                      term: 4, term_unit: 'weeks', frequency: 'weekly',
                      total_amount: currentLoanAmt,
                      installment_amount: currentLoanAmt / 4,
                      status: 'active',
                      is_reloan: prevLoanId !== null,
                      previous_loan_id: prevLoanId,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                  });
                  
                  // Mark previous as paid
                  if (prevLoanId) {
                      const pLoan = loansToInsert.find(l => l.id === prevLoanId);
                      if (pLoan) pLoan.status = 'paid';
                  }
              }
          }
          
          if (currentLoanId) {
              for (const p of entry.payments) {
                  const dateKey = p.date.toISOString().split('T')[0];
                  if (!seenPaymentDates.has(dateKey)) {
                      seenPaymentDates.add(dateKey);
                      paymentCount++;
                      paymentsToInsert.push({
                          id: crypto.randomUUID(),
                          loan_id: currentLoanId,
                          amount: p.amount,
                          payment_date: p.date.toISOString(),
                          notes: `Extracted from column ${p.header}`,
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString()
                      });
                  }
              }
          }
      }
  }

  // Execute inserts
  console.log(`Inserting ${borrowersToInsert.length} new borrowers...`);
  for (let i = 0; i < borrowersToInsert.length; i += 50) {
      const { error } = await supabase.from('app_borrowers').insert(borrowersToInsert.slice(i, i + 50));
      if (error) throw new Error(`Borrower insert error: ${error.message}`);
  }
  
  console.log(`Updating ${borrowersToUpdate.length} existing borrowers with groups...`);
  for (const b of borrowersToUpdate) {
      await supabase.from('app_borrowers').update({ group: b.group }).eq('id', b.id);
  }
  
  console.log(`Inserting ${loansToInsert.length} loans (including ${rolloverCount} rollovers)...`);
  for (let i = 0; i < loansToInsert.length; i += 50) {
      const { error } = await supabase.from('app_loans').insert(loansToInsert.slice(i, i + 50));
      if (error) throw new Error(`Loan insert error: ${error.message}`);
  }
  
  console.log(`Inserting ${paymentsToInsert.length} distinct payments...`);
  for (let i = 0; i < paymentsToInsert.length; i += 50) {
      const { error } = await supabase.from('app_payments').insert(paymentsToInsert.slice(i, i + 50));
      if (error) throw new Error(`Payment insert error: ${error.message}`);
  }

  console.log(`\n--- MIGRATION SUMMARY ---`);
  console.log(`Total Borrowers Processed: ${borrowerRecords.size}`);
  console.log(`New Borrowers Created: ${newBorrowerCount}`);
  console.log(`Existing Borrowers Updated: ${borrowersToUpdate.length}`);
  console.log(`Total Loans Created: ${newLoanCount}`);
  console.log(`Total Rollovers Detected: ${rolloverCount}`);
  console.log(`Total Unique Payments Extracted: ${paymentCount}`);
  console.log("Complex Migration Complete!");
}

migrate().catch(err => { console.error(err); process.exit(1); });
