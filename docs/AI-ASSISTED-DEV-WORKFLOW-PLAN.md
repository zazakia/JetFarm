# AI-Assisted Development Workflow Plan — JetFarm

**Generated:** 2026-10-04
**Scope:** How to progressively introduce AI agents into daily development on this repo without weakening quality control.

---

## 1. What the Workspace Is Today

### 1.1 Project profile

| Dimension | Reality |
|---|---|
| Product | JetFarm — enterprise management, POS, agricultural lending/cooperative operations (POSCursor lineage) |
| Platform | Expo (SDK 55) / React Native 0.83 / React 19, web target via `react-native-web` |
| Language | TypeScript (loose mode: `"strict": false`), some plain JS utilities |
| Local DB | WatermelonDB + LokiJS (offline-first), custom Babel decorator pipeline |
| Cloud | Self-hosted Supabase (Hetzner VPS, `supabase.818.quest`), PostgREST + Postgres |
| State | Zustand stores + AuthContext |
| Styling | NativeWind v4 (Tailwind v3), strict no-arbitrary-hex rule |
| Routing | Expo Router file-based, role groups: `(admin)`, `(borrower)`, `(collector)`, `(expenses-encoder)` |
| Secondary surface | `src/modules/` cooperative business units (water-station, agri-store, pharmacy, transport) registered via `src/modules/registry.ts` |
| Server-side | PostgreSQL double-entry accounting triggers, SQL migrations under `supabase/migrations/` |

### 1.2 Codebase structure (large, mature, multi-layered)

- `app/` — 90+ route screens
- `src/services/` — 100+ business services (class + static methods, `BaseModelService` pattern), each typically with a `__tests__/` sibling
- `src/database/` — schema v48, 88 tables, 19 WatermelonDB models
- `src/components/`, `src/hooks/`, `src/utils/`, `src/stores/`
- `scripts/` — 140+ operational scripts (audits, migrations, data checks, deploys)
- `tests/` — 20+ Playwright E2E specs with fixtures and auth helpers
- `docs/` — extensive documentation incl. bug audit plan, architecture, deployment guides
- `.agents/` — **already has agent skills and workflows** (see 1.3)

### 1.3 Existing AI/automation assets (important — the plan builds on these, not greenfield)

- **`AGENTS.md`** at repo root: conventions, anti-patterns, where-to-look table, deploy hazards. This is the AI context anchor.
- **`.agents/skills/`**: `testing`, `systematic-test-matrix`, `sync-debug`, `ui-patterns`, `ui-ux-design-standards`, `AddCoopModule`, `data-ops`, `local-env`, `deploy-jetfarm`, `github-actions-cicd`, `file-organization` — some with scripts (`run_matrix.mjs`, `audit-ui-contrast.js`) and `agents/openai.yaml` definitions.
- **`.agents/workflows/`**: `end-to-end-dev-pipeline.md`, `run-tests.md`, `setup-local.md`, `data-migration.md`, `deploy.md`.
- **Verification infrastructure already in npm scripts:**
  - `npm test` — Jest, 206 suites / 1635 tests, reported 100% passing
  - `npm run lint` — ESLint flat config (expo)
  - `npm run test:e2e` — Playwright (with production-safety guard in `playwright.config.ts`)
  - `npm run check:sync` / `audit:crud:gate` — data-integrity audits with fail-on-high gating
  - `npm run workflow:e2e` — full local pipeline (typecheck → Jest → Playwright → web export)
  - `db:migrate` / `db:migrate:apply` / `db:migrate:verify` — schema migration ledger scripts
- **CI:** `.github/workflows/` has `jest.yml`, `playwright.yml`, `pages.yml`, `ci-cd.yml`, `reusable-ci-cd.yml`.
- **External QA:** BryV3 30-gate pipeline referenced in `AGENTS.md`.
- **Husky is installed** (`prepare: husky`) but **no `.husky/pre-commit` hook exists** — local gate automation is a gap.

### 1.4 Risk areas the AI workflow must respect (from AGENTS.md + docs)

