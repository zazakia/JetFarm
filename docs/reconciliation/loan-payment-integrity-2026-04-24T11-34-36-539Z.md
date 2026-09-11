# Loan / Payment Integrity Audit

Generated: 2026-04-24T11:34:36.539Z

Mode: read-only SELECT audit. No data or schema changes were made.

## Summary

| issue | count |
| --- | --- |
| active_status_fully_paid | 0 |
| borrowers_with_multiple_active_loans | 3 |
| overpaid_loans | 2 |
| paid_status_with_balance | 272 |
| payments_without_schedule_id | 6509 |
| potential_savings_overcredits | 2 |
| renewals_old_loan_not_paid | 0 |
| schedule_status_mismatches | 403 |
| schedule_total_mismatches | 7 |


## Borrowers With Multiple Active Loans

| borrower_id | borrower_name | active_count | active_loans |
| --- | --- | --- | --- |
| 94d708bc-4cae-4a1b-950d-b5d56ca6b61d | Dennis Lunzaga | 4 | LN-20260328-8887, LN-20260417-130954-121024, LN-20260418-002350-341883, LN-20260420-201048-543779 |
| 80b57c8e-fb27-4ea4-a303-473f3412c3c6 | Lorina Cagabhion Malayan | 3 | LN-20260328-0362, LN-20260328-2478, 083b4173-8e8d-4b66-b77c-77c478a740d2 |
| 8d53e40e-9ff6-4931-8777-c741683292df | Genara A. Cantiga | 2 | LN-20260328-6059, LN-20260417-9567 |


## Schedule Status Mismatches

