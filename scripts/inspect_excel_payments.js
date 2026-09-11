const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('data/brayan Import migration cleanup.xlsx', { cellStyles: true });
const ws = wb.Sheets['DATA of Clients'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

const BH_COL = 59;
const CA_COL = 78;

// Each batch section has its own "Name Of Client" row with date headers in row+1
// The header dates are in the "Name Of Client" row itself (row 26 for Batch 1 Reloan)
// But some sections use the row AFTER "Name Of Client" for dates

// Let me find ALL section boundaries and their date columns
const sectionRows = [
    { batch: '1', row: 2 },
    { batch: '1R', row: 26 },
    { batch: '2', row: 47 },
    { batch: '2R', row: 68 },
    { batch: '3', row: 88 },
    { batch: '3R', row: 111 },
    { batch: '4', row: 129 },
    { batch: '4R', row: 154 },
    { batch: '5', row: 171 },
    { batch: '5R', row: 197 },
    { batch: '6', row: 227 },
    { batch: '6R', row: 248 },
    { batch: '7', row: 269 },
    { batch: '7R', row: 288 },
    { batch: '8', row: 311 },
    { batch: '8R', row: 329 },
    { batch: '9', row: 356 },
    { batch: '9R', row: 371 },
    { batch: '10', row: 381 },
    { batch: '10R', row: 387 },
    { batch: '11', row: 398 },
    { batch: '11R', row: 407 },
    { batch: '12', row: 428 },
    { batch: '12R', row: 435 },
    { batch: '13', row: 451 },
    { batch: '13W', row: 461 },
    { batch: '13R', row: 467 },
    { batch: '14', row: 491 },
    { batch: '14R', row: 499 },
    { batch: '15', row: 518 },
    { batch: '15W', row: 526 },
    { batch: '15R', row: 531 },
    { batch: '16', row: 549 },
    { batch: '16R', row: 556 },
    { batch: '17', row: 584 },
    { batch: '17R', row: 590 },
    { batch: '18', row: 613 },
    { batch: '18R', row: 625 },
    { batch: '19', row: 645 },
    { batch: '19R', row: 653 },
    { batch: '20R', row: 679 },
    { batch: '21', row: 699 },
];

// For each section, collect ALL dates from the header row (T through max columns)
// Then we can map column index to date for BH-CA
for (const section of sectionRows) {
    const headerRow = data[section.row];
    if (!headerRow) continue;
    
    const dates = [];
    for (let c = 19; c <= 200; c++) { // Start from T (19)
        const v = headerRow[c];
        if (typeof v === 'number' && v > 40000 && v < 50000) {
            const d = XLSX.SSF.parse_date_code(v);
            const dateStr = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
            dates.push({ col: c, colName: XLSX.utils.encode_col(c), date: dateStr });
        }
    }
    
    // Check if there are dates in BH-CA range
    const bhDates = dates.filter(d => d.col >= BH_COL && d.col <= CA_COL);
    if (bhDates.length > 0) {
        console.log(`Batch ${section.batch} (headerRow ${section.row}): ${bhDates.length} dates in BH-CA`);
        for (const d of bhDates) console.log(`  ${d.colName}: ${d.date}`);
    }
    
    // Also store the last date to understand the pattern
    if (dates.length > 0) {
        const last = dates[dates.length - 1];
        console.log(`  Batch ${section.batch}: ${dates.length} total dates, last: ${last.colName} = ${last.date}`);
    }
}

// Now let me check: the green rows are in specific batch sections
// Let me identify which batch section each green row belongs to
const greenRows = [
    { row: 28, name: 'Maria Camila Lahoylahoy' },
    { row: 34, name: 'Celerina R. Decio' },
    { row: 42, name: 'Warlito R. Decio' },
    { row: 44, name: 'Arcelene B. Castro' },
    { row: 90, name: 'Marielle R. Decio' },
    { row: 113, name: 'Emelita D. Tuico' },
    { row: 145, name: 'Gleceria J. Teves' },
    { row: 155, name: 'Ma. Jocelyn S. Rodriguez' },
    { row: 166, name: 'Mario P. Pawa-an Jr.' },
    { row: 417, name: 'Amy S. Abrahan' },
];

console.log('\n=== GREEN ROW BATCH ASSIGNMENTS ===');
for (const gr of greenRows) {
    // Find which section this row belongs to
    let batchSection = null;
    for (let i = sectionRows.length - 1; i >= 0; i--) {
        if (gr.row > sectionRows[i].row) {
            batchSection = sectionRows[i];
            break;
        }
    }
    if (batchSection) {
        console.log(`${gr.name.padEnd(35)} row ${gr.row} -> Batch ${batchSection.batch} (header row ${batchSection.row})`);
        
        // Get dates for this section in BH-CA columns
        const headerRow = data[batchSection.row];
        if (headerRow) {
            const sectionDates = [];
            for (let c = BH_COL; c <= CA_COL; c++) {
                const v = headerRow[c];
                if (typeof v === 'number' && v > 40000 && v < 50000) {
                    const d = XLSX.SSF.parse_date_code(v);
                    sectionDates.push({ col: c, date: `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}` });
                }
            }
            if (sectionDates.length > 0) {
                console.log(`  Date columns: ${sectionDates.map(d => XLSX.utils.encode_col(d.col) + '=' + d.date).join(', ')}`);
            } else {
                // Maybe dates extend beyond BG - look at the full date range
                const allDates = [];
                for (let c = 19; c <= 200; c++) {
                    const v = headerRow[c];
                    if (typeof v === 'number' && v > 40000 && v < 50000) {
                        const d = XLSX.SSF.parse_date_code(v);
                        allDates.push({ col: c, date: `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}` });
                    }
                }
                console.log(`  Total date cols: ${allDates.length}, last: ${allDates.length > 0 ? XLSX.utils.encode_col(allDates[allDates.length-1].col) + '=' + allDates[allDates.length-1].date : 'none'}`);
                
                // Maybe BH-CA columns have dates in a DIFFERENT row
                // Check row+1
                const nextRow = data[batchSection.row + 1];
                if (nextRow) {
                    const nextDates = [];
                    for (let c = BH_COL; c <= CA_COL; c++) {
                        const v = nextRow[c];
                        if (typeof v === 'number' && v > 40000 && v < 50000) {
                            nextDates.push({ col: c, date: `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}` });
                        }
                    }
                    if (nextDates.length > 0) console.log(`  Row+1 dates: ${nextDates.length}`);
                }
            }
        }
    }
}
