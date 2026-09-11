const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function parseLoanProducts() {
  console.log('Reading Loan Products from Weekly-Collection (1) (1).xlsx...');
  const workbook = xlsx.readFile('Weekly-Collection (1) (1).xlsx');
  
  const products = {
    new: [],
    reloan: []
  };

  const newSheet = workbook.Sheets['New Loan'];
  if (newSheet) {
    const rows = xlsx.utils.sheet_to_json(newSheet, { header: 1 });
    rows.slice(3).forEach(row => {
      if (row[0]) {
        products.new.push({
          amount: parseFloat(row[0]),
          weeklyPrincipal: parseFloat(row[1]),
          weeklyDeposit: parseFloat(row[2]),
          weeklyInsurance: parseFloat(row[3]),
          weeklyTotal: parseFloat(row[4]),
          totalRepayment: parseFloat(row[5]),
          interest: parseFloat(row[6]),
          equity: parseFloat(row[7])
        });
      }
    });
  }

  const reloanSheet = workbook.Sheets['Reloan'];
  if (reloanSheet) {
    const rows = xlsx.utils.sheet_to_json(reloanSheet, { header: 1 });
    rows.slice(3).forEach(row => {
      if (row[0]) {
        products.reloan.push({
          amount: parseFloat(row[0]),
          weeklyPrincipal: parseFloat(row[1]),
          weeklyDeposit: parseFloat(row[2]),
          weeklyInsurance: parseFloat(row[3]),
          weeklyTotal: parseFloat(row[5]),
          totalRepayment: parseFloat(row[6]),
          interest: parseFloat(row[7])
        });
      }
    });
  }

  return products;
}

async function importAll() {
  const loanProducts = await parseLoanProducts();
  console.log(`Parsed ${loanProducts.new.length} New Loan products and ${loanProducts.reloan.length} Reloan products.`);

  console.log('Reading Weekly Clients.xlsx...');
  const workbook = xlsx.readFile('Weekly Clients.xlsx');
  const sheet = workbook.Sheets['Sheet1'];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  const borrowers = [];
  let currentGroup = '';

  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const firstCell = String(row[0] || '').trim();
    if (firstCell && !row[1] && !row[2]) {
      currentGroup = firstCell;
      continue;
    }
    if (firstCell === 'BORROWERS' || firstCell === 'NAME' || firstCell === 'NAME OF BORROWERS' || firstCell === 'Name Of Client') continue;

    if (row[1] || row[2]) {
      const fullName = row[0] || '';
      const address = row[1] || '';
      const rawBirthdate = row[2];
      const cellNumber = row[3] || '';
      const coMaker = row[4] || '';
      const business = row[5] || '';

      let dateOfBirth = null;
      if (rawBirthdate) {
        if (typeof rawBirthdate === 'number') {
          const date = new Date((rawBirthdate - 25569) * 86400 * 1000);
          dateOfBirth = date.toISOString();
        } else {
          try {
            const date = new Date(rawBirthdate);
            if (!isNaN(date.getTime())) {
              dateOfBirth = date.toISOString();
            }
          } catch (e) {}
        }
      }

      let lastName = '';
      let firstName = '';
      if (fullName.includes(',')) {
        [lastName, firstName] = fullName.split(',').map(s => s.trim());
      } else {
        const parts = fullName.split(' ');
        lastName = parts[parts.length - 1];
        firstName = parts.slice(0, -1).join(' ');
      }

      borrowers.push({
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        address: address,
        phone: String(cellNumber),
        date_of_birth: dateOfBirth,
        co_maker_name: coMaker,
        business: business,
        group: currentGroup,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  }

  console.log(`Parsed ${borrowers.length} borrowers.`);

  if (borrowers.length > 0) {
    console.log('Clearing existing data...');
    await supabase.from('app_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('app_payment_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('app_loans').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('app_borrowers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    const { data: insertedBorrowers, error: bError } = await supabase.from('app_borrowers').insert(borrowers).select();
    if (bError) {
      console.error('Error inserting borrowers:', bError.message);
      return;
    }
    console.log(`Inserted ${insertedBorrowers.length} borrowers.`);

    const loans = [];
    const defaultProduct = loanProducts.new.find(p => p.amount === 5000) || loanProducts.new[0];

    for (const borrower of insertedBorrowers) {
      const releaseDate = new Date();
      releaseDate.setDate(releaseDate.getDate() - 7);

      loans.push({
        borrower_id: borrower.id,
        principal_amount: defaultProduct.amount,
        interest_rate: (defaultProduct.interest / defaultProduct.amount) * 100,
        total_amount: defaultProduct.totalRepayment,
        installment_amount: defaultProduct.weeklyTotal,
        deposit_amount: defaultProduct.weeklyDeposit,
        insurance_amount: defaultProduct.weeklyInsurance,
        release_date: releaseDate.toISOString(),
        status: 'active',
        frequency: 'weekly',
        term: 24,
        term_unit: 'weeks',
        interest_type: 'flat',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    const { data: insertedLoans, error: lError } = await supabase.from('app_loans').insert(loans).select();
    if (lError) {
      console.error('Error inserting loans:', lError.message);
    } else {
      console.log(`Created ${insertedLoans.length} loans.`);
      
      const schedules = [];
      for (const loan of insertedLoans) {
        for (let i = 1; i <= 24; i++) {
          const dueDate = new Date(loan.release_date);
          dueDate.setDate(dueDate.getDate() + (i * 7));
          
          schedules.push({
            loan_id: loan.id,
            due_date: dueDate.toISOString(),
            scheduled_amount: defaultProduct.weeklyTotal,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      }

      const chunkSize = 100;
      for (let i = 0; i < schedules.length; i += chunkSize) {
        const chunk = schedules.slice(i, i + chunkSize);
        const { error: sError } = await supabase.from('app_payment_schedules').insert(chunk);
        if (sError) console.error('Error inserting schedules chunk:', sError.message);
      }
      console.log('Data import complete.');
    }
  }
}

importAll().catch(console.error);
