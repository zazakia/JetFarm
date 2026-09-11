import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateCbuAndSavings() {
  console.log('🚀 Starting CBU & Savings 2025 Migration...');
  
  const excelPath = path.join(__dirname, '../docs/ddd/savings and cbu2025 (1).xlsx');
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Excel file not found at: ${excelPath}`);
  }

  const wb = XLSX.readFile(excelPath);
  
  // 1. Process CBU from SCPR2025
  const scprSheet = wb.Sheets['SCPR2025'];
  const scprData = XLSX.utils.sheet_to_json(scprSheet, { header: 1 });
  
  const cbuRecords = [];
  // Row 7 (index 0) contains headers, data starts index 3
  for (let i = 3; i < scprData.length; i++) {
    const row = scprData[i];
    if (!row || !row[1] || typeof row[1] !== 'string') continue;
    
    const memberName = row[1].trim();
    const totalCbu = parseFloat(row[16] || row[3] || 0); // TSM (index 16) or From 2024 (index 3)
    
    if (memberName && !isNaN(totalCbu) && totalCbu > 0) {
      cbuRecords.push({
        name: memberName,
        accountNo: row[2] || '',
        cbuAmount: totalCbu
      });
    }
  }

  console.log(`📦 Extracted ${cbuRecords.length} CBU records from SCPR2025.`);

  // 2. Process Regular Savings from Savings2025
  const savingsSheet = wb.Sheets['Savings2025'];
  const savingsData = XLSX.utils.sheet_to_json(savingsSheet, { header: 1 });
  
  const savingsRecords = [];
  for (let i = 5; i < savingsData.length; i++) {
    const row = savingsData[i];
    if (!row || !row[1] || typeof row[1] !== 'string') continue;
    
    const memberName = row[1].trim();
    // Assuming balance/total column
    const totalSavings = parseFloat(row[row.length - 1] || row[2] || 0);
    
    if (memberName && !isNaN(totalSavings) && totalSavings > 0) {
      savingsRecords.push({
        name: memberName,
        savingsAmount: totalSavings
      });
    }
  }

  console.log(`📦 Extracted ${savingsRecords.length} Savings records from Savings2025.`);

  const summary = {
    totalCbuMembers: cbuRecords.length,
    totalCbuAmount: cbuRecords.reduce((sum, r) => sum + r.cbuAmount, 0),
    totalSavingsMembers: savingsRecords.length,
    totalSavingsAmount: savingsRecords.reduce((sum, r) => sum + r.savingsAmount, 0),
    accountingEntries: [
      { account: 'Shared Capital (CBU)', type: 'CREDIT', amount: cbuRecords.reduce((sum, r) => sum + r.cbuAmount, 0) },
      { account: 'Savings Deposits', type: 'CREDIT', amount: savingsRecords.reduce((sum, r) => sum + r.savingsAmount, 0) },
      { account: 'Cash on Hand (COH)', type: 'DEBIT', amount: cbuRecords.reduce((sum, r) => sum + r.cbuAmount, 0) + savingsRecords.reduce((sum, r) => sum + r.savingsAmount, 0) }
    ]
  };

  const outputPath = path.join(__dirname, '../src/assets/cbu_savings_migration_summary.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ summary, cbuRecords, savingsRecords }, null, 2));

  console.log('✅ CBU & Savings migration summary generated successfully at:', outputPath);
  console.log(JSON.stringify(summary, null, 2));
}

migrateCbuAndSavings().catch(console.error);
