# JetFarm — Full Code Review (2026-09-30)

**Branch:** `main` (working tree at `35bef44` + uncommitted mapping-module work)
**Method:** risk-based review of the whole app — deep on money paths, data layer, and shared
infrastructure; sampled sweep across screens; four lenses (correctness/data integrity,
security/secrets, architecture/sync, test quality & gate blindness).
**Mode:** report-only. No production code was modified by this review.

Every finding below was re-opened in source by the reviewer before publication. Where a claim
depends on a value that could not be read (production `.env.hetzner`, the live admin password,
the live Supabase policy state), it is explicitly marked **[needs confirmation]** rather than
asserted.

---

## 0. At a glance

**8 CRITICAL, 19 HIGH, 16 MEDIUM findings.** All of them pass today's gates: `tsc --noEmit` is
clean, `npm run lint` is clean, and Jest (209 suites / 1,653 tests) is 100 % green. The 25
Playwright specs (117 tests) were not all re-run for this review — see §8.

The four things that would make me hesitate to call this deployment production-ready:

1. **The web build cannot complete a confirmation dialog.** `Alert.alert` is a no-op in
   `react-native-web`; it is used at 547 sites, and 51 of them put the actual mutation inside
   `onPress` — month-end closing, remittance submission, loan approve/reject, several deletes.
   On web those features do not exist. (§C4)
2. **Row Level Security is decorative on every module added since the initial hardening.** 24
   tables — investor ledgers, farm expenses, payables, marketplace payouts, salaries — accept
   read/write from *any* authenticated user, including borrower-portal accounts; `app_payrolls`
   and `app_employees` have no predicate at all and were never tightened; the whole general ledger
   is `FOR SELECT … USING (true)` and is pulled without a row filter onto every device. (§C2, §C3)
3. **Sync can silently un-post the books and permanently drop rows.** Posted journal entries are
   flattened to `is_posted = false` on the way out with a swallowed re-post failure; hard deletes
   never travel to the server and can resurrect; offset paging plus an advancing watermark can skip
   a record forever. (§C8, §H14–§H18)
4. **55 of 88 tables do not sync at all unless an env flag is set** — which currently means the
   entire agribusiness outgrower module, the marketplace module, POS sessions and sales returns are
   device-local, while the UI reports "Sync completed". (§C7)

Counterweight: the transport layer of the sync engine, the core lending RLS hardening, the
double-entry DB triggers, the secret/env discipline, and the mapping module's evidence trail are
genuinely good (§5). This is not a codebase without care — it is a codebase whose automated gates
do not look at the places where the care is missing (§1).

---

## 1. Repo scale and gate posture (measured)

| Surface | Measured |
|---|---|
| Screens (`app/**` non-test `.ts`/`.tsx`) | 220 |
| `src/**` non-test files | 312 |
| Jest suites / `it()` blocks | 209 suites (`npx jest --listTests`), 1,653 blocks |
| Playwright specs / tests | 25 specs, 117 tests (`npx playwright test --list`) |
| Services / WatermelonDB models | 88 / 88 |
| Schema | v48, 88 tables |
| Supabase migrations / RLS policies | 64 files / 193 `CREATE POLICY` |
| Total LOC (`app` + `src`, non-test) | 108,535 |
| `tsconfig.json` | `"strict": false`, nothing else overridden |
| `eslint.config.js` | `react-hooks/exhaustive-deps`, `@typescript-eslint/no-unused-vars`, `import/no-unresolved`, `import/first` all **off**; no `no-console`, no `no-explicit-any` |

Static-avoidance census (non-test `app/**` + `src/**`):

| Pattern | Count |
|---|---|
| `: any` annotations | 663 occurrences / 138 files |
| `as any` casts | 187 occurrences / 77 files |
| `@ts-ignore` / `@ts-expect-error` / `eslint-disable` | 6 non-doc occurrences (low — suppression is done with `any`, not directives) |
| `console.*` | 310 in `app/`, 277 in `src/` |
| `toFixed` / `parseFloat`+`Number` in `src/services` | 105 / 138 |

Cost of turning the type gate on (from `npx tsc --noEmit <flag>`): baseline 0 errors,
`--noImplicitAny` 135, `--strictNullChecks` 168, `--strict` 720 (539 of them one
decorator-related code, TS2564).

**Interpretation.** `npm run lint` and `tsc` passing proves very little about null-safety,
effect correctness, or money types. Every finding in §2–§5 below survives both gates today.

---

## 2. CRITICAL

### C1 — The production login screen ships a one-tap admin button whose password is in the bundle

**Evidence**

| File:line | Content |
|---|---|
| `app/login.tsx:70-72` | `const HARDCODED_USERS = [{ id: 'cybergada', full_name: 'Click here to Login sir Jet', role: 'admin', email: 'cybergada@gmail.com' }];` |
| `app/login.tsx:218-220` | quick-login list is `[...quickUsers, ...HARDCODED_USERS]` — merged unconditionally, not gated by env or host |
| `app/login.tsx:164` | `const quickLoginEnabled = AuthService.isQuickLoginEnabled();` — the only gate |
| `src/services/AuthService.ts:39-47` | `isQuickLoginEnabled()` returns `false` **only** when the env string is exactly `'false'`. Unset, empty, `'0'`, `'no'` → enabled. Fails open. |
| `app/login.tsx:252-262` | `handleQuickLogin()` sets `setPassword('12345678')` then `await AuthService.quickSignIn(userEmail, '12345678')` |
| `src/services/AuthService.ts:12-13` | `E2E_TEST_USERS` contains the real production admin address `cybergada@gmail.com`, role `admin` |
| `src/services/AuthService.ts:62,65` | On a non-E2E host `quickSignIn` deliberately **falls through to real Supabase `signIn(email, password)`** |
| `supabase/queries/fix_users.sql:5,10-19` | Git-tracked provisioning script that `DELETE`s `auth.users` for `cybergada@gmail.com` and re-inserts it with a `crypt()`-hashed weak shared password (same hash variable used for all four admin/collector/encoder accounts) |

**Impact.** On `https://jetfarm.818.quest` the login page renders a card labelled
"Click here to Login sir Jet" that attempts a real admin sign-in with the constant `12345678`.
Two of the three links in that chain are verified in source; only the live password hash is
unread here. The bundle also permanently discloses the admin email plus a candidate password,
and the guard that is supposed to switch this off fails open.

**[needs confirmation]** Whether `cybergada@gmail.com` currently authenticates with `12345678`
against `supabase.818.quest`. This review did not attempt production authentication (out of
scope and unauthorized). Owner check: attempt that login once, or read
`encrypted_password` for that user and compare against a `crypt('12345678', …)` hash.

**Remediation.** (1) Invert the default: `isQuickLoginEnabled()` returns `true` only when the
env value is exactly `'true'` **and** `EXPO_PUBLIC_APP_ENV !== 'production'`. (2) Never merge
`HARDCODED_USERS` when quick login is disabled. (3) Remove real accounts from
`E2E_TEST_USERS`; use synthetic `*@jetfarm.test` addresses only. (4) Move `fix_users.sql` and
its siblings behind a `DO $$ … $$` guard that raises unless a local-only setting is present.
(5) Rotate the admin password and stop using `12345678` anywhere.

---

### C2 — Row Level Security is decorative on ~30 money, HR and inventory tables

193 policies exist; **100 use `USING (true)`**, **51** are blanket `FOR SELECT`, and **29** are
`FOR ALL TO authenticated USING (true) WITH CHECK (true)` across **24 distinct tables**:

```
agri_parcels, agri_land_owners, agri_investors, agri_investor_ledgers, agri_crop_cycles,
agri_growth_checkins, agri_harvest_logs, agri_farm_expenses, agri_farm_workers,
agri_labor_logs, agri_weekly_settlements,
marketplace_stores, marketplace_categories, marketplace_products, marketplace_orders,
marketplace_sub_orders, marketplace_order_items, marketplace_payouts, marketplace_disputes,
marketplace_promotions, marketplace_reviews,
suppliers, accounts_payable_vouchers, stock_movements
```

Representative evidence:

