# Changelog

All notable changes to this project will be documented in this file.

## [2.6.0] - 2026-09-11

### Added
- Enterprise Multi-Branch MIS: Hierarchy for 39 Branches + HQ with dynamic branch switcher (`app/select-branch.tsx`), role-based branch security, and persistent context storage.
- Reverse Logistics & Sales Returns: Full return lifecycle with persistent `sales_returns` & `sales_return_lines`, supervisor approval gate, UOM pack-to-base unit restock conversion, and waste log quarantine.
- Cash & Shift Controls: `pos_sessions` tracking, blind shift close reconciliation (`blindCloseShift()`), and branch-scoped GL trial balance.
- In-App APK Auto-Updater: Background APK prefetching, one-click installer invocation with `FLAG_GRANT_READ_URI_PERMISSION`, version manifest sync, snooze tracking, and browser download fallback.
- Math Fuzzing & Concurrency Defense: 10,000-iteration financial precision test suite and double-tap mutex locking across financial service layers.

### Fixed
- Negative zero currency display bug in `formatPHP()` (`-PHP 0.00` normalized to `PHP 0.00`).
- Two-phase journal entry posting to strictly satisfy PostgreSQL double-entry triggers.
- Web export parity: Added default export to `DatePicker.web.tsx` to prevent Minified React Error #130.

## [1.0.24] - 2026-08-17

### Added
- Weeks support to loan term unit configuration across loan forms, settings, and loan presets (#14, #17)
- Dynamic insurance and deposit calculation breakdown for weekly frequency terms (#16, #18)
- Unit test suite coverage for weeks term unit in `LoanCalculatorService` (#14)
- Automated linting and QA health gates with BryV3 integration

### Fixed
- Autocompute savings deposit calculations under different term units (#15)
- Support for vector icons in production web export by renaming assets/node_modules to vendor_modules during post-processing (#14)
- TypeScript compilation issue in Online Loan Calculator screen where 'weeks' was missing from TermUnit type definition (#14)
- NativeWind bare hex color violations and secret pattern sanitization
