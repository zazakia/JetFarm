# Production Migration Verification

Generated: 2026-06-19T08:32:21.951Z
Target: https://YOUR_SUPABASE_PROJECT.supabase.co
Key type: service_role

## Counts

| app_collectors | app_borrowers | app_loans | app_payments | app_payment_schedules | app_savings_transactions | collection_groups |
| --- | --- | --- | --- | --- | --- | --- |
| 8 | 329 | 333 | 33 | 914 | 12 | 0 |


## Issue Summary

| issue | count |
| --- | --- |
| duplicateMemberIds | 0 |
| duplicateBorrowerNames | 0 |
| duplicateLoanNumbers | 50 |
| duplicatePayments | 0 |
| orphanLoans | 0 |
| orphanPayments | 2 |
| orphanSchedules | 0 |
| overpaidLoans | 0 |
| borrowersWithMultipleActiveLoans | 0 |


## Notes

- This is a read-only verification. No data was changed.
- Duplicate samples are capped in the JSON report.
