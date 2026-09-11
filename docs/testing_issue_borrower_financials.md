# [QA/Testing] Borrower Financial Services (Savings, CBU & Share Capital) Verification

## Related Issue
Parent Issue: #56

## Scope
- `CooperativeSavingsService`
- `ShareCapitalService`
- `DividendService`

## Routes & Screens
- [Borrower Profile](file:///e:/GitHub/POS Cursor/app/(admin)/borrowers/[id].tsx)
- [Savings Transactions Log](file:///e:/GitHub/POS Cursor/app/(admin)/borrowers/[id]/savings-transactions.tsx)
- [Share Capital Detail](file:///e:/GitHub/POS Cursor/app/(admin)/borrowers/[id]/share-capital.tsx)
- [Borrower Savings & CBU View](file:///e:/GitHub/POS Cursor/app/(borrower)/savings-cbu.tsx)
- [CBU Report](file:///e:/GitHub/POS Cursor/app/(admin)/reports/cbu.tsx)
- [Share Capital Report](file:///e:/GitHub/POS Cursor/app/(admin)/reports/share-capital.tsx)

## Test Cases & Checklist
- [ ] **Savings Deposit & Withdrawal**:
  - Record new savings deposit/withdrawal transactions for a borrower.
  - Check transaction history list and running balance accuracy on `savings-transactions.tsx`.
- [ ] **Share Capital & CBU**:
  - Verify share capital additions and updates reflected accurately in `share-capital.tsx`.
  - Confirm proper calculation in `DividendService` and Surplus Allocation reports (`app/(admin)/reports/surplus-allocation.tsx`).
- [ ] **CBU & Share Capital Reports**:
  - Test report generation for CBU and Share Capital summaries.
  - Validate total balances match individual borrower accounts.

## Verification Command
```bash
npx jest src/services/__tests__/CooperativeSavingsService.test.ts src/services/__tests__/ShareCapitalService.test.ts
```
