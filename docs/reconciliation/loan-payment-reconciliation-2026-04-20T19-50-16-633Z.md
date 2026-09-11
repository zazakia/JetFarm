# Loan and Payment Reconciliation Report

Generated: 2026-04-20T19:50:16.633Z

Mode: read-only SELECT report. No database rows or schema objects were changed.

Sample limit per detail section: 25

## Recommended Review Order

1. Renewals whose previous loan is not paid
2. Borrowers with multiple active loans
3. Overpaid loans
4. Paid loans with remaining balance
5. Schedule total/status mismatches
6. Payments missing schedule links
7. Potential savings overcredits


## Record Counts

| table_name | count |
| --- | --- |
| loans |570 |
| payment_schedules |22771 |
| payments |13177 |
| savings_transactions |52 |


## Summary Counts

| issue | count |
| --- | --- |
| active_status_fully_paid |0 |
| borrowers_with_multiple_active_loans |3 |
| orphan_payments |0 |
| orphan_schedules |0 |
| overpaid_loans |2 |
| paid_status_with_balance |270 |
| payments_without_schedule_id |13176 |
| potential_savings_overcredits |2 |
| renewals_old_loan_not_paid |2 |
| schedule_status_mismatches |4415 |
| schedule_total_mismatches |7 |


## Schedule Total Mismatches

| id | loan_number | borrower_name | status | loan_total | schedule_total | difference | schedule_count |
| --- | --- | --- | --- | --- | --- | --- | --- |
| f5d3afbc-1132-4dd2-a7b5-fbfad3829848 |LN-20260420-181915-415719 |Carolina L. Misperos |active |19267.00 |38534.00 |19267.00 |46 |
| 083b4173-8e8d-4b66-b77c-77c478a740d2 | |Lorina Cagabhion Malayan |active |11360.00 |0.00 |-11360.00 |0 |
| b77bf664-9eca-4832-8441-6c89a8b8250a |LN-20260417-9567 |Genara A. Cantiga |active |6400.00 |12800.00 |6400.00 |80 |
| 738aeb65-02d2-451a-af15-f87ab116ac19 |LN-20260328-9164 |Fe B. Garbe |active |6400.00 |12600.00 |6200.00 |40 |
| 6ccc76bc-f80b-48aa-bdec-da351c1eccd7 |LN-20260328-4019 |Gleceria J. Teves |paid |6200.00 |0.00 |-6200.00 |0 |
| a4cae74f-2382-4fef-a85e-57dfe931818b |LN-20260328-8374 |Lorina Cagabhion Malayan |paid |6200.00 |0.00 |-6200.00 |0 |
| 46f28298-19fa-4ef7-bb53-aeb19a1a2019 |LN-20260328-5304 |Geraliz B. Bucao |active |31000.00 |31200.00 |200.00 |40 |


## Paid Loans With Remaining Balance