| id | loan_number | borrower_name | due_date | scheduled_amount | total_paid | status | expected_status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7a57c10e-9bc7-41c4-ba06-24b209671c4e | LN-20260328-8536 | Myla P. Soria | Thu Oct 30 2025 00:00:00 GMT+0800 (China Standard Time) | 155.00 | 4630.00 | pending | late |
| 958e83bd-d1d1-40b3-8013-a74a10eced68 | LN-20260328-8536 | Myla P. Soria | Fri Oct 31 2025 00:00:00 GMT+0800 (China Standard Time) | 155.00 | 4630.00 | pending | late |
| 8b8efbdc-ddb3-4a75-a66b-d1a1006c92ea | LN-20260328-8536 | Myla P. Soria | Sat Nov 01 2025 00:00:00 GMT+0800 (China Standard Time) | 155.00 | 4630.00 | pending | late |
| d1d32186-1354-4695-83d6-bd9e5a174973 | LN-20260328-8536 | Myla P. Soria | Mon Nov 03 2025 00:00:00 GMT+0800 (China Standard Time) | 155.00 | 4630.00 | pending | late |
| 80c6f5fb-3cfe-4551-93ea-f8bd39e95547 | LN-20260328-8536 | Myla P. Soria | Tue Nov 04 2025 00:00:00 GMT+0800 (China Standard Time) | 155.00 | 4630.00 | pending | late |
| 2dabc39b-cedd-46ac-82b2-94457b827812 | LN-20260328-8536 | Myla P. Soria | Wed Nov 05 2025 00:00:00 GMT+0800 (China Standard Time) | 155.00 | 4630.00 | pending | late |
| a8224a01-2951-48a2-a0e4-9a401b113ffd | LN-20260328-8536 | Myla P. Soria | Thu Nov 06 2025 00:00:00 GMT+0800 (China Standard Time) | 155.00 | 4630.00 | pending | late |
| ca57438b-9ec7-498b-a28f-fcb8a9f81917 | LN-20260328-8536 | Myla P. Soria | Fri Nov 07 2025 00:00:00 GMT+0800 (China Standard Time) | 155.00 | 4630.00 | pending | late |
| 98e6fd0f-da55-40c8-a053-996c0493e5ff | LN-20260328-8536 | Myla P. Soria | Sat Nov 08 2025 00:00:00 GMT+0800 (China Standard Time) | 155.00 | 4630.00 | pending | late |
| 357722d7-5aa7-4b3d-b218-c510976a9bb3 | LN-20260328-8536 | Myla P. Soria | Mon Nov 10 2025 00:00:00 GMT+0800 (China Standard Time) | 155.00 | 4630.00 | pending | late |
| e14f9335-fc04-486a-92b2-20cbce533314 | LN-20260328-0365 | Arcelene B. Castro | Mon Nov 24 2025 00:00:00 GMT+0800 (China Standard Time) | 310.00 | 7760.00 | pending | late |
| 0d99f8f0-6922-4671-bb7e-2ab4398496c1 | LN-20260328-0365 | Arcelene B. Castro | Tue Nov 25 2025 00:00:00 GMT+0800 (China Standard Time) | 310.00 | 7760.00 | pending | late |
| ae99a0ab-e12d-42ed-9c91-52f03ecd9264 | LN-20260328-0365 | Arcelene B. Castro | Wed Nov 26 2025 00:00:00 GMT+0800 (China Standard Time) | 310.00 | 7760.00 | pending | late |
| dbff56cd-aebe-4ba6-8745-7bdd726c985e | LN-20260328-0365 | Arcelene B. Castro | Thu Nov 27 2025 00:00:00 GMT+0800 (China Standard Time) | 310.00 | 7760.00 | pending | late |
| 9e9fa2e3-7e76-40d3-9303-38970be1a4f5 | LN-20260328-1998 | Jeboy M. Etang | Thu Nov 27 2025 23:59:17 GMT+0800 (China Standard Time) | 155.00 | 3575.00 | pending | late |
| 1294ce23-673e-48d4-beda-f609f7cb339c | LN-20260328-0365 | Arcelene B. Castro | Fri Nov 28 2025 00:00:00 GMT+0800 (China Standard Time) | 310.00 | 7760.00 | pending | late |
| 46f6d88b-8b18-4f31-b8aa-171558fdcf26 | LN-20260328-1998 | Jeboy M. Etang | Fri Nov 28 2025 23:59:17 GMT+0800 (China Standard Time) | 155.00 | 3575.00 | pending | late |
| 3e709fbe-81e5-42bb-8b6b-546e2448904b | LN-20260328-0365 | Arcelene B. Castro | Sat Nov 29 2025 00:00:00 GMT+0800 (China Standard Time) | 310.00 | 7760.00 | pending | late |
| e8b52381-d66e-45e0-a8b2-0bb1c18cc011 | LN-20260328-0365 | Arcelene B. Castro | Mon Dec 01 2025 00:00:00 GMT+0800 (China Standard Time) | 310.00 | 7760.00 | pending | late |
| 78e9d6e5-a0fe-4888-bcb8-3c562988309e | LN-20260328-5685 | Maria Camila Lahoylahoy | Mon Dec 01 2025 00:00:00 GMT+0800 (China Standard Time) | 248.00 | 7898.00 | pending | late |


## Payments Missing `schedule_id`

