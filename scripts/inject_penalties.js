require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const EXCEL_FILE_PATH = 'DCM-as-of-march-21.xlsx';
const SHEET_NAME = 'DATA of Clients';

function excelSerialToDate(serial) {
    // Excel dates are number of days since Jan 1, 1900
    // Subtract 25569 to adjust to Unix epoch (Jan 1, 1970)
    // Multiply by 86400000 to convert to milliseconds
    return new Date((serial - 25569) * 86400000);
}

async function run() {
    console.log('Reading Excel file...');
    const workbook = xlsx.readFile(EXCEL_FILE_PATH);
    const sheet = workbook.Sheets[SHEET_NAME];
    
    if (!sheet) {
        throw new Error(`Sheet "${SHEET_NAME}" not found in Excel file`);
    }

    const excelData = xlsx.utils.sheet_to_json(sheet, { range: 11, defval: null });
    
    console.log(`Found ${excelData.length} total rows in Excel`);
    
    // Fetch all app_loans from Supabase (to get IDs and map back to Excel)
    console.log('Fetching loans from Supabase...');
    const { data: dbLoans, error: fetchError } = await supabase
        .from('app_loans')
        .select(`id, total_amount, borrower_id, loan_number`);

    if (fetchError) {
        console.error('Error fetching db loans:', fetchError);
        return;
    }

    console.log('Fetching borrowers from Supabase...');
    const { data: dbBorrowers, error: bError } = await supabase
        .from('app_borrowers')
        .select(`id, first_name, last_name`);
    
    if (bError) {
        console.error('Error fetching db borrowers:', bError);
        return;
    }

    // Join
    for(const l of dbLoans) {
        l.app_borrowers = dbBorrowers.find(b => b.id === l.borrower_id) || { first_name: '', last_name: '' };
    }

    console.log(`Fetched ${dbLoans.length} loans from DB. fetching payments...`);
     
    let allPayments = [];
    let page = 0;
    while(true) {
        const {data, error} = await supabase
            .from('app_payments')
            .select('loan_id, amount')
            .range(page*1000, (page+1)*1000 - 1);
        console.log(`Page ${page}: fetched ${data ? data.length : 0} payments`, error);
        if(error) {
             console.error('Error fetching payments:', error); return;
        }
        if(!data || data.length === 0) break;
        allPayments = allPayments.concat(data);
        page++;
    }

    console.log(`Fetched ${allPayments.length} payments. calculating mismatches...`);

    const pDismatches = []; // positive discrepancies (Excel > DB)

    let count = 0;
    for (const row of excelData) {
        try {
            count++;
            const clientNameStr = String(row['Name Of Client']).trim();
            if (!clientNameStr) continue;

            const loanAmount = parseFloat(row['Loan Amount']) || 0;
            const interestAmount = parseFloat(row['Interest']) || 0;
            const excelBalanceStr = row['Total Loan Balance'];
            if (typeof excelBalanceStr === 'string' && excelBalanceStr.trim().toLowerCase() === 'fullpaid') {
                 continue; // fully paid, balance is 0
            }

            const excelBalance = parseFloat(excelBalanceStr) || 0;

            const loanNumber = `LN-DAILY-${count.toString().padStart(4, '0')}`;

            // find DB loan
            const dbLoan = dbLoans.find(l => l.loan_number === loanNumber);

            if (!dbLoan) continue; // might be missing or already paid

            // calculate DB principal paid
            const dbPrincipalPaid = allPayments
                .filter(p => p.loan_id === dbLoan.id)
                .reduce((sum, p) => sum + p.amount, 0);
            
            const dbComputedBalance = Math.max(0, dbLoan.total_amount - dbPrincipalPaid);
            const diff = excelBalance - dbComputedBalance;

            // If Excel Balance > DB Computed Balance, we need to add a penalty
            if (diff > 1) { // diff > 1 peso
                pDismatches.push({
                    loanId: dbLoan.id,
                    dbComputedBalance,
                    excelBalance,
                    diff,
                    borrowerName: clientNameStr
                });
            }
        } catch(e) { /* ignore parse errors */ }
    }

    console.log(`Found ${pDismatches.length} loans where Excel Balance > DB Computed Balance (Requires Penalty Injection).`);

    const ts = Date.now();
    let injected = 0;

    for (const item of pDismatches) {
        const penaltyPayload = {
            loan_id: item.loanId,
            amount: item.diff,
            penalty_date: ts,
            reason: 'Excel Migration Gap (Penalty)',
            created_at: ts,
            updated_at: ts
        };

        const { error: insertError } = await supabase
            .from('app_loan_penalties')
            .insert([penaltyPayload]);

        if (insertError) {
            console.error(`Failed to inject penalty for ${item.borrowerName}:`, insertError.message);
        } else {
            console.log(`Injected penalty of PHP ${item.diff.toFixed(2)} for ${item.borrowerName} (${item.loanId})`);
            injected++;
        }
    }

    console.log(`\nSuccessfully injected ${injected}/${pDismatches.length} penalties.`);
}

run().catch(console.error);
