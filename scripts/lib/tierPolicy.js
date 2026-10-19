'use strict';

/**
 * Tier policy data + enforcement decisions for `scripts/changed-files-gate.mjs`.
 *
 * Extracted as a pure helper (same pattern as envStagingPolicy.js) so the
 * pre-push gate (ESM) and the Jest suite (CJS) share one definition.
 *
 * Owns:
 *  - TIER_GATES: the command list each risk tier requires (source of truth;
 *    printed by the gate script and enforced here).
 *  - HUMAN_ONLY_COMMANDS: commands no agent may ever run autonomously.
 *  - requiredIntegrityMarkers(tier): which tier-specific gates cannot be
 *    auto-run at pre-push (they need a local stack / human) and therefore
 *    must be proven by fresh evidence under tmp/systematic-test-matrix/.
 *  - missingIntegrityMarkers(entries, markers, cutoffMs): pure evidence check.
 *  - collectEvidenceEntries(dir): recursive scan of the evidence directory.
 *  - l5Blocked(tier, env): L5 pushes are hard-blocked unless the human sets
 *    GATE_ALLOW_L5=1 (mirror of the GATE_SKIP_TSC / GATE_SKIP_JEST hatches).
 */

// Commands each tier requires before the change may be considered done.
// Kept identical to the table in docs/AI-ASSISTED-DEV-WORKFLOW-PLAN.md §4.
const TIER_GATES = {
  L0: [],
  L1: ['tsc --noEmit', 'eslint (changed files)'],
  L2: ['tsc --noEmit', 'eslint (changed files)', 'jest (targeted)', 'full npm test', 'Playwright spec for touched routes'],
  L3: ['tsc --noEmit', 'eslint (changed files)', 'jest (targeted)', 'full npm test', 'Playwright', 'npm run check:sync', 'npm run audit:crud:gate'],
  L4: ['tsc --noEmit', 'eslint (changed files)', 'jest (targeted)', 'full npm test', 'Playwright', 'npm run check:sync', 'npm run audit:crud:gate', 'journal balance assertions (L4)'],
  L5: ['ALL lower-tier gates', 'migration dry-run (npm run db:migrate)', 'HUMAN approval required — never merge unattended'],
};

// Commands no agent may ever invoke autonomously (mirrored in AGENTS.md).
const HUMAN_ONLY_COMMANDS = [
  'npm run deploy:hetzner',
  'npm run deploy:pipeline',
  'npm run deploy:cloudflare',
  'npm run db:migrate:apply',
  'scripts/apply-hetzner-migrations.mjs --apply',
  'scripts/clear-prod-db.mjs',
  'scripts/backup-prod-db.mjs (writes to prod)',
  'any command touching .env.hetzner / .env.production values',
];

// npm script names whose TIER_GATES entries prove the data-integrity work
// happened. Pre-push cannot auto-run these (they need the local stack up and
// are slow), so their verification is enforced as fresh evidence.
const INTEGRITY_MARKERS = ['check:sync', 'audit:crud:gate'];

/**
 * Markers that must be proven by fresh evidence for this tier.
 * Empty for L0–L2 (their gates auto-run at pre-push) and for L5
 * (blocked outright instead of evidence-checked).
 */
function requiredIntegrityMarkers(tier) {
  return tier === 'L3' || tier === 'L4' ? [...INTEGRITY_MARKERS] : [];
}

/**
 * Pure evidence check. An entry satisfies a marker when its file name or
 * content contains the marker and it is not older than `cutoffMs`
 * (the newest changed file). `cutoffMs === null` skips the freshness rule.
 */
function missingIntegrityMarkers(entries, markers, cutoffMs) {
  const missing = [];
  for (const marker of markers) {
    // Windows forbids ':' in file names, so evidence files are named with
    // dashes (check-sync.log). Accept the marker itself and its dash variant.
    const dashVariant = marker.replace(/:/g, '-');
    const hit = entries.find((e) => {
      if (cutoffMs !== null && typeof e.mtimeMs === 'number' && e.mtimeMs < cutoffMs) {
        return false;
      }
      const haystack = `${e.name}\n${e.content}`;
      return haystack.includes(marker) || haystack.includes(dashVariant);
    });
    if (!hit) missing.push(marker);
  }
  return missing;
}

/** Recursively collect readable text evidence files from the evidence dir. */
function collectEvidenceEntries(dir) {
  const fs = require('fs');
  const path = require('path');
  const entries = [];
  if (!fs.existsSync(dir)) return entries;
  const walk = (current) => {
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, item.name);
      if (item.isDirectory()) {
        walk(full);
      } else if (item.isFile()) {
        try {
          const stat = fs.statSync(full);
          if (stat.size > 2 * 1024 * 1024) continue; // skip oversized artifacts
          const content = fs.readFileSync(full, 'utf8');
          entries.push({ name: item.name, path: full, content, mtimeMs: stat.mtimeMs });
        } catch {
          // unreadable file — not evidence
        }
      }
    }
  };
  try {
    walk(dir);
  } catch {
    // unreadable directory — treat as no evidence
  }
  return entries;
}

/** L5 pushes require an explicit human override (GATE_ALLOW_L5=1). */
function l5Blocked(tier, env) {
  return tier === 'L5' && (!env || env.GATE_ALLOW_L5 !== '1');
}

module.exports = {
  TIER_GATES,
  HUMAN_ONLY_COMMANDS,
  INTEGRITY_MARKERS,
  requiredIntegrityMarkers,
  missingIntegrityMarkers,
  collectEvidenceEntries,
  l5Blocked,
};
