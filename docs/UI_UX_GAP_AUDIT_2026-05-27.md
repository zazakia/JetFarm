# UI/UX Gap Audit — 2026-05-27

Scope: static review of the Expo Router screens, existing Playwright coverage, recent full-test output, and POSCursor UI conventions.

## Highest-priority gaps

1. **Payment Encoder route is not UX-verified end-to-end**
   - The current Playwright suite skips `Payment Encoder form has DatePicker` because direct navigation to `/(payment-encoder)` is unstable and can return to login.
   - UX risk: payment encoders may not have a confidently verified payment-entry path/date picker flow.
   - Recommended fix: add a stable Payment Encoder dashboard route assertion, then re-enable the DatePicker test.

2. **Sync Center E2E test has weak assertions**
   - The sync verification test can pass while its log says no Sync Now button was found on the landing page.
   - UX risk: sync discoverability and status feedback can regress without failing CI.
   - Recommended fix: require authenticated navigation to Sync Center, visible `Sync Now`, visible last-sync state, and clear offline/error copy.

3. **RBAC redirects can briefly resolve to login/landing instead of the intended role workspace**
   - Recent RBAC logs show role can be `null` during direct route navigation before guard resolution.
   - UX risk: users may see confusing redirects/flicker when opening bookmarked role routes.
   - Recommended fix: add an explicit “Verifying access…” guard state before denying access, then redirect to the role home route after role resolution.

4. **Accessibility coverage is inconsistent**
   - Many icon-only or Pressable actions rely on text/test IDs but do not consistently expose `accessibilityRole`, `accessibilityLabel`, and disabled/loading state labels.
   - UX risk: screen-reader and keyboard users may struggle with primary workflows.
   - Recommended fix: audit reusable buttons/cards first (`SidebarContent`, dashboard actions, payment/loan forms), then add a small accessibility assertion set.

5. **Empty/loading/error states are not standardized**
   - Screens use local `ActivityIndicator` and ad-hoc empty copy.
   - UX risk: inconsistent perceived quality and unclear recovery when local DB/sync fails.
   - Recommended fix: introduce/reuse shared `LoadingState`, `EmptyState`, and `ErrorState` components with retry actions.

## Medium-priority gaps

6. **Mobile form ergonomics need a pass**
   - Large encoder forms should confirm keyboard types, return-key behavior, helper text, error placement, and sticky save/submit access on small screens.

7. **Role-specific dashboards need clearer primary next action**
   - Admin/collector dashboards are feature-rich, but first-time users need stronger “what to do next” affordances.

8. **Offline/sync confidence needs stronger visual hierarchy**
   - Offline-first is core to the product. Sync status should be visible, consistent, and actionable on every role dashboard.

9. **Destructive actions need consistent confirmation language**
   - Deletions, resets, and financial state changes should share a uniform confirmation pattern and consequence copy.

10. **Test coverage is strong functionally but light visually**
    - Add screenshot/visual smoke snapshots for login, admin dashboard, collector dashboard, loan entry, payment entry, and sync center.

## Suggested implementation order

1. Stabilize Payment Encoder route UX and re-enable its skipped DatePicker E2E.
2. Strengthen Sync Center assertions so false-positive passes are impossible.
3. Add role-resolution loading state to prevent RBAC flicker/confusing login redirects.
4. Add accessibility labels/roles to reusable navigation and primary action components.
5. Standardize loading/empty/error components across high-traffic screens.
6. Add visual smoke screenshots for the top role workflows.