```sql
-- supabase/migrations/20260911030000_agribusiness_outgrower_platform.sql:222-229
CREATE POLICY "Allow authenticated read/write on agri_investors"     ON public.agri_investors     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated read/write on agri_investor_ledgers" ON public.agri_investor_ledgers FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

Separately, the **legacy payroll tables have no predicate at all** and were never tightened by
any of the 64 migrations (`grep -rn "DROP POLICY" | grep -i "payroll\|employee"` → no match):

```sql
-- supabase/migrations/20260524120000_create_payroll_tables.sql:23-29 and :52-58
CREATE POLICY "Authenticated users can read payrolls"   ON app_payrolls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert payrolls" ON app_payrolls FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update payrolls" ON app_payrolls FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
```

**Impact.** Any signed-in user — including a borrower-portal account, which is the lowest-trust
role the app issues — holds a valid `authenticated` JWT. With the anon key already inside the
bundle, `PATCH/POST https://supabase.818.quest/rest/v1/app_payrolls`,
`/agri_investor_ledgers`, `/accounts_payable_vouchers` or `/marketplace_payouts` succeeds. Salaries,
investor capital ledgers, landowner settlements and payables are freely readable and writable
by every account in the system.

Note the contrast that makes this a regression-by-omission rather than a blanket failure: the
core lending tables **were** properly hardened over four migrations
(`20260411150000`, `20260417180000`, `20260421141000`, `20260501164107`, `20260511121243`) and
self-escalation on `user_profiles` is genuinely blocked by
`prevent_user_profile_self_escalation` (`20260521165000:44-65`). Each new module then reintroduced
the pattern the hardening removed.

**Remediation.** One migration that drops every `FOR ALL … USING (true)` policy on the listed
tables and replaces it with `public.is_global_admin()` (or a role list) for writes plus a
branch/ownership predicate for reads; add a CI assertion that fails when a policy containing
`USING (true)` is created on a table holding money or PII.

---

### C3 — The entire general ledger is downloaded to every device

```sql
-- supabase/migrations/20260705000000_add_accounting_tables.sql:110-111, :124-125
CREATE POLICY "journal_entries_read"       ON public.journal_entries       FOR SELECT TO authenticated USING (true);
CREATE POLICY "journal_entry_lines_read"   ON public.journal_entry_lines   FOR SELECT TO authenticated USING (true);
```

The pull path has no compensating filter. `SyncService.applyBranchPartitionFilter`
(`src/services/SyncService.ts:359-394`) short-circuits to an unfiltered query for every role
except `branch_cashier`, `branch_manager` and `area_supervisor`, and even for those it only
partitions `commissary_dispatches`, `waste_logs`, `royalty_calculations`. The pull itself is
`SELECT *` per table (`:956-961`).

**Impact.** For borrower, collector, and encoder sessions the RLS policy is the only boundary
between the ledger and the device, and it says `true`. Cost prices, margins, journal detail and
counterparty names land in the browser's memory/localStorage or on-device LokiJS, where they are
readable by the operator of that device. Combined with C2 the same accounts can also write to the
`agri_*` / `marketplace_*` / `app_payrolls` tables, which then auto-post journals.

**Remediation.** Scope ledger reads by branch and by role predicate; make the sync pull
explicitly field- and row-limited rather than `SELECT *`; treat "the browser has the whole
book" as a threat, not a convenience.

---

### C4 — On the deployed web build, every `Alert.alert` dialog is a silent no-op — including the buttons that perform the work

`react-native-web` exports `Alert` as a class whose only member is empty:

```js
// node_modules/react-native-web/dist/exports/Alert/index.js
class Alert { static alert() {} }
```

Measured over non-test `app/**` + `src/**` (531 files scanned by balanced-parenthesis parse):

| Metric | Value |
|---|---|
| `Alert.alert(` call sites | **547** |
| Call sites whose argument list carries `onPress` (the action itself) | **51** |
| …of which the callback performs a consequential mutation (delete/close/approve/disburse/post/purge) | **30** |
| Silent guard form `return Alert.alert(…)` with no `onPress` | 11 |
| Files containing `Alert.alert` with **no** `Platform.OS`/`window.alert`/`errorAlerts` path at all | **90 files / 374 call sites** |
| Imports of the shared helper `src/utils/errorAlerts.ts` | 14 files |
| Files using an inline `window.alert` branch | 24 files |
| Screens using `ConfirmDialog` (the working web pattern) | 15 files |
| Screen files using `AppToast` | 3 (`app/_layout.tsx`, `settings/index.tsx`, `settings/ui-branding.tsx`) |
| `AppToast.web.tsx:8` behaviour | `console.log` only — no visible toast |

Verified examples of features that simply do not exist on web:

```tsx
// app/(admin)/settings/closing.tsx:44-70 — month-end close lives inside onPress
Alert.alert("Confirm Monthly Closing", `…close the books for ${format(prevMonth,'MMMM yyyy')}?…`, [
  { text: "Cancel", style: "cancel" },
  { text: "Close Month", onPress: async () => { … await MonthlyClosingService.closeMonth(prevMonth) … } },
]);

// app/(admin)/settings/index.tsx:97-100 — same shape for the sample-data purge
Alert.alert('Delete Sample Data', message, [
  { text: 'Cancel', style: 'cancel' },
  { text: 'Delete', style: 'destructive', onPress: () => runSampleDataAction('purge') },
]);
```

Two distinct symptoms, both bad: (a) `return Alert.alert("Error", "Enter a valid amount.")`
(`app/(admin)/borrowers/[id]/savings.tsx:100-101,158-160`) aborts the save with **zero** user
feedback — the button appears dead; (b) the `onPress` cases mean the mutation is unreachable, so
month-end closing, remittance submission, loan approve/reject and several deletes are
native-only features on a web-first deployment.

**Why the gates miss it.** Jest runs under `jest-expo` where `Alert` is mockable and asserted as
called; Playwright's E2E suite runs against mock-auth hosts (§H8) and asserts text presence, so
neither surface notices that the shipped web bundle cannot complete a confirmation.

**Remediation.** Ship one `src/utils/alert.ts` that re-exports a cross-platform
`showAlert(title, message, buttons): Promise<number>` — `ConfirmDialog` (`src/components/ConfirmDialog.tsx`,
already supports `mode: 'alert' | 'confirm'`) is the web implementation — and ESLint-ban direct
`Alert.alert` in `app/**`. That single change converts 547 broken sites into 547 working ones
and deletes the 24 ad-hoc `window.alert` branches and the 14 `errorAlerts` imports.

---

### C5 — The cashier Z-Reading screen invents the sales figures and saves nothing

```tsx
// app/(cashier)/shift-close.tsx:22-32
// Simulated/active shift data
const shiftSummary: ShiftSummaryInput = useMemo(() => ({
    branchId: branchId || 'branch-bagacay',
    cashierId: user?.id || 'cashier-1',
    openingFloat: 2000.0, grossSales: 16850.0, cashSales: 14200.0,
    nonCashSales: 2650.0, totalDrops: 10000.0, orderCount: 54,
}), [branchId, user?.id]);

// :66-70 — "confirm" path
onPress: () => {
    Alert.alert('Register Locked', 'Shift report saved and sent to Main Office.', [ … ]);
}
```

`ShiftCashService` exposes real, DB-writing methods — `openShift` (`:118`),
`recordCashDrop` (`:164`), `blindCloseShift` (`:194`) — and `shift-open.tsx:26` and
`cash-drop.tsx:26` do call theirs. **`blindCloseShift` has zero callers in the repository**
(verified by grep across `app/**` and `src/**`). The physical count is therefore reconciled
against a hardcoded fiction, the variance is meaningless, and the end-of-day report is never
persisted on any platform. On web the two alerts are no-ops (C4), so the button does nothing at all.

**Remediation.** Load the live session from `pos_sessions`/`cash_drops` (the service already
models them), call `blindCloseShift`, and gate the screen on an open session.

---

### C6 — Landowner settlement has no idempotency, so payouts and journals can duplicate

`src/services/LandSettlementEngine.ts`

```ts
:117  // 2. Query previous settlements for this cycle (excluding draft, but including approved or paid)
:127    .filter(s => s.weekNumber < weekNumber && s.paymentStatus !== 'rejected')   // ← drafts INCLUDED, contradicting :117
:151-168 await db.write(async () => { settlement = await db.get('agri_weekly_settlements').create(…) })   // ← no existence check for (cycle, week)
:186-224 approveSettlement(): no status guard; unconditionally updates status and calls AutoPostingService.postAgriWeeklySettlement
```