| id | loan_id | loan_number | borrower_name | amount | payment_date | receipt_number |
| --- | --- | --- | --- | --- | --- | --- |
| 8dcd9c04-3b49-42d8-97fd-d04839ace257 | 80c012cb-8f4a-48be-8ac3-0a48dc512a57 | LN-20260420-185234-628551 | aaaaaaaaaa | 700.00 | Wed Apr 22 2026 00:00:00 GMT+0800 (China Standard Time) |  |
| cee75d7c-f2f9-4563-97be-b9fa9918888f | 80c012cb-8f4a-48be-8ac3-0a48dc512a57 | LN-20260420-185234-628551 | aaaaaaaaaa | 5380.00 | Tue Apr 21 2026 21:16:54 GMT+0800 (China Standard Time) |  |
| ccd1c584-610b-45c1-9c52-fec4bc6df2c4 | fd871ed6-5e7a-4a98-abf2-e0e00d159bd8 | LN-20260420-175922-638334 | Bryan Boyd Baldozanso | 60400.00 | Tue Apr 21 2026 01:05:46 GMT+0800 (China Standard Time) |  |
| c08b2741-2013-4b00-b9f7-f08c597acc9f | 4789d8cf-7950-4578-ae08-751a6b84bf65 | LN-20260421-010440-860105 | Bryan Boyd Baldozanso | 2110.00 | Tue Apr 21 2026 00:00:00 GMT+0800 (China Standard Time) |  |
| fec5b44b-53bb-4e41-96b1-2f5b985aae06 | 6f854696-0b6e-4d73-8ff3-9cf95cda812c | LN-20260418-112516-182133 | Dennis Lunzaga | 5055.83 | Mon Apr 20 2026 20:10:48 GMT+0800 (China Standard Time) |  |
| 93d7ca61-05cc-4f79-a57c-a1bcd358bbe3 | 89a5ae64-8ed0-4775-a63a-155e40c018ee | LN-20260417-1482 | Carolina L. Misperos | 15080.00 | Mon Apr 20 2026 19:19:55 GMT+0800 (China Standard Time) |  |
| 61c136c6-5180-4c56-b064-7fca1185c9c0 | 89a5ae64-8ed0-4775-a63a-155e40c018ee | LN-20260417-1482 | Carolina L. Misperos | 15080.00 | Mon Apr 20 2026 19:19:17 GMT+0800 (China Standard Time) |  |
| 4ec9b58a-8551-4339-ada3-9c1541d4fc9b | 89a5ae64-8ed0-4775-a63a-155e40c018ee | LN-20260417-1482 | Carolina L. Misperos | 15080.00 | Mon Apr 20 2026 18:19:15 GMT+0800 (China Standard Time) |  |
| 91963aa0-0d81-44f0-be74-e1820112ca01 | 9f720413-b0e8-45f8-b583-e39cb348bce0 | LN-20260328-5495 | Bryan Boyd Baldozanso | 3950.00 | Mon Apr 20 2026 17:59:22 GMT+0800 (China Standard Time) |  |
| 5e484e01-ce6a-40ae-91ce-eee4bfa0e3b0 | 57c93253-e079-4964-8f99-ba9635f2295b | LN-20260328-4465 | Irene J. Cabintoy | 160.00 | Sat Apr 18 2026 15:33:34 GMT+0800 (China Standard Time) | OR-20260418-153316-277690 |
| 309afe22-d2e4-4971-bb98-63ccd3a35b0c | 57c93253-e079-4964-8f99-ba9635f2295b | LN-20260328-4465 | Irene J. Cabintoy | 160.00 | Sat Apr 18 2026 15:33:16 GMT+0800 (China Standard Time) | OR-20260418-153258-981875 |
| f1d79cd7-2647-4b86-b61c-380e3bf43cba | 57c93253-e079-4964-8f99-ba9635f2295b | LN-20260328-4465 | Irene J. Cabintoy | 160.00 | Sat Apr 18 2026 15:32:58 GMT+0800 (China Standard Time) | OR-20260418-153225-560988 |
| a569e5b6-d22c-4adc-a502-6407c8aa4194 | 57c93253-e079-4964-8f99-ba9635f2295b | LN-20260328-4465 | Irene J. Cabintoy | 160.00 | Sat Apr 18 2026 15:31:42 GMT+0800 (China Standard Time) | OR-20260418-153127-718541 |
| 39dd47d7-e8c4-4349-8649-514be329a48f | 57c93253-e079-4964-8f99-ba9635f2295b | LN-20260328-4465 | Irene J. Cabintoy | 160.00 | Sat Apr 18 2026 15:31:27 GMT+0800 (China Standard Time) | OR-20260418-153110-243561 |
| 8c86d0d0-f27a-4b67-a657-dcf6c295ece6 | 57c93253-e079-4964-8f99-ba9635f2295b | LN-20260328-4465 | Irene J. Cabintoy | 160.00 | Sat Apr 18 2026 15:31:10 GMT+0800 (China Standard Time) | OR-20260418-153054-736418 |
| 77b08755-1483-42f9-84e3-33e7ff6316e5 | f5eadabc-a712-41ea-9984-b0033c8ed106 | LN-20260328-6056 | Rowena Misperos | 6582.00 | Sat Apr 18 2026 11:51:05 GMT+0800 (China Standard Time) |  |
| 97fbdd5d-2066-4641-8b55-03b55f04b0c4 | 2d1b7164-8622-47e8-8d5f-85937b4edebe | LN-20260417-130819-013242 | Dennis Lunzaga | 2215.00 | Sat Apr 18 2026 11:25:16 GMT+0800 (China Standard Time) |  |
| 3ca13e00-f30e-4ce4-9f92-1f0704547b46 | 84b8fbfb-11f6-4d26-a1d3-da075f73da80 | LN-20260328-0404 | Marielle R. Decio | 200.00 | Fri Apr 10 2026 19:32:38 GMT+0800 (China Standard Time) |  |
| c0257208-ee2f-49e9-8fea-3058a27e4a87 | 5fd4eaf1-cdcf-44b3-8c79-7747e0727435 | LN-20260328-2676 | Vangie Domanillo | 250.00 | Fri Mar 20 2026 23:59:17 GMT+0800 (China Standard Time) |  |
| cb010c57-b2f4-4c33-b7db-ef5b82a7d999 | 29b155bf-256d-4c3f-898e-a215b8a2f0c7 | LN-20260328-5523 | Napoleon D. Bello | 320.00 | Fri Mar 20 2026 23:59:17 GMT+0800 (China Standard Time) |  |


