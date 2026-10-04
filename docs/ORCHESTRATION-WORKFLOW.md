# Manifest-Driven Build & Independent Verification Workflow

## Phase 0: Setup (Once)
1. **Project Brief**: Goal, users, stack, constraints, non-goals.
2. **Baseline Gates**: `tsc`, lint, unit tests, E2E harness, and CI all run green before feature work.
3. **Safety Rails**: Staging environment, DB backups, rollback procedure, and secrets policy (agent never touches prod credentials).
4. **Define ultra-qa-gate in writing**: Exactly what it checks, pass/fail criteria, and ownership.

## Phase 1: Manifest (Approved by Human)
Each feature entry contains:
- ID, title, one-line purpose
- **Testable acceptance criteria** (given/when/then)
- Dependencies on other features
- Data and migration impact (none, additive, destructive)
- Security and permission implications
- Out of scope
- Size estimate (split anything > 1 day)
*Order by dependency; foundational features first. Manifest frozen after approval.*

## Phase 2: Per-Feature Loop (Autonomous)
1. **Tests First**: Write acceptance tests from criteria before implementation.
2. **Implement**: On feature branch.
3. **Gates in Order**: `tsc` -> lint -> unit -> integration -> E2E for feature + full regression suite.
4. **Failure Policy**: Max 3 fix attempts per gate, then stop and escalate. No test weakening or deletion. Flakes quarantined, not retried endlessly.
5. **Feature Report**: What changed, files touched, tests added, deviations, assumptions.
6. **Merge**: Only when all gates pass.

## Phase 3: Cycle Review (5-Minute Digest)
Every 3 to 5 features:
- Diff summary & manifest deviations
- Test count & coverage trend
- New dependencies added
- Flagged uncertainties
*Human approves, redirects, or requests changes.*

## Phase 4: Hardening Sweep (After Each Cycle)
Run by an independent pass:
- Security: Dependency audit, auth & permission paths, input validation, secrets scan
- Code hygiene: Dead code, duplication, type escape hatches (`any`, `@ts-ignore`)
- Performance on key paths
- Test quality & mutation/failure spot-checks
- Accessibility & error-state review
*Findings become manifest tickets, not silent fixes.*

## Phase 5: Release Gate
1. Full gate suite on staging with production-like data.
2. `ultra-qa-gate` execution.
3. **Migration Review (Approved)**: Reversible/backed up, tested on real-shaped data, downtime impact stated.
4. **Deploy (Approved)**: Canary/staged rollout where possible.
5. **Post-Deploy**: Smoke tests, error-rate & log monitoring, rollback trigger ready.

## Approval Checkpoints
| Point | What You See |
|---|---|
| Manifest & Change Requests | Full scope |
| Cycle Digest | Short summary, 5 minutes |
| Migrations | Script, rollback, test evidence |
| Deploys | Gate results, rollout and rollback plan |
| Escalations | Only when the loop hits failure limits |
