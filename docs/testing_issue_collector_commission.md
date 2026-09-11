# [QA/Testing] Collector Commission & Auto-Posting System Verification

## Related Issue
Parent Issue: #56

## Scope
- `CollectorCommissionService`
- `AutoPostingService`
- `PaymentService`
- `MemberFinancialSummaryService`

## Routes & Screens
- [User Profile & Collector Detail](file:///e:/GitHub/POS Cursor/app/(admin)/users/[id].tsx)
- [New User Creation](file:///e:/GitHub/POS Cursor/app/(admin)/users/new.tsx)
- [Borrowers Directory](file:///e:/GitHub/POS Cursor/app/(admin)/borrowers/index.tsx)
- [Borrower Savings & CBU Overview](file:///e:/GitHub/POS Cursor/app/(borrower)/savings-cbu.tsx)
- [Record Expense](file:///e:/GitHub/POS Cursor/app/(admin)/expenses/new.tsx)

## Test Cases & Checklist
- [ ] **Collector Commission Calculation**:
  - Test calculation logic for collector commissions when payments are recorded.
  - Verify that commissions properly reflect configured percentage rates in settings.
- [ ] **Auto-Posting & Journal Entries**:
  - Verify auto-posting generates balanced debit/credit accounting entries upon loan payment receipt.
  - Confirm journal entries reflect in `MemberFinancialSummaryService` without data discrepancies.
- [ ] **User & Collector Profile UI**:
  - Test creating and editing user profiles with collector roles.
  - Verify collector commission history and summaries on collector detail pages.

## Verification Command
```bash
npx jest src/services/__tests__/CollectorCommissionService.test.ts src/services/__tests__/AutoPostingService.test.ts
```
