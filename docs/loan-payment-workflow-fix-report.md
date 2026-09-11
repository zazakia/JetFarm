# Loan and Payment Workflow Fix Report

Date: 2026-04-21
Mode: Ralph

## Summary

Implemented a focused fix for the loan/payment workflow issues found in `docs/loan-payment-computation-audit.md` without changing database schema.

The fix centralizes payment posting, makes schedule allocation cumulative, wires both payment entry screens through the same service, closes renewed old loans even with zero balance, and tightens KPI/audit calculations.

## Issues Addressed

1. **Payment encoder did not update schedules or loan status**
   - Added `PaymentService.postPayment()` and wired `app/(payment-encoder)/index.tsx` to use it.

2. **Admin and payment-encoder payment flows were inconsistent**
   - Replaced duplicate admin payment allocation logic with the same `PaymentService.postPayment()` path.

3. **Partial payment allocation was not cumulative**
   - `PaymentService` recomputes schedule statuses from cumulative total paid across the loan.
   - Two partial payments that add up to one installment now mark that installment as `paid`.

4. **Payments were not connected to schedules**
   - New payments now set `scheduleId` to the first open schedule receiving allocation.

5. **Admin payment flow could over-create borrower savings deposits**
   - Savings auto-credit now uses a per-schedule deposit share instead of crediting the full loan deposit on every paid schedule.

6. **Renewal could leave the old loan active when deducted amount was zero/null**
   - `LoanService` now closes the referenced previous loan whenever an active renewal references it.
   - Closing payment is created only when there is a positive deducted amount.

7. **Cash attribution differed by payment entry screen**
   - Payment posting now prefers the loan's assigned collector for `collectorId`, falling back to the encoding user only when the loan has no collector.

8. **PAR calculation subtracted total payments from principal**
   - PAR now prorates principal at risk by payment progress against total receivable instead of directly subtracting total payments from principal.

9. **Interest income included non-interest fee/deposit/insurance portions**
   - Interest income now uses explicit `interestAmount` where available, otherwise derives interest after excluding principal, deposit, and insurance.

10. **Audit term-vs-schedule check could false-positive**
    - Audit now compares schedule count to `LoanCalculatorService.paymentsForFrequency()` rather than raw `loan.term`.

## Changed Files

- `src/services/PaymentService.ts`
  - New shared payment posting and cumulative schedule/loan recomputation service.

- `app/(admin)/payments/new.tsx`
  - Replaced inline payment/schedule/savings allocation logic with `PaymentService.postPayment()`.

- `app/(payment-encoder)/index.tsx`
  - Replaced direct payment creation with `PaymentService.postPayment()`.

- `src/services/LoanService.ts`
  - Renewal closure now runs for any active renewal with `previousLoanId`, even when deducted amount is zero.
  - Closing payment collector attribution now uses old loan collector when available.

- `src/services/KpiCalculator.ts`
  - Updated PAR and interest income calculations.

- `src/services/AuditService.ts`
  - Updated schedule-count validation to use computed expected payment count.

- `src/services/__tests__/PaymentService.test.ts`
  - Added coverage for cumulative partial payments, schedule linking, savings deposit share, collector attribution, and paid loan status.

- `src/services/__tests__/LoanService.test.ts`
  - Added zero-deduction renewal closure coverage.

- `src/services/__tests__/KpiCalculator.test.ts`
  - Updated interest income expectations for fee/deposit/insurance exclusion.

- `src/services/__tests__/AuditService.test.ts`
  - Added coverage preventing weekly/month-based false-positive term mismatch.

## Verification Evidence

Targeted regression suite after cleanup:

```powershell
npm.cmd test -- --runInBand src/services/__tests__/LoanCalculatorService.test.ts src/services/__tests__/PaymentService.test.ts src/services/__tests__/LoanService.test.ts src/services/__tests__/KpiCalculator.test.ts src/services/__tests__/AuditService.test.ts --forceExit
```

Result:

```text
Test Suites: 5 passed, 5 total
Tests:       47 passed, 47 total
```

Touched-services typecheck:

```powershell
npx tsc --noEmit --pretty false --skipLibCheck --experimentalDecorators --emitDecoratorMetadata --jsx react-native --module esnext --moduleResolution bundler --target esnext src/services/PaymentService.ts src/services/LoanService.ts src/services/KpiCalculator.ts src/services/AuditService.ts
```

Result: passed.

Full project typecheck:

```powershell
npx tsc --noEmit
```

Result: failed before reaching these changes due existing syntax errors in `src/database/types.ts` beginning at line 164. This file was not part of the loan/payment workflow fix.

Architect verification:

```text
APPROVED
No concrete blockers found in the reviewed loan/payment workflow changes.
```

## Remaining Risks / Deferred Items

1. **Historical local DB inconsistencies remain**
   - The code fix prevents the same workflow defects going forward, but it does not rewrite existing historical payments, schedules, loan statuses, or duplicate-active-loan records.

2. **No DB schema changes were made**
   - This was intentional. The fix uses existing `payments.schedule_id` and existing schedule/payment/loan fields.

3. **Existing `src/database/types.ts` blocks full project typecheck**
   - Full `npx tsc --noEmit` still fails on pre-existing invalid characters/syntax in that file.

4. **Historical reconciliation should be handled as a separate migration/data-repair task**
   - Recommended next step: create a dry-run reconciliation script that reports proposed updates before applying any DB data changes.

## Ralph Status

Implementation complete, tests passed, touched-service typecheck passed, architect verification approved.
