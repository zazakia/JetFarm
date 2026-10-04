# GPS Mapping Module — `agribusiness/mapping`

**Scope:** parcel boundary capture, storage, visualization, and acreage calculation for the
Outgrower (Agribusiness) platform.
**Last verified:** 2026-09-28 (commit range after `35bef44`).

---

## 1. Component inventory

| Layer | File | Responsibility |
|-------|------|----------------|
| Screen | `app/(admin)/agribusiness/mapping.tsx` | Parcel selection, vertex editing (manual / map / walk), area readout, save orchestration, dialog state |
| Map (web) | `src/components/ParcelMap/ParcelMap.web.tsx` | react-leaflet v5 map: polygon, draggable vertex pins, live GPS dot, fit-bounds, click-to-add |
| Map (native) | `src/components/ParcelMap/ParcelMap.tsx` | `react-native-webview` hosting the same Leaflet UI; gestures forwarded over `postMessage` |
| Map shell | `src/components/ParcelMap/index.ts`, `types.ts`, `webview-html.ts` | Platform barrel, shared props contract, WebView HTML/CDN template |
| Coordinates | `src/utils/coordinates.ts` | Canonical parse/serialize, range validation, haversine distance |
| Walk capture | `src/services/BoundaryWalkService.ts` | Accuracy gate, distance-based vertex thinning |
| Location I/O | `src/services/LocationService.ts` | `LocationProvider` abstraction — `expo-location` on native, Geolocation API on web |
| Persistence | `src/services/AgriParcelService.ts` | `updateParcel` writes serialized boundary + recomputed `areaHectares`; `calculatePolygonAreaHectares` (shoelace) |
| Feedback | `src/components/ConfirmDialog.tsx` | `mode: 'confirm' \| 'alert'` — replaces `Alert.alert` (a no-op on react-native-web) |
| Sync | `src/services/syncTableContract.json` | `agri_parcels` is in the WatermelonDB ↔ Supabase contract |

## 2. Data contract

`agri_parcels.gps_coordinates` is a **text** column. Canonical value:

```json
[{"latitude":8.3512,"longitude":124.8621},{"latitude":8.3547,"longitude":124.8626}, ...]
```

Rules enforced by `src/utils/coordinates.ts`:

- `parseGpsCoordinates` never throws. `null`, `''`, malformed JSON, and out-of-range
  numbers all degrade to `[]` (or drop the offending point), so a bad legacy row can
  never crash the screen or block editing.
- Legacy single-point rows stored as `"8.3667, 124.8667"` (the old `seed-agri-one-mock-data.sql`
  format) parse to a one-vertex array — visible on the map, never silently destroyed.
- `serializeGpsCoordinates` returns `null` for an empty array, so clearing a boundary
  writes SQL `NULL` rather than the string `"[]"`.
- Validation bounds: latitude −90…90, longitude −180…180, `Number.isFinite` on both.

## 3. Area calculation

`AgriParcelService.calculatePolygonAreaHectares` projects vertices to a local planar
grid (Earth radius 6 378 137 m, longitude scaled by `cos(avg latitude)`) and applies the
shoelace formula. Returns hectares rounded to 4 decimals; `< 3` vertices → `0`.

Accuracy note: this is an equirectangular approximation, good to well under 1% for the
parcel sizes in this domain (sub-50 ha near the equator). It is **not** survey-grade;
see §7 for the geodesic upgrade path.

## 4. Boundary walk

`handleStartWalk` requests permission, then subscribes to `locationProvider.watchPosition`.
Each fix flows through two gates (`DEFAULT_WALK_SETTINGS`):

1. **Accuracy gate** — fixes with `accuracyMeters > 10` are discarded (a `null` accuracy is
   accepted; some platforms omit it).
2. **Distance gate** — a new vertex is appended only after moving ≥ 5 m from the previous
   vertex. `appendVertexIfMoved` returns the *same array reference* when it rejects, keeping
   React state referentially stable so jitter does not re-render the map.

The accepted fix is rendered as a live blue `CircleMarker`; the header shows
`Accuracy ±N m` while recording. Stopping (or unmounting) calls `watch.remove()`.

## 5. Interaction model

Both map implementations expose the same contract — the parent owns the coordinate array:

- Tap empty map → append vertex
- Drag a pin → move that vertex
- Tap a pin → remove that vertex
- Manual lat/lon entry → inline validation error (`vertex-input-error`), never a dialog

Editable gestures are disabled when `editable={false}` (read-only parcel view).

## 6. Feedback / dialog contract

react-native-web ships `Alert.alert` as an empty class and `AppToast.web` only
`console.log`s, so **any `Alert.alert` is invisible in the web build**. Every message on
this screen routes through `ConfirmDialog`, which supports:

