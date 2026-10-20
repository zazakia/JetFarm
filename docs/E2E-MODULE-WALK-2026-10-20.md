# E2E Module Walk — Chrome against local Supabase (2026-10-20)

Harness: `scripts/e2e-module-walk.mjs` (headed Chrome via Playwright, real login, 37 routes,
screenshot + DOM + console capture per route).
Stack: app `http://127.0.0.1:8081` (Expo web dev), backend `http://127.0.0.1:46421`
(local `jetfarm-local` Supabase, Kong), session `admin@poscursor.com` / role `admin`.
Evidence: `tmp/systematic-test-matrix/2026-10-19T100344Z-db-prod/e2e-walk/` — `walk.json` plus
37 numbered PNGs (`01-hub.png` … `37-returns.png`).
Run result: `22 ok / 15 gated / 0 blank / 0 error / 0 fail`, exit 0, `console errors: 2`.

## Status taxonomy

`ok` = the route kept its own URL and rendered real content.
`gated` = the route redirected away (`/agribusiness` or `/`), so its screen never rendered.
This is feature-flag / role gating, not a crash. `blank` / `error` / `fail` = 0.

## Rendered (22)

| Screen | Route | Chars | Screenshot |
|---|---|---|---|
| Hub | `/` | 2909 | 01-hub.png |
| Agribusiness | `/agribusiness` | 2909 | 02-agribusiness.png |
| Accounting | `/accounting` | 1426 | 03-accounting.png |
| Areas | `/areas` | 1060 | 04-areas.png |
| Bank accounts | `/bank-accounts` | 1096 | 05-bank-accounts.png |
| Cash on hand | `/cash-on-hand` | 1178 | 07-cash-on-hand.png |
| Expenses | `/expenses` | 1057 | 10-expenses.png |
| Franchise | `/franchise` | 1435 | 12-franchise.png |
| Groups | `/groups` | 1070 | 13-groups.png |
| Marketplace | `/marketplace` | 1962 | 16-marketplace.png |
| Modules hub | `/modules` | 2437 | 17-modules.png, 24-modules.png |
| Returns | `/returns` | 1337 | 20-returns.png |
| System settings | `/settings` | 2170 | 21-settings.png |
| Transfers | `/transfers` | 1559 | 22-transfers.png |
| Users | `/users` | 1769 | 23-users.png |
| Water Station | `/modules/water-station` | 1348 | 28-modules_water-station.png |
| — customers | `/modules/water-station/customers` | 1078 | 29 |
| — deliveries | `/modules/water-station/deliveries` | 1081 | 30 |
| — inventory | `/modules/water-station/inventory` | 1094 | 31 |
| — history | `/modules/water-station/history` | 1052 | 32 |
| Returns (cashier group) | `/returns` | 1093 | 37-returns.png |

Auth + sync confirmed live: login `admin@poscursor.com` → `/agribusiness` "Operator Command
Center", `SYNCED` badge, and `/settings` showing `admin@poscursor.com / ADMIN ACCESS`,
Instant Sync on, `LAST SUCCESSFUL SYNC 10/20/2026, 1:26:27 PM`.

## Gated (15) — not exercised

| Route | Landed | Gate |
|---|---|---|
| `/borrowers`, `/loans`, `/loan-approvals`, `/collectors`, `/file-cases`, `/cic`, `/payments`, `/payroll` | `/agribusiness` | `system.lending` + `module.*` / `module.cic` keys in `src/utils/featureFlags.ts` (lending ships disabled) |
| `/modules/agri-store`, `/modules/pharmacy`, `/modules/transport` | `/agribusiness` | `feature.modules.{agri_store,pharmacy,transport}.enabled` false — modules hub renders each as `Inactive` / "FLAG DISABLED IN SETTINGS" |
| `/pos`, `/shift-open`, `/shift-close`, `/cash-drop` | `/` | cashier route group; admin session has no cashier lane |

To walk these, flip the flags in `/settings` and re-run:
`E2E_WALK_OUT=... node scripts/e2e-module-walk.mjs`. Water Station proves the module lane works
end to end once enabled. Note `/cic` is gated as a *screen*, but its service layer still fired the
two requests behind defect 1 before the redirect landed.

## Defects found

1. **CIC queries a table that does not exist.** `/cic` produced the only two console errors of the
   run (both logged inside that route's capture window, before the gate redirect completed):
   - `404 {"code":"PGRST205","message":"Could not find the table 'public.borrowers' in the schema cache"}`
   - `406 {"code":"PGRST116","details":"The result contains 0 rows","message":"Cannot coerce the result to a single JSON object"}`
   Reproduced against the local stack: `GET /rest/v1/borrowers` → 404 `PGRST205`; `GET
   /rest/v1/app_borrowers` → 401 (exists, RLS blocks anon). Canonical remote name is
   `app_borrowers` (`src/database/types.ts:131`, `BorrowerPortalService.ts:108` maps
   `borrowers: 'app_borrowers'`). Stale call sites:
   - `src/services/cic/CicExtractService.ts:122`
   - `src/services/cic/CicValidatorService.ts:240`
   - `src/utils/checkSupabaseSchema.ts:112,188,197` (197 is a `.delete()`)
   - `scripts/check-collector2.mjs:10`, `scripts/seed-diagnostic-data.mjs:66`
   Not fixed — needs a failing test first (TDD) and tier classification via `npm run gate`;
   `src/utils/checkSupabaseSchema.ts:197` deletes rows, so that file is data-mutation adjacent.
2. **Benign.** The 406 is a `.single()` on empty `cic_submissions` — correct behaviour for "no
   submission yet", but it logs a console error, so a strict CI gate would flag it.
3. **Pre-existing red gate, unrelated to this walk:** `npm run audit:crud:gate` →
   `FAIL: 1 HIGH table(s) … agri_pending_layout_operations -> —: not-in-sync-contract,
   hard-delete-no-softdelete-column` (from pushed commit `c7dceeb`).

## Harness caveats

- `ok` in the first run counted guard-refused redirects as passes; that is fixed — redirects are now
  `gated` and reported separately.
- The loopback backend guard is proven to fail (not decorative). With a `.env.local` pointing at
  `jetfarm-placeholder-db.supabase.co` the run aborts before Chrome opens:
  `WALK ABORTED: refusing to walk: .env.local EXPO_PUBLIC_SUPABASE_URL host is
  "jetfarm-placeholder-db.supabase.co", not loopback` (exit 1); a missing variable aborts the same
  way with `host is "unset"`.
- Console errors are captured globally, not attributed per route in `walk.json` beyond the
  `newConsoleErrors` count (both were attributed to `/cic` by that count).
- The onboarding tour modal was dismissed once after login; it reappears in later screenshots and
  can overlay content without changing the URL, so a screenshot is not proof the screen is
  interactive.
- Post-login `landedUrl` was `/loading`, not a named screen — the session is authenticated (the
  gated routes still redirect as an admin, and `/settings` shows the ADMIN ACCESS identity), but the
  first paint after sign-in is the loader, so this walk proves authenticated navigation, not a
  cold-start landing route.
- This walk is read-only navigation. No create/edit/delete flow was submitted on any screen, so
  form writes and the sync push path are still unverified here — `npm run check:sync` (94 passed) is
  the only sync evidence in this session.