**Worked impact.** `computeWeeklySettlement(cycle, 5)` executed twice creates two draft rows for
week 5. Both are then counted by week 6's `previousCumulativePayout` (`:126-128`), which
guarantees the landowner is underpaid on the second-and-later weeks. Separately, re-approving an
already-`paid` settlement posts a **second journal entry for the same payout** — there is no
`paymentStatus === 'paid'` rejection and `postAgriWeeklySettlement` is called for the same
`settlementId` again.

This is also the least-tested money path in the app: 25.0 % line / 7.3 % branch coverage
(`LandSettlementEngine.test.ts` is 109 lines and covers only the pure
`calculateSettlement` arithmetic; lines 94-226 are untouched).

**Remediation.** Unique constraint / upsert on `(crop_cycle_id, week_number)`; reject
`approveSettlement` unless the current status is `draft`; exclude `draft` from prior-payout sums
to match the comment; add LokiJS-backed tests for the two methods using `createTestDatabase()`.

---

### C7 — 55 of the 88 tables, including the whole agribusiness, marketplace and POS-returns modules, never sync to the server

```ts
// src/services/SyncService.ts:22-24
const CONFIG_SYNC_ENABLED =
    process.env.EXPO_PUBLIC_ENABLE_CONFIG_SYNC === '1' ||
    process.env.EXPO_PUBLIC_ENABLE_CONFIG_SYNC === 'true';

// :49-51
export const SYNC_TABLES = CONFIG_SYNC_ENABLED
    ? [...CONFIG_SYNC_TABLES, ...CORE_SYNC_TABLES]
    : CORE_SYNC_TABLES;
```

`src/services/syncTableContract.json` splits the schema into **33 core + 55 config tables — 88
total, i.e. the entire schema**. Verified membership (count of tables per prefix):

| Prefix | core | config |
|---|---|---|
| `agri_*` (outgrower platform) | 0 | **11** |
| `marketplace_*` | 0 | **10** |
| `pos_sessions` | 0 | 1 |
| `sales_returns` | 0 | 1 |
| remaining config | — | 32 |

Unless `EXPO_PUBLIC_ENABLE_CONFIG_SYNC` is exactly `'1'` or `'true'`, every parcel, landowner,
investor, crop cycle, harvest log, farm expense, labor log, weekly settlement, investor ledger,
marketplace order/payout, POS session and sales return exists **only on the device that created
it**. Nothing in the UI distinguishes the two sets, and the sync badge reports success
(`SyncService` marks the cycle completed once the 33 core tables round-trip).

This interacts with §C4: on the web build an operator can create a parcel, see "Parcel saved",
see "Sync completed", and the record will still be in that browser tab's memory when the tab
closes.

**Verified in the local environment.** `EXPO_PUBLIC_ENABLE_CONFIG_SYNC=false` in `.env.local` — so
today, on the development machine, the 55 config tables provably do not sync.

**[needs confirmation]** the value of `EXPO_PUBLIC_ENABLE_CONFIG_SYNC` in `.env.hetzner` —
production env files are not read by this review. Owner check: `SELECT count(*) FROM
agri_parcels;` on `supabase.818.quest` and compare with the count visible in the admin UI.

**Remediation.** Either promote the business tables that have remote migrations applied into
`coreTables`, or show a persistent "this module is device-local" indicator and add a contract
test asserting `SYNC_TABLES` covers every table any screen writes to.

---

### C8 — Posted journal entries are demoted to draft on every push, and the re-post that should fix them swallows its own failures

```ts
// src/services/SyncService.ts:1193-1197
// Unconditionally ensure that all journal_entries pushed via upsert are saved as drafts
// (is_posted=false) to avoid trg_enforce_balanced_journal_insert triggering before journal_entry_lines exist.
toUpsert.forEach(r => { r.is_posted = false; });

// :1484-1497 — the corrective re-post
if (postErr) {
    console.warn('[SyncService] Failed to post eligible journal entries in batch:', postErr);
    for (const singleId of eligibleIds) {
        try { await this.supabase.from('journal_entries').update({ is_posted: true }).eq('id', singleId); }
        catch (singleErr) { console.warn(`[SyncService] Failed to post journal entry ${singleId}:`, singleErr); }
    }
}
```

The demotion is deliberate and well-reasoned (the insert trigger needs the lines present first);
the **unconditionality** is the defect — a row that is already posted remotely is re-pushed as a
draft, and if the follow-up `UPDATE … is_posted = true` fails (RLS rejection from §H7, a
`trg_enforce_balanced_journal` mismatch from §H2, a network timeout) nothing is reported: only
`console.warn`, and `pushChanges` still returns success, so WatermelonDB marks the record clean
and never retries. The remote row stays `is_posted = false`; on the next pull the clean local row
loses the conflict and the local entry silently becomes a draft too.

**Impact.** In a double-entry system, silently un-posting entries removes them from posted trial
balances, financial statements and statutory books — exactly the artefacts this app generates for
regulatory (CIC) and cooperative reporting. The server-side balance trigger means the books are
not merely mislabeled; they are incomplete.

**Remediation.** Set `is_posted = false` only when the entry has no posted twin remotely, and on
re-post failure return the ids in `experimentalRejectedIds` so the local rows stay pending and
retry. Add a sync test that asserts a posted entry stays posted across two cycles.

---

## 3. HIGH

### H1 — Loans are marked fully paid with a systematic ₱1-per-installment hole

`src/services/PaymentService.ts:16` `const PESO_TOLERANCE = 1;` is used as the "settled" test at
`:392` (`totalPaid >= totalExpected - PESO_TOLERANCE`), `:405`, `:440`
(`remainingPaid >= scheduledAmount - PESO_TOLERANCE`) and `:476`
(`if (perScheduleDeposit <= PESO_TOLERANCE) return;`).

A 24-installment loan can close ₱23.99 short, and a legitimate ₱1.00 schedule deposit is
silently ignored by the savings-allocation path at `:476`. Across a portfolio this is a permanent
revenue leak that also masks collector under-remittance. Fix: tolerance ≤ 0.005, round
installments once at schedule generation, and make `:476` a `<= 0` check.

### H2 — Journal entries accept `NaN` and sub-centavo imbalance, then fail sync permanently

```ts
// src/services/JournalEntryService.ts:133-136
const totalDebit  = normalizedLines.reduce((s, l) => s + (l.debitAmount  ?? 0), 0);
const totalCredit = normalizedLines.reduce((s, l) => s + (l.creditAmount ?? 0), 0);
if (Math.abs(totalDebit - totalCredit) > 0.01) throw …   // Math.abs(NaN) > 0.01 === false
```

`?? 0` does not catch `NaN`. `app/(admin)/accounting/journal-entries.tsx:130-131` builds amounts
with `parseFloat(line.debitAmount as any)`, and the guard at `:136`
(`l.debitAmount === 0 && l.creditAmount === 0`) is `false` for `NaN`, so a typed value of `"abc"`
reaches the service as `NaN` and is stored. The UI never compares totals before submitting
(`:166-167` are display-only). Independently, three debits of `333.335` sum to `1000.005` —
inside the client's 1-centavo tolerance — but Postgres `NUMERIC(15,2)` rounds per column and
`trg_enforce_balanced_journal` (`20260910000000_crispyking_enterprise_accounting_hardening.sql`)
compares with strict `!=`, so the row is rejected at the database and the client/server books
diverge with no user-visible error. Fix: round every line to centavos at input, require exact
`=== 0`, and reject non-finite amounts.

### H3 — Ledger aggregation silently drops lines, understating balances

```ts
// src/services/JournalEntryService.ts:365
const lineMap = new Map(lines.map(l => [l.journalEntryId, l]));
```

`lines` is already filtered to one account (`:338-341`), so keying by entry id keeps only the
**last** line per entry. An entry with `1010 Dr 500` and `1010 Dr 300` against `2010 Cr 800`
reports a ₱500 movement (`:374-376`), and `getAccountBalance`/trial balance statements built on
this read inherit the error. Fix: sum all lines per entry.

