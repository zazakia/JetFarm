import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

const envFiles = ['.env.local', '.env'];
for (const envFile of envFiles) {
    dotenv.config({ path: path.join(process.cwd(), envFile), override: false });
}

const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_5M4dWlm0T7kPWuYUARk4pQ_AHFDlwAK';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log('--- SAVINGS TRANSACTIONS TOTALS ---');
    const { data: savings, error: sErr } = await supabase.from('app_savings_transactions').select('type, amount');
    if (sErr) console.error(sErr);
    else {
        const byType = {};
        let total = 0;
        for (const tx of savings) {
            byType[tx.type] = (byType[tx.type] || { count: 0, sum: 0 });
            byType[tx.type].count++;
            byType[tx.type].sum += Number(tx.amount || 0);
            total += Number(tx.amount || 0);
        }
        console.log('Breakdown by type:', byType);
        console.log('Total amount in savings:', total);
    }

    console.log('\n--- SHARE CAPITAL (CBU) TRANSACTIONS TOTALS ---');
    const { data: cbu, error: cErr } = await supabase.from('app_share_capital_transactions').select('transaction_type, amount');
    if (cErr) console.error(cErr);
    else {
        const byType = {};
        let total = 0;
        for (const tx of cbu) {
            const type = tx.transaction_type;
            byType[type] = (byType[type] || { count: 0, sum: 0 });
            byType[type].count++;
            byType[type].sum += Number(tx.amount || 0);
            total += Number(tx.amount || 0);
        }
        console.log('Breakdown by type:', byType);
        console.log('Total amount in share capital:', total);
    }
}

main().catch(console.error);