| id | loan_number | borrower_name | loan_total | paid | balance |
| --- | --- | --- | --- | --- | --- |
| a4cae74f-2382-4fef-a85e-57dfe931818b |LN-20260328-8374 |Lorina Cagabhion Malayan |6200.00 |0.00 |6200.00 |
| 6ccc76bc-f80b-48aa-bdec-da351c1eccd7 |LN-20260328-4019 |Gleceria J. Teves |6200.00 |1525.00 |4675.00 |
| a7b6c244-8242-4ddd-9558-e6b33cb1b57b |LN-20260328-5099 |Florenda N. Cimene |12400.00 |9277.00 |3123.00 |
| 090aca9f-da08-45ed-aaa2-487bd52dcf7a |LN-20260328-4864 |Alfredo P. Cayanong |12400.00 |9300.00 |3100.00 |
| f907485b-0f75-44e2-aadc-1be0810aaf03 |LN-20260328-6086 |Rosanna T. Germano |18600.00 |15520.00 |3080.00 |
| 4b3c41f2-c17c-4b75-9cb7-4af0e5d221e7 |LN-20260328-7761 |Stephanie G. Cuan |17360.00 |14528.00 |2832.00 |
| 69218e39-6fc7-4210-9e3b-e8b0d19ad697 |LN-20260328-0304 |Rosanna T. Germano |12400.00 |9587.00 |2813.00 |
| 0f7e3b00-074d-48df-9e4f-4506d8b848fd |LN-20260328-5125 |Socorro H. Cuan |8680.00 |6076.00 |2604.00 |
| bf049bfb-0f16-494a-a9e3-f2dd08ae49de |LN-20260328-1606 |Carolina L. Misperos |12400.00 |9800.00 |2600.00 |
| ae1d2448-5abc-46ee-9332-0fe78ef8a04d |LN-20260328-0556 |Stephanie G. Cuan |14880.00 |12459.00 |2421.00 |
| ab21ac86-69ee-45b5-8ee8-d8ab24152ac3 |LN-20260328-4223 |Florenda N. Cimene |14880.00 |12541.00 |2339.00 |
| b713dfc6-27be-4dfb-9159-5049e0becfda |LN-20260328-6767 |Maria Lourdes D. Patricio |24800.00 |22510.00 |2290.00 |
| ade2a4f6-18b0-4648-92c4-861638088a5e |LN-20260328-7447 |Socorro H. Cuan |12400.00 |10180.00 |2220.00 |
| 9675ae33-9f75-40a1-bd60-476cbc278786 |LN-20260328-6643 |Ma. Liza Librea |9920.00 |7702.00 |2218.00 |
| ebb5dad0-c023-47e6-9ccf-86e9014de59f |LN-20260328-8399 |Leonora P. Trigosa |9920.00 |7722.00 |2198.00 |
| 513c0aad-9a31-4168-86f0-be89f18e619c |LN-20260328-1311 |Emma J. Dela Pena |8680.00 |6519.00 |2161.00 |
| 78df4ee6-4b95-4bfe-b943-749f394d8c4c |LN-20260328-6683 |Emma J. Dela Pena |12400.00 |10330.00 |2070.00 |
| 561665ad-a519-45e4-8053-9dad62fb1686 |LN-20260328-2414 |Maria Camila Lahoylahoy |6200.00 |4185.00 |2015.00 |
| 2f38b209-aeb9-4c4c-b838-96ef3d7d4ed9 |LN-20260328-9231 |Arcelene B. Castro |6200.00 |4185.00 |2015.00 |
| 9f486553-b722-4456-ab00-897c0c734518 |LN-20260328-3785 |Maria Lourdes D. Patricio |17360.00 |15360.00 |2000.00 |
| d4945291-7343-450d-b199-892e8fddf8ac |LN-20260328-5515 |Cristita Cagabhion |8680.00 |6684.00 |1996.00 |
| 29e35ee5-d94c-476d-9557-d16019421b88 |LN-20260328-0729 |Irma C. Marquez |8680.00 |6723.00 |1957.00 |
| 1ea90e46-dd92-4e38-8b46-82c189dbe77d |LN-20260328-9533 |Lucita C. Cagabhion |11160.00 |9220.00 |1940.00 |
| b09984c1-5f8b-4188-a3bb-8925e2e3e77c |LN-20260328-7217 |Florenda N. Cimene |12400.00 |10490.00 |1910.00 |
| 282fd30e-2ac1-4120-92c9-cf7f1c7d4fef |LN-20260328-4268 |Helen B. Bacalso |18600.00 |16700.00 |1900.00 |


## Overpaid Loans

| id | loan_number | borrower_name | status | loan_total | paid | overpaid |
| --- | --- | --- | --- | --- | --- | --- |
| 89a5ae64-8ed0-4775-a63a-155e40c018ee |LN-20260417-1482 |Carolina L. Misperos |paid |15080.00 |45240.00 |30160.00 |
| 6d822d22-123a-4e11-a24e-bcd4847e0fe3 |LN-20260328-2360 |Jean M. Sanchez |paid |6200.00 |6355.00 |155.00 |


## Borrowers With Multiple Active Loans

| borrower_id | borrower_name | active_count | active_loans |
| --- | --- | --- | --- |
| 94d708bc-4cae-4a1b-950d-b5d56ca6b61d |Dennis Lunzaga |4 |LN-20260328-8887, LN-20260417-130954-121024, LN-20260418-002350-341883, LN-20260420-201048-543779 |
| 80b57c8e-fb27-4ea4-a303-473f3412c3c6 |Lorina Cagabhion Malayan |3 |LN-20260328-0362, LN-20260328-2478, 083b4173-8e8d-4b66-b77c-77c478a740d2 |
| 8d53e40e-9ff6-4931-8777-c741683292df |Genara A. Cantiga |2 |LN-20260328-6059, LN-20260417-9567 |


## Renewals Whose Previous Loan Is Not Paid