### H4 — Payment journals post reconstructed cash, not the cash actually received

`src/services/PaymentService.ts:108-110` splits a payment by a principal/total ratio and clamps
interest with `Math.max(0, …)`; `AutoPostingService.ts:227` then debits Cash with
`principal + interest + penalty + serviceCharge`. When the clamp fires, or when the loan's
flat-rate `totalAmount` bundles deposit and insurance (`LoanCalculatorService.ts:156`), the debit
no longer equals the receipted amount and fee recoveries are booked to Interest Income (4010)
instead of a liability. Fix: debit Cash with `params.amount` and derive the split from the
schedule's actual remaining balances.

### H5 — Collector commission: a rate of `1` means 100 %

```ts
// src/services/CollectorCommissionService.ts:67-73
calculateCommission(collectionAmount: number, commissionRate: number): number {
    const rate = Math.max(0, commissionRate);
    // If rate > 1, assume whole percentage (e.g. 5 = 5%). If rate <= 1, assume decimal (e.g. 0.05 = 5%)
    const decimalRate = rate > 1 ? rate / 100 : rate;
    return Math.round(amount * decimalRate * 100) / 100;
}
```

The contract at `:24` documents whole percents (`e.g. 5 for 5%`) and
`SampleDataService.ts:234` seeds `5`. But a configured **1 %** commission pays **100 %** of the
collection (₱10,000 collected → ₱10,000 commission), and 0.5 % pays 50 %. There is no admin UI
for `commissionRate` (grep finds none in `app/**`), so values arrive only from seed or remote
sync, and `CollectorCommissionService.test.ts:18-23` pins only the `5` and `0.05` cases. The
marketplace side uses the opposite convention (`0.035`, `MarketplaceOrderService.ts:35`), which
guarantees someone eventually stores the wrong unit. Fix: one documented unit, a range check, and
a rejection of `rate <= 0 || rate > 100`.

### H6 — PH statutory payroll is inert: contributions are hardcoded to zero

```ts
// src/services/PayrollService.ts:241-243 (and the ER block at :247-249)
l.sssEe = 0;  l.philhealthEe = 0;  l.pagibigEe = 0;  l.withholdingTax = 0;
l.totalDeductions = 0;  l.netPay = basicPay;
```

`grep "sssEe ="` across `app/**` and `src/**` returns **only those zero assignments** — no code
path in the repository ever computes a statutory deduction, and no screen writes the fields.
Meanwhile `supabase/migrations/20260910010000_crispyking_payroll_module.sql:17,33-58` seeds a
complete 2026 SSS MSC bracket table, and `src/database/models/StatutoryRate.ts` is registered in
`src/database/index.ts:79,173` — but no service or screen ever queries `statutory_rates`
(verified: only registration sites match). The `trg_auto_post_payroll_journal` trigger sums the
zeroed columns, so the journal it posts is also wrong.

`AGENTS.md` records "Modules Added: PH Payroll Rules (SSS, PhilHealth, Pag-IBIG)" on
2026-09-10. The tables and rate data shipped; the computation did not. Payslips therefore
understate deductions and overstate net pay, on every payslip, for a jurisdiction with statutory
filing obligations.

### H7 — Encoders are silently locked out of ledger writes by a hyphen/underscore mismatch

```sql
-- supabase/migrations/20260705000000_add_accounting_tables.sql:113-121
… WHERE id = auth.uid()::text AND role IN ('admin', 'loan-encoder', 'payment-encoder', 'expenses-encoder')
-- supabase/migrations/20260910010000_crispyking_payroll_module.sql:361-368: same hyphenated names
```

`src/constants/roles.ts:5-7` and every seed define `loan_encoder`, `payment_encoder`,
`expenses_encoder` — underscores. Only `'admin'` ever matches, so encoder-initiated journal and
payroll writes are rejected by RLS. It fails closed (no exposure) but the rejection arrives as a
sync-push error, and the client UI has already told the encoder it saved (C4). Fix: one shared
role-name constant on the SQL side, plus a policy test that asserts each app role can perform its
documented writes.

### H8 — Mock auth and mock sync are enabled by hostname at runtime; the "Sync completed" banner can be a lie

```ts
// src/utils/e2eEnvironment.ts:11-20
const isPagesDev  = hostname.endsWith('.pages.dev')   && !isJetfarmPagesHost;
const isNetlify   = hostname.endsWith('.netlify.app') && !isJetfarmNetlifyHost;
return (isLocalhost && isE2EPort) || isPagesDev || isNetlify;
```

Anything served from **any** Cloudflare Pages or Netlify hostname other than two exact names is
treated as a test rig:

- `src/store/AuthContext.tsx:61-85` accepts `localStorage['jetfarm:e2e-auth-user']` as a session,
  and `AuthService.ts:173-176` takes the **role** from that same JSON → trivially forged admin UI.
- `src/services/SyncService.ts:556-562` short-circuits the sync cycle and sets
  `status: 'completed', progress: 1, currentModel: 'Sync completed (mock mode)'`.

**Impact.** A preview or staging build on a `*.pages.dev` URL shows a green "Sync completed",
accepts a hardcoded test identity with password `12345678`, and writes only to browser memory.
Data entered there never reaches Postgres, and nothing on screen says so. `AuthService.ts:152`
additionally makes `signOut()` a no-op in that mode.

**Remediation.** Decide E2E-ness at **build** time (`EXPO_PUBLIC_E2E_MODE`) and delete the
hostname branch entirely; refuse to bundle the mock path when `EXPO_PUBLIC_APP_ENV=production`.

### H9 — Field encryption fails open, so bank account numbers are stored in clear

```tsx
// app/(admin)/bank-accounts/new.tsx:62-63 (and :72-73 on create)
acc.accountName    = EncryptionService.encrypt(accountName.trim())    ?? accountName.trim();
acc.accountNumber  = EncryptionService.encrypt(accountNumber.trim())  ?? accountNumber.trim();
```

`EncryptionService` returns `null` when `EXPO_PUBLIC_ENCRYPTION_KEY` is unset — which is the
documented state of `.env.local` — so the `??` persists plaintext. Any deployment that forgets
the key silently stores banking credentials unencrypted while the model still claims they are
encrypted. The mirror-image defect is already visible in the UI: `app/(admin)/borrowers/index.tsx`
carries the comment *"Note: address and phone are encrypted, so we can't Q.like them easily"*,
so search is degraded for exactly the fields encryption was meant to protect. Fix: throw on
missing key rather than falling through, and add a searchable blind-index (HMAC) column instead.

### H10 — The "never touch production" guard cannot fire against the real production host

```ts
// src/database/supabaseSafety.ts:1-3
export const PRODUCTION_SUPABASE_URLS = new Set<string>([
    'https://jetfarm-placeholder-db.supabase.co',   // documented in AGENTS.md as DEAD
]);
```

The live Supabase (`https://supabase.818.quest`, per `AGENTS.md`) appears in **no** `src/**` or
`tests/**` file, so all three consumers — `src/jest-setup.ts:29`, `playwright.config.ts:19`,
`src/database/supabase.ts:37` — pass it silently. `playwright.config.ts:18` also documents an
escape hatch (`PLAYWRIGHT_ALLOW_PRODUCTION_DB=1`). Additionally, the client falls back to
committed literals when env vars are absent — `src/database/supabase.ts:31-33` defaults the URL to
`http://127.0.0.1:46421` and the anon key to a committed `sb_publishable_…` value (40 chars,
value not reproduced here by policy). A production export missing an env var therefore boots
against the wrong backend with a key that looks valid.

**Fix.** Convert the denylist into an **allowlist** of `localhost`/`127.0.0.1`/`10.0.2.2` plus the
explicit staging host; delete both key literals and fail fast when an env var is missing.

### H11 — Auto-post failures are logged to console while the UI claims the ledger was updated

```tsx
// app/(admin)/agribusiness/labor.tsx:198-212
await AutoPostingService.postAgriLaborLog({ …, postedBy: 'Operator' });
} catch (postErr) { console.warn('[FarmLabor] Auto-post labor log warning:', postErr); }
loadData();
Alert.alert('Success', 'Labor payment marked as paid and posted to General Ledger.');
```

