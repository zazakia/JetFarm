import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const supabaseUrl = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const supabaseKey = 'sb_publishable_sVFiS9b5lWwqFlhu8pCAAg_VnSpcjIs';
const supabase = createClient(supabaseUrl, supabaseKey);

const EXCEL_FILE = 'Weekly Clients.xlsx';

function splitName(fullName) {
    if (!fullName) return { first: '', last: '' };
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return { first: parts[0], last: '' };
    
    const multiWordSurnames = ['de los reyes', 'de leon', 'de guzman', 'de los santos', 'del rosario'];
    const lowerFullName = fullName.toLowerCase();
    
    for (const surname of multiWordSurnames) {
        if (lowerFullName.endsWith(' ' + surname)) {
            const first = fullName.substring(0, fullName.length - surname.length).trim();
            const last = fullName.substring(fullName.length - surname.length).trim();
            return { first, last };
        }
    }
    
    const last = parts.pop();
    const first = parts.join(' ');
    return { first, last };
}

function parseBirthday(cell) {
    if (!cell) return null;
    
    // If it's an Excel serial date (number)
    if (typeof cell === 'number') {
        const date = new Date(Date.UTC(0, 0, cell - 1));
        // Simple manual calculation for Excel epoch (1899-12-30)
        // or just use Date.UTC(1899, 11, 30 + cell)
        const epoch = new Date(Date.UTC(1899, 11, 30));
        epoch.setUTCDate(epoch.getUTCDate() + cell);
        return epoch.toISOString();
    }
    
    // If it's a string (e.g., DD-Mon-YY)
    if (typeof cell === 'string') {
        const parts = cell.trim().split('-');
        if (parts.length === 3) {
            const [day, mon, yr] = parts;
            const months = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
            };
            if (months[mon] !== undefined) {
                let year = parseInt(yr);
                if (year <= 30) year += 2000;
                else year += 1900;
                const d = new Date(Date.UTC(year, months[mon], parseInt(day)));
                return d.toISOString();
            }
        }
    }
    
    return null;
}

const slugify = (s) => s ? s.toLowerCase().replace(/[^a-z]/g, '') : '';

async function run() {
    console.log('--- Starting Corrected Import Process ---');
    
    // 1. Fetch existing borrowers
    const { data: existingData, error: fetchError } = await supabase
        .from('app_borrowers')
        .select('full_name')
        .is('deleted_at', null);
        
    if (fetchError) {
        console.error('Error fetching existing borrowers:', fetchError);
        return;
    }
    
    const existingSlugs = new Set(existingData.map(b => slugify(b.full_name)));
    console.log(`Found ${existingData.length} existing borrowers in DB.`);

    // 2. Read Excel
    const wb = XLSX.readFile(EXCEL_FILE);
    const ws = wb.Sheets[wb.SheetNames[0]];
    // Use raw: true to get values correctly
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    
    let currentGroup = '';
    const borrowersToInsert = [];
    let skipCount = 0;

    data.forEach(row => {
        const [col0, col1, col2, col3, col4, col5] = row;
        const val0 = String(col0 || '').trim();
        const val1 = String(col1 || '').trim();
        const val3 = String(col3 || '').trim();
        const val4 = String(col4 || '').trim();
        const val5 = String(col5 || '').trim();
        
        // Group header detection
        if (val0 && !col1 && !col2 && !col3 && !col4 && !col5 && val0 !== 'Sheet1') {
            currentGroup = val0;
            return;
        }
        
        // Skip table headers and empty rows
        if (!val0 || val0 === 'Name Of Client' || !currentGroup) {
            return;
        }
        
        const slug = slugify(val0);
        
        if (existingSlugs.has(slug)) {
            console.log(`Skipping existing borrower: ${val0}`);
            skipCount++;
            return;
        }
        
        const { first, last } = splitName(val0);
        const birthday = parseBirthday(col2);
        
        borrowersToInsert.push({
            full_name: val0,
            first_name: first,
            last_name: last,
            address: val1,
            date_of_birth: birthday,
            phone: val3,
            co_maker_name: val4,
            business: val5,
            "group": currentGroup,
            area: 'Weekly'
        });
        
        existingSlugs.add(slug);
    });

    console.log(`Prepared ${borrowersToInsert.length} borrowers for insertion.`);
    console.log(`Skipped ${skipCount} duplicates.`);

    if (borrowersToInsert.length === 0) {
        console.log('No new borrowers to insert.');
        return;
    }

    // 3. Batch insert
    const { error: insertError } = await supabase
        .from('app_borrowers')
        .insert(borrowersToInsert);

    if (insertError) {
        console.error('Error during insertion:', insertError);
    } else {
        console.log('--- SUCCESS ---');
        console.log(`Imported ${borrowersToInsert.length} new borrowers successfully with birthdays.`);
    }
}

run();
