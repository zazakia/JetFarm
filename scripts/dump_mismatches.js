require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const workbook = xlsx.readFile('DCM-as-of-march-21.xlsx');
    const sheet = workbook.Sheets['DATA of Clients'];
    const rawData = xlsx.utils.sheet_to_json(sheet, { range: 11, defval: null });

    const { data: dbLoans } = await supabase.from('app_loans').select('id, loan_number, total_amount');
    
    let allPayments = [];
    let page = 0;
    while(true) {
        const {data} = await supabase.from('app_payments').select('loan_id, amount').range(page*1000, (page+1)*1000-1);
        if(!data || data.length === 0) break;
        allPayments = allPayments.concat(data);
        page++;
    }

    let count = 0;
    let printed = 0;
    for (const row of rawData) {
        count++;
        const clientNameStr = String(row['Name Of Client']).trim();
        if (!clientNameStr) continue;

        const excelBalanceStr = row['Total Loan Balance'];
        if (typeof excelBalanceStr === 'string' && excelBalanceStr.trim().toLowerCase() === 'fullpaid') continue;
        const excelBalance = parseFloat(excelBalanceStr) || 0;

        const loanNumber = `LN-DAILY-${count.toString().padStart(4, '0')}`;
        const dbLoan = dbLoans.find(l => l.loan_number === loanNumber);

        if (!dbLoan) continue;

        const sumPaid = allPayments.filter(p => p.loan_id === dbLoan.id).reduce((s, p) => s + p.amount, 0);
        const dbComputedBalance = Math.max(0, dbLoan.total_amount - sumPaid);

        const diff = excelBalance - dbComputedBalance;
        if (Math.abs(diff) > 1) {
            console.log(`${clientNameStr} (${loanNumber}): TotalAmt=${dbLoan.total_amount}, Paid=${sumPaid}, DbBal=${dbComputedBalance}, ExcelBal=${excelBalance}, Diff=${diff}`);
            printed++;
            if (printed >= 15) break; 
        }
    }
}
run();