| Mode | Buttons | Used for |
|------|---------|----------|
| `confirm` | Cancel + Confirm | Discard unsaved edits, clear boundary, clear-to-NULL save |
| `alert` | single **OK** (dismiss only) | Permission denied, `Boundary Incomplete`, `Boundary Saved`, `Save Failed` |

Test hooks: `confirm-dialog`, `confirm-dialog-title`, `confirm-dialog-message`,
`confirm-dialog-cancel`, `confirm-dialog-confirm`. The `mode` prop and both legacy label
props (`confirmLabel`/`cancelLabel` and `confirmText`/`cancelText`) are supported, so
existing call sites are unaffected.

> **Known remaining exposure:** 48 `Alert.alert` call sites across the 9 other agribusiness
> screens (`accounting` 3, `cycles` 6, `expenses` 6, `harvest` 5, `index` 2, `investors` 6,
> `labor` 8, `parcels` 4, `settlements` 8) are silent in the web build — including the
> parcel-registration validation errors, where the user gets no feedback at all. Migrating
> them to `ConfirmDialog` (or a real web toast in `AppToast.web.tsx`) is a follow-up, not
> part of this module. `parcels.tsx` additionally gained `testID`s on its register button,
> modal inputs, save button, parcel cards, and per-card GPS Mapping link so the E2E suite
> drives it structurally instead of by visible text.

## 7. Dev-only affordances

`Simulate Field Walk` (`testID="simulate-walk"`) generates a quadrilateral in the Bukidnon
cassava belt (8.35 N, 124.86 E). It is wrapped in `{__DEV__ && ...}` and therefore absent
from production exports and from the Playwright bundle (`NODE_ENV=test`).

## 8. Verification

| Gate | Command | Status |
|------|---------|--------|
| Types | `npx tsc --noEmit` | green |
| Lint | `npx eslint <changed files>` | green |
| Unit — screen | `npx jest --testPathPattern="agribusiness.__tests__.mapping"` | 9 tests |
| Unit — coords | `npx jest src/utils/__tests__/coordinates.test.ts` | green |
| Unit — walk | `npx jest src/services/__tests__/BoundaryWalkService.test.ts` | green |
| Unit — service | `npx jest src/services/__tests__/AgriParcelService.test.ts` | green |
| Unit — dialog | `npx jest src/components/__tests__/ConfirmDialog.test.tsx` | 5 tests |
| E2E | `npx playwright test tests/mapping.spec.ts` | 7 tests green (see §8.1) |
| E2E (regression) | `npx playwright test tests/admin.spec.ts tests/mapping.spec.ts` | 12/12 green — the tour fix also unblocked 2 previously failing `admin.spec.ts` navigation tests |
| Full Jest | `npx jest --no-coverage` | 209 suites / 1680 tests green |

Evidence: `docs/images/mapping-polygon.png` (real OSM basemap with the captured
triangle rendered as an interactive SVG polygon) and
`docs/images/mapping-boundary-saved.png` (full screen after save).

### 8.1 E2E notes

`tests/mapping.spec.ts` is **self-contained**: local web E2E mode signs in through
`AuthService.quickSignIn` with a local session, so remote rows are not synced into the
browser. Each test registers its own parcels through the parcels screen before mapping.

Three traps worth remembering when extending this spec:

- **The first-run onboarding tour blocks every click.** `OnboardingTourModal` renders a
  full-screen `bg-black/70` spotlight Modal, so Playwright reports
  "`…intercepts pointer events`" on any control until it is closed.
  `dismissOnboardingTour()` in `tests/playwright-auth.ts` clicks `onboarding-close-button`
  (which persists `ONBOARDING_STORAGE_KEY`), and `loginAsAdmin()` calls it, so every spec
  that signs in as admin starts from a clickable screen.
- Leaflet streams OSM tiles forever, so `page.waitForLoadState('networkidle')` never
  settles. Pass an explicit target text to `safeNavigate`.
- An `L.Polygon` is interactive, so a map click **inside** the boundary is swallowed by the
  polygon and never reaches the map's click handler. The click-to-add test therefore starts
  from an empty parcel.

Asserting on `.leaflet-overlay-pane path.leaflet-interactive` proves the polygon really
rendered, which a screenshot alone does not.

Jest CLI paths are regexes, so a route-group path like `app/(admin)/agribusiness/__tests__/
mapping.test.tsx` matches **nothing** (`(admin)` becomes a capture group). Use
`--testPathPattern="agribusiness.__tests__.mapping"` instead.

### 8.2 Iterating without re-exporting

