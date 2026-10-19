/**
 * TDD: scripts/lib/applyCloudSupabaseMigrations.core.js
 * Provisions a FRESH Supabase Cloud project with the repo's supabase/migrations
 * using the same `deploy_schema_migrations` ledger semantics as the Hetzner
 * runner (scripts/apply-hetzner-migrations.mjs), but over a direct pg client
 * and with a bootstrap guard: the destructive 20260401000000 bootstrap may only
 * run against a target whose public schema is empty.
 */
const core = require("../lib/applyCloudSupabaseMigrations.core.js");

function fakeClient(handlers = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      for (const [re, fn] of Object.entries(handlers)) {
        if (new RegExp(re).test(sql)) return fn(sql, params);
      }
      return { rows: [] };
    },
  };
}

describe("planPending", () => {
  const files = [
    "20260401000000_initial_schema.sql",
    "20260402102153_fix_users.sql",
    "20261002000000_retire_legacy_payroll_foreign_key.sql",
    "20261019000000_sync_push_repair_production_drift.sql",
    "notes.txt",
  ];

  it("sorts, keeps only .sql, and with includeBootstrap=true includes the bootstrap first", () => {
    const q = core.planPending({ files, applied: new Set(), includeBootstrap: true });
    expect(q.map((m) => m.version)).toEqual([
      "20260401000000_initial_schema",
      "20260402102153_fix_users",
      "20261002000000_retire_legacy_payroll_foreign_key",
      "20261019000000_sync_push_repair_production_drift",
    ]);
    expect(q[0].file).toBe("20260401000000_initial_schema.sql");
  });

  it("skips the destructive bootstrap when includeBootstrap is false", () => {
    const q = core.planPending({ files, applied: new Set(), includeBootstrap: false });
    expect(q.map((m) => m.version)).not.toContain("20260401000000_initial_schema");
    expect(q).toHaveLength(3);
  });

  it("skips versions already in the ledger (jetfarm or legacy infinityfinance)", () => {
    const applied = new Set(["20260401000000_initial_schema", "20260402102153_fix_users"]);
    const q = core.planPending({ files, applied, includeBootstrap: true });
    expect(q.map((m) => m.version)).toEqual([
      "20261002000000_retire_legacy_payroll_foreign_key",
      "20261019000000_sync_push_repair_production_drift",
    ]);
  });

  it("honors --only prefix filtering", () => {
    const q = core.planPending({
      files,
      applied: new Set(),
      includeBootstrap: true,
      only: ["20261019"],
    });
    expect(q.map((m) => m.version)).toEqual(["20261019000000_sync_push_repair_production_drift"]);
  });

  it("rejects version names that are not ledger-safe", () => {
    expect(() =>
      core.planPending({
        files: ["20260401000000_initial_schema.sql", "evil'; DROP TABLE x; --.sql"],
        applied: new Set(),
        includeBootstrap: true,
      })
    ).toThrow(/unsafe/i);
  });
});

describe("bootstrap guard", () => {
  it("allows bootstrap only on an empty public schema", () => {
    expect(core.guardBootstrap({ includeBootstrap: true, liveTableCount: 0 })).toMatchObject({ allowed: true });
    const denied = core.guardBootstrap({ includeBootstrap: true, liveTableCount: 12 });
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toMatch(/not empty|non-empty/i);
  });

  it("ignores liveTableCount when includeBootstrap is false", () => {
    expect(core.guardBootstrap({ includeBootstrap: false, liveTableCount: 999 })).toMatchObject({ allowed: true });
  });
});

describe("ledger contract parity with Hetzner runner", () => {
  it("bootstrap DDL creates deploy_schema_migrations keyed by (app_name, version) IF NOT EXISTS", () => {
    const ddl = core.LEDGER_BOOTSTRAP_SQL;
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS deploy_schema_migrations/i);
    expect(ddl).toMatch(/PRIMARY KEY\s*\(\s*app_name\s*,\s*version\s*\)/i);
  });

  it("readApplied includes jetfarm and legacy infinityfinance rows", async () => {
    const client = fakeClient({
      "FROM deploy_schema_migrations": () => ({ rows: [{ version: "20260402102153_fix_users" }] }),
    });
    const applied = await core.readAppliedVersions(client);
    expect(applied.has("20260402102153_fix_users")).toBe(true);
    const { sql, params } = client.calls[0];
    expect(sql).toMatch(/deploy_schema_migrations/);
    expect(params[0]).toEqual(expect.arrayContaining(["jetfarm", "infinityfinance"]));
  });
});

