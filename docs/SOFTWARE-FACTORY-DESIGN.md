# JetFarm Software Factory — Design & Station Map

**Generated:** 2026-10-19
**Purpose:** Treat JetFarm development as a manufacturing line: every change flows through the same stations, automated gates decide quality, and evidence is left at every step. This document maps that line onto what the repo already has, names the gaps, and defines how to close them.
**Companion docs:** `docs/AI-ASSISTED-DEV-WORKFLOW-PLAN.md` (policy + risk tiers), `AGENTS.md` (conventions + autonomy rules), `.agents/workflows/end-to-end-dev-pipeline.md` (SDLC overview).

## 1. The Line

```
INTAKE ──▶ CONTEXT ──▶ PLAN+CLASSIFY ──▶ BUILD ──▶ FAST GATES ──▶ FULL GATES
   │                                                                        │
   └────────────── (tier routing L0–L5 decides depth) ◀─────────────────────┘
                                                                  │
MONITOR ◀── DEPLOY ◀── CI ◀── MERGE ◀── REVIEW ◀───────────────────┘
   ▲            ▲
   │            └─ HUMAN CHECKPOINT (never automated)
   └─ evidence feeds back into intake
```

One rule governs the whole line: **a change may only move to the next station when the current station's gate passes, and the required gates are dictated by the risk tier, not by preference** (source of truth: `scripts/changed-files-gate.mjs` `TIER_GATES`).

## 2. Station Map — Have vs. Gap

| # | Station | What it does | Already have (paths) | Missing / gap |
|---|---------|--------------|----------------------|---------------|
| 0 | **Intake** | Requirements become trackable work | GitHub issues, `docs/*-PLAN.md` planning docs | No issue template enforcing "objective / scope / definition of done / verification" prompt contract from AGENTS.md |
| 1 | **Context load** | Worker gets repo knowledge | `AGENTS.md`, `.agents/skills/` (10 skills), `.agents/workflows/` (5 workflows), `docs/` | Skills cover build topics but no skill for the factory line itself (this doc fills that) |
| 2 | **Plan + classify** | Break work into tasks; compute risk tier | `npm run gate`, `npm run gate:base`, `.github/workflows/tier-gate.yml` (labels every PR with its tier) | Tier is reported but not *enforced* locally — nothing blocks a commit whose tier gates weren't run (see §7) |
| 3 | **Build (RED-GREEN)** | Failing test first, then implementation | TDD convention, `.agents/skills/testing`, Jest co-located `__tests__/` | — |
| 4 | **Fast gates** | Cheap feedback before full suites | `npx tsc --noEmit`, `npm run lint`, `npx jest <path>`, `.husky/pre-commit`, `.husky/pre-push` | `"strict": false` TS means typecheck is weak — test gates carry more weight here than in strict-mode repos |
| 5 | **Full gates** | Tier-complete verification with evidence | `npm test` (206 suites / 1635 tests), `npm run test:e2e`, `check:sync`, `audit:crud:gate`, `.agents/skills/systematic-test-matrix`, BryV3 (external, 30 gates / 10 phases) | Evidence goes to `tmp/systematic-test-matrix/` but retention is unmanaged; BryV3 is external to this repo (no CI wiring) |
| 6 | **Review** | Human sign-off on risky paths | Self-review checklist in AGENTS.md, `docs/CODE-REVIEW-2026-09-30.md`, L3+/L4 human review policy | Review is policy, not a gate — no automation verifies a reviewer approved before merge |
| 7 | **CI** | Same gates re-run on every push/PR | `.github/workflows/`: `jest.yml`, `playwright.yml`, `ci-cd.yml`, `reusable-ci-cd.yml`, `tier-gate.yml`, `pages.yml` | Tier-aware CI: `tier-gate.yml` classifies but heavier jobs don't scale their scope by tier (all-or-nothing) |
| 8 | **Deploy** | Publish web + APK to production | `deploy:hetzner`, `deploy:cloudflare` (human-only), `version.json` + `/download` at `jetfarm.pages.dev` | Known gap: Hetzner publishes no `version.json`/APK (BUG-AUDIT §11.5). By design: **never automated** |
| 9 | **Monitor** | Defects flow back to intake | `docs/BUG-AUDIT-AND-REMEDIATION-PLAN.md`, `scripts/*audit*`, version probes in `docs/DEPLOYMENT.md` | No single dashboard: no per-tier pass/fail metrics, no lead-time/cycle-time, no flaky-test tracking |

