import xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(process.cwd(), '.env.production') });


const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function excelDateToJSDate(serial) {
  if (!serial || isNaN(serial)) return null;
  if (typeof serial === 'string') {
      const parsed = Date.parse(serial);
      return isNaN(parsed) ? null : new Date(parsed);
  }
  const utc_days  = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;                                        
  const date_info = new Date(utc_value * 1000);
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), 0, 0, 0);
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

async function migrate() {
    console.log('Starting migration from docs poscursor files...');
    
    // 1. Parse Membership Registry
    const registryPath = path.join(process.cwd(), 'docs poscursor/MEMBERSHIP REGISTRY and SHARE AND TRANSFER BOOK.xls2025.xls');
    const registryWb = xlsx.readFile(registryPath);
    const registrySheet = registryWb.Sheets['2025'];
    const registryData = xlsx.utils.sheet_to_json(registrySheet, { header: 1 });
    
    const borrowersToCreate = [];
    const sharesToCreate = [];
    const nameToBorrowerId = {};
    
    // Data starts at row 3 (index 3)
    for (let i = 3; i < registryData.length; i++) {
        const row = registryData[i];
        if (!row || row.length === 0 || !row[1]) continue;
        
        const fullName = row[1]?.toString().trim();
        if (!fullName || fullName.toLowerCase() === 'full name of members' || fullName === 'NAME') continue;
        
        const { first, last, full: cleanName } = splitName(fullName);
        const borrowerId = crypto.randomUUID();
        nameToBorrowerId[cleanName.toLowerCase()] = borrowerId;
        nameToBorrowerId[last.toLowerCase()] = borrowerId; // Fallback for last name matching
        
        let dateAccepted = row[5];
        const dateAcceptedMs = dateAccepted ? (excelDateToJSDate(dateAccepted)?.getTime() || null) : null;
        const dateAcceptedIso = dateAcceptedMs ? new Date(dateAcceptedMs).toISOString() : null;
        
        let dateOfBirth = row[13];
        const dateOfBirthIso = dateOfBirth ? (excelDateToJSDate(dateOfBirth)?.toISOString() || null) : null;
        
        borrowersToCreate.push({
            id: borrowerId,
            full_name: cleanName,
            first_name: first,
            last_name: last,
            membership_number: row[3]?.toString() || null,
            tin_number: row[4]?.toString() || null,
            date_accepted: dateAcceptedMs || null,
            bod_resolution_number: row[6]?.toString() || null,
            membership_type: row[7]?.toString() || null,
            address: row[12]?.toString() || null,
            date_of_birth: dateOfBirthIso || null,
            gender: row[15]?.toString() === 'F' ? 'Female' : (row[15]?.toString() === 'M' ? 'Male' : null),
            civil_status: row[16]?.toString() || null,
            education_level: row[17]?.toString() || null,
            source_of_income: row[18]?.toString() || null,
            number_of_dependents: parseInt(row[19]) || 0,
            religion: row[20]?.toString() || null,
            salary: parseCurrency(row[21]),
            membership_status: row[22] ? 'Withdrawn' : 'Active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        
        // Shares
        const shareAmount = parseCurrency(row[11]); // Initial Paid-UP
        if (shareAmount > 0) {
            sharesToCreate.push({
                id: crypto.randomUUID(),
                member_id: borrowerId,
                transaction_type: 'deposit',
                share_type: 'initial',
                number_of_shares: parseInt(row[9]) || 0,
                par_value: parseCurrency(row[10]),
                amount: shareAmount,
                running_balance_shares: parseInt(row[9]) || 0,
                running_balance_amount: shareAmount,
                date: dateAcceptedMs || Date.now(),
                created_at: Date.now(),
                updated_at: Date.now()
            });
        }
    }
    
    // 2. Parse Loans (2025)
    const loansPath = path.join(process.cwd(), 'docs poscursor/2025-LOANERS.xlsx');
    const loansWb = xlsx.readFile(loansPath);
    
    const loansToInsert = [];
    const paymentsToInsert = [];
    
    const processLoanSheet = (sheetName) => {
        const sheet = loansWb.Sheets[sheetName];
        if (!sheet) return;
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        let count = 0;
        // Data usually starts at row 2 for 2025loaners
        for (let i = 2; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length === 0 || !row[1]) continue;
            
            const loanerName = row[1]?.toString().trim();
            if (!loanerName || loanerName === 'LOANER') continue;
            
            const { full: cleanName, last } = splitName(loanerName);
            let borrowerId = nameToBorrowerId[cleanName.toLowerCase()] || nameToBorrowerId[last.toLowerCase()];
            
            if (!borrowerId) {
                console.log(`Warning: Borrower ${loanerName} not found in registry. Creating new borrower...`);
                borrowerId = crypto.randomUUID();
                nameToBorrowerId[cleanName.toLowerCase()] = borrowerId;
                borrowersToCreate.push({
                    id: borrowerId,
                    full_name: cleanName,
                    first_name: splitName(loanerName).first,
                    last_name: splitName(loanerName).last,
                    membership_status: 'Active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            }
            
            count++;
            let dateFiled = row[3];
            if (dateFiled) dateFiled = excelDateToJSDate(dateFiled)?.toISOString();
            
            let dueDate = row[9];
            if (dueDate) dueDate = excelDateToJSDate(dueDate)?.toISOString();
            
            const loanGranted = parseCurrency(row[8]);
            if (loanGranted > 0) {
                const loanId = crypto.randomUUID();
                const loanNumber = `LN-${sheetName.replace('loaners', '')}-${count.toString().padStart(4, '0')}`;
                
                loansToInsert.push({
                    id: loanId,
                    borrower_id: borrowerId,
                    loan_number: loanNumber,
                    loan_type: row[2]?.toString() || null,
                    principal_amount: loanGranted,
                    interest_rate: 2, // 2% per mo
                    interest_type: 'flat',
                    term: parseInt(row[6]) || 0,
                    term_unit: 'months',
                    frequency: 'monthly',
                    total_amount: parseCurrency(row[12]) || loanGranted,
                    installment_amount: 0,
                    processing_fee: parseCurrency(row[4]) + parseCurrency(row[5]), // Service fee + filing fee
                    release_date: dateFiled || null,
                    maturity_date: dueDate || null,
                    status: (row[15]?.toString().toLowerCase() === 'paid') ? 'paid' : 'active',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
                
                const paymentMade = parseCurrency(row[13]);
                if (paymentMade > 0) {
                    paymentsToInsert.push({
                        id: crypto.randomUUID(),
                        loan_id: loanId,
                        borrower_id: borrowerId,
                        amount: paymentMade,
                        payment_date: new Date().toISOString(),
                        notes: 'Migrated payment',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });
                }
            }
        }
    };
    
    processLoanSheet('2024loaners');
    processLoanSheet('2025loaners');
    processLoanSheet('2026loaners');

    // Batch Inserts
    if (borrowersToCreate.length > 0) {
        console.log(`Inserting ${borrowersToCreate.length} borrowers...`);
        for (let i = 0; i < borrowersToCreate.length; i += 50) {
            const { error } = await supabase.from('app_borrowers').insert(borrowersToCreate.slice(i, i + 50));
            if (error) throw error;
        }
    }
    
    if (sharesToCreate.length > 0) {
        console.log(`Inserting ${sharesToCreate.length} shares...`);
        for (let i = 0; i < sharesToCreate.length; i += 50) {
            const { error } = await supabase.from('app_share_capital_transactions').insert(sharesToCreate.slice(i, i + 50));
            if (error) console.error("Error inserting shares:", error.message);
        }
    }

    if (loansToInsert.length > 0) {
        console.log(`Inserting ${loansToInsert.length} loans...`);
        let loanOk = 0, loanSkipped = 0;
        for (const loan of loansToInsert) {
            const { error } = await supabase.from('app_loans').insert(loan);
            if (error) {
                if (error.code === '23505') {
                    console.log(`  ~ Skipped duplicate loan for borrower ${loan.borrower_id} (${loan.loan_type})`);
                    loanSkipped++;
                } else {
                    console.error(`  ❌ Loan insert error: ${error.message}`);
                }
            } else {
                loanOk++;
            }
        }
        console.log(`  ✅ ${loanOk} inserted, ${loanSkipped} skipped (duplicate active loan constraint)`);
    }
    
    if (paymentsToInsert.length > 0) {
        console.log(`Inserting ${paymentsToInsert.length} payments...`);
        for (let i = 0; i < paymentsToInsert.length; i += 50) {
            const { error } = await supabase.from('app_payments').insert(paymentsToInsert.slice(i, i + 50));
            if (error) throw error;
        }
    }

    console.log("Migration Complete!");
}

migrate().catch(err => { console.error(err); process.exit(1); });