describe("chooseExecution", () => {
  it("strips file-own BEGIN/COMMIT and keeps the runner wrapper (B2: 4 migrations self-commit)", () => {
    const sql = "BEGIN;\nCREATE TABLE t (id int);\nINSERT INTO t VALUES (1);\nCOMMIT;\n";
    const ex = core.chooseExecution(sql);
    expect(ex.wrap).toBe(true);
    expect(ex.sql).not.toMatch(/^\s*BEGIN\s*;/im);
    expect(ex.sql).not.toMatch(/^\s*COMMIT\s*;/im);
    expect(ex.sql).toMatch(/CREATE TABLE t/);
  });

  it("does NOT wrap files with non-transactionable statements (CREATE ROLE etc.)", () => {
    const sql = "DO $$ BEGIN EXECUTE 'CREATE ROLE x LOGIN'; END $$;";
    const ex = core.chooseExecution(sql);
    expect(ex.wrap).toBe(false);
    expect(ex.sql).toBe(sql);
  });

  it("plain DDL stays wrapped unchanged", () => {
    const sql = "CREATE INDEX foo_idx ON bar (id);";
    const ex = core.chooseExecution(sql);
    expect(ex.wrap).toBe(true);
    expect(ex.sql).toBe(sql);
  });

  it("never strips plpgsql BEGIN block openers — only standalone BEGIN;/COMMIT; lines go", () => {
    const sql = "BEGIN;\nDO $$ BEGIN EXECUTE 'SELECT 1'; END $$;\nCOMMIT;\n";
    const ex = core.chooseExecution(sql);
    expect(ex.wrap).toBe(true);
    expect(ex.sql).toMatch(/DO \$\$ BEGIN EXECUTE/);
    expect(ex.sql).not.toMatch(/^COMMIT\s*;/m);
  });

  // The real B3 hazard shape: a function body whose BEGIN sits on a line of its
  // own, indistinguishable from a transaction marker unless the semicolon is
  // required. Mutation check confirms this test fails when ";?" makes it optional.
  it("keeps a bare BEGIN line inside a multi-line DO block while stripping the file's own BEGIN;", () => {
    const sql =
      "BEGIN;\n" +
      "CREATE FUNCTION f() RETURNS void AS $$\n" +
      "BEGIN\n" +
      "  PERFORM 1;\n" +
      "END\n" +
      "$$ LANGUAGE plpgsql;\n" +
      "COMMIT;\n";
    const ex = core.chooseExecution(sql);
    expect(ex.wrap).toBe(true);
    expect(ex.sql).toMatch(/^BEGIN$/m); // in-function opener survives
    expect(ex.sql).not.toMatch(/^\s*BEGIN\s*;/m); // file's own marker gone
    expect(ex.sql).not.toMatch(/^\s*COMMIT\s*;/m);
  });
});

describe("parseOnlyFlag", () => {
  it("absent flag means no filter", () => {
    expect(core.parseOnlyFlag([])).toEqual({ only: [], error: null });
  });
  it("present-but-empty value FAILS CLOSED (M2)", () => {
    expect(core.parseOnlyFlag(["--only"]).error).toMatch(/--only/i);
    expect(core.parseOnlyFlag(["--only", ""]).error).toMatch(/--only/i);
  });
  it("parses comma lists", () => {
    expect(core.parseOnlyFlag(["--only", "20261019,20261002"])).toEqual({
      only: ["20261019", "20261002"],
      error: null,
    });
  });
});

describe("fresh-target ledger probes", () => {
  it("live table count excludes the ledger table itself (B1)", () => {
    expect(core.LIVE_TABLE_COUNT_SQL).toMatch(/deploy_schema_migrations/);
    expect(core.LIVE_TABLE_COUNT_SQL).toMatch(/<>/i);
  });
  it("ledger existence probe is read-only (no CREATE in dry run, M1)", () => {
    expect(core.LEDGER_EXISTS_SQL).toMatch(/^SELECT/i);
    expect(core.LEDGER_EXISTS_SQL).not.toMatch(/CREATE/i);
  });
});