## 3. Routing — Risk Tiers Decide Depth

From `scripts/changed-files-gate.mjs` (`TIER_GATES`), which classifies by changed paths:

| Tier | Typical paths | Required gates (cumulative) |
|------|---------------|------------------------------|
| L0 | docs, markdown, root metadata | none beyond self-review |
| L1 | configs, UI-only, isolated components | `tsc --noEmit`, eslint (changed files) |
| L2 | screens, services without data-layer effects | + targeted jest, full `npm test`, Playwright spec for touched routes |
| L3 | `src/database/`, sync-adjacent, data persistence | + `npm run check:sync`, `npm run audit:crud:gate` — **data-loss class** |
| L4 | journal/ledger/Cash/Accounting | + journal balance assertions |
| L5 | infra, schema, deploy | + migration dry-run (`npm run db:migrate`), **human approval — never merge unattended** |

The tier is computed on the diff, reported by `npm run gate`, and mirrored by CI (`tier-gate.yml`). The factory treats the tier table as the routing rule: **the reported tier dictates the required verification; no agent may declare work done without running that tier's list and leaving evidence under `tmp/systematic-test-matrix/`.**

## 4. Human Checkpoints — the Line Stops Here

Mirrored from `HUMAN_ONLY_COMMANDS` in `scripts/changed-files-gate.mjs` and AGENTS.md. These stations are **hard stops**; no worker (human or AI) automates them:

- Any deploy path: `deploy:hetzner`, `deploy:pipeline`, `deploy:cloudflare`, `deploy:staging`
- `db:migrate:apply` / `scripts/apply-hetzner-migrations.mjs --apply` against production (dry-run `db:migrate` is allowed)
- Production data mutations: `scripts/clear-prod-db.mjs`, `scripts/backup-prod-db.mjs`, `create-admin-prod.mjs`, any `scripts/*prod*` write path
- Force-pushes, tag pushes, APK publication to the downloads CDN
- L5 changes entirely (human approval required before merge)

## 5. Workers — Who Does What

| Worker | Stations | Rules |
|--------|----------|-------|
| **Human developer** | 0, 2 (approvals), 6, 8, L5 | Owns hard stops above; approves risk-tiered paths |
| **AI agent (draft)** | 1, 2 (plan), 3, 4, 5 | "AI drafts, gates decide" — runs tier gates, fixes its own reds, leaves evidence |
| **CI (machine)** | 4, 5, 7 | Re-runs everything on push; immune to agent optimism |
| **Durable agent (pi-durable)** | 2, 4, 5 — *planned* | Crash-safe line worker: survives restarts mid-gate-run (§6) |

### Where pi-durable slots in

`@earendil-works/pi-durable` (installed globally, v1.3.0) is the durable-execution runtime for the agent workers. It is **not** an app dependency — it lives in the automation layer. Two concrete slots:

1. **Durable gate-runner** — a standalone harness under `.agents/durable/` (own `package.json`, gitignored `node_modules`) whose tools are thin shells over `npm run gate`, `npx tsc --noEmit`, `npm run lint`, jest buckets, `check:sync`, `audit:crud:gate`. Storage via `JsonlStorage` (`fsync: true`). A crash mid-`npm test` resumes at the last committed turn instead of re-running 30 gates. Evidence commits as durable documents into `tmp/systematic-test-matrix/`.
2. **Durable task graphs** — pi-durable tasks/child tasks map 1:1 onto AGENTS.md's "tracked task list keyed to outcomes" and "parallel subagents for disjoint-file work". Each child task's state is committed before it is shown; nothing is lost on restart.

