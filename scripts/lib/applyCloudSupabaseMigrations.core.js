/**
 * Core logic for scripts/apply-cloud-supabase-migrations.mjs — pure enough to
 * unit-test with an injected fake client (see scripts/__tests__/applyCloudSupabaseMigrations.test.js).
 *
 * Ledger-compatible with scripts/apply-hetzner-migrations.mjs: same table
 * (deploy_schema_migrations), same app_name ('jetfarm'), same legacy alias
 * ('infinityfinance'), same fail-loudly behavior, and the same rule that the
 * destructive 2026-04-01 bootstrap NEVER runs against a non-empty database.
 *
 * This module performs no I/O of its own: the caller injects a `client` with
 * `query(sql, params?)` (the `pg` Client satisfies it).
 */

const APP_NAME = "jetfarm";
const LEDGER_TABLE = "deploy_schema_migrations";
const DESTRUCTIVE_BOOTSTRAP_RE = /^20260401000000_initial_schema/;
const SAFE_VERSION_RE = /^[0-9A-Za-z_-]+$/;

const LEDGER_BOOTSTRAP_SQL =
  "CREATE TABLE IF NOT EXISTS deploy_schema_migrations (" +
  "app_name text NOT NULL, version text NOT NULL, applied_at timestamptz DEFAULT now(), " +
  "PRIMARY KEY(app_name, version));";

// Fresh-target probe. The ledger table itself must not make a fresh target look
// "already used" — review finding B1: count-before-create made --include-bootstrap
// permanently self-denying without this exclusion.
const LIVE_TABLE_COUNT_SQL =
  "SELECT count(*)::int AS n FROM information_schema.tables " +
  "WHERE table_schema='public' AND table_name <> 'deploy_schema_migrations';";

// Read-only existence probe so a DRY RUN never writes (review finding M1).
const LEDGER_EXISTS_SQL =
  "SELECT EXISTS(SELECT 1 FROM information_schema.tables " +
  "WHERE table_schema='public' AND table_name='deploy_schema_migrations') AS ex;";

const PGRST_RELOAD_SQL = "NOTIFY pgrst, 'reload schema';";

// Statements Postgres refuses to run inside a transaction block. A file
// containing any of these is executed unwrapped (autocommit batch), exactly as
// the Hetzner psql path ran it.
const NON_TRANSACTIONABLE_RE =
  /\b(CREATE\s+ROLE|DROP\s+ROLE|CREATE\s+DATABASE|DROP\s+DATABASE|ALTER\s+SYSTEM|CREATE\s+SUBSCRIPTION|DROP\s+SUBSCRIPTION|VACUUM)\b/i;

// A migration file's own transaction markers would COMMIT the runner's outer
// transaction mid-file (review finding B2 — 4 files self-BEGIN/COMMIT). They
// are stripped when wrapping; unwrapped files keep their SQL verbatim.
// The semicolon is REQUIRED so plpgsql `DO $$ BEGIN ... END $$` block openers
// (no semicolon) are never mistaken for top-level transaction markers.
const TX_MARKER_LINE_RE = /^[ \t]*(BEGIN|COMMIT)[ \t]*;[ \t]*$/gim;

function assertSafeVersion(version) {
  if (!SAFE_VERSION_RE.test(version)) {
    throw new Error(`unsafe migration version name: ${JSON.stringify(version)}`);
  }
  return version;
}

/**
 * Decide how one migration file must execute.
 * Returns { wrap, sql } — sql has file-own BEGIN/COMMIT lines removed iff wrap.
 */
function chooseExecution(sql) {
  if (NON_TRANSACTIONABLE_RE.test(sql)) return { wrap: false, sql };
  return { wrap: true, sql: sql.replace(TX_MARKER_LINE_RE, "") };
}

/**
 * TLS options for the pg client. There is deliberately NO verification
 * bypass: a cloud target is reached over the public internet carrying the
 * database password, so `rejectUnauthorized` is always true here.
 *
 * Supabase Cloud's Postgres/TLS chain terminates at its own private
 * "Supabase Root 2021 CA" (leaf CN is `*.pooler.supabase.com`), which is in no
 * system trust store and has no AIA extension to fetch it from — so a plain
 * verified connection fails with SELF_SIGNED_CERT_IN_CHAIN until the operator
 * downloads the CA certificate from Dashboard -> Settings -> Database and
 * passes it via JF_CLOUD_PG_CA_FILE. `servername` is set explicitly because pg
 * does not derive SNI on its own.
 */
function buildTlsOptions({ sslMode, host, caPem } = {}) {
  if (sslMode === "off") return undefined;
  if (caPem) return { ca: caPem, servername: host, rejectUnauthorized: true };
  return { rejectUnauthorized: true };
}

