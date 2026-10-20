/**
 * Per-module CRUD + persistence audit.
 *
 * Cross-references six independent sources of truth and reports where they disagree:
 *   src/database/schema.ts            (what WatermelonDB/LokiJS will actually persist)
 *   src/database/models/*.ts          (what the app can read through a Model class)
 *   src/services/syncTableContract.json (what sync is allowed to push/pull, and to where)
 *   supabase/migrations/*.sql         (what the remote database actually has)
 *   src/modules/{module}/manifest.ts    (which tables belong to which coop module)
 *   app/**, src/**                    (which tables have a real create/update/delete surface)
 *
 *   node scripts/audit-crud-persistence.mjs            # human-readable
 *   node scripts/audit-crud-persistence.mjs --json     # machine-readable
 *   node scripts/audit-crud-persistence.mjs --domain water-station
 *   node scripts/audit-crud-persistence.mjs --contract <path>  # audit a different contract file
 *   node scripts/audit-crud-persistence.mjs --fail-on-high   # CI gate: exit 1 if any HIGH row
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const domainFilter = args.includes('--domain') ? args[args.indexOf('--domain') + 1] : null;
const failOnHigh = args.includes('--fail-on-high');
// Only the contract file can be swapped (used by the mutation harness in
// scripts/__tests__/auditCrudPersistence.test.js); every other source stays the real repo, so a
// probe cannot make the auditor pass by having nothing to compare against.
const contractRel = args.includes('--contract')
    ? args[args.indexOf('--contract') + 1]
    : 'src/services/syncTableContract.json';

const read = (rel) => readFileSync(path.join(root, rel), 'utf8');
const walk = (dir, out = []) => {
    // Callers may pass a path relative to the repo root or recurse with an absolute one;
    // resolving only the former (and then re-joining root onto it) silently skipped every
    // subdirectory, which made the whole write-surface metric read as ~zero.
    const base = path.isAbsolute(dir) ? dir : path.join(root, dir);
    if (!existsSync(base)) return out;
    for (const entry of readdirSync(base)) {
        const abs = path.join(base, entry);
        if (statSync(abs).isDirectory()) walk(abs, out);
        else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(abs);
    }
    return out;
};

// ---------------------------------------------------------------- WatermelonDB schema
const parseSchemaTables = () => {
    const source = read('src/database/schema.ts');
    const tables = new Map();
    for (const chunk of source.split('tableSchema({').slice(1)) {
        const name = chunk.match(/name:\s*'([a-z0-9_]+)'/)?.[1];
        if (!name) continue;
        const columns = new Set(
            [...chunk.matchAll(/\{\s*name:\s*'([a-z0-9_]+)'/g)].map((m) => m[1])
        );
        tables.set(name, columns);
    }
    return tables;
};

// ---------------------------------------------------------------- Model classes
const parseModelTables = () => {
    const byTable = new Map();
    for (const abs of walk('src/database/models')) {
        const source = readFileSync(abs, 'utf8');
        const table = source.match(/static\s+table\s*=\s*'([a-z0-9_]+)'/)?.[1];
        if (!table) continue;
        const attrs = new Set();
        for (const re of [
            /@(?:field|date|text|writer|immutableField)\(\s*'([a-z0-9_]+)'/g,
            /@relation\(\s*'[^']+'\s*,\s*'([a-z0-9_]+)'/g,
            /@composite\s*\(\s*'([a-z0-9_]+)'/g,
        ]) {
            for (const m of source.matchAll(re)) attrs.add(m[1]);
        }
        byTable.set(table, { file: path.relative(root, abs).replace(/\\/g, '/'), attrs });
    }
    return byTable;
};

// ---------------------------------------------------------------- Coop module manifests
const matchBracket = (text, openIdx) => {
    let depth = 0;
    for (let i = openIdx; i < text.length; i += 1) {
        if (text[i] === '[') depth += 1;
        else if (text[i] === ']') {
            depth -= 1;
            if (depth === 0) return i;
        }
    }
    return -1;
};

// Objects declared at depth 1 of an array literal, so nested column arrays don't leak in.
const directEntries = (source, key) => {
    const hit = source.match(new RegExp(`${key}:\\s*\\[`));
    if (!hit) return [];
    const open = source.indexOf('[', hit.index);
    const close = matchBracket(source, open);
    if (close < 0) return [];
    const entries = [];
    let depth = 0;
    let start = -1;
    for (let i = open + 1; i < close; i += 1) {
        const ch = source[i];
        if (ch === '{' || ch === '[' || ch === '(') depth += 1;
        if (ch === '}' || ch === ']' || ch === ')') depth -= 1;
        if (ch === '{' && depth === 1) start = i;
        if (ch === '}' && depth === 0 && start >= 0) {
            entries.push(source.slice(start, i + 1));
            start = -1;
        }
    }
    return entries;
};

const moduleNameOf = (entry) => entry.match(/^\{\s*name:\s*'([^']+)'/m)?.[1];

const moduleManifests = () => {
    const owner = new Map(); // table -> module dir
    const modules = [];
    const dir = path.join(root, 'src', 'modules');
    // The coop module framework is retired on the agribusiness-only build, so the
    // directory may not exist. Absence means "no module claims any table".
    if (!existsSync(dir)) return { owner, modules };
    for (const entry of readdirSync(dir)) {
        const manifestPath = path.join(dir, entry, 'manifest.ts');
        if (!existsSync(manifestPath)) continue;
        const source = readFileSync(manifestPath, 'utf8');
        const tables = directEntries(source, 'dbTables')
            .map(moduleNameOf)
            .filter((t) => Boolean(t) && /^[a-z][a-z0-9_]*$/.test(t));
        const routes = directEntries(source, 'routes')
            .map((e) => e.match(/path:\s*'([^']+)'/)?.[1])
            .filter(Boolean);
        for (const t of tables) if (!owner.has(t)) owner.set(t, entry);
        modules.push({ dir: entry, tables, routes });
    }
    return { owner, modules };
};

// A module screen "persists" when it reaches WatermelonDB directly or through a service
// that does. Screens that only hold useState seed data do not, whatever the manifest claims.
const DB_REACH = /from '.*src\/database|@nozbe\/watermelondb|db\.get\(|useCollection\(|prepareCreate\(/;
const modulePersistence = (mod) =>
    mod.routes.map((route) => {
        const base = path.join(root, 'app', route.replace(/^\//, ''));
        const candidates = [
            `${base}.tsx`,
            `${base}.ts`,
            path.join(base, 'index.tsx'),
            path.join(base, 'index.ts'),
        ];
        const file = candidates.find((candidate) => existsSync(candidate));
        if (!file) return { route, file: null, persists: false, models: [] };
        const source = readFileSync(file, 'utf8');
        const models = [...source.matchAll(/import\s+([A-Z][A-Za-z0-9]*)\s+from\s+'.*src\/database\/models/g)].map((m) => m[1]);
        return { route, file: path.relative(root, file), persists: DB_REACH.test(source), models };
    });

// ---------------------------------------------------------------- Migrations
const CONSTRAINT_LINE =
    /^\s*(constraint|primary|unique|foreign|exclude|check|with|using|on)\b/i;

const matchParen = (text, openIdx) => {
    let depth = 0;
    for (let i = openIdx; i < text.length; i += 1) {
        if (text[i] === '(') depth += 1;
        else if (text[i] === ')') {
            depth -= 1;
            if (depth === 0) return i;
        }
    }
    return -1;
};

const parseMigrations = () => {
    const tables = new Map();
    const dir = path.join(root, 'supabase', 'migrations');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
        const source = readFileSync(path.join(dir, file), 'utf8');

        for (const m of source.matchAll(
            /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z0-9_."]+)\s*\(/gi
        )) {
            const raw = m[1].replace(/"/g, '');
            const name = raw.includes('.') ? raw.split('.').pop() : raw;
            const bodyEnd = matchParen(source, m.index + m[0].length - 1);
            if (bodyEnd < 0) continue;
            const body = source.slice(m.index + m[0].length - 1 + 1, bodyEnd);
            const columns = new Set();
            for (const line of body.split('\n')) {
                if (!line.trim() || CONSTRAINT_LINE.test(line)) continue;
                const col = line.trim().match(/^"?([a-z_][a-z0-9_]*)"?\s+\S/i);
                if (col) columns.add(col[1].toLowerCase());
            }
            if (!tables.has(name)) {
                tables.set(name, { columns, createdBy: file, createdIn: file, alteredIn: [] });
            } else {
                // A later CREATE TABLE for the same name: duplicates are a finding of their own.
                tables.get(name).duplicateIn = file;
            }
        }

        // A single ALTER may add many columns (`ADD COLUMN a text, ADD COLUMN b text`).
        // Many of these statements sit inside `DO $$ ... IF EXISTS (...) THEN ALTER TABLE ...`
        // guards, so anchor on every ALTER TABLE occurrence in the file and read forward to the
        // next semicolon rather than filtering whole statements -- otherwise guarded columns look
        // like local-only sync losses.
        for (const m of source.matchAll(
            /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+|ONLY\s+)?([a-zA-Z0-9_.]+)/gi
        )) {
            const target = m[1].replace(/"/g, '').replace(/^\.|\.$/g, '');
            const def = tables.get(target.split('.').pop());
            if (!def) continue;
            const tail = source.slice(m.index + m[0].length);
            const end = tail.indexOf(';');
            const code = end < 0 ? '' : tail.slice(0, end);
            for (const c of code.matchAll(
                /ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z_][a-z0-9_]*)\s+\S/gi
            )) {
                def.columns.add(c[1].toLowerCase());
                if (!def.alteredIn.includes(file)) def.alteredIn.push(file);
            }
        }

        for (const m of source.matchAll(
            /ALTER\s+TABLE\s+(?:ONLY\s+)?([a-zA-Z0-9_."]+)[^;]*ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi
        )) {
            const raw = m[1].replace(/"/g, '');
            const name = raw.includes('.') ? raw.split('.').pop() : raw;
            if (tables.has(name)) tables.get(name).rls = true;
        }

        for (const m of source.matchAll(/CREATE\s+POLICY[^;]*?\sON\s+([a-zA-Z0-9_."]+)/gi)) {
            const raw = m[1].replace(/"/g, '');
            const name = raw.includes('.') ? raw.split('.').pop() : raw;
            if (tables.has(name)) tables.get(name).policies = (tables.get(name).policies || 0) + 1;
        }

        // RLS is also enabled for whole table lists from a DO block, e.g.
        //   FOREACH tbl IN ARRAY ARRAY['app_settings', ...] LOOP
        //     EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
        // format() hides the table name from the static regexes above, so read the array.
        for (const m of source.matchAll(/FOREACH\s+\w+\s+IN\s+ARRAY\s+ARRAY\s*[[(]([\s\S]*?)[\])]/gi)) {
            const loopEnd = source.indexOf('END LOOP', m.index);
            const body = source.slice(m.index, loopEnd < 0 ? source.length : loopEnd);
            const enablesRls = /ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(body);
            const createsPolicy = /CREATE\s+POLICY/i.test(body);
            if (!enablesRls && !createsPolicy) continue;
            const names = [...m[1].matchAll(/'([a-zA-Z0-9_.]+)'/g)].map((n) => n[1].split('.').pop());
            for (const name of names) {
                const def = tables.get(name);
                if (!def) continue;
                if (enablesRls) def.rls = true;
                const policies = (body.match(/CREATE\s+POLICY/gi) || []).length;
                if (policies) def.policies = (def.policies || 0) + policies;
                if (!def.alteredIn.includes(file)) def.alteredIn.push(file);
            }
        }
    }
    return tables;
};

// ---------------------------------------------------------------- Write surfaces
// IMPORTANT: this is a *reference* metric, not a call-graph. WatermelonDB writes here are
// variable- and service-mediated (`BaseModelService.softDelete(model)` takes an instance, and
// screens call services that take no table name at all), so no regex can attribute every write
// to a table without type-aware analysis. A file is said to touch a table when it names the
// table as a string literal or imports that table's Model class; the write verbs found anywhere
// in that file are then attributed to it, and the row is marked `~` (ambiguous).
// Use it to spot tables with NO surface at all, not as an exact per-table call count.
const OPS = [
    [/\bprepareCreate\s*\(|\.create\s*\(\s*'|\.insert\s*\(/g, 'create'],
    [/\bprepareUpdate\s*\(|\.update\s*\(|\.save\s*\(/g, 'update'],
    [/\bprepareUpsert\s*\(|\.upsert\s*\(/g, 'upsert'],
    [/\bprepareDelete\s*\(|\.destroy\s*\(|\.softDelete\s*\(|destroyPermanently|\.delete\s*\(\s*'|\.remove\s*\(/g, 'delete'],
    [/\.(?:fetch|query|find|getMany|getAll|collect)\s*\(|\bQ\.where\b/g, 'reads'],
];

const parseWriteSurfaces = (tableNames, modelFileByTable) => {
    const stats = new Map();
    let scanned = 0;
    const tableMatchers = [...tableNames].map((t) => ({
        table: t,
        re: new RegExp(`['"\`]${t}['"\`]`),
    }));
    const touch = (table) => {
        if (!stats.has(table)) {
            stats.set(table, { create: 0, update: 0, delete: 0, upsert: 0, reads: 0, files: [] });
        }
        return stats.get(table);
    };

    for (const abs of [...walk('app'), ...walk('src')]) {
        const rel = path.relative(root, abs).replace(/\\/g, '/');
        const source = readFileSync(abs, 'utf8');

        scanned += 1;
        const hit = new Set();
        for (const { table, re } of tableMatchers) {
            if (re.test(source)) hit.add(table);
        }
        for (const [t, file] of modelFileByTable) {
            if (source.includes(path.basename(file, '.ts'))) hit.add(t);
        }
        if (!hit.size) continue;

        for (const t of hit) {
            const s = touch(t);
            if (s.files.length < 3) s.files.push(rel);
            for (const [re, op] of OPS) s[op] += [...source.matchAll(re)].length ? 1 : 0;
            s.ambiguous = hit.size > 1 ? 1 : s.ambiguous || 0;
        }
    }
    if (process.env.AUDIT_DEBUG) {
        console.error(
            `[debug] files scanned: ${scanned}, tables with any reference: ${stats.size}`
        );
    }
    return stats;
};

// ---------------------------------------------------------------- Assemble
const schemaTables = parseSchemaTables();
const modelTables = parseModelTables();
const { owner: moduleOwner, modules: coopModules } = moduleManifests();
const migrations = parseMigrations();
const contract = JSON.parse(read(contractRel));
const remoteMap = contract.remoteTableMap || {};
const apiOnly = new Set(contract.apiOnlyTables || []);
// Tables intentionally kept on the device only (a local outbox whose rows are destroyed after the
// remote ACK). They must not be pushed, so a missing remote table and a missing soft-delete column
// are the designed state here -- but the entry itself is now audited, because a local-only table
// that also appears in remoteTableMap, or one no longer in schema.ts, is real drift.
const localOnlySet = new Set(contract.localOnlyTables || []);
const requiredColumns = contract.requiredRemoteColumns || {};
const coreSet = new Set(contract.coreTables || []);
const configSet = new Set(contract.configTables || []);

const modelFileByTable = new Map([...modelTables].map(([t, m]) => [t, m.file]));
const allNames = new Set([
    ...schemaTables.keys(),
    ...modelTables.keys(),
    ...Object.keys(remoteMap),
    ...Object.values(remoteMap),
    ...moduleOwner.keys(),
]);
const writes = parseWriteSurfaces(allNames, modelFileByTable);

const remoteToLocal = new Map(Object.entries(remoteMap).map(([l, r]) => [r, l]));

const DOMAIN_BY_PREFIX = [
    ['ws_', 'water-station'],
    ['agri_', 'agribusiness'],
    ['ph_', 'pharmacy'],
    ['tr_', 'transport'],
    ['store_', 'agri-store'],
    ['journal', 'accounting'],
    ['chart_of_accounts', 'accounting'],
    ['account', 'accounting'],
    ['payroll', 'payroll'],
    ['employee', 'payroll'],
    ['bank', 'banking'],
    ['cash', 'cash'],
    ['expense', 'expenses'],
    ['payment', 'lending'],
    ['loan', 'lending'],
    ['borrower', 'lending'],
    ['guarantor', 'lending'],
    ['savings', 'lending'],
    ['share_capital', 'lending'],
    ['collection', 'collections'],
    ['file_case', 'collections'],
    ['remittance', 'collections'],
    ['user', 'identity'],
    ['role', 'identity'],
    ['branch', 'identity'],
    ['area', 'identity'],
    ['config', 'settings'],
];

const domainOf = (table) =>
    moduleOwner.get(table) ||
    DOMAIN_BY_PREFIX.find(([p]) => table.startsWith(p) || table.includes(p))?.[1] ||
    'other';

const rows = [];
for (const table of new Set([...schemaTables.keys(), ...modelTables.keys(), ...Object.keys(remoteMap), ...localOnlySet, ...moduleOwner.keys()])) {
    const schemaCols = schemaTables.get(table) || new Set();
    const model = modelTables.get(table);
    const remote = remoteMap[table];
    const remoteDef = remote ? migrations.get(remote) : undefined;
    const remoteCols = remoteDef?.columns || new Set();
    const w = writes.get(table) || { create: 0, update: 0, delete: 0, upsert: 0, reads: 0, files: [] };
    const rw = remote ? writes.get(remote) : undefined;
    const total = {
        create: w.create + (rw ? rw.create : 0),
        update: w.update + (rw ? rw.update : 0),
        delete: w.delete + (rw ? rw.delete : 0),
        upsert: w.upsert + (rw ? rw.upsert : 0),
        reads: w.reads + (rw ? rw.reads : 0),
        ambiguous: (w.ambiguous || 0) + (rw ? rw.ambiguous || 0 : 0),
        files: [...new Set([...(w.files || []), ...((rw && rw.files) || [])])].slice(0, 4),
    };

    const issues = [];
    const declaredInManifest = moduleOwner.has(table);
    const phantom = declaredInManifest && !schemaCols.size && !model && !remote && !apiOnly.has(table);
    if (phantom) {
        // src/modules/{module}/manifest.ts advertises tables that exist in no layer at all.
        // Nothing may ever read or write them; db.get(table) would throw at runtime.
        issues.push('manifest-phantom-table');
    } else {
        if (!schemaCols.size) issues.push('no-schema');
        if (!model) issues.push('no-model');
        if (localOnlySet.has(table) && !schemaCols.size)
            issues.push('local-only-entry-not-in-schema');
        if (localOnlySet.has(table) && remote) issues.push('local-only-but-mapped');
        if (!remote && !apiOnly.has(table) && !localOnlySet.has(table))
            issues.push('not-in-sync-contract');
        if (!remote && localOnlySet.has(table) && schemaCols.size)
            // Visible exemption instead of silence: the row still says why it has no remote table.
            issues.push('local-only-outbox');
    }
    if (remote && !remoteDef) issues.push('remote-table-missing');
    if (remoteDef?.duplicateIn) issues.push(`duplicate-create:${remoteDef.duplicateIn}`);

    const localSoftDelete = schemaCols.has('deleted_at');
    const remoteSoftDelete = remoteCols.has('deleted_at');
    const group = coreSet.has(table)
        ? 'core'
        : configSet.has(table)
          ? 'config'
          : localOnlySet.has(table)
            ? 'local-only'
            : apiOnly.has(table)
              ? 'api-only'
              : 'unmapped';
    // A mapped table that is in neither group is never pushed, so column drift there is
    // informational only.
    const pushed = group === 'core' || group === 'config';
    if (remote && group === 'unmapped') issues.push('mapped-but-not-synced');
    if (remoteDef && pushed && localSoftDelete && !remoteSoftDelete) issues.push('deleted_at-not-remote');
    if (remoteDef && pushed && !localSoftDelete && remoteSoftDelete) issues.push('deleted_at-not-local');
    // A local-only outbox destroys its rows once the remote has ACKed them, so hard-delete with no
    // deleted_at column is the design, not a data-loss risk: nothing is ever pushed from here.
    if (total.delete > 0 && !localSoftDelete && !localOnlySet.has(table))
        issues.push('hard-delete-no-softdelete-column');

    for (const required of requiredColumns[remote] || []) {
        if (remoteDef && !remoteCols.has(required)) issues.push(`required-col-missing:${required}`);
    }
    if (remoteDef && pushed) {
        const localOnly = [...schemaCols].filter(
            (c) => !remoteCols.has(c) && !['id', 'created_at', 'updated_at', 'deleted_at'].includes(c)
        );
        if (localOnly.length) issues.push(`local-only-cols:${localOnly.join('|')}`);
    }
    if (remoteDef && !remoteDef.rls) issues.push('no-rls');
    if (total.create + total.update + total.delete + total.upsert === 0)
        issues.push(total.reads ? 'read-only-surface' : 'no-surface-at-all');
    if (total.create + total.update + total.delete + total.upsert > 0 && total.reads === 0 && !model)
        issues.push('write-only');

    rows.push({
        table,
        domain: domainOf(table),
        group,
        remote: remote || (apiOnly.has(table) ? '(api-only)' : '—'),
        columns: schemaCols.size,
        modelAttrs: model ? model.attrs.size : 0,
        remoteColumns: remoteCols.size,
        // `~` marks a reference-based (non-call-graph) attribution
        crud: `${total.create}/${total.update}/${total.delete}` + (total.ambiguous ? '~' : ''),
        surfaceFiles: total.files,
        rls: remoteDef ? (remoteDef.rls ? 'yes' : 'NO') : 'n/a',
        policies: remoteDef?.policies ?? 0,
        issues,
    });
}

// Remote tables nobody can reach from the client
const orphanRemotes = [...migrations.keys()]
    .filter((t) => /^app_/.test(t) && !remoteToLocal.has(t) && !writes.has(t))
    .map((t) => ({
        table: t,
        domain: domainOf(t.replace(/^app_/, '')),
        group: 'unmapped',
        remote: t,
        columns: 0,
        modelAttrs: 0,
        remoteColumns: migrations.get(t).columns.size,
        crud: '0/0/0',
        surfaceFiles: [],
        rls: migrations.get(t).rls ? 'yes' : 'NO',
        policies: migrations.get(t).policies ?? 0,
        issues: ['remote-table-unmapped'],
    }));

const moduleReport = coopModules.map((mod) => {
    const screens = modulePersistence(mod);
    const declared = mod.tables.map((t) => ({
        table: t,
        inSchema: schemaTables.has(t),
        inContract: Boolean(remoteMap[t]),
        inRemote: Boolean(migrations.get(remoteMap[t] || t)) || [...migrations.keys()].includes(t),
    }));
    return {
        module: mod.dir,
        declaredTables: declared,
        phantomTables: declared.filter((d) => !d.inSchema && !d.inContract && !d.inRemote).map((d) => d.table),
        screens: screens.map((s) => ({ route: s.route, file: s.file, persists: s.persists, models: s.models })),
        persisted: screens.length > 0 && screens.every((s) => s.persists),
    };
});

if (domainFilter) {
    const keep = (r) => r.domain === domainFilter;
    rows.splice(0, rows.length, ...rows.filter(keep));
    orphanRemotes.splice(0, orphanRemotes.length, ...orphanRemotes.filter(keep));
}

const all = [...rows, ...orphanRemotes].sort(
    (a, b) => a.domain.localeCompare(b.domain) || a.table.localeCompare(b.table)
);

const sev = (row) => {
    if (
        row.issues.some((i) =>
            /^(no-schema|no-model|remote-table-missing|not-in-sync-contract|required-col-missing|local-only-but-mapped|local-only-entry-not-in-schema)/.test(
                i
            )
        )
    )
        return 'HIGH';
    // Column-shape mismatches on a pushed table are hard failures, not warnings.
    // SyncService.sanitizeRecord strips only _status/_changed, so every local schema column
    // ships in the upsert payload; PostgREST answers PGRST204 for the whole batch. The only
    // push error the engine defers is a *missing table* on an optional (config) table --
    // never a missing or extra column. `deleted_at` is always sent by soft-delete upserts.
    const isPushed = row.group === 'core' || row.group === 'config';
    if (isPushed && row.issues.some((i) => /^(local-only-cols|deleted_at-not-remote)/.test(i))) return 'HIGH';
    // `local-only-outbox` is a stated design fact, not a finding.
    const actionable = row.issues.filter((i) => i !== 'local-only-outbox');
    return actionable.length ? 'MED' : 'ok';
};

const severities = all.map(sev);
const highRows = all.filter((row, i) => severities[i] === 'HIGH');
const phantomModules = moduleReport.filter((m) => m.phantomTables.length);

if (asJson) {
    console.log(JSON.stringify({
        tables: all,
        modules: moduleReport,
        summary: {
            high: highRows.length,
            med: severities.filter((s) => s === 'MED').length,
            clean: severities.filter((s) => s === 'ok').length,
            phantomManifestTables: phantomModules.flatMap((m) => m.phantomTables.map((t) => `${m.module}: ${t}`))
        }
    }, null, 2));
    if (failOnHigh && highRows.length) process.exit(1);
    process.exit(0);
}

let domain = '';
const tally = { HIGH: 0, MED: 0, ok: 0 };
const issueTally = new Map();
for (const row of all) {
    const s = sev(row);
    tally[s] += 1;
    for (const i of row.issues) {
        const key = i.split(':')[0];
        issueTally.set(key, (issueTally.get(key) || 0) + 1);
    }
    if (row.domain !== domain) {
        domain = row.domain;
        console.log(`\n${'='.repeat(96)}\n  DOMAIN: ${domain}\n${'='.repeat(96)}`);
        console.log('sev  table                             remote                          cols(l/m/r)  C/U/D   rls  issues');
    }
    const cols = `${row.columns}/${row.modelAttrs}/${row.remoteColumns}`;
    console.log(
        `${s.padEnd(5)}${row.table.padEnd(33)}${String(row.remote).padEnd(31)}${cols.padEnd(13)}` +
            `${row.crud.padEnd(8)}${String(row.rls).padEnd(5)} ${row.issues.join(', ')}`
    );
}

console.log(`\n${'='.repeat(96)}\n  SUMMARY\n${'='.repeat(96)}`);
console.log(`tables audited: ${all.length}   HIGH: ${tally.HIGH}   MED: ${tally.MED}   clean: ${tally.ok}`);
console.log('\nissue frequency:');
for (const [k, v] of [...issueTally].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
console.log(`\nsources: schema.ts=${schemaTables.size} models=${modelTables.size} contract=${Object.keys(remoteMap).length} migrations=${migrations.size} apiOnly=${apiOnly.size}`);

console.log(`\n${'='.repeat(96)}\n  COOP MODULES (src/modules/*/manifest.ts vs the screens they route to)\n${'='.repeat(96)}`);
for (const m of moduleReport) {
    const verdict = m.persisted ? 'persistent' : 'NO PERSISTENCE';
    console.log(`${m.module.padEnd(16)} ${verdict.padEnd(17)} tables=${m.declaredTables.length} phantom=${m.phantomTables.length || '-'}`);
    for (const s of m.screens)
        console.log(`    ${(s.route || '(no route)').padEnd(42)} ${s.persists ? `uses ${s.models.join('+') || 'db/service'}` : 'useState only'}  ${s.file || 'FILE MISSING'}`);
    if (m.phantomTables.length) console.log(`    declared but absent from schema/contract/migrations: ${m.phantomTables.join(', ')}`);
}

// CI gate. HIGH here means "a sync push to this table is rejected by PostgREST and retried
// forever", so it is a build failure rather than a report line. The same invariant is asserted
// without credentials in src/database/schemaContracts.regression.test.ts.
if (failOnHigh) {
    if (highRows.length) {
        console.log(`\nFAIL: ${highRows.length} HIGH table(s) -- ${process.argv[1]} --fail-on-high`);
        for (const row of highRows) console.log(`  ${row.table} -> ${row.remote}: ${row.issues.join(', ')}`);
        process.exit(1);
    }
    if (phantomModules.length) {
        console.log(`\nFAIL: coop manifests claim tables that exist in no layer -- ${process.argv[1]} --fail-on-high`);
        for (const m of phantomModules) console.log(`  ${m.module}: ${m.phantomTables.join(', ')}`);
        process.exit(1);
    }
    console.log('\nPASS: no HIGH table findings and no phantom manifest tables.');
}