Prerequisite: pi-durable provides storage/turn machinery; model access goes through its `@earendil-works/pi-ai` dependency and needs a configured provider (OpenAI-compatible or local Ollama).

## 6. Evidence & Metrics

Every station must leave an artifact; the factory is only as trustworthy as its evidence trail.

| Evidence | Where | Owner |
|----------|-------|-------|
| Gate run logs (tier, commands, pass/fail) | `tmp/systematic-test-matrix/` (timestamped) | worker that ran the gate |
| Tier classification | `npm run gate` output + PR label (`tier-gate.yml`) | CI |
| Audit results | `check:sync` / `audit:crud:gate` output | CI + worker |
| Deploy probe results | `version.json`, `/download` checks | release runbook (`docs/DEPLOYMENT.md`) |
| Defect registry | `docs/BUG-AUDIT-AND-REMEDIATION-PLAN.md` | team |

**Metrics to add (gap):** per-tier gate pass rate, lead time (intake→merge), flaky-test count over time, evidence-retention policy for `tmp/systematic-test-matrix/`.

## 7. Prioritized Gap List

1. ~~**Tier enforcement is advisory.**~~ ✅ **Implemented 2026-10-19** — `.husky/pre-push` now hard-blocks L5 pushes without `GATE_ALLOW_L5=1` and enforces fresh `check:sync`/`audit:crud:gate` evidence for L3/L4 (logic in `scripts/lib/tierPolicy.js`, enforced from `scripts/changed-files-gate.mjs`). Remaining gap: L3/L4 evidence is only verified at push time — consider a CI job that validates the same evidence on PRs.
2. **Durable gate-runner pilot** (§5) — the single highest-leverage automation addition; directly implements the resume-without-redoing-gates requirement.
3. **Tier-aware CI scaling** — `jest.yml`/`ci-cd.yml` run full suites regardless of tier; cheap tiered skipping (with mandatory full runs for L3+) saves CI minutes without weakening gates.
4. **Intake template** — issue template enforcing the AGENTS.md prompt contract (objective / scope / definition of done / verification) so every unit of work enters the line machine-readable.
5. **Evidence retention + metrics dashboard** — a small `scripts/` reporter over `tmp/systematic-test-matrix/` (pass/fail per tier per day) is enough to start; no external service needed.
6. **Review enforcement** — branch protection requiring reviewer approval for L3+ paths (GitHub rulesets), so review becomes a gate, not a courtesy.
7. **BryV3 wiring** — decide whether the external 30-gate pipeline runs as a scheduled CI job or stays a manual pre-release step; document the decision here.

## 8. Rollout Phases

| Phase | Scope | Exit criterion |
|-------|-------|----------------|
| **P1 — Paper factory** | Adopt this doc; intake template; enforce tier evidence in husky | A PR with L2+ changes cannot pass pre-push without its tier evidence |
| **P2 — Durable worker** | `.agents/durable/` gate-runner pilot with `MemoryStorage` → `JsonlStorage`; crash-resume proven once | Kill mid-`npm test`, reopen, observe resumption from last committed turn |
| **P3 — Task graphs** | Durable orchestrator spawns child tasks for disjoint-file work; evidence committed per child | A 3-stage autonomous run survives a forced crash with zero re-executed gates |
| **P4 — Measure** | Tier pass-rate + lead-time reporter over the evidence dir; retention policy | Metrics visible for 2 consecutive sprints; retention documented |

## 9. Maintenance

This doc is the factory floor plan. When a station's tooling changes (new workflow, new gate script, new human-only command), update §2/§3/§4 in the same commit — the station map and AGENTS.md's autonomy rules must never drift apart.
