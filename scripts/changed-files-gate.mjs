#!/usr/bin/env node
/**
 * changed-files-gate.mjs — risk-tier classifier and local quality gate runner.
 *
 * Implements the L0–L5 path-tier table from docs/AI-ASSISTED-DEV-WORKFLOW-PLAN.md §4.
 * Used by husky hooks (pre-commit / pre-push) and manually by agents/developers.
 *
 * Usage:
 *   node scripts/changed-files-gate.mjs --run=report   [--base=origin/main]   classify only
 *   node scripts/changed-files-gate.mjs --run=pre-commit   classify staged files + fast gates
 *   node scripts/changed-files-gate.mjs --run=pre-push     classify pushed range + targeted tests
 *                                                           + tier enforcement:
 *                                                           · L3/L4 require fresh check:sync +
 *                                                             audit:crud:gate evidence
 *                                                           · L5 blocks unless GATE_ALLOW_L5=1
 *
 * Exit codes:
 *   0 = all required gates passed (or report-only run)
 *   1 = a gate failed — do NOT commit/push
 *   2 = a hard policy was violated (env file staged, root clutter, L5 without human mode)
 *
 * Env knobs:
 *   GATE_SKIP_JEST=1   skip jest in pre-push (CI still re-runs everything)
 *   GATE_SKIP_TSC=1    skip tsc --noEmit in pre-push
 *   GATE_SKIP_INTEGRITY=1  skip the L3/L4 evidence check (CI still re-runs everything)
 *   GATE_ALLOW_L5=1    human override to allow an L5 push (CI still validates)
 *   GATE_EVIDENCE_DIR  override evidence output dir (default tmp/systematic-test-matrix)
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'fs';
import path from 'path';
import envStagingPolicy from './lib/envStagingPolicy.js';
import tierPolicy from './lib/tierPolicy.js';

const { blockedEnvFiles } = envStagingPolicy;

const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Tier definitions (checked in order: L5 first, default L2)
// ---------------------------------------------------------------------------

const L5_PATTERNS = [
  /^\.env/,
  /^supabase\/migrations\//,
  /^scripts\/deploy-/,
  /^scripts\/pipeline-/,
  /^scripts\/apply-.*migration/,
  /^scripts\/export-web-/,
  /^scripts\/.*prod/,
  /^scripts\/build-android-production/,
  /^scripts\/sync-version/,
  /^\.github\/workflows\//,
];

const L4_PATTERNS = [
  /^src\/services\/AutoPostingService\.ts$/,
  /^src\/services\/ChartOfAccountsService\.ts$/,
  /^src\/services\/Accounts(Receivable|Payable)/,
  /^src\/services\/.*[Jj]ournal/,
  /^src\/services\/Cash/,
  /^src\/services\/ExcessCashReceipt/,
  /^src\/services\/Cooperative(Fund|Savings)/,
  /^src\/services\/Dividend/,
  /^src\/services\/.*Ledger/,
  /^app\/\(admin\)\/accounting\//,
];

const L3_PATTERNS = [
  /^src\/database\//,
  /^src\/services\/SyncService\.ts$/,
  /^src\/services\/AutoSyncService\.ts$/,
  /^src\/services\/BaseModelService\.ts$/,
  /^src\/services\/EncryptionService\.ts$/,
];

const L1_PATTERNS = [
  /^src\/components\//,
  /^tailwind\.config\./,
  /\.css$/,
];

const L0_PATTERNS = [
  /^docs\//,
  /^\.agents\/(skills|workflows)\/.*\.md$/,
  /\.md$/,
];

const TIERS = ['L5', 'L4', 'L3', 'L2', 'L1', 'L0'];

const TIER_LABELS = {
  L0: 'Docs',
  L1: 'UI leaf',
  L2: 'Feature',
  L3: 'Data core',
  L4: 'Accounting',
  L5: 'Infra / schema / deploy',
};

// Tier tables + enforcement decisions live in scripts/lib/tierPolicy.js —
// single source of truth shared with the Jest suite (scripts/__tests__/tierPolicy.test.js).

// Whitelist of files allowed to live directly in the project root.
const ROOT_ALLOWLIST = new Set([
  '.gitignore', '.eslintrc.js', 'eslint.config.js', 'app.json', 'babel.config.js',
  'index.js', 'jest.config.js', 'jest.config.ts', 'metro.config.js', 'nativewind-env.d.ts',
  'package.json', 'package-lock.json', 'README.md', 'AGENTS.md', 'tsconfig.json',
  'tailwind.config.js', 'tailwind.config.ts', 'playwright.config.ts', 'expo-env.d.ts',
  '.prettierrc', '.prettierignore', '.npmrc', 'docker-compose.yml', 'Caddyfile',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function classify(file) {
  if (L5_PATTERNS.some((r) => r.test(file))) return 'L5';
  if (L4_PATTERNS.some((r) => r.test(file))) return 'L4';
  if (L3_PATTERNS.some((r) => r.test(file))) return 'L3';
  if (L0_PATTERNS.some((r) => r.test(file))) return 'L0';
  if (L1_PATTERNS.some((r) => r.test(file))) return 'L1';
  return 'L2';
}

function getFiles(mode, base) {
  if (mode === 'pre-commit') {
    return git(`diff --cached --name-only --diff-filter=ACMR`);
  }
  if (mode === 'pre-push') {
    // pre-push passes refs on stdin when invoked by git; fall back to base diff.
    let range = base;
    if (!range) {
      try {
        execSync('git rev-parse --abbrev-ref @{u}', { cwd: ROOT, stdio: 'ignore' });
        range = '@{u}';
      } catch {
        range = 'origin/main';
      }
    }
    try {
      return git(`diff --name-only --diff-filter=ACMR ${range}...HEAD`);
    } catch {
      return git(`diff --name-only --diff-filter=ACMR ${range}`);
    }
  }
  // report mode
  if (base) return git(`diff --name-only --diff-filter=ACMR ${base}...HEAD`);
  const staged = git('diff --cached --name-only --diff-filter=ACMR');
  if (staged.length) return staged;
  // Working tree: tracked modifications + untracked new files.
  return [
    ...git('diff --name-only --diff-filter=ACMR'),
    ...git('ls-files --others --exclude-standard'),
  ];
}

function run(cmd, { allowFail = false, quiet = false } = {}) {
  if (!quiet) process.stdout.write(`\n> ${cmd}\n`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: quiet ? 'ignore' : 'inherit', encoding: 'utf8' });
    return true;
  } catch {
    if (!quiet) process.stderr.write(`  ✗ failed: ${cmd}\n`);
    if (allowFail) return false;
    throw new Error('gate-failed');
  }
}

function writeEvidence(lines) {
  const dir = process.env.GATE_EVIDENCE_DIR || path.join(ROOT, 'tmp', 'systematic-test-matrix');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `gate-${stamp}.log`);
  writeFileSync(file, lines.join('\n') + '\n');
  return file;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const m = a.match(/^--([^=]+)(?:=(.*))?$/);
      return m ? [m[1], m[2] ?? true] : [a, true];
    }),
  );
  const mode = args.run || 'report';
  const base = typeof args.base === 'string' ? args.base : (mode === 'report' ? null : undefined);

  const files = getFiles(mode, base);
  if (files.length === 0) {
    console.log(`changed-files-gate: no changed files (${mode}). Nothing to gate.`);
    return 0;
  }

  // Classify
  const byTier = { L0: [], L1: [], L2: [], L3: [], L4: [], L5: [] };
  for (const f of files) byTier[classify(f)].push(f);
  const maxTier = TIERS.find((t) => byTier[t].length > 0);

  console.log(`changed-files-gate (${mode}) — ${files.length} file(s), top tier: ${maxTier} (${TIER_LABELS[maxTier]})`);
  for (const t of ['L5', 'L4', 'L3', 'L2', 'L1', 'L0']) {
    if (byTier[t].length) {
      console.log(`  ${t} ${TIER_LABELS[t]}: ${byTier[t].length} file(s)`);
      byTier[t].slice(0, 8).forEach((f) => console.log(`      ${f}`));
      if (byTier[t].length > 8) console.log(`      … +${byTier[t].length - 8} more`);
    }
  }
  console.log(`\n  Required gates for ${maxTier}:`);
  tierPolicy.TIER_GATES[maxTier].forEach((g) => console.log(`    - ${g}`));

  if (maxTier === 'L5' && mode === 'report') {
    console.log('\n  ⚠ L5 paths changed. Human review required. These stay human-only:');
    tierPolicy.HUMAN_ONLY_COMMANDS.forEach((c) => console.log(`    × ${c}`));
  }

  // ------------------------------------------------------------------ report
  if (mode === 'report') {
    const evidence = writeEvidence([
      `# changed-files-gate report ${new Date().toISOString()}`,
      `top tier: ${maxTier}`,
      ...files.map((f) => `${classify(f)}  ${f}`),
    ]);
    console.log(`\nEvidence: ${evidence}`);
    return 0;
  }

  // Hard policy checks (both hook modes) ---------------------------------
  let exitCode = 0;
  // `.env.example` is a tracked, secret-free template; every other `.env*` path is a
  // real environment file. See scripts/lib/envStagingPolicy.js.
  const envStaged = blockedEnvFiles(files);
  if (envStaged.length && mode === 'pre-commit') {
    console.error(`\n✗ POLICY VIOLATION: env file(s) staged for commit: ${envStaged.join(', ')}`);
    console.error('  .env* files must never be tracked. git rm --cached them.');
    console.error('  (.env.example is the only allowed exception — it is a template, not a secret store.)');
    return 2;
  }

  if (mode === 'pre-commit') {
    // Root clutter check on newly ADDED files.
    const added = git('diff --cached --name-only --diff-filter=A');
    const clutter = added.filter(
      (f) => !f.includes('/') && !ROOT_ALLOWLIST.has(f) && !f.startsWith('.'),
    );
    if (clutter.length) {
      console.error(`\n✗ POLICY VIOLATION (Clean Root Policy): ${clutter.join(', ')}`);
      console.error('  Root policy: docs → docs/, scripts → scripts/, SQL → supabase/queries/, assets → docs/images/.');
      console.error('  See .agents/skills/file-organization/SKILL.md. If a new root file is legitimately required, add it to ROOT_ALLOWLIST in scripts/changed-files-gate.mjs via a reviewed PR.');
      return 2;
    }
  }

  const tsFiles = files.filter((f) => /\.(ts|tsx|js|jsx|mjs)$/.test(f) && existsSync(path.join(ROOT, f)));

  // ESLint on changed files (fast, both modes) ----------------------------
  if (tsFiles.length) {
    const ok = run(`npx eslint ${tsFiles.map((f) => JSON.stringify(f)).join(' ')}`, { allowFail: true, quiet: false });
    if (!ok) {
      console.error('\n✗ ESLint failed on changed files. Commit/push blocked.');
      exitCode = 1;
    }
  }

  if (mode === 'pre-commit') {
    if (exitCode) return exitCode;
    console.log('\n✓ pre-commit gates passed (eslint; tsc/jest run at pre-push).');
    return 0;
  }

  // pre-push additions -----------------------------------------------------
  if (exitCode) return exitCode; // do not pile failing gates on top of each other

  const hasTs = files.some((f) => /\.(ts|tsx)$/.test(f));
  if (hasTs && process.env.GATE_SKIP_TSC !== '1') {
    if (!run('npx tsc --noEmit', { allowFail: true })) {
      console.error('\n✗ tsc --noEmit failed. Push blocked.');
      return 1;
    }
  }

  const srcFiles = tsFiles.filter((f) => f.startsWith('src/'));
  if (srcFiles.length && process.env.GATE_SKIP_JEST !== '1') {
    if (!run(`npx jest --findRelatedTests ${srcFiles.map((f) => JSON.stringify(f)).join(' ')} --passWithNoTests --bail`, { allowFail: true })) {
      console.error('\n✗ Targeted Jest run failed. Push blocked.');
      return 1;
    }
  }

  if (tierPolicy.l5Blocked(maxTier, process.env)) {
    console.error('\n✗ L5 paths changed. PUSH BLOCKED — human approval required.');
    console.error('  These stay human-only:');
    tierPolicy.HUMAN_ONLY_COMMANDS.forEach((c) => console.error(`    × ${c}`));
    console.error('  Before pushing: run the L5 gates, get human review, then set GATE_ALLOW_L5=1.');
    console.error('  (Emergency hatch only — CI re-validates everything.)');
    return 2;
  }

  const integrityMarkers = tierPolicy.requiredIntegrityMarkers(maxTier);
  if (integrityMarkers.length && process.env.GATE_SKIP_INTEGRITY !== '1') {
    const evidenceDir = process.env.GATE_EVIDENCE_DIR || path.join(ROOT, 'tmp', 'systematic-test-matrix');
    // Freshness: evidence must be newer than the newest changed file in this push.
    const cutoffMs = Math.max(
      ...files.map((f) => {
        try {
          return statSync(path.join(ROOT, f)).mtimeMs;
        } catch {
          return 0;
        }
      }),
      0,
    );
    const entries = tierPolicy.collectEvidenceEntries(evidenceDir);
    const missing = tierPolicy.missingIntegrityMarkers(entries, integrityMarkers, cutoffMs);
    if (missing.length) {
      console.error(`\n✗ Tier ${maxTier} change without data-integrity evidence. Push blocked.`);
      console.error('  Missing evidence for: ' + missing.join(', '));
      console.error('  Run (needs local stack up): npm run check:sync && npm run audit:crud:gate');
      console.error(`  Leave their logs under ${evidenceDir}/ — file name or content must mention the command`);
      console.error('  and be newer than your last edit. Emergency hatch: GATE_SKIP_INTEGRITY=1 (CI re-runs).');
      return 1;
    }
    console.log(`\n✓ data-integrity evidence present: ${integrityMarkers.join(', ')}`);
  }

  const evidence = writeEvidence([
    `# changed-files-gate ${mode} ${new Date().toISOString()}`,
    `top tier: ${maxTier}`,
    `gates run: eslint${hasTs && process.env.GATE_SKIP_TSC !== '1' ? ', tsc' : ''}${srcFiles.length && process.env.GATE_SKIP_JEST !== '1' ? ', jest --findRelatedTests' : ''}${integrityMarkers.length ? `, integrity evidence (${integrityMarkers.join(', ')})` : ''}`,
    ...files.map((f) => `${classify(f)}  ${f}`),
  ]);
  console.log(`\n✓ pre-push gates passed. Evidence: ${evidence}`);
  return 0;
}

process.exit(main());
