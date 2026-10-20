/**
 * Guard for scripts/audit-crud-persistence.mjs -- the gate behind `npm run audit:crud:gate`.
 *
 * Why this exists: src/services/syncTableContract.json declares
 * `localOnlyTables: ['agri_pending_layout_operations']` -- a local outbox whose rows are
 * destroyed after the remote ACK, so it intentionally has no remote table and no `deleted_at`
 * column. src/database/schemaContracts.regression.test.ts:700 pins that contract entry as the
 * designed state. The auditor parsed `localOnlyTables` and then never used it, so it flagged the
 * table HIGH on `not-in-sync-contract` + `hard-delete-no-softdelete-column` and the gate has been
 * red for every L3/L4 push since commit c7dceeb (2026-10-17). The two sources disagreed about
 * which one was the bug.
 *
 * These tests lock the reconciliation: the outbox is informational, not HIGH, and the contract
 * itself stays machine-checked -- a table listed local-only must not also be pushable, and a
 * local-only table must exist in the schema or the entry is stale.
 */
const path = require('path');
const { execFileSync } = require('child_process');

const AUDITOR = path.join(__dirname, '..', 'audit-crud-persistence.mjs');
const OUTBOX = 'agri_pending_layout_operations';

function runAuditor(extraArgs = []) {
    try {
        const stdout = execFileSync(process.execPath, [AUDITOR, '--json', ...extraArgs], {
            cwd: path.join(__dirname, '..', '..'),
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
        });
        return { json: JSON.parse(stdout), status: 0 };
    } catch (err) {
        return {
            json: err.stdout ? JSON.parse(err.stdout) : null,
            status: err.status,
            stderr: String(err.stderr || ''),
        };
    }
}

describe('audit-crud-persistence honours contract.localOnlyTables', () => {
    let result;
    let row;

    beforeAll(() => {
        result = runAuditor();
        row = result.json.tables.find((t) => t.table === OUTBOX);
    }, 120000);

    it('audits the whole tree and stays machine-readable', () => {
        expect(result.status).toBe(0);
        expect(result.json.summary).toEqual(
            expect.objectContaining({ high: expect.any(Number), clean: expect.any(Number) })
        );
        expect(row).toBeTruthy();
    });

    it('does not report the local-only outbox as not-in-sync-contract', () => {
        expect(row.issues).not.toContain('not-in-sync-contract');
    });

    it('does not demand a soft-delete column on an outbox that hard-deletes after ACK', () => {
        expect(row.issues.some((i) => /^hard-delete-no-softdelete-column$/.test(i))).toBe(false);
    });

    it('still records the outbox as intentionally local, so the exemption is visible', () => {
        expect(row.issues).toContain('local-only-outbox');
        expect(row.group).toBe('local-only');
    });

    it('passes --fail-on-high with zero HIGH findings', () => {
        const gated = runAuditor(['--fail-on-high']);
        expect(gated.json.summary.high).toBe(0);
        expect(gated.status).toBe(0);
    });

    it('keeps real drift HIGH: a local-only table may not also be in remoteTableMap', () => {
        // Mutation harness: the exemption must be provable as an exemption of THAT table only,
        // not a blanket silence. Re-run the same audit against a contract where the outbox is
        // also pushable and expect a HIGH. --contract points at one file; every other source is
        // still the real repo, so the probe cannot pass by having nothing to compare.
        const fs = require('fs');
        const contractPath = path.join('src', 'services', 'syncTableContract.json');
        const original = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
        const mutated = JSON.parse(JSON.stringify(original));
        mutated.remoteTableMap[OUTBOX] = 'app_pending_layout_operations';
        const rel = path.join('tmp', 'syncTableContract.localonly-probe.json');
        fs.mkdirSync(path.dirname(rel), { recursive: true });
        fs.writeFileSync(rel, JSON.stringify(mutated, null, 2));
        try {
            const probed = runAuditor(['--contract', rel, '--fail-on-high']);
            expect(probed.status).not.toBe(0);
            const rowProbe = probed.json.tables.find((t) => t.table === OUTBOX);
            expect(rowProbe.issues).toContain('local-only-but-mapped');
            expect(probed.json.summary.high).toBeGreaterThan(0);
        } finally {
            fs.rmSync(rel, { force: true });
        }
    });

    it('flags a stale localOnlyTables entry that no longer exists in schema.ts', () => {
        const fs = require('fs');
        const contractPath = path.join('src', 'services', 'syncTableContract.json');
        const original = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
        const mutated = JSON.parse(JSON.stringify(original));
        mutated.localOnlyTables = [...mutated.localOnlyTables, 'table_that_was_never'];
        const rel = path.join('tmp', 'syncTableContract.localonly-stale.json');
        fs.mkdirSync(path.dirname(rel), { recursive: true });
        fs.writeFileSync(rel, JSON.stringify(mutated, null, 2));
        try {
            const probed = runAuditor(['--contract', rel]);
            const stale = probed.json.tables.find((t) => t.table === 'table_that_was_never');
            expect(stale.issues).toContain('local-only-entry-not-in-schema');
            expect(probed.json.summary.high).toBeGreaterThan(0);
        } finally {
            fs.rmSync(rel, { force: true });
        }
    });
});