1. **Production deploy** (`deploy-hetzner.mjs`): temporarily swaps `.env.hetzner` into `.env.local`, empties the remote site dir, and silently continues past failed migrations. Never automatable end-to-end without a human checkpoint.
2. **Secrets**: `.env*` files, `EXPO_PUBLIC_ENCRYPTION_KEY`, denylisted fixture keys. AI must never print values or fabricate `.env.production`.
3. **Offline-first sync correctness**: WatermelonDB ↔ Supabase mapping is the system's most fragile surface; regressions here are data-loss class.
4. **Double-entry accounting**: enforced by DB triggers; app-level changes must keep journals balanced.
5. **`"strict": false` TypeScript**: the compiler catches less than it should, so AI-written code needs stronger test gates than a strict-mode repo would.

---

## 2. Target Workflow: Where AI Sits in the Loop

The model is **"AI drafts, gates decide."** Every AI change flows through the same funnel:

```
Task intake (issue/plan)
  → Context load        (AGENTS.md + module skill + SearchWorkspace)
  → Plan                (task list; human approves for anything touching risk areas)
  → RED                 (AI writes failing test first — TDD is already a repo convention)
  → GREEN               (AI implements)
  → Fast gates          (tsc --noEmit, eslint, targeted Jest)
  → Full gates          (npm test, audit scripts, Playwright subset)
  → Self-review         (AI diff review vs AGENTS.md anti-patterns)
  → Human review        (required for risk-tiered paths — see §4)
  → Merge → CI → staged deploy (human-triggered)
```

Two operating modes to run in parallel:

