const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function excelDateToJSDate(serial) {
  if (!serial || isNaN(serial)) return null;
  const utc_days  = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;                                        
  const date_info = new Date(utc_value * 1000);
  
  const fractional_day = serial - Math.floor(serial) + 0.0000001;
  let total_seconds = Math.floor(86400 * fractional_day);
  const seconds = total_seconds % 60;
  total_seconds -= seconds;
  const hours = Math.floor(total_seconds / (60 * 60));
  const minutes = Math.floor(total_seconds / 60) % 60;
  
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
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
    console.log('Starting migration...');
    const workbook = xlsx.readFile('./DCM-as-of-march-21.xlsx');
    const sheet = workbook.Sheets['DATA of Clients'];
    const rawData = xlsx.utils.sheet_to_json(sheet, { range: 11 });

    console.log(`Found ${rawData.length} rows.`);

    // 1. Map Collectors
    const collectorNames = [...new Set(rawData.map(r => r['Collector 1']).filter(Boolean))];
    const collectorMap = {};

    const { data: existingCollectors } = await supabase.from('app_collectors').select('*');
    for (const name of collectorNames) {
        let coll = existingCollectors?.find(c => c.full_name?.toLowerCase().includes(name.toLowerCase()));
        if (!coll) {
            const { data, error } = await supabase.from('app_collectors').insert({ 
                id: crypto.randomUUID(),
                full_name: name, 
                is_active: true 
            }).select().single();
            if (error) throw new Error(`Failed to insert collector ${name}: ${error.message}`);
            coll = data;
        }
        collectorMap[name] = coll.id;
    }

    // 2. Fetch or Create Borrowers
    const seenBorrowers = new Map();
    const { data: dbBorrowers } = await supabase.from('app_borrowers').select('id, full_name');
    if (dbBorrowers) {
        dbBorrowers.forEach(b => seenBorrowers.set(b.full_name.toLowerCase(), b.id));
    }

    // New: Fetch existing loan numbers to avoid duplicates
    const seenLoans = new Set();
    const { data: dbLoans } = await supabase.from('app_loans').select('loan_number');
    if (dbLoans) {
        dbLoans.forEach(l => seenLoans.add(l.loan_number));
    }

    const loansToInsert = [];
    const borrowersToCreate = [];

    let count = 0;
    for (const row of rawData) {
        count++;
        const clientNameRaw = row['Name Of Client']?.toString().trim();
        if (!clientNameRaw || clientNameRaw === 'Total' || clientNameRaw === 'Name Of Client') continue;

        const { first, last, full: clientName } = splitName(clientNameRaw);
        const nameKey = clientName.toLowerCase();

        let borrowerId;
        if (seenBorrowers.has(nameKey)) {
            borrowerId = seenBorrowers.get(nameKey);
        } else {
            // Check if we already queued this one in this run
            const existingQueued = borrowersToCreate.find(b => b.full_name.toLowerCase() === nameKey);
            if (existingQueued) {
                borrowerId = existingQueued.id;
            } else {
                borrowerId = crypto.randomUUID();
                borrowersToCreate.push({
                    id: borrowerId,
                    full_name: clientName,
                    first_name: first,
                    last_name: last,
                    address: row['Address'] || null,
                    phone: row['Cell Number']?.toString() || null,
                    business: row['Business'] || null,
                    co_maker_name: row['Co Maker name'] || null,
                    collector_id: collectorMap[row['Collector 1']],
                    group: 'Daily',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            }
        }
        seenBorrowers.set(nameKey, borrowerId);

        // 3. Prepare Loans
        let releaseDate = row['Date Releae'] || row['Date Release'];
        let maturityDate = row['End Date'];
        if (typeof releaseDate === 'number') releaseDate = excelDateToJSDate(releaseDate)?.toISOString();
        else if (typeof releaseDate === 'string' && !isNaN(Date.parse(releaseDate))) releaseDate = new Date(releaseDate).toISOString();
        else releaseDate = null;

        if (typeof maturityDate === 'number') maturityDate = excelDateToJSDate(maturityDate)?.toISOString();
        else if (typeof maturityDate === 'string' && !isNaN(Date.parse(maturityDate))) maturityDate = new Date(maturityDate).toISOString();
        else maturityDate = null;

        const loanAmount = parseFloat(row['Loan Amount']) || 0;
        const dailyInstallment = parseFloat(row['Daily ']) || parseFloat(row['Daily']) || 0;
        const totalPayment = parseFloat(row['Total Payment ']) || parseFloat(row['Total Payment']) || 0;
        const totalLoan = parseFloat(row['Total Loan']) || 0;
        const interestAmount = parseFloat(row['Interest']) || 0;
        const insurance = parseFloat(row['Insurance']) || 0;
        
        const loanNumber = `LN-DAILY-${count.toString().padStart(4, '0')}`;
        if (seenLoans.has(loanNumber)) continue;

        loansToInsert.push({
            id: crypto.randomUUID(),
            borrower_id: borrowerId,
            loan_number: loanNumber,
            principal_amount: loanAmount,
            interest_rate: loanAmount > 0 ? (interestAmount / loanAmount) * 100 : 0,
            interest_type: 'flat',
            term: parseInt(row['Days']) || 40,
            term_unit: 'days',
            frequency: 'daily',
            total_amount: totalLoan,
            installment_amount: dailyInstallment,
            insurance_amount: insurance,
            deducted_amount: interestAmount + insurance,
            release_date: releaseDate,
            maturity_date: maturityDate,
            collector_id: collectorMap[row['Collector 1']],
            status: (parseFloat(row['Total Loan Balance']) || 0) <= 0 ? 'paid' : 'active',
            batch: parseInt(row['Batch']) || null,
            cycle: parseInt(row['Cycle']) || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            _rawRow: row
        });
    }

    // 4. Rollover (Reloan) Detection Logic
    console.log('Detecting loan rollovers...');
    const loansByBorrower = {};
    loansToInsert.forEach(l => {
        if (!loansByBorrower[l.borrower_id]) loansByBorrower[l.borrower_id] = [];
        loansByBorrower[l.borrower_id].push(l);
    });

    const rolloverPayments = [];
    for (const borrowerId of Object.keys(loansByBorrower)) {
        const borrowerLoans = loansByBorrower[borrowerId].sort((a, b) => 
            new Date(a.release_date || 0) - new Date(b.release_date || 0)
        );

        for (let i = 1; i < borrowerLoans.length; i++) {
            const currentLoan = borrowerLoans[i];
            const previousLoan = borrowerLoans[i - 1];

            const rawRow = currentLoan._rawRow;
            const netLoanProceeds = parseFloat(rawRow['Net Loan']) || 0;
            const previousBalance = parseFloat(previousLoan._rawRow['Total Loan Balance']) || 0;
            const insuranceCurrent = parseFloat(rawRow['Insurance']) || 0;

            // Formula: New Principal - Previous Balance (Rollover) ≈ Net Release
            // We allow for a small epsilon and also check for insurance deduction scenarios
            const expectedNetIfRollover = currentLoan.principal_amount - previousBalance;
            const diff = Math.abs(expectedNetIfRollover - netLoanProceeds);

            if (diff < 5 || Math.abs(diff - insuranceCurrent) < 5) {
                console.log(`Rollover detected: Loan ${previousLoan.loan_number} -> ${currentLoan.loan_number}`);
                previousLoan.status = 'paid';
                currentLoan.is_reloan = true;
                currentLoan.previous_loan_id = previousLoan.id;

                if (previousBalance > 0) {
                    rolloverPayments.push({
                        id: crypto.randomUUID(),
                        loan_id: previousLoan.id,
                        amount: previousBalance,
                        payment_date: currentLoan.release_date,
                        collector_id: currentLoan.collector_id,
                        notes: `Rollover clearing from Loan ${currentLoan.loan_number}`,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });
                }
            }
        }
    }

    // 5. Batch Inserts
    if (borrowersToCreate.length > 0) {
        console.log(`Inserting ${borrowersToCreate.length} new borrowers...`);
        for (let i = 0; i < borrowersToCreate.length; i += 50) {
            const { error } = await supabase.from('app_borrowers').insert(borrowersToCreate.slice(i, i + 50));
            if (error) {
                console.error(`Error inserting borrowers: ${error.message}`);
                throw error;
            }
        }
    }

    console.log(`Inserting ${loansToInsert.length} loans...`);
    const cleanLoans = loansToInsert.map(l => {
        const { _rawRow, ...rest } = l;
        return rest;
    });
    for (let i = 0; i < cleanLoans.length; i += 50) {
        const { error } = await supabase.from('app_loans').insert(cleanLoans.slice(i, i + 50));
        if (error) {
            console.error(`Error inserting loans: ${error.message}`);
            throw error;
        }
    }

    // 6. Payments
    console.log('Processing payments...');
    const paymentsToInsert = [...rolloverPayments];
    const dateHeaderPattern = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
    for (const loan of loansToInsert) {
        const row = loan._rawRow;
        for (const key of Object.keys(row)) {
            if (dateHeaderPattern.test(key)) {
                const val = parseFloat(row[key]);
                if (!isNaN(val) && val > 0) {
                    paymentsToInsert.push({
                        id: crypto.randomUUID(),
                        loan_id: loan.id,
                        amount: val,
                        payment_date: new Date(key).toISOString(),
                        collector_id: loan.collector_id,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });
                }
            }
        }
    }

    console.log(`Inserting ${paymentsToInsert.length} payments...`);
    for (let i = 0; i < paymentsToInsert.length; i += 50) {
        const { error } = await supabase.from('app_payments').insert(paymentsToInsert.slice(i, i + 50));
        if (error) {
            console.error(`Error inserting payments: ${error.message}`);
            throw error;
        }
    }

    console.log("Migration Complete!");
}

migrate().catch(err => { console.error(err); process.exit(1); });
