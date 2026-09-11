import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// Helper to standardise collector names
function standardizeCollector(name: string): string {
    const raw = name.toLowerCase().trim();
    if (raw.includes('junco')) return 'Cresencio Junco';
    if (raw.includes('gera')) return 'Gerald Gera';
    if (raw.includes('cayanong')) return 'Jason Cayanong';
    if (raw.includes('casera')) return 'Bernie Casera';
    return name;
}

function parseExcelDate(excelValue: any): number | null {
    if (!excelValue) return null;
    if (excelValue instanceof Date) return excelValue.getTime();
    if (typeof excelValue === 'number') {
        return new Date(Math.round((excelValue - 25569) * 86400 * 1000)).getTime();
    }
    if (typeof excelValue === 'string') {
        const parsed = new Date(excelValue);
        if (!isNaN(parsed.getTime())) return parsed.getTime();
    }
    return null;
}

const ignoreKw = ['batch', 'total', 'grand total', 'name of client', 'monthly', 'weekly'];

function runExtraction() {
    console.log("Extracting Brayan Excel Data to JSON...");
    const wb = xlsx.readFile('brayan Import migration cleanup.xlsx', { cellStyles: true, cellDates: true });
    const ws = wb.Sheets['DATA of Clients'];
    if (!ws) throw new Error("Sheet 'DATA of Clients' not found!");

    const range = xlsx.utils.decode_range(ws['!ref'] as string);
    const maxRow = range.e.r;

    const borrowerMap: Record<string, any> = {};
    const collectorsSet = new Set<string>();

    let currentFreq = 'daily';
    let currentBatchName = '';
    let totalLoans = 0;
    
    for (let r = 0; r <= maxRow; r++) {
        const cellA = ws[xlsx.utils.encode_cell({ r, c: 0 })];
        const valA = (cellA && cellA.v !== undefined) ? String(cellA.v).trim() : '';
        if (!valA) continue;
        
        const vLower = valA.toLowerCase();

        if (vLower.includes('batch')) {
            currentBatchName = valA;
            const cellJ = ws[xlsx.utils.encode_cell({ r, c: 9 })];
            const valJ = cellJ ? String(cellJ.v).toLowerCase() : '';
            if (vLower.includes('weekly') || valJ.includes('weekly')) {
                currentFreq = 'weekly';
            } else {
                currentFreq = 'daily';
            }
            continue;
        }

        const shouldSkip = ignoreKw.some(kw => vLower.startsWith(kw));
        if (shouldSkip || vLower.length < 4) continue;

        const borrowerName = valA;
        const address = ws[xlsx.utils.encode_cell({ r, c: 1 })]?.v || '';
        const phone = ws[xlsx.utils.encode_cell({ r, c: 2 })]?.v || '';
        const business = ws[xlsx.utils.encode_cell({ r, c: 4 })]?.v || '';
        
        const rawCollector = ws[xlsx.utils.encode_cell({ r, c: 5 })]?.v || '';
        const rawDays = ws[xlsx.utils.encode_cell({ r, c: 6 })]?.v || 0;
        const releaseDate = parseExcelDate(ws[xlsx.utils.encode_cell({ r, c: 9 })]?.v);
        const maturityDate = parseExcelDate(ws[xlsx.utils.encode_cell({ r, c: 10 })]?.v);
        const principal = parseFloat(ws[xlsx.utils.encode_cell({ r, c: 11 })]?.v || '0');
        const installmentAmt = parseFloat(ws[xlsx.utils.encode_cell({ r, c: 12 })]?.v || '0');
        const totalInterest = parseFloat(ws[xlsx.utils.encode_cell({ r, c: 13 })]?.v || '0');
        const insurance = parseFloat(ws[xlsx.utils.encode_cell({ r, c: 16 })]?.v || '0');
        const totalLoan = parseFloat(ws[xlsx.utils.encode_cell({ r, c: 17 })]?.v || '0');
        const excelBalance = parseFloat(ws[xlsx.utils.encode_cell({ r, c: 18 })]?.v || '0');

        let collector = '';
        if (rawCollector && typeof rawCollector === 'string' && rawCollector.length > 3 && !rawCollector.toLowerCase().includes('collector')) {
            collector = standardizeCollector(rawCollector);
            collectorsSet.add(collector);
        }

        // Determine Paid Status via Theme 5 Tint 0.6 logic
        let isPaid = false;
        if (cellA.s && cellA.s.fgColor) {
            const fg = cellA.s.fgColor;
            if (fg.theme === 5 && fg.tint !== undefined && Math.abs(fg.tint - 0.6) < 0.1) {
                isPaid = true;
            }
        }

        if (!borrowerMap[borrowerName]) {
            borrowerMap[borrowerName] = {
                name: borrowerName,
                address: String(address),
                phone: String(phone),
                business: String(business),
                collector: collector,
                loans: []
            };
        }

        const payments = [];
        let headerRowIdx = r - 1;
        while (headerRowIdx >= 0) {
            const hCell = ws[xlsx.utils.encode_cell({ r: headerRowIdx, c: 0 })];
            const hVal = hCell ? String(hCell.v).toLowerCase() : '';
            if (hVal.includes('name of client')) break;
            headerRowIdx--;
        }

        if (headerRowIdx >= 0) {
            for (let c = 19; c < 100; c++) {
                const dateCell = ws[xlsx.utils.encode_cell({ r: headerRowIdx, c })];
                const amountCell = ws[xlsx.utils.encode_cell({ r, c })];
                
                const d = parseExcelDate(dateCell?.v);
                if (d && amountCell && amountCell.v) {
                    const amt = parseFloat(amountCell.v);
                    if (amt > 0) {
                        payments.push({
                            date: d,
                            amount: amt
                        });
                    }
                }
            }
        }

        borrowerMap[borrowerName].loans.push({
            rowOrigin: r + 1,
            days: parseInt(String(rawDays)) || 40,
            frequency: currentFreq,
            releaseDate,
            maturityDate,
            principal,
            installmentAmt,
            totalInterest,
            insurance,
            totalLoan,
            excelBalance,
            isPaid,
            payments
        });
        
        totalLoans++;
    }

    const payload = {
        collectors: Array.from(collectorsSet),
        borrowers: Object.values(borrowerMap)
    };

    const outPath = path.join(__dirname, '..', 'src', 'assets', 'migration_data.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

    console.log(`Successfully extracted ${totalLoans} loans across ${Object.keys(borrowerMap).length} borrowers.`);
    console.log(`JSON written to: ${outPath}`);
}

runExtraction();