describe("runPlan transaction semantics", () => {
  it("unwrapped (CREATE ROLE) files run without BEGIN/COMMIT but still record the ledger", async () => {
    const queue = [{ file: "20260911050000_metabase_readonly_role.sql", version: "20260911050000_metabase_readonly_role" }];
    const client = fakeClient();
    const readFile = () => "CREATE ROLE metabase_reader LOGIN PASSWORD 'x';";
    const summary = await core.runPlan({ queue, client, readFile, apply: true });
    const sqls = client.calls.map((c) => c.sql);
    expect(sqls.some((s) => /^BEGIN/i.test(s))).toBe(false);
    expect(sqls.some((s) => /^COMMIT/i.test(s))).toBe(false);
    expect(sqls.some((s) => /INSERT INTO deploy_schema_migrations/i.test(s))).toBe(true);
    expect(summary.applied).toEqual(["20260911050000_metabase_readonly_role"]);
  });

  it("COMMIT failure means the version is NOT recorded as applied", async () => {
    const queue = [{ file: "20260501000000_a.sql", version: "20260501000000_a" }];
    const client = fakeClient({ "^COMMIT": () => { throw new Error("connection lost"); } });
    await expect(core.runPlan({ queue, client, readFile: () => "SELECT 1;", apply: true })).rejects.toThrow(/20260501000000_a/);
    const summaryCalls = client.calls.map((c) => c.sql);
    expect(summaryCalls).toContain("ROLLBACK");
    // the INSERT ran inside the transaction that failed to COMMIT, so the database
    // never recorded the version — and runPlan must not list it as applied either.
    expect(summaryCalls.some((s) => /NOTIFY pgrst/i.test(s))).toBe(false);
  });

  it("refuses a destructive bootstrap in the queue unless allowBootstrap=true", async () => {
    const queue = [{ file: "20260401000000_initial_schema.sql", version: "20260401000000_initial_schema" }];
    const client = fakeClient();
    await expect(
      core.runPlan({ queue, client, readFile: () => "SELECT 1;", apply: true })
    ).rejects.toThrow(/bootstrap/i);
    expect(client.calls).toHaveLength(0);
    const ok = await core.runPlan({ queue, client, readFile: () => "SELECT 1;", apply: true, allowBootstrap: true });
    expect(ok.applied).toEqual(["20260401000000_initial_schema"]);
  });
});

describe("runPlan", () => {
  const queue = [
    { file: "20260401000000_initial_schema.sql", version: "20260401000000_initial_schema" },
    { file: "20260402102153_fix_users.sql", version: "20260402102153_fix_users" },
  ];
  const readFile = (name) => `-- SQL for ${name}\nSELECT 1;`;

  it("dry-run touches nothing", async () => {
    const client = fakeClient();
    const summary = await core.runPlan({ queue, client, readFile, apply: false });
    expect(summary.applied).toHaveLength(0);
    expect(client.calls).toHaveLength(0);
    expect(summary.plan).toEqual(queue.map((m) => m.version));
  });

  it("applies each migration in its own transaction and records it in the ledger", async () => {
    const client = fakeClient();
    const summary = await core.runPlan({ queue, client, readFile, apply: true, allowBootstrap: true });
    expect(summary.applied).toEqual(["20260401000000_initial_schema", "20260402102153_fix_users"]);
    const sqls = client.calls.map((c) => c.sql);
    expect(sqls[0]).toMatch(/^BEGIN/i);
    expect(sqls[1]).toMatch(/SQL for 20260401000000_initial_schema/);
    expect(sqls[2]).toMatch(/INSERT INTO deploy_schema_migrations/i);
    expect(client.calls[2].params).toEqual(["jetfarm", "20260401000000_initial_schema"]);
    expect(sqls[3]).toMatch(/^COMMIT/i);
    expect(sqls.filter((s) => /^BEGIN/i.test(s))).toHaveLength(2);
  });

  it("rolls back and aborts the whole plan on first failing migration", async () => {
    const client = fakeClient({
      "SQL for 20260402102153_fix_users": () => {
        throw new Error("boom: syntax error");
      },
    });
    await expect(
      core.runPlan({ queue, client, readFile, apply: true, allowBootstrap: true })
    ).rejects.toThrow(/20260402102153_fix_users/);
    const sqls = client.calls.map((c) => c.sql);
    expect(sqls).toContain("ROLLBACK");
    // only the first migration reached the ledger; the plan aborted before any retry
    expect(sqls.filter((s) => /INSERT INTO deploy_schema_migrations/i.test(s))).toHaveLength(1);
    expect(sqls.some((s) => /NOTIFY pgrst/i.test(s))).toBe(false);
  });

  it("NOTIFY pgrst reload is emitted after a fully applied plan", async () => {
    const client = fakeClient();
    await core.runPlan({ queue, client, readFile, apply: true, allowBootstrap: true });
    const sqls = client.calls.map((c) => c.sql);
    expect(sqls.some((s) => /NOTIFY pgrst/i.test(s))).toBe(true);
  });
});
