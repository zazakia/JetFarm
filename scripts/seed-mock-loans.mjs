import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env'), override: false });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedMockData() {
    console.log('Seeding mock data for Active Loans Collection report verification...');
    console.log(`URL: ${supabaseUrl}`);

    // 1. Get collectors
    const { data: collectors, error: collError } = await supabase.from('app_collectors').select('*');
    if (collError) {
        console.error('Error fetching collectors:', collError.message);
        return;
    }
    
    if (!collectors || collectors.length < 2) {
        console.error(`Found only ${collectors?.length || 0} collectors. Need at least 2. Run seed-collectors.mjs first.`);
        return;
    }

    const c1 = collectors[0];
    const c2 = collectors[1];

    console.log(`Using collectors: ${c1.full_name} and ${c2.full_name}`);

    // 2. Create mock borrowers
    const b1Id = uuidv4();
    const b2Id = uuidv4();

    const { error: bError } = await supabase.from('app_borrowers').upsert([
        { id: b1Id, full_name: 'Mock Client 1', address: 'Address 1', is_active: true },
        { id: b2Id, full_name: 'Mock Client 2', address: 'Address 2', is_active: true },
    ]);
    
    if (bError) {
        console.error('Error seeding borrowers:', bError.message);
        return;
    }

    // 3. Create mock loans
    const l1Id = uuidv4();
    const l2Id = uuidv4();

    const now = new Date().toISOString();

    const { error: lError } = await supabase.from('app_loans').upsert([
        { 
            id: l1Id, 
            borrower_id: b1Id, 
            collector_id: c1.id, 
            principal_amount: 10000, 
            total_amount: 12000, 
            status: 'active',
            release_date: now,
            loan_number: 'L-MOCK-1'
        },
        { 
            id: l2Id, 
            borrower_id: b2Id, 
            collector_id: c2.id, 
            principal_amount: 5000, 
            total_amount: 6000, 
            status: 'active',
            release_date: now,
            loan_number: 'L-MOCK-2'
        },
    ]);
    
    if (lError) {
        console.error('Error seeding loans:', lError.message);
        return;
    }

    console.log('Mock seeding complete!');
}

seedMockData();