The GL post failed, nothing is surfaced, and the operator is told the ledger was updated. The same
swallow-and-claim pattern is enabled by a wider gap: of 183 `useEffect` blocks in `app/**` +
`src/**`, **108 contain an `await`, and only ~3 use a mounted/abort/ignore guard** (105 unguarded
occurrences across 91 files; heuristic 1,200-char window per effect). Late responses overwrite
fresh state and `setState` fires after unmount. Also see
`app/(collector)/collection-sheet.tsx:150` — the effect's dependency array omits `collectorId`,
which `:76` uses as `collectorId || user.id`, so the sheet can be permanently scoped to the wrong
collector.

### H12 — Two CIC buttons navigate to routes that do not exist

```tsx
// app/(admin)/cic/index.tsx:360, :388
onPress={() => router.push('/(admin)/cic/generate' as any)}
onPress={() => router.push('/(admin)/cic/special-submission' as any)}
```

`app/(admin)/cic/` contains only `index.tsx`, `missing-fields.tsx`, `settings.tsx`,
`validation-report.tsx`. The `as any` cast is precisely what suppressed the type error that would
have caught this. In the regulator-facing submission module, "Generate Regular File" and "Trigger
Special Submission" — the two primary actions — are dead ends. (187 `as any` sites across `app/**`
make this class of error invisible to `tsc` repo-wide.)

### H13 — `deploy:hetzner` can leave production secrets on disk permanently

```js
// scripts/deploy-hetzner.mjs:120-127, 161-163
let originalLocalEnv = null;
if (fs.existsSync(localEnvPath)) originalLocalEnv = fs.readFileSync(localEnvPath, 'utf8');
try { if (fs.existsSync(hetznerEnvPath)) fs.writeFileSync(localEnvPath, fs.readFileSync(hetznerEnvPath, 'utf8')); }
finally { if (originalLocalEnv !== null) fs.writeFileSync(localEnvPath, originalLocalEnv, 'utf8'); }
```

If `.env.local` did not exist before the run, nothing is restored **and nothing is deleted**: the
full `.env.hetzner` contents (production anon key and a real 32-char
`EXPO_PUBLIC_ENCRYPTION_KEY`) stay in `.env.local`, where every subsequent local dev session and
every Jest run then silently loads them. Combined with H10 — whose denylist does not contain the
live host — that is a local test suite talking to production. Fix: `fs.rmSync(localEnvPath)` in
the `else` branch, and add the live host to the safety guard.

---

### H14 — The Chart-of-Accounts ID migration runs inside every sync cycle and forks the account list per device

```ts
// src/services/SyncService.ts:549-554 — executed on every cycle
await ChartOfAccountsService.ensureDeterministicIds();

// src/services/ChartOfAccountsService.ts:452
newRecord._raw._status = coa._raw._status === 'synced' ? 'synced' : 'created';
// src/services/ChartOfAccountsService.ts:477
await coa.destroyPermanently();
```

`_status: 'synced'` tells WatermelonDB the row already exists remotely, so the new deterministic-id
account is **never pushed**; `destroyPermanently` (§H15) is invisible to sync, so the legacy row
stays live in Supabase. Each device therefore converges on ids the server has never seen, while the
server's legacy ids keep resurrecting on full re-pulls.

Mitigating fact, verified: `journal_entry_lines.account_code` is `TEXT`
(`20260705000000_add_accounting_tables.sql:73`), not a FK to `chart_of_accounts.id`, so the split
duplicates the *account list* (two rows for code `1010` in reports) rather than orphaning journal
lines.

**Fix.** Run the migration once under a recorded version marker, create replacements as `'created'`
(or push them explicitly), and emit a real remote delete for the legacy ids.

---

### H15 — Hard deletes never reach the server and can come back to life

```ts
// src/services/BaseModelService.ts:76-82
async delete<T extends Model>(model: T, performedBy?: string) {
    const oldData = model._raw;
    await this.db.write(async () => { await model.destroyPermanently(); });
```

The pull's delete channel is built exclusively from remote `deleted_at`
(`SyncService.ts:1008-1011`: `.select('id,deleted_at').not('deleted_at','is',null)`), and
`destroyPermanently` produces no outbox entry. A record hard-deleted on a device therefore remains
live in Postgres — visible to Metabase, to other devices, and eligible for the
`sendCreatedAsUpdated` re-materialisation path (`:1049-1051`) on any full re-pull (`:676-691` passes
a `null` cursor for migrated tables). Screens are also inconsistent about this: several delete flows
write `deleted_at` (soft) while this shared service hard-deletes.

**Fix.** `markAsDeleted()` plus a `deletedAt` write in `BaseModelService.delete`; reserve
`destroyPermanently` for genuinely local-only caches.

---

### H16 — A remote delete unconditionally destroys another device's unsynced edits

```ts
// src/services/SyncService.ts:1053
const deleted: string[] = allDeleted.map((r: any) => r.id);
```

No local-`_status` filter is applied, so a row that is still `created`/`updated` and pending push on
this device is destroyed when a peer soft-deletes it remotely. The protection that does exist,
`findConflictingRemoteIds` (`:1544`), guards only the **push** phase — and push runs after pull — so
an offline collector's edited payment is deleted before it is ever compared. `applyRemote` makes the
delete win and nothing is surfaced. *(Mechanism reasoned from the documented WatermelonDB
`applyRemote` semantics plus the code above; not reproduced at runtime in this review.)*

**Fix.** Exclude ids whose local row has `_status !== 'synced'` from `deleted`; defer them one cycle
and record a conflict.

---

### H17 — Deletes are pushed as partial upserts, so a locally-created-then-discarded id inserts a phantom row and wedges that table's queue

```ts
// src/services/SyncService.ts:1285-1291
const deletePayload = deletesToPush.map((id) => ({ id, deleted_at: deletedAt, updated_at: updatedAt }));
const { error } = await withSyncTimeout(this.supabase.from(remoteName).upsert(deletePayload), …);
```

`upsert` inserts when the id is unknown. For a record created and discarded locally before it ever
synced, this POSTs a row with every business column absent → `23502` null-value / `23505` conflict →
treated as a permanent error → the whole table's push throws (§M14). Core tables have no per-record
deferral (only config tables do), so one ghost id blocks that table indefinitely.

**Fix.** `.update({ deleted_at, updated_at }).in('id', ids)` and report unmatched ids as rejected.

---

### H18 — Offset pagination over a mutating set plus an advancing watermark can permanently skip rows

```ts
// src/services/SyncService.ts:960-961, :976
.order('updated_at', { ascending: true }).order('id', { ascending: true })
pageQuery.range(activePage * pageSize, (activePage + 1) * pageSize - 1)

// :658-660 — next cycle's floor
const lastSyncDate = lastPulledAt ? new Date(lastPulledAt - 2000).toISOString() : null;
```

If a row is deleted (soft- or hard-) while a multi-page pull is in flight, later rows shift into
earlier pages and the tail is skipped; because the next pull floors at `watermark − 2000 ms`, a
skipped row whose `updated_at` predates the watermark is never fetched again. The device then simply
lacks that borrower or loan forever, with no error. `SyncService.regression.test.ts:311` exercises a
*stable* 1,000-row set, so this is uncovered.

**Fix.** Keyset pagination (`updated_at > cursor`), or advance the watermark only to the maximum
`updated_at` actually observed in the returned pages.

---

### H19 — `DATE_FIELDS` is hand-maintained and omits every agri / POS / returns date column, so enabling config sync (§C7) breaks those pushes

`SyncService.ts:217-276` contains **zero** entries matching `agri_`, `pos_sessions` or
`sales_returns` (grep-verified), yet those columns are date-typed on both sides:

| Column | Local schema | Model | Remote |
|---|---|---|---|
| `agri_crop_cycles.planting_date` | `number` (`schema.ts:1441`) | `@date` (`AgriCropCycle.ts:12`) | `TIMESTAMPTZ` (`20260911030000…sql:59`) |
| `agri_harvest_logs.harvest_date` | `number` (`:1478`) | `@date` | `TIMESTAMPTZ` |
| `agri_labor_logs.work_date` | `number` (`:1527`) | `@date` (`AgriLaborLog.ts:9`) | `TIMESTAMPTZ` (`:145`) |
| `agri_weekly_settlements.week_start_date` | `number` (`:1546`) | `@date` | `TIMESTAMPTZ` (`:164`) |