| old_loan_id | old_loan_number | old_status | renewal_loan_id | renewal_loan_number | deducted_amount | borrower_name |
| --- | --- | --- | --- | --- | --- | --- |
| dee78a62-7146-407b-b378-b3b8fd3d8692 |LN-20260328-1318 |active |b4ebef58-a3e8-4d99-bc4a-d4a61c351d4b |LN-20260328-2182 |0.00 |Marilu B. Bande |
| a77fd915-14d2-4346-923f-af2157db6bcd |LN-20260328-7847 |active |9ae93eca-cf6c-489e-bbd5-d0e8c0a10782 |LN-20260328-1495 | |Teofila V.Tamosa |


## Schedule Status Mismatches

| id | loan_number | borrower_name | due_date | scheduled_amount | total_paid | status | expected_status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 07b76597-88a2-4f74-8c41-276e12a43e44 |LN-20260328-3255 |Glen B. Gadil |2025-10-10T15:59:17.000Z |155.00 |4200.00 |pending |paid |
| 75eb2687-b4fd-498a-8951-17884e7e50f2 |LN-20260328-3255 |Glen B. Gadil |2025-10-11T15:59:17.000Z |155.00 |4200.00 |pending |paid |
| fc5f3e8d-6cf8-41b3-ba76-e36b077e4983 |LN-20260328-3255 |Glen B. Gadil |2025-10-13T15:59:17.000Z |155.00 |4200.00 |pending |paid |
| 14917ba7-070e-47cf-9502-9a9b891ba024 |LN-20260328-3255 |Glen B. Gadil |2025-10-14T15:59:17.000Z |155.00 |4200.00 |pending |paid |
| eb81834c-5002-4a34-a0e3-30fc37cba446 |LN-20260328-3255 |Glen B. Gadil |2025-10-15T15:59:17.000Z |155.00 |4200.00 |pending |paid |
| 5d3b2b44-bf0b-4237-b40e-51a0b547b2c0 |LN-20260328-3255 |Glen B. Gadil |2025-10-16T15:59:17.000Z |155.00 |4200.00 |pending |paid |
| 7194b4c0-e8a9-4e75-b291-03a6956ab821 |LN-20260328-3255 |Glen B. Gadil |2025-10-17T15:59:17.000Z |155.00 |4200.00 |pending |paid |
| c5019a20-f82f-489e-830a-29c0ac24f8b2 |LN-20260328-3255 |Glen B. Gadil |2025-10-18T15:59:17.000Z |155.00 |4200.00 |pending |paid |
| befd19a1-a599-4ebe-9446-2ce0cae0399a |LN-20260328-3255 |Glen B. Gadil |2025-10-20T15:59:17.000Z |155.00 |4200.00 |pending |partial |
| ccf8f3f2-26a7-4c1a-926f-71e577d387d1 |LN-20260328-3255 |Glen B. Gadil |2025-10-21T15:59:17.000Z |155.00 |4200.00 |pending |late |
| 033c3392-cf34-47b0-afd4-0ce9b05b8d3f |LN-20260328-3255 |Glen B. Gadil |2025-10-22T15:59:17.000Z |155.00 |4200.00 |pending |late |
| 34d6628d-9bf5-49e0-a91c-a96317f3c01a |LN-20260328-3255 |Glen B. Gadil |2025-10-23T15:59:17.000Z |155.00 |4200.00 |pending |late |
| ab99bd31-9359-4b8c-bac2-fc9febc3edd5 |LN-20260328-3255 |Glen B. Gadil |2025-10-24T15:59:17.000Z |155.00 |4200.00 |pending |late |
| d9de97ca-0c6a-480a-af41-45ff1e42170d |LN-20260328-3255 |Glen B. Gadil |2025-10-25T15:59:17.000Z |155.00 |4200.00 |pending |late |
| a2c0e858-7892-4c50-acfa-80f44acffadb |LN-20260328-3255 |Glen B. Gadil |2025-10-27T15:59:17.000Z |155.00 |4200.00 |pending |late |
| 4f191297-1613-412f-a18f-91ae67f01065 |LN-20260328-3255 |Glen B. Gadil |2025-10-28T15:59:17.000Z |155.00 |4200.00 |pending |late |
| e9830e9e-c6b3-4518-b48b-5714190cc957 |LN-20260328-8536 |Myla P. Soria |2025-10-28T16:00:00.000Z |155.00 |4630.00 |paid |partial |
| 33379faf-40bb-4980-bf87-ed079d50fae5 |LN-20260328-3255 |Glen B. Gadil |2025-10-29T15:59:17.000Z |155.00 |4200.00 |pending |late |
| 7a57c10e-9bc7-41c4-ba06-24b209671c4e |LN-20260328-8536 |Myla P. Soria |2025-10-29T16:00:00.000Z |155.00 |4630.00 |paid |pending |
| 33c6a733-ca23-48ba-8efd-7865f098a519 |LN-20260328-3255 |Glen B. Gadil |2025-10-30T15:59:17.000Z |155.00 |4200.00 |pending |late |
| 958e83bd-d1d1-40b3-8013-a74a10eced68 |LN-20260328-8536 |Myla P. Soria |2025-10-30T16:00:00.000Z |155.00 |4630.00 |paid |pending |
| 00025acd-d743-42c3-ba12-a4749450ef40 |LN-20260328-3255 |Glen B. Gadil |2025-10-31T15:59:17.000Z |155.00 |4200.00 |pending |late |
| 8b8efbdc-ddb3-4a75-a66b-d1a1006c92ea |LN-20260328-8536 |Myla P. Soria |2025-10-31T16:00:00.000Z |155.00 |4630.00 |paid |pending |
| 3190fb1a-0287-421c-a617-e15a339496c9 |LN-20260328-3255 |Glen B. Gadil |2025-11-01T15:59:17.000Z |155.00 |4200.00 |pending |late |
| d1d32186-1354-4695-83d6-bd9e5a174973 |LN-20260328-8536 |Myla P. Soria |2025-11-02T16:00:00.000Z |155.00 |4630.00 |paid |pending |