`scripts/start-playwright-web.mjs` re-exports the bundle on every start. While iterating on
spec code only, export once (`node scripts/start-playwright-web.mjs` in the background) and
then run with `SKIP_EXPORT=1`. Note that a server left listening on port 19119 is **reused**
by design, so a stale orphan server silently serves a stale bundle — if a `data-testid` you
just added is "not found", check the port owner before debugging selectors:

```powershell
Get-NetTCPConnection -LocalPort 19119 -State Listen | Select-Object OwningProcess
```

### 8.3 Local E2E database

`supabase/queries/seed-e2e-admin-user.sql` is an idempotent seed for the local Supabase
stack (`admin@jetfarm.com` / `12345678`) across `auth.users`, `auth.identities` and
`public.user_profiles`. It exists because `auth.users.email` has **no unique constraint**
(so `ON CONFLICT` fails) and because GoTrue requires the token columns to be `''`, never
`NULL`. Apply by piping, not by path — `docker exec -i supabase_db_jetfarm-local psql < file`,
since `docker exec` mangles Windows paths.

## 9. Roadmap to a production-grade mapping app

Ordered by value per effort. Items 1–4 are what a field operator will feel first.

1. **Read-only boundary overview on the dashboard.** A single map layer showing every
   parcel colored by status/cycle is the highest-value screen in this module and reuses
   `ParcelMap` with `editable={false}`.
2. **Geodesic area + perimeter.** Swap the equirectangular shoelace for a proper geodesic
   polygon (Karney/Vincenty-based) and surface perimeter metres, which is what farmers
   actually verify against a title.
3. **Import/export.** GeoJSON and KML/KMZ round-trip (a `toGeoJSON`/`fromGeoJSON` pair on
   `GPSCoordinate[]`) plus shapefile ingestion for surveyor-delivered boundaries.
4. **Offline tile packs.** Field sites in Bukidnon frequently have no signal; the WebView
   currently shows a "check your connection" fallback. Pre-cache raster/vector tiles for
   the farm's bounding box and add an offline indicator.
5. **Satellite/hybrid basemap.** Esri World Imagery or Mapbox satellite is how growers
   sanity-check a boundary against what's on the ground. Needs a tile-provider abstraction
   and API-key handling through the env convention (never hardcoded).
6. **Background/continuous tracking.** Foreground watch stops when the app is backgrounded.
   A task-tracked walk service (Android foreground service / iOS significant-change +
   location-updates background mode) with a resumable capture buffer.
7. **Live kinematics on the map.** Arrow/compass heading during a walk, cumulative distance
   walked, and a "closed the loop" indicator when the position returns near vertex #1.
8. **Turn-by-turn / guided re-walk.** Navigate the operator back to each stored vertex —
   required to re-survey a boundary years later.
9. **Quality telemetry.** Record per-vertex accuracy, PDOP, fix age and timestamp; flag
   parcels whose average accuracy exceeds a threshold; render the accuracy ring per vertex.
10. **Editing model upgrades.** Snap-to-vertex, insert-into-segment, orthogonalize (right
    angles for rectangular plots), split/merge parcels, and a `history` stack with
    undo/redo. Also deconflict "tap pin = delete" against accidental taps (long-press or an
    explicit delete affordance).
11. **Multi-polygon and donut support.** `gps_coordinates` should become a list of rings so
    a parcel with an excluded pond or a two-part plot is representable.
12. **Land-area reconciliation.** Compare mapped area against the parcel's declared
    `areaHectares` / title area and show the variance, since settlements are per-kilo with a
    guaranteed minimum tied to land area.
13. **Crontab-free audit trail.** Who captured/edited a boundary and when, with the previous
    geometry retained for dispute resolution.
14. **Admin key + attribution policy.** OSM tile usage at production volume needs a proper
    usage plan; a self-hosted tile server or a licensed provider removes both the reliability
    and the licensing question.
15. **Real web feedback layer.** Implement a genuine toast in `AppToast.web.tsx` and retire
    `Alert.alert` app-wide, so success/error messaging exists on web at all.
16. **E2E harness hardening (partly done).** `loginAsAdmin()` now dismisses the onboarding
    tour, which unblocked the click-driven `tests/admin.spec.ts` navigation tests. Still
    open: `tests/agribusiness-visual.spec.ts` calls `safeNavigate()` without a target, so it
    waits on `networkidle` with a 120 s default timeout and fails whenever the Supabase
    backend it polls is not running. Give each navigation a target text (as this spec does)
    and lower that per-test default.
17. **Coordinate precision contract.** The map accepts full double precision while the
    manual inputs are parsed with `parseFloat`; pin the storage precision (6 decimals
    ≈ 11 cm) and reject anything finer, so imported survey data cannot silently change a
    parcel's computed area.