Push sends epoch millis into a `timestamptz` → `22P02` invalid input syntax → classified permanent
(§H17 amplifier); pulls store ISO strings in `number` columns, corrupting local sorts and
`Q.gte`/`Q.lte` date filters. Today this is latent only because §C7 keeps those tables out of
`SYNC_TABLES` — the landmine is wired to the very flag that would turn the modules on.

**Fix.** Derive the date set from the WatermelonDB schema / `@date` decorators at startup, and add a
contract test asserting every `@date` field is in the conversion set.

---

## 4. MEDIUM

**M1 — Audit trail attribution is fabricated at the call site.** 19 hardcoded `'branch-bagacay'`
literals across 12 screen files (`shift-close.tsx:24`, `pos.tsx`, `returns.tsx`, `cash-drop.tsx`,
`shift-open.tsx`, `payroll/index.tsx`, `users/new.tsx`, `users/[id].tsx`, `(branch-manager)/*`, …)
and 22 actor fallbacks of the shape `user?.id || …` with literals
`''` (8), `'system'` (6), `'cashier-1'` (5), `'cashier'` (1), `'admin'` (1), plus
`postedBy: 'Operator'` (`agribusiness/labor.tsx:205`). `ActionLogService` and the double-entry
triggers faithfully record who did what — but the caller already lied to them.

**M2 — Screens write to WatermelonDB directly, bypassing the service layer.** ~20 non-service
files contain inline `database.write(… .create(…))`; only 7 use `prepareCreate`. Writes are
correctly inside `write()`, but service validation, audit hooks, and auto-posting are skipped
(e.g. `app/(admin)/agribusiness/parcels.tsx` creates `agri_land_owners` inline).

**M3 — Long lists are rendered eagerly and animated by index.** 143 screens map DB-fetched
arrays inside a `ScrollView`; 28 files use `FlatList`, 0 use `FlashList`. Combined with ~20
staggered entrances such as `app/(collector)/index.tsx:444`
`entering={FadeInRight.delay(i * 100)}` and `collection-sheet.tsx:420` `.delay(idx * 50)`, a
200-row collection sheet takes ~20 s / ~10 s of animation to settle on a field handset.

**M4 — Detail screens have no ownership check.** `app/(collector)/borrowers/[id].tsx:20-56`
loads `borrowers.find(id)` straight from the URL parameter with **zero** references to
`collectorId` in the file, then exposes `borrower.decryptedPhone`. For the legacy tables RLS
already prevented the row from being pulled, so this is defense-in-depth — but for the C2
blanket-policy tables the row *is* on the device, so the missing check becomes the only barrier.
Same shape in `app/(loan-encoder)/loans/[id].tsx:32`. Only one screen in the app reads
`user?.role` at all; authorization lives in route layouts.

**M5 — `key={index}` in report rendering.** 11 sites (`cic/validation-report.tsx:120,287`,
`cic/settings.tsx:95`, `reports/daily-collection.tsx:526`, `reports/weekly-collection.tsx:484`,
`executive/index.tsx:248,267`, `reports/bank-export.tsx:200`, `commissary/dispatch/new.tsx:228`,
`settings/migration.tsx:262`, `cic/missing-fields.tsx:136`) — rows reorder without state moving.

**M6 — Weak and vacuous assertions.** Of 1,653 parsed `it()` / `test()` blocks: 1,486 (90 %) assert
concrete values, 141 (9 %) rely only on `toBeTruthy` / `toBeDefined` / a bare `toHaveBeenCalled`, and
26 contain no `expect()` at all (`src/services/__tests__/performance.test.ts:93,108,144,153` time
operations and never check a result; `SyncService.test.ts:248,254` "handles sync errors gracefully"
has no `expect`; `src/database/models/__tests__/SimpleModels.test.ts:77-86` is nine bare
declarations; `scripts/verify-production-db-integrity.test.js:5,13` likewise). Branch coverage on
the money core is low. Measured just now (`npx jest <their own test files> --coverage`):
`LandSettlementEngine` 25.0 % lines / 7.3 % branches, `AutoPostingService` 61.0 % lines /
44.9 % branches (26 tests pass in 24 s — the suites are thin, not broken). So roughly half the
guard clauses in accounting paths have never been executed by a test.

**M7 — Sync audit mislabels production.** `SyncService.getAuditEnvironment()` (`:419-423`)
detects production by matching the template literal `YOUR_SUPABASE_PROJECT.supabase.co`, so the
live deployment is always recorded as `'unknown'`.

**M8 — Negative tare inflates paid kilos.** `AgriHarvestService.calculateNetWeight` (`:38-41`)
returns `Math.max(0, gross - tare)` with no sign or finiteness check on either input;
`logWeighIn` (`:46-51`) only rejects a non-positive **result**. `tare = -500, gross = 1000`
yields 1,500 kg, which drives both the offtake revenue journal and the landowner's cumulative
kilo settlement (§C6).

**M9 — Payouts and dividends without balanced money.** `MarketplacePayoutService.ts:80`
fabricates `po.glJournalId = 'GL-PO-…'` while no journal is created and the seller wallet is
credited (`:101-107`). `DividendService.ts:150` rounds per-member payout with no residual
allocation: a ₱1,000 pool split three ways distributes ₱999.99 and one centavo is unaccounted.

**M10 — A missing remote table silently stops syncing for that table forever within the session.**
Beyond §C7's flag, `OPTIONAL_REMOTE_TABLES` (all 55 config tables) are cached on the first
"missing table" error and then return `{created:[],updated:[],deleted:[]}` for the rest of the
session (`SyncService.ts:941-943, 980-986`), with only a `console.warn`. The sync badge still
completes. The design comment is explicit that this avoids "noisy 404s", which is reasonable for
core-schema drift but means an unapplied migration produces quiet, one-directional data loss.
Fix: surface the skipped table list in the sync status UI and in `SyncAuditLogService`.

**M11 — PII in console output.** 587 `console.*` calls in shipped `app/**` + `src/**`, including
`src/services/AuthService.ts:77` logging the sign-in email.

**M12 — Playwright's own blind spots.** 117 E2E tests across 25 specs: ~10 assert a real flow
end-to-end, ~11 pass on a title or a screenshot alone (`tests/rbac_security.spec.ts:48,64` accepts
`/Collector Portal|Login to Account|Sign In/`, so a login screen satisfies an RBAC assertion),
3 are debug scaffolds, and `tests/sync-verify.spec.ts:250,273,322` self-skips when login fails.
No spec runs against real Supabase auth or real push/pull, so a fully broken login or a broken
sync cycle would leave the suite green.

---

**M13 — Client clock writes against server-time reads.** `sanitizeRecord` stamps
`clean.updated_at = Date.now() + this.clockOffset` (`SyncService.ts:1833`) while the pull window is
bounded by server time (`:663-672`, `get_server_time` with a `console.log`-only fallback at `:670`).
A skewed device — or a failed time RPC — writes rows whose `updated_at` falls outside every peer's
`[watermark − 2000, watermark]` window, making them invisible to the rest of the estate until the
skew clears. Fix: stamp `updated_at` server-side (`RETURNING updated_at` via an RPC) or drop the
`lte` upper bound.

**M14 — One failing table rolls back the whole cycle, and the already-pushed rows replay.**
`SyncService.ts:1425-1427` throws after the per-table loop, so WatermelonDB marks **no** changes as
synced. Rows that did reach Postgres — including §C8's `is_posted=false` journal entries and the
synthetic `marketplace_sub_orders` push at `:1203-1222` — are re-pushed every cycle, so the ledger
flips posted → draft → posted repeatedly and the sub-order upsert repeats. Fix: accumulate and
return `rejectedIds` instead of throwing.

**M15 — Marketplace sub-orders are synthesised with a placeholder store and zero commission.**
`SyncService.ts:1207-1211`: `store_id: '00000000-0000-4000-8000-0000000000c1'`,
`commission_amount: 0`, `shipping_fee: 0`. The platform commission that
`MarketplaceOrderService.ts:97` does compute (default 3.5 %) is therefore never represented in the
remote sub-order ledger, and every seller-side report attributes all orders to one non-existent
store. The row exists only to satisfy a FK (`:1201-1202`) — which is also a sign the FK should be
relaxed rather than fed by fabricated data.

