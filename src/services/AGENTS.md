# services/

## OVERVIEW
Core business logic layer. 20 service classes implementing all domain operations. Heavily tested with 25 Jest test files.

## SERVICES
| Service | File | Role |
|---------|------|------|
| SyncService | `SyncService.ts` (~1840L) | WatermelonDB-to-Supabase sync engine (table contract lives in `syncTableContract.json`) |
| LoanService | `LoanService.ts` | Loan lifecycle (create, disburse, close) |
| PaymentService | `PaymentService.ts` | Payment recording and validation |
| LoanCalculatorService | `LoanCalculatorService.ts` | Loan amortization and interest computation |
| MfiKpiService | `MfiKpiService.ts` (722L) | MFI KPI calculations |
| KpiCalculator | `KpiCalculator.ts` | KPI computation helpers |
| CashService | `CashService.ts` | Cash transaction management |
| AuditService | `AuditService.ts` (546L) | Audit trail logging |
| AuthService | `AuthService.ts` | Supabase auth, quick login, role redirect |
| BaseModelService | `BaseModelService.ts` | Shared CRUD for all WatermelonDB models |
| MonthlyClosingService | `MonthlyClosingService.ts` | Month-end closing operations |
| BackupService | `BackupService.ts` | Local data backup |
| SupabaseBackupService | `SupabaseBackupService.ts` | Remote Supabase backup |
| BorrowerPortalService | `BorrowerPortalService.ts` | Borrower-specific operations |
| EncryptionService | `EncryptionService.ts` | Data encryption utilities |
| ErrorService | `ErrorService.ts` | Structured error handling |
| ReminderService | `ReminderService.ts` | Payment reminders |
| SeriesService | `SeriesService.ts` | Series/number generation |
| PdfGenerator | `PdfGenerator.ts` | PDF report generation |
| ActionLogService | `ActionLogService.ts` | Action logging |

## CONVENTIONS
- Classes with static methods (no constructor instantiation)
- Services access WatermelonDB `database` for local reads/writes
- Supabase client used for remote operations (sync, auth)
- ErrorService.throwError() for structured errors throughout
- SyncService maintains REMOTE_TABLE_MAP: local table name -> Supabase table name

## TESTING
- 25 test files in `__tests__/`
- Uses WatermelonDB mock database setup
- `NODE_ENV=test` for test configuration
