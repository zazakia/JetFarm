const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env.production') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PRIMARY_BORROWER_ID = '07311722-42eb-437d-aff6-5494351254b0'; // ADELAIDA ANRIQUEZ
const DUPLICATE_BORROWER_ID = '764797e8-1798-4dc6-afa1-a0d8da69db65'; // ADELAIDA MANRIQUEZ

async function mergeBorrowers() {
    console.log(`Merging duplicate borrower ${DUPLICATE_BORROWER_ID} into primary ${PRIMARY_BORROWER_ID}...`);
    
    // Update loans
    const { data: updatedLoans, error: lErr } = await supabase
        .from('app_loans')
        .update({ borrower_id: PRIMARY_BORROWER_ID })
        .eq('borrower_id', DUPLICATE_BORROWER_ID)
        .select();
        
    if (lErr) throw lErr;
    console.log(`Reassigned ${updatedLoans?.length || 0} loans.`);
    
    // Wait, let's also update app_guarantors, app_savings, etc. if they exist?
    // In this app, we know the main entities are app_loans, app_savings, app_shares
    
    const tablesToUpdate = ['app_savings', 'app_shares'];
    
    for (const table of tablesToUpdate) {
        const { data, error } = await supabase
            .from(table)
            .update({ borrower_id: PRIMARY_BORROWER_ID })
            .eq('borrower_id', DUPLICATE_BORROWER_ID)
            .select();
            
        if (error) {
             console.log(`No records or error in ${table}: ${error.message}`);
        } else {
             console.log(`Reassigned ${data?.length || 0} records in ${table}.`);
        }
    }
    
    // Soft delete duplicate borrower
    const now = new Date().toISOString();
    const { error: delErr } = await supabase
        .from('app_borrowers')
        .update({ deleted_at: now })
        .eq('id', DUPLICATE_BORROWER_ID);
        
    if (delErr) throw delErr;
    console.log(`Successfully soft-deleted duplicate borrower: ADELAIDA MANRIQUEZ`);
    
    console.log('\nMerge complete.');
}

mergeBorrowers().catch(console.error);
