# Reusable Data Import & Fuzzy Matching Skill Guidelines

This guide details the design, implementation, and best practices for creating a reusable, duplicate-free database migration pipeline for microfinance and lending projects.

## Architecture Guidelines

A robust data migration script must handle:
1. **Dynamic Schema & Column Scanning:** Do not hardcode column indices. Scan sheet rows to detect header labels dynamically (e.g. searching for names of months like Jan, Feb, Mar, or terms like "Members", "TSM", "TSAD" to map indices).
2. **De-duplication & Merging:** Check for existing records and duplicates. Relink any associated foreign key transactions from the duplicate to the correct record before deleting the duplicate.
3. **Robust Fuzzy Name Matching:**
   - Normalize casing, remove commas, dots, and trailing/leading spaces.
   - Clean common prefixes/suffixes (e.g. `Ma. -> Maria`, `Jr. -> (removed)`).
   - Filter out middle initials.
   - Allow exact match first.
   - Fall back to ignoring middle initials (e.g. `Paul Espinosa` to `PAUL C. ESPINOSA`).
   - If that fails, run Levenshtein distance on first name parts and last name parts:
     - Exact last name match + first name distance <= 3 (handles spelling variations like `Ronnel -> Ronelle`).
     - Close last name match (distance <= 1) + close first name match (distance <= 2).

## Implementation Pattern

Here is the reusable pattern for fuzzy name matching:

```javascript
function cleanAndNormalize(name) {
    if (!name) return '';
    let str = name.toString().toLowerCase().trim();
    str = str.replace(/[.,]/g, '');
    str = str.replace(/\s+/g, ' ');
    if (str.startsWith('ma ')) str = 'maria' + str.substring(2);
    if (str.startsWith('jr') || str.endsWith(' jr')) str = str.replace(' jr', '');
    return str;
}

function getPartsWithoutInitials(normalizedName) {
    return normalizedName.split(' ').filter(p => p.length > 1);
}

function fuzzyMatch(excelName, dbBorrowers) {
    const normExcel = cleanAndNormalize(excelName);
    if (!normExcel) return null;
    const excelParts = getPartsWithoutInitials(normExcel);
    
    // 1. Try exact match
    for (const db of dbBorrowers) {
        if (cleanAndNormalize(db.full_name) === normExcel) return { db, confidence: 'EXACT' };
    }

    // 2. Ignore middle initials
    const excelKey = excelParts.join(' ');
    for (const db of dbBorrowers) {
        const normDb = cleanAndNormalize(db.full_name);
        if (getPartsWithoutInitials(normDb).join(' ') === excelKey) return { db, confidence: 'IGNORE_INITIALS' };
    }

    // 3. Levenshtein edit distance
    if (excelParts.length >= 2) {
        const excelLast = excelParts[excelParts.length - 1];
        const excelFirst = excelParts.slice(0, -1).join(' ');

        for (const db of dbBorrowers) {
            const normDb = cleanAndNormalize(db.full_name);
            const dbParts = getPartsWithoutInitials(normDb);
            if (dbParts.length < 2) continue;

            const dbLast = dbParts[dbParts.length - 1];
            const dbFirst = dbParts.slice(0, -1).join(' ');

            const lastDist = getLevenshteinDistance(excelLast, dbLast);
            const firstDist = getLevenshteinDistance(excelFirst, dbFirst);

            if (lastDist === 0 && firstDist <= 3) return { db, confidence: 'FUZZY_CLOSE' };
            if (lastDist <= 1 && firstDist <= 2) return { db, confidence: 'FUZZY_CLOSE' };
        }
    }
    return null;
}
```

## Running the Migration Script

Run the script in **dry-run** mode to inspect the matched entries and merge plans without executing updates:
```bash
node scripts/migrate_savings_cbu_v2.mjs
```

Apply the updates to the live database when satisfied:
```bash
node scripts/migrate_savings_cbu_v2.mjs --apply
```
