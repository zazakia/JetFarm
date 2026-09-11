# Production Migration Verification

Generated: 2026-06-19T08:33:41.655Z
Target: https://YOUR_SUPABASE_PROJECT.supabase.co
Key type: service_role

## Counts

| app_collectors | app_borrowers | app_loans | app_payments | app_payment_schedules | app_savings_transactions | collection_groups |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | 298 | 371 | 490 | 7420 | 0 | 0 |


## Issue Summary

| issue | count |
| --- | --- |
| duplicateMemberIds | 0 |
| duplicateBorrowerNames | 9 |
| duplicateLoanNumbers | 1 |
| duplicatePayments | 0 |
| orphanLoans | 0 |
| orphanPayments | 0 |
| orphanSchedules | 0 |
| overpaidLoans | 0 |
| borrowersWithMultipleActiveLoans | 12 |


## Notes

- This is a read-only verification. No data was changed.
- Duplicate samples are capped in the JSON report.
