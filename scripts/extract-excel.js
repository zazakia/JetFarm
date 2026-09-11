"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");
// Helper to standardise collector names
function standardizeCollector(name) {
    const raw = name.toLowerCase().trim();
    if (raw.includes('junco'))
        return 'Cresencio Junco';
    if (raw.includes('gera'))
        return 'Gerald Gera';
    if (raw.includes('cayanong'))
        return 'Jason Cayanong';
    if (raw.includes('casera'))
        return 'Bernie Casera';
    return name;
}
function parseExcelDate(excelValue) {
    if (!excelValue)
        return null;
    if (excelValue instanceof Date)
        return excelValue.getTime();
    if (typeof excelValue === 'number') {
        return new Date(Math.round((excelValue - 25569) * 86400 * 1000)).getTime();
    }
    if (typeof excelValue === 'string') {
        const parsed = new Date(excelValue);
        if (!isNaN(parsed.getTime()))
            return parsed.getTime();
    }
    return null;
}
const ignoreKw = ['batch', 'total', 'grand total', 'name of client', 'monthly', 'weekly'];
function runExtraction() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    console.log("Extracting Brayan Excel Data to JSON...");
    const wb = xlsx.readFile('brayan Import migration cleanup.xlsx', { cellStyles: true, cellDates: true });
    const ws = wb.Sheets['DATA of Clients'];
    if (!ws)
        throw new Error("Sheet 'DATA of Clients' not found!");
    const range = xlsx.utils.decode_range(ws['!ref']);
    const maxRow = range.e.r;
    const borrowerMap = {};
    const collectorsSet = new Set();
    let currentFreq = 'daily';
    let currentBatchName = '';
    let totalLoans = 0;
    for (let r = 0; r <= maxRow; r++) {
        const cellA = ws[xlsx.utils.encode_cell({ r, c: 0 })];
        const valA = (cellA && cellA.v !== undefined) ? String(cellA.v).trim() : '';
        if (!valA)
            continue;
        const vLower = valA.toLowerCase();
        if (vLower.includes('batch')) {
            currentBatchName = valA;
            const cellJ = ws[xlsx.utils.encode_cell({ r, c: 9 })];
            const valJ = cellJ ? String(cellJ.v).toLowerCase() : '';
            if (vLower.includes('weekly') || valJ.includes('weekly')) {
                currentFreq = 'weekly';
            }
            else {
                currentFreq = 'daily';
            }
            continue;
        }
        const shouldSkip = ignoreKw.some(kw => vLower.startsWith(kw));
        if (shouldSkip || vLower.length < 4)
            continue;
        const borrowerName = valA;
        const address = ((_a = ws[xlsx.utils.encode_cell({ r, c: 1 })]) === null || _a === void 0 ? void 0 : _a.v) || '';
        const phone = ((_b = ws[xlsx.utils.encode_cell({ r, c: 2 })]) === null || _b === void 0 ? void 0 : _b.v) || '';
        const business = ((_c = ws[xlsx.utils.encode_cell({ r, c: 4 })]) === null || _c === void 0 ? void 0 : _c.v) || '';
        const rawCollector = ((_d = ws[xlsx.utils.encode_cell({ r, c: 5 })]) === null || _d === void 0 ? void 0 : _d.v) || '';
        const rawDays = ((_e = ws[xlsx.utils.encode_cell({ r, c: 6 })]) === null || _e === void 0 ? void 0 : _e.v) || 0;
        const releaseDate = parseExcelDate((_f = ws[xlsx.utils.encode_cell({ r, c: 9 })]) === null || _f === void 0 ? void 0 : _f.v);
        const maturityDate = parseExcelDate((_g = ws[xlsx.utils.encode_cell({ r, c: 10 })]) === null || _g === void 0 ? void 0 : _g.v);
        const principal = parseFloat(((_h = ws[xlsx.utils.encode_cell({ r, c: 11 })]) === null || _h === void 0 ? void 0 : _h.v) || '0');
        const installmentAmt = parseFloat(((_j = ws[xlsx.utils.encode_cell({ r, c: 12 })]) === null || _j === void 0 ? void 0 : _j.v) || '0');
        const totalInterest = parseFloat(((_k = ws[xlsx.utils.encode_cell({ r, c: 13 })]) === null || _k === void 0 ? void 0 : _k.v) || '0');
        const insurance = parseFloat(((_l = ws[xlsx.utils.encode_cell({ r, c: 16 })]) === null || _l === void 0 ? void 0 : _l.v) || '0');
        const totalLoan = parseFloat(((_m = ws[xlsx.utils.encode_cell({ r, c: 17 })]) === null || _m === void 0 ? void 0 : _m.v) || '0');
        const excelBalance = parseFloat(((_o = ws[xlsx.utils.encode_cell({ r, c: 18 })]) === null || _o === void 0 ? void 0 : _o.v) || '0');
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
            if (hVal.includes('name of client'))
                break;
            headerRowIdx--;
        }
        if (headerRowIdx >= 0) {
            for (let c = 19; c < 100; c++) {
                const dateCell = ws[xlsx.utils.encode_cell({ r: headerRowIdx, c })];
                const amountCell = ws[xlsx.utils.encode_cell({ r, c })];
                const d = parseExcelDate(dateCell === null || dateCell === void 0 ? void 0 : dateCell.v);
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
