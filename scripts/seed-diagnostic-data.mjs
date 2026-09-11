import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const collectorEmail = 'collector2@poscursor.com';
  const userCredential = process.env.DEFAULT_SEED_PASSWORD || 'password123';
  
  console.log('--- Seeding collector2 ---');
  
  // 1. Create/Get Auth User
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: collectorEmail,
    password: userCredential,
    options: { data: { full_name: 'Collector Two' } }
  });

  let collectorId;
  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log('User already exists in Auth. Signing in to get ID...');
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: collectorEmail,
        password: userCredential
      });
      if (signInError) {
        console.error('Sign in failed:', signInError.message);
        return;
      }
      collectorId = signInData.user.id;
    } else {
      console.error('Auth Error:', authError.message);
      return;
    }
  } else {
    collectorId = authData.user.id;
  }

  console.log(`Collector ID: ${collectorId}`);

  // 2. Upsert User Profile
  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert({
      id: collectorId,
      full_name: 'Collector Two',
      email: collectorEmail,
      role: 'collector',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  if (profileError) {
    console.error('Profile Error:', profileError.message);
    return;
  }

  // 3. Create Borrowers
  const borrowerId = uuidv4();
  console.log(`Creating Borrower: ${borrowerId}`);
  const { error: borrowerError } = await supabase
    .from('borrowers')
    .insert({
      id: borrowerId,
      full_name: 'Diagnostic Borrower 1',
      collector_id: collectorId,
      area: 'Dagupan City',
      route_index: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  if (borrowerError) {
    console.error('Borrower Error:', borrowerError.message);
    return;
  }

  // 4. Create Active Loan
  const loanId = uuidv4();
  console.log(`Creating Loan: ${loanId}`);
  const { error: loanError } = await supabase
    .from('loans')
    .insert({
      id: loanId,
      borrower_id: borrowerId,
      collector_id: collectorId,
      loan_number: 'DIAG-001',
      principal_amount: 5000,
      total_amount: 6000,
      installment_amount: 200,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  if (loanError) {
    console.error('Loan Error:', loanError.message);
    return;
  }

  // 5. Create Payment Schedules
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  const schedules = [
    {
      id: uuidv4(),
      loan_id: loanId,
      due_date: yesterday.toISOString(),
      scheduled_amount: 200,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: uuidv4(),
      loan_id: loanId,
      due_date: today.toISOString(),
      scheduled_amount: 200,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: uuidv4(),
      loan_id: loanId,
      due_date: tomorrow.toISOString(),
      scheduled_amount: 200,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  console.log('Creating Schedules...');
  const { error: schedulesError } = await supabase
    .from('payment_schedules')
    .insert(schedules);

  if (schedulesError) {
    console.error('Schedules Error:', schedulesError.message);
    return;
  }

  console.log('--- Seeding Complete Successfully ---');
}

run();