**M16 — `app_settings` upserts on a non-PK conflict target while the local row carries a generated UUID.**
`SyncService.ts:56-58` `{ app_settings: { onConflict: 'key' } }`, but `src/database/index.ts:100`
assigns a UUID v4 `id` locally and `sanitizeRecord` preserves it, so remote rows can accumulate a
second row per key. Fix: make the local `id` equal the setting key, or upsert on `id`.

---

## 5. What is genuinely solid

Recorded so the remediation plan does not accidentally regress it:

- **The sync engine is carefully engineered at the transport layer.** `fetchTableChanges`
  (`src/services/SyncService.ts:935-999`) rebuilds the query per page (with an explanatory comment
  about `.range()` stacking), orders by `updated_at` **and** `id` for determinism, uses a 1,000-row
  page size, wraps every page in `withSyncTimeout`, tolerates missing optional tables, and attaches
  structured error codes on failure. Push integrity reconciles rejected ids, batches sub-orders, and
  propagates soft deletes; `syncTableContract.json` makes the table contract explicit, and
  `SyncServicePushIntegrity.test.ts:57` actually enforces that `journal_entries` pushes before
  `journal_entry_lines`. The defects in §3 (H14-H19) are semantic — status flags, page-cursor
  stability, delete channel symmetry — not sloppiness in the plumbing.
- **Table-name and column-name coverage was audited before this review** (see
  `docs/BUG-AUDIT-AND-REMEDIATION-PLAN.md`); `remoteTableMap` resolves for all 88 tables and no
  phantom-column pushes were found here either — `sanitizeRecord` strips `_status`/`_changed`
  (`SyncService.ts:1567`) and no schema column reuses those names.
- **Core lending RLS is properly hardened.** Five successive migrations retire blanket policies
  in favour of `is_global_admin()`, `get_current_collector_id()`, and `auth.uid()` predicates;
  `user_profiles` self-escalation is blocked by both a narrow policy and
  `prevent_user_profile_self_escalation`, and self-INSERT is pinned to `role='borrower'`.
- **No secret is on the client where it shouldn't be.** `SUPABASE_SERVICE_ROLE_KEY` appears only
  inside `supabase/functions/register-borrower/index.ts:35`; the client uses the anon key.
  `.env*` is gitignored (`git ls-files` shows no tracked env files), test fixture keys
  (`mock-primary-key`, `POSCursor_Sec_2024_Ph`) are denylisted and rejected outside Jest.
- **No injection surface found.** No `eval`/`Function` on user data; all PostgREST filters go
  through the builder; the one dynamic SQL site (`deploy-hetzner.mjs:91`) pipes bytes over stdin to
  a fixed command; `.or()` uses are static.
- **UI conventions are actually enforced.** Zero arbitrary hex in `className`; only 2 TextInputs
  missing `placeholderTextColor`; zero hardcoded production hosts in shipped UI; currency goes
  through `formatPHP()`.
- **Test volume is real, not theatre.** 209 Jest suites / 1,653 tests, currently 100 % green, no
  self-mocking of the subject under test, and 0 files skipped or `only`'d in Jest.
- **The GPS mapping module** (`docs/MAPPING-MODULE.md`) is the reference for what "done with
  evidence" looks like here: tsc + eslint + 209 Jest suites + 7/7 and 12/12 Playwright specs with
  screenshots, plus a documented harness-trap section.

---

## 6. Root causes

1. **A missing platform abstraction for user feedback.** `Alert.alert` is a no-op on web, yet it
   is used 547 times, including 51 times as the carrier of the action itself. Three competing
   partial fixes exist (`errorAlerts.ts` in 14 files, inline `window.alert` in 24 files,
   `ConfirmDialog` in 15 files) and none is mandatory. One enforced shim closes all of it.
2. **Per-module RLS amnesia.** Every new module (payroll, accounting, marketplace, agribusiness,
   enterprise) ships with `FOR ALL … USING (true)` for speed, and nothing in CI rejects it. The
   hardening that happened for lending is not encoded as a rule, so it must be rediscovered.
3. **Test doubles stand in for the real system.** Mock auth and mock sync are selected by
   *hostname at runtime* rather than by build target, so the E2E suite exercises a shell while
   production runs a different code path. The same trick that makes local screenshots easy makes
   H8, H12 and §C4 undetectable.
4. **Money is `number`, rounding is per-callsite.** Float arithmetic plus three different
   rounding idioms (`Number(x.toFixed(2))` at `LandSettlementEngine.ts:63`,
   `Math.round(v*100)/100` at `LoanCalculatorService.ts:97`, Postgres half-up on `NUMERIC(15,2)`)
   means the client and the server can legitimately disagree on a centavo — and a ₱1 tolerance was
   added to paper over it (H1).
5. **Static gates were configured off rather than upward.** `strict: false`, `exhaustive-deps`
   off, `no-unused-vars` off, `import/no-unresolved` off, no `no-console`, no `no-explicit-any`.
   The measured migration cost is small (135 / 168 / 720 errors), so the blind spot is a choice,
   not a constraint.

6. **Sync semantics are expressed as flags and hand-maintained lists rather than invariants.**
   `_status` is assigned by hand in a migration that runs every cycle (§H14), `is_posted` is
   flattened on the way out to dodge a trigger (§C8), deletes travel through two asymmetric
   channels — local hard deletes produce nothing, remote deletes are applied unconditionally
   (§H15, §H16) — and the date-column conversion set is a hand-edited list that already drifted
   (§H19). None of these are transport bugs; they are the absence of a tested contract between
   "what the local row believes" and "what the server holds".

7. **A silent two-tier data plane.** Splitting 33 core / 55 config tables was a sensible
   migration-safety decision, but the consequence — whole modules that never leave the device
   unless an env var is set — has no indicator, no test, and no doc. §C7 and §H19 are the same
   root cause seen from two sides: the flag that protects the rollout also hides the failure and
   defers the type-mapping bug.

---

## 7. Suggested order of work

| # | Action | Why first | Est. effort |
|---|---|---|---|
| 1 | Rotate the admin password; make `isQuickLoginEnabled()` default to disabled and exclude `HARDCODED_USERS` in prod; remove real addresses from `E2E_TEST_USERS`; guard `fix_users.sql` | §C1 — potential live account takeover, one config line plus a rotation | 1 day |
| 2 | One migration that removes every `USING (true)` write policy on the 24 money/HR/inventory tables and on `journal_entries*` reads; add a CI policy assertion | §C2, §C3 | 2–3 days |
| 3 | Confirm whether `EXPO_PUBLIC_ENABLE_CONFIG_SYNC` is set in production, then either promote the applied modules' tables to `coreTables` or surface "device-local" per module | §C7 — decides whether the agribusiness/marketplace data anyone entered is recoverable at all | 2 hours to confirm, 1–2 days after |
| 4 | Stop flattening `is_posted` unconditionally on push; report re-post failures as rejected ids so they retry; add a two-cycle "posted stays posted" sync test | §C8 — posted books silently reverting to draft | 1–2 days |
| 5 | Cross-platform `Alert` shim + ESLint ban on direct `Alert.alert`; convert the 51 `onPress` sites first | §C4 — restores month-end close, remittances, deletes, approvals on the live web app | 2–4 days |
| 6 | Wire `shift-close.tsx` to `blindCloseShift` and live session data | §C5 — end-of-day cash reconciliation is currently fiction | 1 day |
| 7 | Settlement idempotency + `approveSettlement` status guard + draft exclusion, **with** LokiJS tests on `computeWeeklySettlement`/`approveSettlement` | §C6 | 1–2 days |
| 8 | Make the delete channel symmetric: `markAsDeleted()` in `BaseModelService`, `.update().in()` for pushed deletes, local-`_status` filter on applied remote deletes, and run the COA id migration once under a version marker | §H14–§H17 | 3–4 days |
| 9 | Keyset pagination (or observed-max watermark) in `fetchTableChanges`, and server-side `updated_at` stamping | §H18, §M13 — permanently missing rows is the hardest failure to diagnose in the field | 2–3 days |
| 10 | Generate `DATE_FIELDS` from the schema/`@date` decorators and add a contract test | §H19 — prerequisite for safely enabling #3 | 1 day |
| 11 | Money correctness pass: `PESO_TOLERANCE`, centavos rounding at input, exact-balance guard, ledger line aggregation, payment cash debit, commission unit, tare sign check | §H1–§H5, §M8, §M9 | 3–5 days |
| 12 | Implement statutory deduction computation from `statutory_rates` (the data is already seeded) | §H6 — compliance, not convenience | 2–3 days |
| 13 | Align role-name constants between `user_profiles` policies and `src/constants/roles.ts` | §H7 — unblocks encoder journaling | 1 day |
| 14 | Build-time E2E flag only; delete the hostname branch; allowlist-based Supabase safety guard; remove committed key literals; fix `deploy-hetzner.mjs` env restore | §H8, §H10, §H13 | 2 days |
| 15 | Throw instead of `??` in `EncryptionService` call sites; add blind-index search for encrypted fields | §H9 | 1–2 days |
| 16 | Gate upgrades: `noImplicitAny` → `strictNullChecks` → `no-console` (warn) → re-enable `exhaustive-deps` on `app/**` | root cause 5 — prevents recurrence of most of the above | incremental |
| 17 | Surface auto-post failures instead of `console.warn`; add effect cancellation guards; replace `as any` router pushes with typed routes; accumulate rejected ids instead of throwing per cycle | §H11, §H12, §M14 | 3–5 days |
| 18 | Audit attribution (`branch-bagacay`, `user?.id || …`, placeholder `store_id`, `postedBy: 'Operator'`), service-layer writes from screens, `FlatList`/`FlashList` for long lists, `app_settings` conflict target | §M1, §M2, §M3, §M15, §M16 | ongoing |

