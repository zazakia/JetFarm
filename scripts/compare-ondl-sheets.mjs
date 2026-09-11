import xlsx from 'xlsx';

const wb = xlsx.readFile('docs/ddd/onDLLoaner2026 (2).xlsx');

const s2025 = xlsx.utils.sheet_to_json(wb.Sheets['OnDL2025'], { header: 1 });
const s2026 = xlsx.utils.sheet_to_json(wb.Sheets['OnDL2026'], { header: 1 });

function extractLoans(rows, sheetName) {
  const list = [];
  for (let i = 7; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[1] || typeof row[1] !== 'string') continue;
    const dlNo = String(row[0] || '').trim();
    const name = String(row[1] || '').trim();
    if (!dlNo || dlNo.toUpperCase().includes('TOTAL') || name.toUpperCase().includes('TOTAL')) continue;
    
    const nums = row.filter(cell => typeof cell === 'number' || (typeof cell === 'string' && !isNaN(Number(cell.replace(/,/g, '')))));
    const principal = nums[0] || 0;
    const bal = nums[nums.length - 1] || principal;

    list.push({ sheet: sheetName, dlNo, name, principal, bal });
  }
  return list;
}

const list2025 = extractLoans(s2025, 'OnDL2025');
const list2026 = extractLoans(s2026, 'OnDL2026');

console.log(`OnDL2025 count: ${list2025.length}, Total Balance: ${list2025.reduce((s, x) => s + x.bal, 0)}`);
console.log(`OnDL2026 count: ${list2026.length}, Total Balance: ${list2026.reduce((s, x) => s + x.bal, 0)}`);

console.log('\n--- Comparing Borrower Names between OnDL2025 and OnDL2026 ---');
const names2025 = new Set(list2025.map(x => x.name.toUpperCase().trim()));
const names2026 = new Set(list2026.map(x => x.name.toUpperCase().trim()));

const overlap = [...names2025].filter(n => names2026.has(n));
console.log(`Overlap names between 2025 and 2026 (${overlap.length} members):`, overlap);
