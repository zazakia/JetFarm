import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateUnpaidLoans() {
  console.log('🚀 Starting Unpaid Loans 2026 Migration...');

  const excelPath = path.join(__dirname, '../docs/ddd/onDLLoaner2026 (2).xlsx');
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Excel file not found at: ${excelPath}`);
  }

  const wb = XLSX.readFile(excelPath);
  const loanRecords = [];

  for (const sheetName of ['OnDL2026', 'OnDL2025']) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

    for (let i = 7; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[1] || typeof row[1] !== 'string') continue;

      const dlNo = String(row[0] || '').trim();
      const borrowerName = String(row[1] || '').trim();
      const principal = parseFloat(row[4] || row[3] || 0);
      const interest = parseFloat(row[10] || row[9] || 0);
      const penalty = parseFloat(row[12] || row[11] || 0);
      const totalAmount = parseFloat(row[14] || row[13] || 0);
      const paymentMade = parseFloat(row[16] || row[15] || 0);
      const balanceToCollect = parseFloat(row[18] || row[17] || totalAmount - paymentMade);

      if (borrowerName && balanceToCollect > 0) {
        loanRecords.push({
          sourceSheet: sheetName,
          dlNo,
          borrowerName,
          principal,
          interest,
          penalty,
          totalAmount,
          paymentMade,
          balanceToCollect
        });
      }
    }
  }

  const totalUnpaidBalance = loanRecords.reduce((sum, r) => sum + r.balanceToCollect, 0);
  const totalPrincipal = loanRecords.reduce((sum, r) => sum + r.principal, 0);

  const summary = {
    totalUnpaidLoans: loanRecords.length,
    totalPrincipalAmount: totalPrincipal,
    totalBalanceToCollect: totalUnpaidBalance,
    accountingEntries: [
      { account: 'Loan Receivable', type: 'DEBIT', amount: totalUnpaidBalance },
      { account: 'Cash on Hand (COH)', type: 'CREDIT', amount: totalUnpaidBalance }
    ]
  };

  const outputPath = path.join(__dirname, '../src/assets/unpaid_loans_migration_summary.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ summary, loanRecords }, null, 2));

  console.log('✅ Unpaid Loans migration summary generated successfully at:', outputPath);
  console.log(JSON.stringify(summary, null, 2));
}

migrateUnpaidLoans().catch(console.error);
