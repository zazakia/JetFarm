'use strict';

/**
 * Tier policy enforcement for the pre-push gate.
 *
 * The gap these tests pin down (docs/SOFTWARE-FACTORY-DESIGN.md §7 item 1):
 * before this module, L3/L4 changes printed a *reminder* to run check:sync and
 * audit:crud:gate, and L5 changes pushed freely. Nothing forced the tier's
 * verification to actually happen.
 *
 * New behavior under test:
 *  - L3/L4 pushes require fresh evidence of `check:sync` + `audit:crud:gate`
 *    in the evidence dir (tmp/systematic-test-matrix) — name or content match.
 *  - L5 pushes are hard-blocked unless the human explicitly sets
 *    GATE_ALLOW_L5=1 (mirror of the GATE_SKIP_TSC / GATE_SKIP_JEST hatches).
 *  - L0–L2 require no extra evidence (their gates auto-run at pre-push).
 */

const tierPolicy = require('../lib/tierPolicy.js');

describe('TIER_GATES', () => {
  it('requires nothing extra at L0', () => {
    expect(tierPolicy.TIER_GATES.L0).toEqual([]);
  });

  it('requires the data-integrity gates at L3 and L4', () => {
    for (const tier of ['L3', 'L4']) {
      expect(tierPolicy.TIER_GATES[tier]).toEqual(
        expect.arrayContaining(['npm run check:sync', 'npm run audit:crud:gate']),
      );
    }
  });

  it('requires human approval at L5', () => {
    expect(tierPolicy.TIER_GATES.L5.join(' ')).toMatch(/HUMAN approval/);
    expect(tierPolicy.TIER_GATES.L5.join(' ')).toMatch(/npm run db:migrate/);
  });
});

describe('HUMAN_ONLY_COMMANDS', () => {
  it('mirrors the deploy / production-mutation block list from AGENTS.md', () => {
    const list = tierPolicy.HUMAN_ONLY_COMMANDS.join(' ');
    expect(list).toMatch(/deploy:hetzner/);
    expect(list).toMatch(/deploy:cloudflare/);
    expect(list).toMatch(/db:migrate:apply/);
  });
});

describe('requiredIntegrityMarkers', () => {
  it('is empty below L3', () => {
    expect(tierPolicy.requiredIntegrityMarkers('L0')).toEqual([]);
    expect(tierPolicy.requiredIntegrityMarkers('L1')).toEqual([]);
    expect(tierPolicy.requiredIntegrityMarkers('L2')).toEqual([]);
  });

  it('demands check:sync and audit:crud:gate evidence at L3 and L4', () => {
    for (const tier of ['L3', 'L4']) {
      expect(tierPolicy.requiredIntegrityMarkers(tier)).toEqual([
        'check:sync',
        'audit:crud:gate',
      ]);
    }
  });

  it('is empty at L5 (blocked outright instead)', () => {
    expect(tierPolicy.requiredIntegrityMarkers('L5')).toEqual([]);
  });
});

describe('missingIntegrityMarkers', () => {
  const fresh = (name, content, mtimeMs = 0) => ({ name, content, mtimeMs });

  it('reports every marker as missing when there is no evidence at all', () => {
    expect(
      tierPolicy.missingIntegrityMarkers([], ['check:sync', 'audit:crud:gate'], 0),
    ).toEqual(['check:sync', 'audit:crud:gate']);
  });

  it('accepts evidence matched by file name', () => {
    const entries = [fresh('11-check-sync.log', '')];
    expect(tierPolicy.missingIntegrityMarkers(entries, ['check:sync'], 0)).toEqual([]);
  });

  it('accepts evidence matched by file content', () => {
    const entries = [fresh('summary.json', 'ran npm run audit:crud:gate — passed')];
    expect(tierPolicy.missingIntegrityMarkers(entries, ['audit:crud:gate'], 0)).toEqual([]);
  });

  it('reports only the markers that are still missing', () => {
    const entries = [fresh('a.log', 'npm run check:sync done')];
    expect(
      tierPolicy.missingIntegrityMarkers(entries, ['check:sync', 'audit:crud:gate'], 0),
    ).toEqual(['audit:crud:gate']);
  });

  it('rejects stale evidence older than the newest changed file', () => {
    const entries = [fresh('old-check-sync.log', 'npm run check:sync', 1000)];
    expect(
      tierPolicy.missingIntegrityMarkers(entries, ['check:sync'], 2000),
    ).toEqual(['check:sync']);
  });

  it('skips the freshness rule when no cutoff is available', () => {
    const entries = [fresh('old-check-sync.log', 'npm run check:sync', 1000)];
    expect(
      tierPolicy.missingIntegrityMarkers(entries, ['check:sync'], null),
    ).toEqual([]);
  });

  it('requires nothing when the tier has no markers', () => {
    expect(tierPolicy.missingIntegrityMarkers([], [], 0)).toEqual([]);
  });
});

describe('collectEvidenceEntries', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  it('reads evidence files recursively and captures name, content and mtime', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tier-evidence-'));
    try {
      const sub = path.join(dir, '2026-10-19T10-00-00Z');
      fs.mkdirSync(sub, { recursive: true });
      fs.writeFileSync(path.join(sub, 'check-sync.log'), 'npm run check:sync passed');
      const entries = tierPolicy.collectEvidenceEntries(dir);
      const hit = entries.find((e) => e.name === 'check-sync.log');
      expect(hit).toBeDefined();
      expect(hit.content).toContain('npm run check:sync');
      expect(hit.mtimeMs).toBeGreaterThan(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('l5Blocked', () => {
  it('blocks L5 pushes without an explicit human override', () => {
    expect(tierPolicy.l5Blocked('L5', {})).toBe(true);
    expect(tierPolicy.l5Blocked('L5', undefined)).toBe(true);
  });

  it('allows L5 pushes when the human sets GATE_ALLOW_L5=1', () => {
    expect(tierPolicy.l5Blocked('L5', { GATE_ALLOW_L5: '1' })).toBe(false);
  });

  it('never blocks below L5', () => {
    for (const tier of ['L0', 'L1', 'L2', 'L3', 'L4']) {
      expect(tierPolicy.l5Blocked(tier, {})).toBe(false);
    }
  });
});