---

## 8. Verification log

**Run and confirmed during this review**

- `Alert` no-op proven from the installed dependency: `node_modules/react-native-web/dist/exports/Alert/index.js` → `class Alert { static alert() {} }`; `src/components/AppToast.web.tsx:8` logs only.
- Alert census produced by a balanced-parenthesis parse over 531 non-test `app/**` + `src/**` files: 547 sites in 142 files, 51 with `onPress` (30 of them consequential — the 30 files/lines are listed in the working notes and include `settings/closing.tsx:45`, `settings/index.tsx:97,122,200`, `loans/pending-approval.tsx:75,86`, `payroll/index.tsx:158,180`, `collector/remittances.tsx:83`, `sync-center.tsx:103`), 11 `return Alert.alert(…)` guards, and 90 files (374 sites) with no web fallback path at all.
- Test-scale figures are from the tools, not from counting: `npx jest --listTests` → 209 suites (204 under `app/`+`src/`, 5 under `scripts/`); `npx playwright test --list` → "Total: 117 tests in 25 files".
- RLS census over all 64 migrations: 193 policies, 100 `USING (true)`, 29 blanket `FOR ALL`, 24 distinct blanket-write tables; `grep -rn "DROP POLICY" | grep -i payroll|employee` → no match, so the 2026-05-24 payroll policies are live.
- `blindCloseShift` zero-caller claim checked by grep over `app/**` and `src/**` (only its definition at `ShiftCashService.ts:194`); `shift-open.tsx:26` and `cash-drop.tsx:26` do call their methods.
- `sssEe|philhealthEe|pagibigEe =` assignments: only the zero assignments at `PayrollService.ts:241-243`. `statutory_rates` consumers: only registration in `src/database/index.ts` / `index.web.ts` / `src/__tests__/test-utils.ts`.
- `app/(admin)/cic/` directory listing confirms only four route files; the two missing push targets read from `cic/index.tsx:360,388`.
- Role-string mismatch read directly from the policy text (`'loan-encoder'`, `'payment-encoder'`, `'expenses-encoder'`) against `src/constants/roles.ts:5-7`.
- Journal guard, `?? 0` NaN behaviour, `invalidLines` check, and the display-only totals read from `JournalEntryService.ts:126-140` and `app/(admin)/accounting/journal-entries.tsx:126-167`.
- `applyBranchPartitionFilter` short-circuit and `SELECT *` pull read from `SyncService.ts:359-394` and `:935-999`.
- `deploy-hetzner.mjs:117-164` env-swap/restore branches read in full.
- Gate configuration read from `tsconfig.json` (`strict: false`) and `eslint.config.js` (disables listed in §1).
- Effect-census heuristic: 183 `useEffect` blocks, 108 containing `await`, only ~3 with a
  mounted/abort/ignore guard (105 unguarded occurrences across 91 files; 1,200-char window per
  effect — a heuristic, the affected files are individually listed above).
- Table contract computed from `src/services/syncTableContract.json`: 33 core + 55 config = 88;
  `agri_*` 11, `marketplace_*` 10, `pos_sessions` 1, `sales_returns` 1, all in **config**;
  `SYNC_TABLES` derivation read at `SyncService.ts:22-24,49-51`.
- `is_posted = false` flattening (`SyncService.ts:1193-1197`), the swallowed re-post
  (`:1484-1497`), delete-as-upsert push (`:1285-1291`), the unconditional remote-delete list
  (`:1053`) against the remote-`deleted_at`-only delete channel (`:1008-1011`), the post-loop throw
  (`:1425-1427`), the placeholder `store_id` / `commission_amount: 0` synthesis (`:1203-1222`), and
  the offset paging + 2 s watermark floor (`:960-976`, `:658-660`) were each read in context.
- `DATE_FIELDS` (`SyncService.ts:217-276`) grepped for `agri_`/`pos_`/`sales_returns` → **0**
  matches; local column types confirmed in `src/database/schema.ts:1441,1442,1478,1527,1546`
  (`type: 'number'`), model decorators in `AgriCropCycle.ts:12` / `AgriLaborLog.ts:9` (`@date`), and
  remote types in `20260911030000_agribusiness_outgrower_platform.sql:59,145,164` (`TIMESTAMPTZ`).
- COA per-cycle migration call site (`SyncService.ts:549-554`) and both sides of the defect
  (`ChartOfAccountsService.ts:452` `_status` assignment, `:477` `destroyPermanently`) read in full;
  `journal_entry_lines.account_code` confirmed as `TEXT`, not an FK.
- `BaseModelService.ts:76-82` confirmed to use `destroyPermanently()` as the shared delete path.
- `user_profiles` self-escalation guard chain re-checked and **cleared** (narrow self-update policy +
  `prevent_user_profile_self_escalation` + borrower-pinned self-insert), as was the absence of
  `service_role` on the client, the `.env*` gitignore, and the absence of `eval`/dynamic SQL on user
  input.

**Could not be verified here — flagged in place above**

- The live admin password (§C1) and the live policy state on `supabase.818.quest`: this review did not authenticate against production or query it. Both are marked **[needs confirmation]** with the exact owner-side check.
- `.env.hetzner` values (`EXPO_PUBLIC_ENABLE_QUICK_LOGIN`, `EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_ENABLE_CONFIG_SYNC`) — production env files are not read by policy, and secret values are never printed regardless.
- Native (Android/iOS) behaviour of the `ParcelMap` WebView path and of every `Alert.alert` confirmation: no device build was run. §C4 concerns the web bundle only; on native these flows are expected to work.
- The exact count of inline screen-level writes (§M2) is a heuristic match (`database.write` +
  `.create(` in non-service files); the service-layer bypass itself is confirmed per file.
- **`EXPO_PUBLIC_ENABLE_CONFIG_SYNC` in production** (§C7, §H19). Confirmed `false` in `.env.local`
  (a non-secret feature flag, read by name and value); nothing was read from `.env.hetzner`.
  Until production is checked, §C7 is "critical if the flag is unset" and §H19 is "high, latent,
  armed by the same flag". The owner check is one SQL count, quoted in §C7.
- **Runtime behaviour of the remote-delete path (§H16)** and of page-shift skipping (§H18). Both are
  derived from the code and from WatermelonDB's documented `applyRemote` semantics; neither was
  reproduced against a live Supabase with two devices, because this review stopped the local
  Supabase stack and did not touch production. They are the two findings I would reproduce first.
- Whether `is_posted=false` demotion (§C8) is currently observable in production depends on the §H7
  role mismatch and on encoder write patterns; the code path itself is unconditional and verified.