- **Interactive pairing** — agent works in the repo directly (this session's toolset), best for features and bugfixes.
- **Unattended workers** — CI-triggered or scheduled agents for backlog tasks (test coverage, dependency audits, drift detection), best for things with objective pass/fail gates.

---

## 3. Task Automation Matrix

### 3.1 Fully automatable now (high value, low risk — start here)

| Task | Tooling | Notes |
|---|---|---|
| Unit/integration test authoring for `src/services/` | `testing` skill + Jest | Pattern is highly repetitive (class + static + `createTestDatabase`); ideal for AI. Enforce RED-first. |
| Playwright E2E spec generation for existing screens | `webapp-testing` / `systematic-test-matrix` skills | Route-per-screen mapping already documented in `AGENTS.md`; harness traps already recorded (tour overlay, port 19119). |
| SQL data-check / audit scripts (`scripts/check-*.mjs` style) | `data-ops` skill | Read-only queries against local/staging only; extend existing catalog rather than adding new ad-hoc files. |
| ESLint/contrast/a11y debt sweeps | `audit-textinput-accessibility.mjs`, `audit-ui-contrast.js`, `audit-layout-geometry.mjs` | AI runs the audit, batches fixes by component, per-fix targeted Jest. |
| Codebase Q&A / impact analysis | `SearchWorkspace` + `Explore` agents + module docs | Reduces onboarding cost for new contributors. |
| Migration script drafting (not applying) | `supabase/migrations/` + `db:migrate` dry-run | AI writes migration + verification query; application stays human-run. |
| Changelog / release notes drafting | `git log` + `docs/CLIENT_RELEASE_NOTES.md` precedent | Purely generative; human publishes. |
| Docs maintenance (`AGENTS.md` drift, module READMEs) | Scheduled agent | Flag when docs reference deleted files/patterns; auto-open fix PRs. |

### 3.2 Automatable with a human checkpoint (assist mode)

| Task | AI does | Human does |
|---|---|---|
| New coop module (e.g. another business unit) | Full implementation via `AddCoopModule` skill incl. tests | Approves manifest + registry diff; reviews schema additions |
| New screen/route in `app/(role)/` | Route + component + test + RBAC guard | Reviews role/permission matrix |
| Bug fix from `docs/BUG-AUDIT-AND-REMEDIATION-PLAN.md` | Repro test → fix → regression run | Confirms root-cause explanation before merge |
| Dependency/Expo upgrades | `npx expo-doctor`, conflict analysis, staged bump PR | Decides when to run E2E matrix and merge |
| Schema migrations | Draft + dry-run + verify script | Runs `db:migrate:apply` and reconciles ledger |

### 3.3 Do NOT automate (keep human-only, document in AGENTS.md)

- `deploy:hetzner`, `deploy:pipeline --deploy`, any command that mutates the live site directory.
- Anything reading/writing `.env.hetzner` / `.env.production` values.
- Production data mutations (`clear-prod-db.mjs`, `cleanup-nonhuman-production-borrowers.js` etc.).
- Applying migrations to production.
- Force-pushes, tag pushes, APK publication to the downloads CDN.

**Mechanism:** add a standing rule to `AGENTS.md` and an allowlist/denylist in a `scripts/guard-commands.mjs` (or simply a documented "never run" list the agent must check before any Bash invocation on deploy scripts). CI should also lack credentials for these paths so an unattended agent physically cannot deploy.

---

## 4. Verification Integration — Gate Design by Risk Tier

Because `strict: false`, the test gates are the type safety net. Tier every path:

| Tier | Paths | Required gates before "done" |
|---|---|---|
| **L0 Docs** | `docs/**`, `*.md` | none beyond diff review |
| **L1 UI leaf** | `src/components/**`, styling-only edits | `tsc --noEmit`, eslint, targeted Jest, contrast audit if colors/text touched |
| **L2 Feature** | `app/(role)/**`, `src/modules/**`, single service | L1 + full `npm test` + Playwright spec for the route |
| **L3 Data core** | `src/database/**`, `src/services/SyncService.ts`, schema.ts | L2 + `npm run check:sync` + `audit:crud:gate` + sync-debug skill review |
| **L4 Accounting** | `journal_entries`-touching services, `AutoPostingService`, COA | L3 + double-entry balance test (journal-level assertions mirroring `trg_enforce_balanced_journal`) |
| **L5 Infra/schema** | `supabase/migrations/**`, deploy scripts, env plumbing | L4 + dry-run migrations + explicit human approval; never unattended |

Wire the tiers into automation:

1. **Path-tier mapper** — extend `.agents/skills/systematic-test-matrix/scripts/run_matrix.mjs` (or a new `scripts/changed-files-gate.mjs`) to read `git diff --name-only origin/main` and emit which gate tier the change requires. Every AI session ends by running it; it prints the required commands and exits non-zero if any were skipped.
2. **Husky hooks (the missing piece)** — create `.husky/pre-commit` running fast gates (lint-staged style: eslint + tsc on touched files) and `.husky/pre-push` running the tier-appropriate Jest subset. This makes the AI's self-report moot — a bad change cannot leave the machine.
3. **GitHub Actions** — reuse `ci-cd.yml` jobs, but make the tier mapper a CI job too so PRs get labeled (`tier:L3` etc.) and higher tiers require the corresponding artifact (sync audit log, migration dry-run output) uploaded to the run.
4. **AI self-review pass** — before handing off, a second agent (no write access) reviews the diff against `AGENTS.md` anti-patterns (inline styles, arbitrary hex, direct WatermelonDB mutations, root-directory files, white-on-white TextInputs). Cheap, catches the most common drift.
5. **Evidence files** — following the `systematic-test-matrix` precedent, every gated run writes timestamped evidence under `tmp/systematic-test-matrix/`; the "done" claim must reference the file.

---

## 5. Tools / Building Blocks

- **Primary agent**: this Qoder session toolset (Read/Grep/SearchWorkspace, Bash, Agent delegation with `Explore`/`Plan`/`general-purpose`), driven by the existing `.agents/skills/`.
- **`SearchWorkspace` for discovery; subagents for parallel bulk work** — e.g. "add missing Jest coverage for these 15 services" is a fan-out of independent subtasks, each self-gated.
- **Playwright + browser MCP (`browser-use`)** for E2E authoring and visual checks against `npm run web` (mind the recorded harness traps: onboarding tour overlay, stale port 19119, mock-auth E2E users).
- **GitHub CLI (`gh`)** for issue-driven intake: convert `docs/BUG-AUDIT-AND-REMEDIATION-PLAN.md` items into labeled issues; AI works issue → branch → PR with tier labels; existing `create-github-issues.mjs` shows the precedent.
- **Context7** for Expo/WatermelonDB/NativeWind API lookups so the agent doesn't hallucinate version-55-specific APIs.
- **QMind knowledge base** (optional) — index `docs/` (COOPERATIVE_MANUAL, MPCO-MODULE-GUIDE, OFFLINE_FIRST_GUIDE) so domain rules are retrievable, not re-derived.
- **No new frameworks needed** — the repo already has Jest, Playwright, ESLint 9, husky, patch-package, ts-morph (useful for codemods), and GitHub Actions.

---

## 6. Gradual Rollout Plan

### Phase 0 — Foundations (≈ week 1)
- Create `.husky/pre-commit` + `pre-push` with fast gates; confirm they don't slow small edits past ~15s (scope to changed files).
- Add the "never automate" denylist (§3.3) to `AGENTS.md`.
- Write `scripts/changed-files-gate.mjs` implementing the §4 tier table.
- Housekeeping that helps agents: prune/ignore the stale `.agents/login*.tsx` files, reconcile `end-to-end-dev-pipeline.md` (it references the old `e:/GitHub/POS Cursor` paths and the dead `jetfarm.pages.dev` deploy target).
- **Exit criteria:** a commit with a lint error and a push with a failing targeted test are both blocked locally.

### Phase 1 — AI drafts, human verifies everything (≈ weeks 2–4)
- Use AI for L0/L1 tasks and for **test authoring only** (RED-first) in L2 areas. No AI-authored production code merges without line-by-line human review.
- Metrics: % of AI tests that pass unchanged after generation; time-to-green for a standard service test; false-positive rate of the self-review agent.
- **Exit criteria:** ≥90% of AI-written tests accepted after ≤1 revision; zero reverts caused by AI changes.

### Phase 2 — Assisted features with checkpoints (≈ weeks 5–8)
- AI takes full L2 feature tasks (screen + service + tests + E2E spec) using `AddCoopModule`/`testing`/`ui-patterns` skills; human approves plan and reviews diff.
- Enable CI tier labels; require evidence artifacts for L3+.
- Start scheduled unattended jobs with read-only scope: docs drift report, dependency/`expo-doctor` report, audit-script runs.
- **Exit criteria:** one complete feature shipped through the funnel per week with review time trending down.

### Phase 3 — Trust escalation on data-core surfaces (≈ weeks 9–12)
- Allow AI changes into L3/L4 (sync, accounting) but keep two-key review: self-review agent pass **plus** a human sign-off, and mandatory `check:sync` + `audit:crud:gate` + full Playwright in CI for those PRs.
- Add a mutation-style safety net: for SyncService and accounting services, maintain "golden dataset" round-trip fixtures (seed local → mutate → sync → reconcile) that AI cannot weaken.
- **Exit criteria:** 20 consecutive L3+ PRs with no post-merge data-integrity incidents.

### Phase 4 — Unattended workers, humans at the edges (ongoing)
- CI/queue-driven agents handle labeled backlog issues at L1–L2 fully autonomously up to PR-open (never merge, never deploy).
- Humans specialize in plan approval, L4/L5 review, deploys, and reviewing the weekly architecture/quality trend the scheduled agents produce.
- Quarterly re-run of BryV3 30-gate audit as an external check on the whole pipeline.

**Rollback rule:** any production incident traced to an AI-merged change drops that tier back one phase until the gate that missed it is fixed.

---

## 7. Quality Controls That Must Stay Non-Negotiable

1. TDD (RED-first) is already convention — AI must show the failing test in the diff.
2. Secrets policy unchanged: agents report env var *names*, never values; never fabricate `.env.production`.
3. E2E never targets production Supabase (existing `playwright.config.ts` guard — extend it to the tier mapper).
4. Deploy remains human-triggered and never killed mid-run (documented hazard).
5. Root cleanliness policy enforced automatically by the pre-commit hook (`scripts/` for scripts, `docs/` for docs).
6. Coverage of *what the change touched* matters more than global coverage %; per-tier targeted runs.

---

## 8. Top Risks and Mitigations

| Risk | Mitigation |
|---|---|
| AI produces plausible-but-wrong sync/accounting logic that tests miss | Golden round-trip fixtures (Phase 3), DB-trigger parity tests, two-key review for L4 |
| Gate theater — agent claims gates passed without running them | Evidence files in `tmp/systematic-test-matrix/` + CI re-runs the same commands independently |
| Loose TS (`strict:false`) hides type bugs in AI code | Long-term: enable `strict` per-directory incrementally with AI-drafted fixes; near-term: rely on test gates |
| Root/`.agents` clutter degrades context quality | Housekeeping in Phase 0; `file-organization` skill enforced by pre-commit |
| Unattended agent reaches a deploy/env path | Denylist in AGENTS.md + guard script + CI has no production credentials |
