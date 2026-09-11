const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');
require('dotenv').config();

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function mapCollectors() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('DCM-as-of-march-21.xlsx');

  // 1. Get Collectors
  const { data: collectors } = await supabase.from('app_collectors').select('id, full_name');
  const collectorMap = {};
  collectors.forEach(c => collectorMap[c.full_name.toLowerCase()] = c.id);

  // Define target mappings
  const sheets = {
    'JAYSON CAYANONG': collectorMap['jayson cayanong'],
    'CRIS JUNCO': collectorMap['cresencio junco'],
    'Gerald Gera': collectorMap['gerald gera']
  };

  console.log('--- MAPPING LOANS TO COLLECTORS ---');

  for (const [sheetName, collectorId] of Object.entries(sheets)) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      console.warn(`Sheet ${sheetName} not found!`);
      continue;
    }

    let names = [];
    sheet.eachRow((row, rn) => {
      if (rn < 12) return;
      const nameRaw = row.getCell(2).value;
      if (!nameRaw || nameRaw === 'Total' || nameRaw === 'Name Of Client') return;
      names.push(nameRaw.toString().trim());
    });

    console.log(`Mapping ${names.length} borrowers to ${sheetName}...`);

    for (const fullName of names) {
      const normalizedName = fullName.toLowerCase().trim();
      // Find borrower (using ilike for robustness)
      const { data: borrowers } = await supabase.from('app_borrowers')
        .select('id, full_name')
        .ilike('full_name', normalizedName);

      if (borrowers && borrowers.length > 0) {
        const bId = borrowers[0].id;
        // Update all active loans for this borrower
        const { data: updated, error } = await supabase.from('app_loans')
          .update({ collector_id: collectorId })
          .eq('borrower_id', bId)
          .eq('status', 'active')
          .select();
        
        if (error) {
          console.error(`Error updating loans for ${fullName}:`, error);
        } else if (updated.length > 0) {
          console.log(`  Mapped ${fullName} (${updated.length} loans)`);
        }
      } else {
        console.warn(`  Borrower NOT FOUND: ${fullName}`);
      }
    }
  }

  console.log('--- MAPPING COMPLETE ---');
}

mapCollectors();
