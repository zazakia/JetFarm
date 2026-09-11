---
name: systematic-test-matrix
description: >-
  Run the full POSCursor verification matrix with timestamped evidence under
  tmp/systematic-test-matrix/. Use for release readiness, pre-deploy QA, or when
  the user asks to systematically run all test surfaces (tsc, expo-doctor, Jest
  buckets, full Jest, Playwright, web export, export smoke). Not for authoring
  individual unit tests — use the testing skill for that.
---

# Systematic Test Matrix

Run POSCursor verification surfaces in a fixed order. Keep evidence in
`tmp/systematic-test-matrix/<timestamp>/`. Never claim green from stale logs.

## When to use

| Need | Action |
|------|--------|
| Release / deploy confidence | **This skill** |
| Author or fix one Jest file | `testing` skill |
| Deploy to Cloudflare after green | `deploy-poscursor` |
| Fast iteration | `npx jest <path> --no-coverage` only |

## Quick start

1. Confirm cwd is the POSCursor repo root (`posCURSORv2` / this workspace).
2. Run:

```powershell
node .agents/skills/systematic-test-matrix/scripts/run_matrix.mjs
```

3. Open the newest `tmp/systematic-test-matrix/<timestamp>/summary.json` and any failing `*.log` before reporting results.

## Workflow (script order)

### 1. Baseline (bail on failure by default)

- `npx tsc --noEmit`
- `npx expo-doctor`

### 2. Jest by discovered `__tests__` buckets

The script walks `app/` and `src/`, finds `__tests__` dirs with `*.test.*` files, and runs each with:

```text
npx jest --runInBand --forceExit --runTestsByPath <files…>
```

Buckets are written to `jest-buckets.json` in the report dir. Typical buckets include services, utils, components, hooks, models, store(s), cic, and role screens under `app/(admin)`, `app/(cashier)`, `app/(borrower)`, etc.

### 3. Integrated surfaces

- **jest_full** — `npm test -- --runInBand --forceExit` (catches tests outside `__tests__/` folders, e.g. `*.regression.test.ts`)
- **playwright_full** — `npx playwright test --workers=1 --reporter=list` (skipped with `--skip-playwright`)
- **export_web** — `npm run export:web` (script uses this, not `export:web:production`)

### 4. Export smoke (default on)

Serves `dist/` on localhost, opens Chromium, fails on page/console errors. Writes `smoke.json`. Skip with `--skip-smoke`.

## Commands

```powershell
# Full matrix
node .agents/skills/systematic-test-matrix/scripts/run_matrix.mjs

# Debug without long E2E / smoke
node .agents/skills/systematic-test-matrix/scripts/run_matrix.mjs --skip-playwright --skip-smoke

# Resume one step
node .agents/skills/systematic-test-matrix/scripts/run_matrix.mjs --only=playwright_full
node .agents/skills/systematic-test-matrix/scripts/run_matrix.mjs --only=jest_full,export_web

# Collect all failures (no early exit)
node .agents/skills/systematic-test-matrix/scripts/run_matrix.mjs --no-bail
```

## Outputs

| Artifact | Meaning |
|----------|---------|
| `summary.json` | Per-step ok/exitCode/logPath; overall `ok` |
| `jest-buckets.json` | Discovered buckets for that run |
| `*.log` | Full command output |
| `smoke.json` | Export smoke URL/title/errors |

## Agent reporting rules

1. Quote the report directory path used.
2. For failures: step name, exit code, log path, first actionable error.
3. Do not mark release-ready if `summary.ok` is false.
4. Optional extra gates (lint, production export, sync integrity) are **not** in the default script — see `references/test-surfaces.md` and `deploy-poscursor` when shipping.

## Related

- Unit/integration authoring: `../testing/SKILL.md`
- Deploy gates: `../deploy-poscursor/SKILL.md`
- Surface catalog: `references/test-surfaces.md`
