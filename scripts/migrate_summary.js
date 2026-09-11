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
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function excelDateToJSDate(serial) {
  if (!serial || isNaN(serial)) return null;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);

  const fractional_day = serial - Math.floor(serial) + 0.0000001;
  let total_seconds = Math.floor(86400 * fractional_day);
  const seconds = total_seconds % 60;
  total_seconds -= seconds;
  const hours = Math.floor(total_seconds / (60 * 60));
  const minutes = Math.floor(total_seconds / 60) % 60;

  const dateObj = new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
  if (dateObj.getFullYear() > 2100 || dateObj.getFullYear() < 1900) return null;
  return dateObj;
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
    return {
      first: first,
      last: last,
      full: cleanName
    };
  }
}

async function migrate() {
  console.log('Starting SUMMARY.xlsx migration...');
  const workbook = xlsx.readFile('./docs/SUMMARY.xlsx');
  const sheet = workbook.Sheets['SUMMARY'];
  
  // The first row is the header, but it's empty sometimes, let's use range starting from row 1 (0-indexed)
  const rawData = xlsx.utils.sheet_to_json(sheet, { defval: null });

  console.log(`Found ${rawData.length} rows in SUMMARY sheet.`);

  // 1. Map Collectors
  const collectorNames = [...new Set(rawData.map(r => r['Collector Assigned']).filter(Boolean))];
  const collectorMap = {};

  const { data: existingCollectors } = await supabase.from('app_collectors').select('*');
  for (const name of collectorNames) {
    let coll = existingCollectors?.find(c => c.full_name?.toLowerCase() === name.toLowerCase());
    if (!coll) {
      console.log(`Creating new collector: ${name}`);
      const { data, error } = await supabase.from('app_collectors').insert({
        id: crypto.randomUUID(),
        full_name: name,
        is_active: true
      }).select().single();
      
      if (error) {
        console.error(`Failed to insert collector ${name}: ${error.message}`);
        continue;
      }
      coll = data;
    }
    collectorMap[name] = coll.id;
  }

  // 2. Fetch Existing Borrowers and Loans to prevent duplicates
  const seenBorrowers = new Map();
  const { data: dbBorrowers } = await supabase.from('app_borrowers').select('id, full_name');
  if (dbBorrowers) {
    dbBorrowers.forEach(b => {
      seenBorrowers.set(b.full_name.toLowerCase(), b.id);
    });
  }

  const seenLoans = new Set();
  const { data: dbLoans } = await supabase.from('app_loans').select('loan_number, borrower_id');
  if (dbLoans) {
    dbLoans.forEach(l => seenLoans.add(`${l.borrower_id}-${l.loan_number}`));
  }

  const borrowersToInsert = [];
  const borrowersToUpdate = [];
  const loansToInsert = [];

  let count = 0;
  for (const row of rawData) {
    count++;
    
    // Map Excel Columns
    const memberId = row['Member ID']?.toString().trim();
    const fullNameRaw = row['Full Name']?.toString().trim();
    
    if (!fullNameRaw) continue;

    const gender = row['Gender']?.toString() || null;
    let birthDate = row['Birthdate'];
    if (typeof birthDate === 'number') {
        birthDate = excelDateToJSDate(birthDate)?.toISOString() || null;
    } else if (typeof birthDate === 'string' && !isNaN(Date.parse(birthDate))) {
        const d = new Date(birthDate);
        birthDate = (d.getFullYear() > 1900 && d.getFullYear() < 2100) ? d.toISOString() : null;
    } else {
        birthDate = null;
    }
    
    const contactNo = row['Contact No.']?.toString() || null;
    const barangay = row['Baranggay']?.toString() || null;
    const address = row['Complete Address']?.toString() || null;
    const sourceOfIncome = row['Source of Income']?.toString() || null;
    
    let dateJoined = row['Date Joined'];
    if (typeof dateJoined === 'number') dateJoined = excelDateToJSDate(dateJoined)?.getTime();
    else if (typeof dateJoined === 'string' && !isNaN(Date.parse(dateJoined))) dateJoined = new Date(dateJoined).getTime();
    else dateJoined = null;
    
    const membershipStatus = row['Membership Status']?.toString() || null;
    const collectorAssigned = row['Collector Assigned']?.toString() || null;
    const cycle = parseInt(row['Cycle']) || null;
    
    let loanAmountRaw = row['Loan Amount']?.toString() || '';
    loanAmountRaw = loanAmountRaw.replace(/[₱,]/g, '').trim();
    const loanAmount = parseFloat(loanAmountRaw) || 0;

    const { first, last, full: clientName } = splitName(fullNameRaw);
    const nameKey = clientName.toLowerCase();

    let borrowerId;
    let isNewBorrower = false;
    
    if (seenBorrowers.has(nameKey)) {
        borrowerId = seenBorrowers.get(nameKey);
    } else {
        // Check queued
        const existingQueued = borrowersToInsert.find(b => b.full_name.toLowerCase() === nameKey);
        if (existingQueued) {
            borrowerId = existingQueued.id;
        } else {
            borrowerId = crypto.randomUUID();
            isNewBorrower = true;
            borrowersToInsert.push({
                id: borrowerId,
                full_name: clientName,
                first_name: first,
                last_name: last,
                gender: gender,
                date_of_birth: birthDate,
                phone: contactNo,
                area: barangay,
                address: address,
                collector_id: collectorMap[collectorAssigned],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            seenBorrowers.set(nameKey, borrowerId);
        }
    }

    // 3. Prepare Loans
    if (loanAmount > 0) {
        // We need a loan number. Let's use Member ID + Cycle or a random uuid prefix
        const loanNumber = memberId ? `LN-${memberId}-C${cycle || 1}` : `LN-DAILY-${count.toString().padStart(4, '0')}`;
        const loanKey = `${borrowerId}-${loanNumber}`;
        
        if (!seenLoans.has(loanKey)) {
            // Add loan
            loansToInsert.push({
                id: crypto.randomUUID(),
                borrower_id: borrowerId,
                loan_number: loanNumber,
                principal_amount: loanAmount,
                interest_rate: 0, // Default to 0 since not provided
                interest_type: 'flat',
                term: 40, // Default to 40 weeks
                term_unit: 'weeks',
                frequency: 'weekly',
                total_amount: loanAmount, // Assuming no interest
                installment_amount: loanAmount / 40,
                status: 'active',
                collector_id: collectorMap[collectorAssigned],
                cycle: cycle,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            seenLoans.add(loanKey);
        }
    }
  }

  // 4. Batch Inserts
  if (borrowersToInsert.length > 0) {
    console.log(`Inserting ${borrowersToInsert.length} new borrowers...`);
    for (let i = 0; i < borrowersToInsert.length; i += 50) {
        const { error } = await supabase.from('app_borrowers').insert(borrowersToInsert.slice(i, i + 50));
        if (error) {
            console.error(`Error inserting borrowers: ${error.message}`);
            throw error;
        }
    }
  } else {
    console.log("No new borrowers to insert.");
  }

  if (loansToInsert.length > 0) {
    console.log(`Inserting ${loansToInsert.length} new loans...`);
    for (let i = 0; i < loansToInsert.length; i += 50) {
        const { error } = await supabase.from('app_loans').insert(loansToInsert.slice(i, i + 50));
        if (error) {
            console.error(`Error inserting loans: ${error.message}`);
            throw error;
        }
    }
  } else {
    console.log("No new loans to insert.");
  }

  console.log("Migration from SUMMARY.xlsx Complete!");
}

migrate().catch(err => { console.error(err); process.exit(1); });