## Renewals Whose Previous Loan Is Not Paid

_No rows._


## Loan Totals vs Schedule Totals Mismatches

| id | loan_number | borrower_name | status | loan_total | schedule_total | difference | schedule_count |
| --- | --- | --- | --- | --- | --- | --- | --- |
| f5d3afbc-1132-4dd2-a7b5-fbfad3829848 | LN-20260420-181915-415719 | Carolina L. Misperos | active | 19267.00 | 38534.00 | 19267.00 | 46 |
| b77bf664-9eca-4832-8441-6c89a8b8250a | LN-20260417-9567 | Genara A. Cantiga | active | 6400.00 | 19200.00 | 12800.00 | 120 |
| 083b4173-8e8d-4b66-b77c-77c478a740d2 |  | Lorina Cagabhion Malayan | active | 11360.00 | 0.00 | -11360.00 | 0 |
| 738aeb65-02d2-451a-af15-f87ab116ac19 | LN-20260328-9164 | Fe B. Garbe | active | 6400.00 | 12600.00 | 6200.00 | 40 |
| 6ccc76bc-f80b-48aa-bdec-da351c1eccd7 | LN-20260328-4019 | Gleceria J. Teves | paid | 6200.00 | 0.00 | -6200.00 | 0 |
| a4cae74f-2382-4fef-a85e-57dfe931818b | LN-20260328-8374 | Lorina Cagabhion Malayan | paid | 6200.00 | 0.00 | -6200.00 | 0 |
| 46f28298-19fa-4ef7-bb53-aeb19a1a2019 | LN-20260328-5304 | Geraliz B. Bucao | active | 31000.00 | 31200.00 | 200.00 | 40 |


## Potential Savings Overcredits

| loan_id | loan_number | borrower_name | loan_deposit_amount | auto_deposit_total | overcredit |
| --- | --- | --- | --- | --- | --- |
| 80c012cb-8f4a-48be-8ac3-0a48dc512a57 | LN-20260420-185234-628551 | aaaaaaaaaa | 200.00 | 1200.00 | 1000.00 |
| 4789d8cf-7950-4578-ae08-751a6b84bf65 | LN-20260421-010440-860105 | Bryan Boyd Baldozanso | 200.00 | 400.00 | 200.00 |


## Interpretation

- `payments.loan_id` is effectively the accounting source of truth in current app logic.
- `payment_schedules.status` is derived and may drift from the stored `schedule_id` on individual payments.
- Renewal chains and auto-deposit savings side effects should be reviewed before any historical repair migration.