## Payments Missing Schedule Link Samples

| id | loan_id | loan_number | borrower_name | amount | payment_date | receipt_number |
| --- | --- | --- | --- | --- | --- | --- |
| 8dcd9c04-3b49-42d8-97fd-d04839ace257 |80c012cb-8f4a-48be-8ac3-0a48dc512a57 |LN-20260420-185234-628551 |aaaaaaaaaa |700.00 |2026-04-21T16:00:00.000Z | |
| ccd1c584-610b-45c1-9c52-fec4bc6df2c4 |fd871ed6-5e7a-4a98-abf2-e0e00d159bd8 |LN-20260420-175922-638334 |Bryan Boyd Baldozanso |60400.00 |2026-04-20T17:05:46.394Z | |
| c08b2741-2013-4b00-b9f7-f08c597acc9f |4789d8cf-7950-4578-ae08-751a6b84bf65 |LN-20260421-010440-860105 |Bryan Boyd Baldozanso |2110.00 |2026-04-20T16:00:00.000Z | |
| 55f46649-4091-46c3-a348-4ee1099b70fb |4789d8cf-7950-4578-ae08-751a6b84bf65 |LN-20260421-010440-860105 |Bryan Boyd Baldozanso |2110.00 |2026-04-20T16:00:00.000Z | |
| acf2c903-c037-4fdf-bb62-bb612f3e1012 |4789d8cf-7950-4578-ae08-751a6b84bf65 |LN-20260421-010440-860105 |Bryan Boyd Baldozanso |900.00 |2026-04-20T16:00:00.000Z | |
| fec5b44b-53bb-4e41-96b1-2f5b985aae06 |6f854696-0b6e-4d73-8ff3-9cf95cda812c |LN-20260418-112516-182133 |Dennis Lunzaga |5055.83 |2026-04-20T12:10:48.907Z | |
| 93d7ca61-05cc-4f79-a57c-a1bcd358bbe3 |89a5ae64-8ed0-4775-a63a-155e40c018ee |LN-20260417-1482 |Carolina L. Misperos |15080.00 |2026-04-20T11:19:55.568Z | |
| 61c136c6-5180-4c56-b064-7fca1185c9c0 |89a5ae64-8ed0-4775-a63a-155e40c018ee |LN-20260417-1482 |Carolina L. Misperos |15080.00 |2026-04-20T11:19:17.071Z | |
| 4ec9b58a-8551-4339-ada3-9c1541d4fc9b |89a5ae64-8ed0-4775-a63a-155e40c018ee |LN-20260417-1482 |Carolina L. Misperos |15080.00 |2026-04-20T10:19:15.014Z | |
| 91963aa0-0d81-44f0-be74-e1820112ca01 |9f720413-b0e8-45f8-b583-e39cb348bce0 |LN-20260328-5495 |Bryan Boyd Baldozanso |3950.00 |2026-04-20T09:59:22.699Z | |
| d0c8c117-ec7c-4899-857b-645f4fb44f08 |80c012cb-8f4a-48be-8ac3-0a48dc512a57 |LN-20260420-185234-628551 |aaaaaaaaaa |160.00 |2026-04-19T16:00:00.000Z | |
| 6dd1804f-cd7d-4010-9779-383d646816fe |6f854696-0b6e-4d73-8ff3-9cf95cda812c |LN-20260418-112516-182133 |Dennis Lunzaga |1011.17 |2026-04-19T16:00:00.000Z | |
| 1ca0cc08-9818-45f5-90df-139ba34d4c2c |ec89c0b9-3619-489f-8bb3-063e7ba1aedc |LN-20260420-201048-543779 |Dennis Lunzaga |2050.00 |2026-04-19T16:00:00.000Z | |
| 4d434e06-491a-4888-bf4e-f9942218f8b7 |80c012cb-8f4a-48be-8ac3-0a48dc512a57 |LN-20260420-185234-628551 |aaaaaaaaaa |160.00 |2026-04-19T16:00:00.000Z | |
| 5e484e01-ce6a-40ae-91ce-eee4bfa0e3b0 |57c93253-e079-4964-8f99-ba9635f2295b |LN-20260328-4465 |Irene J. Cabintoy |160.00 |2026-04-18T07:33:34.438Z |OR-20260418-153316-277690 |
| 309afe22-d2e4-4971-bb98-63ccd3a35b0c |57c93253-e079-4964-8f99-ba9635f2295b |LN-20260328-4465 |Irene J. Cabintoy |160.00 |2026-04-18T07:33:16.066Z |OR-20260418-153258-981875 |
| f1d79cd7-2647-4b86-b61c-380e3bf43cba |57c93253-e079-4964-8f99-ba9635f2295b |LN-20260328-4465 |Irene J. Cabintoy |160.00 |2026-04-18T07:32:58.302Z |OR-20260418-153225-560988 |
| a569e5b6-d22c-4adc-a502-6407c8aa4194 |57c93253-e079-4964-8f99-ba9635f2295b |LN-20260328-4465 |Irene J. Cabintoy |160.00 |2026-04-18T07:31:42.890Z |OR-20260418-153127-718541 |
| 39dd47d7-e8c4-4349-8649-514be329a48f |57c93253-e079-4964-8f99-ba9635f2295b |LN-20260328-4465 |Irene J. Cabintoy |160.00 |2026-04-18T07:31:27.555Z |OR-20260418-153110-243561 |
| 8c86d0d0-f27a-4b67-a657-dcf6c295ece6 |57c93253-e079-4964-8f99-ba9635f2295b |LN-20260328-4465 |Irene J. Cabintoy |160.00 |2026-04-18T07:31:10.601Z |OR-20260418-153054-736418 |
| 77b08755-1483-42f9-84e3-33e7ff6316e5 |f5eadabc-a712-41ea-9984-b0033c8ed106 |LN-20260328-6056 |Rowena Misperos |6582.00 |2026-04-18T03:51:05.715Z | |
| 97fbdd5d-2066-4641-8b55-03b55f04b0c4 |2d1b7164-8622-47e8-8d5f-85937b4edebe |LN-20260417-130819-013242 |Dennis Lunzaga |2215.00 |2026-04-18T03:25:16.173Z | |
| 3ca13e00-f30e-4ce4-9f92-1f0704547b46 |84b8fbfb-11f6-4d26-a1d3-da075f73da80 |LN-20260328-0404 |Marielle R. Decio |200.00 |2026-04-10T11:32:38.556Z | |
| 8d177866-65fa-4052-9d57-0030e323b2c7 |b77bf664-9eca-4832-8441-6c89a8b8250a |LN-20260417-9567 |Genara A. Cantiga |160.00 |2026-03-20T16:00:00.000Z | |
| b4f8942c-eb2f-4c66-af0e-56b4eda7380c |b77bf664-9eca-4832-8441-6c89a8b8250a |LN-20260417-9567 |Genara A. Cantiga |160.00 |2026-03-20T16:00:00.000Z | |


## Potential Savings Overcredits

| loan_id | loan_number | borrower_name | loan_deposit_amount | auto_deposit_total | overcredit |
| --- | --- | --- | --- | --- | --- |
| 80c012cb-8f4a-48be-8ac3-0a48dc512a57 |LN-20260420-185234-628551 |aaaaaaaaaa |200.00 |1200.00 |1000.00 |
| 4789d8cf-7950-4578-ae08-751a6b84bf65 |LN-20260421-010440-860105 |Bryan Boyd Baldozanso |200.00 |400.00 |200.00 |


## Notes

- This report intentionally does not apply fixes.
- Existing historical statuses may encode imported business truth that is not reconstructable from payment totals alone.
- Any repair script should default to dry-run and require an explicit `--apply` flag.
- Conservative repair candidates are schedule status recomputation, renewal old-loan closure, and schedule link backfill where FIFO allocation is unambiguous.
