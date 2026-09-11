const xlsx = require('xlsx');
const workbook = xlsx.readFile('./DCM-as-of-march-21.xlsx');
const sheet = workbook.Sheets['DATA of Clients'];
const rawData = xlsx.utils.sheet_to_json(sheet, { range: 11 });

const names = rawData.map(r => r['Name Of Client']?.toString()).filter(Boolean);
const batchNames = names.filter(n => n.includes('Batch'));
console.log(JSON.stringify(batchNames));
