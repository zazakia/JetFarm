/**
 * Single source of truth for "what columns must the remote database have".
 *
 * WHY THIS EXISTS ---------------------------------------------------------------------------
 * SyncService.sanitizeRecord() strips only `_status`/`_changed`, and WatermelonDB's
 * sanitizedRaw() guarantees record._raw carries *every* column of the local tableSchema, so the
 * whole raw object is what gets upserted. One local column the remote table does not have makes
 * PostgREST reject the ENTIRE batch for that table (PGRST204 / SQLSTATE 42703), the push loop can
 * only defer a missing *table* on an optional table -- never a column -- so the cycle throws and
 * those rows retry forever and are never marked synced.
 *
 * Two verifiers need exactly the same expectation set and must not drift from each other:
 *   scripts/audit-remote-schema-gap.mjs        - against the live PostgREST OpenAPI schema cache
 *   scripts/apply-hetzner-migrations.mjs       - against the live SQL catalog (information_schema)
 * The migrations folder is *not* the truth here; production proved it can record a migration as
 * applied while the objects it creates are absent.
 */
import fs from 'node:fs';
import path from 'node:path';

/** The soft-delete upsert always sends these, even for tables whose local schema omits them. */
const ALWAYS_PUSHED_COLUMNS = ['id', 'deleted_at'];

export function loadContract(rootDir) {
    const contractPath = path.join(rootDir, 'src', 'services', 'syncTableContract.json');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    return {
        contract,
        remoteTableMap: contract.remoteTableMap ?? {},
        syncedTables: [...(contract.coreTables ?? []), ...(contract.configTables ?? [])],
    };
}

/**
 * Parse `src/database/schema.ts` for the columns WatermelonDB will send per table.
 * Each table is a `tableSchema({ name: '...', columns: [{ name: '...', type: '...' }, ...] })`
 * call, so brace-match every call and take the table's own `name:` plus its column entries.
 */
export function localSchemaColumns(rootDir) {
    const source = fs.readFileSync(path.join(rootDir, 'src', 'database', 'schema.ts'), 'utf8').replace(/\r/g, '');
    const tables = new Map();

    for (let i = source.indexOf('tableSchema('); i !== -1; i = source.indexOf('tableSchema(', i + 1)) {
        let depth = 0;
        let end = -1;
        for (let j = i + 'tableSchema'.length; j < source.length; j += 1) {
            const ch = source[j];
            if (ch === '(' || ch === '[' || ch === '{') depth += 1;
            else if (ch === ')' || ch === ']' || ch === '}') depth -= 1;
            if (depth === 0) { end = j; break; }
        }
        if (end === -1) continue;

        const block = source.slice(i, end + 1);
        const name = block.match(/name:\s*'([^']+)'/)?.[1];
        if (!name || tables.has(name)) continue;

        const columns = new Set(ALWAYS_PUSHED_COLUMNS);
        for (const match of block.matchAll(/\{\s*name:\s*'([^']+)'\s*,\s*type:/g)) columns.add(match[1]);
        tables.set(name, columns);
    }

    return tables;
}

/**
 * Map the local expectation set onto remote table names.
 * @returns {{ remoteTable: string, localTable: string, columns: string[] }[]}
 */
export function expectedRemoteColumns(rootDir) {
    const { syncedTables, remoteTableMap } = loadContract(rootDir);
    const local = localSchemaColumns(rootDir);

    return syncedTables
        .map((localTable) => {
            const columns = local.get(localTable);
            if (!columns) return null;
            return {
                localTable,
                remoteTable: remoteTableMap[localTable] ?? localTable,
                columns: [...columns].sort(),
            };
        })
        .filter(Boolean);
}

/**
 * Diff an expectation set against whatever the live database/cache actually has.
 * @param {Iterable<string>} liveKeys - every `"<table>.<column>"` key that exists remotely
 * @param {Iterable<string>} liveTables - every remote table name that exists
 * @returns {{ missingTables: object[], missingColumns: object[], checkedTables: number }}
 */
export function diffAgainstLiveSchema(expected, liveKeys, liveTables) {
    const present = new Set(liveKeys);
    const tables = new Set(liveTables);
    const missingTables = [];
    const missingColumns = [];

    for (const entry of expected) {
        if (!tables.has(entry.remoteTable)) {
            missingTables.push(entry);
            continue;
        }
        const gap = entry.columns.filter((column) => !present.has(`${entry.remoteTable}.${column}`));
        if (gap.length) missingColumns.push({ ...entry, missing: gap });
    }

    return { missingTables, missingColumns, checkedTables: expected.length };
}