/**
 * Parse the --only flag. FAILS CLOSED: a present-but-empty value is an error,
 * not "no filter" (review finding M2 — a narrowing flag must never widen).
 */
function parseOnlyFlag(args) {
  const idx = args.indexOf("--only");
  if (idx < 0) return { only: [], error: null };
  const raw = args[idx + 1] || "";
  const only = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!only.length) {
    return { only: [], error: "--only was given but resolved to zero version prefixes; refusing to run the unfiltered plan." };
  }
  return { only, error: null };
}

/**
 * Ordered queue of migrations to run.
 * - files: raw directory listing (non-.sql entries ignored)
 * - applied: Set<string> of ledger versions
 * - includeBootstrap: keep the destructive bootstrap (guard separately, see guardBootstrap)
 * - only: array of version prefixes to narrow to
 */
function planPending({ files, applied, includeBootstrap = false, only = [] }) {
  const queue = files
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((file) => ({ file, version: assertSafeVersion(file.replace(/\.sql$/, "")) }))
    .filter(({ version }) => includeBootstrap || !DESTRUCTIVE_BOOTSTRAP_RE.test(version))
    .filter(({ version }) => !applied.has(version))
    .filter(({ version }) => (only.length ? only.some((o) => version.startsWith(o)) : true));
  return queue;
}

/**
 * The bootstrap drops and recreates base tables; it is only admissible on a
 * fresh target. This is a hard data-loss guard, not a warning.
 */
function guardBootstrap({ includeBootstrap, liveTableCount }) {
  if (!includeBootstrap) return { allowed: true, reason: "bootstrap not requested" };
  if (Number(liveTableCount) > 0) {
    return {
      allowed: false,
      reason:
        `target public schema is not empty (${liveTableCount} table(s), ledger table excluded from the count); ` +
        "refusing destructive bootstrap. This runner is for fresh targets only — " +
        "for existing databases use the Hetzner ledger path.",
    };
  }
  return { allowed: true, reason: "fresh empty target, bootstrap admitted" };
}

async function readAppliedVersions(client) {
  const res = await client.query(
    `SELECT version FROM ${LEDGER_TABLE} WHERE app_name = ANY($1)`,
    [[APP_NAME, "infinityfinance"]]
  );
  return new Set((res.rows || []).map((r) => r.version));
}

/**
 * Execute the plan. Dry-run makes ZERO client calls. Each migration runs in
 * its own transaction (or unwrapped when it contains non-transactionable
 * statements) with a parameterized ledger insert; the FIRST failure rolls back
 * and aborts the whole plan (fail loudly, unlike deploy-hetzner Stage 2 which
 * warns and continues). The destructive bootstrap needs BOTH a planned entry
 * (planPending) and allowBootstrap here — belt and braces (review finding m3).
 */
async function runPlan({ queue, client, readFile, apply, allowBootstrap = false }) {
  const summary = { plan: queue.map(({ version }) => version), applied: [] };
  if (!apply) return summary;

  const destructive = queue.filter(({ version }) => DESTRUCTIVE_BOOTSTRAP_RE.test(version));
  if (destructive.length && !allowBootstrap) {
    throw new Error(
      `runPlan refused: queue contains the destructive bootstrap (${destructive.map((d) => d.version).join(", ")}) ` +
        "without allowBootstrap=true"
    );
  }

  for (const { file, version } of queue) {
    const { wrap, sql } = chooseExecution(readFile(file));
    try {
      if (wrap) await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        `INSERT INTO ${LEDGER_TABLE} (app_name, version) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [APP_NAME, version]
      );
      if (wrap) await client.query("COMMIT");
      summary.applied.push(version);
    } catch (err) {
      if (wrap) {
        try {
          await client.query("ROLLBACK");
        } catch (_) {
          /* connection already broken; aborting anyway */
        }
      }
      const wrapped = new Error(`migration ${version} failed and plan aborted: ${err.message}`, { cause: err });
      throw wrapped;
    }
  }

  await client.query(PGRST_RELOAD_SQL);
  return summary;
}

module.exports = {
  APP_NAME,
  LEDGER_TABLE,
  LEDGER_BOOTSTRAP_SQL,
  LIVE_TABLE_COUNT_SQL,
  LEDGER_EXISTS_SQL,
  PGRST_RELOAD_SQL,
  DESTRUCTIVE_BOOTSTRAP_RE,
  planPending,
  guardBootstrap,
  chooseExecution,
  buildTlsOptions,
  parseOnlyFlag,
  readAppliedVersions,
  runPlan,
};
